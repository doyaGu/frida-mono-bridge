#!/usr/bin/env -S npx tsx
/**
 * Generate Mono export signatures from C headers.
 * TypeScript version of the original Python script.
 * 
 * This script reads from C header files in data/include/
 * Additional signatures can be added in src/runtime/signatures/manual.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INCLUDE_DIR = path.join(ROOT, 'data', 'include');
const OUTPUT_FILE = path.join(ROOT, 'src', 'runtime', 'signatures', 'generated.ts');

// Regular expressions
const FUNCTION_PATTERN = /MONO_API\s+([\s\S]*?);/g;
const ENUM_PATTERN = /typedef\s+enum\b[^{}]*{[\s\S]*?}\s*(\w+)\s*;/g;
const WHITESPACE_RE = /\s+/g;
const MACRO_RE = /\bMONO_[A-Z0-9_]+\b/g;
const STRUCT_ENUM_RE = /\b(struct|enum)\b\s*/g;
const COMMENT_BLOCK_RE = /\/\*[\s\S]*?\*\//g;
const COMMENT_LINE_RE = /(?:[^:]|^)\/\/.*$/gm;
const ARRAY_RE = /\[[^\]]*\]/g;
const DEFAULT_VALUE_RE = /\s*=\s*[^,]+$/g;
const POINTER_SPACING_RE = /\s*\*\s*/g;

interface FunctionDecl {
    name: string;
    returnType: string;
    parameters: string[];
}

interface MonoExportSignature {
    name: string;
    retType: string;
    argTypes: string[];
}

const NUMBER_TYPE_MAP: Record<string, string> = {
    "void": "void",
    "bool": "bool",
    "_bool": "bool",
    "boolean": "bool",
    "char": "char",
    "signedchar": "int",
    "unsignedchar": "uchar",
    "short": "int",
    "shortint": "int",
    "unsignedshort": "uint",
    "unsignedshortint": "uint",
    "int": "int",
    "int32": "int",
    "long": "long",
    "longint": "long",
    "unsignedlong": "ulong",
    "unsignedlongint": "ulong",
    "unsignedint": "uint",
    "uint": "uint",
    "uint32": "uint",
    "int64": "int64",
    "unsignedint64": "uint64",
    "double": "double",
    "float": "float",
    "size_t": "size_t",
    "time_t": "long",
};

const GENERIC_INT_ALIASES: Record<string, string> = {
    "mono_bool": "int",
    "mono_boolean": "int",
    "mono_unichar2": "uint",
    "gunichar2": "uint",
    "gboolean": "int",
    "gint": "int",
    "guint": "uint",
    "gint32": "int",
    "guint32": "uint",
    "gint16": "int",
    "guint16": "uint",
    "gint8": "int",
    "guint8": "uint",
    "mono_string_hash": "uint",
    "mono_marshaltype": "int",
};

const POINTER_SIZED_INTS = new Set([
    "intptr_t",
    "uintptr_t",
    "ssize_t",
    "gssize",
    "gsize",
    "ptrdiff_t",
]);

function stripComments(source: string): string {
    const withoutBlock = source.replace(COMMENT_BLOCK_RE, " ");
    return withoutBlock.replace(COMMENT_LINE_RE, "$1");
}

function collectEnumTypes(source: string): Set<string> {
    const enumTypes = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = ENUM_PATTERN.exec(source)) !== null) {
        enumTypes.add(match[1]);
    }
    return enumTypes;
}

function* parseFunctions(source: string): Generator<FunctionDecl> {
    let match: RegExpExecArray | null;
    while ((match = FUNCTION_PATTERN.exec(source)) !== null) {
        const declaration = match[1];
        const parsed = parseFunctionDeclaration(declaration);
        if (parsed) {
            yield parsed;
        }
    }
}

function parseFunctionDeclaration(declaration: string): FunctionDecl | null {
    let text = declaration.replace(WHITESPACE_RE, " ").trim();
    text = text.replace(MACRO_RE, " ");
    text = text.replace(STRUCT_ENUM_RE, "");
    text = text.replace(POINTER_SPACING_RE, "*");
    text = text.replace(WHITESPACE_RE, " ").trim();

    if (!text.includes("(") || !text.includes(")")) {
        return null;
    }

    const [beforeParams, paramsTail] = text.split("(", 2);
    const paramsRaw = paramsTail.split(")")[0]?.trim() || "";
    const beforeParamsTrimmed = beforeParams.trim();

    const nameMatch = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(beforeParamsTrimmed);
    if (!nameMatch) {
        return null;
    }

    const name = nameMatch[1];
    const returnType = beforeParamsTrimmed.slice(0, nameMatch.index).trim();
    if (!returnType) {
        return null;
    }

    const parameters = parseParameters(paramsRaw);
    return { name, returnType, parameters };
}

function parseParameters(paramText: string): string[] {
    if (paramText === "" || paramText === "void") {
        return [];
    }

    const params: string[] = [];
    let depth = 0;
    let current: string[] = [];

    for (const ch of paramText) {
        if (ch === "(") {
            depth++;
        } else if (ch === ")") {
            depth--;
        } else if (ch === "," && depth === 0) {
            params.push(current.join(""));
            current = [];
            continue;
        }
        current.push(ch);
    }

    if (current.length > 0) {
        params.push(current.join(""));
    }

    const normalized: string[] = [];
    for (let param of params) {
        param = param.trim();
        if (!param || param === "void") {
            continue;
        }

        param = param.replace(MACRO_RE, " ");
        param = param.replace(ARRAY_RE, "*");
        param = param.replace(DEFAULT_VALUE_RE, "");
        param = param.replace(/\b(const|volatile|restrict)\b/g, " ");
        param = param.replace(WHITESPACE_RE, " ").trim();

        if (param === "...") {
            continue;
        }

        // Check if param ends with a pointer (no variable name, e.g., "void *")
        // In this case, the whole param is the type
        if (/\*$/.test(param)) {
            // Param like "void *" or "char **" - entire thing is the type
            const finalType = param.replace(POINTER_SPACING_RE, "*");
            if (finalType) {
                normalized.push(finalType);
            }
            continue;
        }

        // Separate pointer from variable name: "char*name" -> "char* name"
        // This handles cases like "char*foo" or "void**bar"
        param = param.replace(/(\*+)([a-zA-Z_][a-zA-Z0-9_]*)$/, "$1 $2");
        
        const tokens = param.split(" ");
        const typePart = tokens.slice(0, -1).join(" ").trim();
        const finalType = typePart.replace(POINTER_SPACING_RE, "*");

        if (finalType) {
            normalized.push(finalType);
        }
    }

    return normalized;
}

function normalizeType(typeName: string): string {
    let value = typeName.trim();
    value = value.replace(/\b(const|volatile|restrict)\b/g, " ");
    value = value.replace(STRUCT_ENUM_RE, "");
    value = value.replace(POINTER_SPACING_RE, "*");
    value = value.replace(WHITESPACE_RE, " ").trim();
    return value;
}

function mapNativeType(typeName: string, enumTypes: Set<string>): string {
    if (!typeName) {
        return "void";
    }

    if (typeName.includes("*") || typeName.endsWith("]")) {
        return "pointer";
    }

    const canonical = typeName.replace(/\s+/g, "").toLowerCase();

    if (enumTypes.has(typeName)) {
        return "int";
    }

    if (canonical in NUMBER_TYPE_MAP) {
        return NUMBER_TYPE_MAP[canonical];
    }

    if (canonical in GENERIC_INT_ALIASES) {
        return GENERIC_INT_ALIASES[canonical];
    }

    if (POINTER_SIZED_INTS.has(canonical)) {
        if (canonical.startsWith("u") || canonical.startsWith("gsize")) {
            return "size_t";
        }
        return "long";
    }

    if (canonical.endsWith("_t")) {
        const digits = canonical.replace(/[^\d]/g, "");
        if (digits && parseInt(digits, 10) > 32) {
            return canonical.startsWith("u") ? "uint64" : "int64";
        }
        return canonical.startsWith("u") ? "uint" : "int";
    }

    return "pointer";
}

function formatEntry(name: string, signature: MonoExportSignature): string {
    const argTypes = signature.argTypes.map(arg => `'${arg}'`).join(", ");
    return (
        `  '${name}': {\n` +
        `    name: '${signature.name}',\n` +
        `    retType: '${signature.retType}',\n` +
        `    argTypes: [${argTypes}],\n` +
        `  }`
    );
}

function generate(): void {
    if (!fs.existsSync(INCLUDE_DIR)) {
        console.error(`Include directory not found: ${INCLUDE_DIR}`);
        process.exit(1);
    }

    const includeFiles = fs.readdirSync(INCLUDE_DIR)
        .filter(file => file.endsWith('.h'))
        .sort();

    const enumTypes = new Set<string>();
    const functions: Record<string, MonoExportSignature> = {};

    for (const headerFile of includeFiles) {
        const headerPath = path.join(INCLUDE_DIR, headerFile);
        const source = fs.readFileSync(headerPath, 'utf-8');
        const sanitized = stripComments(source);

        // Collect enum types
        let match: RegExpExecArray | null;
        while ((match = ENUM_PATTERN.exec(sanitized)) !== null) {
            enumTypes.add(match[1]);
        }

        // Parse functions
        for (const decl of parseFunctions(sanitized)) {
            if (!decl.name.startsWith("mono") && !decl.name.startsWith("monoeg")) {
                continue;
            }

            const returnType = normalizeType(decl.returnType);
            const argTypes = decl.parameters.map(p => normalizeType(p));

            const signature: MonoExportSignature = {
                name: decl.name,
                retType: mapNativeType(returnType, enumTypes),
                argTypes: argTypes.map(arg => mapNativeType(arg, enumTypes)),
            };

            functions[decl.name] = signature;
        }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate output content
    const sortedNames = Object.keys(functions).sort();
    const entries = sortedNames.map(name => formatEntry(name, functions[name])).join(",\n");

    const content = (
        "// Auto-generated by scripts/generate-mono-signatures.ts; do not edit by hand.\n" +
        "// Additional signatures can be added in src/runtime/signatures/manual.ts\n\n" +
        "import type { MonoExportSignature } from './types.js';\n\n" +
        "export const GENERATED_SIGNATURES: Record<string, MonoExportSignature> = {\n" +
        `${entries}\n` +
        "};\n"
    );

    fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');
    const relativePath = path.relative(ROOT, OUTPUT_FILE);
    console.log(`Generated ${Object.keys(functions).length} signatures -> ${relativePath}`);
}

// Run the generator
generate();

export { generate };
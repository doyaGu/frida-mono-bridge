#!/usr/bin/env -S npx tsx
/**
 * Generate Mono export signatures from C headers.
 *
 * This script reads from C header files (recursively from mono repo or data/include/)
 * and generates a unified signatures.ts file with all Mono API signatures.
 *
 * **Default Behavior**: Filters signatures to match Unity Mono DLL exports (559 APIs).
 * Use --filter-exported with empty arguments or generate:signatures:all for unfiltered output.
 *
 * Features:
 * - Parses only public APIs marked with MONO_API macro
 * - Filters out variable declarations (extern/static without function signature)
 * - Handles complex function declarations:
 *   • Multi-line declarations
 *   • Function pointer parameters with nested parentheses
 *   • Default parameter values
 *   • const/volatile qualifiers
 *   • struct/enum keywords
 *   • Array parameters (converted to pointers)
 *   • Variadic functions (...)
 *
 * Manual signatures and aliases are defined in data/include/mono-manual.h
 *
 * Usage:
 *   npm run generate:signatures                   # Default: DLL-filtered (559 APIs)
 *   npm run generate:signatures:all               # All headers (1211 APIs)
 *   npm run generate:signatures -- --root C:\path\to\mono
 *   npm run generate:signatures -- --include "mono-*.h" --exclude "test/**"
 *   npm run generate:signatures -- --filter-exported data/custom.dll.ExportFunctions.txt
 */

import * as fs from "fs";
import { minimatch } from "minimatch";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Configuration file support
interface ConfigFile {
  root?: string;
  outputFile?: string;
  commonExportsFile?: string;
  apiPrefixes?: string[];
  include?: string[];
  exclude?: string[];
  verbose?: boolean;
}

function loadConfigFile(): ConfigFile {
  const configPath = path.join(__dirname, "generate-mono-signatures.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to parse config file ${configPath}: ${error}`);
    }
  }
  return {};
}

const userConfig = loadConfigFile();

// Configuration from config file only (paths relative to project root)
const CONFIG = {
  DEFAULT_ROOT: userConfig.root,
  DEFAULT_OUTPUT_FILE: userConfig.outputFile
    ? path.join(ROOT, userConfig.outputFile)
    : path.join(ROOT, "src", "runtime", "signatures.ts"),
  DEFAULT_COMMON_EXPORTS: userConfig.commonExportsFile
    ? path.join(ROOT, userConfig.commonExportsFile)
    : path.join(ROOT, "data", "common_exports.txt"),
  API_PREFIXES: userConfig.apiPrefixes || ["mono", "unity_mono", "monoeg"],
  FUNCTION_PATTERN: /MONO_API\s+([\s\S]*?);/g,
  ENUM_PATTERN: /typedef\s+enum\b[^{}]*{[\s\S]*?}\s*(\w+)\s*;/g,
};

// CLI argument parsing
interface CLIOptions {
  root?: string;
  out: string;
  include: string[];
  exclude: string[];
  commonExports?: string;
  verbose?: boolean;
  help?: boolean;
}

function showHelp(): void {
  console.log(`
Usage: generate-mono-signatures [options]

Options:
  --root <path>            Mono repository root directory
  --out <path>             Output file path
  --include <pattern>      Include pattern (file path or glob, can be used multiple times)
  --exclude <pattern>      Exclude glob pattern (can be used multiple times)
  --common-exports <path>  Filter by common exports file
  --verbose, -v            Enable verbose logging
  --help, -h               Show this help message

Configuration File:
  scripts/generate-mono-signatures.config.json

Examples:
  npm run generate:signatures
  npm run generate:signatures:all
  npx tsx scripts/generate-mono-signatures.ts -- --verbose
  npx tsx scripts/generate-mono-signatures.ts -- --include data/include/custom.h
`);
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  // Convert relative paths in include to absolute (relative to project root)
  const includeFromConfig = (userConfig.include || []).map(p => (path.isAbsolute(p) ? p : path.join(ROOT, p)));

  const options: CLIOptions = {
    root: CONFIG.DEFAULT_ROOT,
    out: CONFIG.DEFAULT_OUTPUT_FILE,
    include: includeFromConfig,
    exclude: userConfig.exclude || [],
    commonExports: CONFIG.DEFAULT_COMMON_EXPORTS,
    verbose: userConfig.verbose || false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--root":
        options.root = args[++i];
        break;
      case "--out":
        options.out = args[++i];
        break;
      case "--include":
        options.include.push(args[++i]);
        break;
      case "--exclude":
        options.exclude.push(args[++i]);
        break;
      case "--common-exports":
        if (i + 1 >= args.length) {
          console.error("Error: --common-exports requires a file path");
          process.exit(1);
        }
        options.commonExports = args[++i];
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--":
        // Ignore npm's separator
        break;
      default:
        if (arg.startsWith("--") || arg.startsWith("-")) {
          console.error(`Unknown argument: ${arg}`);
          console.error("Use --help for usage information");
          process.exit(1);
        }
    }
  }

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  return options;
}

function log(message: string, verbose: boolean = false, level: "info" | "warn" | "error" = "info"): void {
  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else if (verbose || level === "info") {
    console.log(message);
  }
}

// Regular expressions
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
  aliases?: string[];
}

const NUMBER_TYPE_MAP: Record<string, string> = {
  void: "void",
  bool: "bool",
  _bool: "bool",
  boolean: "bool",
  char: "char",
  signedchar: "int",
  unsignedchar: "uchar",
  short: "int",
  shortint: "int",
  unsignedshort: "uint",
  unsignedshortint: "uint",
  int: "int",
  int32: "int",
  long: "long",
  longint: "long",
  unsignedlong: "ulong",
  unsignedlongint: "ulong",
  unsignedint: "uint",
  uint: "uint",
  uint32: "uint",
  int64: "int64",
  unsignedint64: "uint64",
  double: "double",
  float: "float",
  size_t: "size_t",
  time_t: "long",
};

const GENERIC_INT_ALIASES: Record<string, string> = {
  mono_bool: "int",
  mono_boolean: "int",
  mono_unichar2: "uint",
  gunichar2: "uint",
  gboolean: "int",
  gint: "int",
  guint: "uint",
  gint32: "int",
  guint32: "uint",
  gint16: "int",
  guint16: "uint",
  gint8: "int",
  guint8: "uint",
  mono_string_hash: "uint",
  mono_marshaltype: "int",
};

const POINTER_SIZED_INTS = new Set(["intptr_t", "uintptr_t", "ssize_t", "gssize", "gsize", "ptrdiff_t"]);

function stripComments(source: string): string {
  const withoutBlock = source.replace(COMMENT_BLOCK_RE, " ");
  return withoutBlock.replace(COMMENT_LINE_RE, "$1");
}

function collectEnumTypes(source: string): Set<string> {
  const enumTypes = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = CONFIG.ENUM_PATTERN.exec(source)) !== null) {
    enumTypes.add(match[1]);
  }
  return enumTypes;
}

function extractAliases(source: string, functionName: string): string[] {
  const aliases: string[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(functionName) && line.includes("MONO_API")) {
      // Look backwards for @alias comments
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevLine = lines[j];
        const aliasMatch = /\/\*\s*@alias\s+(\w+)\s*\*\//.exec(prevLine);
        if (aliasMatch) {
          aliases.push(aliasMatch[1]);
        }
        // Stop if we hit a non-comment line
        if (prevLine.trim() && !prevLine.trim().startsWith("*") && !prevLine.trim().startsWith("/*")) {
          break;
        }
      }
      break;
    }
  }

  return aliases;
}

function collectGlobalAliases(source: string): Map<string, string[]> {
  const aliasMap = new Map<string, string[]>();
  const lines = source.split("\n");

  for (const line of lines) {
    const match = /\/\*\s*@alias\s+(\w+)\s*\*\//.exec(line);
    if (match) {
      const alias = match[1];
      // Try to find the base function name by removing _internal suffix
      if (alias.endsWith("_internal")) {
        const baseName = alias.replace("_internal", "");
        if (!aliasMap.has(baseName)) {
          aliasMap.set(baseName, []);
        }
        aliasMap.get(baseName)!.push(alias);
      }
    }
  }

  return aliasMap;
}

function* parseFunctions(source: string): Generator<FunctionDecl> {
  let match: RegExpExecArray | null;
  while ((match = CONFIG.FUNCTION_PATTERN.exec(source)) !== null) {
    const declaration = match[1];
    const parsed = parseFunctionDeclaration(declaration);
    if (parsed) {
      yield parsed;
    }
  }
}

function parseFunctionDeclaration(declaration: string): FunctionDecl | null {
  let text = declaration.replace(WHITESPACE_RE, " ").trim();

  // Skip variable declarations (extern, static without parentheses)
  if ((text.startsWith("extern") || text.startsWith("static")) && !text.includes("(")) {
    return null;
  }

  text = text.replace(MACRO_RE, " ");
  text = text.replace(STRUCT_ENUM_RE, "");
  text = text.replace(POINTER_SPACING_RE, "*");
  text = text.replace(WHITESPACE_RE, " ").trim();

  // Must have parentheses to be a function
  if (!text.includes("(") || !text.includes(")")) {
    return null;
  }

  // Find the last closing parenthesis (in case of function pointers)
  const lastCloseParen = text.lastIndexOf(")");
  if (lastCloseParen === -1) {
    return null;
  }

  // Split at the first '(' to get signature, but we need to handle nested parens
  const firstOpenParen = text.indexOf("(");
  if (firstOpenParen === -1) {
    return null;
  }

  const beforeParams = text.substring(0, firstOpenParen);
  const afterParams = text.substring(firstOpenParen + 1);

  // Find matching closing paren (handle nested parens in function pointers)
  let depth = 1;
  let paramsEnd = -1;
  for (let i = 0; i < afterParams.length; i++) {
    if (afterParams[i] === "(") depth++;
    else if (afterParams[i] === ")") {
      depth--;
      if (depth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }

  if (paramsEnd === -1) {
    return null;
  }

  const paramsRaw = afterParams.substring(0, paramsEnd).trim();
  const beforeParamsTrimmed = beforeParams.trim();

  // Extract function name (last identifier before parentheses)
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
    if (/\*$/.test(param)) {
      const finalType = param.replace(POINTER_SPACING_RE, "*");
      if (finalType) {
        normalized.push(finalType);
      }
      continue;
    }

    // Separate pointer from variable name
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

/**
 * Parse common export list (APIs exported by both mono.dll and mono-2.0-bdwgc.dll)
 * @param filePath - Path to common_exports.txt
 * @param prefixes - List of valid API prefixes to accept
 * @param verbose - Enable verbose logging
 * @returns Set of common API names
 */
function parseCommonExports(
  filePath: string,
  prefixes: string[] = CONFIG.API_PREFIXES,
  verbose: boolean = false,
): Set<string> {
  const commonApis = new Set<string>();

  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: Common exports file not found: ${filePath}`);
    return commonApis;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let lineCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
        continue; // Skip empty lines and comments
      }

      // Check if line matches any of the configured prefixes
      const matchesPrefix = prefixes.some(prefix => trimmed.startsWith(prefix));
      if (matchesPrefix) {
        commonApis.add(trimmed);
        lineCount++;
      } else if (verbose) {
        console.warn(`  Skipping unrecognized API: ${trimmed}`);
      }
    }

    if (verbose) {
      console.log(`  Parsed ${lineCount} valid API names from ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Error reading common exports file: ${error}`);
    throw error;
  }

  return commonApis;
}

/**
 * Scan headers based on include/exclude patterns
 * @param baseDir - Base directory for relative paths (optional)
 * @param include - Include patterns (file paths or globs)
 * @param exclude - Exclude patterns
 * @param verbose - Enable verbose logging
 */
function* scanHeaders(
  baseDir: string | undefined,
  include: string[],
  exclude: string[],
  verbose: boolean = false,
): Generator<string> {
  const scannedPaths = new Set<string>();

  for (const pattern of include) {
    // Resolve path
    let resolvedPath: string;
    if (path.isAbsolute(pattern)) {
      resolvedPath = pattern;
    } else if (baseDir) {
      resolvedPath = path.join(baseDir, pattern);
    } else {
      resolvedPath = path.join(ROOT, pattern);
    }

    // Check if it's a concrete file or directory
    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);

      if (stat.isFile() && resolvedPath.endsWith(".h")) {
        // Single header file
        if (!scannedPaths.has(resolvedPath)) {
          if (verbose) {
            console.log(`  Including file: ${path.relative(ROOT, resolvedPath)}`);
          }
          scannedPaths.add(resolvedPath);
          yield resolvedPath;
        }
      } else if (stat.isDirectory()) {
        // Directory: scan all headers
        if (verbose) {
          console.log(`  Scanning directory: ${path.relative(ROOT, resolvedPath)}`);
        }
        for (const headerPath of walkDirectory(resolvedPath, [], exclude)) {
          if (!scannedPaths.has(headerPath)) {
            scannedPaths.add(headerPath);
            yield headerPath;
          }
        }
      }
    } else if (baseDir && !pattern.includes("*")) {
      // Not found as file/directory, might be relative to base
      if (verbose) {
        console.warn(`  Warning: Path not found: ${pattern}`);
      }
    } else if (baseDir) {
      // Glob pattern - walk base directory with pattern
      for (const headerPath of walkDirectory(baseDir, [pattern], exclude)) {
        if (!scannedPaths.has(headerPath)) {
          scannedPaths.add(headerPath);
          yield headerPath;
        }
      }
    }
  }
}

function* walkDirectory(dir: string, include: string[], exclude: string[]): Generator<string> {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkDirectory(fullPath, include, exclude);
    } else if (entry.isFile() && entry.name.endsWith(".h")) {
      const relativePath = path.relative(dir, fullPath).replace(/\\/g, "/");

      // Apply exclude patterns
      if (exclude.length > 0 && exclude.some(pattern => minimatch(relativePath, pattern))) {
        continue;
      }

      // Apply include patterns (if specified)
      if (include.length > 0 && !include.some(pattern => minimatch(relativePath, pattern))) {
        continue;
      }

      yield fullPath;
    }
  }
}

function formatSignatureEntry(name: string, signature: MonoExportSignature, indent: string = "  "): string {
  const argTypes = signature.argTypes.map(arg => `'${arg}'`).join(", ");
  const aliases = signature.aliases
    ? `\n${indent}  aliases: [${signature.aliases.map(a => `'${a}'`).join(", ")}],`
    : "";
  return (
    `${indent}'${name}': {\n` +
    `${indent}  name: '${signature.name}',\n` +
    `${indent}  retType: '${signature.retType}',\n` +
    `${indent}  argTypes: [${argTypes}],${aliases}\n` +
    `${indent}}`
  );
}

function generate(): void {
  const options = parseArgs();

  if (!options.root && options.include.length === 0) {
    console.error("Error: Either --root or --include must be specified");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  if (options.root && !fs.existsSync(options.root)) {
    console.error(`Source directory not found: ${options.root}`);
    process.exit(1);
  }

  if (options.root) {
    console.log(`Scanning headers from: ${options.root}`);
  }
  if (options.include.length > 0) {
    console.log(`Include patterns: ${options.include.length} pattern(s)`);
  }
  if (options.exclude.length > 0) {
    console.log(`Exclude patterns: ${options.exclude.join(", ")}`);
  }

  const enumTypes = new Set<string>();
  let functions: Record<string, MonoExportSignature> = {};

  // Scan headers (from root directory or include patterns)
  let fileCount = 0;
  const scannedFiles: string[] = [];

  // Separate include patterns: those in root vs external
  const externalIncludes: string[] = [];
  const rootIncludes: string[] = [];

  for (const pattern of options.include) {
    const absPath = path.isAbsolute(pattern) ? pattern : path.join(ROOT, pattern);
    if (options.root && absPath.startsWith(options.root)) {
      // Pattern is within root directory
      rootIncludes.push(path.relative(options.root, absPath));
    } else {
      // External file/directory
      externalIncludes.push(absPath);
    }
  }

  if (options.root) {
    // Scan root directory with root-specific include patterns and exclude patterns
    for (const headerPath of walkDirectory(options.root, rootIncludes, options.exclude)) {
      fileCount++;
      scannedFiles.push(headerPath);
      const source = fs.readFileSync(headerPath, "utf-8");
      const sanitized = stripComments(source);

      // Collect enum types
      let match: RegExpExecArray | null;
      while ((match = CONFIG.ENUM_PATTERN.exec(sanitized)) !== null) {
        enumTypes.add(match[1]);
      }

      // Parse functions
      for (const decl of parseFunctions(sanitized)) {
        const hasValidPrefix = CONFIG.API_PREFIXES.some(prefix => decl.name.startsWith(prefix));
        if (!hasValidPrefix) {
          continue;
        }

        const returnType = normalizeType(decl.returnType);
        const argTypes = decl.parameters.map(p => normalizeType(p));
        const aliases = extractAliases(source, decl.name);

        const signature: MonoExportSignature = {
          name: decl.name,
          retType: mapNativeType(returnType, enumTypes),
          argTypes: argTypes.map(arg => mapNativeType(arg, enumTypes)),
        };

        if (aliases.length > 0) {
          signature.aliases = aliases;
        }

        functions[decl.name] = signature;
      }
    }
  }

  // Scan external headers from include patterns (not in root)
  if (externalIncludes.length > 0) {
    if (options.verbose) {
      console.log(`\nProcessing ${externalIncludes.length} external include(s):`);
    }

    for (const headerPath of scanHeaders(undefined, externalIncludes, options.exclude, options.verbose)) {
      // Skip if already scanned from root
      if (scannedFiles.includes(headerPath)) {
        continue;
      }

      fileCount++;
      scannedFiles.push(headerPath);
      const source = fs.readFileSync(headerPath, "utf-8");
      const sanitized = stripComments(source);

      // Collect enum types
      let match: RegExpExecArray | null;
      while ((match = CONFIG.ENUM_PATTERN.exec(sanitized)) !== null) {
        enumTypes.add(match[1]);
      }

      // Parse functions
      for (const decl of parseFunctions(sanitized)) {
        const hasValidPrefix = CONFIG.API_PREFIXES.some(prefix => decl.name.startsWith(prefix));
        if (!hasValidPrefix) {
          continue;
        }

        const returnType = normalizeType(decl.returnType);
        const argTypes = decl.parameters.map(p => normalizeType(p));
        const aliases = extractAliases(source, decl.name);

        const signature: MonoExportSignature = {
          name: decl.name,
          retType: mapNativeType(returnType, enumTypes),
          argTypes: argTypes.map(arg => mapNativeType(arg, enumTypes)),
        };

        if (aliases.length > 0) {
          signature.aliases = aliases;
        }

        functions[decl.name] = signature;
      }
    }
  }

  // Collect and apply global aliases from all scanned files
  for (const scannedFile of scannedFiles) {
    const source = fs.readFileSync(scannedFile, "utf-8");
    const globalAliases = collectGlobalAliases(source);
    for (const [baseName, aliases] of globalAliases.entries()) {
      if (functions[baseName]) {
        functions[baseName].aliases = [...(functions[baseName].aliases || []), ...aliases];
      }
    }
  }

  console.log(`Parsed ${fileCount} header files, found ${Object.keys(functions).length} signatures`);

  // Filter by common exports if specified
  let filteredCount = 0;
  if (options.commonExports) {
    console.log(`\nFiltering by common DLL exports:`);
    const commonApis = parseCommonExports(options.commonExports, CONFIG.API_PREFIXES, options.verbose);
    console.log(`  Loaded ${commonApis.size} common APIs from ${path.basename(options.commonExports)}`);

    const beforeCount = Object.keys(functions).length;
    const filtered: Record<string, MonoExportSignature> = {};
    const missing: string[] = [];

    // Check which common APIs have signatures
    for (const apiName of commonApis) {
      if (functions[apiName]) {
        filtered[apiName] = functions[apiName];
      } else {
        // Check if any function has this as an alias
        let found = false;
        for (const [name, signature] of Object.entries(functions)) {
          if (signature.aliases?.includes(apiName)) {
            filtered[name] = signature;
            found = true;
            break;
          }
        }
        if (!found) {
          missing.push(apiName);
        }
      }
    }

    filteredCount = beforeCount - Object.keys(filtered).length;
    functions = filtered;

    console.log(`  Matched ${Object.keys(functions).length} APIs with signatures`);
    if (missing.length > 0) {
      console.log(`  Missing signatures: ${missing.length} APIs`);
      if (options.verbose) {
        console.log(`  Missing APIs: ${missing.join(", ")}`);
      } else {
        console.log(`  First 10 missing: ${missing.slice(0, 10).join(", ")}`);
        if (missing.length > 10) {
          console.log(`  ... and ${missing.length - 10} more`);
        }
      }
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(options.out);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate output content
  const sortedNames = Object.keys(functions).sort();
  const signatureEntries = sortedNames.map(name => formatSignatureEntry(name, functions[name], "  ")).join(",\n");

  const content = `// Auto-generated by scripts/generate-mono-signatures.ts; do not edit by hand.
// Run: npm run generate:signatures
// Manual additions: data/include/mono-manual.h
//
// This file contains only signature data. Logic functions (buildMonoExportMap, getSignature)
// are in api.ts to maintain separation of concerns.

// ============================================================================
// Type Definitions
// ============================================================================

export interface MonoExportSignature {
  name: string;
  retType: NativeFunctionReturnType;
  argTypes: NativeFunctionArgumentType[];
  aliases?: string[];
}

export type MonoSignatureMap = Record<string, MonoExportSignature>;

// ============================================================================
// All Mono Export Signatures (Generated + Manual)
// ============================================================================

export const ALL_SIGNATURES: MonoSignatureMap = {
${signatureEntries}
};
`;

  fs.writeFileSync(options.out, content, "utf-8");
  const relativePath = path.relative(ROOT, options.out);
  console.log(`Generated ${Object.keys(functions).length} signatures -> ${relativePath}`);
}

// Run the generator
generate();

export { generate };

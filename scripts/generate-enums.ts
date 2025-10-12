import fs from "fs";
import path from "path";

const headersDir = path.resolve(process.cwd(), "data", "include");
const outputPath = path.resolve(process.cwd(), "src", "runtime", "enums.ts");
const headerFiles = fs.readdirSync(headersDir).filter((file) => file.endsWith(".h"));

interface NumericValue {
  value: number;
  literal: string;
}

interface EnumDefinition {
  name: string;
  values: Record<string, NumericValue>;
  source: string;
}

interface DefineDefinition {
  name: string;
  value: NumericValue;
  source: string;
}

const enums: EnumDefinition[] = [];
const definesMap = new Map<string, DefineDefinition>();

const numericExpression = /^[0-9xXa-fA-FuUlL_\s()+\-*/%|&^~<>]+$/;

function cleanNumericExpression(expr: string): string {
  return expr
    .replace(/\b([0-9]+|0x[0-9a-fA-F_]+)[uUlL]+\b/g, "$1")
    .replace(/\(\s*[A-Za-z_]\w*\s*\)/g, "")
    .replace(/\s+/g, "");
}

function extractLiteral(original: string, value: number): string {
  const simplified = original.trim().replace(/\s+/g, "");
  const literalMatch = original.match(/^\s*\(?\s*([+-]?(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|[0-9][0-9_]*))\s*\)?(?:[uUlL]+)?\s*$/);
  if (literalMatch) {
    return literalMatch[1];
  }
  if (/^[+-]?0[xX]/.test(simplified)) {
    return simplified.replace(/[uUlL]+$/i, "");
  }
  return value.toString();
}

function evaluateExpression(expr: string): NumericValue | null {
  const sanitised = cleanNumericExpression(expr);
  if (!numericExpression.test(sanitised)) {
    return null;
  }
  try {
    const value = Function(`"use strict"; return (${sanitised});`)();
    if (typeof value === "number" && Number.isFinite(value)) {
      return { value, literal: extractLiteral(expr, value) };
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function parseEnumBody(rawBody: string): Record<string, NumericValue> {
  const values: Record<string, NumericValue> = {};
  const entries = rawBody.split(",");
  let nextValue = 0;
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) {
      continue;
    }
    const parts = entry.split(/\s*=\s*/);
    const key = parts[0].trim();
    if (!/^\w+$/.test(key)) {
      continue;
    }
    let numeric: NumericValue | null = null;
    let value: number;
    if (parts.length > 1) {
      const expr = parts.slice(1).join("=").trim();
      const evaluated = evaluateExpression(expr);
      if (evaluated === null) {
        values[key] = { value: nextValue, literal: nextValue.toString() };
        nextValue += 1;
        continue;
      }
      numeric = evaluated;
      value = evaluated.value;
      nextValue = value + 1;
    } else {
      value = nextValue;
      nextValue += 1;
    }
    values[key] = numeric ?? { value, literal: value.toString() };
  }
  return values;
}

for (const file of headerFiles) {
  const headerPath = path.join(headersDir, file);
  const original = fs.readFileSync(headerPath, "utf8");
  const content = stripComments(original);

  const enumRegex = /(typedef\s+)?enum\s*(?:\w+)?\s*\{([\s\S]*?)\}\s*(\w+)?\s*;/g;
  let enumMatch: RegExpExecArray | null;
  while ((enumMatch = enumRegex.exec(content)) !== null) {
    const isTypedef = Boolean(enumMatch[1]);
    const rawBody = enumMatch[2];
    const enumName = enumMatch[3] ?? null;
    const values = parseEnumBody(rawBody);
    if (Object.keys(values).length === 0) {
      continue;
    }

    if (isTypedef && enumName) {
      enums.push({ name: enumName, values, source: file });
    } else {
      for (const [key, value] of Object.entries(values)) {
        if (!definesMap.has(key)) {
          definesMap.set(key, { name: key, value, source: file });
        }
      }
    }
  }

  const defineRegex = /^#define\s+(\w+)\s+([^\s].*)$/gm;
  let defineMatch: RegExpExecArray | null;
  while ((defineMatch = defineRegex.exec(original)) !== null) {
    const macro = defineMatch[1];
    const valueExpr = defineMatch[2].trim();
    if (macro.includes("(") || macro.includes(")") || macro.startsWith("_") || macro.endsWith("_H_") || macro.includes("__")) {
      continue;
    }
    const cleanedValue = valueExpr.split(/\s+/)[0];
    const evaluated = evaluateExpression(cleanedValue);
    if (evaluated === null) {
      continue;
    }
    if (!definesMap.has(macro)) {
      definesMap.set(macro, { name: macro, value: evaluated, source: file });
    }
  }
}

enums.sort((a, b) => a.name.localeCompare(b.name));
const defines = Array.from(definesMap.values()).sort((a, b) => a.name.localeCompare(b.name));

const lines: string[] = [];
lines.push("// Auto-generated from data/include/*.h by scripts/generate-enums.ts");
lines.push("// DO NOT EDIT MANUALLY");
lines.push("");

if (enums.length > 0) {
  lines.push("export const MonoEnums = Object.freeze({");
  for (const item of enums) {
    lines.push(`  ${item.name}: Object.freeze({`);
    for (const [key, value] of Object.entries(item.values)) {
      lines.push(`    ${key}: ${value.literal},`);
    }
    lines.push("  }),");
  }
  lines.push("} as const);\n");
} else {
  lines.push("export const MonoEnums = {} as const;\n");
}

lines.push("export type MonoEnumName = keyof typeof MonoEnums;");
lines.push("export type MonoEnumValues<Name extends MonoEnumName> = typeof MonoEnums[Name];\n");

lines.push("export const MonoDefines = Object.freeze({");
for (const item of defines) {
  lines.push(`  ${item.name}: ${item.value.literal},`);
}
lines.push("} as const);\n");

fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

console.log(`Generated ${enums.length} enums and ${defines.length} defines.`);


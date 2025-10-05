import { GENERATED_SIGNATURES } from "./signatures/generated";
import { MANUAL_ADDITIONS, MANUAL_OVERRIDES } from "./signatures/manual";
import type { MonoExportSignature, MonoSignatureMap } from "./signatures/types";

export type { MonoExportSignature } from "./signatures/types";

const MONO_EXPORTS: MonoSignatureMap = buildMonoExportMap();

export type MonoApiName = keyof typeof MONO_EXPORTS;

export function getSignature(name: MonoApiName): MonoExportSignature {
  const signature = MONO_EXPORTS[name];
  if (!signature) {
    throw new Error(`Mono export signature not found: ${name}`);
  }
  return signature;
}

export { MONO_EXPORTS };

export const ALL_MONO_EXPORTS = Object.freeze(Object.keys(MONO_EXPORTS) as MonoApiName[]);

function buildMonoExportMap(): MonoSignatureMap {
  const merged: MonoSignatureMap = { ...GENERATED_SIGNATURES };

  for (const [name, signature] of Object.entries(MANUAL_ADDITIONS)) {
    merged[name] = normalizeSignature(name, signature);
  }

  for (const [name, override] of Object.entries(MANUAL_OVERRIDES)) {
    const existing = merged[name];
    if (!existing) {
      merged[name] = normalizeSignature(name, {
        name,
        retType: "pointer",
        argTypes: [],
        ...override,
      });
      continue;
    }
    merged[name] = {
      ...existing,
      ...override,
      name,
      argTypes: override.argTypes ?? existing.argTypes,
      retType: override.retType ?? existing.retType,
      aliases: mergeAliases(existing.aliases, override.aliases),
    };
  }
  for (const [name, signature] of Object.entries(merged)) {
    merged[name] = Object.freeze({
      ...signature,
      argTypes: [...signature.argTypes],
      aliases: signature.aliases ? [...signature.aliases] : undefined,
    });
  }

  return Object.freeze(merged) as MonoSignatureMap;
}

function normalizeSignature(name: string, signature: MonoExportSignature): MonoExportSignature {
  return {
    ...signature,
    name: signature.name ?? name,
    argTypes: signature.argTypes ? [...signature.argTypes] : [],
    aliases: signature.aliases ? [...signature.aliases] : undefined,
  };
}

function mergeAliases(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) {
    return undefined;
  }
  const set = new Set<string>();
  if (a) {
    for (const value of a) {
      set.add(value);
    }
  }
  if (b) {
    for (const value of b) {
      set.add(value);
    }
  }
  return Array.from(set);
}

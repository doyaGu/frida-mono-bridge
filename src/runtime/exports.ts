/**
 * Mono Export Mappings - Transforms signature definitions into runtime exports.
 *
 * This module bridges the gap between pure signature data (signatures.ts)
 * and the runtime API layer (api.ts), providing:
 * - Signature lookup and validation
 * - Export map construction with immutability
 * - Type-safe API name definitions
 *
 * Architecture:
 * signatures.ts (pure data) -> exports.ts (logic) -> api.ts (runtime)
 *
 * @module runtime/exports
 */

import { MonoErrorCodes, raise } from "../utils/errors";
import { ALL_SIGNATURES, MonoExportSignature, MonoSignatureMap } from "./signatures";

// ============================================================================
// SIGNATURE MAP CONSTRUCTION
// ============================================================================

/**
 * Builds and freezes the complete Mono export map from signature definitions.
 * Creates immutable copies of all signatures to prevent accidental modifications.
 *
 * @returns Frozen map of all Mono export signatures
 */
function buildMonoExportMap(): MonoSignatureMap {
  const merged: MonoSignatureMap = {};

  for (const [name, signature] of Object.entries(ALL_SIGNATURES)) {
    merged[name] = Object.freeze({
      ...signature,
      argTypes: [...signature.argTypes],
      aliases: signature.aliases ? [...signature.aliases] : undefined,
    });
  }

  return Object.freeze(merged) as MonoSignatureMap;
}

// ============================================================================
// RUNTIME EXPORTS
// ============================================================================

/**
 * Complete map of all Mono export signatures.
 * Frozen for immutability and thread-safety.
 */
export const MONO_EXPORTS: MonoSignatureMap = buildMonoExportMap();

/**
 * Type representing all valid Mono API names.
 * Automatically derived from the MONO_EXPORTS map.
 */
export type MonoApiName = keyof typeof MONO_EXPORTS;

/**
 * Frozen array of all Mono API names for iteration.
 */
export const ALL_MONO_EXPORTS = Object.freeze(Object.keys(MONO_EXPORTS) as MonoApiName[]);

// ============================================================================
// SIGNATURE LOOKUP
// ============================================================================

/**
 * Retrieves a specific Mono API signature by name.
 * Throws an error if the signature is not found.
 *
 * @param name - Name of the Mono API function
 * @returns The function's signature definition
 * @throws {MonoExportNotFoundError} If signature not found
 *
 * @example
 * const sig = getSignature('mono_domain_get');
 * // => { name: 'mono_domain_get', retType: 'pointer', argTypes: [] }
 */
export function getSignature(name: MonoApiName): MonoExportSignature {
  const signature = MONO_EXPORTS[name];
  if (!signature) {
    raise(
      MonoErrorCodes.EXPORT_NOT_FOUND,
      `Mono export signature not found: ${name}`,
      "This export may not be available in your Mono runtime version",
    );
  }
  return signature;
}

/**
 * Tries to retrieve a specific Mono API signature by name without throwing.
 *
 * @param name - Name of the Mono API function
 * @returns The function's signature definition, or null if not found
 */
export function tryGetSignature(name: string): MonoExportSignature | null {
  return (MONO_EXPORTS as Record<string, MonoExportSignature>)[name] ?? null;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

/**
 * Re-export types from signatures for convenience.
 */
export type { MonoExportSignature, MonoSignatureMap } from "./signatures";

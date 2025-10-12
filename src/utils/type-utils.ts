/**
 * Type checking and manipulation utilities for Mono types
 * Extracted from common-utilities.ts for better organization
 */

/**
 * Check if value represents a pointer-like type based on Mono type kind
 * @param kind - MonoTypeKind enum value
 */
export function isPointerLike(kind: number): boolean {
  // Common pointer-like type kinds in Mono
  return kind === 0x1 || // OBJECT
         kind === 0x2 || // SZARRAY
         kind === 0x3 || // STRING
         kind === 0x4 || // CLASS
         kind === 0x6 || // GENERICINST
         kind === 0x8 || // ARRAY
         kind === 0x1C; // PTR
}

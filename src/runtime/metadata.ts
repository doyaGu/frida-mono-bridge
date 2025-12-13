/**
 * Metadata Attributes - .NET/Mono metadata attribute constants and utilities.
 *
 * Provides constants and utilities for working with CLR metadata attributes:
 * - FieldAttribute: Field visibility, static, literal, etc.
 * - MethodAttribute: Method visibility, static, virtual, abstract, etc.
 * - MethodImplAttribute: Implementation details (IL, native, internal call)
 * - TypeAttribute: Type visibility, layout, semantics, etc.
 *
 * These match the ECMA-335 CLI specification.
 *
 * @module runtime/metadata
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Dictionary of flag names to numeric values.
 */
type FlagDictionary = Readonly<Record<string, number>>;

/**
 * Result of flag analysis.
 */
export interface FlagAnalysis {
  /** Raw flags value */
  raw: number;
  /** Hex representation */
  hex: string;
  /** List of matching flag names */
  flags: string[];
}

// ============================================================================
// FIELD ATTRIBUTES
// ============================================================================

/**
 * Field attribute flags from ECMA-335.
 *
 * @example
 * ```typescript
 * if (hasFlag(fieldFlags, FieldAttribute.Static)) {
 *   console.log('Field is static');
 * }
 * ```
 */
export const FieldAttribute = Object.freeze({
  /** Mask for field access level */
  FieldAccessMask: 0x0007,
  /** Member not referenceable */
  PrivateScope: 0x0000,
  /** Accessible only by parent type */
  Private: 0x0001,
  /** Accessible by subtypes in same assembly */
  FamANDAssem: 0x0002,
  /** Accessible by types in same assembly */
  Assembly: 0x0003,
  /** Accessible by subtypes anywhere */
  Family: 0x0004,
  /** Accessible by subtypes and types in same assembly */
  FamORAssem: 0x0005,
  /** Accessible by anyone */
  Public: 0x0006,
  /** Field is static */
  Static: 0x0010,
  /** Field can only be set in constructors */
  InitOnly: 0x0020,
  /** Value is compile-time constant */
  Literal: 0x0040,
  /** Field is not serialized */
  NotSerialized: 0x0080,
  /** Field has RVA data */
  HasFieldRva: 0x0100,
  /** Field is special (name describes how) */
  SpecialName: 0x0200,
  /** Runtime special name */
  RTSpecialName: 0x0400,
  /** Field has marshaling info */
  HasFieldMarshal: 0x1000,
  /** Field is implemented via P/Invoke */
  PInvokeImpl: 0x2000,
  /** Field has a default value */
  HasDefault: 0x8000,
} as const);

/** Type for FieldAttribute values */
export type FieldAttributeFlags = typeof FieldAttribute;

// ============================================================================
// METHOD ATTRIBUTES
// ============================================================================

/**
 * Method attribute flags from ECMA-335.
 *
 * @example
 * ```typescript
 * if (hasFlag(methodFlags, MethodAttribute.Virtual)) {
 *   console.log('Method is virtual');
 * }
 * ```
 */
export const MethodAttribute = Object.freeze({
  /** Mask for member access level */
  MemberAccessMask: 0x0007,
  /** Member not referenceable */
  PrivateScope: 0x0000,
  /** Accessible only by parent type */
  Private: 0x0001,
  /** Accessible by subtypes in same assembly */
  FamANDAssem: 0x0002,
  /** Accessible by types in same assembly */
  Assembly: 0x0003,
  /** Accessible by subtypes anywhere */
  Family: 0x0004,
  /** Accessible by subtypes and types in same assembly */
  FamORAssem: 0x0005,
  /** Accessible by anyone */
  Public: 0x0006,
  /** Method is exported to unmanaged code */
  UnmanagedExport: 0x0008,
  /** Method is static */
  Static: 0x0010,
  /** Method cannot be overridden */
  Final: 0x0020,
  /** Method is virtual */
  Virtual: 0x0040,
  /** Hide by signature (vs by name) */
  HideBySig: 0x0080,
  /** Method reuses slot (vs always gets a new slot) */
  NewSlot: 0x0100,
  /** Method is abstract */
  Abstract: 0x0400,
  /** Method is special (name describes how) */
  SpecialName: 0x0800,
  /** Runtime special name */
  RTSpecialName: 0x1000,
  /** Method is implemented via P/Invoke */
  PInvokeImpl: 0x2000,
  /** Method has security attributes */
  HasSecurity: 0x4000,
  /** Method requires a security object */
  RequireSecObject: 0x8000,
} as const);

/** Type for MethodAttribute values */
export type MethodAttributeFlags = typeof MethodAttribute;

// ============================================================================
// METHOD IMPL ATTRIBUTES
// ============================================================================

/**
 * Method implementation attribute flags from ECMA-335.
 *
 * @example
 * ```typescript
 * if (hasFlag(implFlags, MethodImplAttribute.InternalCall)) {
 *   console.log('Method is an internal call');
 * }
 * ```
 */
export const MethodImplAttribute = Object.freeze({
  /** Mask for code type */
  CodeTypeMask: 0x0003,
  /** Method implementation is CIL */
  IL: 0x0000,
  /** Method implementation is native */
  Native: 0x0001,
  /** Method implementation is OPTIL */
  OPTIL: 0x0002,
  /** Method implementation is runtime provided */
  Runtime: 0x0003,
  /** Mask for managed/unmanaged */
  ManagedMask: 0x0004,
  /** Code is managed */
  Managed: 0x0000,
  /** Code is unmanaged */
  Unmanaged: 0x0004,
  /** Method cannot be inlined */
  NoInlining: 0x0008,
  /** Method is defined elsewhere */
  ForwardRef: 0x0010,
  /** Method is single-threaded through body */
  Synchronized: 0x0020,
  /** Method should not be optimized */
  NoOptimization: 0x0040,
  /** Preserve method signature for P/Invoke */
  PreserveSig: 0x0080,
  /** Method should be aggressively inlined */
  AggressiveInlining: 0x0100,
  /** Method should be aggressively optimized */
  AggressiveOptimization: 0x0200,
  /** Method is internal call to runtime */
  InternalCall: 0x1000,
} as const);

/** Type for MethodImplAttribute values */
export type MethodImplAttributeFlags = typeof MethodImplAttribute;

// ============================================================================
// TYPE ATTRIBUTES
// ============================================================================

/**
 * Type attribute flags from ECMA-335.
 *
 * @example
 * ```typescript
 * if (hasFlag(typeFlags, TypeAttribute.Interface)) {
 *   console.log('Type is an interface');
 * }
 * ```
 */
export const TypeAttribute = Object.freeze({
  /** Mask for type visibility */
  VisibilityMask: 0x00000007,
  /** Not public */
  NotPublic: 0x00000000,
  /** Public */
  Public: 0x00000001,
  /** Public nested type */
  NestedPublic: 0x00000002,
  /** Private nested type */
  NestedPrivate: 0x00000003,
  /** Family nested type */
  NestedFamily: 0x00000004,
  /** Assembly nested type */
  NestedAssembly: 0x00000005,
  /** FamANDAssem nested type */
  NestedFamANDAssem: 0x00000006,
  /** FamORAssem nested type */
  NestedFamORAssem: 0x00000007,
  /** Mask for class layout */
  LayoutMask: 0x00000018,
  /** Auto layout */
  AutoLayout: 0x00000000,
  /** Sequential layout */
  SequentialLayout: 0x00000008,
  /** Explicit layout */
  ExplicitLayout: 0x00000010,
  /** Mask for class vs interface */
  ClassSemanticsMask: 0x00000020,
  /** Type is a class */
  Class: 0x00000000,
  /** Type is an interface */
  Interface: 0x00000020,
  /** Type is abstract */
  Abstract: 0x00000080,
  /** Type is sealed */
  Sealed: 0x00000100,
  /** Type has a special name */
  SpecialName: 0x00000400,
  /** Runtime special name */
  RTSpecialName: 0x00000800,
  /** Type is imported */
  Import: 0x00001000,
  /** Type is serializable */
  Serializable: 0x00002000,
  /** Windows Runtime type */
  WindowsRuntime: 0x00004000,
  /** Mask for string format */
  StringFormatMask: 0x00030000,
  /** ANSI string format */
  AnsiClass: 0x00000000,
  /** Unicode string format */
  UnicodeClass: 0x00010000,
  /** Auto string format */
  AutoClass: 0x00020000,
  /** Type initializer called before field access */
  BeforeFieldInit: 0x00100000,
  /** Type has security attributes */
  HasSecurity: 0x00040000,
} as const);

/** Type for TypeAttribute values */
export type TypeAttributeFlags = typeof TypeAttribute;

// ============================================================================
// FLAG UTILITIES
// ============================================================================

/**
 * Check if a flags value has a specific flag set.
 *
 * @param flags The flags value to check
 * @param mask The flag mask to test
 * @returns True if (flags & mask) === mask
 *
 * @example
 * ```typescript
 * const flags = MethodAttribute.Public | MethodAttribute.Static;
 * hasFlag(flags, MethodAttribute.Static); // true
 * hasFlag(flags, MethodAttribute.Virtual); // false
 * ```
 */
export function hasFlag(flags: number, mask: number): boolean {
  return (flags & mask) === mask;
}

/**
 * Check if any of the specified flags are set.
 *
 * @param flags The flags value to check
 * @param masks One or more masks to test
 * @returns True if any mask matches
 */
export function hasAnyFlag(flags: number, ...masks: number[]): boolean {
  return masks.some(mask => hasFlag(flags, mask));
}

/**
 * Check if all of the specified flags are set.
 *
 * @param flags The flags value to check
 * @param masks One or more masks to test
 * @returns True if all masks match
 */
export function hasAllFlags(flags: number, ...masks: number[]): boolean {
  return masks.every(mask => hasFlag(flags, mask));
}

/**
 * Get all flag names that match the given flags value.
 *
 * @param flags The flags value to analyze
 * @param map The flag dictionary to use
 * @returns Array of matching flag names
 *
 * @example
 * ```typescript
 * const flags = MethodAttribute.Public | MethodAttribute.Static;
 * pickFlags(flags, MethodAttribute); // ['Public', 'Static']
 * ```
 */
export function pickFlags<T extends FlagDictionary>(flags: number, map: T): string[] {
  const selected: string[] = [];
  for (const key of Object.keys(map)) {
    const value = map[key];
    if (value !== 0 && (flags & value) === value) {
      selected.push(key);
    }
  }
  return selected;
}

/**
 * Get the value after applying a mask.
 * Useful for extracting enum values from flags.
 *
 * @param flags The flags value
 * @param mask The mask to apply
 * @returns The masked value
 *
 * @example
 * ```typescript
 * // Get the access level from method flags
 * const access = getMaskedValue(flags, MethodAttribute.MemberAccessMask);
 * ```
 */
export function getMaskedValue(flags: number, mask: number): number {
  return flags & mask;
}

/**
 * Analyze flags and return detailed information.
 *
 * @param flags The flags value to analyze
 * @param map The flag dictionary to use
 * @returns Analysis result with raw, hex, and flag names
 *
 * @example
 * ```typescript
 * const analysis = analyzeFlags(methodFlags, MethodAttribute);
 * console.log(analysis);
 * // { raw: 6, hex: '0x0006', flags: ['Public'] }
 * ```
 */
export function analyzeFlags<T extends FlagDictionary>(flags: number, map: T): FlagAnalysis {
  return {
    raw: flags,
    hex: `0x${flags.toString(16).padStart(4, "0")}`,
    flags: pickFlags(flags, map),
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the visibility level name from field flags.
 * @param flags Field flags
 * @returns Visibility name (e.g., 'Public', 'Private')
 */
export function getFieldVisibility(flags: number): string {
  const access = getMaskedValue(flags, FieldAttribute.FieldAccessMask);
  switch (access) {
    case FieldAttribute.Public:
      return "Public";
    case FieldAttribute.Private:
      return "Private";
    case FieldAttribute.Family:
      return "Protected";
    case FieldAttribute.Assembly:
      return "Internal";
    case FieldAttribute.FamORAssem:
      return "ProtectedInternal";
    case FieldAttribute.FamANDAssem:
      return "PrivateProtected";
    case FieldAttribute.PrivateScope:
      return "PrivateScope";
    default:
      return "Unknown";
  }
}

/**
 * Get the visibility level name from method flags.
 * @param flags Method flags
 * @returns Visibility name (e.g., 'Public', 'Private')
 */
export function getMethodVisibility(flags: number): string {
  const access = getMaskedValue(flags, MethodAttribute.MemberAccessMask);
  switch (access) {
    case MethodAttribute.Public:
      return "Public";
    case MethodAttribute.Private:
      return "Private";
    case MethodAttribute.Family:
      return "Protected";
    case MethodAttribute.Assembly:
      return "Internal";
    case MethodAttribute.FamORAssem:
      return "ProtectedInternal";
    case MethodAttribute.FamANDAssem:
      return "PrivateProtected";
    case MethodAttribute.PrivateScope:
      return "PrivateScope";
    default:
      return "Unknown";
  }
}

/**
 * Get the visibility level name from type flags.
 * @param flags Type flags
 * @returns Visibility name (e.g., 'Public', 'Internal')
 */
export function getTypeVisibility(flags: number): string {
  const visibility = getMaskedValue(flags, TypeAttribute.VisibilityMask);
  switch (visibility) {
    case TypeAttribute.Public:
      return "Public";
    case TypeAttribute.NotPublic:
      return "Internal";
    case TypeAttribute.NestedPublic:
      return "NestedPublic";
    case TypeAttribute.NestedPrivate:
      return "NestedPrivate";
    case TypeAttribute.NestedFamily:
      return "NestedProtected";
    case TypeAttribute.NestedAssembly:
      return "NestedInternal";
    case TypeAttribute.NestedFamORAssem:
      return "NestedProtectedInternal";
    case TypeAttribute.NestedFamANDAssem:
      return "NestedPrivateProtected";
    default:
      return "Unknown";
  }
}

/**
 * Check if a method is an internal call.
 * @param implFlags Method implementation flags
 */
export function isInternalCall(implFlags: number): boolean {
  return hasFlag(implFlags, MethodImplAttribute.InternalCall);
}

/**
 * Check if a method is native (not IL).
 * @param implFlags Method implementation flags
 */
export function isNativeMethod(implFlags: number): boolean {
  const codeType = getMaskedValue(implFlags, MethodImplAttribute.CodeTypeMask);
  return codeType === MethodImplAttribute.Native;
}

/**
 * Check if a type is an interface.
 * @param typeFlags Type flags
 */
export function isInterface(typeFlags: number): boolean {
  return hasFlag(typeFlags, TypeAttribute.Interface);
}

/**
 * Check if a type is abstract.
 * @param typeFlags Type flags
 */
export function isAbstractType(typeFlags: number): boolean {
  return hasFlag(typeFlags, TypeAttribute.Abstract);
}

/**
 * Check if a type is sealed (cannot be inherited).
 * @param typeFlags Type flags
 */
export function isSealedType(typeFlags: number): boolean {
  return hasFlag(typeFlags, TypeAttribute.Sealed);
}

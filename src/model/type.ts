import { MonoEnums } from "../runtime/enums";
import { lazy } from "../utils/cache";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";

const MonoTypeEnum = MonoEnums.MonoTypeEnum;

// ============================================================================
// MONO TYPE KIND CONSTANTS
// ============================================================================

/**
 * Constants representing the different kind of Mono types.
 *
 * These map to the internal MONO_TYPE_* enum values and classify
 * the fundamental type categories in the Mono type system.
 */
export const MonoTypeKind = Object.freeze({
  End: MonoTypeEnum.MONO_TYPE_END,
  Void: MonoTypeEnum.MONO_TYPE_VOID,
  Boolean: MonoTypeEnum.MONO_TYPE_BOOLEAN,
  Char: MonoTypeEnum.MONO_TYPE_CHAR,
  I1: MonoTypeEnum.MONO_TYPE_I1,
  U1: MonoTypeEnum.MONO_TYPE_U1,
  I2: MonoTypeEnum.MONO_TYPE_I2,
  U2: MonoTypeEnum.MONO_TYPE_U2,
  I4: MonoTypeEnum.MONO_TYPE_I4,
  U4: MonoTypeEnum.MONO_TYPE_U4,
  I8: MonoTypeEnum.MONO_TYPE_I8,
  U8: MonoTypeEnum.MONO_TYPE_U8,
  R4: MonoTypeEnum.MONO_TYPE_R4,
  R8: MonoTypeEnum.MONO_TYPE_R8,
  String: MonoTypeEnum.MONO_TYPE_STRING,
  Pointer: MonoTypeEnum.MONO_TYPE_PTR,
  ByRef: MonoTypeEnum.MONO_TYPE_BYREF,
  ValueType: MonoTypeEnum.MONO_TYPE_VALUETYPE,
  Class: MonoTypeEnum.MONO_TYPE_CLASS,
  GenericVar: MonoTypeEnum.MONO_TYPE_VAR,
  Array: MonoTypeEnum.MONO_TYPE_ARRAY,
  GenericInstance: MonoTypeEnum.MONO_TYPE_GENERICINST,
  TypedByRef: MonoTypeEnum.MONO_TYPE_TYPEDBYREF,
  Int: MonoTypeEnum.MONO_TYPE_I,
  UInt: MonoTypeEnum.MONO_TYPE_U,
  FunctionPointer: MonoTypeEnum.MONO_TYPE_FNPTR,
  Object: MonoTypeEnum.MONO_TYPE_OBJECT,
  SingleDimArray: MonoTypeEnum.MONO_TYPE_SZARRAY,
  GenericMethodVar: MonoTypeEnum.MONO_TYPE_MVAR,
  CModReqd: MonoTypeEnum.MONO_TYPE_CMOD_REQD,
  CModOpt: MonoTypeEnum.MONO_TYPE_CMOD_OPT,
  Internal: MonoTypeEnum.MONO_TYPE_INTERNAL,
  Modifier: MonoTypeEnum.MONO_TYPE_MODIFIER,
  Sentinel: MonoTypeEnum.MONO_TYPE_SENTINEL,
  Pinned: MonoTypeEnum.MONO_TYPE_PINNED,
  Enum: MonoTypeEnum.MONO_TYPE_ENUM,
} as const);

export type MonoTypeKind = (typeof MonoTypeKind)[keyof typeof MonoTypeKind];

// ============================================================================
// TYPE KIND METADATA TABLES
// ============================================================================

/** Maps MonoTypeKind to Frida NativeFunction type strings */
const NATIVE_TYPE_MAP: Record<number, string> = {
  [MonoTypeKind.Void]: "void",
  [MonoTypeKind.Boolean]: "bool",
  [MonoTypeKind.Char]: "uint16",
  [MonoTypeKind.I1]: "int8",
  [MonoTypeKind.U1]: "uint8",
  [MonoTypeKind.I2]: "int16",
  [MonoTypeKind.U2]: "uint16",
  [MonoTypeKind.I4]: "int32",
  [MonoTypeKind.U4]: "uint32",
  [MonoTypeKind.I8]: "int64",
  [MonoTypeKind.U8]: "uint64",
  [MonoTypeKind.R4]: "float",
  [MonoTypeKind.R8]: "double",
};

/** Primitive type sizes in bytes (fixed-size types only) */
const PRIMITIVE_SIZES: Record<number, number> = {
  [MonoTypeKind.Boolean]: 1,
  [MonoTypeKind.I1]: 1,
  [MonoTypeKind.U1]: 1,
  [MonoTypeKind.Char]: 2,
  [MonoTypeKind.I2]: 2,
  [MonoTypeKind.U2]: 2,
  [MonoTypeKind.I4]: 4,
  [MonoTypeKind.U4]: 4,
  [MonoTypeKind.R4]: 4,
  [MonoTypeKind.I8]: 8,
  [MonoTypeKind.U8]: 8,
  [MonoTypeKind.R8]: 8,
};

/** Type kind classification sets */
const TYPE_CATEGORIES = {
  pointer: new Set<number>([
    MonoTypeKind.Pointer,
    MonoTypeKind.ByRef,
    MonoTypeKind.FunctionPointer,
    MonoTypeKind.Int,
    MonoTypeKind.UInt,
  ]),
  numeric: new Set<number>([
    MonoTypeKind.I1,
    MonoTypeKind.U1,
    MonoTypeKind.I2,
    MonoTypeKind.U2,
    MonoTypeKind.I4,
    MonoTypeKind.U4,
    MonoTypeKind.I8,
    MonoTypeKind.U8,
    MonoTypeKind.R4,
    MonoTypeKind.R8,
    MonoTypeKind.Int,
    MonoTypeKind.UInt,
  ]),
  primitive: new Set<number>([
    MonoTypeKind.Boolean,
    MonoTypeKind.Char,
    MonoTypeKind.I1,
    MonoTypeKind.U1,
    MonoTypeKind.I2,
    MonoTypeKind.U2,
    MonoTypeKind.I4,
    MonoTypeKind.U4,
    MonoTypeKind.I8,
    MonoTypeKind.U8,
    MonoTypeKind.R4,
    MonoTypeKind.R8,
    MonoTypeKind.Int,
    MonoTypeKind.UInt,
  ]),
  value: new Set<number>([
    MonoTypeKind.ValueType,
    MonoTypeKind.Enum,
    MonoTypeKind.Boolean,
    MonoTypeKind.Char,
    MonoTypeKind.I1,
    MonoTypeKind.U1,
    MonoTypeKind.I2,
    MonoTypeKind.U2,
    MonoTypeKind.I4,
    MonoTypeKind.U4,
    MonoTypeKind.I8,
    MonoTypeKind.U8,
    MonoTypeKind.R4,
    MonoTypeKind.R8,
    MonoTypeKind.Int,
    MonoTypeKind.UInt,
  ]),
  array: new Set<number>([MonoTypeKind.Array, MonoTypeKind.SingleDimArray]),
} as const;

/** Native type aliases for compatibility checking */
const NATIVE_TYPE_ALIASES: Record<string, string[]> = {
  int: ["int32"],
  int32: ["int"],
  uint: ["uint32"],
  uint32: ["uint"],
  long: ["int64"],
  int64: ["long"],
  ulong: ["uint64"],
  uint64: ["ulong"],
  pointer: ["void*"],
  "void*": ["pointer"],
};

// ============================================================================
// TYPE KIND UTILITY FUNCTIONS
// ============================================================================

/** Convert MonoTypeKind to native type string for NativeFunction */
export function monoTypeKindToNative(kind: MonoTypeKind): string {
  return NATIVE_TYPE_MAP[kind] ?? "pointer";
}

/** Check if two native types are compatible */
export function isCompatibleNativeType(
  provided: NativeFunctionReturnType | NativeFunctionArgumentType,
  expected: string,
): boolean {
  if (provided === expected) return true;
  if (NATIVE_TYPE_ALIASES[provided as string]?.includes(expected)) return true;
  const isPtr = (t: string) => t === "pointer" || t === "void*" || t.endsWith("*");
  return isPtr(provided as string) && isPtr(expected);
}

/** Check if a MonoTypeKind represents a pointer-like type */
export function isPointerLikeKind(kind: MonoTypeKind): boolean {
  return TYPE_CATEGORIES.pointer.has(kind);
}

/** Get the size in bytes for a primitive MonoTypeKind */
export function getPrimitiveSize(kind: MonoTypeKind): number {
  if (TYPE_CATEGORIES.pointer.has(kind)) return Process.pointerSize;
  return PRIMITIVE_SIZES[kind] ?? 0;
}

/** Check if kind is a numeric type */
export function isNumericKind(kind: MonoTypeKind): boolean {
  return TYPE_CATEGORIES.numeric.has(kind);
}

/** Check if kind is a primitive type */
export function isPrimitiveKind(kind: MonoTypeKind): boolean {
  return TYPE_CATEGORIES.primitive.has(kind);
}

/** Check if kind is a value type */
export function isValueTypeKind(kind: MonoTypeKind): boolean {
  return TYPE_CATEGORIES.value.has(kind);
}

/** Check if kind is an array type */
export function isArrayKind(kind: MonoTypeKind): boolean {
  return TYPE_CATEGORIES.array.has(kind);
}

// ============================================================================
// PRIMITIVE VALUE READ/WRITE
// ============================================================================

/** Options for reading primitive values */
export interface ValueReadOptions {
  /** Return Int64/UInt64 as bigint instead of number */
  returnBigInt?: boolean;
}

/**
 * Read a primitive value from memory based on MonoTypeKind
 */
export function readPrimitiveValue(ptr: NativePointer, kind: MonoTypeKind, options: ValueReadOptions = {}): unknown {
  switch (kind) {
    case MonoTypeKind.Boolean:
      return ptr.readU8() !== 0;
    case MonoTypeKind.I1:
      return ptr.readS8();
    case MonoTypeKind.U1:
      return ptr.readU8();
    case MonoTypeKind.Char:
      return ptr.readU16();
    case MonoTypeKind.I2:
      return ptr.readS16();
    case MonoTypeKind.U2:
      return ptr.readU16();
    case MonoTypeKind.I4:
      return ptr.readS32();
    case MonoTypeKind.U4:
      return ptr.readU32();
    case MonoTypeKind.I8:
      return options.returnBigInt ? BigInt(ptr.readS64().toString()) : ptr.readS64().toNumber();
    case MonoTypeKind.U8:
      return options.returnBigInt ? BigInt(ptr.readU64().toString()) : ptr.readU64().toNumber();
    case MonoTypeKind.R4:
      return ptr.readFloat();
    case MonoTypeKind.R8:
      return ptr.readDouble();
    case MonoTypeKind.Pointer:
    case MonoTypeKind.ByRef:
    case MonoTypeKind.FunctionPointer:
    case MonoTypeKind.Int:
    case MonoTypeKind.UInt:
      return ptr.readPointer();
    default:
      return null;
  }
}

/**
 * Write a primitive value to memory based on MonoTypeKind
 */
export function writePrimitiveValue(ptr: NativePointer, kind: MonoTypeKind, value: unknown): void {
  switch (kind) {
    case MonoTypeKind.Boolean:
      ptr.writeU8(value ? 1 : 0);
      break;
    case MonoTypeKind.I1:
      ptr.writeS8(value as number);
      break;
    case MonoTypeKind.U1:
      ptr.writeU8(value as number);
      break;
    case MonoTypeKind.Char:
      ptr.writeU16(value as number);
      break;
    case MonoTypeKind.I2:
      ptr.writeS16(value as number);
      break;
    case MonoTypeKind.U2:
      ptr.writeU16(value as number);
      break;
    case MonoTypeKind.I4:
      ptr.writeS32(value as number);
      break;
    case MonoTypeKind.U4:
      ptr.writeU32(value as number);
      break;
    case MonoTypeKind.I8:
      ptr.writeS64(value as number | Int64);
      break;
    case MonoTypeKind.U8:
      ptr.writeU64(value as number | UInt64);
      break;
    case MonoTypeKind.R4:
      ptr.writeFloat(value as number);
      break;
    case MonoTypeKind.R8:
      ptr.writeDouble(value as number);
      break;
    case MonoTypeKind.Pointer:
    case MonoTypeKind.ByRef:
    case MonoTypeKind.FunctionPointer:
    case MonoTypeKind.Int:
    case MonoTypeKind.UInt:
      ptr.writePointer(value as NativePointer);
      break;
  }
}

// ============================================================================
// TYPE NAME FORMAT
// ============================================================================

const MonoTypeNameFormatEnum = MonoEnums.MonoTypeNameFormat;

/** Format options for type name output */
export const MonoTypeNameFormat = Object.freeze({
  IL: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_IL,
  Reflection: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_REFLECTION,
  FullName: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_FULL_NAME,
  AssemblyQualified: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_ASSEMBLY_QUALIFIED,
} as const);

export type MonoTypeNameFormat = (typeof MonoTypeNameFormat)[keyof typeof MonoTypeNameFormat];

// ============================================================================
// TYPE SUMMARY INTERFACE
// ============================================================================

/** Summary information for a MonoType */
export interface MonoTypeSummary {
  name: string;
  fullName: string;
  kind: MonoTypeKind;
  isByRef: boolean;
  isPointer: boolean;
  isReferenceType: boolean;
  isValueType: boolean;
  isGeneric: boolean;
  isVoid: boolean;
  isArray: boolean;
  arrayRank: number;
  size: number;
  alignment: number;
  pointer: string;
}

/**
 * Represents a type in the Mono runtime type system.
 *
 * MonoType provides access to type metadata including kind (class, struct, array, etc.),
 * size, alignment, and relationships to other types. This is the fundamental type
 * representation in the Mono runtime.
 *
 * @remarks
 * MonoType corresponds to System.Type in the CLR but represents the internal
 * Mono representation. Use `MonoClass.getType()` or `MonoMethod.getReturnType()`
 * to obtain MonoType instances.
 *
 * @example
 * ```typescript
 * // Get type from a class
 * const stringType = stringClass.getType();
 *
 * // Check type characteristics
 * console.log(`Kind: ${stringType.getKind()}`);
 * console.log(`Is reference type: ${stringType.isReferenceType()}`);
 * console.log(`Full name: ${stringType.fullName}`);
 *
 * // Get type summary
 * console.log(stringType.describe());
 * ```
 */
export class MonoType extends MonoHandle {
  // ===== CORE PROPERTIES =====

  /**
   * Get the type kind (classification).
   *
   * @returns The MonoTypeKind value
   *
   * @example
   * ```typescript
   * const kind = type.kind;
   * switch (kind) {
   *   case MonoTypeKind.Class:
   *     console.log("Reference type");
   *     break;
   *   case MonoTypeKind.ValueType:
   *     console.log("Value type");
   *     break;
   * }
   * ```
   */
  @lazy
  get kind(): MonoTypeKind {
    return this.native.mono_type_get_type(this.pointer) as MonoTypeKind;
  }

  /**
   * Get the short type name.
   *
   * @returns Type name without namespace (e.g., "Int32")
   *
   * @example
   * ```typescript
   * console.log(type.name); // "Int32"
   * ```
   */
  @lazy
  get name(): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name(this.pointer));
  }

  /**
   * Get the full type name with namespace.
   *
   * @param format The name format (default: FullName)
   * @returns Formatted type name
   *
   * @example
   * ```typescript
   * console.log(type.fullName); // "System.Int32"
   * console.log(type.getFullName(MonoTypeNameFormat.IL)); // "int32"
   * console.log(type.getFullName(MonoTypeNameFormat.AssemblyQualified));
   * // "System.Int32, mscorlib, Version=..."
   * ```
   */
  getFullName(format: number = MonoTypeNameFormat.FullName): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name_full(this.pointer, format));
  }

  /**
   * Get the full type name (cached accessor property).
   *
   * @example
   * ```typescript
   * console.log(type.fullName); // "System.Int32"
   * ```
   */
  @lazy
  get fullName(): string {
    return this.getFullName();
  }

  // ===== TYPE RELATIONSHIPS =====

  /**
   * Get the MonoClass associated with this type.
   *
   * @returns MonoClass if available, null otherwise
   *
   * @example
   * ```typescript
   * const klass = type.class;
   * if (klass) {
   *   console.log(`Class: ${klass.fullName}`);
   * }
   * ```
   */
  @lazy
  get class(): MonoClass | null {
    const klassPtr = this.native.mono_type_get_class(this.pointer);
    return pointerIsNull(klassPtr) ? null : new MonoClass(this.api, klassPtr);
  }

  /**
   * Get the underlying type (for enums, byref, etc.).
   *
   * @returns Underlying MonoType if available, null otherwise
   *
   * @example
   * ```typescript
   * // For an enum type, get the underlying integer type
   * const underlying = enumType.underlyingType;
   * console.log(underlying?.name); // "Int32"
   * ```
   */
  @lazy
  get underlyingType(): MonoType | null {
    const typePtr = this.native.mono_type_get_underlying_type(this.pointer);
    return pointerIsNull(typePtr) ? null : new MonoType(this.api, typePtr);
  }

  /**
   * Get the element type (for arrays, pointers, byref).
   *
   * @returns Element MonoType if applicable, null otherwise
   *
   * @example
   * ```typescript
   * // For int[], get the int type
   * const element = arrayType.elementType;
   * console.log(element?.name); // "Int32"
   * ```
   */
  @lazy
  get elementType(): MonoType | null {
    const kind = this.kind;
    let elementPtr: NativePointer;

    switch (kind) {
      case MonoTypeKind.Array:
      case MonoTypeKind.SingleDimArray: {
        const arrayClass = this.native.mono_type_get_class(this.pointer);
        if (pointerIsNull(arrayClass)) {
          return null;
        }
        const elementClass = this.native.mono_class_get_element_class(arrayClass);
        if (pointerIsNull(elementClass)) {
          return null;
        }
        elementPtr = this.native.mono_class_get_type(elementClass);
        break;
      }
      case MonoTypeKind.Pointer:
      case MonoTypeKind.ByRef:
      case MonoTypeKind.GenericInstance:
      case MonoTypeKind.GenericVar:
      case MonoTypeKind.GenericMethodVar:
      case MonoTypeKind.Enum: {
        elementPtr = this.native.mono_type_get_underlying_type(this.pointer);
        break;
      }
      default:
        return null;
    }

    return pointerIsNull(elementPtr) ? null : new MonoType(this.api, elementPtr);
  }

  // ===== TYPE CHARACTERISTICS =====

  /**
   * Check if this type is a by-reference type (ref T).
   *
   * @returns true if this is a by-reference type
   *
   * @example
   * ```typescript
   * if (type.byRef) {
   *   console.log("This is a ref parameter");
   * }
   * ```
   */
  @lazy
  get byRef(): boolean {
    return (this.native.mono_type_is_byref(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a pointer type (T*).
   *
   * @returns true if this is a pointer type
   *
   * @example
   * ```typescript
   * if (type.pointer) {
   *   console.log("This is a pointer type");
   * }
   * ```
   */
  @lazy
  get pointerType(): boolean {
    // NOTE: mono_type_is_pointer is only available in mono-2.0-bdwgc.dll
    if (this.api.hasExport("mono_type_is_pointer")) {
      return (this.native.mono_type_is_pointer(this.pointer) as number) !== 0;
    }
    // Fallback: Check type kind
    return this.kind === MonoTypeKind.Pointer;
  }

  /**
   * Check if this type is a reference type (class, interface, delegate).
   *
   * @returns true if this is a reference type
   *
   * @example
   * ```typescript
   * if (type.referenceType) {
   *   console.log("This is a reference type (class)");
   * }
   * ```
   */
  @lazy
  get referenceType(): boolean {
    return (this.native.mono_type_is_reference(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a generic type parameter (T in List<T>).
   *
   * @returns true if this is a generic type parameter
   *
   * @example
   * ```typescript
   * if (type.genericParameter) {
   *   console.log("This is a generic type parameter");
   * }
   * ```
   */
  @lazy
  get genericParameter(): boolean {
    // NOTE: mono_type_is_generic_parameter is only available in mono-2.0-bdwgc.dll
    if (this.api.hasExport("mono_type_is_generic_parameter")) {
      return (this.native.mono_type_is_generic_parameter(this.pointer) as number) !== 0;
    }
    // Fallback: Check type kind for generic parameter variants (GenericVar = T, GenericMethodVar = TMethod)
    const kind = this.kind;
    return kind === MonoTypeKind.GenericVar || kind === MonoTypeKind.GenericMethodVar;
  }

  /**
   * Check if this type is a value type (struct, enum, primitive).
   */
  @lazy
  get valueType(): boolean {
    return isValueTypeKind(this.kind);
  }

  /**
   * Check if this type is the void type.
   */
  @lazy
  get isVoid(): boolean {
    return this.kind === MonoTypeKind.Void;
  }

  /**
   * Check if this type is an array type.
   */
  @lazy
  get isArray(): boolean {
    const kind = this.kind;
    return kind === MonoTypeKind.Array || kind === MonoTypeKind.SingleDimArray;
  }

  /**
   * Get the rank (number of dimensions) of an array type.
   * Returns 0 for non-array types.
   * Returns 1 for single-dimensional arrays (SZARRAY).
   * Returns the actual rank for multi-dimensional arrays (ARRAY).
   */
  @lazy
  get arrayRank(): number {
    const kind = this.kind;

    // Single-dimensional array (SZARRAY) always has rank 1
    if (kind === MonoTypeKind.SingleDimArray) {
      return 1;
    }

    // Multi-dimensional array (ARRAY) - get rank from class
    if (kind === MonoTypeKind.Array) {
      const arrayClass = this.native.mono_type_get_class(this.pointer);
      if (!pointerIsNull(arrayClass)) {
        const rank = this.native.mono_class_get_rank(arrayClass) as number;
        return rank;
      }
    }

    // Not an array type
    return 0;
  }

  // ===== SIZE INFORMATION =====

  /**
   * Get the stack size and alignment for this type.
   *
   * @returns Object with size and alignment in bytes
   *
   * @example
   * ```typescript
   * const { size, alignment } = type.stackSize;
   * console.log(`Stack size: ${size}, alignment: ${alignment}`);
   * ```
   */
  @lazy
  get stackSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_stack_size(this.pointer, alignPtr) as number;
    const alignment = alignPtr.readU32();
    return { size, alignment };
  }

  /**
   * Get the value size and alignment for this type.
   *
   * @returns Object with size and alignment in bytes
   *
   * @example
   * ```typescript
   * const { size, alignment } = type.valueSize;
   * console.log(`Value size: ${size}, alignment: ${alignment}`);
   * ```
   */
  @lazy
  get valueSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_size(this.pointer, alignPtr) as number;
    const alignment = alignPtr.readU32();
    return { size, alignment };
  }

  // ===== FORMATTING METHODS =====

  /**
   * Get the type name formatted for method signatures.
   *
   * @param includeNamespace Whether to include the namespace (default: true)
   * @returns Formatted type name
   *
   * @example
   * ```typescript
   * console.log(type.getSignatureName()); // "System.Int32"
   * console.log(type.getSignatureName(false)); // "Int32"
   * ```
   */
  getSignatureName(includeNamespace = true): string {
    const format = includeNamespace ? MonoTypeNameFormat.FullName : MonoTypeNameFormat.Reflection;
    return this.getFullName(format);
  }

  // ===== SUMMARY & DESCRIPTION =====

  /**
   * Get a summary object containing comprehensive type information.
   *
   * @returns Object with type metadata
   *
   * @example
   * ```typescript
   * const summary = type.getSummary();
   * console.log(JSON.stringify(summary, null, 2));
   * ```
   */
  getSummary(): MonoTypeSummary {
    const { size, alignment } = this.valueSize;
    return {
      name: this.name,
      fullName: this.fullName,
      kind: this.kind,
      isByRef: this.byRef,
      isPointer: this.pointerType,
      isReferenceType: this.referenceType,
      isValueType: this.valueType,
      isGeneric: this.genericParameter,
      isVoid: this.isVoid,
      isArray: this.isArray,
      arrayRank: this.arrayRank,
      size,
      alignment,
      pointer: this.pointer.toString(),
    };
  }

  /**
   * Get a human-readable description of this type.
   *
   * @returns Formatted string with type details
   *
   * @example
   * ```typescript
   * console.log(type.describe());
   * // MonoType: System.Int32
   * //   Kind: I4 (ValueType)
   * //   Size: 4 bytes, Alignment: 4
   * ```
   */
  describe(): string {
    const summary = this.getSummary();
    const kindNameStr = this.kindName;
    const characteristics: string[] = [];

    if (summary.isValueType) characteristics.push("ValueType");
    else if (summary.isReferenceType) characteristics.push("ReferenceType");
    if (summary.isByRef) characteristics.push("ByRef");
    if (summary.isPointer) characteristics.push("Pointer");
    if (summary.isGeneric) characteristics.push("Generic");
    if (summary.isArray) characteristics.push(`Array[${summary.arrayRank}]`);
    if (summary.isVoid) characteristics.push("Void");

    return [
      `MonoType: ${summary.fullName}`,
      `  Kind: ${kindNameStr} (${characteristics.join(", ") || "none"})`,
      `  Size: ${summary.size} bytes, Alignment: ${summary.alignment}`,
      `  Pointer: ${summary.pointer}`,
    ].join("\n");
  }

  /**
   * Returns a string representation of this type.
   *
   * @returns The full type name
   *
   * @example
   * ```typescript
   * console.log(type.toString()); // "System.Int32"
   * ```
   */
  override toString(): string {
    return this.fullName;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get a human-readable name for the type kind.
   *
   * @returns Kind name string
   *
   * @example
   * ```typescript
   * console.log(type.kindName); // "I4", "Class", "String", etc.
   * ```
   */
  @lazy
  get kindName(): string {
    const kind = this.kind;
    for (const [name, value] of Object.entries(MonoTypeKind)) {
      if (value === kind) {
        return name;
      }
    }
    return `Unknown(${kind})`;
  }

  /**
   * Check if this type is a primitive type.
   *
   * @returns true if this is a primitive type
   *
   * @example
   * ```typescript
   * if (type.isPrimitive()) {
   *   console.log("This is a primitive type");
   * }
   * ```
   */
  @lazy
  get isPrimitive(): boolean {
    return isPrimitiveKind(this.kind);
  }

  /**
   * Check if this type is a numeric type.
   */
  @lazy
  get isNumeric(): boolean {
    return isNumericKind(this.kind);
  }

  /**
   * Check if this type is an enum type.
   */
  @lazy
  get isEnum(): boolean {
    return this.kind === MonoTypeKind.Enum;
  }

  /**
   * Check if this is a generic instantiation (e.g., List<int>).
   */
  @lazy
  get isGenericInstance(): boolean {
    return this.kind === MonoTypeKind.GenericInstance;
  }

  /**
   * Check if types are equal (by comparing names).
   *
   * @param other Another type to compare
   * @returns true if types are equal
   *
   * @example
   * ```typescript
   * if (type1.equals(type2)) {
   *   console.log("Types are equal");
   * }
   * ```
   */
  equals(other: MonoType): boolean {
    return this.fullName === other.fullName;
  }

  // ===== PRIVATE HELPER METHODS =====

  private readNativeString(factory: () => NativePointer): string {
    const namePtr = factory();
    if (pointerIsNull(namePtr)) {
      return "";
    }
    try {
      return readUtf8String(namePtr);
    } finally {
      this.api.tryFree(namePtr);
    }
  }
}

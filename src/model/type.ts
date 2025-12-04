import { readU32 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";
import { MonoEnums } from "../runtime/enums";

const MonoTypeEnum = MonoEnums.MonoTypeEnum;

/**
 * Constants representing the different kind of Mono types.
 *
 * These map to the internal MONO_TYPE_* enum values and classify
 * the fundamental type categories in the Mono type system.
 *
 * @remarks
 * This includes primitive types (Int32, String, etc.), composite types
 * (Class, ValueType, Array), and special types (ByRef, Pointer, Generic).
 *
 * @example
 * ```typescript
 * if (type.getKind() === MonoTypeKind.String) {
 *   console.log("This is a string type");
 * }
 *
 * const isNumeric = [
 *   MonoTypeKind.I4, MonoTypeKind.I8,
 *   MonoTypeKind.R4, MonoTypeKind.R8
 * ].includes(type.getKind());
 * ```
 */
export const MonoTypeKind = Object.freeze({
  /** End marker type */
  End: MonoTypeEnum.MONO_TYPE_END,
  /** void type */
  Void: MonoTypeEnum.MONO_TYPE_VOID,
  /** System.Boolean */
  Boolean: MonoTypeEnum.MONO_TYPE_BOOLEAN,
  /** System.Char */
  Char: MonoTypeEnum.MONO_TYPE_CHAR,
  /** System.SByte (signed 8-bit) */
  I1: MonoTypeEnum.MONO_TYPE_I1,
  /** System.Byte (unsigned 8-bit) */
  U1: MonoTypeEnum.MONO_TYPE_U1,
  /** System.Int16 (signed 16-bit) */
  I2: MonoTypeEnum.MONO_TYPE_I2,
  /** System.UInt16 (unsigned 16-bit) */
  U2: MonoTypeEnum.MONO_TYPE_U2,
  /** System.Int32 (signed 32-bit) */
  I4: MonoTypeEnum.MONO_TYPE_I4,
  /** System.UInt32 (unsigned 32-bit) */
  U4: MonoTypeEnum.MONO_TYPE_U4,
  /** System.Int64 (signed 64-bit) */
  I8: MonoTypeEnum.MONO_TYPE_I8,
  /** System.UInt64 (unsigned 64-bit) */
  U8: MonoTypeEnum.MONO_TYPE_U8,
  /** System.Single (32-bit float) */
  R4: MonoTypeEnum.MONO_TYPE_R4,
  /** System.Double (64-bit float) */
  R8: MonoTypeEnum.MONO_TYPE_R8,
  /** System.String */
  String: MonoTypeEnum.MONO_TYPE_STRING,
  /** Pointer type (T*) */
  Pointer: MonoTypeEnum.MONO_TYPE_PTR,
  /** ByRef type (ref T) */
  ByRef: MonoTypeEnum.MONO_TYPE_BYREF,
  /** Value type (struct) */
  ValueType: MonoTypeEnum.MONO_TYPE_VALUETYPE,
  /** Reference type (class) */
  Class: MonoTypeEnum.MONO_TYPE_CLASS,
  /** Generic type parameter (T in List<T>) */
  GenericVar: MonoTypeEnum.MONO_TYPE_VAR,
  /** Multi-dimensional array */
  Array: MonoTypeEnum.MONO_TYPE_ARRAY,
  /** Instantiated generic type (List<int>) */
  GenericInstance: MonoTypeEnum.MONO_TYPE_GENERICINST,
  /** TypedReference */
  TypedByRef: MonoTypeEnum.MONO_TYPE_TYPEDBYREF,
  /** Native integer (IntPtr) */
  Int: MonoTypeEnum.MONO_TYPE_I,
  /** Native unsigned integer (UIntPtr) */
  UInt: MonoTypeEnum.MONO_TYPE_U,
  /** Function pointer */
  FunctionPointer: MonoTypeEnum.MONO_TYPE_FNPTR,
  /** System.Object */
  Object: MonoTypeEnum.MONO_TYPE_OBJECT,
  /** Single-dimensional zero-based array (T[]) */
  SingleDimArray: MonoTypeEnum.MONO_TYPE_SZARRAY,
  /** Generic method parameter (T in Method<T>) */
  GenericMethodVar: MonoTypeEnum.MONO_TYPE_MVAR,
  /** Required custom modifier */
  CModReqd: MonoTypeEnum.MONO_TYPE_CMOD_REQD,
  /** Optional custom modifier */
  CModOpt: MonoTypeEnum.MONO_TYPE_CMOD_OPT,
  /** Internal use */
  Internal: MonoTypeEnum.MONO_TYPE_INTERNAL,
  /** Type modifier */
  Modifier: MonoTypeEnum.MONO_TYPE_MODIFIER,
  /** Sentinel for vararg */
  Sentinel: MonoTypeEnum.MONO_TYPE_SENTINEL,
  /** Pinned type */
  Pinned: MonoTypeEnum.MONO_TYPE_PINNED,
  /** Enum type */
  Enum: MonoTypeEnum.MONO_TYPE_ENUM,
} as const);

export type MonoTypeKind = (typeof MonoTypeKind)[keyof typeof MonoTypeKind];

const MonoTypeNameFormatEnum = MonoEnums.MonoTypeNameFormat;

/**
 * Format options for type name output.
 *
 * @example
 * ```typescript
 * const ilName = type.getFullName(MonoTypeNameFormat.IL);
 * const reflectionName = type.getFullName(MonoTypeNameFormat.Reflection);
 * const asmQualified = type.getFullName(MonoTypeNameFormat.AssemblyQualified);
 * ```
 */
export const MonoTypeNameFormat = Object.freeze({
  /** IL format (e.g., "int32") */
  IL: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_IL,
  /** Reflection format (e.g., "Int32") */
  Reflection: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_REFLECTION,
  /** Full name with namespace (e.g., "System.Int32") */
  FullName: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_FULL_NAME,
  /** Assembly qualified name */
  AssemblyQualified: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_ASSEMBLY_QUALIFIED,
} as const);

export type MonoTypeNameFormat = (typeof MonoTypeNameFormat)[keyof typeof MonoTypeNameFormat];

/**
 * Summary information for a MonoType, providing comprehensive type metadata.
 *
 * @remarks
 * Use `type.getSummary()` to generate this summary for any MonoType instance.
 *
 * @example
 * ```typescript
 * const summary = type.getSummary();
 * console.log(`Type: ${summary.fullName}`);
 * console.log(`Is value type: ${summary.isValueType}`);
 * console.log(`Size: ${summary.size} bytes, Alignment: ${summary.alignment}`);
 * ```
 */
export interface MonoTypeSummary {
  /** Short type name (e.g., "Int32") */
  name: string;
  /** Full type name with namespace (e.g., "System.Int32") */
  fullName: string;
  /** Type kind classification */
  kind: MonoTypeKind;
  /** Whether this is a by-reference type (ref T) */
  isByRef: boolean;
  /** Whether this is a pointer type (T*) */
  isPointer: boolean;
  /** Whether this is a reference type (class) */
  isReferenceType: boolean;
  /** Whether this is a value type (struct) */
  isValueType: boolean;
  /** Whether this is a generic type parameter */
  isGeneric: boolean;
  /** Whether this is the void type */
  isVoid: boolean;
  /** Whether this is an array type */
  isArray: boolean;
  /** Array rank (dimensions), 0 for non-arrays */
  arrayRank: number;
  /** Value size in bytes */
  size: number;
  /** Memory alignment in bytes */
  alignment: number;
  /** Native pointer address as hex string */
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
  /**
   * Get the type kind (classification).
   *
   * @returns The MonoTypeKind value
   *
   * @example
   * ```typescript
   * const kind = type.getKind();
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
  getKind(): MonoTypeKind {
    return this.native.mono_type_get_type(this.pointer) as MonoTypeKind;
  }

  /**
   * Get the type kind (accessor property).
   *
   * @example
   * ```typescript
   * if (type.kind === MonoTypeKind.String) {
   *   console.log("String type");
   * }
   * ```
   */
  get kind(): MonoTypeKind {
    return this.getKind();
  }

  /**
   * Get the short type name.
   *
   * @returns Type name without namespace (e.g., "Int32")
   *
   * @example
   * ```typescript
   * console.log(type.getName()); // "Int32"
   * ```
   */
  getName(): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name(this.pointer));
  }

  /**
   * Get the short type name (accessor property).
   *
   * @example
   * ```typescript
   * console.log(type.name); // "Int32"
   * ```
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get the full type name with namespace.
   *
   * @param format The name format (default: FullName)
   * @returns Formatted type name
   *
   * @example
   * ```typescript
   * console.log(type.getFullName()); // "System.Int32"
   * console.log(type.getFullName(MonoTypeNameFormat.IL)); // "int32"
   * console.log(type.getFullName(MonoTypeNameFormat.AssemblyQualified));
   * // "System.Int32, mscorlib, Version=..."
   * ```
   */
  getFullName(format: number = MonoTypeNameFormat.FullName): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name_full(this.pointer, format));
  }

  /**
   * Get the full type name (accessor property).
   *
   * @example
   * ```typescript
   * console.log(type.fullName); // "System.Int32"
   * ```
   */
  get fullName(): string {
    return this.getFullName();
  }

  /**
   * Get the MonoClass associated with this type.
   *
   * @returns MonoClass if available, null otherwise
   *
   * @example
   * ```typescript
   * const klass = type.getClass();
   * if (klass) {
   *   console.log(`Class: ${klass.fullName}`);
   * }
   * ```
   */
  getClass(): MonoClass | null {
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
   * const underlying = enumType.getUnderlyingType();
   * console.log(underlying?.name); // "Int32"
   * ```
   */
  getUnderlyingType(): MonoType | null {
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
   * const element = arrayType.getElementType();
   * console.log(element?.name); // "Int32"
   * ```
   */
  getElementType(): MonoType | null {
    const kind = this.native.mono_type_get_type(this.pointer) as MonoTypeKind;
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

  /**
   * Check if this type is a by-reference type (ref T).
   *
   * @returns true if this is a by-reference type
   *
   * @example
   * ```typescript
   * if (type.isByRef()) {
   *   console.log("This is a ref parameter");
   * }
   * ```
   */
  isByRef(): boolean {
    return (this.native.mono_type_is_byref(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a pointer type (T*).
   *
   * @returns true if this is a pointer type
   *
   * @example
   * ```typescript
   * if (type.isPointer()) {
   *   console.log("This is a pointer type");
   * }
   * ```
   */
  isPointer(): boolean {
    return (this.native.mono_type_is_pointer(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a reference type (class, interface, delegate).
   *
   * @returns true if this is a reference type
   *
   * @example
   * ```typescript
   * if (type.isReferenceType()) {
   *   console.log("This is a reference type (class)");
   * }
   * ```
   */
  isReferenceType(): boolean {
    return (this.native.mono_type_is_reference(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a generic type parameter (T in List<T>).
   *
   * @returns true if this is a generic type parameter
   *
   * @example
   * ```typescript
   * if (type.isGenericParameter()) {
   *   console.log("This is a generic type parameter");
   * }
   * ```
   */
  isGenericParameter(): boolean {
    return (this.native.mono_type_is_generic_parameter(this.pointer) as number) !== 0;
  }

  /**
   * Check if this type is a value type (struct, enum, primitive).
   *
   * @returns true if this is a value type
   *
   * @remarks
   * Value types include:
   * - Primitive types (int, bool, float, etc.)
   * - Structs (ValueType)
   * - Enums
   *
   * @example
   * ```typescript
   * if (type.isValueType()) {
   *   console.log("This is a value type (struct)");
   * }
   * ```
   */
  isValueType(): boolean {
    const kind = this.getKind();
    // Determine if it's a value type based on the type kind
    // ValueType, Enum, Primitive types (Boolean, Char, I1-I8, U1-U8, R4, R8) are all value types
    switch (kind) {
      case MonoTypeKind.ValueType:
      case MonoTypeKind.Enum:
      case MonoTypeKind.Boolean:
      case MonoTypeKind.Char:
      case MonoTypeKind.I1:
      case MonoTypeKind.U1:
      case MonoTypeKind.I2:
      case MonoTypeKind.U2:
      case MonoTypeKind.I4:
      case MonoTypeKind.U4:
      case MonoTypeKind.I8:
      case MonoTypeKind.U8:
      case MonoTypeKind.R4:
      case MonoTypeKind.R8:
      case MonoTypeKind.Int: // native int
      case MonoTypeKind.UInt: // native uint
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if this type is the void type.
   *
   * @returns true if this is the void type
   *
   * @example
   * ```typescript
   * if (type.isVoid()) {
   *   console.log("This is void (no return value)");
   * }
   * ```
   */
  isVoid(): boolean {
    return this.getKind() === MonoTypeKind.Void;
  }

  /**
   * Check if this type is an array type.
   *
   * @returns true if this is an array type
   *
   * @remarks
   * Returns true for both single-dimensional (T[]) and
   * multi-dimensional arrays (T[,]).
   *
   * @example
   * ```typescript
   * if (type.isArray()) {
   *   console.log(`Array with rank: ${type.getArrayRank()}`);
   * }
   * ```
   */
  isArray(): boolean {
    const kind = this.getKind();
    return kind === MonoTypeKind.Array || kind === MonoTypeKind.SingleDimArray;
  }

  /**
   * Get the rank (number of dimensions) of an array type.
   * Returns 0 for non-array types.
   * Returns 1 for single-dimensional arrays (SZARRAY).
   * Returns the actual rank for multi-dimensional arrays (ARRAY).
   */
  getArrayRank(): number {
    const kind = this.getKind();

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

  /**
   * Get the stack size and alignment for this type.
   *
   * @returns Object with size and alignment in bytes
   *
   * @example
   * ```typescript
   * const { size, alignment } = type.getStackSize();
   * console.log(`Stack size: ${size}, alignment: ${alignment}`);
   * ```
   */
  getStackSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_stack_size(this.pointer, alignPtr) as number;
    const alignment = readU32(alignPtr);
    return { size, alignment };
  }

  /**
   * Get the value size and alignment for this type.
   *
   * @returns Object with size and alignment in bytes
   *
   * @example
   * ```typescript
   * const { size, alignment } = type.getValueSize();
   * console.log(`Value size: ${size}, alignment: ${alignment}`);
   * ```
   */
  getValueSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_size(this.pointer, alignPtr) as number;
    const alignment = readU32(alignPtr);
    return { size, alignment };
  }

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

  // ===== SUMMARY & DESCRIPTION METHODS =====

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
    const { size, alignment } = this.getValueSize();
    return {
      name: this.getName(),
      fullName: this.getFullName(),
      kind: this.getKind(),
      isByRef: this.isByRef(),
      isPointer: this.isPointer(),
      isReferenceType: this.isReferenceType(),
      isValueType: this.isValueType(),
      isGeneric: this.isGenericParameter(),
      isVoid: this.isVoid(),
      isArray: this.isArray(),
      arrayRank: this.getArrayRank(),
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
   * @deprecated Use getSummary() for programmatic access
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
    const kindName = this.getKindName();
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
      `  Kind: ${kindName} (${characteristics.join(", ") || "none"})`,
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
    return this.getFullName();
  }

  // ===== ADDITIONAL UTILITY METHODS =====

  /**
   * Get a human-readable name for the type kind.
   *
   * @returns Kind name string
   *
   * @example
   * ```typescript
   * console.log(type.getKindName()); // "I4", "Class", "String", etc.
   * ```
   */
  getKindName(): string {
    const kind = this.getKind();
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
  isPrimitive(): boolean {
    const kind = this.getKind();
    switch (kind) {
      case MonoTypeKind.Boolean:
      case MonoTypeKind.Char:
      case MonoTypeKind.I1:
      case MonoTypeKind.U1:
      case MonoTypeKind.I2:
      case MonoTypeKind.U2:
      case MonoTypeKind.I4:
      case MonoTypeKind.U4:
      case MonoTypeKind.I8:
      case MonoTypeKind.U8:
      case MonoTypeKind.R4:
      case MonoTypeKind.R8:
      case MonoTypeKind.Int:
      case MonoTypeKind.UInt:
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if this type is a numeric type.
   *
   * @returns true if this is a numeric type (integer or floating-point)
   *
   * @example
   * ```typescript
   * if (type.isNumeric()) {
   *   console.log("This is a numeric type");
   * }
   * ```
   */
  isNumeric(): boolean {
    const kind = this.getKind();
    switch (kind) {
      case MonoTypeKind.I1:
      case MonoTypeKind.U1:
      case MonoTypeKind.I2:
      case MonoTypeKind.U2:
      case MonoTypeKind.I4:
      case MonoTypeKind.U4:
      case MonoTypeKind.I8:
      case MonoTypeKind.U8:
      case MonoTypeKind.R4:
      case MonoTypeKind.R8:
      case MonoTypeKind.Int:
      case MonoTypeKind.UInt:
        return true;
      default:
        return false;
    }
  }

  /**
   * Check if this type is an enum type.
   *
   * @returns true if this is an enum type
   */
  isEnum(): boolean {
    return this.getKind() === MonoTypeKind.Enum;
  }

  /**
   * Check if this is a generic instantiation (e.g., List<int>).
   *
   * @returns true if this is a generic instance
   */
  isGenericInstance(): boolean {
    return this.getKind() === MonoTypeKind.GenericInstance;
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
    return this.getFullName() === other.getFullName();
  }

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

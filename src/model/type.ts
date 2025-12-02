import { readU32 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";
import { MonoEnums } from "../runtime/enums";

const MonoTypeEnum = MonoEnums.MonoTypeEnum;

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

const MonoTypeNameFormatEnum = MonoEnums.MonoTypeNameFormat;

export const MonoTypeNameFormat = Object.freeze({
  IL: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_IL,
  Reflection: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_REFLECTION,
  FullName: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_FULL_NAME,
  AssemblyQualified: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_ASSEMBLY_QUALIFIED,
} as const);

export type MonoTypeNameFormat = (typeof MonoTypeNameFormat)[keyof typeof MonoTypeNameFormat];

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
  size: number;
  alignment: number;
}

export class MonoType extends MonoHandle {
  getKind(): MonoTypeKind {
    return this.native.mono_type_get_type(this.pointer) as MonoTypeKind;
  }

  getName(): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name(this.pointer));
  }

  getFullName(format: number = MonoTypeNameFormat.FullName): string {
    return this.readNativeString(() => this.api.native.mono_type_get_name_full(this.pointer, format));
  }

  getClass(): MonoClass | null {
    const klassPtr = this.native.mono_type_get_class(this.pointer);
    return pointerIsNull(klassPtr) ? null : new MonoClass(this.api, klassPtr);
  }

  getUnderlyingType(): MonoType | null {
    const typePtr = this.native.mono_type_get_underlying_type(this.pointer);
    return pointerIsNull(typePtr) ? null : new MonoType(this.api, typePtr);
  }

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

  isByRef(): boolean {
    return (this.native.mono_type_is_byref(this.pointer) as number) !== 0;
  }

  isPointer(): boolean {
    return (this.native.mono_type_is_pointer(this.pointer) as number) !== 0;
  }

  isReferenceType(): boolean {
    return (this.native.mono_type_is_reference(this.pointer) as number) !== 0;
  }

  isGenericParameter(): boolean {
    return (this.native.mono_type_is_generic_parameter(this.pointer) as number) !== 0;
  }

  isValueType(): boolean {
    const kind = this.getKind();
    // 基于类型种类判断是否是值类型
    // ValueType, Enum, Primitive types (Boolean, Char, I1-I8, U1-U8, R4, R8) 都是值类型
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
      case MonoTypeKind.Int:   // native int
      case MonoTypeKind.UInt:  // native uint
        return true;
      default:
        return false;
    }
  }

  isVoid(): boolean {
    return this.getKind() === MonoTypeKind.Void;
  }

  getStackSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_stack_size(this.pointer, alignPtr) as number;
    const alignment = readU32(alignPtr);
    return { size, alignment };
  }

  getValueSize(): { size: number; alignment: number } {
    const alignPtr = Memory.alloc(4);
    const size = this.native.mono_type_size(this.pointer, alignPtr) as number;
    const alignment = readU32(alignPtr);
    return { size, alignment };
  }

  getSignatureName(includeNamespace = true): string {
    const format = includeNamespace ? MonoTypeNameFormat.FullName : MonoTypeNameFormat.Reflection;
    return this.getFullName(format);
  }

  describe(): MonoTypeSummary {
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
      size,
      alignment,
    };
  }

  toString(): string {
    return this.getFullName();
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

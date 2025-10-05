import { readUtf8String, readU32, pointerIsNull } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";
import { MonoEnums } from "../runtime/enums";

export const MonoTypeKind = Object.freeze({
  End: 0x00,
  Void: 0x01,
  Boolean: 0x02,
  Char: 0x03,
  I1: 0x04,
  U1: 0x05,
  I2: 0x06,
  U2: 0x07,
  I4: 0x08,
  U4: 0x09,
  I8: 0x0a,
  U8: 0x0b,
  R4: 0x0c,
  R8: 0x0d,
  String: 0x0e,
  Pointer: 0x0f,
  ByRef: 0x10,
  ValueType: 0x11,
  Class: 0x12,
  GenericVar: 0x13,
  Array: 0x14,
  GenericInstance: 0x15,
  TypedByRef: 0x16,
  Int: 0x18,
  UInt: 0x19,
  FunctionPointer: 0x1b,
  Object: 0x1c,
  SingleDimArray: 0x1d,
  GenericMethodVar: 0x1e,
  CModReqd: 0x1f,
  CModOpt: 0x20,
  Internal: 0x21,
  Modifier: 0x40,
  Sentinel: 0x41,
  Pinned: 0x45,
  Enum: 0x55,
} as const);

export type MonoTypeKind = (typeof MonoTypeKind)[keyof typeof MonoTypeKind];

const MonoTypeNameFormatEnum = MonoEnums.MonoTypeNameFormat;

export const MonoTypeNameFormat = Object.freeze({
  IL: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_IL,
  Reflection: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_REFLECTION,
  FullName: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_FULL_NAME,
  AssemblyQualified: MonoTypeNameFormatEnum.MONO_TYPE_NAME_FORMAT_ASSEMBLY_QUALIFIED,
} as const);

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
    if (kind === MonoTypeKind.ValueType || kind === MonoTypeKind.Enum) {
      return true;
    }
    return (this.native.mono_type_is_struct(this.pointer) as number) !== 0;
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
      this.native.mono_free(namePtr);
    }
  }
}

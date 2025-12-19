/**
 * Attribute Module
 *
 * Provides:
 * - Custom attribute retrieval helpers for model types
 * - ECMA-335 custom attribute blob parsing implementation
 * - CustomAttribute / AttributeValue types
 */

import type { MonoApi } from "../runtime/api";
import { MonoEnums } from "../runtime/enums";
import { pointerIsNull } from "../utils/memory";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents any value that can be used in custom attributes.
 * Includes primitive types, strings, arrays, and type references.
 */
export type AttributeValue =
  | string
  | number
  | boolean
  | null
  | AttributeValue[]
  | { type: string; value: AttributeValue };

/**
 * Custom attribute information.
 * Represents metadata attached to assemblies, classes, methods, fields, and properties.
 */
export interface CustomAttribute {
  /** Short name of the attribute class */
  name: string;
  /** Full type name including namespace */
  type: string;
  /** Arguments passed to the attribute constructor */
  constructorArguments: AttributeValue[];
  /** Named properties set on the attribute */
  properties: Record<string, AttributeValue>;
}

// ============================================================================
// CUSTOM ATTRIBUTE BLOB PARSER
// ============================================================================

/**
 * ECMA-335 Serialization Type IDs for custom attribute blob parsing.
 * These are element types used in the custom attribute binary format.
 */
const SerializationType = {
  BOOLEAN: 0x02,
  CHAR: 0x03,
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
  STRING: 0x0e,
  SZARRAY: 0x1d,
  TYPE: 0x50,
  TAGGED_OBJECT: 0x51,
  FIELD: 0x53,
  PROPERTY: 0x54,
  ENUM: 0x55,
} as const;

/** Helper class to parse custom attribute blob data. */
class AttributeBlobReader {
  private offset = 0;

  constructor(
    private readonly data: NativePointer,
    private readonly size: number,
  ) {}

  get hasMore(): boolean {
    return this.offset < this.size;
  }

  readByte(): number {
    if (this.offset >= this.size) return 0;
    const value = this.data.add(this.offset).readU8();
    this.offset += 1;
    return value;
  }

  readI1(): number {
    if (this.offset >= this.size) return 0;
    const value = this.data.add(this.offset).readS8();
    this.offset += 1;
    return value;
  }

  readU1(): number {
    return this.readByte();
  }

  readI2(): number {
    if (this.offset + 2 > this.size) return 0;
    const value = this.data.add(this.offset).readS16();
    this.offset += 2;
    return value;
  }

  readU2(): number {
    if (this.offset + 2 > this.size) return 0;
    const value = this.data.add(this.offset).readU16();
    this.offset += 2;
    return value;
  }

  readI4(): number {
    if (this.offset + 4 > this.size) return 0;
    const value = this.data.add(this.offset).readS32();
    this.offset += 4;
    return value;
  }

  readU4(): number {
    if (this.offset + 4 > this.size) return 0;
    const value = this.data.add(this.offset).readU32();
    this.offset += 4;
    return value >>> 0;
  }

  readI8(): bigint {
    if (this.offset + 8 > this.size) return BigInt(0);
    const low = this.data.add(this.offset).readU32();
    const high = this.data.add(this.offset + 4).readS32();
    this.offset += 8;
    return (BigInt(high) << BigInt(32)) | BigInt(low >>> 0);
  }

  readU8(): bigint {
    if (this.offset + 8 > this.size) return BigInt(0);
    const low = this.data.add(this.offset).readU32();
    const high = this.data.add(this.offset + 4).readU32();
    this.offset += 8;
    return (BigInt(high >>> 0) << BigInt(32)) | BigInt(low >>> 0);
  }

  readR4(): number {
    if (this.offset + 4 > this.size) return 0;
    const value = this.data.add(this.offset).readFloat();
    this.offset += 4;
    return value;
  }

  readR8(): number {
    if (this.offset + 8 > this.size) return 0;
    const value = this.data.add(this.offset).readDouble();
    this.offset += 8;
    return value;
  }

  readSerString(): string | null {
    const first = this.readByte();
    if (first === 0xff) {
      return null;
    }

    let length: number;
    if ((first & 0x80) === 0) {
      length = first;
    } else if ((first & 0xc0) === 0x80) {
      const second = this.readByte();
      length = ((first & 0x3f) << 8) | second;
    } else if ((first & 0xe0) === 0xc0) {
      const second = this.readByte();
      const third = this.readByte();
      const fourth = this.readByte();
      length = ((first & 0x1f) << 24) | (second << 16) | (third << 8) | fourth;
    } else {
      return null;
    }

    if (length === 0) {
      return "";
    }

    if (this.offset + length > this.size) {
      return null;
    }

    try {
      const str = this.data.add(this.offset).readUtf8String(length);
      this.offset += length;
      return str;
    } catch {
      this.offset += length;
      return null;
    }
  }

  readBoolean(): boolean {
    return this.readByte() !== 0;
  }

  readChar(): string {
    const code = this.readU2();
    return String.fromCharCode(code);
  }

  readTypedValue(typeId: number, enumTypeName?: string): AttributeValue {
    switch (typeId) {
      case SerializationType.BOOLEAN:
        return this.readBoolean();
      case SerializationType.CHAR:
        return this.readChar();
      case SerializationType.I1:
        return this.readI1();
      case SerializationType.U1:
        return this.readU1();
      case SerializationType.I2:
        return this.readI2();
      case SerializationType.U2:
        return this.readU2();
      case SerializationType.I4:
        return this.readI4();
      case SerializationType.U4:
        return this.readU4();
      case SerializationType.I8: {
        const i8Value = this.readI8();
        if (i8Value >= Number.MIN_SAFE_INTEGER && i8Value <= Number.MAX_SAFE_INTEGER) {
          return Number(i8Value);
        }
        return { type: "int64", value: i8Value.toString() };
      }
      case SerializationType.U8: {
        const u8Value = this.readU8();
        if (u8Value <= Number.MAX_SAFE_INTEGER) {
          return Number(u8Value);
        }
        return { type: "uint64", value: u8Value.toString() };
      }
      case SerializationType.R4:
        return this.readR4();
      case SerializationType.R8:
        return this.readR8();
      case SerializationType.STRING:
        return this.readSerString();
      case SerializationType.TYPE: {
        const typeName = this.readSerString();
        return typeName !== null ? { type: "System.Type", value: typeName } : null;
      }
      case SerializationType.TAGGED_OBJECT: {
        const innerType = this.readByte();
        return this.readTypedValue(innerType);
      }
      case SerializationType.SZARRAY:
        return this.readArray(this.readByte());
      case SerializationType.ENUM: {
        const enumValue = this.readI4();
        return enumTypeName ? { type: enumTypeName, value: enumValue } : enumValue;
      }
      default:
        return null;
    }
  }

  readArray(elementType: number): AttributeValue[] | null {
    const count = this.readU4();
    if (count === 0xffffffff) {
      return null;
    }
    const result: AttributeValue[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.readTypedValue(elementType));
    }
    return result;
  }
}

function parseConstructorArguments(
  api: MonoApi,
  ctorPtr: NativePointer,
  blobPtr: NativePointer,
  blobSize: number,
): { args: AttributeValue[]; namedCount: number; reader: AttributeBlobReader } | null {
  if (blobSize < 2 || pointerIsNull(blobPtr)) {
    return null;
  }

  const reader = new AttributeBlobReader(blobPtr, blobSize);
  const prolog = reader.readU2();
  if (prolog !== 0x0001) {
    return null;
  }

  const args: AttributeValue[] = [];

  try {
    const sigPtr = api.native.mono_method_signature(ctorPtr);
    if (pointerIsNull(sigPtr)) {
      return null;
    }

    const paramCount = api.native.mono_signature_get_param_count(sigPtr);

    for (let i = 0; i < paramCount; i++) {
      const paramTypePtr = api.native.mono_signature_get_params(sigPtr, Memory.alloc(Process.pointerSize));

      if (pointerIsNull(paramTypePtr)) {
        args.push(reader.readI4());
        continue;
      }

      const typeKind = api.native.mono_type_get_type(paramTypePtr) as number;
      const MonoTypeEnum = MonoEnums.MonoTypeEnum;

      let value: AttributeValue;
      switch (typeKind) {
        case MonoTypeEnum.MONO_TYPE_BOOLEAN:
          value = reader.readBoolean();
          break;
        case MonoTypeEnum.MONO_TYPE_CHAR:
          value = reader.readChar();
          break;
        case MonoTypeEnum.MONO_TYPE_I1:
          value = reader.readI1();
          break;
        case MonoTypeEnum.MONO_TYPE_U1:
          value = reader.readU1();
          break;
        case MonoTypeEnum.MONO_TYPE_I2:
          value = reader.readI2();
          break;
        case MonoTypeEnum.MONO_TYPE_U2:
          value = reader.readU2();
          break;
        case MonoTypeEnum.MONO_TYPE_I4:
          value = reader.readI4();
          break;
        case MonoTypeEnum.MONO_TYPE_U4:
          value = reader.readU4();
          break;
        case MonoTypeEnum.MONO_TYPE_I8: {
          const i8 = reader.readI8();
          value =
            i8 >= Number.MIN_SAFE_INTEGER && i8 <= Number.MAX_SAFE_INTEGER
              ? Number(i8)
              : { type: "int64", value: i8.toString() };
          break;
        }
        case MonoTypeEnum.MONO_TYPE_U8: {
          const u8 = reader.readU8();
          value = u8 <= Number.MAX_SAFE_INTEGER ? Number(u8) : { type: "uint64", value: u8.toString() };
          break;
        }
        case MonoTypeEnum.MONO_TYPE_R4:
          value = reader.readR4();
          break;
        case MonoTypeEnum.MONO_TYPE_R8:
          value = reader.readR8();
          break;
        case MonoTypeEnum.MONO_TYPE_STRING:
          value = reader.readSerString();
          break;
        case MonoTypeEnum.MONO_TYPE_CLASS: {
          const classPtr = api.native.mono_type_get_class(paramTypePtr);
          if (!pointerIsNull(classPtr)) {
            const className = api.native.mono_class_get_name(classPtr).readUtf8String();
            if (className === "Type") {
              const typeName = reader.readSerString();
              value = typeName !== null ? { type: "System.Type", value: typeName } : null;
            } else if (className === "Object") {
              const innerType = reader.readByte();
              value = reader.readTypedValue(innerType);
            } else {
              value = reader.readSerString();
            }
          } else {
            value = reader.readSerString();
          }
          break;
        }
        case MonoTypeEnum.MONO_TYPE_VALUETYPE: {
          const enumClass = api.native.mono_type_get_class(paramTypePtr);
          if (!pointerIsNull(enumClass) && api.native.mono_class_is_enum(enumClass)) {
            const underlyingType = api.native.mono_class_enum_basetype(enumClass);
            if (!pointerIsNull(underlyingType)) {
              const underlyingKind = api.native.mono_type_get_type(underlyingType) as number;
              const enumName = api.native.mono_class_get_name(enumClass)?.readUtf8String() ?? "Enum";
              const enumNamespace = api.native.mono_class_get_namespace(enumClass)?.readUtf8String() ?? "";
              const fullEnumName = enumNamespace ? `${enumNamespace}.${enumName}` : enumName;

              let enumValue: number | bigint;
              switch (underlyingKind) {
                case MonoTypeEnum.MONO_TYPE_I1:
                  enumValue = reader.readI1();
                  break;
                case MonoTypeEnum.MONO_TYPE_U1:
                  enumValue = reader.readU1();
                  break;
                case MonoTypeEnum.MONO_TYPE_I2:
                  enumValue = reader.readI2();
                  break;
                case MonoTypeEnum.MONO_TYPE_U2:
                  enumValue = reader.readU2();
                  break;
                case MonoTypeEnum.MONO_TYPE_I4:
                  enumValue = reader.readI4();
                  break;
                case MonoTypeEnum.MONO_TYPE_U4:
                  enumValue = reader.readU4();
                  break;
                case MonoTypeEnum.MONO_TYPE_I8:
                  enumValue = reader.readI8();
                  break;
                case MonoTypeEnum.MONO_TYPE_U8:
                  enumValue = reader.readU8();
                  break;
                default:
                  enumValue = reader.readI4();
              }
              value = { type: fullEnumName, value: Number(enumValue) };
            } else {
              value = { type: "enum", value: reader.readI4() };
            }
          } else {
            value = reader.readI4();
          }
          break;
        }
        case MonoTypeEnum.MONO_TYPE_SZARRAY: {
          const elemTypePtr = api.native.mono_class_get_element_class
            ? api.native.mono_class_get_element_class(api.native.mono_type_get_class(paramTypePtr))
            : null;
          let elemKind: number = SerializationType.I4;
          if (!pointerIsNull(elemTypePtr)) {
            const elemType = api.native.mono_class_get_type(elemTypePtr);
            if (!pointerIsNull(elemType)) {
              elemKind = api.native.mono_type_get_type(elemType);
            }
          }
          value = reader.readArray(elemKind);
          break;
        }
        default:
          value = reader.readI4();
      }
      args.push(value);
    }

    const namedCount = reader.readU2();
    return { args, namedCount, reader };
  } catch {
    return { args, namedCount: 0, reader };
  }
}

function parseNamedArguments(reader: AttributeBlobReader, namedCount: number): Record<string, AttributeValue> {
  const properties: Record<string, AttributeValue> = {};

  for (let i = 0; i < namedCount && reader.hasMore; i++) {
    try {
      const marker = reader.readByte();
      if (marker !== SerializationType.FIELD && marker !== SerializationType.PROPERTY) {
        break;
      }

      const fieldType = reader.readByte();

      let enumTypeName: string | undefined;
      if (fieldType === SerializationType.ENUM) {
        enumTypeName = reader.readSerString() ?? undefined;
      }

      const name = reader.readSerString();
      if (name === null) {
        break;
      }

      const value = reader.readTypedValue(fieldType, enumTypeName);
      properties[name] = value;
    } catch {
      break;
    }
  }

  return properties;
}

/**
 * Parse custom attributes from a MonoCustomAttrInfo pointer.
 * Shared utility used by multiple model types.
 */
export function parseCustomAttributes(
  api: MonoApi,
  customAttrInfoPtr: NativePointer,
  getClassName: (classPtr: NativePointer) => string,
  getClassFullName: (classPtr: NativePointer) => string,
): CustomAttribute[] {
  const attributes: CustomAttribute[] = [];

  if (pointerIsNull(customAttrInfoPtr)) {
    return attributes;
  }

  try {
    const numAttrs = customAttrInfoPtr.readInt();

    const ENTRY_SIZE = Process.pointerSize === 8 ? 24 : 12;
    const ATTRS_BASE_OFFSET = Process.pointerSize === 8 ? 16 : 8;

    const ENTRY_CTOR_OFFSET = 0;
    const ENTRY_DATA_SIZE_OFFSET = Process.pointerSize;
    const ENTRY_DATA_OFFSET = Process.pointerSize === 8 ? 16 : 8;

    for (let i = 0; i < numAttrs; i++) {
      try {
        const entryPtr = customAttrInfoPtr.add(ATTRS_BASE_OFFSET + i * ENTRY_SIZE);
        const ctorPtr = entryPtr.add(ENTRY_CTOR_OFFSET).readPointer();

        if (pointerIsNull(ctorPtr)) {
          continue;
        }

        const declClassPtr = api.native.mono_method_get_class(ctorPtr);
        if (pointerIsNull(declClassPtr)) {
          continue;
        }

        const dataSize = entryPtr.add(ENTRY_DATA_SIZE_OFFSET).readU32();
        const dataPtr = entryPtr.add(ENTRY_DATA_OFFSET).readPointer();

        let constructorArguments: AttributeValue[] = [];
        let properties: Record<string, AttributeValue> = {};

        if (dataSize > 0 && !pointerIsNull(dataPtr)) {
          try {
            const parsed = parseConstructorArguments(api, ctorPtr, dataPtr, dataSize);
            if (parsed) {
              constructorArguments = parsed.args;
              if (parsed.namedCount > 0) {
                properties = parseNamedArguments(parsed.reader, parsed.namedCount);
              }
            }
          } catch {
            // ignore blob parsing failures
          }
        }

        attributes.push({
          name: getClassName(declClassPtr),
          type: getClassFullName(declClassPtr),
          constructorArguments,
          properties,
        });
      } catch {
        continue;
      }
    }
  } finally {
    try {
      const cached = customAttrInfoPtr.add(4).readInt();
      if (cached === 0) {
        api.native.mono_custom_attrs_free(customAttrInfoPtr);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  return attributes;
}

// ============================================================================
// CUSTOM ATTRIBUTE RETRIEVAL HELPERS
// ============================================================================

/** Context for retrieving custom attributes from different Mono types. */
export interface CustomAttributeContext {
  api: MonoApi;
  exportName: string;
  getAttrInfoPtr: () => NativePointer;
}

/**
 * Retrieve custom attributes using a unified pattern.
 */
export function getCustomAttributes(
  context: CustomAttributeContext,
  getClassName?: (classPtr: NativePointer) => string,
  getClassFullName?: (classPtr: NativePointer) => string,
): CustomAttribute[] {
  const { api, exportName, getAttrInfoPtr } = context;

  if (!api.hasExport(exportName)) {
    return [];
  }

  try {
    const customAttrInfoPtr = getAttrInfoPtr();

    const resolveName =
      getClassName ??
      ((ptr: NativePointer) => {
        const namePtr = api.native.mono_class_get_name(ptr);
        if (pointerIsNull(namePtr)) {
          return "<unknown>";
        }
        return namePtr.readUtf8String();
      });

    const resolveFullName =
      getClassFullName ??
      ((ptr: NativePointer) => {
        const namePtr = api.native.mono_class_get_name(ptr);
        const namespacePtr = api.native.mono_class_get_namespace(ptr);
        const name = pointerIsNull(namePtr) ? "<unknown>" : namePtr.readUtf8String();
        const ns = pointerIsNull(namespacePtr) ? "" : namespacePtr.readUtf8String();
        return ns ? `${ns}.${name}` : name;
      });

    return parseCustomAttributes(api, customAttrInfoPtr, resolveName, resolveFullName);
  } catch {
    return [];
  }
}

export function createClassAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_class",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_class(classPtr),
  };
}

export function createMethodAttributeContext(
  api: MonoApi,
  methodPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_method",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_method(methodPtr),
  };
}

export function createFieldAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  fieldPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_field",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_field(classPtr, fieldPtr),
  };
}

export function createPropertyAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  propertyPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_property",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_property(classPtr, propertyPtr),
  };
}

export function createAssemblyAttributeContext(
  api: MonoApi,
  assemblyPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_assembly",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_assembly(assemblyPtr),
  };
}

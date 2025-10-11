/**
 * Type utilities for boxing, unboxing, and type operations
 */

import { MonoApi } from "../runtime/api";
import { MonoType, MonoTypeKind } from "../model/type";
import { MonoClass } from "../model/class";

/**
 * Common Mono types with boxing utilities
 */
export class TypeHelper {
  constructor(private readonly api: MonoApi) {}

  /**
   * Box a primitive value to a Mono object
   */
  box(type: MonoType, value: any): NativePointer {
    const klass = type.getClass();
    if (!klass) {
      throw new Error(`Cannot get class for type ${type.getName()}`);
    }

    const domain = this.api.getRootDomain();
    const storage = Memory.alloc(type.getValueSize().size);

    // Write value to storage based on type
    const kind = type.getKind();
    switch (kind) {
      case MonoTypeKind.Boolean:
        storage.writeU8(value ? 1 : 0);
        break;
      case MonoTypeKind.I1:
        storage.writeS8(value);
        break;
      case MonoTypeKind.U1:
        storage.writeU8(value);
        break;
      case MonoTypeKind.I2:
        storage.writeS16(value);
        break;
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        storage.writeU16(value);
        break;
      case MonoTypeKind.I4:
        storage.writeS32(value);
        break;
      case MonoTypeKind.U4:
        storage.writeU32(value);
        break;
      case MonoTypeKind.I8:
        storage.writeS64(value);
        break;
      case MonoTypeKind.U8:
        storage.writeU64(value);
        break;
      case MonoTypeKind.R4:
        storage.writeFloat(value);
        break;
      case MonoTypeKind.R8:
        storage.writeDouble(value);
        break;
      default:
        throw new Error(`Cannot box type kind ${kind}`);
    }

    return this.api.native.mono_value_box(domain, klass.pointer, storage);
  }

  /**
   * Unbox a Mono object to a primitive value
   */
  unbox(obj: NativePointer, type: MonoType): any {
    const data = this.api.native.mono_object_unbox(obj);
    const kind = type.getKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
        return data.readU8() !== 0;
      case MonoTypeKind.I1:
        return data.readS8();
      case MonoTypeKind.U1:
        return data.readU8();
      case MonoTypeKind.I2:
        return data.readS16();
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        return data.readU16();
      case MonoTypeKind.I4:
        return data.readS32();
      case MonoTypeKind.U4:
        return data.readU32();
      case MonoTypeKind.I8:
        return data.readS64();
      case MonoTypeKind.U8:
        return data.readU64();
      case MonoTypeKind.R4:
        return data.readFloat();
      case MonoTypeKind.R8:
        return data.readDouble();
      default:
        throw new Error(`Cannot unbox type kind ${kind}`);
    }
  }

  /**
   * Get the Mono type for a primitive
   */
  getTypeForPrimitive(value: any): MonoType | null {
    const typeName = typeof value === "boolean" ? "Boolean" :
                     typeof value === "number" ? "Single" :
                     typeof value === "string" ? "String" :
                     null;

    if (!typeName) {
      return null;
    }

    // Find the type in mscorlib
    const domain = this.api.getRootDomain();
    const assemblyIter = Memory.alloc(Process.pointerSize);
    assemblyIter.writePointer(NULL);

    while (true) {
      const assembly = this.api.native.mono_domain_assembly_open(domain, assemblyIter);
      if (assemblyIter.readPointer().isNull()) {
        break;
      }

      const image = this.api.native.mono_assembly_get_image(assembly);
      const imageName = this.api.native.mono_image_get_name(image);
      const imageNameStr = imageName.readUtf8String();

      if (imageNameStr === "mscorlib.dll" || imageNameStr === "mscorlib") {
        const klassPtr = this.api.native.mono_class_from_name(
          image,
          Memory.allocUtf8String("System"),
          Memory.allocUtf8String(typeName)
        );

        if (!klassPtr.isNull()) {
          const klass = new MonoClass(this.api, klassPtr);
          return klass.getType();
        }
      }
    }

    return null;
  }
}

/**
 * Create a type helper instance
 */
export function createTypeHelper(api: MonoApi): TypeHelper {
  return new TypeHelper(api);
}

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
        Memory.writeU8(storage, value ? 1 : 0);
        break;
      case MonoTypeKind.I1:
        Memory.writeS8(storage, value);
        break;
      case MonoTypeKind.U1:
        Memory.writeU8(storage, value);
        break;
      case MonoTypeKind.I2:
        Memory.writeS16(storage, value);
        break;
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        Memory.writeU16(storage, value);
        break;
      case MonoTypeKind.I4:
        Memory.writeS32(storage, value);
        break;
      case MonoTypeKind.U4:
        Memory.writeU32(storage, value);
        break;
      case MonoTypeKind.I8:
        Memory.writeS64(storage, value);
        break;
      case MonoTypeKind.U8:
        Memory.writeU64(storage, value);
        break;
      case MonoTypeKind.R4:
        Memory.writeFloat(storage, value);
        break;
      case MonoTypeKind.R8:
        Memory.writeDouble(storage, value);
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
        return Memory.readU8(data) !== 0;
      case MonoTypeKind.I1:
        return Memory.readS8(data);
      case MonoTypeKind.U1:
        return Memory.readU8(data);
      case MonoTypeKind.I2:
        return Memory.readS16(data);
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        return Memory.readU16(data);
      case MonoTypeKind.I4:
        return Memory.readS32(data);
      case MonoTypeKind.U4:
        return Memory.readU32(data);
      case MonoTypeKind.I8:
        return Memory.readS64(data);
      case MonoTypeKind.U8:
        return Memory.readU64(data);
      case MonoTypeKind.R4:
        return Memory.readFloat(data);
      case MonoTypeKind.R8:
        return Memory.readDouble(data);
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
    Memory.writePointer(assemblyIter, NULL);

    while (true) {
      const assembly = this.api.native.mono_domain_assembly_open(domain, assemblyIter);
      if (Memory.readPointer(assemblyIter).isNull()) {
        break;
      }

      const image = this.api.native.mono_assembly_get_image(assembly);
      const imageName = this.api.native.mono_image_get_name(image);
      const imageNameStr = Memory.readUtf8String(imageName);

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

import { MonoArray } from "./model/array";
import type { MonoClass } from "./model/class";
import { MonoDelegate } from "./model/delegate";
import type { MonoField } from "./model/field";
import type { GarbageCollector } from "./model/gc";
import {
  DuplicatePolicy,
  type InternalCallDefinition,
  type InternalCallRegistrar,
  type InternalCallRegistrationInfo,
  type InternalCallRegistrationOptions,
} from "./model/internal-call";
import type { MonoMethod } from "./model/method";
import { MonoObject } from "./model/object";
import type { MonoProperty } from "./model/property";
import { MonoString } from "./model/string";
import type {
  FieldAccessCallbacks,
  MethodCallbacks,
  MethodCallbacksExtended,
  MethodCallbacksTimed,
  PropertyAccessCallbacks,
  ReturnValueReplacer,
  Tracer,
} from "./model/trace";
import {
  MonoType,
  MonoTypeKind,
  isArrayKind,
  isPrimitiveKind,
  isValueTypeKind,
  readPrimitiveValue,
  writePrimitiveValue,
} from "./model/type";
import type { MonoApi } from "./runtime/api";
import type { GCHandle } from "./runtime/gchandle";
import type { GC, ICall, MemorySubsystem, MemoryType, Trace, TypedReadOptions } from "./types";
import { MonoErrorCodes, raise } from "./utils/errors";
import { pointerIsNull } from "./utils/memory";

export function buildGCSubsystem(gc: GarbageCollector): GC {
  return {
    collect: (generation = -1) => gc.collect(generation),
    get maxGeneration() {
      return gc.maxGeneration;
    },
    handle: (obj: NativePointer, pinned = false) => gc.createHandle(obj, pinned),
    weakHandle: (obj: NativePointer, trackResurrection = false) => gc.createWeakHandle(obj, trackResurrection),
    releaseHandle: (handle: GCHandle) => gc.releaseHandle(handle),
    releaseAll: () => gc.releaseAllHandles(),
    get stats() {
      return gc.getMemoryStats();
    },
    getMemoryStats: () => gc.getMemoryStats(),
    getActiveHandleCount: () => gc.activeHandleCount,
    getGenerationStats: () => gc.getGenerationStats(),
    getMemorySummary: () => gc.getMemorySummary(),
    isCollected: (handle: GCHandle) => gc.isCollected(handle),
    collectAndReport: () => gc.collectAndReport(),
    getFinalizationQueueInfo: () => gc.getFinalizationInfo(),
    requestFinalization: () => gc.requestFinalization(),
    waitForPendingFinalizers: (timeout = 0) => gc.waitForPendingFinalizers(timeout),
    suppressFinalize: (objectPtr: NativePointer) => gc.suppressFinalize(objectPtr),
  };
}

export function buildMemorySubsystem(api: MonoApi): MemorySubsystem {
  // Map simple type names to MonoTypeKind for unified handling.
  const simpleTypeToKind: Record<MemoryType, MonoTypeKind> = {
    int8: MonoTypeKind.I1,
    uint8: MonoTypeKind.U1,
    int16: MonoTypeKind.I2,
    uint16: MonoTypeKind.U2,
    int32: MonoTypeKind.I4,
    uint32: MonoTypeKind.U4,
    int64: MonoTypeKind.I8,
    uint64: MonoTypeKind.U8,
    float: MonoTypeKind.R4,
    double: MonoTypeKind.R8,
    pointer: MonoTypeKind.Pointer,
    bool: MonoTypeKind.Boolean,
    char: MonoTypeKind.Char,
  };

  const knownMemoryTypes = Object.keys(simpleTypeToKind).join(", ");

  return {
    read(ptr: NativePointer, type: MemoryType): any {
      const kind = simpleTypeToKind[type];
      if (kind === undefined) {
        raise(MonoErrorCodes.INVALID_ARGUMENT, `Unknown memory type: ${type}`, `Use one of: ${knownMemoryTypes}`, {
          type,
        });
      }
      return readPrimitiveValue(ptr, kind);
    },

    write(ptr: NativePointer, value: any, type: MemoryType): void {
      const kind = simpleTypeToKind[type];
      if (kind === undefined) {
        raise(MonoErrorCodes.INVALID_ARGUMENT, `Unknown memory type: ${type}`, `Use one of: ${knownMemoryTypes}`, {
          type,
        });
      }
      writePrimitiveValue(ptr, kind, value);
    },

    readTyped(ptr: NativePointer, monoType: MonoType, options: TypedReadOptions = {}): any {
      const kind = monoType.kind;

      // String: field storage holds a managed object reference.
      if (kind === MonoTypeKind.String) {
        const strPtr = ptr.readPointer();
        if (pointerIsNull(strPtr)) return null;
        return options.returnRaw ? new MonoString(api, strPtr) : api.readMonoString(strPtr, true);
      }

      // Arrays: treat as managed object reference.
      if (isArrayKind(kind)) {
        const arrPtr = ptr.readPointer();
        if (pointerIsNull(arrPtr)) return null;
        return new MonoArray(api, arrPtr);
      }

      // Class/object references.
      if (kind === MonoTypeKind.Class || kind === MonoTypeKind.Object) {
        const objPtr = ptr.readPointer();
        if (pointerIsNull(objPtr)) return null;
        const klass = monoType.class;
        if (klass?.isDelegate) {
          return new MonoDelegate(api, objPtr);
        }
        return new MonoObject(api, objPtr);
      }

      // Generic instance: could be value type or reference.
      if (kind === MonoTypeKind.GenericInstance) {
        if (monoType.valueType) {
          // Value type is inlined.
          return ptr;
        }
        const objPtr = ptr.readPointer();
        if (pointerIsNull(objPtr)) return null;
        return new MonoObject(api, objPtr);
      }

      // Value type: return pointer to inlined data.
      if (kind === MonoTypeKind.ValueType) {
        return ptr;
      }

      // Enum: read underlying primitive.
      if (kind === MonoTypeKind.Enum) {
        const underlying = monoType.underlyingType;
        if (underlying) {
          return readPrimitiveValue(ptr, underlying.kind, { returnBigInt: options.returnBigInt });
        }
        return ptr.readS32();
      }

      // Primitive / pointer-like.
      const primitiveResult = readPrimitiveValue(ptr, kind, { returnBigInt: options.returnBigInt });
      if (primitiveResult !== null) {
        return primitiveResult;
      }

      return ptr;
    },

    writeTyped(ptr: NativePointer, value: any, monoType: MonoType): void {
      const kind = monoType.kind;

      if (value === null || value === undefined) {
        if (isValueTypeKind(kind)) {
          raise(
            MonoErrorCodes.INVALID_ARGUMENT,
            `Cannot write null to value type ${monoType.fullName}`,
            "Provide a non-null value (or write a pointer to a boxed value type)",
            { typeName: monoType.fullName },
          );
        }
        ptr.writePointer(NULL);
        return;
      }

      if (kind === MonoTypeKind.String) {
        if (typeof value === "string") {
          const monoStr = MonoString.new(api, value);
          ptr.writePointer(monoStr.pointer);
          return;
        }
        if (value instanceof MonoString) {
          ptr.writePointer(value.pointer);
          return;
        }
        ptr.writePointer(value as NativePointer);
        return;
      }

      if (isArrayKind(kind)) {
        if (value instanceof MonoArray) {
          ptr.writePointer(value.pointer);
          return;
        }
        ptr.writePointer(value as NativePointer);
        return;
      }

      if (kind === MonoTypeKind.Class || kind === MonoTypeKind.Object) {
        if (value instanceof MonoObject) {
          ptr.writePointer(value.pointer);
          return;
        }
        ptr.writePointer(value as NativePointer);
        return;
      }

      if (kind === MonoTypeKind.GenericInstance) {
        if (monoType.valueType) {
          if (value instanceof NativePointer) {
            const size = monoType.valueSize.size;
            Memory.copy(ptr, value, size);
          }
          return;
        }
        if (value instanceof MonoObject) {
          ptr.writePointer(value.pointer);
          return;
        }
        ptr.writePointer(value as NativePointer);
        return;
      }

      if (kind === MonoTypeKind.ValueType) {
        if (value instanceof NativePointer) {
          const size = monoType.valueSize.size;
          Memory.copy(ptr, value, size);
        }
        return;
      }

      if (kind === MonoTypeKind.Enum) {
        const underlying = monoType.underlyingType;
        if (underlying) {
          writePrimitiveValue(ptr, underlying.kind, value);
          return;
        }
        ptr.writeS32(value as number);
        return;
      }

      writePrimitiveValue(ptr, kind, value);
    },

    box(value: number | boolean | bigint, klass: MonoClass): MonoObject {
      const type = klass.type;
      const { size } = type.valueSize;
      const valuePtr = Memory.alloc(Math.max(size, 8));

      if (typeof value === "boolean") {
        valuePtr.writeU8(value ? 1 : 0);
      } else if (typeof value === "bigint") {
        valuePtr.writeS64(new Int64(value.toString()));
      } else {
        const kind = type.kind;
        if (kind === MonoTypeKind.Enum) {
          const underlying = type.underlyingType;
          if (underlying) writePrimitiveValue(valuePtr, underlying.kind, value);
          else valuePtr.writeS32(value);
        } else if (isPrimitiveKind(kind)) {
          writePrimitiveValue(valuePtr, kind, value);
        } else {
          if (size <= 1) valuePtr.writeS8(value);
          else if (size <= 2) valuePtr.writeS16(value);
          else if (size <= 4) valuePtr.writeS32(value);
          else valuePtr.writeS64(value);
        }
      }

      const boxed = api.native.mono_value_box(api.getRootDomain(), klass.pointer, valuePtr);
      return new MonoObject(api, boxed);
    },

    boxValueType(valuePtr: NativePointer, klass: MonoClass): MonoObject {
      const boxed = api.native.mono_value_box(api.getRootDomain(), klass.pointer, valuePtr);
      return new MonoObject(api, boxed);
    },

    unbox(obj: MonoObject): NativePointer {
      if (pointerIsNull(obj.pointer)) {
        return ptr(0);
      }
      return api.native.mono_object_unbox(obj.pointer);
    },

    unboxValue(obj: MonoObject, monoType?: MonoType, options: TypedReadOptions = {}): any {
      if (pointerIsNull(obj.pointer)) {
        return null;
      }
      const valuePtr = api.native.mono_object_unbox(obj.pointer);
      const type = monoType ?? obj.class.type;
      return this.readTyped(valuePtr, type, options);
    },

    string(value: string): MonoString {
      return MonoString.new(api, value);
    },

    readString(ptr: NativePointer): string | null {
      if (pointerIsNull(ptr)) return null;
      return api.readMonoString(ptr, true);
    },

    array<T = any>(elementClass: MonoClass, length: number): MonoArray<T> {
      return MonoArray.new(api, elementClass, length);
    },

    delegate(delegateClass: MonoClass, target: MonoObject | null, method: MonoMethod): MonoDelegate {
      return MonoDelegate.new(api, delegateClass, target, method);
    },

    copyValueType(dest: NativePointer, src: NativePointer, size: number): void {
      Memory.copy(dest, src, size);
    },

    allocValueType(klass: MonoClass): NativePointer {
      const { size, alignment } = klass.type.valueSize;
      const alignedSize = Math.max(size, alignment);
      return Memory.alloc(alignedSize);
    },
  };
}

export function buildTraceSubsystem(tracer: Tracer): Trace {
  return {
    method: (m: MonoMethod, cb: MethodCallbacks) => tracer.method(m, cb),
    tryMethod: (m: MonoMethod, cb: MethodCallbacks) => tracer.tryMethod(m, cb),
    methodExtended: (m: MonoMethod, cb: MethodCallbacksExtended) => tracer.methodExtended(m, cb),
    tryMethodExtended: (m: MonoMethod, cb: MethodCallbacksExtended) => tracer.tryMethodExtended(m, cb),
    classAll: (k: MonoClass, cb: MethodCallbacks) => tracer.classAll(k, cb),
    methodsByPattern: (pattern: string, callbacks: MethodCallbacks) => tracer.methodsByPattern(pattern, callbacks),
    classesByPattern: (pattern: string, callbacks: MethodCallbacks) => tracer.classesByPattern(pattern, callbacks),
    replaceReturnValue: (m: MonoMethod, r: ReturnValueReplacer) => tracer.replaceReturnValue(m, r),
    tryReplaceReturnValue: (m: MonoMethod, r: ReturnValueReplacer) => tracer.tryReplaceReturnValue(m, r),
    field: (f: MonoField, cb: FieldAccessCallbacks) => tracer.field(f, cb),
    fieldsByPattern: (pattern: string, callbacks: FieldAccessCallbacks) => tracer.fieldsByPattern(pattern, callbacks),
    property: (p: MonoProperty, cb: PropertyAccessCallbacks) => tracer.property(p, cb),
    propertiesByPattern: (pattern: string, callbacks: PropertyAccessCallbacks) =>
      tracer.propertiesByPattern(pattern, callbacks),
    createPerformanceTracker: () => tracer.createPerformanceTracker(),
    methodWithCallStack: (m: MonoMethod, cb: MethodCallbacksTimed) => tracer.methodWithCallStack(m, cb),
  };
}

export function buildICallSubsystem(registrar: InternalCallRegistrar): ICall {
  return {
    get isSupported(): boolean {
      return registrar.isSupported();
    },
    requireSupported: () => registrar.ensureSupported(),
    register: (definition: InternalCallDefinition, options?: InternalCallRegistrationOptions) =>
      registrar.register(definition, options),
    tryRegister: (definition: InternalCallDefinition, options?: InternalCallRegistrationOptions): boolean =>
      registrar.tryRegister(definition, options),
    registerAll: (definitions: InternalCallDefinition[], options?: InternalCallRegistrationOptions) =>
      registrar.registerAll(definitions, options),
    tryRegisterAll: (definitions: InternalCallDefinition[], options?: InternalCallRegistrationOptions): number =>
      registrar.tryRegisterAll(definitions, options),
    has: (name: string): boolean => registrar.has(name),
    get: (name: string): InternalCallRegistrationInfo | undefined => registrar.get(name),
    getAll: (): InternalCallRegistrationInfo[] => registrar.getAll(),
    get count(): number {
      return registrar.count;
    },
    get names(): string[] {
      return registrar.names;
    },
    getSummary: () => registrar.getSummary(),
    clear: () => registrar.clear(),
    DuplicatePolicy,
  };
}

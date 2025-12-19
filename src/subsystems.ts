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
import { MonoType, MonoTypeKind, readPrimitiveValue, writePrimitiveValue } from "./model/type";
import type { MonoApi } from "./runtime/api";
import type { GCHandle } from "./runtime/gchandle";
import { boxPrimitiveValue, boxValueTypePtr, readTypedValue, writeTypedValue } from "./runtime/value-conversion";
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
      return readTypedValue(api, ptr, monoType, options);
    },

    writeTyped(ptr: NativePointer, value: any, monoType: MonoType): void {
      writeTypedValue(api, ptr, value, monoType);
    },

    box(value: number | boolean | bigint, klass: MonoClass): MonoObject {
      const boxed = boxPrimitiveValue(api, klass.pointer, klass.type, value);
      return new MonoObject(api, boxed);
    },

    boxValueType(valuePtr: NativePointer, klass: MonoClass): MonoObject {
      const boxed = boxValueTypePtr(api, klass.pointer, valuePtr);
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
      return readTypedValue(api, valuePtr, type, options);
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

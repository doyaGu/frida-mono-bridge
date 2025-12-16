export type PerformMode = "bind" | "free" | "leak";

export interface Config {
  /** Mono module name(s) to wait for. Leave undefined to auto-detect. */
  moduleName?: string | string[];

  /** Maximum time to wait for initialization. */
  initializeTimeoutMs: number;

  /** Warn after this many milliseconds while initializing. */
  warnAfterMs: number;

  /** Whether to install `Mono` on `globalThis` during initialization. */
  installGlobal: boolean;

  /** Default log verbosity used by internal components. */
  logLevel: "silent" | "error" | "warn" | "info" | "debug";

  /** Default perform mode used by `perform()` when not specified. */
  performMode: PerformMode;
}

export type MemoryType =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "float"
  | "double"
  | "pointer"
  | "bool"
  | "char";

export interface TypedReadOptions {
  /** Return Int64/UInt64 as bigint instead of number */
  returnBigInt?: boolean;
  /** Return raw wrapper objects (MonoString, MonoArray) instead of coerced JS values */
  returnRaw?: boolean;
}

export interface MemorySubsystem {
  /**
   * Read a value from memory using simple type name.
   * @param ptr Memory address
   * @param type Simple type name (int8, uint8, etc.)
   */
  read(ptr: NativePointer, type: MemoryType): any;

  /**
   * Write a value to memory using simple type name.
   * @param ptr Memory address
   * @param value Value to write
   * @param type Simple type name
   */
  write(ptr: NativePointer, value: any, type: MemoryType): void;

  /**
   * Read a value from memory using MonoType for full type information.
   * Handles primitives, pointers, value types, strings, arrays, delegates, etc.
   * @param ptr Memory address
   * @param monoType MonoType describing the value
   * @param options Read options
   */
  readTyped(ptr: NativePointer, monoType: import("./model/type").MonoType, options?: TypedReadOptions): any;

  /**
   * Write a value to memory using MonoType for full type information.
   * Handles primitives, pointers, value types, strings, arrays, delegates, etc.
   * @param ptr Memory address
   * @param value Value to write
   * @param monoType MonoType describing the value
   */
  writeTyped(ptr: NativePointer, value: any, monoType: import("./model/type").MonoType): void;

  /**
   * Box a primitive value into a managed object.
   * @param value Primitive value
   * @param klass Value type class
   */
  box(value: number | boolean | bigint, klass: import("./model/class").MonoClass): import("./model/object").MonoObject;

  /**
   * Box a value type into a managed object.
   * @param valuePtr Pointer to the value type data
   * @param klass The value type class
   */
  boxValueType(valuePtr: NativePointer, klass: import("./model/class").MonoClass): import("./model/object").MonoObject;

  /**
   * Unbox a managed object to get the value pointer.
   * @param obj Boxed object
   */
  unbox(obj: import("./model/object").MonoObject): NativePointer;

  /**
   * Unbox a managed object and read the value.
   * @param obj Boxed object
   * @param monoType Expected type (optional, inferred from object if not provided)
   * @param options Read options
   */
  unboxValue(
    obj: import("./model/object").MonoObject,
    monoType?: import("./model/type").MonoType,
    options?: TypedReadOptions,
  ): any;

  /**
   * Create a managed string from a JavaScript string.
   * @param value JavaScript string
   */
  string(value: string): import("./model/string").MonoString;

  /**
   * Read a managed string to JavaScript string.
   * @param ptr Pointer to MonoString
   */
  readString(ptr: NativePointer): string | null;

  /**
   * Create a managed array.
   * @param elementClass Element type
   * @param length Array length
   */
  array<T = any>(elementClass: import("./model/class").MonoClass, length: number): import("./model/array").MonoArray<T>;

  /**
   * Create a delegate from a method.
   * @param delegateClass The delegate class
   * @param target Target object (null for static methods)
   * @param method The method to bind
   */
  delegate(
    delegateClass: import("./model/class").MonoClass,
    target: import("./model/object").MonoObject | null,
    method: import("./model/method").MonoMethod,
  ): import("./model/delegate").MonoDelegate;

  /**
   * Copy value type data between memory locations.
   * @param dest Destination pointer
   * @param src Source pointer
   * @param size Size in bytes
   */
  copyValueType(dest: NativePointer, src: NativePointer, size: number): void;

  /**
   * Allocate memory for a value type.
   * @param klass The value type class
   */
  allocValueType(klass: import("./model/class").MonoClass): NativePointer;
}

export interface GC {
  collect(generation?: number): void;
  readonly maxGeneration: number;
  handle(obj: NativePointer, pinned?: boolean): import("./runtime/gchandle").GCHandle;
  weakHandle(obj: NativePointer, trackResurrection?: boolean): import("./runtime/gchandle").GCHandle;
  releaseHandle(handle: import("./runtime/gchandle").GCHandle): void;
  releaseAll(): void;
  readonly stats: import("./model/gc").MemoryStats;
  getMemoryStats(): import("./model/gc").MemoryStats;
  getActiveHandleCount(): number;
  getGenerationStats(): import("./model/gc").GenerationStats[];
  getMemorySummary(): string;
  isCollected(handle: import("./runtime/gchandle").GCHandle): boolean;
  collectAndReport(): {
    before: import("./model/gc").MemoryStats;
    after: import("./model/gc").MemoryStats;
    delta: number | null;
    durationMs: number;
  };
  getFinalizationQueueInfo(): { available: boolean; pendingCount: number | null; message: string };
  requestFinalization(): boolean;
  waitForPendingFinalizers(timeout?: number): boolean;
  suppressFinalize(objectPtr: NativePointer): boolean;
}

export interface Trace {
  method(
    monoMethod: import("./model/method").MonoMethod,
    callbacks: import("./model/trace").MethodCallbacks,
  ): () => void;
  tryMethod(
    monoMethod: import("./model/method").MonoMethod,
    callbacks: import("./model/trace").MethodCallbacks,
  ): (() => void) | null;
  methodExtended(
    monoMethod: import("./model/method").MonoMethod,
    callbacks: import("./model/trace").MethodCallbacksExtended,
  ): () => void;
  tryMethodExtended(
    monoMethod: import("./model/method").MonoMethod,
    callbacks: import("./model/trace").MethodCallbacksExtended,
  ): (() => void) | null;
  classAll(klass: import("./model/class").MonoClass, callbacks: import("./model/trace").MethodCallbacks): () => void;
  methodsByPattern(pattern: string, callbacks: import("./model/trace").MethodCallbacks): () => void;
  classesByPattern(pattern: string, callbacks: import("./model/trace").MethodCallbacks): () => void;
  replaceReturnValue(
    monoMethod: import("./model/method").MonoMethod,
    replacement: (originalRetval: NativePointer, thisPtr: NativePointer, args: NativePointer[]) => NativePointer | void,
  ): () => void;
  tryReplaceReturnValue(
    monoMethod: import("./model/method").MonoMethod,
    replacement: (originalRetval: NativePointer, thisPtr: NativePointer, args: NativePointer[]) => NativePointer | void,
  ): (() => void) | null;
  field(
    monoField: import("./model/field").MonoField,
    callbacks: import("./model/trace").FieldAccessCallbacks,
  ): (() => void) | null;
  fieldsByPattern(pattern: string, callbacks: import("./model/trace").FieldAccessCallbacks): () => void;
  property(
    monoProperty: import("./model/property").MonoProperty,
    callbacks: import("./model/trace").PropertyAccessCallbacks,
  ): () => void;
  propertiesByPattern(pattern: string, callbacks: import("./model/trace").PropertyAccessCallbacks): () => void;
  createPerformanceTracker(): import("./model/trace").PerformanceTracker;
  methodWithCallStack(
    monoMethod: import("./model/method").MonoMethod,
    callbacks: import("./model/trace").MethodCallbacksTimed,
  ): () => void;
}

export interface ICall {
  /** Whether internal call registration is supported by this runtime */
  readonly isSupported: boolean;

  /** Require internal call support, throwing if unavailable */
  requireSupported(): void;

  /** Register an internal call (throws on failure) */
  register(
    definition: import("./model/internal-call").InternalCallDefinition,
    options?: import("./model/internal-call").InternalCallRegistrationOptions,
  ): void;

  /** Try to register an internal call (returns false on failure) */
  tryRegister(
    definition: import("./model/internal-call").InternalCallDefinition,
    options?: import("./model/internal-call").InternalCallRegistrationOptions,
  ): boolean;

  /** Register multiple internal calls (throws on failure) */
  registerAll(
    definitions: import("./model/internal-call").InternalCallDefinition[],
    options?: import("./model/internal-call").InternalCallRegistrationOptions,
  ): void;

  /** Try to register multiple internal calls (returns success count) */
  tryRegisterAll(
    definitions: import("./model/internal-call").InternalCallDefinition[],
    options?: import("./model/internal-call").InternalCallRegistrationOptions,
  ): number;

  /** Check if an internal call is registered */
  has(name: string): boolean;

  /** Get registration info for an internal call */
  get(name: string): import("./model/internal-call").InternalCallRegistrationInfo | undefined;

  /** Get all registered internal calls */
  getAll(): import("./model/internal-call").InternalCallRegistrationInfo[];

  /** Number of registered internal calls */
  readonly count: number;

  /** All registered method names */
  readonly names: string[];

  /** Get registrar summary */
  getSummary(): import("./model/internal-call").InternalCallRegistrarSummary;

  /** Clear local tracking (does NOT unregister from Mono) */
  clear(): void;

  /** Duplicate handling policy constants */
  DuplicatePolicy: typeof import("./model/internal-call").DuplicatePolicy;
}

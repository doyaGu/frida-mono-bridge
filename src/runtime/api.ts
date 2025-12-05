import { LruCache } from "../utils/cache";
import { allocPointerArray, pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoModuleInfo } from "./module";
import { ALL_MONO_EXPORTS, MonoApiName, MonoExportSignature, getSignature } from "./signatures";
import type { ThreadManager } from "./thread";

export type MonoArg = NativePointer | number | boolean | string | null | undefined;

/** Argument types that can be passed to method/delegate invocation */
export type InvocationArgument =
  | { pointer: NativePointer }
  | NativePointer
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

export type MonoNativeBindings = {
  [Name in MonoApiName]: (...args: MonoArg[]) => any;
};

export class MonoFunctionResolutionError extends Error {
  constructor(
    public readonly exportName: string,
    message: string,
  ) {
    super(message);
    this.name = "MonoFunctionResolutionError";
  }
}

/**
 * Error thrown when a managed exception occurs during mono_runtime_invoke.
 * Contains the raw exception object pointer and extracted details when available.
 */
export class MonoManagedExceptionError extends Error {
  constructor(
    public readonly exception: NativePointer,
    public readonly exceptionType?: string,
    public readonly exceptionMessage?: string,
  ) {
    const details = exceptionMessage ? `: ${exceptionMessage}` : "";
    const type = exceptionType ? ` (${exceptionType})` : "";
    super(`Managed exception thrown${type}${details}`);
    this.name = "MonoManagedExceptionError";
  }
}

export interface DelegateThunkInfo {
  invoke: NativePointer;
  thunk: NativePointer;
}

/**
 * Maximum cache sizes for LRU caches to prevent unbounded memory growth.
 */
const CACHE_LIMITS = {
  FUNCTION_CACHE: 256,
  ADDRESS_CACHE: 512,
  DELEGATE_THUNK_CACHE: 128,
};

/**
 * Core API wrapper for Mono runtime functions.
 * Provides high-level access to Mono C API with automatic thread attachment,
 * exception handling, and intelligent caching with LRU eviction.
 */
export class MonoApi {
  private readonly functionCache = new LruCache<
    MonoApiName,
    NativeFunction<NativeFunctionReturnValue, NativeFunctionArgumentValue[]>
  >(CACHE_LIMITS.FUNCTION_CACHE);
  private readonly addressCache = new LruCache<MonoApiName, NativePointer>(CACHE_LIMITS.ADDRESS_CACHE);
  private readonly delegateThunkCache = new LruCache<string, DelegateThunkInfo>(CACHE_LIMITS.DELEGATE_THUNK_CACHE);

  /**
   * Exception slot for mono_runtime_invoke exception handling.
   * Allocated once and reused for session lifetime (pointer size: ~8 bytes).
   */
  private exceptionSlot: NativePointer | null = null;
  private rootDomain: NativePointer | null = null;

  /**
   * Track allocated resources for proper cleanup
   */
  private allocatedResources: NativePointer[] = [];
  private disposed = false;

  /**
   * Thread manager for this API instance.
   * @internal Used by guard.ts to avoid circular dependency
   */
  public _threadManager!: ThreadManager;

  // Lazily bound invokers keyed by Mono export name.
  public readonly native: MonoNativeBindings = this.createNativeBindings();

  private moduleHandle: Module | null = null;

  constructor(private readonly module: MonoModuleInfo) {}

  attachThread(): NativePointer {
    const rootDomain = this.getRootDomain();
    const thread = this.native.mono_thread_attach(rootDomain);
    if (pointerIsNull(thread)) {
      throw new Error("mono_thread_attach returned NULL; ensure the Mono runtime is initialised");
    }
    return thread;
  }

  detachThread(thread: NativePointer): void {
    this.native.mono_thread_detach(thread);
  }

  getRootDomain(): NativePointer {
    if (this.rootDomain && !pointerIsNull(this.rootDomain)) {
      return this.rootDomain;
    }
    const domain = this.native.mono_get_root_domain();
    if (pointerIsNull(domain)) {
      throw new Error("mono_get_root_domain returned NULL. Mono may not be initialised in this process");
    }
    this.rootDomain = domain;
    return domain;
  }

  stringNew(text: string): NativePointer {
    const domain = this.getRootDomain();
    const data = Memory.allocUtf8String(text);
    return this.native.mono_string_new(domain, data);
  }

  /**
   * Invokes a managed method with exception handling and detail extraction.
   * Automatically attaches exception slot and extracts exception type/message on error.
   *
   * @param method Pointer to MonoMethod
   * @param instance Instance pointer (NULL for static methods)
   * @param args Array of argument pointers
   * @returns Result pointer from the invocation
   * @throws MonoManagedExceptionError with extracted exception details
   */
  runtimeInvoke(method: NativePointer, instance: NativePointer | null, args: NativePointer[]): NativePointer {
    const invoke = this.native.mono_runtime_invoke;
    const exceptionSlot = this.getExceptionSlot();
    exceptionSlot.writePointer(NULL);
    const argv = allocPointerArray(args);
    const result = invoke(method, instance ?? NULL, argv, exceptionSlot);
    const exception = exceptionSlot.readPointer();
    if (!pointerIsNull(exception)) {
      const details = this.extractExceptionDetails(exception);
      throw new MonoManagedExceptionError(exception, details.type, details.message);
    }
    return result;
  }

  /**
   * Attempts to extract type and message from a managed exception object.
   * Falls back gracefully if extraction fails.
   *
   * @param exception Pointer to managed exception object
   * @returns Object with optional type and message strings
   */
  private extractExceptionDetails(exception: NativePointer): { type?: string; message?: string } {
    try {
      const klass = this.native.mono_object_get_class(exception);
      if (pointerIsNull(klass)) {
        return {};
      }

      const typeNamePtr = this.native.mono_class_get_name(klass);
      const type = readUtf8String(typeNamePtr);

      // Try to extract message using mono_object_to_string if available
      if (this.hasExport("mono_object_to_string")) {
        const excSlot = Memory.alloc(Process.pointerSize);
        excSlot.writePointer(NULL);
        const msgObj = this.native.mono_object_to_string(exception, excSlot);

        if (!pointerIsNull(msgObj) && pointerIsNull(excSlot.readPointer())) {
          const message = this.readMonoString(msgObj, true);
          return { type, message };
        }
      }

      // Fallback: Try to invoke ToString() method directly
      try {
        const toStringMethod = this.native.mono_class_get_method_from_name(
          klass,
          Memory.allocUtf8String("ToString"),
          0,
        );
        if (!pointerIsNull(toStringMethod)) {
          const excSlot = Memory.alloc(Process.pointerSize);
          excSlot.writePointer(NULL);
          const strPtr = this.native.mono_runtime_invoke(toStringMethod, exception, NULL, excSlot);

          if (!pointerIsNull(strPtr) && pointerIsNull(excSlot.readPointer())) {
            const message = this.readMonoString(strPtr, true);
            return { type, message };
          }
        }
      } catch (_) {
        // Fallback failed, just return type
      }

      return { type };
    } catch (_error) {
      // Best effort - return empty if extraction fails
      return {};
    }
  }

  /**
   * Read a MonoString pointer to JavaScript string using Mono API.
   * Tries mono_string_to_utf8 first, then falls back to UTF-16 methods.
   *
   * @param strPtr MonoString pointer
   * @param fallbackToChars Whether to try mono_string_chars as fallback (default: true)
   * @returns JavaScript string or empty string if failed
   */
  readMonoString(strPtr: NativePointer, fallbackToChars = true): string {
    if (pointerIsNull(strPtr)) return "";

    // Try mono_string_to_utf8 first (most common)
    if (this.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(strPtr);
      if (!pointerIsNull(utf8Ptr)) {
        const result = utf8Ptr.readUtf8String() || "";
        this.tryFree(utf8Ptr);
        return result;
      }
    }

    if (!fallbackToChars) return "";

    // Fallback: Try mono_string_to_utf16
    if (this.hasExport("mono_string_to_utf16")) {
      const utf16Ptr = this.native.mono_string_to_utf16(strPtr);
      if (!pointerIsNull(utf16Ptr)) {
        return utf16Ptr.readUtf16String() || "";
      }
    }

    // Last resort: Try mono_string_chars + mono_string_length
    if (this.hasExport("mono_string_chars") && this.hasExport("mono_string_length")) {
      const chars = this.native.mono_string_chars(strPtr);
      const length = this.native.mono_string_length(strPtr) as number;
      if (!pointerIsNull(chars) && length > 0) {
        return chars.readUtf16String(length) || "";
      }
    }

    return "";
  }

  /**
   * Prepare an argument for managed method/delegate invocation
   * Converts JS values to appropriate Mono pointers
   *
   * @param arg The argument to prepare
   * @returns NativePointer suitable for passing to mono_runtime_invoke
   * @throws Error if primitive types need manual boxing
   */
  prepareInvocationArgument(arg: InvocationArgument): NativePointer {
    if (arg === null || arg === undefined) {
      return NULL;
    }
    if (typeof arg === "object" && "pointer" in arg) {
      return arg.pointer;
    }
    if (arg instanceof NativePointer) {
      return arg;
    }
    if (typeof arg === "string") {
      return this.stringNew(arg);
    }
    if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") {
      throw new Error("Primitive arguments need manual boxing before invocation");
    }
    return arg as NativePointer;
  }

  getDelegateThunk(delegateClass: NativePointer): DelegateThunkInfo {
    this.ensureNotDisposed();

    const key = delegateClass.toString();
    return this.delegateThunkCache.getOrCreate(key, () => {
      const invoke = this.native.mono_get_delegate_invoke(delegateClass);
      if (pointerIsNull(invoke)) {
        throw new Error("Delegate invoke method not available for provided class");
      }
      const thunk = this.native.mono_method_get_unmanaged_thunk(invoke);
      if (pointerIsNull(thunk)) {
        throw new Error(
          "mono_method_get_unmanaged_thunk returned NULL. This Mono build may not support unmanaged thunks",
        );
      }
      return { invoke, thunk };
    });
  }

  /**
   * Registers an internal call (native function callable from managed code).
   *
   * @param name Fully qualified method name (e.g., "Namespace.Class::MethodName")
   * @param callback Native function pointer to invoke
   * @throws Error if name is empty or callback is null
   */
  addInternalCall(name: string, callback: NativePointer): void {
    if (!name || name.trim().length === 0) {
      throw new Error("Internal call name must be a non-empty string");
    }
    if (pointerIsNull(callback)) {
      throw new Error("Internal call callback must not be NULL");
    }
    const namePtr = Memory.allocUtf8String(name);
    this.native.mono_add_internal_call(namePtr, callback);
  }

  /**
   * Cleans up resources associated with this MonoApi instance.
   * Detaches all threads and clears caches to prevent memory leaks.
   * Should be called when the API instance is no longer needed.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Try to safely detach threads using detachIfExiting for the current thread.
    // This uses mono_thread_detach_if_exiting which only detaches if the thread
    // is actually exiting, preventing script hangs during normal disposal.
    if (this._threadManager && typeof this._threadManager.detachAll === "function") {
      this._threadManager.detachAll();
    }

    // Clear all caches
    this.functionCache.clear();
    this.addressCache.clear();
    this.delegateThunkCache.clear();

    // Clean up allocated resources
    // for (const _ of this.allocatedResources) {
    //   try {
    //     // Note: We don't explicitly free Memory.alloc pointers as they rely on Frida's GC
    //     // But we clear our reference to help with garbage collection
    //   } catch (error) {
    //     // Ignore cleanup errors
    //   }
    // }
    this.allocatedResources = [];

    // Clear pointers
    this.exceptionSlot = null;
    this.rootDomain = null;
    this.moduleHandle = null;

    this.disposed = true;
  }

  /**
   * Check if the API instance has been disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Ensure the API instance is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("MonoApi has been disposed");
    }
  }

  /**
   * Track an allocated resource for cleanup
   */
  private trackAllocation(ptr: NativePointer): NativePointer {
    this.allocatedResources.push(ptr);
    return ptr;
  }

  call<T = NativePointer>(name: MonoApiName, ...args: MonoArg[]): T {
    const fn = this.native[name] as (...fnArgs: MonoArg[]) => T;
    return fn(...args);
  }

  /**
   * Safely free memory allocated by Mono (e.g., from mono_string_to_utf8)
   * Does nothing if mono_free is not available (Unity Mono doesn't export it)
   */
  tryFree(ptr: NativePointer): void {
    if (pointerIsNull(ptr)) return;
    if (this.hasExport("mono_free")) {
      this.native.mono_free(ptr);
    }
    // If mono_free is not available, the memory will leak but won't crash
    // This is acceptable for short-lived scripts
  }

  hasExport(name: MonoApiName): boolean {
    try {
      const address = this.resolveAddress(name, false);
      return !pointerIsNull(address);
    } catch (_error) {
      return false;
    }
  }

  getNativeFunction(
    name: MonoApiName,
  ): NativeFunction<NativeFunctionReturnValue, NativeFunctionArgumentValue[]> {
    this.ensureNotDisposed();

    return this.functionCache.getOrCreate(name, () => {
      const signature = getSignature(name);
      const address = this.resolveAddress(name, true, signature);
      return new NativeFunction(
        address,
        signature.retType as NativeFunctionReturnType,
        signature.argTypes as NativeFunctionArgumentType[],
      );
    });
  }

  private createNativeBindings(): MonoNativeBindings {
    const bindings: Partial<MonoNativeBindings> = {};
    const target = bindings as Record<MonoApiName, (...args: MonoArg[]) => any>;
    for (const name of ALL_MONO_EXPORTS) {
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        get: () => {
          const nativeFn = this.getNativeFunction(name);
          const wrapper = (...args: MonoArg[]) => {
            const invoke = () => nativeFn(...args.map(normalizeArg));
            const manager = (this as any)._threadManager;

            if (manager) {
              if (typeof manager.isInAttachedContext === "function" && manager.isInAttachedContext()) {
                return invoke();
              }
              if (typeof manager.run === "function") {
                return manager.run(invoke);
              }
              if (typeof manager.withAttachedThread === "function") {
                return manager.withAttachedThread(invoke);
              }
            }

            return invoke();
          };
          Object.defineProperty(target, name, {
            configurable: false,
            enumerable: true,
            value: wrapper,
            writable: false,
          });
          return wrapper;
        },
      });
    }
    return target as MonoNativeBindings;
  }

  private getExceptionSlot(): NativePointer {
    this.ensureNotDisposed();

    if (this.exceptionSlot && !pointerIsNull(this.exceptionSlot)) {
      return this.exceptionSlot;
    }
    this.exceptionSlot = this.trackAllocation(Memory.alloc(Process.pointerSize));
    return this.exceptionSlot;
  }

  private resolveAddress(
    name: MonoApiName,
    throwOnMissing: boolean,
    signature: MonoExportSignature = getSignature(name),
  ): NativePointer {
    this.ensureNotDisposed();

    const cached = this.addressCache.get(name);
    if (cached) {
      return cached;
    }

    const exportNames = [signature.name, ...(signature.aliases ?? [])];
    for (const exportName of exportNames) {
      const address = this.getModuleHandle().findExportByName(exportName);
      if (address) {
        this.addressCache.set(name, address);
        return address;
      }
    }

    if (throwOnMissing) {
      throw new MonoFunctionResolutionError(
        signature.name,
        `Unable to resolve Mono export ${signature.name} in ${this.module.name}. Consider adding an alias in manual.ts.`,
      );
    }

    return NULL;
  }

  private getModuleHandle(): Module {
    if (this.moduleHandle) {
      return this.moduleHandle;
    }

    const handle = Process.findModuleByName(this.module.name);
    if (handle === null) {
      throw new MonoFunctionResolutionError(
        this.module.name,
        `Module ${this.module.name} is not loaded in the current process`,
      );
    }
    this.moduleHandle = handle;
    return handle;
  }
}

function normalizeArg(arg: MonoArg): any {
  if (arg === null || arg === undefined) {
    return NULL;
  }
  if (typeof arg === "boolean") {
    return arg ? 1 : 0;
  }
  return arg;
}

export function createMonoApi(module: MonoModuleInfo): MonoApi {
  return new MonoApi(module);
}

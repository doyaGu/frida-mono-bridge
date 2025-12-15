/**
 * Runtime API - Core interface to Mono C API with intelligent caching and thread management.
 *
 * Provides:
 * - Automatic thread attachment/detachment for Mono API calls
 * - LRU caching for frequently accessed functions and addresses
 * - Exception handling with detailed error extraction
 * - Resource lifecycle management
 * - Delegate thunk management
 *
 * @module runtime/api
 */

import { LruCache } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { allocPointerArray, pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { ALL_MONO_EXPORTS, MonoApiName, MonoExportSignature, getSignature, tryGetSignature } from "./exports";
import { MonoModuleInfo } from "./module";
import type { ThreadManager } from "./thread";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Basic argument type for Mono native function calls.
 */
export type MonoArg = NativePointer | number | boolean | string | null | undefined;

/**
 * Argument types that can be passed to method/delegate invocation.
 * Supports both direct values and objects with pointer properties.
 */
export type InvocationArgument =
  | { pointer: NativePointer }
  | NativePointer
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

/**
 * Native function wrapper type for Mono API functions.
 * Uses any for flexibility with Frida's dynamic native function system.
 */
export type MonoNativeFunction = (...args: MonoArg[]) => any;

/**
 * Bindings for all Mono native functions.
 * Provides typed access to Mono C API with automatic thread management.
 */
export type MonoNativeBindings = {
  [Name in MonoApiName]: MonoNativeFunction;
};

/**
 * Information about a delegate's invoke method and unmanaged thunk.
 */
export interface DelegateThunkInfo {
  /** Pointer to the delegate's Invoke method */
  invoke: NativePointer;
  /** Pointer to the unmanaged thunk for direct invocation */
  thunk: NativePointer;
}

/**
 * Details extracted from a managed exception.
 */
export interface ExceptionDetails {
  /** Full type name of the exception */
  type?: string;
  /** Exception message */
  message?: string;
}

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Maximum cache sizes for LRU caches to prevent unbounded memory growth.
 */
const CACHE_LIMITS = {
  /** Maximum number of cached native functions */
  FUNCTION_CACHE: 256,
  /** Maximum number of cached export addresses */
  ADDRESS_CACHE: 512,
  /** Maximum number of cached delegate thunks */
  DELEGATE_THUNK_CACHE: 128,
} as const;

/**
 * Default timeouts and intervals for runtime operations.
 */
const DEFAULT_TIMEOUTS = {
  /** Default timeout for waiting for root domain (ms) */
  ROOT_DOMAIN_WAIT: 30_000,
  /** Time to wait before warning about slow initialization (ms) */
  WARN_AFTER: 10_000,
  /** Polling interval for checking root domain readiness (ms) */
  POLL_INTERVAL: 50,
} as const;

// ============================================================================
// MAIN API CLASS
// ============================================================================

/**
 * Core API wrapper for Mono runtime functions.
 *
 * Provides high-level access to Mono C API with:
 * - Automatic thread attachment/detachment via ThreadManager
 * - Intelligent LRU caching for functions, addresses, and delegate thunks
 * - Managed exception handling with detailed error extraction
 * - Resource lifecycle management and cleanup
 * - Type-safe native function bindings
 *
 * @example
 * ```typescript
 * const api = createMonoApi(moduleInfo);
 *
 * // Wait for runtime to be ready
 * await api.waitForRootDomainReady(30000);
 *
 * // Use native bindings (automatically handles threads)
 * const domain = api.native.mono_get_root_domain();
 *
 * // Clean up when done
 * api.dispose();
 * ```
 */
export class MonoApi {
  // ===== CACHES =====

  /** LRU cache for native function wrappers */
  private readonly functionCache = new LruCache<
    MonoApiName,
    NativeFunction<NativeFunctionReturnValue, NativeFunctionArgumentValue[]>
  >(CACHE_LIMITS.FUNCTION_CACHE);

  /** LRU cache for export addresses */
  private readonly addressCache = new LruCache<MonoApiName, NativePointer>(CACHE_LIMITS.ADDRESS_CACHE);

  /** LRU cache for delegate thunk information */
  private readonly delegateThunkCache = new LruCache<string, DelegateThunkInfo>(CACHE_LIMITS.DELEGATE_THUNK_CACHE);

  // ===== RUNTIME STATE =====

  /**
   * Exception slot for mono_runtime_invoke exception handling.
   * Allocated once and reused for session lifetime (pointer size: ~8 bytes).
   */
  private exceptionSlot: NativePointer | null = null;

  /** Cached root domain pointer */
  private rootDomain: NativePointer | null = null;

  /** Cached module handle */
  private moduleHandle: Module | null = null;

  // ===== RESOURCE TRACKING =====

  /** Track allocated resources for proper cleanup */
  private allocatedResources: NativePointer[] = [];

  /** Disposal flag to prevent use-after-dispose */
  private disposed = false;

  // ===== PUBLIC API =====

  /**
   * Thread manager for this API instance.
   * @internal Used by guard.ts to avoid circular dependency
   */
  public _threadManager!: ThreadManager;

  /**
   * Lazily bound native function invokers.
   * All calls automatically handle thread attachment via ThreadManager.
   */
  public readonly native: MonoNativeBindings = this.createNativeBindings();

  constructor(private readonly module: MonoModuleInfo) {}

  // ============================================================================
  // THREAD MANAGEMENT
  // ============================================================================

  /**
   * Try to attach the current thread to the Mono runtime without throwing.
   * @returns Thread handle if successful, null if failed
   *
   * @example
   * ```typescript
   * const thread = api.tryAttachThread();
   * if (thread) {
   *   // Thread attached successfully
   *   api.detachThread(thread);
   * }
   * ```
   */
  tryAttachThread(): NativePointer | null {
    try {
      const rootDomain = this.tryGetRootDomain();
      if (!rootDomain) {
        return null;
      }
      const thread = this.native.mono_thread_attach(rootDomain);
      if (pointerIsNull(thread)) {
        return null;
      }
      return thread;
    } catch {
      return null;
    }
  }

  /**
   * Attach the current thread to the Mono runtime.
   * @throws {MonoThreadError} if attachment fails
   */
  attachThread(): NativePointer {
    const rootDomain = this.getRootDomain();
    const thread = this.native.mono_thread_attach(rootDomain);
    if (pointerIsNull(thread)) {
      raise(
        MonoErrorCodes.THREAD_ATTACH_FAILED,
        "mono_thread_attach returned NULL",
        "Ensure the Mono runtime is initialised before attaching threads",
      );
    }
    return thread;
  }

  /**
   * Detach a thread from the Mono runtime.
   * @param thread Thread handle returned from attachThread() or tryAttachThread()
   */
  detachThread(thread: NativePointer): void {
    this.native.mono_thread_detach(thread);
  }

  // ============================================================================
  // ROOT DOMAIN ACCESS
  // ============================================================================

  /**
   * Get the root domain, throwing if not available.
   *
   * @returns Root domain pointer
   * @throws {MonoRuntimeNotReadyError} if root domain is NULL
   *
   * @example
   * ```typescript
   * const domain = api.getRootDomain();
   * ```
   */
  getRootDomain(): NativePointer {
    if (this.rootDomain && !pointerIsNull(this.rootDomain)) {
      return this.rootDomain;
    }
    const domain = this.native.mono_get_root_domain();
    if (pointerIsNull(domain)) {
      raise(
        MonoErrorCodes.RUNTIME_NOT_READY,
        "mono_get_root_domain returned NULL",
        "Mono may not be initialized. Try injecting later or use Mono.initialize() to wait",
      );
    }
    this.rootDomain = domain;
    return domain;
  }

  /**
   * Attempts to retrieve the root domain without throwing.
   * Useful for initialization flows that need to wait until Mono is ready.
   */
  tryGetRootDomain(): NativePointer | null {
    try {
      if (this.rootDomain && !pointerIsNull(this.rootDomain)) {
        return this.rootDomain;
      }
      const domain = this.native.mono_get_root_domain();
      if (pointerIsNull(domain)) {
        return null;
      }
      this.rootDomain = domain;
      return domain;
    } catch {
      return null;
    }
  }

  /**
   * Try to wait for root domain to become ready without throwing.
   *
   * @param timeoutMs Maximum time to wait for root domain (ms)
   * @param warnAfterMs Time to wait before logging a warning (ms)
   * @param pollIntervalMs Interval between checks (ms)
   * @returns Root domain pointer if ready within timeout, null on timeout
   *
   * @example
   * ```typescript
   * // Wait up to 30 seconds
   * const domain = await api.tryWaitForRootDomainReady(30000);
   * if (domain) {
   *   console.log('Mono runtime is ready');
   * } else {
   *   console.log('Timeout waiting for Mono');
   * }
   * ```
   */
  async tryWaitForRootDomainReady(
    timeoutMs: number,
    warnAfterMs: number = DEFAULT_TIMEOUTS.WARN_AFTER,
    pollIntervalMs: number = DEFAULT_TIMEOUTS.POLL_INTERVAL,
  ): Promise<NativePointer | null> {
    const deadline = Date.now() + timeoutMs;
    const warnAt = Date.now() + warnAfterMs;
    let didWarn = false;

    while (Date.now() < deadline) {
      const domain = this.tryGetRootDomain();
      if (domain && !pointerIsNull(domain)) {
        return domain;
      }

      if (!didWarn && Date.now() >= warnAt) {
        didWarn = true;
        console.warn("[Mono] Waiting for Mono runtime to become ready (root domain is NULL)...");
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  /**
   * Wait for root domain to become ready, throwing on timeout.
   *
   * @param timeoutMs Maximum time to wait for root domain (ms)
   * @param warnAfterMs Time to wait before logging a warning (ms)
   * @param pollIntervalMs Interval between checks (ms)
   * @returns Root domain pointer
   * @throws {MonoRuntimeNotReadyError} if root domain not ready within timeout
   *
   * @example
   * ```typescript
   * try {
   *   const domain = await api.waitForRootDomainReady(30000);
   *   console.log('Mono runtime is ready');
   * } catch (error) {
   *   console.error('Failed to initialize Mono:', error);
   * }
   * ```
   */
  async waitForRootDomainReady(
    timeoutMs: number,
    warnAfterMs: number = DEFAULT_TIMEOUTS.WARN_AFTER,
    pollIntervalMs: number = DEFAULT_TIMEOUTS.POLL_INTERVAL,
  ): Promise<NativePointer> {
    const domain = await this.tryWaitForRootDomainReady(timeoutMs, warnAfterMs, pollIntervalMs);
    if (domain) {
      return domain;
    }

    raise(
      MonoErrorCodes.RUNTIME_NOT_READY,
      `Timed out waiting for Mono runtime to become ready (mono_get_root_domain stayed NULL after ${timeoutMs}ms)`,
      "Try injecting later or increase Mono.config.initializeTimeoutMs",
    );
  }

  // ============================================================================
  // STRING AND INVOCATION UTILITIES
  // ============================================================================

  /**
   * Create a new MonoString from a JavaScript string.
   *
   * @param text String to convert
   * @returns Pointer to MonoString
   *
   * @example
   * ```typescript
   * const monoStr = api.stringNew('Hello, Mono!');
   * ```
   */
  stringNew(text: string): NativePointer {
    const domain = this.getRootDomain();
    const data = Memory.allocUtf8String(text);
    return this.native.mono_string_new(domain, data);
  }

  /**
   * Invoke a managed method with exception handling and detail extraction.
   * Automatically attaches exception slot and extracts exception type/message on error.
   *
   * @param method Pointer to MonoMethod
   * @param instance Instance pointer (NULL for static methods)
   * @param args Array of argument pointers
   * @returns Result pointer from the invocation
   * @throws {MonoManagedExceptionError} with extracted exception details
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
      const message = details.message || `Managed exception thrown: ${details.type || "Unknown"}`;
      raise(
        MonoErrorCodes.MANAGED_EXCEPTION,
        message,
        "Inspect exception details in `error.details`",
        {
          exception,
          exceptionType: details.type,
          exceptionMessage: details.message,
        },
      );
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
  private extractExceptionDetails(exception: NativePointer): ExceptionDetails {
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
   * Memory management:
   * - mono_string_to_utf8: returns heap-allocated buffer, MUST be freed
   * - mono_string_to_utf16: returns heap-allocated buffer, MUST be freed
   * - mono_string_chars: returns pointer into managed object, do NOT free
   *
   * @param strPtr MonoString pointer
   * @param fallbackToChars Whether to try mono_string_chars as fallback (default: true)
   * @returns JavaScript string or empty string if failed
   */
  readMonoString(strPtr: NativePointer, fallbackToChars = true): string {
    if (pointerIsNull(strPtr)) return "";

    // Try mono_string_to_utf8 first (most common)
    // Note: mono_string_to_utf8 allocates memory that must be freed
    if (this.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(strPtr);
      if (!pointerIsNull(utf8Ptr)) {
        try {
          return utf8Ptr.readUtf8String() || "";
        } finally {
          this.tryFree(utf8Ptr);
        }
      }
    }

    if (!fallbackToChars) return "";

    // Fallback: Try mono_string_to_utf16
    // Note: mono_string_to_utf16 allocates memory that must be freed
    if (this.hasExport("mono_string_to_utf16")) {
      const utf16Ptr = this.native.mono_string_to_utf16(strPtr);
      if (!pointerIsNull(utf16Ptr)) {
        try {
          return utf16Ptr.readUtf16String() || "";
        } finally {
          this.tryFree(utf16Ptr);
        }
      }
    }

    // Last resort: Try mono_string_chars + mono_string_length
    // Note: mono_string_chars returns a pointer INTO the managed string object
    // This is NOT heap-allocated, do NOT free it
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
   * Prepare an argument for managed method/delegate invocation.
   * Converts JS values to appropriate Mono pointers.
   *
   * @param arg The argument to prepare
   * @returns NativePointer suitable for passing to mono_runtime_invoke
   * @throws {MonoValidationError} if primitive types need manual boxing
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
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Primitive arguments need manual boxing before invocation",
        "Use MonoObject.box() to wrap primitive values",
      );
    }
    return arg as NativePointer;
  }

  // ============================================================================
  // DELEGATE AND INTERNAL CALL MANAGEMENT
  // ============================================================================

  /**
   * Get or create cached delegate thunk information.
   *
   * @param delegateClass Pointer to delegate class
   * @returns Delegate thunk info with invoke method and unmanaged thunk
   * @throws {MonoError} if delegate class is invalid or thunk creation fails
   *
   * @example
   * ```typescript
   * const thunkInfo = api.getDelegateThunk(delegateClassPtr);
   * // Use thunkInfo.invoke or thunkInfo.thunk
   * ```
   */
  getDelegateThunk(delegateClass: NativePointer): DelegateThunkInfo {
    this.ensureNotDisposed();

    // NOTE: mono_method_get_unmanaged_thunk is only available in mono-2.0-bdwgc.dll
    if (!this.hasExport("mono_method_get_unmanaged_thunk")) {
      raise(
        MonoErrorCodes.NOT_SUPPORTED,
        "mono_method_get_unmanaged_thunk is not available on this Mono runtime (only in mono-2.0-bdwgc.dll)",
        "Consider using runtime_invoke for delegate invocation instead",
      );
    }

    const key = delegateClass.toString();
    return this.delegateThunkCache.getOrCreate(key, () => {
      const invoke = this.native.mono_get_delegate_invoke(delegateClass);
      if (pointerIsNull(invoke)) {
        raise(
          MonoErrorCodes.METHOD_NOT_FOUND,
          "Delegate invoke method not available for provided class",
          "Ensure the class is a valid delegate type",
        );
      }
      const thunk = this.native.mono_method_get_unmanaged_thunk(invoke);
      if (pointerIsNull(thunk)) {
        raise(
          MonoErrorCodes.NOT_SUPPORTED,
          "mono_method_get_unmanaged_thunk returned NULL",
          "This Mono build may not support unmanaged thunks",
        );
      }
      return { invoke, thunk };
    });
  }

  /**
   * Register an internal call (native function callable from managed code).
   *
   * @param name Fully qualified method name (e.g., "Namespace.Class::MethodName")
   * @param callback Native function pointer to invoke
   * @throws {MonoValidationError} if name is empty or callback is null
   */
  addInternalCall(name: string, callback: NativePointer): void {
    if (!name || name.trim().length === 0) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Internal call name must be a non-empty string",
        "Provide a valid fully qualified method name",
      );
    }
    if (pointerIsNull(callback)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Internal call callback must not be NULL",
        "Provide a valid NativePointer to the callback function",
      );
    }
    const namePtr = Memory.allocUtf8String(name);
    this.native.mono_add_internal_call(namePtr, callback);
  }

  // ============================================================================
  // RESOURCE MANAGEMENT AND CLEANUP
  // ============================================================================

  /**
   * Clear all internal caches without disposing the API instance.
   * Use this to free memory while keeping the API usable.
   *
   * Clears:
   * - Native function cache
   * - Export address cache
   * - Delegate thunk cache
   *
   * Cached items will be re-created on next access.
   */
  clearCaches(): void {
    this.ensureNotDisposed();
    this.functionCache.clear();
    this.addressCache.clear();
    this.delegateThunkCache.clear();
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
      raise(
        MonoErrorCodes.DISPOSED,
        "MonoApi has been disposed",
        "Create a new MonoApi instance or avoid using after disposal",
      );
    }
  }

  /**
   * Track an allocated resource for cleanup
   */
  private trackAllocation(ptr: NativePointer): NativePointer {
    this.allocatedResources.push(ptr);
    return ptr;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Call a native function by name with type parameter.
   *
   * @typeParam T Return type
   * @param name Mono API function name
   * @param args Function arguments
   * @returns Function result
   */
  call<T = NativePointer>(name: MonoApiName, ...args: MonoArg[]): T {
    const fn = this.native[name] as (...fnArgs: MonoArg[]) => T;
    return fn(...args);
  }

  /**
   * Safely free memory allocated by Mono (e.g., from mono_string_to_utf8).
   *
   * Tries multiple free functions in order of preference:
   * 1. mono_free (standard Mono)
   * 2. mono_unity_g_free (Unity Mono builds)
   * 3. g_free (fallback for older builds)
   *
   * If none are available, logs a warning on first occurrence.
   * This is acceptable for short-lived scripts but may leak in long sessions.
   */
  tryFree(ptr: NativePointer): void {
    if (pointerIsNull(ptr)) return;

    // Try mono_free first (standard Mono)
    if (this.hasExport("mono_free")) {
      this.native.mono_free(ptr);
      return;
    }

    // Try mono_unity_g_free (Unity Mono builds)
    if (this.hasExport("mono_unity_g_free")) {
      this.native.mono_unity_g_free(ptr);
      return;
    }

    // Try g_free (older Mono builds)
    if (this.hasExport("g_free")) {
      this.native.g_free(ptr);
      return;
    }

    // No free function available - log warning once
    if (!this._warnedAboutMissingFree) {
      this._warnedAboutMissingFree = true;
      console.warn(
        "[frida-mono-bridge] No free function available (mono_free, mono_unity_g_free, g_free). " +
          "Memory allocated by Mono APIs will leak. This may be acceptable for short-lived scripts.",
      );
    }
  }

  /** Track whether we've warned about missing free function */
  private _warnedAboutMissingFree = false;

  // ============================================================================
  // EXPORT RESOLUTION AND MODULE ACCESS
  // ============================================================================

  /**
   * Check if a Mono export is available.
   * This method accepts any export name string and never throws.
   *
   * @param name Export name to check
   * @returns True if export exists, false otherwise
   */
  hasExport(name: MonoApiName | string): boolean {
    // First try to get the signature - if it doesn't exist, we can't resolve
    const signature = tryGetSignature(name);
    if (!signature) {
      // Unknown export name - try direct module lookup
      const moduleHandle = this.tryGetModuleHandle();
      if (!moduleHandle) {
        return false;
      }
      return moduleHandle.findExportByName(name) !== null;
    }
    return this.tryResolveAddress(name as MonoApiName, signature) !== null;
  }

  /**
   * Try to get a native function without throwing.
   * @returns NativeFunction if export found, null otherwise
   */
  tryGetNativeFunction(
    name: MonoApiName,
  ): NativeFunction<NativeFunctionReturnValue, NativeFunctionArgumentValue[]> | null {
    this.ensureNotDisposed();

    const cached = this.functionCache.get(name);
    if (cached) {
      return cached;
    }

    const address = this.tryResolveAddress(name);
    if (!address) {
      return null;
    }

    const signature = getSignature(name);
    const fn = new NativeFunction(
      address,
      signature.retType as NativeFunctionReturnType,
      signature.argTypes as NativeFunctionArgumentType[],
    );
    this.functionCache.set(name, fn);
    return fn;
  }

  /**
   * Get a native function, throwing if not found.
   * @throws {MonoExportNotFoundError} if export not found
   */
  getNativeFunction(name: MonoApiName): NativeFunction<NativeFunctionReturnValue, NativeFunctionArgumentValue[]> {
    this.ensureNotDisposed();

    return this.functionCache.getOrCreate(name, () => {
      const signature = getSignature(name);
      const address = this.resolveAddress(name, signature);
      return new NativeFunction(
        address,
        signature.retType as NativeFunctionReturnType,
        signature.argTypes as NativeFunctionArgumentType[],
      );
    });
  }

  /**
   * Try to resolve an export address without throwing.
   * @returns Address if found, null otherwise
   */
  tryResolveAddress(name: MonoApiName, signature: MonoExportSignature = getSignature(name)): NativePointer | null {
    this.ensureNotDisposed();

    const cached = this.addressCache.get(name);
    if (cached) {
      return cached;
    }

    const moduleHandle = this.tryGetModuleHandle();
    if (!moduleHandle) {
      return null;
    }

    const exportNames = [signature.name, ...(signature.aliases ?? [])];
    for (const exportName of exportNames) {
      const address = moduleHandle.findExportByName(exportName);
      if (address) {
        this.addressCache.set(name, address);
        return address;
      }
    }

    return null;
  }

  /**
   * Resolve an export address, throwing if not found.
   * @throws {MonoExportNotFoundError} if export not found
   */
  resolveAddress(name: MonoApiName, signature: MonoExportSignature = getSignature(name)): NativePointer {
    const address = this.tryResolveAddress(name, signature);
    if (address) {
      return address;
    }

    raise(
      MonoErrorCodes.EXPORT_NOT_FOUND,
      `Unable to resolve Mono export ${signature.name} in ${this.module.name}`,
      "Consider adding an alias in manual.ts",
    );
  }

  /**
   * Get the resolved address for an export by name.
   *
   * @param name Export name
   * @returns Resolved address or null if not found
   */
  getExportAddress(name: MonoApiName): NativePointer | null {
    return this.tryResolveAddress(name);
  }

  /**
   * Try to get the module handle without throwing.
   * @returns Module if found, null otherwise
   */
  tryGetModuleHandle(): Module | null {
    if (this.moduleHandle) {
      return this.moduleHandle;
    }

    const handle = Process.findModuleByName(this.module.name);
    if (handle === null) {
      return null;
    }
    this.moduleHandle = handle;
    return handle;
  }

  /**
   * Get the module handle, throwing if not loaded.
   * @returns Module handle
   * @throws {MonoModuleNotFoundError} if module not loaded
   */
  getModuleHandle(): Module {
    const handle = this.tryGetModuleHandle();
    if (handle) {
      return handle;
    }

    raise(
      MonoErrorCodes.MODULE_NOT_FOUND,
      `Module ${this.module.name} is not loaded in the current process`,
      "Ensure the Mono runtime has been initialized and the module is loaded",
    );
  }

  // ============================================================================
  // INTERNAL IMPLEMENTATION
  // ============================================================================

  /**
   * Create native bindings with automatic thread management.
   * Uses lazy property getters to initialize functions on first access.
   */
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
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize arguments for native function calls.
 * Converts null/undefined to NULL pointer and booleans to integers.
 */
function normalizeArg(arg: MonoArg): any {
  if (arg === null || arg === undefined) {
    return NULL;
  }
  if (typeof arg === "boolean") {
    return arg ? 1 : 0;
  }
  return arg;
}

/**
 * Create a new MonoApi instance for the given module.
 *
 * @param module Module information for the Mono runtime
 * @returns Configured MonoApi instance
 *
 * @example
 * ```typescript
 * const moduleInfo = { name: 'mono.dll', base: moduleBase };
 * const api = createMonoApi(moduleInfo);
 * await api.waitForRootDomainReady(30000);
 * ```
 */
export function createMonoApi(module: MonoModuleInfo): MonoApi {
  return new MonoApi(module);
}

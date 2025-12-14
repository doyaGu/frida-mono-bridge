/**
 * Global Mono namespace - Main entry point for frida-mono-bridge
 */

import { MonoArray } from "./model/array";
import type { MonoClass } from "./model/class";
import { MonoDomain } from "./model/domain";
import { MonoImage } from "./model/image";
import { MonoMethod } from "./model/method";
import { MonoString } from "./model/string";
import { createMonoApi, MonoApi } from "./runtime/api";
import { ALL_MONO_EXPORTS } from "./runtime/exports";
import { GCHandle } from "./runtime/gchandle";
import { MonoModuleInfo, waitForMonoModule } from "./runtime/module";
import { ThreadManager } from "./runtime/thread";
import { MonoRuntimeVersion } from "./runtime/version";
import { MonoErrorCodes, MonoInitializationError, raise } from "./utils/errors";

import { createMemorySubsystem } from "./runtime/memory";

// Import utilities
import * as Find from "./utils/find";
import { GCUtilities } from "./utils/gc";
import * as Trace from "./utils/trace";

/**
 * Main Mono namespace
 * This is the primary entry point for all Mono runtime interactions
 */
export class MonoNamespace {
  private _module: MonoModuleInfo | null = null;
  private _api: MonoApi | null = null;
  private _domain: MonoDomain | null = null;
  private _version: MonoRuntimeVersion | null = null;
  private _gcUtils: GCUtilities | null = null;
  private _exports: MonoNamespace.Exports | null = null;
  private _memory: MonoNamespace.Memory | null = null;
  private _initialized = false;
  private _initializing: Promise<boolean> | null = null;
  private _unloadHookInstalled = false;

  /**
   * Minimal facade helpers.
   * These intentionally wrap internal model statics so consumers/tests don't
   * need to import from src/model/*.
   */
  readonly array = {
    new: <T = any>(elementClass: MonoClass, length: number): MonoArray<T> => {
      return MonoArray.new(this.api, elementClass, length);
    },
  };

  readonly string = {
    new: (value: string): MonoString => {
      return MonoString.new(this.api, value);
    },
  };

  readonly method = {
    find: (image: MonoImage, descriptor: string): MonoMethod => {
      return MonoMethod.find(this.api, image, descriptor);
    },
  };

  readonly image = {
    fromAssemblyPath: (path: string, domain: MonoDomain = this.domain): MonoImage => {
      return MonoImage.fromAssemblyPath(this.api, path, domain);
    },
  };

  /**
   * Runtime configuration.
   * Values are mutable and read at initialization time.
   */
  readonly config: MonoNamespace.Config = {
    moduleName: undefined,
    exports: undefined,
    initializeTimeoutMs: 30_000,
    warnAfterMs: 10_000,
    installGlobal: true,
    logLevel: "info",
    performMode: "bind",
  };

  /**
   * Execute code with guaranteed thread attachment and runtime initialization
   * This is the recommended way to interact with the Mono runtime
   *
   * @param callback Function to execute with Mono runtime ready
   * @returns Result of the callback
   *
   * @example
   * Mono.perform(() => {
   *   const Player = Mono.domain.class("Game.Player");
   *   console.log(Player.methods.map(m => m.name));
   * });
   */
  /**
   * Execute code with guaranteed thread attachment and runtime initialization.
   * This is the **only recommended way** to interact with the Mono runtime.
   *
   * Thread attachment is owned by `perform()`, not by `initialize()`.
   *
   * @param callback Function to execute with Mono runtime ready and thread attached
   * @param mode Thread detachment strategy:
   *   - `"bind"` (default): Installs unload cleanup hook; thread stays attached until script unload
   *   - `"free"`: Detaches thread after callback completes (if attached by this call)
   *   - `"leak"`: Never detaches; caller takes full responsibility
   * @returns Result of the callback
   *
   * @example
   * await Mono.perform(() => {
   *   const Player = Mono.domain.class("Game.Player");
   *   console.log(Player.methods.map(m => m.name));
   * });
   */
  async perform<T>(
    callback: () => T | Promise<T>,
    mode: MonoNamespace.PerformMode = this.config.performMode,
  ): Promise<T> {
    // Step 1: Ensure runtime is ready (module loaded, root domain available)
    await this.initialize();

    if (!this._api) {
      throw new MonoInitializationError("Mono API not initialized");
    }

    const threadManager = this._api._threadManager;

    // Step 2: Check if thread is already attached (either by bridge or externally)
    const wasAlreadyAttached = threadManager.isAttached();
    let attachedByBridge = false;

    // Step 3: Attach thread if not already attached
    if (!wasAlreadyAttached) {
      threadManager.ensureAttached();
      attachedByBridge = true;
      // Mark this thread as bridge-owned for proper cleanup tracking
      threadManager.markBridgeOwned();
    }

    // Step 4: Handle mode-specific setup
    // "bind" mode: Always install unload cleanup (regardless of who attached)
    // This ensures cleanup happens on script unload even for pre-attached threads
    if (mode === "bind") {
      this.installUnloadCleanup();
    }

    try {
      // Step 5: Execute callback with thread in active attachment context
      const result = await threadManager.runAsync(async () => {
        const value = callback();
        return value instanceof Promise ? await value : value;
      });
      return result;
    } catch (error: any) {
      // Rethrow on next tick to preserve visibility in Frida.
      Script.nextTick(_ => {
        throw _;
      }, error);
      return Promise.reject<T>(error);
    } finally {
      // Step 6: Handle mode-specific cleanup
      if (mode === "free" && attachedByBridge) {
        // Only detach if we (the bridge) attached this thread.
        // Best-effort: detaching current thread mid-execution can be unsafe.
        // Consumers should prefer mode="bind" for safety.
        try {
          threadManager.detachBridgeOwned();
        } catch {
          // Ignore detach failures - this is best-effort
        }
      }
      // "leak" mode: intentionally do nothing - thread stays attached forever
    }
  }

  /**
   * Initializes the Mono runtime, waiting for the module and root domain to become ready.
   */
  /**
   * Initializes the Mono runtime, waiting for the module and root domain to become ready.
   *
   * **Important**: This method only waits for module discovery and runtime readiness.
   * It does NOT attach the current thread. Use `Mono.perform()` for thread-safe operations.
   *
   * @param _blocking Reserved for future use
   * @returns `true` if initialization was performed, `false` if already initialized
   */
  async initialize(_blocking = false): Promise<boolean> {
    if (this._initialized) {
      return false;
    }

    if (this._initializing) {
      return await this._initializing;
    }

    this._initializing = (async () => {
      const moduleInfo = await waitForMonoModule({
        moduleName: this.config.moduleName,
        timeoutMs: this.config.initializeTimeoutMs,
        warnAfterMs: this.config.warnAfterMs,
      });

      this._module = moduleInfo;
      this._api = createMonoApi(this._module);

      // Initialize thread manager
      this._api._threadManager = new ThreadManager(this._api);

      // Wait for runtime readiness (root domain available).
      // NOTE: Thread attachment is NOT done here - that's perform()'s responsibility.
      await this._api.waitForRootDomainReady(this.config.initializeTimeoutMs, this.config.warnAfterMs);

      this._initialized = true;
      return true;
    })()
      .catch(error => {
        this._module = null;
        this._api = null;
        this._domain = null;
        this._version = null;
        this._gcUtils = null;
        this._initialized = false;
        throw error instanceof Error
          ? new MonoInitializationError(`Failed to initialize Mono runtime: ${error.message}`, error)
          : new MonoInitializationError(`Failed to initialize Mono runtime: ${String(error)}`);
      })
      .finally(() => {
        this._initializing = null;
      });

    return await this._initializing;
  }

  /**
   * Get the current application domain
   * All assemblies, classes, and types are accessed through the domain
   */
  get domain(): MonoDomain {
    this.ensureInitializedSync();

    if (!this._domain) {
      const domainPtr = this._api!.getRootDomain();
      this._domain = new MonoDomain(this._api!, domainPtr);
    }

    return this._domain;
  }

  /**
   * Get the Mono runtime API
   * @internal Lower-level API access
   */
  get api(): MonoApi {
    this.ensureInitializedSync();
    return this._api!;
  }

  /**
   * Get the Mono module information
   */
  get module(): MonoModuleInfo {
    this.ensureInitializedSync();
    return this._module!;
  }

  /**
   * Get resolved native exports with user alias support.
   * Supports `Mono.config.exports` override: user > built-in aliases > default names.
   *
   * @example
   * ```typescript
   * // Check if an export is available
   * const rootDomain = Mono.exports.mono_get_root_domain;
   * if (rootDomain) {
   *   console.log(`mono_get_root_domain @ ${rootDomain}`);
   * }
   *
   * // Get all available exports
   * console.log(Object.keys(Mono.exports));
   * ```
   */
  get exports(): MonoNamespace.Exports {
    this.ensureInitializedSync();

    if (!this._exports) {
      this._exports = this.buildExportsProxy();
    }
    return this._exports;
  }

  /**
   * Memory utilities for reading/writing managed objects.
   * Provides boxing/unboxing, string/array creation, and direct memory access.
   *
   * @example
   * ```typescript
   * // Create a managed string
   * const str = Mono.memory.string("Hello");
   *
   * // Box a primitive value
   * const boxed = Mono.memory.box(42, intClass);
   *
   * // Read/write memory
   * const value = Mono.memory.read(ptr, "int32");
   * Mono.memory.write(ptr, 100, "int32");
   * ```
   */
  get memory(): MonoNamespace.Memory {
    this.ensureInitializedSync();

    if (!this._memory) {
      this._memory = this.buildMemorySubsystem();
    }
    return this._memory;
  }

  /**
   * Get Mono runtime version information
   */
  get version(): MonoRuntimeVersion {
    this.ensureInitializedSync();

    if (!this._version) {
      this._version = MonoRuntimeVersion.fromApi(this._api!);
    }

    return this._version;
  }

  /**
   * GC utilities for garbage collection and object lifetime management
   */
  get gc(): MonoNamespace.GC {
    this.ensureInitializedSync();

    if (!this._gcUtils) {
      this._gcUtils = new GCUtilities(this._api!);
    }

    const gcUtils = this._gcUtils;

    // Return GC utilities object
    return {
      /**
       * Force a garbage collection
       * @param generation GC generation to collect (0-2, or -1 for all)
       */
      collect: (generation = -1) => gcUtils.collect(generation),

      /**
       * Get the maximum GC generation
       */
      get maxGeneration() {
        return gcUtils.maxGeneration;
      },

      /**
       * Create a GC handle for an object (prevents garbage collection)
       */
      handle: (obj: NativePointer, pinned = false) => gcUtils.handle(obj, pinned),

      /**
       * Create a weak GC handle (allows garbage collection)
       */
      weakHandle: (obj: NativePointer, trackResurrection = false) => gcUtils.weakHandle(obj, trackResurrection),

      /**
       * Release a specific GC handle
       */
      releaseHandle: (handle: GCHandle) => gcUtils.releaseHandle(handle),

      /**
       * Release all GC handles
       */
      releaseAll: () => gcUtils.releaseAll(),

      /**
       * Get current memory statistics
       */
      get stats() {
        return gcUtils.getMemoryStats();
      },

      /**
       * Get current memory statistics (alias)
       */
      getMemoryStats: () => gcUtils.getMemoryStats(),

      /**
       * Get the number of active GC handles
       */
      getActiveHandleCount: () => gcUtils.getActiveHandleCount(),

      /**
       * Get statistics for each GC generation
       */
      getGenerationStats: () => gcUtils.getGenerationStats(),

      /**
       * Get a formatted memory summary string
       */
      getMemorySummary: () => gcUtils.getMemorySummary(),

      /**
       * Check if a weak handle's target has been collected
       */
      isCollected: (handle: GCHandle) => gcUtils.isCollected(handle),

      /**
       * Perform a full GC and return memory delta
       * Useful for identifying memory leaks
       */
      collectAndReport: () => gcUtils.collectAndReport(),

      /**
       * Check the finalization queue status
       */
      getFinalizationQueueInfo: () => gcUtils.getFinalizationQueueInfo(),

      /**
       * Request finalization to run (if available)
       */
      requestFinalization: () => gcUtils.requestFinalization(),

      /**
       * Wait for pending finalizers (if supported)
       * @param timeout Maximum time to wait in milliseconds (0 = no wait, -1 = infinite)
       */
      waitForPendingFinalizers: (timeout = 0) => gcUtils.waitForPendingFinalizers(timeout),

      /**
       * Suppress finalization for an object (if supported)
       * @param objectPtr Pointer to the managed object
       */
      suppressFinalize: (objectPtr: NativePointer) => gcUtils.suppressFinalize(objectPtr),
    };
  }

  /**
   * Search utilities for finding classes, methods, fields
   *
   * @example
   * // Find all Player classes
   * const players = Mono.find.classes("*Player*");
   *
   * // Find methods by pattern
   * const attacks = Mono.find.methods("*Attack*");
   */
  get find(): MonoNamespace.Find {
    this.ensureInitializedSync();
    const api = this._api!;

    return {
      /**
       * Find classes by name pattern
       * @param pattern Wildcard pattern (* for any, ? for single char) or regex
       * @param options Search options (regex mode, case sensitivity, limit)
       */
      classes: (pattern: string, options?: Find.FindOptions) => Find.classes(api, pattern, options),

      /**
       * Find methods by name pattern
       * @param pattern Wildcard pattern or regex
       * @param options Search options
       */
      methods: (pattern: string, options?: Find.FindOptions) => Find.methods(api, pattern, options),

      /**
       * Find fields by name pattern
       * @param pattern Wildcard pattern or regex
       * @param options Search options
       */
      fields: (pattern: string, options?: Find.FindOptions) => Find.fields(api, pattern, options),

      /**
       * Find properties by name pattern
       * @param pattern Wildcard pattern or regex
       * @param options Search options
       */
      properties: (pattern: string, options?: Find.FindOptions) => Find.properties(api, pattern, options),

      /**
       * Find a class by exact full name (namespace.class)
       * @param fullName Exact full class name
       */
      classExact: (fullName: string) => Find.classExact(api, fullName),
    };
  }

  /**
   * Tracing utilities for method interception
   *
   * @example
   * // Hook a method
   * const detach = Mono.trace.method(myMethod, {
   *   onEnter(args) { console.log("called"); }
   * });
   *
   * // Hook all methods in a class
   * const detach = Mono.trace.classAll(myClass, callbacks);
   */
  get trace(): MonoNamespace.Trace {
    this.ensureInitializedSync();
    const api = this._api!;

    return {
      /**
       * Hook a single method
       * @throws if method cannot be compiled (not yet JIT-compiled, abstract, etc.)
       */
      method: Trace.method,

      /**
       * Try to hook a method, returning null on failure
       * Safer alternative that doesn't throw on non-JIT-compiled methods
       */
      tryMethod: Trace.tryMethod,

      /**
       * Hook a method with extended context access (InvocationContext)
       */
      methodExtended: Trace.methodExtended,

      /**
       * Try to hook with extended context, returning null on failure
       */
      tryMethodExtended: Trace.tryMethodExtended,

      /**
       * Hook all methods in a class
       */
      classAll: Trace.classAll,

      /**
       * Hook methods by pattern
       * @param pattern Wildcard pattern for method names
       */
      methodsByPattern: (pattern: string, callbacks: Trace.MethodCallbacks) =>
        Trace.methodsByPattern(api, pattern, callbacks),

      /**
       * Replace a method's return value
       */
      replaceReturnValue: Trace.replaceReturnValue,

      /**
       * Try to replace return value, returning null on failure
       */
      tryReplaceReturnValue: Trace.tryReplaceReturnValue,
    };
  }

  /**
   * Ensure the runtime is initialized, auto-triggering initialize() if needed.
   *
   * @internal Called automatically when accessing core getters
   * @throws {MonoInitializationError} if initialization fails
   */
  private ensureInitializedSync(): void {
    if (this._initialized) {
      return;
    }
    // Auto-trigger initialization
    // Note: This creates a blocking initialization for sync getter access.
    // Users should prefer `await Mono.perform(...)` for proper async flow.
    if (!this._initializing) {
      // Fire-and-forget initialization, then throw telling user to await
      this.initialize().catch(() => {
        /* handled by initialize() itself */
      });
    }
    raise(
      MonoErrorCodes.RUNTIME_NOT_READY,
      "Mono runtime is initializing",
      "Use `await Mono.perform(...)` or `await Mono.initialize()` before accessing Mono properties synchronously",
    );
  }

  /**
   * Async version of ensureInitialized - waits for initialization to complete.
   * Core getters use this when accessed after initialize() has been awaited.
   * @internal
   */
  private async ensureInitializedAsync(): Promise<void> {
    if (this._initialized) {
      return;
    }
    await this.initialize();
  }

  /**
   * Build the exports proxy object with user config override support.
   * Priority: Mono.config.exports > built-in aliases > default export name
   * @internal
   */
  private buildExportsProxy(): MonoNamespace.Exports {
    const api = this._api!;
    const moduleInfo = this._module!;
    const userOverrides = this.config.exports ?? {};
    const moduleHandle = Process.findModuleByName(moduleInfo.name);

    const resolvedExports: Record<string, NativePointer | null> = {};

    // Build exports map with override support
    for (const exportName of ALL_MONO_EXPORTS) {
      // Check user override first
      const userAlias = userOverrides[exportName];
      if (userAlias && moduleHandle) {
        const aliases = Array.isArray(userAlias) ? userAlias : [userAlias];
        let resolved: NativePointer | null = null;
        for (const alias of aliases) {
          const addr = moduleHandle.findExportByName(alias);
          if (addr && !addr.isNull()) {
            resolved = addr;
            break;
          }
        }
        resolvedExports[exportName] = resolved;
      } else {
        // Use api's resolution (includes built-in aliases)
        try {
          const addr = api.getExportAddress(exportName);
          resolvedExports[exportName] = addr;
        } catch {
          resolvedExports[exportName] = null;
        }
      }
    }

    return resolvedExports as MonoNamespace.Exports;
  }

  /**
   * Build the memory subsystem with unified read/write/box/unbox/string/array support.
   * All memory operations delegate to type.ts for consistency.
   * @internal
   */
  private buildMemorySubsystem(): MonoNamespace.Memory {
    return createMemorySubsystem(this._api!);
  }

  private installUnloadCleanup(): void {
    if (this._unloadHookInstalled) {
      return;
    }
    this._unloadHookInstalled = true;

    // Best-effort cleanup aligned with Mono.perform(flag="bind").
    try {
      if (typeof (Script as any)?.bindWeak === "function") {
        Script.bindWeak(globalThis, () => {
          try {
            this.dispose();
          } catch {
            // ignore
          }
        });
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clean up resources
   * Should be called when done with the Mono runtime
   */
  dispose(): void {
    if (this._api) {
      this._api.dispose();
    }

    if (this._gcUtils) {
      this._gcUtils.releaseAll();
    }

    this._initialized = false;
    this._initializing = null;
    this._module = null;
    this._api = null;
    this._domain = null;
    this._version = null;
    this._gcUtils = null;
    this._exports = null;
    this._memory = null;
  }

  /**
   * Attach the current thread to the Mono runtime
   * Usually not needed - use perform() instead
   * @returns Native pointer to the attached thread
   */
  ensureThreadAttached(): NativePointer {
    this.ensureInitializedSync();
    return this._api!._threadManager.ensureAttached();
  }

  /**
   * Safely detach the current thread if it is exiting.
   * Uses mono_thread_detach_if_exiting which only detaches when the thread
   * is running pthread destructors. Safe to call at any time.
   * @returns True if the thread was detached, false otherwise
   */
  detachIfExiting(): boolean {
    if (!this._api) {
      return false;
    }
    return this._api._threadManager.detachIfExiting();
  }

  /**
   * Detach all threads from the Mono runtime.
   *
   * WARNING: This should only be called during cleanup/disposal.
   * The current thread uses a safe detach mechanism (detachIfExiting).
   */
  detachAllThreads(): void {
    if (this._api) {
      this._api._threadManager.detachAll();
    }
  }
}

// ============================================================================
// NAMESPACE TYPES
// ============================================================================

export namespace MonoNamespace {
  export type PerformMode = "bind" | "free" | "leak";

  export interface Config {
    moduleName?: string | string[];
    exports?: Record<string, string | string[]>;
    initializeTimeoutMs: number;
    warnAfterMs: number;
    installGlobal: boolean;
    logLevel: "silent" | "error" | "warn" | "info" | "debug";
    performMode: PerformMode;
  }

  /**
   * GC subsystem interface
   */
  export interface GC {
    collect(generation?: number): void;
    readonly maxGeneration: number;
    handle(obj: NativePointer, pinned?: boolean): import("./runtime/gchandle").GCHandle;
    weakHandle(obj: NativePointer, trackResurrection?: boolean): import("./runtime/gchandle").GCHandle;
    releaseHandle(handle: import("./runtime/gchandle").GCHandle): void;
    releaseAll(): void;
    readonly stats: import("./utils/gc").MemoryStats;
    getMemoryStats(): import("./utils/gc").MemoryStats;
    getActiveHandleCount(): number;
    getGenerationStats(): import("./utils/gc").GenerationStats[];
    getMemorySummary(): string;
    isCollected(handle: import("./runtime/gchandle").GCHandle): boolean;
    collectAndReport(): {
      before: import("./utils/gc").MemoryStats;
      after: import("./utils/gc").MemoryStats;
      delta: number | null;
    };
    getFinalizationQueueInfo(): { available: boolean; pendingCount: number | null; message: string };
    requestFinalization(): boolean;
    waitForPendingFinalizers(timeout?: number): boolean;
    suppressFinalize(objectPtr: NativePointer): boolean;
  }

  /**
   * Memory type identifiers for simple read/write operations
   */
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

  /**
   * Options for typed read operations
   */
  export interface TypedReadOptions {
    /** Return Int64/UInt64 as bigint instead of number */
    returnBigInt?: boolean;
    /** Return raw wrapper objects (MonoString, MonoArray) instead of coerced JS values */
    returnRaw?: boolean;
  }

  /**
   * Exports subsystem interface - provides access to resolved native exports
   */
  export type Exports = {
    [K in import("./runtime/exports").MonoApiName]: NativePointer | null;
  };

  /**
   * Memory subsystem interface for managed object manipulation.
   * Provides unified read/write for primitives, value types, strings, arrays, delegates, etc.
   */
  export interface Memory {
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
     * @param type Simple type name (int8, uint8, etc.)
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
    box(
      value: number | boolean | bigint,
      klass: import("./model/class").MonoClass,
    ): import("./model/object").MonoObject;

    /**
     * Box a value type into a managed object.
     * @param valuePtr Pointer to the value type data
     * @param klass The value type class
     */
    boxValueType(
      valuePtr: NativePointer,
      klass: import("./model/class").MonoClass,
    ): import("./model/object").MonoObject;

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
    array<T = any>(
      elementClass: import("./model/class").MonoClass,
      length: number,
    ): import("./model/array").MonoArray<T>;

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

  /**
   * Find/search subsystem interface
   */
  export interface Find {
    classes(pattern: string, options?: import("./utils/find").FindOptions): import("./model/class").MonoClass[];
    methods(pattern: string, options?: import("./utils/find").FindOptions): import("./model/method").MonoMethod[];
    fields(pattern: string, options?: import("./utils/find").FindOptions): import("./model/field").MonoField[];
    properties(
      pattern: string,
      options?: import("./utils/find").FindOptions,
    ): import("./model/property").MonoProperty[];
    classExact(fullName: string): import("./model/class").MonoClass | null;
  }

  /**
   * Trace/hook subsystem interface
   */
  export interface Trace {
    method(
      monoMethod: import("./model/method").MonoMethod,
      callbacks: import("./utils/trace").MethodCallbacks,
    ): () => void;
    tryMethod(
      monoMethod: import("./model/method").MonoMethod,
      callbacks: import("./utils/trace").MethodCallbacks,
    ): (() => void) | null;
    methodExtended(
      monoMethod: import("./model/method").MonoMethod,
      callbacks: import("./utils/trace").MethodCallbacksExtended,
    ): () => void;
    tryMethodExtended(
      monoMethod: import("./model/method").MonoMethod,
      callbacks: import("./utils/trace").MethodCallbacksExtended,
    ): (() => void) | null;
    classAll(klass: import("./model/class").MonoClass, callbacks: import("./utils/trace").MethodCallbacks): () => void;
    methodsByPattern(pattern: string, callbacks: import("./utils/trace").MethodCallbacks): () => void;
    replaceReturnValue(
      monoMethod: import("./model/method").MonoMethod,
      replacement: (
        originalRetval: NativePointer,
        thisPtr: NativePointer,
        args: NativePointer[],
      ) => NativePointer | void,
    ): () => void;
    tryReplaceReturnValue(
      monoMethod: import("./model/method").MonoMethod,
      replacement: (
        originalRetval: NativePointer,
        thisPtr: NativePointer,
        args: NativePointer[],
      ) => NativePointer | void,
    ): (() => void) | null;
  }
}

/**
 * Global Mono instance
 * Use this as the main entry point for all Mono operations
 *
 * @example
 * import { Mono } from "frida-mono-bridge";
 *
 * await Mono.perform(() => {
 *   const assemblies = Mono.domain.assemblies;
 *   assemblies.forEach(a => console.log(a.name));
 * });
 */
export const Mono = new MonoNamespace();

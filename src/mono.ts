/**
 * Global Mono namespace - Main entry point for frida-mono-bridge
 *
 * This module provides the unified Mono facade for all runtime interactions.
 * All functionality is accessed through the `Mono` singleton instance.
 *
 * @module mono
 *
 * @example
 * ```typescript
 * import { Mono } from "frida-mono-bridge";
 *
 * await Mono.perform(() => {
 *   // Access domain and assemblies
 *   const assemblies = Mono.domain.assemblies;
 *
 *   // Find classes
 *   const Player = Mono.domain.tryClass("Game.Player");
 *
 *   // Hook methods
 *   Mono.trace.method(Player.method("Update"), {
 *     onEnter() { console.log("Player.Update called"); }
 *   });
 * });
 * ```
 */

import { MonoArray } from "./model/array";
import { MonoAssembly } from "./model/assembly";
import { MonoClass } from "./model/class";
import { MonoDelegate } from "./model/delegate";
import { MonoDomain } from "./model/domain";
import { MonoField } from "./model/field";
import { MonoImage } from "./model/image";
import { MonoMethod } from "./model/method";
import { MonoObject } from "./model/object";
import { MonoProperty } from "./model/property";
import { MonoString } from "./model/string";
import { MonoType } from "./model/type";
import type { MonoApi } from "./runtime/api";
import { createMonoApi } from "./runtime/api";
import { MonoModuleInfo, waitForMonoModule } from "./runtime/module";
import { ThreadManager } from "./runtime/thread";
import { MonoRuntimeVersion } from "./runtime/version";
import { handleMonoError, MonoErrorCodes, raise, raiseFrom } from "./utils/errors";

import { buildGCSubsystem, buildICallSubsystem, buildMemorySubsystem, buildTraceSubsystem } from "./subsystems";

// Import domain objects from model
import { GarbageCollector } from "./model/gc";
import { Tracer } from "./model/trace";

// Import internal call registrar
import { createInternalCallRegistrar, type InternalCallRegistrar } from "./model/internal-call";

/**
 * Primary entry point for all Mono runtime interactions.
 *
 * Most consumers should only interact with the exported `Mono` singleton.
 *
 * Thread-safety and lifecycle:
 * - Use `await Mono.perform(...)` for almost all operations; it guarantees
 *   runtime readiness and a thread attachment context.
 * - `Mono.initialize()` only waits for module discovery + root domain readiness.
 *   It does NOT attach the current thread.
 * - Accessing getters synchronously before initialization completes will throw
 *   a `MonoError` with code `RUNTIME_NOT_READY`.
 *
 * Global installation:
 * - By default, `Mono` is assigned to `globalThis.Mono` on first initialization.
 *   Disable via `Mono.config.installGlobal = false`.
 *
 * @example
 * ```typescript
 * import { Mono } from "frida-mono-bridge";
 *
 * await Mono.perform(() => {
 *   const klass = Mono.domain.tryClass("Game.Player");
 *   if (!klass) return;
 *
 *   Mono.trace.classAll(klass, {
 *     onEnter(method) {
 *       console.log("enter", method.name);
 *     },
 *   });
 * });
 * ```
 */
export class MonoNamespace {
  // ============================================================================
  // PRIVATE STATE
  // ============================================================================

  // Core runtime state
  private _module: MonoModuleInfo | null = null;
  private _api: MonoApi | null = null;
  private _domain: MonoDomain | null = null;
  private _version: MonoRuntimeVersion | null = null;
  private _initialized = false;
  private _initializing: Promise<boolean> | null = null;
  private _unloadHookInstalled = false;
  private _globalInstalled = false;

  // Subsystem caches
  private _gc: GarbageCollector | null = null;
  private _tracer: Tracer | null = null;
  private _icallRegistrar: InternalCallRegistrar | null = null;
  private _memory: MonoNamespace.Memory | null = null;
  private _traceSubsystem: MonoNamespace.Trace | null = null;
  private _gcSubsystem: MonoNamespace.GC | null = null;
  private _icall: MonoNamespace.ICall | null = null;

  // ============================================================================
  // FACADE HELPERS
  // ============================================================================

  /**
   * Facade helpers wrap internal model statics for convenience.
   * Consumers don't need to import from src/model/*.
   *
   * These provide factory methods for creating managed objects and
   * performing common operations without direct model imports.
   */

  /**
   * Array creation and utilities.
   * @example
   * ```typescript
   * const intArray = Mono.array.new(intClass, 10);
   * ```
   */
  readonly array = {
    /** Create a new managed array */
    new: <T = any>(elementClass: MonoClass, length: number): MonoArray<T> => {
      return MonoArray.new(this.api, elementClass, length);
    },

    /** Wrap an existing array pointer */
    wrap: <T = any>(ptr: NativePointer): MonoArray<T> => {
      return new MonoArray<T>(this.api, ptr);
    },

    /** Try to wrap an existing array pointer */
    tryWrap: <T = any>(ptr: NativePointer | null | undefined): MonoArray<T> | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoArray<T>(this.api, ptr);
    },
  };

  /**
   * String creation and utilities.
   * @example
   * ```typescript
   * const str = Mono.string.new("Hello, World!");
   * ```
   */
  readonly string = {
    /** Create a new managed string */
    new: (value: string): MonoString => {
      return MonoString.new(this.api, value);
    },

    /** Wrap an existing string pointer */
    wrap: (ptr: NativePointer): MonoString => {
      return new MonoString(this.api, ptr);
    },

    /** Try to wrap an existing string pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoString | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoString(this.api, ptr);
    },
  };

  /**
   * Object creation and utilities.
   * @example
   * ```typescript
   * const obj = Mono.object.wrap(ptr);
   * const klassObj = domain.class("MyClass").newInstance();
   * ```
   */
  readonly object = {
    /** Wrap an existing native pointer as MonoObject */
    wrap: (ptr: NativePointer): MonoObject => {
      return new MonoObject(this.api, ptr);
    },

    /** Try to wrap an existing object pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoObject | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoObject(this.api, ptr);
    },
  };

  /**
   * Delegate creation and utilities.
   * @example
   * ```typescript
   * const del = Mono.delegate.new(delegateClass, instance, method);
   * ```
   */
  readonly delegate = {
    /** Create a delegate from a method */
    new: (delegateClass: MonoClass, target: MonoObject | null, method: MonoMethod): MonoDelegate => {
      return MonoDelegate.new(this.api, delegateClass, target, method);
    },
    /** Wrap an existing delegate pointer */
    wrap: (ptr: NativePointer): MonoDelegate => {
      return new MonoDelegate(this.api, ptr);
    },

    /** Try to wrap an existing delegate pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoDelegate | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoDelegate(this.api, ptr);
    },
  };

  /**
   * Method lookup and utilities.
   * @example
   * ```typescript
   * const method = Mono.method.find(image, "MyClass:MyMethod(int)");
   * ```
   */
  readonly method = {
    /** Find a method by descriptor */
    find: (image: MonoImage, descriptor: string): MonoMethod => {
      return MonoMethod.find(this.api, image, descriptor);
    },
    /** Try to find a method, returns null if not found */
    tryFind: (image: MonoImage, descriptor: string): MonoMethod | null => {
      return MonoMethod.tryFind(this.api, image, descriptor);
    },

    /** Wrap an existing method pointer */
    wrap: (ptr: NativePointer): MonoMethod => {
      return new MonoMethod(this.api, ptr);
    },

    /** Try to wrap an existing method pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoMethod | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoMethod(this.api, ptr);
    },
  };

  /**
   * Image/Assembly loading and utilities.
   * @example
   * ```typescript
   * const image = Mono.image.fromAssemblyPath("MyAssembly.dll");
   * ```
   */
  readonly image = {
    /** Load an image from assembly path */
    fromAssemblyPath: (path: string, domain: MonoDomain = this.domain): MonoImage => {
      return MonoImage.fromAssemblyPath(this.api, path, domain);
    },

    /** Wrap an existing image pointer */
    wrap: (ptr: NativePointer): MonoImage => {
      return new MonoImage(this.api, ptr);
    },

    /** Try to wrap an existing image pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoImage | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoImage(this.api, ptr);
    },
  };

  /**
   * Assembly loading and utilities.
   * @example
   * ```typescript
   * const asm = Mono.assembly.open("Assembly-CSharp");
   * const img = asm.image;
   * ```
   */
  readonly assembly = {
    /** Open/load an assembly in a domain */
    open: (nameOrPath: string, domain: MonoDomain = this.domain): MonoAssembly => {
      return domain.assemblyOpen(nameOrPath);
    },

    /** Wrap an existing assembly pointer */
    wrap: (ptr: NativePointer): MonoAssembly => {
      return new MonoAssembly(this.api, ptr);
    },

    /** Try to wrap an existing assembly pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoAssembly | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoAssembly(this.api, ptr);
    },
  };

  /**
   * Class utilities.
   * @example
   * ```typescript
   * const klass = Mono.domain.class("Game.Player");
   * const wrapped = Mono.class.wrap(klass.pointer);
   * ```
   */
  readonly class = {
    /** Wrap an existing class pointer */
    wrap: (ptr: NativePointer): MonoClass => {
      return new MonoClass(this.api, ptr);
    },

    /** Try to wrap an existing class pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoClass | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoClass(this.api, ptr);
    },
  };

  /**
   * Field utilities.
   */
  readonly field = {
    /** Wrap an existing field pointer */
    wrap: <T = any>(ptr: NativePointer): MonoField<T> => {
      return new MonoField<T>(this.api, ptr);
    },

    /** Try to wrap an existing field pointer */
    tryWrap: <T = any>(ptr: NativePointer | null | undefined): MonoField<T> | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoField<T>(this.api, ptr);
    },
  };

  /**
   * Property utilities.
   */
  readonly property = {
    /** Wrap an existing property pointer */
    wrap: <TValue = any>(ptr: NativePointer): MonoProperty<TValue> => {
      return new MonoProperty<TValue>(this.api, ptr);
    },

    /** Try to wrap an existing property pointer */
    tryWrap: <TValue = any>(ptr: NativePointer | null | undefined): MonoProperty<TValue> | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoProperty<TValue>(this.api, ptr);
    },
  };

  /**
   * Type utilities and inspection.
   * @example
   * ```typescript
   * const type = Mono.type.fromClass(myClass);
   * console.log(type.fullName);
   * ```
   */
  readonly type = {
    /** Get MonoType from a class */
    fromClass: (klass: MonoClass): MonoType => {
      const typePtr = this.api.native.mono_class_get_type(klass.pointer);
      return new MonoType(this.api, typePtr);
    },
    /** Wrap an existing type pointer */
    wrap: (ptr: NativePointer): MonoType => {
      return new MonoType(this.api, ptr);
    },

    /** Try to wrap an existing type pointer */
    tryWrap: (ptr: NativePointer | null | undefined): MonoType | null => {
      if (!ptr || ptr.isNull()) {
        return null;
      }
      return new MonoType(this.api, ptr);
    },
  };

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  /**
   * Runtime configuration.
   * Values are mutable and read at initialization time.
   *
   * Note: Changing these values after initialization will not affect the already
   * initialized runtime unless you fully dispose and re-initialize.
   */
  readonly config: MonoNamespace.Config = {
    /**
     * Target Mono module name(s) to wait for.
     * If undefined, the bridge tries to auto-detect a Mono module.
     */
    moduleName: undefined,

    /** Maximum time to wait for module discovery + root domain readiness. */
    initializeTimeoutMs: 30_000,

    /** Emit a warning if initialization takes longer than this threshold. */
    warnAfterMs: 10_000,

    /** Whether to assign `globalThis.Mono = Mono` on first initialization. */
    installGlobal: true,

    /** Default log level used by internal components. */
    logLevel: "info",

    /** Default perform mode used by `perform()` when not specified. */
    performMode: "bind",

    /** Capacity of the internal UTF-8 string pointer cache. */
    utf8StringCacheCapacity: 256,

    /** Capacity of the pinned UTF-8 string cache. */
    pinnedStringCacheCapacity: 512,
  };

  // ============================================================================
  // PUBLIC API - CORE METHODS
  // ============================================================================

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
      raise(
        MonoErrorCodes.INIT_FAILED,
        "Mono API not initialized",
        "Call `await Mono.initialize()` or wrap your code in `await Mono.perform(...)`",
      );
    }

    const threadManager = this._api.getThreadManager()!;

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
        raiseFrom(_, MonoErrorCodes.UNKNOWN, "Unhandled error in Mono.perform callback");
      }, error);
      return Promise.reject<T>(handleMonoError(error));
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
   *
   * **Important**: This method only waits for module discovery and runtime readiness.
   * It does NOT attach the current thread. Use `Mono.perform()` for thread-safe operations.
   *
   * @param _blocking Reserved for future use
   * @returns `true` if initialization was performed, `false` if already initialized
   * @throws {MonoInitializationError} If module discovery or runtime readiness fails
   */
  async initialize(_blocking = false): Promise<boolean> {
    this.maybeInstallGlobal();

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
      this._api = createMonoApi(this._module, {
        utf8CacheCapacity: this.config.utf8StringCacheCapacity,
        pinnedStringCacheCapacity: this.config.pinnedStringCacheCapacity,
      });

      // Initialize thread manager
      this._api.setThreadManager(new ThreadManager(this._api));

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
        this._gc = null;
        this._tracer = null;
        this._initialized = false;
        const message =
          error instanceof Error
            ? `Failed to initialize Mono runtime: ${error.message}`
            : `Failed to initialize Mono runtime: ${String(error)}`;
        raiseFrom(error, MonoErrorCodes.INIT_FAILED, message);
      })
      .finally(() => {
        this._initializing = null;
      });

    return await this._initializing;
  }

  private maybeInstallGlobal(): void {
    if (this._globalInstalled) {
      return;
    }
    if (this.config.installGlobal === false) {
      return;
    }

    try {
      (globalThis as any).Mono = this;
      this._globalInstalled = true;
    } catch {
      // ignore
    }
  }

  // ============================================================================
  // PUBLIC API - GETTERS
  // ============================================================================

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
      this._memory = buildMemorySubsystem(this._api!);
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

    if (!this._gcSubsystem) {
      if (!this._gc) {
        this._gc = new GarbageCollector(this._api!);
      }
      this._gcSubsystem = buildGCSubsystem(this._gc);
    }

    return this._gcSubsystem;
  }

  /**
   * Tracing utilities for method interception
   */
  get trace(): MonoNamespace.Trace {
    this.ensureInitializedSync();

    if (!this._traceSubsystem) {
      if (!this._tracer) {
        this._tracer = new Tracer(this._api!);
      }
      this._traceSubsystem = buildTraceSubsystem(this._tracer);
    }

    return this._traceSubsystem;
  }

  /**
   * Internal call registration utilities.
   * Register native functions callable from managed code.
   */
  get icall(): MonoNamespace.ICall {
    this.ensureInitializedSync();

    if (!this._icall) {
      if (!this._icallRegistrar) {
        this._icallRegistrar = createInternalCallRegistrar(this._api!);
      }
      this._icall = buildICallSubsystem(this._icallRegistrar);
    }

    return this._icall;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Ensure the runtime is initialized, auto-triggering initialize() if needed.
   *
   * @internal Called automatically when accessing core getters
   * @throws {MonoRuntimeNotReadyError} If runtime is not ready yet
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
   * Build the memory subsystem with unified read/write/box/unbox/string/array support.
   * All memory operations delegate to type.ts for consistency.
   * @internal
   */

  /**
   * Installs best-effort cleanup on script unload.
   * Only used for `perform(mode="bind")`.
   */
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

  // ============================================================================
  // PUBLIC API - LIFECYCLE METHODS
  // ============================================================================

  /**
   * Clean up all resources and release all references.
   * Should be called when done with the Mono runtime.
   *
   * After calling dispose():
   * - All GC handles are released
   * - All caches are cleared
   * - All threads are detached
   * - Internal call registrar is cleared
   * - The instance cannot be reused without re-initialization
   *
   * @example
   * ```typescript
   * // When done with Mono
   * Mono.dispose();
   * ```
   */
  dispose(): void {
    // Dispose tracer (detaches all hooks)
    if (this._tracer) {
      this._tracer.dispose();
    }

    // Dispose GC (releases all handles)
    if (this._gc) {
      this._gc.dispose();
    }

    // Clear internal call registrar tracking
    if (this._icallRegistrar) {
      this._icallRegistrar.clear();
    }

    // Dispose API (detaches threads)
    if (this._api) {
      this._api.dispose();
    }

    // Clear all state
    this._initialized = false;
    this._initializing = null;
    this._unloadHookInstalled = false;

    // Clear core state
    this._module = null;
    this._api = null;
    this._domain = null;
    this._version = null;

    // Clear subsystem caches
    this._gc = null;
    this._tracer = null;
    this._icallRegistrar = null;
    this._memory = null;
    this._traceSubsystem = null;
    this._gcSubsystem = null;
    this._icall = null;
  }

  /**
   * Reset internal caches without full disposal.
   * Use this to free memory from cached data while keeping the runtime usable.
   *
   * Clears:
   * - API function and address caches
   * - Delegate thunk cache
   * - GC handles (releases all)
   * - All subsystem caches (memory, find, trace, gc, icall)
   *
   * Does NOT:
   * - Detach threads
   * - Reset initialization state
   * - Invalidate the runtime
   * - Clear internal call registrations (use icall.clear() for that)
   *
   * @example
   * ```typescript
   * // Clear caches to free memory, but keep runtime usable
   * Mono.reset();
   * ```
   */
  reset(): void {
    // Clear API caches but don't dispose
    if (this._api) {
      this._api.clearCaches();
    }

    // Detach all hooks
    if (this._tracer) {
      this._tracer.detachAll();
    }

    // Release all GC handles
    if (this._gc) {
      this._gc.releaseAllHandles();
    }

    // Clear all subsystem caches (will be rebuilt on next access)
    this._memory = null;
    this._traceSubsystem = null;
    this._gcSubsystem = null;
    this._icall = null;
  }

  // ============================================================================
  // PUBLIC API - THREAD MANAGEMENT
  // ============================================================================

  /**
   * Attach the current thread to the Mono runtime
   * Usually not needed - use perform() instead
   * @returns Native pointer to the attached thread
   * @throws {import("./utils/errors").MonoError} If runtime is not ready yet (RUNTIME_NOT_READY)
   */
  ensureThreadAttached(): NativePointer {
    this.ensureInitializedSync();
    return this._api!.getThreadManager()!.ensureAttached();
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
    return this._api.getThreadManager()?.detachIfExiting() ?? false;
  }

  /**
   * Detach all threads from the Mono runtime.
   *
   * WARNING: This should only be called during cleanup/disposal.
   * The current thread uses a safe detach mechanism (detachIfExiting).
   */
  detachAllThreads(): void {
    if (this._api) {
      this._api.getThreadManager()?.detachAll();
    }
  }

  // ============================================================================
  // SUBSYSTEM BUILDERS (Private)
  // ============================================================================
}

// ============================================================================
// NAMESPACE TYPES
// ============================================================================

export namespace MonoNamespace {
  export type PerformMode = import("./types").PerformMode;
  export type Config = import("./types").Config;
  export type GC = import("./types").GC;
  export type MemoryType = import("./types").MemoryType;
  export type TypedReadOptions = import("./types").TypedReadOptions;
  export type Memory = import("./types").MemorySubsystem;
  export type Trace = import("./types").Trace;
  export type ICall = import("./types").ICall;
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

/**
 * Type namespace for easier access to Mono types.
 *
 * This enables patterns like:
 * - `Mono.Config` (type)
 * - `Mono.GC` (type)
 * - `Mono.PerformMode` (type)
 */
export namespace Mono {
  /** See `MonoNamespace.PerformMode`. */
  export type PerformMode = MonoNamespace.PerformMode;

  /** See `MonoNamespace.Config`. */
  export type Config = MonoNamespace.Config;

  /** See `MonoNamespace.GC`. */
  export type GC = MonoNamespace.GC;

  /** See `MonoNamespace.MemoryType`. */
  export type MemoryType = MonoNamespace.MemoryType;

  /** See `MonoNamespace.TypedReadOptions`. */
  export type TypedReadOptions = MonoNamespace.TypedReadOptions;

  /** See `MonoNamespace.Memory`. */
  export type Memory = MonoNamespace.Memory;

  /** See `MonoNamespace.Trace`. */
  export type Trace = MonoNamespace.Trace;

  /** See `MonoNamespace.ICall`. */
  export type ICall = MonoNamespace.ICall;
}

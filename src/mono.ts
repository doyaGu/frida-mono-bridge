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
 *   const Player = Mono.find.classExact("Game.Player");
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
import { createMonoApi, MonoApi } from "./runtime/api";
import { GCHandle } from "./runtime/gchandle";
import { MonoModuleInfo, waitForMonoModule } from "./runtime/module";
import { ThreadManager } from "./runtime/thread";
import { MonoRuntimeVersion } from "./runtime/version";
import { MonoErrorCodes, handleMonoError, raise, raiseFrom } from "./utils/errors";

import { createMemorySubsystem } from "./runtime/memory";

// Import domain objects from model
import { GarbageCollector } from "./model/gc";
import { FieldAccessCallbacks, MethodCallbacks, PropertyAccessCallbacks, Tracer } from "./model/trace";

// Import internal call registrar
import {
  createInternalCallRegistrar,
  DuplicatePolicy,
  InternalCallRegistrar,
  type InternalCallDefinition,
  type InternalCallRegistrationInfo,
  type InternalCallRegistrationOptions,
} from "./model/internal-call";

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
 *   const klass = Mono.find.classExact("Game.Player");
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
  private _find: MonoNamespace.Find | null = null;
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
        this._gc = null;
        this._tracer = null;
        this._initialized = false;
        const message = error instanceof Error
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

    if (!this._gcSubsystem) {
      if (!this._gc) {
        this._gc = new GarbageCollector(this._api!);
      }
      this._gcSubsystem = this.buildGCSubsystem(this._gc);
    }

    return this._gcSubsystem;
  }

  /**
   * Search utilities for finding classes, methods, fields
   */
  get find(): MonoNamespace.Find {
    this.ensureInitializedSync();

    if (!this._find) {
      this._find = this.buildFindSubsystem(this._api!);
    }

    return this._find;
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
      this._traceSubsystem = this.buildTraceSubsystem(this._tracer);
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
      this._icall = this.buildICallSubsystem(this._icallRegistrar);
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
  private buildMemorySubsystem(): MonoNamespace.Memory {
    return createMemorySubsystem(this._api!);
  }

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
    this._find = null;
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
    this._find = null;
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

  // ============================================================================
  // SUBSYSTEM BUILDERS (Private)
  // ============================================================================

  /**
   * Build GC subsystem interface
   * @internal
   */
  private buildGCSubsystem(gc: GarbageCollector): MonoNamespace.GC {
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

  /**
   * Build Find subsystem interface
   * @internal
   */
  private buildFindSubsystem(api: MonoApi): MonoNamespace.Find {
    return {
      classes: (pattern: string, options?: import("./model/domain").FindOptions) =>
        MonoDomain.findClasses(api, pattern, options),
      methods: (pattern: string, options?: import("./model/domain").FindOptions) =>
        MonoDomain.findMethods(api, pattern, options),
      fields: (pattern: string, options?: import("./model/domain").FindOptions) =>
        MonoDomain.findFields(api, pattern, options),
      properties: (pattern: string, options?: import("./model/domain").FindOptions) =>
        MonoDomain.findProperties(api, pattern, options),
      classExact: (fullName: string) => MonoDomain.classExact(api, fullName),
    };
  }

  /**
   * Build Trace subsystem interface
   * @internal
   */
  private buildTraceSubsystem(tracer: Tracer): MonoNamespace.Trace {
    return {
      method: (m, cb) => tracer.method(m, cb),
      tryMethod: (m, cb) => tracer.tryMethod(m, cb),
      methodExtended: (m, cb) => tracer.methodExtended(m, cb),
      tryMethodExtended: (m, cb) => tracer.tryMethodExtended(m, cb),
      classAll: (k, cb) => tracer.classAll(k, cb),
      methodsByPattern: (pattern: string, callbacks: MethodCallbacks) => tracer.methodsByPattern(pattern, callbacks),
      classesByPattern: (pattern: string, callbacks: MethodCallbacks) => tracer.classesByPattern(pattern, callbacks),
      replaceReturnValue: (m, r) => tracer.replaceReturnValue(m, r),
      tryReplaceReturnValue: (m, r) => tracer.tryReplaceReturnValue(m, r),
      field: (f, cb) => tracer.field(f, cb),
      fieldsByPattern: (pattern: string, callbacks: FieldAccessCallbacks) => tracer.fieldsByPattern(pattern, callbacks),
      property: (p, cb) => tracer.property(p, cb),
      propertiesByPattern: (pattern: string, callbacks: PropertyAccessCallbacks) =>
        tracer.propertiesByPattern(pattern, callbacks),
      createPerformanceTracker: () => tracer.createPerformanceTracker(),
      methodWithCallStack: (m, cb) => tracer.methodWithCallStack(m, cb),
    };
  }

  /**
   * Build ICall subsystem interface
   * @internal
   */
  private buildICallSubsystem(registrar: InternalCallRegistrar): MonoNamespace.ICall {
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
}

// ============================================================================
// NAMESPACE TYPES
// ============================================================================

export namespace MonoNamespace {
  /**
   * Thread detachment behavior used by `Mono.perform()`.
   * - `bind`: keep thread attached and clean up on script unload (default)
   * - `free`: detach if this `perform()` call attached the thread
   * - `leak`: never detach (caller takes responsibility)
   */
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
    classes(pattern: string, options?: import("./model/domain").FindOptions): import("./model/class").MonoClass[];
    methods(pattern: string, options?: import("./model/domain").FindOptions): import("./model/method").MonoMethod[];
    fields(pattern: string, options?: import("./model/domain").FindOptions): import("./model/field").MonoField[];
    properties(
      pattern: string,
      options?: import("./model/domain").FindOptions,
    ): import("./model/property").MonoProperty[];
    classExact(fullName: string): import("./model/class").MonoClass | null;
  }

  /**
   * Trace/hook subsystem interface
   */
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

  /**
   * Internal call registration subsystem interface.
   * Following IL2CPP-style try/require semantics.
   */
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
 * Type namespace merged with the `Mono` value (IL2CPP-style).
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

  /** See `MonoNamespace.Find`. */
  export type Find = MonoNamespace.Find;

  /** See `MonoNamespace.Trace`. */
  export type Trace = MonoNamespace.Trace;

  /** See `MonoNamespace.ICall`. */
  export type ICall = MonoNamespace.ICall;
}

/**
 * Global Mono namespace - Main entry point for frida-mono-bridge
 * Provides a fluent, discoverable API similar to frida-il2cpp-bridge
 */

import { MonoApi, createMonoApi } from "./runtime/api";
import { findMonoModule, MonoModuleInfo } from "./runtime/module";
import { ThreadManager } from "./runtime/guard";
import { MonoDomain } from "./model/domain";
import { MonoRuntimeVersion } from "./runtime/version";

// Import utilities
import * as Find from "./utils/find";
import * as Trace from "./utils/trace";
import * as Types from "./utils/types-helper";
import { GCUtilities } from "./utils/gc";

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
  private _initialized = false;

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
  perform<T>(callback: () => T): T {
    this.ensureInitialized();

    if (!this._api) {
      throw new Error("Mono API not initialized");
    }

    return this._api._threadManager.run(callback);
  }

  /**
   * Get the current application domain
   * All assemblies, classes, and types are accessed through the domain
   */
  get domain(): MonoDomain {
    this.ensureInitialized();

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
    this.ensureInitialized();
    return this._api!;
  }

  /**
   * Get the Mono module information
   */
  get module(): MonoModuleInfo {
    this.ensureInitialized();
    return this._module!;
  }

  /**
   * Get Mono runtime version information
   */
  get version(): MonoRuntimeVersion {
    this.ensureInitialized();

    if (!this._version) {
      this._version = MonoRuntimeVersion.fromApi(this._api!);
    }

    return this._version;
  }

  /**
   * GC utilities for garbage collection and object lifetime management
   */
  get gc(): GCUtilities {
    this.ensureInitialized();

    if (!this._gcUtils) {
      this._gcUtils = new GCUtilities(this._api!);
    }

    return this._gcUtils;
  }

  /**
   * Search utilities for finding classes, methods, fields
   */
  get find(): typeof Find {
    return Find;
  }

  /**
   * Tracing utilities for hooking and monitoring
   */
  get trace(): typeof Trace {
    return Trace;
  }

  /**
   * Type utilities for boxing/unboxing and type operations
   */
  get types(): typeof Types {
    return Types;
  }

  
  /**
   * Initialize the Mono runtime
   * @internal Called automatically when needed
   */
  private ensureInitialized(): void {
    if (this._initialized) {
      return;
    }

    try {
      this._module = findMonoModule();
      this._api = createMonoApi(this._module);

      // Initialize thread manager
      this._api._threadManager = new ThreadManager(this._api);

      // Attach current thread
      this._api._threadManager.ensureAttached();

      this._initialized = true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize Mono runtime: ${error.message}`);
      }
      throw error;
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
    this._module = null;
    this._api = null;
    this._domain = null;
    this._version = null;
    this._gcUtils = null;
  }

  /**
   * Attach the current thread to the Mono runtime
   * Usually not needed - use perform() instead
   * @returns Native pointer to the attached thread
   */
  attachThread(): NativePointer {
    this.ensureInitialized();
    return this._api!._threadManager.ensureAttached();
  }

  /**
   * Detach all threads from the Mono runtime
   */
  detachAllThreads(): void {
    if (this._api) {
      this._api._threadManager.detachAll();
    }
  }
}

/**
 * Global Mono instance
 * Use this as the main entry point for all Mono operations
 *
 * @example
 * import { Mono } from "frida-mono-bridge";
 *
 * Mono.perform(() => {
 *   const assemblies = Mono.domain.assemblies;
 *   assemblies.forEach(a => console.log(a.name));
 * });
 */
export const Mono = new MonoNamespace();

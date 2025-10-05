/**
 * Garbage collection utilities
 */

import { MonoApi } from "../runtime/api";
import { GCHandlePool, GCHandle } from "../runtime/gchandle";

/**
 * GC utilities namespace
 */
export class GCUtilities {
  private pool: GCHandlePool;

  constructor(private readonly api: MonoApi) {
    this.pool = new GCHandlePool(api);
  }

  /**
   * Force garbage collection
   *
   * @param generation GC generation to collect (0-2, or -1 for all)
   */
  collect(generation = -1): void {
    if (this.api.hasExport("mono_gc_collect")) {
      this.api.native.mono_gc_collect(generation);
    }
  }

  /**
   * Get max GC generation
   */
  get maxGeneration(): number {
    if (this.api.hasExport("mono_gc_max_generation")) {
      return this.api.native.mono_gc_max_generation() as number;
    }
    return 2; // Default to 2
  }

  /**
   * Create a GC handle for an object
   */
  handle(obj: NativePointer, pinned = false): GCHandle {
    return this.pool.create(obj, pinned);
  }

  /**
   * Create a weak GC handle
   */
  weakHandle(obj: NativePointer, trackResurrection = false): GCHandle {
    return this.pool.createWeak(obj, trackResurrection);
  }

  /**
   * Release a GC handle
   */
  releaseHandle(handle: GCHandle): void {
    this.pool.release(handle);
  }

  /**
   * Release all GC handles
   */
  releaseAll(): void {
    this.pool.releaseAll();
  }
}

/**
 * Create GC utilities instance
 */
export function createGCUtilities(api: MonoApi): GCUtilities {
  return new GCUtilities(api);
}

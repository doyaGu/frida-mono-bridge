/**
 * Garbage collection utilities
 */

import { MonoApi } from "../runtime/api";
import { GCHandlePool, GCHandle } from "../runtime/gchandle";

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Heap size in bytes (if available) */
  heapSize: number | null;
  /** Used heap size in bytes (if available) */
  usedHeapSize: number | null;
  /** Total number of GC collections (if available) */
  totalCollections: number | null;
  /** Active GC handle count from the pool */
  activeHandles: number;
  /** Whether detailed stats are available */
  detailedStatsAvailable: boolean;
}

/**
 * GC generation statistics
 */
export interface GenerationStats {
  generation: number;
  size: number | null;
  collections: number | null;
}

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

  // ===== MEMORY STATISTICS =====

  /**
   * Get current memory usage statistics
   * 
   * Note: Some statistics may not be available depending on the Mono runtime
   * configuration and version.
   */
  getMemoryStats(): MemoryStats {
    const stats: MemoryStats = {
      heapSize: null,
      usedHeapSize: null,
      totalCollections: null,
      activeHandles: this.pool.size,
      detailedStatsAvailable: false,
    };

    // Try to get heap size using mono_gc_get_heap_size
    if (this.api.hasExport("mono_gc_get_heap_size")) {
      try {
        const heapSize = this.api.native.mono_gc_get_heap_size();
        stats.heapSize = Number(heapSize);
        stats.detailedStatsAvailable = true;
      } catch {
        // API not available or failed
      }
    }

    // Try to get used heap size using mono_gc_get_used_size
    if (this.api.hasExport("mono_gc_get_used_size")) {
      try {
        const usedSize = this.api.native.mono_gc_get_used_size();
        stats.usedHeapSize = Number(usedSize);
        stats.detailedStatsAvailable = true;
      } catch {
        // API not available or failed
      }
    }

    return stats;
  }

  /**
   * Get statistics for each GC generation
   */
  getGenerationStats(): GenerationStats[] {
    const maxGen = this.maxGeneration;
    const stats: GenerationStats[] = [];

    for (let gen = 0; gen <= maxGen; gen++) {
      stats.push({
        generation: gen,
        size: null, // Mono doesn't expose per-generation sizes easily
        collections: null, // Would need profiler API
      });
    }

    return stats;
  }

  /**
   * Get the number of active GC handles created by this pool
   */
  getActiveHandleCount(): number {
    return this.pool.size;
  }

  /**
   * Check if a weak handle's target has been collected
   * 
   * @param handle The weak GC handle to check
   * @returns true if the target has been collected, false otherwise
   */
  isCollected(handle: GCHandle): boolean {
    const target = handle.getTarget();
    return target.isNull();
  }

  /**
   * Get a summary of memory usage as a formatted string
   */
  getMemorySummary(): string {
    const stats = this.getMemoryStats();
    const lines: string[] = [];

    lines.push("=== GC Memory Summary ===");
    
    if (stats.heapSize !== null) {
      lines.push(`Heap Size: ${formatBytes(stats.heapSize)}`);
    }
    
    if (stats.usedHeapSize !== null) {
      lines.push(`Used Heap: ${formatBytes(stats.usedHeapSize)}`);
      
      if (stats.heapSize !== null && stats.heapSize > 0) {
        const usagePercent = ((stats.usedHeapSize / stats.heapSize) * 100).toFixed(1);
        lines.push(`Usage: ${usagePercent}%`);
      }
    }
    
    lines.push(`Active Handles: ${stats.activeHandles}`);
    lines.push(`Max Generation: ${this.maxGeneration}`);
    
    if (!stats.detailedStatsAvailable) {
      lines.push("(Detailed stats not available on this runtime)");
    }

    return lines.join("\n");
  }

  /**
   * Perform a full GC and return memory delta
   * Useful for identifying memory leaks
   */
  collectAndReport(): { before: MemoryStats; after: MemoryStats; delta: number | null } {
    const before = this.getMemoryStats();
    
    // Perform full GC
    this.collect(-1);
    
    // Small delay to let GC complete (in real usage, may need adjustment)
    const after = this.getMemoryStats();
    
    let delta: number | null = null;
    if (before.usedHeapSize !== null && after.usedHeapSize !== null) {
      delta = before.usedHeapSize - after.usedHeapSize;
    }
    
    return { before, after, delta };
  }

  /**
   * Check the finalization queue status
   * Note: This functionality is limited in standard Mono API
   * 
   * @returns Information about finalization queue if available
   */
  getFinalizationQueueInfo(): { available: boolean; pendingCount: number | null; message: string } {
    // Try to check if finalization APIs are available
    try {
      // Standard Mono doesn't expose finalization queue details directly
      // We can only trigger finalization and check GC state
      const hasFinalizationApi = this.api.hasExport("mono_gc_finalize_notify");
      
      if (hasFinalizationApi) {
        return {
          available: true,
          pendingCount: null, // Cannot get exact count without internal APIs
          message: "Finalization notification available. Use requestFinalization() to trigger.",
        };
      }
      
      return {
        available: false,
        pendingCount: null,
        message: "Finalization queue APIs not available on this Mono version.",
      };
    } catch (error) {
      return {
        available: false,
        pendingCount: null,
        message: `Failed to check finalization queue: ${error}`,
      };
    }
  }

  /**
   * Request finalization to run (if available)
   * This triggers the finalization thread to process pending finalizers
   */
  requestFinalization(): boolean {
    try {
      if (this.api.hasExport("mono_gc_finalize_notify")) {
        // Use native bindings directly
        this.api.native.mono_gc_finalize_notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Wait for pending finalizers (if supported)
   * 
   * @param timeout Maximum time to wait in milliseconds (0 = no wait, -1 = infinite)
   * @returns true if waiting was supported and completed
   */
  waitForPendingFinalizers(_timeout: number = 0): boolean {
    try {
      if (this.api.hasExport("mono_gc_wait_for_pending_finalizers")) {
        this.api.native.mono_gc_wait_for_pending_finalizers();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Suppress finalization for an object (if supported)
   * Useful for deterministic cleanup when you know the object won't need finalization
   * 
   * @param objectPtr Pointer to the managed object
   * @returns true if suppression was supported
   */
  suppressFinalize(objectPtr: NativePointer): boolean {
    try {
      if (this.api.hasExport("mono_gc_suppress_finalize")) {
        this.api.native.mono_gc_suppress_finalize(objectPtr);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Re-register an object for finalization (if supported)
   * 
   * @param objectPtr Pointer to the managed object
   * @returns true if re-registration was supported
   */
  reRegisterFinalize(_objectPtr: NativePointer): boolean {
    // Note: This API signature may vary between Mono versions
    // Conservative approach - don't call without knowing exact signature
    return false;
  }
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  
  return `${value.toFixed(2)} ${units[i]}`;
}

/**
 * Create GC utilities instance
 */
export function createGCUtilities(api: MonoApi): GCUtilities {
  return new GCUtilities(api);
}

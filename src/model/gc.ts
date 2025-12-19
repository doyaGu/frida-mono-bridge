/**
 * GC Model Module - High-level garbage collection management
 *
 * This module provides domain objects for GC operations:
 * - GarbageCollector: Main domain object for GC management
 * - Type definitions for stats, handles, and configuration
 *
 * @module model/gc
 */

import type { MonoApi } from "../runtime/api";
import type { GCHandle } from "../runtime/gchandle";
import { GCHandlePool } from "../runtime/gchandle";
import { MonoErrorCodes, raise } from "../utils/errors";
import { Logger } from "../utils/log";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Memory usage statistics from the Mono runtime.
 * Some values may be unavailable depending on runtime configuration.
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

/** Per-generation GC statistics. */
export interface GenerationStats {
  generation: number;
  size: number | null;
  collections: number | null;
}

/** Result of a GC collection with before/after comparison. */
export interface CollectionReport {
  before: MemoryStats;
  after: MemoryStats;
  delta: number | null;
  durationMs: number;
}

/** Finalization queue status information. */
export interface FinalizationInfo {
  available: boolean;
  pendingCount: number | null;
  message: string;
}

/** Statistics about GC handle usage. */
export interface HandleStats {
  totalCreated: number;
  totalReleased: number;
  activeCount: number;
  weakCount: number;
  strongCount: number;
  pinnedCount: number;
}

/** Configuration options for the GarbageCollector. */
export interface GarbageCollectorConfig {
  maxHandles: number;
  warnOnHighUsage: boolean;
  highUsageThreshold: number;
  autoReleaseOnLimit: boolean;
}

/** Default configuration for GarbageCollector. */
export const DEFAULT_GC_CONFIG: GarbageCollectorConfig = {
  maxHandles: 10000,
  warnOnHighUsage: true,
  highUsageThreshold: 0.8,
  autoReleaseOnLimit: false,
};

/** Callback for handle events. */
export type HandleEventCallback = (handle: GCHandle, event: "created" | "released") => void;

/** Callback for collection events. */
export type CollectionEventCallback = (generation: number, report: CollectionReport) => void;

const gcLogger = Logger.withTag("GC");

// =============================================================================
// GARBAGE COLLECTOR
// =============================================================================

/**
 * High-level garbage collection manager for Mono runtime.
 *
 * Provides:
 * - Manual GC collection with generation control
 * - Memory statistics and reporting
 * - GC handle lifecycle management with pooling
 * - Finalization queue control
 * - Configuration-based limits and warnings
 *
 * @example
 * ```typescript
 * const gc = createGarbageCollector(monoApi, {
 *   maxHandles: 5000,
 *   warnOnHighUsage: true
 * });
 *
 * // Trigger collection and get report
 * const report = gc.collectAndReport();
 * console.log(`Freed ${report.delta} bytes in ${report.durationMs}ms`);
 *
 * // Create handles
 * const handle = gc.createHandle(objPtr);
 * const weakHandle = gc.createWeakHandle(objPtr);
 *
 * // Get statistics
 * console.log(gc.getMemorySummary());
 * ```
 */
export class GarbageCollector {
  private readonly pool: GCHandlePool;
  private readonly config: GarbageCollectorConfig;
  private disposed = false;

  private pinnedHandleCount = 0;
  private collectionCount = 0;
  private lastCollectionTime: number | null = null;

  /**
   * Creates a new GarbageCollector instance.
   * @param api - MonoApi instance for runtime access
   * @param config - Optional configuration overrides
   */
  constructor(
    private readonly api: MonoApi,
    config: Partial<GarbageCollectorConfig> = {},
  ) {
    this.pool = new GCHandlePool(api);
    this.config = { ...DEFAULT_GC_CONFIG, ...config };
  }

  /** Whether this GarbageCollector has been disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Maximum generation number supported by the Mono runtime (typically 0-2). */
  get maxGeneration(): number {
    this.ensureNotDisposed();
    return this.api.native.mono_gc_max_generation() as number;
  }

  /** Number of active GC handles currently managed by this collector. */
  get activeHandleCount(): number {
    return this.pool.size;
  }

  /** Current memory statistics snapshot. Alias for getMemoryStats(). */
  get stats(): MemoryStats {
    return this.getMemoryStats();
  }

  /** Current configuration (read-only copy). */
  get currentConfig(): Readonly<GarbageCollectorConfig> {
    return { ...this.config };
  }

  /**
   * Triggers a garbage collection.
   * @param generation - Generation to collect (-1 for all generations, 0-2 for specific generation)
   * @throws {MonoError} If the collector is disposed
   */
  collect(generation = -1): void {
    this.ensureNotDisposed();

    const validGen = generation === -1 ? generation : Math.min(generation, this.maxGeneration);
    this.api.native.mono_gc_collect(validGen);
    this.collectionCount++;
    this.lastCollectionTime = Date.now();
  }

  /**
   * Triggers a garbage collection and returns a detailed report.
   * @param generation - Generation to collect (-1 for all)
   * @returns Collection report with before/after stats and timing
   * @throws {MonoError} If the collector is disposed
   */
  collectAndReport(generation = -1): CollectionReport {
    this.ensureNotDisposed();

    const before = this.getMemoryStats();
    const startTime = Date.now();

    this.collect(generation);

    const endTime = Date.now();
    const after = this.getMemoryStats();

    let delta: number | null = null;
    if (before.usedHeapSize !== null && after.usedHeapSize !== null) {
      delta = before.usedHeapSize - after.usedHeapSize;
    }

    return {
      before,
      after,
      delta,
      durationMs: endTime - startTime,
    };
  }

  /**
   * Retrieves current memory statistics from the Mono runtime.
   * @returns Memory statistics (some values may be null if APIs unavailable)
   * @throws {MonoError} If the collector is disposed
   */
  getMemoryStats(): MemoryStats {
    this.ensureNotDisposed();

    const stats: MemoryStats = {
      heapSize: null,
      usedHeapSize: null,
      totalCollections: null,
      activeHandles: this.pool.size,
      detailedStatsAvailable: false,
    };

    try {
      const heapSize = this.api.native.mono_gc_get_heap_size();
      stats.heapSize = Number(heapSize);
      stats.detailedStatsAvailable = true;
    } catch {
      // API not available
    }

    try {
      const usedSize = this.api.native.mono_gc_get_used_size();
      stats.usedHeapSize = Number(usedSize);
      stats.detailedStatsAvailable = true;
    } catch {
      // API not available
    }

    return stats;
  }

  /**
   * Retrieves per-generation statistics.
   * @returns Array of stats for each generation (0 to maxGeneration)
   * @throws {MonoError} If the collector is disposed
   */
  getGenerationStats(): GenerationStats[] {
    this.ensureNotDisposed();

    const maxGen = this.maxGeneration;
    const stats: GenerationStats[] = [];

    for (let gen = 0; gen <= maxGen; gen++) {
      stats.push({
        generation: gen,
        size: null,
        collections: null,
      });
    }

    return stats;
  }

  /**
   * Retrieves GC handle usage statistics.
   * @returns Handle statistics including created, released, and active counts
   */
  getHandleStats(): HandleStats {
    const poolStats = this.pool.getStats();
    return {
      totalCreated: poolStats.totalCreated,
      totalReleased: poolStats.totalReleased,
      activeCount: poolStats.activeCount,
      weakCount: poolStats.weakCount,
      strongCount: poolStats.strongCount,
      pinnedCount: this.pinnedHandleCount,
    };
  }

  /**
   * Generates a human-readable memory summary.
   * @returns Formatted string with memory stats, handle counts, and collection info
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
    lines.push(`Collections Triggered: ${this.collectionCount}`);

    if (this.lastCollectionTime !== null) {
      const elapsed = Date.now() - this.lastCollectionTime;
      lines.push(`Last Collection: ${elapsed}ms ago`);
    }

    if (!stats.detailedStatsAvailable) {
      lines.push("(Detailed stats not available on this runtime)");
    }

    return lines.join("\n");
  }

  /**
   * Creates a strong GC handle for a managed object.
   * @param obj - Pointer to the managed object
   * @param pinned - Whether to pin the object in memory
   * @returns GC handle that prevents object from being collected
   * @throws {MonoError} If disposed or handle limit reached
   */
  createHandle(obj: NativePointer, pinned = false): GCHandle {
    this.ensureNotDisposed();
    this.checkHandleLimit();

    const handle = this.pool.create(obj, pinned);
    if (pinned) {
      this.pinnedHandleCount++;
    }

    return handle;
  }

  /**
   * Attempts to create a strong GC handle without throwing.
   * @param obj - Pointer to the managed object
   * @param pinned - Whether to pin the object in memory
   * @returns GC handle or null if creation failed
   */
  tryCreateHandle(obj: NativePointer, pinned = false): GCHandle | null {
    if (this.disposed) return null;

    try {
      if (!this.hasHandleCapacity()) {
        return null;
      }
      return this.createHandle(obj, pinned);
    } catch {
      return null;
    }
  }

  /**
   * Creates a weak GC handle that allows object to be collected.
   * @param obj - Pointer to the managed object
   * @param trackResurrection - Whether to track object after finalization
   * @returns Weak GC handle
   * @throws {MonoError} If disposed or handle limit reached
   */
  createWeakHandle(obj: NativePointer, trackResurrection = false): GCHandle {
    this.ensureNotDisposed();
    this.checkHandleLimit();

    return this.pool.createWeak(obj, trackResurrection);
  }

  /**
   * Attempts to create a weak GC handle without throwing.
   * @param obj - Pointer to the managed object
   * @param trackResurrection - Whether to track object after finalization
   * @returns Weak GC handle or null if creation failed
   */
  tryCreateWeakHandle(obj: NativePointer, trackResurrection = false): GCHandle | null {
    if (this.disposed) return null;

    try {
      if (!this.hasHandleCapacity()) {
        return null;
      }
      return this.createWeakHandle(obj, trackResurrection);
    } catch {
      return null;
    }
  }

  /**
   * Releases a GC handle, allowing the object to be collected.
   * @param handle - Handle to release
   */
  releaseHandle(handle: GCHandle): void {
    if (!handle.isWeak && !handle.isFreed) {
      if (this.pinnedHandleCount > 0) {
        this.pinnedHandleCount--;
      }
    }
    this.pool.release(handle);
  }

  /**
   * Releases all managed GC handles.
   * Use with caution - objects may be collected unexpectedly.
   */
  releaseAllHandles(): void {
    this.pool.releaseAll();
    this.pinnedHandleCount = 0;
  }

  /**
   * Checks if the object referenced by a handle has been collected.
   * @param handle - Handle to check
   * @returns True if object was collected (handle target is null)
   */
  isCollected(handle: GCHandle): boolean {
    const target = handle.getTarget();
    return target.isNull();
  }

  /**
   * Checks if more handles can be created without exceeding the limit.
   * @returns True if current count is below maxHandles
   */
  hasHandleCapacity(): boolean {
    return this.pool.size < this.config.maxHandles;
  }

  /**
   * Retrieves information about the finalization queue.
   * @returns Finalization queue status and availability
   * @throws {MonoError} If the collector is disposed
   */
  getFinalizationInfo(): FinalizationInfo {
    this.ensureNotDisposed();

    try {
      const hasFinalizationApi = this.api.hasExport("mono_gc_finalize_notify");

      if (hasFinalizationApi) {
        return {
          available: true,
          pendingCount: null,
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
   * Requests finalization notification (if supported by runtime).
   * @returns True if notification was triggered, false if API unavailable
   * @throws {MonoError} If the collector is disposed
   */
  requestFinalization(): boolean {
    this.ensureNotDisposed();

    try {
      if (this.api.hasExport("mono_gc_finalize_notify")) {
        this.api.native.mono_gc_finalize_notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Waits for pending finalizers to complete (not implemented).
   * @param _timeout - Timeout in milliseconds
   * @returns Always false (not supported)
   */
  waitForPendingFinalizers(_timeout = 0): boolean {
    return false;
  }

  /**
   * Suppresses finalization for an object (not implemented).
   * @param _objectPtr - Object pointer
   * @returns Always false (not supported)
   */
  suppressFinalize(_objectPtr: NativePointer): boolean {
    return false;
  }

  /**
   * Re-registers an object for finalization (not implemented).
   * @param _objectPtr - Object pointer
   * @returns Always false (not supported)
   */
  reRegisterFinalize(_objectPtr: NativePointer): boolean {
    return false;
  }

  /** Whether the Mono runtime uses a moving collector (always false for Mono). */
  get supportsMovingCollector(): boolean {
    return false;
  }

  /** Whether the Mono runtime has a dedicated pinned object heap (always false for Mono). */
  get supportsPinnedObjectHeap(): boolean {
    return false;
  }

  /**
   * Disposes this GarbageCollector and releases all managed handles.
   * The instance cannot be used after disposal.
   */
  dispose(): void {
    if (this.disposed) return;

    this.pool.dispose();
    this.disposed = true;

    gcLogger.debug("GarbageCollector disposed");
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      raise(
        MonoErrorCodes.DISPOSED,
        "GarbageCollector has been disposed",
        "Create a new GarbageCollector instance or avoid using after dispose()",
      );
    }
  }

  private checkHandleLimit(): void {
    const currentCount = this.pool.size;
    const maxHandles = this.config.maxHandles;

    if (this.config.warnOnHighUsage) {
      const threshold = maxHandles * this.config.highUsageThreshold;
      if (currentCount >= threshold && currentCount < maxHandles) {
        gcLogger.warn(
          `GC handle usage at ${((currentCount / maxHandles) * 100).toFixed(1)}% ` +
            `(${currentCount}/${maxHandles}). Consider releasing unused handles.`,
        );
      }
    }

    if (currentCount >= maxHandles) {
      if (this.config.autoReleaseOnLimit) {
        gcLogger.warn(`GC handle limit reached (${maxHandles}). Auto-releasing weak handles.`);
        this.releaseWeakHandles();
      } else {
        raise(
          MonoErrorCodes.RESOURCE_LIMIT,
          `GC handle limit reached: ${currentCount}/${maxHandles}`,
          "Release unused handles or increase config.maxHandles",
        );
      }
    }
  }

  private releaseWeakHandles(): void {
    const handles = this.pool.getHandles();
    let released = 0;
    const target = Math.floor(this.config.maxHandles * 0.5);

    for (const handle of handles) {
      if (handle.isWeak) {
        this.pool.release(handle);
        released++;
        if (this.pool.size <= target) break;
      }
    }

    gcLogger.debug(`Released ${released} weak handles to free capacity`);
  }
}

/**
 * Formats byte count into human-readable string with appropriate unit.
 * @param bytes - Byte count to format
 * @returns Formatted string (e.g., "1.50 MB")
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
 * Creates a new GarbageCollector instance with optional configuration.
 * @param api - MonoApi instance for runtime access
 * @param config - Optional configuration overrides
 * @returns Configured GarbageCollector instance
 *
 * @example
 * ```typescript
 * const gc = createGarbageCollector(monoApi, {
 *   maxHandles: 5000,
 *   warnOnHighUsage: true,
 *   highUsageThreshold: 0.8
 * });
 * ```
 */
export function createGarbageCollector(api: MonoApi, config?: Partial<GarbageCollectorConfig>): GarbageCollector {
  return new GarbageCollector(api, config);
}

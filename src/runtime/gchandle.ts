/**
 * GC Handle Management - Prevent managed objects from being garbage collected.
 *
 * Provides:
 * - Strong handles for keeping objects alive
 * - Weak handles for tracking objects without preventing collection
 * - Handle pooling for efficient resource management
 * - Automatic cleanup on pool disposal
 *
 * @module runtime/gchandle
 */

import { MonoErrorCodes, raise } from "../utils/errors";
import { Logger } from "../utils/log";
import { pointerIsNull } from "../utils/memory";
import { MonoApi } from "./api";

// Logger for GC handle operations
const gcHandleLogger = Logger.withTag("GCHandle");

type GCHandleToken = number | bigint;

type GCHandleAbiKind = "v1" | "v2";

interface GCHandleAbi {
  kind: GCHandleAbiKind;
  create(object: NativePointer, pinned: boolean): GCHandleToken;
  createWeak(object: NativePointer, trackResurrection: boolean): GCHandleToken;
  getTarget(handle: GCHandleToken): NativePointer;
  free(handle: GCHandleToken): void;
}

function pointerToToken(value: NativePointer): bigint {
  // NativePointer.toString() is stable and returns e.g. "0x7ff....".
  // Using bigint avoids precision loss on 64-bit runtimes.
  return BigInt(value.toString());
}

function tokenToPointer(token: GCHandleToken): NativePointer {
  if (typeof token === "bigint") {
    return ptr(`0x${token.toString(16)}`);
  }
  return ptr(token);
}

function isZeroToken(token: GCHandleToken): boolean {
  return token === 0 || token === 0n;
}

function zeroToken(kind: GCHandleAbiKind): GCHandleToken {
  return kind === "v2" ? 0n : 0;
}

function selectGCHandleAbi(api: MonoApi): GCHandleAbi {
  const hasV2 =
    api.hasExport("mono_gchandle_new_v2") &&
    api.hasExport("mono_gchandle_new_weakref_v2") &&
    api.hasExport("mono_gchandle_get_target_v2") &&
    api.hasExport("mono_gchandle_free_v2");

  if (hasV2) {
    return {
      kind: "v2",
      create(object, pinned) {
        const handlePtr = api.native.mono_gchandle_new_v2(object, pinned ? 1 : 0) as NativePointer;
        return pointerToToken(handlePtr);
      },
      createWeak(object, trackResurrection) {
        const handlePtr = api.native.mono_gchandle_new_weakref_v2(object, trackResurrection ? 1 : 0) as NativePointer;
        return pointerToToken(handlePtr);
      },
      getTarget(handle) {
        return api.native.mono_gchandle_get_target_v2(tokenToPointer(handle));
      },
      free(handle) {
        api.native.mono_gchandle_free_v2(tokenToPointer(handle));
      },
    };
  }

  // Fall back to classic v1 ABI (guint32 handle id)
  return {
    kind: "v1",
    create(object, pinned) {
      return api.native.mono_gchandle_new(object, pinned ? 1 : 0) as number;
    },
    createWeak(object, trackResurrection) {
      return api.native.mono_gchandle_new_weakref(object, trackResurrection ? 1 : 0) as number;
    },
    getTarget(handle) {
      if (typeof handle === "bigint") {
        raise(
          MonoErrorCodes.INVALID_ARGUMENT,
          "GCHandle token type mismatch (expected number for v1 ABI)",
          "This indicates a bug in GCHandle ABI selection",
        );
      }
      return api.native.mono_gchandle_get_target(handle);
    },
    free(handle) {
      if (typeof handle === "bigint") {
        raise(
          MonoErrorCodes.INVALID_ARGUMENT,
          "GCHandle token type mismatch (expected number for v1 ABI)",
          "This indicates a bug in GCHandle ABI selection",
        );
      }
      api.native.mono_gchandle_free(handle);
    },
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of GC handles supported by the Mono runtime.
 */
export enum GCHandleType {
  /** Normal handle - keeps object alive */
  Normal = 0,
  /** Weak handle - does not prevent collection */
  Weak = 1,
  /** Weak handle that tracks resurrection */
  WeakTrackResurrection = 2,
  /** Pinned handle - keeps object at fixed memory location */
  Pinned = 3,
}

/**
 * Statistics about GC handle pool usage.
 */
export interface GCHandlePoolStats {
  /** Total number of handles created */
  totalCreated: number;
  /** Total number of handles released */
  totalReleased: number;
  /** Currently active handles */
  activeCount: number;
  /** Number of weak handles */
  weakCount: number;
  /** Number of strong handles */
  strongCount: number;
}

// ============================================================================
// GC HANDLE CLASS
// ============================================================================

/**
 * Wrapper for a Mono GC handle.
 *
 * GC handles prevent managed objects from being garbage collected.
 * Handles must be freed when no longer needed to prevent memory leaks.
 *
 * @example
 * ```typescript
 * // Get a handle to keep an object alive
 * const handle = pool.create(objectPtr);
 *
 * // Later, get the target object
 * const target = handle.getTarget();
 * if (!target.isNull()) {
 *   // Object is still alive
 * }
 *
 * // Free when done
 * pool.release(handle);
 * ```
 */
export class GCHandle {
  #handle: GCHandleToken;
  #freed = false;

  constructor(
    private readonly api: MonoApi,
    private readonly abi: GCHandleAbi,
    handle: GCHandleToken,
    private readonly weak: boolean,
  ) {
    this.#handle = handle;
  }

  // ===== PROPERTIES =====

  /**
   * The underlying handle ID.
   * Returns 0 if the handle has been freed.
   */
  get handle(): GCHandleToken {
    return this.#handle;
  }

  /**
   * Whether this is a weak handle.
   * Weak handles do not prevent garbage collection.
   */
  get isWeak(): boolean {
    return this.weak;
  }

  /**
   * Whether this handle has been freed.
   */
  get isFreed(): boolean {
    return this.#freed;
  }

  /**
   * Whether this handle is still valid (not freed and has a non-zero ID).
   */
  get isValid(): boolean {
    return !this.#freed && !isZeroToken(this.#handle);
  }

  // ===== TARGET ACCESS =====

  /**
   * Get the managed object this handle points to.
   *
   * For weak handles, may return NULL if the object was collected.
   *
   * @returns Pointer to the managed object, or NULL if freed/collected
   *
   * @example
   * ```typescript
   * const target = handle.getTarget();
   * if (target.isNull()) {
   *   console.log('Object was collected or handle freed');
   * }
   * ```
   */
  getTarget(): NativePointer {
    if (this.#freed || isZeroToken(this.#handle)) {
      return NULL;
    }
    try {
      return this.abi.getTarget(this.#handle);
    } catch (error) {
      // Some Unity/Mono versions may have issues with getTarget
      gcHandleLogger.debug(`Error getting target for handle ${this.#handle}: ${error}`);
      return NULL;
    }
  }

  /**
   * Try to get the target, returning null if unavailable.
   * @returns Target pointer or null
   */
  tryGetTarget(): NativePointer | null {
    const target = this.getTarget();
    return pointerIsNull(target) ? null : target;
  }

  /**
   * Check if the target object is still alive.
   * @returns True if target is not NULL
   */
  hasTarget(): boolean {
    return !pointerIsNull(this.getTarget());
  }

  // ===== LIFECYCLE =====

  /**
   * Free this handle, allowing the object to be collected.
   *
   * Safe to call multiple times - subsequent calls are no-ops.
   * After freeing, getTarget() will return NULL.
   */
  free(): void {
    if (this.#freed || isZeroToken(this.#handle)) {
      return;
    }
    try {
      this.abi.free(this.#handle);
    } catch (error) {
      // Some Unity/Mono versions may not support freeing handles properly
      // Continue anyway to mark the handle as freed
      gcHandleLogger.debug(`Error freeing handle ${this.#handle}: ${error}`);
    }
    this.#handle = zeroToken(this.abi.kind);
    this.#freed = true;
  }

  /**
   * Ensure this handle is valid, throwing if freed.
   * @throws {MonoError} if handle has been freed
   */
  ensureValid(): void {
    if (this.#freed) {
      raise(MonoErrorCodes.DISPOSED, "GCHandle has been freed", "Do not use handles after calling free()");
    }
  }

  // ===== UTILITY =====

  /**
   * Get a string representation of this handle.
   */
  toString(): string {
    const status = this.#freed ? "freed" : "active";
    const type = this.weak ? "weak" : "strong";
    return `GCHandle(${this.#handle}, ${type}, ${status})`;
  }
}

// ============================================================================
// GC HANDLE POOL
// ============================================================================

/**
 * Pool for managing multiple GC handles with automatic cleanup.
 *
 * Provides centralized management of GC handles, tracking their lifecycle
 * and ensuring proper cleanup. Useful for keeping multiple objects alive
 * during a complex operation.
 *
 * @example
 * ```typescript
 * const pool = new GCHandlePool(api);
 *
 * // Create handles for objects we need to keep alive
 * const handle1 = pool.create(obj1);
 * const handle2 = pool.createWeak(obj2);
 *
 * // ... perform operations ...
 *
 * // Check pool stats
 * console.log(pool.getStats());
 *
 * // Clean up all handles when done
 * pool.releaseAll();
 * ```
 */
export class GCHandlePool {
  private readonly handles = new Set<GCHandle>();
  private totalCreated = 0;
  private totalReleased = 0;
  private disposed = false;

  private readonly abi: GCHandleAbi;

  constructor(private readonly api: MonoApi) {
    this.abi = selectGCHandleAbi(api);
    gcHandleLogger.debug(`Using GCHandle ABI: ${this.abi.kind}`);
  }

  // ===== PROPERTIES =====

  /**
   * Get the number of active handles in this pool.
   */
  get size(): number {
    return this.handles.size;
  }

  /**
   * Check if the pool has been disposed.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Check if the pool is empty.
   */
  get isEmpty(): boolean {
    return this.handles.size === 0;
  }

  // ===== HANDLE CREATION =====

  /**
   * Create a strong GC handle for an object.
   *
   * Strong handles prevent the object from being garbage collected
   * until the handle is freed.
   *
   * @param object Pointer to the managed object
   * @param pinned Whether to pin the object in memory (prevents GC from moving it)
   * @returns New GC handle
   * @throws {MonoError} if pool is disposed or object is NULL
   *
   * @example
   * ```typescript
   * const handle = pool.create(objectPtr);
   * // Object is now protected from GC
   * ```
   */
  create(object: NativePointer, pinned = false): GCHandle {
    this.ensureNotDisposed();
    this.validateObject(object, "create");

    const handleId = this.abi.create(object, pinned);
    const handle = new GCHandle(this.api, this.abi, handleId, false);
    this.handles.add(handle);
    this.totalCreated++;
    return handle;
  }

  /**
   * Try to create a strong GC handle without throwing.
   * @returns Handle if successful, null if failed
   */
  tryCreate(object: NativePointer, pinned = false): GCHandle | null {
    if (this.disposed || pointerIsNull(object)) {
      return null;
    }
    try {
      return this.create(object, pinned);
    } catch {
      return null;
    }
  }

  /**
   * Create a weak GC handle for an object.
   *
   * Weak handles do not prevent garbage collection. Use them to
   * track objects without keeping them alive.
   *
   * @param object Pointer to the managed object
   * @param trackResurrection Whether to track object resurrection
   * @returns New weak GC handle
   * @throws {MonoError} if pool is disposed or object is NULL
   *
   * @example
   * ```typescript
   * const weakHandle = pool.createWeak(objectPtr);
   * // Later, check if object is still alive
   * if (weakHandle.hasTarget()) {
   *   console.log('Object still alive');
   * }
   * ```
   */
  createWeak(object: NativePointer, trackResurrection = false): GCHandle {
    this.ensureNotDisposed();
    this.validateObject(object, "createWeak");

    const handleId = this.abi.createWeak(object, trackResurrection);
    const handle = new GCHandle(this.api, this.abi, handleId, true);
    this.handles.add(handle);
    this.totalCreated++;
    return handle;
  }

  /**
   * Try to create a weak GC handle without throwing.
   * @returns Handle if successful, null if failed
   */
  tryCreateWeak(object: NativePointer, trackResurrection = false): GCHandle | null {
    if (this.disposed || pointerIsNull(object)) {
      return null;
    }
    try {
      return this.createWeak(object, trackResurrection);
    } catch {
      return null;
    }
  }

  // ===== HANDLE RELEASE =====

  /**
   * Release a handle back to the pool.
   *
   * Frees the handle and removes it from the pool. Safe to call
   * with handles not in this pool (no-op).
   *
   * @param handle Handle to release
   */
  release(handle: GCHandle): void {
    if (!this.handles.has(handle)) {
      return;
    }
    try {
      handle.free();
    } catch (error) {
      // Silently handle errors during handle release
      // This can happen with Unity's Mono when handles point to invalid memory
      gcHandleLogger.debug(`Error releasing handle ${handle.handle}: ${error}`);
    }
    this.handles.delete(handle);
    this.totalReleased++;
  }

  /**
   * Release all handles in this pool.
   *
   * Frees all handles and clears the pool. Does not dispose
   * the pool - new handles can still be created.
   */
  releaseAll(): void {
    for (const handle of this.handles) {
      try {
        handle.free();
      } catch (error) {
        // Silently handle errors during handle release
        gcHandleLogger.debug(`Error releasing handle ${handle.handle}: ${error}`);
      }
      this.totalReleased++;
    }
    this.handles.clear();
  }

  /**
   * Dispose this pool and release all handles.
   *
   * After disposal, no new handles can be created.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.releaseAll();
    this.disposed = true;
  }

  // ===== QUERY METHODS =====

  /**
   * Check if a handle is managed by this pool.
   * @param handle Handle to check
   */
  has(handle: GCHandle): boolean {
    return this.handles.has(handle);
  }

  /**
   * Get all handles in this pool.
   * @returns Array of handles (defensive copy)
   */
  getHandles(): GCHandle[] {
    return Array.from(this.handles);
  }

  /**
   * Get statistics about this pool.
   */
  getStats(): GCHandlePoolStats {
    let weakCount = 0;
    let strongCount = 0;

    for (const handle of this.handles) {
      if (handle.isWeak) {
        weakCount++;
      } else {
        strongCount++;
      }
    }

    return {
      totalCreated: this.totalCreated,
      totalReleased: this.totalReleased,
      activeCount: this.handles.size,
      weakCount,
      strongCount,
    };
  }

  // ===== ITERATION =====

  /**
   * Iterate over all handles in this pool.
   */
  [Symbol.iterator](): Iterator<GCHandle> {
    return this.handles[Symbol.iterator]();
  }

  /**
   * Execute a callback for each handle.
   * @param callback Function to call for each handle
   */
  forEach(callback: (handle: GCHandle) => void): void {
    for (const handle of this.handles) {
      callback(handle);
    }
  }

  // ===== INTERNAL =====

  private ensureNotDisposed(): void {
    if (this.disposed) {
      raise(
        MonoErrorCodes.DISPOSED,
        "GCHandlePool has been disposed",
        "Create a new pool or avoid using after disposal",
      );
    }
  }

  private validateObject(object: NativePointer, operation: string): void {
    if (pointerIsNull(object)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Cannot ${operation} handle for NULL object`,
        "Provide a valid managed object pointer",
      );
    }
  }
}

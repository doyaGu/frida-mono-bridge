/**
 * Thread Management - Mono thread attachment and execution context.
 *
 * Provides safe thread attachment for Mono runtime operations:
 * - Automatic attachment when executing Mono API calls
 * - Prevention of redundant nested attachments
 * - Thread lifecycle tracking and statistics
 * - Safe async operation support
 *
 * All Mono API calls must be made from an attached thread. This module
 * handles attachment automatically via the run() method.
 *
 * @module runtime/thread
 */

import { pointerIsNull } from "../utils/memory";
import { MonoApi } from "./api";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for thread-attached execution.
 */
export interface ThreadRunOptions {
  /**
   * Skip ensuring the thread is attached before running.
   * Only use this for operations already in an attached context.
   */
  attachIfNeeded?: boolean;

  /**
   * Timeout in milliseconds for the operation.
   * If exceeded, the operation may be interrupted.
   */
  timeout?: number;
}

/**
 * Statistics about thread attachment operations.
 */
export interface ThreadStats {
  /** Total number of attachments performed */
  totalAttachments: number;
  /** Currently attached threads */
  currentAttachedCount: number;
  /** Current active attachment contexts */
  activeContextCount: number;
  /** Thread IDs currently attached */
  attachedThreadIds: number[];
}

// ============================================================================
// THREAD MANAGER CLASS
// ============================================================================

/**
 * Manages thread attachment for Mono runtime operations.
 *
 * Tracks attached threads to avoid redundant attach/detach cycles
 * and provides safe execution contexts for Mono API calls.
 *
 * **Ownership Model**:
 * - Threads attached by the bridge are tracked as "bridge-owned"
 * - Only bridge-owned threads can be detached via `detachBridgeOwned()`
 * - External attachments (done before bridge interaction) are not touched
 *
 * @example
 * ```typescript
 * const manager = new ThreadManager(api);
 *
 * // Execute with automatic thread attachment
 * const result = manager.run(() => {
 *   return api.native.mono_get_root_domain();
 * });
 *
 * // Check statistics
 * console.log(manager.getStats());
 * ```
 */
export class ThreadManager {
  private readonly attachedThreads = new Map<number, NativePointer>();
  /** Threads detected as already-attached (not attached by the bridge) */
  private readonly externallyAttachedThreads = new Map<number, NativePointer>();
  private readonly activeAttachments = new Set<number>();
  /** Threads that were attached by the bridge (not externally) */
  private readonly bridgeOwnedThreads = new Set<number>();
  private totalAttachmentCount = 0;

  constructor(private readonly api: MonoApi) {}

  // ===== EXECUTION METHODS =====

  /**
   * Preferred execution helper. Ensures the callback executes with the thread attached
   * unless explicitly disabled via options.
   */
  run<T>(fn: () => T, options: ThreadRunOptions = {}): T {
    const { attachIfNeeded = true } = options;
    const threadId = getCurrentThreadId();

    // If thread is already in an attachment context, just execute the function
    if (this.activeAttachments.has(threadId)) {
      return fn();
    }

    if (!attachIfNeeded) {
      return fn();
    }

    // Mark thread as actively attached to prevent nested calls
    this.activeAttachments.add(threadId);
    try {
      this.ensureAttached(threadId);
      return fn();
    } finally {
      this.activeAttachments.delete(threadId);
    }
  }

  /**
   * Checks if the specified thread is currently in an active attachment context.
   * @param threadId Thread ID to check (defaults to current thread)
   * @returns True if thread is in active attachment context
   */
  isInAttachedContext(threadId = getCurrentThreadId()): boolean {
    return this.activeAttachments.has(threadId);
  }

  /**
   * Execute callback only attaching when the current context is not already attached.
   */
  runIfNeeded<T>(fn: () => T): T {
    if (this.isInAttachedContext()) {
      return fn();
    }
    return this.run(fn);
  }

  /**
   * Execute multiple operations with a single attachment.
   */
  runBatch<T extends any[]>(...operations: Array<() => any>): T {
    return this.run(() => operations.map(op => op()) as T);
  }

  /**
   * Ensures the specified thread is attached to the Mono runtime.
   * Returns the cached handle if already attached, otherwise attaches and caches.
   * @param threadId Thread ID to attach (defaults to current thread)
   * @returns Native pointer to the attached thread
   */
  ensureAttached(threadId = getCurrentThreadId()): NativePointer {
    const handle = this.attachedThreads.get(threadId);
    if (handle && !pointerIsNull(handle)) {
      return handle;
    }

    const externalHandle = this.externallyAttachedThreads.get(threadId);
    if (externalHandle && !pointerIsNull(externalHandle)) {
      return externalHandle;
    }

    // Best-effort: detect if the thread is already attached externally.
    // We must NOT call api.native.* here because that would auto-attach via this manager.
    // mono_domain_get() is a cheap TLS read and returns NULL for unattached threads.
    try {
      const domainGet = this.api.tryGetNativeFunction("mono_domain_get");
      if (domainGet) {
        const currentDomain = domainGet() as NativePointer;
        if (currentDomain && !pointerIsNull(currentDomain)) {
          // Thread appears attached (domain TLS is set). Try to get the thread object.
          const threadCurrent = this.api.tryGetNativeFunction("mono_thread_current");
          const threadObj = threadCurrent ? (threadCurrent() as NativePointer) : NULL;

          // If mono_thread_current is unavailable or returns NULL, fall back to mono_thread_attach
          // with the current domain (idempotent when already attached).
          const threadAttach = this.api.tryGetNativeFunction("mono_thread_attach");
          const resolvedThread = !pointerIsNull(threadObj)
            ? threadObj
            : threadAttach
              ? (threadAttach(currentDomain) as NativePointer)
              : NULL;

          if (resolvedThread && !pointerIsNull(resolvedThread)) {
            this.externallyAttachedThreads.set(threadId, resolvedThread);
            return resolvedThread;
          }
        }
      }
    } catch {
      // Ignore detection failures and proceed with normal attachment.
    }

    const attached = this.api.attachThread();
    this.attachedThreads.set(threadId, attached);
    this.totalAttachmentCount++;

    // If we got here, the bridge performed the attachment.
    this.bridgeOwnedThreads.add(threadId);
    return attached;
  }

  /**
   * Get statistics about thread attachments.
   * Useful for debugging and monitoring.
   */
  getStats(): ThreadStats {
    return {
      totalAttachments: this.totalAttachmentCount,
      currentAttachedCount: this.attachedThreads.size,
      activeContextCount: this.activeAttachments.size,
      attachedThreadIds: Array.from(this.attachedThreads.keys()),
    };
  }

  /**
   * Check if a specific thread is attached.
   * @param threadId Thread ID to check (defaults to current thread)
   */
  isAttached(threadId = getCurrentThreadId()): boolean {
    const handle = this.attachedThreads.get(threadId);
    if (handle !== undefined && !pointerIsNull(handle)) {
      return true;
    }

    const externalHandle = this.externallyAttachedThreads.get(threadId);
    if (externalHandle !== undefined && !pointerIsNull(externalHandle)) {
      return true;
    }

    // Last-resort check: domain TLS implies attachment.
    try {
      const domainGet = this.api.tryGetNativeFunction("mono_domain_get");
      if (domainGet) {
        const currentDomain = domainGet() as NativePointer;
        return currentDomain !== undefined && !pointerIsNull(currentDomain);
      }
    } catch {
      // ignore
    }

    return false;
  }

  /**
   * Check if a specific thread was attached by the bridge (not externally).
   * @param threadId Thread ID to check (defaults to current thread)
   */
  isBridgeOwned(threadId = getCurrentThreadId()): boolean {
    return this.bridgeOwnedThreads.has(threadId);
  }

  /**
   * Mark the current thread as bridge-owned.
   * Call this after ensureAttached() when the bridge is responsible for the attachment.
   * @param threadId Thread ID to mark (defaults to current thread)
   */
  markBridgeOwned(threadId = getCurrentThreadId()): void {
    if (this.isAttached(threadId)) {
      this.bridgeOwnedThreads.add(threadId);
    }
  }

  /**
   * Detach a bridge-owned thread from the Mono runtime.
   * Only detaches if the thread was attached by the bridge (not externally).
   *
   * @param threadId Thread ID to detach (defaults to current thread)
   * @returns True if thread was detached, false if not bridge-owned or not attached
   */
  detachBridgeOwned(threadId = getCurrentThreadId()): boolean {
    if (!this.bridgeOwnedThreads.has(threadId)) {
      // Not bridge-owned, don't touch it
      return false;
    }
    return this.detach(threadId);
  }

  /**
   * Detach a specific thread from the Mono runtime.
   *
   * WARNING: Detaching the current thread during active script execution will
   * cause Mono operations to fail. Only use this for cleanup of other threads
   * or at script termination.
   *
   * @param threadId Thread ID to detach (defaults to current thread)
   * @returns True if thread was detached, false if it wasn't attached
   */
  detach(threadId = getCurrentThreadId()): boolean {
    const handle = this.attachedThreads.get(threadId);
    if (!handle || pointerIsNull(handle)) {
      // Might be externally attached; never detach it.
      if (this.externallyAttachedThreads.has(threadId)) {
        return false;
      }
      return false;
    }

    try {
      this.api.detachThread(handle);
      this.attachedThreads.delete(threadId);
      this.activeAttachments.delete(threadId);
      this.bridgeOwnedThreads.delete(threadId);
      this.externallyAttachedThreads.delete(threadId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely detach the current thread if it is exiting.
   *
   * This uses mono_thread_detach_if_exiting which only performs detachment
   * if the thread is running pthread destructors. Safe to call at any time.
   *
   * @returns True if the thread was detached, false otherwise
   */
  detachIfExiting(): boolean {
    if (!this.api.hasExport("mono_thread_detach_if_exiting")) {
      return false;
    }

    try {
      const result = this.api.native.mono_thread_detach_if_exiting();
      if (result) {
        // Thread was detached, update internal state
        const threadId = getCurrentThreadId();
        this.attachedThreads.delete(threadId);
        this.activeAttachments.delete(threadId);
        this.bridgeOwnedThreads.delete(threadId);
        this.externallyAttachedThreads.delete(threadId);
      }
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Detaches all threads that were attached by this manager.
   *
   * WARNING: This will detach ALL threads including the current one.
   * Only call this during cleanup/disposal when no more Mono operations
   * are needed. The current thread uses detachIfExiting for safety.
   */
  detachAll(): void {
    const currentThreadId = getCurrentThreadId();

    for (const [threadId, threadHandle] of this.attachedThreads.entries()) {
      try {
        if (threadId === currentThreadId) {
          // For current thread, try safe detach first
          this.detachIfExiting();
        } else {
          this.api.detachThread(threadHandle);
        }
      } catch (_error) {
        // Best-effort detach; loggers can hook here once logging infrastructure exists.
      }
      this.attachedThreads.delete(threadId);
      this.activeAttachments.delete(threadId);
      this.bridgeOwnedThreads.delete(threadId);
      this.externallyAttachedThreads.delete(threadId);
    }
  }

  /**
   * Execute a callback with error handling and automatic cleanup on failure.
   * @param fn Callback to execute
   * @param onError Optional error handler
   */
  runSafe<T>(fn: () => T, onError?: (error: Error) => T | undefined): T | undefined {
    try {
      return this.run(fn);
    } catch (error) {
      if (onError) {
        return onError(error instanceof Error ? error : new Error(String(error)));
      }
      return undefined;
    }
  }

  /**
   * Execute an async operation with thread attachment.
   * Note: Frida's JavaScript runtime is single-threaded, but this helps with
   * Promise-based code patterns.
   */
  async runAsync<T>(fn: () => Promise<T>, options: ThreadRunOptions = {}): Promise<T> {
    const { attachIfNeeded = true } = options;
    const threadId = getCurrentThreadId();

    if (this.activeAttachments.has(threadId)) {
      return await fn();
    }

    if (!attachIfNeeded) {
      return await fn();
    }

    this.activeAttachments.add(threadId);
    try {
      this.ensureAttached(threadId);
      return await fn();
    } finally {
      this.activeAttachments.delete(threadId);
    }
  }
}

function getCurrentThreadId(): number {
  return Process.getCurrentThreadId();
}

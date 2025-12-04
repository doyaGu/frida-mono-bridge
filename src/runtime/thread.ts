import { MonoApi } from "./api";

/**
 * Thread management helper for Mono runtime.
 * Tracks attached threads per MonoApi instance to avoid redundant attach/detach cycles.
 */
export interface ThreadRunOptions {
  /**
   * Skip ensuring the thread is attached before running.
   * Only use this for operations that are already guaranteed to be in an attached context.
   */
  attachIfNeeded?: boolean;
  
  /**
   * Timeout in milliseconds for the operation.
   * If exceeded, the operation will be interrupted if possible.
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

export class ThreadManager {
  private readonly attachedThreads = new Map<number, NativePointer>();
  private readonly activeAttachments = new Set<number>();
  private totalAttachmentCount = 0;

  constructor(private readonly api: MonoApi) {}

  /**
   * Ensures the current thread is attached to the Mono runtime and executes the callback.
   * Avoids nested attachments by tracking active attachment contexts.
   * @param fn Callback to execute with thread attached
   * @returns Result of the callback
   */
  withAttachedThread<T>(fn: () => T): T {
    return this.run(fn);
  }

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
   * Detaches all threads that were attached by this manager.
   * Should be called during cleanup/disposal.
   */
  detachAll(): void {
    for (const [threadId, threadHandle] of this.attachedThreads.entries()) {
      try {
        this.api.detachThread(threadHandle);
      } catch (_error) {
        // Best-effort detach; loggers can hook here once logging infrastructure exists.
      }
      this.attachedThreads.delete(threadId);
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
    if (handle && !isNull(handle)) {
      return handle;
    }
    const attached = this.api.attachThread();
    this.attachedThreads.set(threadId, attached);
    this.totalAttachmentCount++;
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
    return handle !== undefined && !isNull(handle);
  }

  /**
   * Detach a specific thread.
   * @param threadId Thread ID to detach (defaults to current thread)
   * @returns True if thread was detached, false if it wasn't attached
   */
  detach(threadId = getCurrentThreadId()): boolean {
    const handle = this.attachedThreads.get(threadId);
    if (!handle || isNull(handle)) {
      return false;
    }
    
    try {
      this.api.detachThread(handle);
      this.attachedThreads.delete(threadId);
      this.activeAttachments.delete(threadId);
      return true;
    } catch {
      return false;
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
  async runAsync<T>(fn: () => Promise<T>): Promise<T> {
    return this.run(() => fn());
  }
}

function getCurrentThreadId(): number {
  if (typeof Process.getCurrentThreadId === "function") {
    return Process.getCurrentThreadId();
  }
  // As a fallback, use the JavaScript thread id (Frida currently runs agents on a single thread).
  return 0;
}

function isNull(pointer: NativePointer | null): boolean {
  if (pointer === null || pointer === undefined) {
    return true;
  }
  if (typeof pointer === "object" && typeof (pointer as any).isNull === "function") {
    return (pointer as any).isNull();
  }
  if (typeof pointer === "number") {
    return pointer === 0;
  }
  return false;
}
import { MonoApi } from "./api";

/**
 * Thread management helper for Mono runtime.
 * Tracks attached threads per MonoApi instance to avoid redundant attach/detach cycles.
 */
export class ThreadManager {
  private readonly attachedThreads = new Map<number, NativePointer>();
  private readonly activeAttachments = new Set<number>();

  constructor(private readonly api: MonoApi) {}

  /**
   * Ensures the current thread is attached to the Mono runtime and executes the callback.
   * Avoids nested attachments by tracking active attachment contexts.
   * @param fn Callback to execute with thread attached
   * @returns Result of the callback
   */
  withAttachedThread<T>(fn: () => T): T {
    const threadId = getCurrentThreadId();

    // If thread is already in an attachment context, just execute the function
    if (this.activeAttachments.has(threadId)) {
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
    return attached;
  }
}

/**
 * Legacy helper for backwards compatibility.
 * Prefers using ThreadManager from MonoApi instance.
 */
export function withAttachedThread<T>(api: MonoApi, fn: () => T): T {
  const threadManager = (api as any)._threadManager as ThreadManager | undefined;
  if (threadManager) {
    return threadManager.withAttachedThread(fn);
  }
  // Fallback for old code paths
  const threadId = getCurrentThreadId();
  ensureAttached(api, threadId);
  return fn();
}

/**
 * Legacy helper for backwards compatibility.
 * Prefers using ThreadManager from MonoApi instance.
 */
export function detachAll(api: MonoApi): void {
  const threadManager = (api as any)._threadManager as ThreadManager | undefined;
  if (threadManager) {
    threadManager.detachAll();
    return;
  }
}

/**
 * Legacy helper for backwards compatibility.
 * Prefers using ThreadManager from MonoApi instance.
 */
export function ensureAttached(api: MonoApi, threadId = getCurrentThreadId()): NativePointer {
  const threadManager = (api as any)._threadManager as ThreadManager | undefined;
  if (threadManager) {
    return threadManager.ensureAttached(threadId);
  }
  // Fallback - attach without caching (unsafe but maintains compatibility)
  return api.attachThread();
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

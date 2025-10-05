/**
 * Thread Model
 * High-level abstraction for Mono thread management
 */

import { MonoApi } from "../runtime/api";
import { pointerIsNull } from "../runtime/mem";

/**
 * Represents a thread attached to the Mono runtime.
 * Provides a high-level interface for thread operations.
 */
export class MonoThread {
  /**
   * Creates a MonoThread wrapper from a native MonoThread pointer.
   * @param api The MonoApi instance
   * @param handle Native pointer to MonoThread
   */
  constructor(
    public readonly api: MonoApi,
    public readonly handle: NativePointer
  ) {
    if (pointerIsNull(handle)) {
      throw new Error("MonoThread handle cannot be NULL");
    }
  }

  /**
   * Gets the current thread attached to the Mono runtime.
   * Automatically attaches the thread if not already attached.
   * 
   * @param api The MonoApi instance
   * @returns MonoThread instance representing the current thread
   * 
   * @example
   * const thread = MonoThread.current(Mono.api);
   * console.log(`Thread ID: ${thread.getId()}`);
   */
  static current(api: MonoApi): MonoThread {
    const handle = api.attachThread();
    return new MonoThread(api, handle);
  }

  /**
   * Attaches the current thread to the Mono runtime.
   * This is required before making any Mono API calls from a new thread.
   * 
   * @param api The MonoApi instance
   * @returns MonoThread instance representing the attached thread
   * 
   * @example
   * const thread = MonoThread.attach(Mono.api);
   * try {
   *   // Use Mono API...
   * } finally {
   *   thread.detach();
   * }
   */
  static attach(api: MonoApi): MonoThread {
    const handle = api.attachThread();
    return new MonoThread(api, handle);
  }

  /**
   * Executes a callback with the thread automatically attached.
   * The thread attachment is managed automatically.
   * 
   * @param api The MonoApi instance
   * @param fn Callback to execute
   * @returns Result of the callback
   * 
   * @example
   * const result = MonoThread.withAttached(Mono.api, () => {
   *   const domain = Mono.api.getRootDomain();
   *   return domain;
   * });
   */
  static withAttached<T>(api: MonoApi, fn: () => T): T {
    const threadManager = (api as any)._threadManager;
    if (threadManager && typeof threadManager.withAttachedThread === "function") {
      return threadManager.withAttachedThread(fn);
    }
    // Fallback
    const thread = MonoThread.attach(api);
    try {
      return fn();
    } finally {
      // Note: In practice, we don't detach as ThreadManager handles this
      // This is just for compatibility
    }
  }

  /**
   * Detaches this thread from the Mono runtime.
   * Should be called when the thread no longer needs to interact with Mono.
   * 
   * Note: The ThreadManager handles this automatically in most cases.
   * Only call this if you're manually managing thread lifecycle.
   * 
   * @example
   * const thread = MonoThread.attach(Mono.api);
   * try {
   *   // Use Mono API...
   * } finally {
   *   thread.detach();
   * }
   */
  detach(): void {
    try {
      this.api.detachThread(this.handle);
    } catch (error) {
      // Best effort detach
      console.warn("Failed to detach thread:", error);
    }
  }

  /**
   * Gets the thread ID.
   * Uses Frida's Process.getCurrentThreadId() if available.
   * 
   * @returns Thread ID as a number
   */
  static getId(): number {
    if (typeof Process.getCurrentThreadId === "function") {
      return Process.getCurrentThreadId();
    }
    return 0; // Fallback for single-threaded Frida environments
  }

  /**
   * Checks if a thread handle is valid (not NULL).
   * 
   * @param handle Thread handle to check
   * @returns True if the handle is valid
   */
  static isValid(handle: NativePointer | null | undefined): boolean {
    return handle != null && !pointerIsNull(handle);
  }

  /**
   * Returns a string representation of the thread.
   * 
   * @returns String representation
   */
  toString(): string {
    return `MonoThread(${this.handle})`;
  }

  /**
   * Returns the native pointer to the MonoThread structure.
   * 
   * @returns Native pointer
   */
  toPointer(): NativePointer {
    return this.handle;
  }
}

/**
 * Thread utilities and helper functions.
 */
export namespace MonoThread {
  /**
   * Ensures the current thread is attached to the Mono runtime.
   * This is a convenience function that returns the handle directly.
   * 
   * @param api The MonoApi instance
   * @returns Native pointer to the attached thread
   * 
   * @example
   * const handle = MonoThread.ensureAttached(Mono.api);
   */
  export function ensureAttached(api: MonoApi): NativePointer {
    const threadManager = (api as any)._threadManager;
    if (threadManager && typeof threadManager.ensureAttached === "function") {
      return threadManager.ensureAttached();
    }
    return api.attachThread();
  }

  /**
   * Detaches all threads managed by the ThreadManager.
   * This should be called during cleanup/disposal.
   * 
   * @param api The MonoApi instance
   * 
   * @example
   * // During cleanup
   * MonoThread.detachAll(Mono.api);
   */
  export function detachAll(api: MonoApi): void {
    const threadManager = (api as any)._threadManager;
    if (threadManager && typeof threadManager.detachAll === "function") {
      threadManager.detachAll();
    }
  }

  /**
   * Gets the current thread ID.
   * 
   * @returns Thread ID as a number
   */
  export function getCurrentId(): number {
    return MonoThread.getId();
  }
}

// Re-export for convenience
export { MonoThread as Thread };

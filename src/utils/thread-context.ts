/**
 * Thread Context Manager
 *
 * Centralizes all thread attachment/detachment logic.
 * All model classes delegate to this instead of calling withThread directly.
 */

import { MonoApi } from "../runtime/api";

export class ThreadContext {
  /**
   * Execute a function with thread attached
   * @param api Mono API instance
   * @param fn Function to execute
   * @returns Result of function
   */
  static execute<T>(api: MonoApi, fn: () => T): T {
    return api._threadManager.withAttachedThread(fn);
  }

  /**
   * Execute multiple operations in batch with single thread attachment
   * @param api Mono API instance
   * @param operations Array of operations to execute
   * @returns Array of results
   */
  static batch<T extends any[]>(api: MonoApi, ...operations: Array<() => any>): T {
    return this.execute(api, () => {
      return operations.map(op => op()) as T;
    });
  }

  /**
   * Execute operation only if not already in thread context
   * @param api Mono API instance
   * @param fn Function to execute
   * @returns Result of function
   */
  static maybeExecute<T>(api: MonoApi, fn: () => T): T {
    const threadManager = api._threadManager;
    if (threadManager && threadManager.isInAttachedContext()) {
      // Already in attached context, execute directly
      return fn();
    }
    // Not in attached context, use thread manager
    return this.execute(api, fn);
  }
}

/**
 * Thread Context Manager
 *
 * Centralizes all thread attachment/detachment logic.
 * All model classes delegate to this instead of calling withThread directly.
 */

import { MonoApi } from "../runtime/api";
import type { ThreadManager } from "../runtime/guard";

export class ThreadContext {
  /**
   * Execute a function with thread attached
   * @param api Mono API instance
   * @param fn Function to execute
   * @returns Result of function
   */
  static execute<T>(api: MonoApi, fn: () => T): T {
    return getManager(api).run(fn);
  }

  /**
   * Execute multiple operations in batch with single thread attachment
   * @param api Mono API instance
   * @param operations Array of operations to execute
   * @returns Array of results
   */
  static batch<T extends any[]>(api: MonoApi, ...operations: Array<() => any>): T {
    return getManager(api).runBatch(...operations);
  }

  /**
   * Execute operation only if not already in thread context
   * @param api Mono API instance
   * @param fn Function to execute
   * @returns Result of function
   */
  static maybeExecute<T>(api: MonoApi, fn: () => T): T {
    return getManager(api).runIfNeeded(fn);
  }
}

function getManager(api: MonoApi): ThreadManager {
  return api._threadManager as ThreadManager;
}

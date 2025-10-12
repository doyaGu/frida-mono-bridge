/**
 * Native Bridge - Automatic thread-safe wrapper for Mono API calls
 *
 * All native API calls are automatically wrapped with thread attachment.
 * Model classes don't need to worry about threads at all.
 */

import { MonoApi } from "../runtime/api";

/**
 * Wrap native API to automatically handle thread attachment
 */
export function createThreadSafeNative(api: MonoApi): any {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const original = target[prop];

      if (typeof original === 'function') {
        // Wrap all function calls with thread attachment
        return function (...args: any[]) {
          return api._threadManager.run(() => {
            return original.apply(target, args);
          });
        };
      }

      return original;
    }
  };

  return new Proxy(api.native, handler);
}

/**
 * Get thread-safe native API from MonoApi instance
 */
export function getThreadSafeNative(api: MonoApi): any {
  // Cache the wrapped native on the api instance
  const cacheKey = '__threadSafeNative__';
  if (!(api as any)[cacheKey]) {
    (api as any)[cacheKey] = createThreadSafeNative(api);
  }
  return (api as any)[cacheKey];
}

/**
 * Caching Decorator
 *
 * Caches the result of a getter on first access
 */

import { MonoValidationError } from "../patterns/errors";

import { LruCache } from "./lru-cache";

const CACHE_STORE = Symbol("__mono_cache_store__");
const VALUE_SLOT = "__value__";

export interface CacheOptions {
  /**
   * Key to use for caching (defaults to property name)
   */
  key?: string;
  /**
   * Maximum number of cached entries for this getter (defaults to 1)
   */
  capacity?: number;
}

/**
 * Decorator to cache getter results
 *
 * @example
 * class MyClass {
 *   @cached
   *   get expensiveValue() {
 *     return performExpensiveOperation();
 *   }
 * }
 */
export function cached(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalGet = descriptor.get;
    if (!originalGet) {
      throw new MonoValidationError("@cached can only be applied to getters", "descriptor", descriptor);
    }

    const cacheKey = options.key || `__cached_${propertyKey}__`;
    const capacity = options.capacity ?? 1;

    descriptor.get = function (this: any) {
      const store = ensureCacheStore(this);
      let cache = store.get(cacheKey);
      if (!cache) {
        cache = new LruCache<string, unknown>(capacity);
        store.set(cacheKey, cache);
      }

      if (cache.has(VALUE_SLOT)) {
        return cache.getSingleValue();
      }

      const value = originalGet.call(this);
      cache.setSingleValue(value);
      return value;
    };

    return descriptor;
  };
}

/**
 * Clear all cached values on an instance
 */
export function clearCache(instance: any): void {
  const store = instance[CACHE_STORE];
  if (store instanceof Map) {
    for (const cache of store.values()) {
      cache.clear();
    }
    store.clear();
  } else if (store) {
    instance[CACHE_STORE] = new Map<string, LruCache<string, unknown>>();
  }
}

/**
 * Clear a specific cached value
 */
export function clearCachedValue(instance: any, propertyKey: string): void {
  const store = instance[CACHE_STORE];
  if (store instanceof Map) {
    const cacheKey = `__cached_${propertyKey}__`;
    const cache = store.get(cacheKey);
    if (cache) {
      cache.clear();
      store.delete(cacheKey);
    }
  } else if (store) {
    const cacheKey = `__cached_${propertyKey}__`;
    delete store[cacheKey];
  }
}

function ensureCacheStore(instance: any): Map<string, LruCache<string, unknown>> {
  let store = instance[CACHE_STORE];
  if (!(store instanceof Map)) {
    store = new Map<string, LruCache<string, unknown>>();
    Object.defineProperty(instance, CACHE_STORE, {
      value: store,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
  return store;
}

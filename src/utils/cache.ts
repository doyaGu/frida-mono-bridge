/**
 * Caching Decorator
 *
 * Caches the result of a getter on first access
 */

const CACHE_KEY = Symbol("__cache__");

export interface CacheOptions {
  /**
   * Key to use for caching (defaults to property name)
   */
  key?: string;
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
      throw new Error("@cached can only be applied to getters");
    }

    const cacheKey = options.key || `__cached_${propertyKey}__`;

    descriptor.get = function (this: any) {
      // Check if we have a cached value
      if (!this[CACHE_KEY]) {
        this[CACHE_KEY] = {};
      }

      const cache = this[CACHE_KEY];
      if (cacheKey in cache) {
        return cache[cacheKey];
      }

      // Compute and cache the value
      const value = originalGet.call(this);
      cache[cacheKey] = value;
      return value;
    };

    return descriptor;
  };
}

/**
 * Clear all cached values on an instance
 */
export function clearCache(instance: any): void {
  if (instance[CACHE_KEY]) {
    instance[CACHE_KEY] = {};
  }
}

/**
 * Clear a specific cached value
 */
export function clearCachedValue(instance: any, propertyKey: string): void {
  if (instance[CACHE_KEY]) {
    const cacheKey = `__cached_${propertyKey}__`;
    delete instance[CACHE_KEY][cacheKey];
  }
}

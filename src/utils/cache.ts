/**
 * Caching utilities: LRU cache implementation and lazy evaluation decorators.
 *
 * Provides:
 * - `LruCache<K, V>`: Least-Recently-Used eviction cache
 * - `@lazy`: Property decorator for cached getters
 * - `@memoize()`: Method decorator for cached function calls
 *
 * @module utils/cache
 */

import { MonoErrorCodes, raise } from "./errors";

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

/** Configuration options for creating an LRU cache. */
export interface LruCacheOptions<K, V> {
  /** Maximum number of entries before eviction. */
  capacity: number;
  /** Callback invoked when an entry is evicted. */
  onEvict?: (key: K, value: V) => void;
}

const DEFAULT_VALUE_SLOT = "__value__" as const;

/**
 * Least-Recently-Used (LRU) cache.
 *
 * Evicts oldest-accessed entries when capacity is exceeded.
 */
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();
  private readonly capacity: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(capacity: number);
  constructor(options: LruCacheOptions<K, V>);
  constructor(capacityOrOptions: number | LruCacheOptions<K, V>) {
    if (typeof capacityOrOptions === "number") {
      this.capacity = capacityOrOptions;
      this.onEvict = undefined;
    } else {
      this.capacity = capacityOrOptions.capacity;
      this.onEvict = capacityOrOptions.onEvict;
    }

    if (this.capacity <= 0) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "LRU capacity must be positive",
        "Provide a capacity >= 1",
        { parameter: "capacity", value: this.capacity },
      );
    }
  }

  get size(): number {
    return this.map.size;
  }

  get maxSize(): number {
    return this.capacity;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  peek(key: K): V | undefined {
    return this.map.get(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);
    this.prune();
  }

  getOrCreate(key: K, factory: () => V): V {
    if (this.has(key)) {
      return this.get(key)!;
    }
    const value = factory();
    this.set(key, value);
    return value;
  }

  delete(key: K): boolean {
    if (!this.map.has(key)) {
      return false;
    }
    const value = this.map.get(key)!;
    this.map.delete(key);
    if (this.onEvict) {
      this.onEvict(key, value);
    }
    return true;
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, value] of this.map.entries()) {
        this.onEvict(key, value);
      }
    }
    this.map.clear();
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  forEach(callback: (value: V, key: K, cache: this) => void): void {
    for (const [key, value] of this.map.entries()) {
      callback(value, key, this);
    }
  }

  /**
   * Utility helper used by higher level caches that store a single value.
   */
  getSingleValue(slot: string = DEFAULT_VALUE_SLOT): V | undefined {
    return this.get(slot as unknown as K);
  }

  setSingleValue(value: V, slot: string = DEFAULT_VALUE_SLOT): void {
    this.set(slot as unknown as K, value);
  }

  clearSingleValue(slot: string = DEFAULT_VALUE_SLOT): void {
    this.delete(slot as unknown as K);
  }

  private prune(): void {
    if (!isFinite(this.capacity)) {
      return;
    }

    while (this.map.size > this.capacity) {
      // Get the first (oldest) key from the map
      const firstKey = this.map.keys().next().value;
      if (firstKey === undefined) {
        break;
      }
      const value = this.map.get(firstKey)!;
      this.map.delete(firstKey);
      if (this.onEvict) {
        this.onEvict(firstKey, value);
      }
    }
  }
}

// ============================================================================
// CACHING DECORATOR
// ============================================================================

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
  return function (_: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalGet = descriptor.get;
    if (!originalGet) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "@cached can only be applied to getters",
        "Apply @cached to a getter accessor",
        { parameter: "descriptor", value: descriptor },
      );
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

// ============================================================================
// LAZY DECORATOR
// ============================================================================

/**
 * Decorator to lazily evaluate and cache a getter's result.
 * After the first access, the getter is replaced with a simple value property.
 *
 * This is a lightweight alternative to @cached that doesn't use LRU cache,
 * suitable for values that are computed once and never change.
 *
 * @example
 * class MyClass {
 *   @lazy
 *   get expensiveValue(): string {
 *     return performExpensiveOperation();
 *   }
 * }
 */
export function lazy<This, Return>(
  target: (this: This) => Return,
  context: ClassGetterDecoratorContext<This, Return>,
): (this: This) => Return;
export function lazy(_target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor;
export function lazy(
  targetOrGetter: any,
  contextOrKey: ClassGetterDecoratorContext<any, any> | string | symbol,
  descriptor?: PropertyDescriptor,
): any {
  // TypeScript 5+ stage 3 decorators
  if (typeof contextOrKey === "object" && contextOrKey !== null && "kind" in contextOrKey) {
    const getter = targetOrGetter as (this: any) => any;
    const context = contextOrKey as ClassGetterDecoratorContext<any, any>;

    return function (this: any) {
      const value = getter.call(this);
      Object.defineProperty(this, context.name, {
        value,
        configurable: true,
        enumerable: false,
        writable: false,
      });
      return value;
    };
  }

  // Legacy TypeScript decorators (experimentalDecorators)
  const propertyKey = contextOrKey as string | symbol;
  const getter = descriptor?.get;

  if (!getter) {
    raise(
      MonoErrorCodes.INVALID_ARGUMENT,
      "@lazy can only be applied to getter accessors",
      "Apply @lazy to a getter accessor",
      { parameter: "descriptor", value: descriptor },
    );
  }

  descriptor!.get = function () {
    const value = getter.call(this);
    Object.defineProperty(this, propertyKey, {
      value,
      configurable: descriptor!.configurable,
      enumerable: descriptor!.enumerable,
      writable: false,
    });
    return value;
  };

  return descriptor;
}

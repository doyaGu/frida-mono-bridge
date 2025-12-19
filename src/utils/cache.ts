/**
 * Caching utilities: LRU cache implementation and lazy evaluation decorators.
 *
 * Provides:
 * - `LruCache<K, V>`: Least-Recently-Used eviction cache
 * - `@lazy`: Property decorator for cached getters
 * - `@memoize()`: Method decorator for cached function calls (LRU)
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
      raise(MonoErrorCodes.INVALID_ARGUMENT, "LRU capacity must be positive", "Provide a capacity >= 1", {
        parameter: "capacity",
        value: this.capacity,
      });
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
    this.notifyEvict(key, value);
    return true;
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, value] of this.map.entries()) {
        this.notifyEvict(key, value);
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
      this.notifyEvict(firstKey, value);
    }
  }

  private notifyEvict(key: K, value: V): void {
    if (this.onEvict) {
      this.onEvict(key, value);
    }
  }
}

// ============================================================================
// CACHING DECORATOR
// ============================================================================

const CACHE_STORE = Symbol("__mono_cache_store__");

/**
 * Clear all cached values on an instance.
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
// MEMOIZE DECORATOR
// ============================================================================

export interface MemoizeOptions<Args extends any[]> {
  /** Maximum number of cached argument combinations per instance (default: 128). */
  capacity?: number;
  /** Custom cache key generator (default: identity-aware args). */
  key?: (...args: Args) => string;
}

type MemoizeIdMap<T> = { get(value: T): number | undefined; set(value: T, id: number): unknown };

const memoizeObjectIds = new WeakMap<object, number>();
const memoizeSymbolIds = new Map<symbol, number>();
let memoizeNextId = 1;

function getMemoizeId<T>(map: MemoizeIdMap<T>, value: T): number {
  const existing = map.get(value);
  if (existing !== undefined) {
    return existing;
  }
  const id = memoizeNextId++;
  map.set(value, id);
  return id;
}

function formatNumberKey(value: number): string {
  if (Number.isNaN(value)) {
    return "NaN";
  }
  if (Object.is(value, -0)) {
    return "-0";
  }
  if (value === Infinity) {
    return "Infinity";
  }
  if (value === -Infinity) {
    return "-Infinity";
  }
  return String(value);
}

function memoizeKeyPart(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "u";
  }
  if (typeof value === "string") {
    return `s:${value.length}:${value}`;
  }
  if (typeof value === "number") {
    return `n:${formatNumberKey(value)}`;
  }
  if (typeof value === "bigint") {
    return `bi:${value.toString()}n`;
  }
  if (typeof value === "boolean") {
    return value ? "b:1" : "b:0";
  }
  if (typeof value === "symbol") {
    return `sym:${getMemoizeId(memoizeSymbolIds, value)}`;
  }
  if (typeof value === "function") {
    return `fn:${getMemoizeId(memoizeObjectIds, value as object)}`;
  }
  return `o:${getMemoizeId(memoizeObjectIds, value as object)}`;
}

function defaultMemoizeKey(args: unknown[]): string {
  if (args.length === 0) {
    return DEFAULT_VALUE_SLOT;
  }
  return args.map(arg => memoizeKeyPart(arg)).join("|");
}

/**
 * Decorator factory to memoize method results per instance.
 *
 * Uses an LRU cache per method per instance to avoid unbounded growth.
 *
 * @example
 * class Foo {
 *   @memoize()
 *   compute(x: number): number {
 *     return expensive(x);
 *   }
 * }
 */
export function memoize<Args extends any[], Return>(options: MemoizeOptions<Args> = {}) {
  return createMemoizedMethodDecorator<Args, Return>(options, "@memoize", "__memoize_");
}

type MemoizeMethodContext<This> = {
  kind: "method";
  name: string | symbol;
  addInitializer?: (initializer: (this: This) => void) => void;
};

function createMemoizedMethodDecorator<Args extends any[], Return>(
  options: MemoizeOptions<Args> = {},
  decoratorName: string,
  cachePrefix: string,
) {
  const capacity = options.capacity ?? 128;
  const keyFn = options.key ?? ((...args: Args) => defaultMemoizeKey(args));

  return function <This>(
    method: (this: This, ...args: Args) => Return,
    context: MemoizeMethodContext<This>,
  ): ((this: This, ...args: Args) => Return) | void {
    if (context.kind !== "method") {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `${decoratorName} can only be applied to methods`,
        `Apply ${decoratorName} to a class method`,
        { parameter: "context", value: context },
      );
    }

    const name = String(context.name);
    return function (this: This, ...args: Args): Return {
      const store = ensureCacheStore(this);
      const cacheKey = `${cachePrefix}${name}__`;
      let cache = store.get(cacheKey) as LruCache<string, Return> | undefined;
      if (!cache) {
        cache = new LruCache<string, Return>(capacity);
        store.set(cacheKey, cache as unknown as LruCache<string, unknown>);
      }

      const k = keyFn(...args);
      if (cache.has(k)) {
        return cache.get(k) as Return;
      }

      const value = method.call(this, ...args);
      cache.set(k, value);
      return value;
    };
  };
}

// ============================================================================
// LAZY DECORATOR
// ============================================================================

/**
 * Decorator to lazily evaluate and cache a getter's result.
 * After the first access, the getter is replaced with a simple value property.
 *
 * This is a lightweight alternative to @memoize when you want a value
 * computed once and cached without an LRU cache,
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
type LazyGetterContext<This> = {
  kind: "getter";
  name: string | symbol;
  addInitializer?: (initializer: (this: This) => void) => void;
};

export function lazy<This, Value>(
  getter: (this: This) => Value,
  context: LazyGetterContext<This>,
): ((this: This) => Value) | void {
  if (context.kind !== "getter") {
    raise(MonoErrorCodes.INVALID_ARGUMENT, "@lazy can only be applied to getters", "Apply @lazy to a getter accessor", {
      parameter: "context",
      value: context,
    });
  }

  const name = context.name;
  return function (this: This) {
    if (Object.prototype.hasOwnProperty.call(this, name)) {
      return (this as any)[name];
    }
    const value = getter.call(this);
    Object.defineProperty(this as any, name, {
      value,
      configurable: true,
      enumerable: false,
      writable: false,
    });
    return value;
  };
}

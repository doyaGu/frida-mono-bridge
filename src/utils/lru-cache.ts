import { MonoValidationError } from "../patterns/errors";

export interface LruCacheOptions<K, V> {
  capacity: number;
  onEvict?: (key: K, value: V) => void;
}

const DEFAULT_VALUE_SLOT = "__value__" as const;

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

    if (this.capacity <= 0 && this.capacity !== Infinity) {
      throw new MonoValidationError("LRU capacity must be positive", "capacity", this.capacity);
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
    if (this.capacity === Infinity) {
      return;
    }

    while (this.map.size > this.capacity) {
      const oldestEntry = this.map.entries().next();
      if (oldestEntry.done) {
        break;
      }
      const [key, value] = oldestEntry.value;
      this.map.delete(key);
      if (this.onEvict) {
        this.onEvict(key, value);
      }
    }
  }
}

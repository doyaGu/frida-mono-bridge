/**
 * Collections - Unified collection utilities and wrappers for Mono objects.
 *
 * Provides:
 * - LazyCollection: Generic lazy-loading iterable collection with caching
 * - Assembly/Class collection functions
 * - Grouping and indexing utilities
 *
 * @module collections
 */

import type { MonoApi } from "../runtime/api";
import { MonoErrorCodes, raise } from "../utils/errors";
import { MonoAssembly } from "./assembly";
import { MonoClass } from "./class";
import { MonoDomain } from "./domain";
import { MonoField } from "./field";
import { MonoImage } from "./image";
import { MonoMethod } from "./method";
import { MonoProperty } from "./property";

// ============================================================================
// GENERIC LAZY COLLECTION
// ============================================================================

/**
 * Generic lazy-loading collection that supports iteration.
 * Items are loaded on first access and cached for subsequent use.
 *
 * @typeParam T The item type in the collection
 *
 * @example
 * ```typescript
 * const methods = new LazyCollection(() => klass.methods);
 *
 * // Iteration triggers loading
 * for (const method of methods) {
 *   console.log(method.name);
 * }
 *
 * // Subsequent access uses cache
 * console.log(`Total: ${methods.length}`);
 * ```
 */
export class LazyCollection<T> implements Iterable<T> {
  private _items: T[] | null = null;
  private readonly _loader: () => T[];

  /**
   * Create a new lazy collection.
   * @param loader Function that loads the items (called once on first access)
   */
  constructor(loader: () => T[]) {
    this._loader = loader;
  }

  // ===== CORE PROPERTIES =====

  /**
   * Get all items in the collection.
   * Triggers loading on first access.
   */
  get items(): T[] {
    if (this._items === null) {
      this._items = this._loader();
    }
    return this._items;
  }

  /**
   * Get the number of items.
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * Check if the collection is empty.
   */
  get isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Check if items have been loaded.
   */
  get isLoaded(): boolean {
    return this._items !== null;
  }

  // ===== ITERATION =====

  /**
   * Iterate over all items.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    yield* this.items;
  }

  /**
   * Iterate with indices.
   */
  *entries(): IterableIterator<[number, T]> {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      yield [i, items[i]];
    }
  }

  /**
   * Iterate over indices.
   */
  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.length; i++) {
      yield i;
    }
  }

  /**
   * Iterate over values (alias for Symbol.iterator).
   */
  *values(): IterableIterator<T> {
    yield* this.items;
  }

  // ===== ACCESS METHODS =====

  /**
   * Get item at index with bounds checking.
   * @param index The index (supports negative indices)
   * @returns The item at the index
   * @throws {MonoValidationError} If index is out of bounds
   */
  at(index: number): T {
    const items = this.items;
    const normalizedIndex = index < 0 ? items.length + index : index;
    if (normalizedIndex < 0 || normalizedIndex >= items.length) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} out of bounds (0..${items.length - 1})`,
        "Use tryAt() to avoid throwing",
        { index, length: items.length },
      );
    }
    return items[normalizedIndex];
  }

  /**
   * Try to get item at index without throwing.
   * @param index The index (supports negative indices)
   * @returns The item or undefined if out of bounds
   */
  tryAt(index: number): T | undefined {
    const items = this.items;
    const normalizedIndex = index < 0 ? items.length + index : index;
    return items[normalizedIndex];
  }

  /**
   * Get the first item.
   */
  get first(): T | undefined {
    return this.items[0];
  }

  /**
   * Get the last item.
   */
  get last(): T | undefined {
    const items = this.items;
    return items[items.length - 1];
  }

  // ===== ARRAY-LIKE METHODS =====

  /**
   * Find an item matching a predicate.
   */
  find(predicate: (item: T, index: number) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  /**
   * Find the index of an item matching a predicate.
   */
  findIndex(predicate: (item: T, index: number) => boolean): number {
    return this.items.findIndex(predicate);
  }

  /**
   * Find the last item matching a predicate.
   */
  findLast(predicate: (item: T, index: number) => boolean): T | undefined {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      if (predicate(items[i], i)) {
        return items[i];
      }
    }
    return undefined;
  }

  /**
   * Filter items matching a predicate.
   */
  filter(predicate: (item: T, index: number) => boolean): T[] {
    return this.items.filter(predicate);
  }

  /**
   * Map items to a new array.
   */
  map<U>(mapper: (item: T, index: number) => U): U[] {
    return this.items.map(mapper);
  }

  /**
   * Check if any item matches a predicate.
   */
  some(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.some(predicate);
  }

  /**
   * Check if all items match a predicate.
   */
  every(predicate: (item: T, index: number) => boolean): boolean {
    return this.items.every(predicate);
  }

  /**
   * Execute a function for each item.
   */
  forEach(callback: (item: T, index: number) => void): void {
    this.items.forEach(callback);
  }

  /**
   * Reduce items to a single value.
   */
  reduce<U>(reducer: (accumulator: U, item: T, index: number) => U, initialValue: U): U {
    return this.items.reduce(reducer, initialValue);
  }

  /**
   * Check if the collection includes an item.
   */
  includes(item: T): boolean {
    return this.items.includes(item);
  }

  // ===== CONVERSION =====

  /**
   * Convert to array.
   */
  toArray(): T[] {
    return [...this.items];
  }

  /**
   * Convert to Set.
   */
  toSet(): Set<T> {
    return new Set(this.items);
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Clear the cache, forcing reload on next access.
   */
  invalidate(): void {
    this._items = null;
  }

  /**
   * Force immediate loading.
   */
  preload(): T[] {
    return this.items;
  }
}

// ============================================================================
// MONO-SPECIFIC COLLECTION TYPES
// ============================================================================

/**
 * Collection of methods with name-based lookup.
 */
export class MethodCollection extends LazyCollection<MonoMethod> {
  private _byName: Map<string, MonoMethod[]> | null = null;

  /**
   * Get methods indexed by name.
   */
  get byName(): Map<string, MonoMethod[]> {
    if (this._byName === null) {
      this._byName = indexMethodsByName(this.items);
    }
    return this._byName;
  }

  /**
   * Find methods by name.
   */
  findByName(name: string): MonoMethod[] {
    return this.byName.get(name) ?? [];
  }

  /**
   * Find a single method by name (first match).
   */
  findOneByName(name: string): MonoMethod | undefined {
    return this.findByName(name)[0];
  }

  override invalidate(): void {
    super.invalidate();
    this._byName = null;
  }
}

/**
 * Collection of classes with namespace-based grouping.
 */
export class ClassCollection extends LazyCollection<MonoClass> {
  private _byNamespace: Map<string, MonoClass[]> | null = null;

  /**
   * Get classes grouped by namespace.
   */
  get byNamespace(): Map<string, MonoClass[]> {
    if (this._byNamespace === null) {
      this._byNamespace = groupClassesByNamespace(this.items);
    }
    return this._byNamespace;
  }

  /**
   * Get all unique namespaces.
   */
  get namespaces(): string[] {
    return Array.from(this.byNamespace.keys()).sort();
  }

  /**
   * Find classes in a namespace.
   */
  findByNamespace(namespace: string): MonoClass[] {
    return this.byNamespace.get(namespace) ?? [];
  }

  /**
   * Find a class by full name.
   */
  findByFullName(fullName: string): MonoClass | undefined {
    return this.find(c => c.fullName === fullName);
  }

  override invalidate(): void {
    super.invalidate();
    this._byNamespace = null;
  }
}

// ============================================================================
// COLLECTION INTERFACES
// ============================================================================

export interface AssemblySummary {
  assembly: MonoAssembly;
  image: MonoImage;
  classes?: MonoClass[];
}

export interface AssemblyCollectionOptions {
  domain?: MonoDomain;
  includeClasses?: boolean;
  filter?: (assembly: MonoAssembly) => boolean;
  classFilter?: (klass: MonoClass) => boolean;
}

export interface ClassSummary {
  assembly: MonoAssembly;
  image: MonoImage;
  klass: MonoClass;
  methods?: MonoMethod[];
}

export interface ClassCollectionOptions extends AssemblyCollectionOptions {
  includeMethods?: boolean;
  methodFilter?: (method: MonoMethod) => boolean;
}

export function collectAssemblies(api: MonoApi, options: AssemblyCollectionOptions = {}): AssemblySummary[] {
  const domain = options.domain ?? MonoDomain.getRoot(api);
  const assemblies = domain.assemblies;
  const summaries: AssemblySummary[] = [];

  for (const assembly of assemblies) {
    if (options.filter && !options.filter(assembly)) {
      continue;
    }

    const image = assembly.image;
    let classes: MonoClass[] | undefined;

    if (options.includeClasses) {
      const collected = image.classes;
      classes = options.classFilter ? collected.filter(options.classFilter) : collected;
    }

    summaries.push({ assembly, image, classes });
  }

  return summaries;
}

export function collectClasses(api: MonoApi, options: ClassCollectionOptions = {}): ClassSummary[] {
  const assemblySummaries = collectAssemblies(api, { ...options, includeClasses: true });
  const summaries: ClassSummary[] = [];

  for (const entry of assemblySummaries) {
    if (!entry.classes) {
      continue;
    }

    for (const klass of entry.classes) {
      if (options.classFilter && !options.classFilter(klass)) {
        continue;
      }

      let methods: MonoMethod[] | undefined;
      if (options.includeMethods) {
        const collected = klass.methods;
        methods = options.methodFilter ? collected.filter(options.methodFilter) : collected;
      }

      summaries.push({ assembly: entry.assembly, image: entry.image, klass, methods });
    }
  }

  return summaries;
}

export function groupClassesByNamespace(classes: Iterable<MonoClass>): Map<string, MonoClass[]> {
  const index = new Map<string, MonoClass[]>();
  for (const klass of classes) {
    const key = klass.namespace || "";
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(klass);
  }
  return index;
}

export function indexMethodsByName(methods: Iterable<MonoMethod>): Map<string, MonoMethod[]> {
  const index = new Map<string, MonoMethod[]>();
  for (const method of methods) {
    const key = method.name;
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(method);
  }
  return index;
}

/**
 * Index fields by name.
 */
export function indexFieldsByName(fields: Iterable<MonoField>): Map<string, MonoField[]> {
  const index = new Map<string, MonoField[]>();
  for (const field of fields) {
    const key = field.name;
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(field);
  }
  return index;
}

/**
 * Index properties by name.
 */
export function indexPropertiesByName(properties: Iterable<MonoProperty>): Map<string, MonoProperty[]> {
  const index = new Map<string, MonoProperty[]>();
  for (const prop of properties) {
    const key = prop.name;
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(prop);
  }
  return index;
}

/**
 * Generic indexing function.
 * @param items Items to index
 * @param keyFn Function to extract key from item
 */
export function indexBy<T, K>(items: Iterable<T>, keyFn: (item: T) => K): Map<K, T[]> {
  const index = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(item);
  }
  return index;
}

/**
 * Create a unique index (one item per key).
 * Later items override earlier ones with the same key.
 */
export function uniqueIndexBy<T, K>(items: Iterable<T>, keyFn: (item: T) => K): Map<K, T> {
  const index = new Map<K, T>();
  for (const item of items) {
    index.set(keyFn(item), item);
  }
  return index;
}

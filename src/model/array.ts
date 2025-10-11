import { MonoApi } from "../runtime/api";
import { MonoObject } from "./object";
import { MonoClass } from "./class";
import { MonoTypeKind } from "./type";
import { pointerIsNull } from "../runtime/mem";

// ===== TYPE DEFINITIONS AND GUARDS =====

/**
 * Type guards for MonoArray operations
 */
export namespace ArrayTypeGuards {
  /**
   * Check if array contains numeric values
   */
  export function isNumericArray(array: MonoArray<any>): array is MonoArray<number> {
    const elementClass = array.getElementClass();
    const type = elementClass.getType();
    const kind = type.getKind();

    return kind >= MonoTypeKind.I1 && kind <= MonoTypeKind.R8;
  }

  /**
   * Check if array contains string values
   */
  export function isStringArray(array: MonoArray<any>): array is MonoArray<string> {
    const elementClass = array.getElementClass();
    const type = elementClass.getType();
    return type.getKind() === MonoTypeKind.String;
  }

  /**
   * Check if array contains object references
   */
  export function isObjectArray(array: MonoArray<any>): array is MonoArray<MonoObject> {
    const elementClass = array.getElementClass();
    return !elementClass.isValueType();
  }

  /**
   * Check if array contains enum values
   */
  export function isEnumArray(array: MonoArray<any>): array is MonoArray<number> {
    const elementClass = array.getElementClass();
    return elementClass.isEnum();
  }

  /**
   * Check if array is of specific element type
   */
  export function isOfType<T>(array: MonoArray<any>, expectedType: new (...args: any[]) => T): array is MonoArray<T> {
    const elementClass = array.getElementClass();
    // This would need proper type comparison in actual implementation
    return true; // Placeholder
  }
}

/**
 * Enhanced type constraints for MonoArray operations
 */
export type ArrayElementType<T> = T extends MonoArray<infer U> ? U : never;

/**
 * Type-safe array element operations
 */
export interface TypedArrayOperations<T> {
  /**
   * Get element with type safety
   */
  getTyped(index: number): T;

  /**
   * Set element with type safety
   */
  setTyped(index: number, value: T): void;

  /**
   * Filter with type-safe predicate
   */
  where<S extends T>(predicate: (item: T) => item is S): MonoArray<S>;

  /**
   * Transform with type-safe selector
   */
  select<R>(selector: (item: T) => R): R[];
}

/**
 * Compile-time constraints for array operations
 */
export type ArrayConstraints = {
  /**
   * Ensure index is within bounds
   */
  IndexInRange<T extends number, U extends number>(
    index: T,
    length: U
  ): T extends U ? never : T;

  /**
   * Ensure array has elements
   */
  HasElements<T extends { length: number }>(
    array: T
  ): T['length'] extends 0 ? never : T;

  /**
   * Ensure non-null element
   */
  NonNull<T>(item: T): T extends null | undefined ? never : T;
};

/**
 * Type-safe array factory functions
 */
export namespace TypedArrayFactory {
  /**
   * Create numeric array with type safety
   */
  export function createNumericArray(
    api: MonoApi,
    elementType: 'int8' | 'int16' | 'int32' | 'int64' | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'float32' | 'float64',
    length: number
  ): MonoArray<number> {
    // Implementation would find appropriate numeric type
    const domain = api.getRootDomain();
    const elementClass = api.native.mono_class_from_name(domain, "mscorlib", elementType) as NativePointer;
    if (pointerIsNull(elementClass)) {
      throw new Error(`Could not find class: System.${elementType}`);
    }
    const classObj = new MonoClass(api, elementClass);
    return MonoArray.new(api, classObj, length) as MonoArray<number>;
  }

  /**
   * Create string array with type safety
   */
  export function createStringArray(api: MonoApi, length: number): MonoArray<string> {
    const domain = api.getRootDomain();
    const stringClass = api.native.mono_class_from_name(domain, "mscorlib", "String") as NativePointer;
    if (pointerIsNull(stringClass)) {
      throw new Error("Could not find class: System.String");
    }
    const classObj = new MonoClass(api, stringClass);
    return MonoArray.new(api, classObj, length) as MonoArray<string>;
  }

  /**
   * Create object array with type safety
   */
  export function createObjectArray<T extends MonoObject>(
    api: MonoApi,
    elementClass: MonoClass,
    length: number
  ): MonoArray<T> {
    return MonoArray.new(api, elementClass, length) as MonoArray<T>;
  }
}

/**
 * Change event for array elements
 */
export interface ArrayChangeEvent<T> {
  index: number;
  oldValue: T;
  newValue: T;
  timestamp: number;
  changeType: 'set' | 'clear' | 'bulk';
}

/**
 * Array access statistics
 */
export interface ArrayAccessStats {
  reads: number;
  writes: number;
  lastRead: number | null;
  lastWrite: number | null;
  readIndices: Set<number>;
  writeIndices: Set<number>;
  mostAccessedIndex: number | null;
}

/**
 * Change tracking statistics
 */
export interface ChangeSummary {
  totalChanges: number;
  uniqueIndicesChanged: number;
  averageChangesPerIndex: number;
  mostChangedIndex: { index: number; count: number } | null;
  changeRate: number; // changes per minute
}

/**
 * Serialized array data
 */
export interface SerializedArray<T> {
  type: 'MonoArray';
  elementType: {
    name: string;
    fullName: string;
    namespace: string;
    isValueType: boolean;
    isEnum: boolean;
  };
  length: number;
  elementSize: number;
  elements: any[];
  metadata: {
    changeTracking: boolean;
    monitoring: boolean;
    accessStats: ArrayAccessStats | null;
    changeHistory: any;
  };
  serializationInfo: {
    timestamp: number;
    version: string;
    format: string;
  };
}

/**
 * Array change tracker
 */
export class ArrayChangeTracker<T> {
  private history: ArrayChangeEvent<T>[] = [];
  private maxHistorySize: number;

  constructor(private array: MonoArray<T>, maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Record a change event
   */
  recordChange(event: ArrayChangeEvent<T>): void {
    this.history.push(event);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get change history
   */
  getHistory(): ArrayChangeEvent<T>[] {
    return [...this.history];
  }

  /**
   * Get changes for a specific index
   */
  getChangesForIndex(index: number): ArrayChangeEvent<T>[] {
    return this.history.filter(change => change.index === index);
  }

  /**
   * Get change summary statistics
   */
  getChangeSummary(): ChangeSummary {
    const totalChanges = this.history.length;
    const changedIndices = new Set(this.history.map(change => change.index));
    const uniqueIndicesChanged = changedIndices.size;

    // Find most changed index
    let mostChangedIndex = null;
    let maxChanges = 0;

    for (const index of changedIndices) {
      const indexChanges = this.getChangesForIndex(index).length;
      if (indexChanges > maxChanges) {
        maxChanges = indexChanges;
        mostChangedIndex = { index, count: indexChanges };
      }
    }

    // Calculate change rate (changes per minute)
    const oldestChange = this.history[0];
    const newestChange = this.history[this.history.length - 1];
    let changeRate = 0;

    if (oldestChange && newestChange) {
      const timeSpanMinutes = (newestChange.timestamp - oldestChange.timestamp) / 60000;
      if (timeSpanMinutes > 0) {
        changeRate = totalChanges / timeSpanMinutes;
      }
    }

    return {
      totalChanges,
      uniqueIndicesChanged,
      averageChangesPerIndex: uniqueIndicesChanged > 0 ? totalChanges / uniqueIndicesChanged : 0,
      mostChangedIndex,
      changeRate
    };
  }

  /**
   * Find when an index was last changed
   */
  getLastChangeTime(index: number): number | null {
    const indexChanges = this.getChangesForIndex(index);
    if (indexChanges.length === 0) return null;

    return Math.max(...indexChanges.map(change => change.timestamp));
  }

  /**
   * Clear change history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Export change data for serialization
   */
  exportData(): {
    history: ArrayChangeEvent<T>[];
    summary: ChangeSummary;
    exportTime: number;
  } {
    return {
      history: this.getHistory(),
      summary: this.getChangeSummary(),
      exportTime: Date.now()
    };
  }
}

/**
 * Represents a Mono array object (System.Array) with enhanced functionality
 */
export class MonoArray<T = any> extends MonoObject {
  private _elementClass: MonoClass | null = null;
  private _elementSize: number | null = null;
  private _changeTracker: ArrayChangeTracker<T> | null = null;
  private _monitoringEnabled: boolean = false;
  private _accessStats: ArrayAccessStats = {
    reads: 0,
    writes: 0,
    lastRead: null,
    lastWrite: null,
    readIndices: new Set(),
    writeIndices: new Set(),
    mostAccessedIndex: null
  };

  /**
   * Get the length of the array
   */
  get length(): number {
    return this.getLength();
  }

  /**
   * Get the element class of the array
   */
  get elementClass(): MonoClass {
    return this.getElementClass();
  }

  /**
   * Get the element size in bytes
   */
  get elementSize(): number {
    return this.getElementSize();
  }

  /**
   * Get array length
   */
  getLength(): number {
    return this.native.mono_array_length(this.pointer) as number;
  }

  /**
   * Get element class
   */
  getElementClass(): MonoClass {
    if (this._elementClass) {
      return this._elementClass;
    }
    const classPtr = this.native.mono_array_element_class(this.pointer);
    this._elementClass = new MonoClass(this.api, classPtr);
    return this._elementClass;
  }

  /**
   * Get element size in bytes
   */
  getElementSize(): number {
    if (this._elementSize !== null) {
      return this._elementSize;
    }
    this._elementSize = this.native.mono_array_element_size(this.pointer) as number;
    return this._elementSize;
  }

  /**
   * Get element at the specified index
   * @param index Element index
   * @returns Element pointer
   */
  getElementAddress(index: number): NativePointer {
    const address = this.native.mono_array_addr_with_size(this.pointer, index);
    return address;
  }

  // ===== BASIC ARRAY OPERATIONS =====

  /**
   * Get a value as a number (for numeric arrays)
   * @param index Element index
   * @returns Number value
   */
  getNumber(index: number): number {
    this._recordRead(index);
    const address = this.getElementAddress(index);
    const elementSize = this.getElementSize();

    switch (elementSize) {
      case 1: return address.readU8();
      case 2: return address.readU16();
      case 4: return address.readU32();
      case 8: return address.readU64().toNumber();
      default: throw new Error(`Unsupported element size: ${elementSize}`);
    }
  }

  /**
   * Set a number value (for numeric arrays)
   * @param index Element index
   * @param value Number value
   */
  setNumber(index: number, value: number): void {
    const oldValue = this.getNumber(index);
    const address = this.getElementAddress(index);
    const elementSize = this.getElementSize();

    switch (elementSize) {
      case 1: address.writeU8(value); break;
      case 2: address.writeU16(value); break;
      case 4: address.writeU32(value); break;
      case 8: address.writeU64(value); break;
      default: throw new Error(`Unsupported element size: ${elementSize}`);
    }

    this._recordWrite(index, oldValue as T, value as T);
  }

  /**
   * Get a reference element (for object arrays)
   * @param index Element index
   * @returns Object pointer
   */
  getReference(index: number): NativePointer {
    this._recordRead(index);
    const address = this.getElementAddress(index);
    return address.readPointer();
  }

  /**
   * Set a reference element (for object arrays)
   * @param index Element index
   * @param value Object pointer to set
   */
  setReference(index: number, value: NativePointer): void {
    const oldValue = this.getReference(index);
    const address = this.getElementAddress(index);
    address.writePointer(value);
    this._recordWrite(index, new MonoObject(this.api, oldValue) as T, new MonoObject(this.api, value) as T);
  }

  /**
   * Get element as MonoObject (for object arrays)
   * @param index Element index
   * @returns MonoObject instance
   */
  get(index: number): MonoObject {
    const ptr = this.getReference(index);
    return new MonoObject(this.api, ptr);
  }

  /**
   * Set element as MonoObject (for object arrays)
   * @param index Element index
   * @param value MonoObject to set
   */
  set(index: number, value: MonoObject): void {
    this.setReference(index, value.pointer);
  }

  // ===== GENERIC TYPE-SAFE METHODS =====

  /**
   * Get a typed value with enhanced type safety
   * @param index Element index
   * @returns Typed value
   */
  getTyped(index: number): T {
    this._recordRead(index);

    // Bounds checking at compile time (if possible)
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }

    if (this.getElementClass().isValueType()) {
      return this.getNumber(index) as T;
    } else {
      return this.get(index) as T;
    }
  }

  /**
   * Set a typed value with enhanced type safety
   * @param index Element index
   * @param value Value to set
   */
  setTyped(index: number, value: T): void {
    // Bounds checking
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }

    // Type validation
    this._validateValueType(value);

    if (this.getElementClass().isValueType()) {
      this.setNumber(index, value as number);
    } else {
      if (value instanceof MonoObject) {
        this.set(index, value);
      } else {
        throw new Error(`Cannot set non-MonoObject value in object array`);
      }
    }
  }

  /**
   * Type-safe numeric array operations
   */
  getNumericOperations(): {
    sum: () => number;
    average: () => number;
    min: () => number;
    max: () => number;
    product: () => number;
  } | null {
    if (!ArrayTypeGuards.isNumericArray(this)) {
      return null;
    }

    return {
      sum: () => {
        return this.aggregate((acc, val) => acc + (val as number), 0);
      },
      average: () => {
        return this.length > 0 ? this.aggregate((acc, val) => acc + (val as number), 0) / this.length : 0;
      },
      min: () => {
        return this.aggregate((acc, val) => Math.min(acc, val as number), this.getTyped(0) as number);
      },
      max: () => {
        return this.aggregate((acc, val) => Math.max(acc, val as number), this.getTyped(0) as number);
      },
      product: () => {
        return this.aggregate((acc, val) => acc * (val as number), 1);
      }
    };
  }

  /**
   * Type-safe string array operations
   */
  getStringOperations(): {
    join: (separator?: string) => string;
    concat: () => string;
    startsWith: (prefix: string) => boolean;
    endsWith: (suffix: string) => boolean;
    contains: (substring: string) => boolean;
  } | null {
    if (!ArrayTypeGuards.isStringArray(this)) {
      return null;
    }

    return {
      join: (separator = '') => this.select(item => item as string).join(separator),
      concat: () => this.select(item => item as string).join(''),
      startsWith: (prefix) => this.any(item => (item as string).startsWith(prefix)),
      endsWith: (suffix) => this.any(item => (item as string).endsWith(suffix)),
      contains: (substring) => this.any(item => (item as string).includes(substring))
    };
  }

  /**
   * Type-safe object array operations
   */
  getObjectOperations<U extends MonoObject>(): {
    findByType: <V extends U>(type: new (...args: any[]) => V) => V | null;
    filterByType: <V extends U>(type: new (...args: any[]) => V) => V[];
    invokeOnAll: (methodName: string, ...args: any[]) => void;
  } | null {
    if (!ArrayTypeGuards.isObjectArray(this)) {
      return null;
    }

    return {
      findByType: <V extends U>(type: new (...args: any[]) => V) => {
        return this.first(item => item instanceof type) as V | null;
      },
      filterByType: <V extends U>(type: new (...args: any[]) => V) => {
        return this.where(item => item instanceof type) as unknown as V[];
      },
      invokeOnAll: (methodName: string, ...args: any[]) => {
        for (let i = 0; i < this.length; i++) {
          const item = this.get(i) as any;
          if (typeof item[methodName] === 'function') {
            item[methodName](...args);
          }
        }
      }
    };
  }

  /**
   * Enhanced LINQ with type safety
   */
  whereType<S extends T>(predicate: (item: T) => item is S): MonoArray<S> {
    const filtered = this.where(predicate);
    // Return as MonoArray<S> - this would need actual array type conversion
    return this as unknown as MonoArray<S>;
  }

  /**
   * Type-safe firstOrDefault
   */
  firstOrDefault<S extends T>(predicate?: (item: T) => item is S, defaultValue?: S): S | null {
    const result = predicate ? this.first(predicate) : this.first();
    return result !== null ? result as S : (defaultValue ?? null);
  }

  /**
   * Type-safe element validation
   */
  validateElement(index: number): {
    isValid: boolean;
    errors: string[];
    element: T | null;
  } {
    const errors: string[] = [];

    try {
      if (index < 0 || index >= this.length) {
        errors.push(`Index ${index} is out of bounds`);
        return { isValid: false, errors, element: null };
      }

      const element = this.getTyped(index);
      this._validateValueType(element);

      return { isValid: true, errors, element };
    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return { isValid: false, errors, element: null };
    }
  }

  /**
   * Type-safe array conversion
   */
  toTypedArray<U>(): U[] {
    return this.select(item => item as unknown as U);
  }

  /**
   * Enhanced type checking for operations
   */
  ensureOperationValidity(operation: 'read' | 'write' | 'modify'): {
    isValid: boolean;
    restrictions: string[];
    recommendations: string[];
  } {
    const restrictions: string[] = [];
    const recommendations: string[] = [];

    // Check if element type supports the operation
    const elementClass = this.getElementClass();
    const isValueType = elementClass.isValueType();

    switch (operation) {
      case 'read':
        if (isValueType && this.length > 10000) {
          recommendations.push('Large value type array - consider optimizing read patterns');
        }
        break;

      case 'write':
        if (isValueType && this.length > 5000) {
          recommendations.push('Large value type array - consider batch write operations');
        }
        if (elementClass.isEnum()) {
          restrictions.push('Enum values should be validated before writing');
        }
        break;

      case 'modify':
        if (!this.isChangeTrackingEnabled()) {
          recommendations.push('Enable change tracking to monitor modifications');
        }
        break;
    }

    return {
      isValid: restrictions.length === 0,
      restrictions,
      recommendations
    };
  }

  // ===== LINQ-LIKE METHODS =====

  /**
   * Filter elements based on predicate
   * @param predicate Filter function
   * @returns Filtered array
   */
  where(predicate: (item: T, index: number) => boolean): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (predicate(item, i)) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Transform elements using selector function
   * @param selector Transform function
   * @returns Transformed array
   */
  select<TResult>(selector: (item: T, index: number) => TResult): TResult[] {
    const result: TResult[] = [];
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      result.push(selector(item, i));
    }
    return result;
  }

  /**
   * Get first element that satisfies predicate
   * @param predicate Filter function
   * @returns First matching element or null
   */
  first(predicate?: (item: T, index: number) => boolean): T | null {
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (!predicate || predicate(item, i)) {
        return item;
      }
    }
    return null;
  }

  /**
   * Get last element that satisfies predicate
   * @param predicate Filter function
   * @returns Last matching element or null
   */
  last(predicate?: (item: T, index: number) => boolean): T | null {
    for (let i = this.length - 1; i >= 0; i--) {
      const item = this.getTyped(i);
      if (!predicate || predicate(item, i)) {
        return item;
      }
    }
    return null;
  }

  /**
   * Check if any element satisfies predicate
   * @param predicate Filter function
   * @returns True if any element matches
   */
  any(predicate?: (item: T, index: number) => boolean): boolean {
    if (this.length === 0) return false;

    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (!predicate || predicate(item, i)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if all elements satisfy predicate
   * @param predicate Filter function
   * @returns True if all elements match
   */
  all(predicate: (item: T, index: number) => boolean): boolean {
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (!predicate(item, i)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Count elements that satisfy predicate
   * @param predicate Filter function
   * @returns Count of matching elements
   */
  count(predicate?: (item: T, index: number) => boolean): number {
    if (!predicate) return this.length;

    let count = 0;
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (predicate(item, i)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get element at specified index
   * @param index Element index
   * @returns Element at index
   */
  elementAt(index: number): T {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }
    return this.getTyped(index);
  }

  /**
   * Aggregate elements using accumulator function
   * @param accumulator Accumulator function
   * @param initial Initial value
   * @returns Aggregated result
   */
  aggregate<TResult>(accumulator: (acc: TResult, item: T, index: number) => TResult, initial: TResult): TResult {
    let result = initial;
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      result = accumulator(result, item, i);
    }
    return result;
  }

  /**
   * Get distinct elements
   * @returns Array of distinct elements
   */
  distinct(): T[] {
    const seen = new Set();
    const result: T[] = [];

    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Order elements by key
   * @param keySelector Key selection function
   * @returns Sorted array
   */
  orderBy(keySelector: (item: T) => number | string): T[] {
    const items = [...this.select((item, index) => ({ item, index }))];
    items.sort((a, b) => {
      const keyA = keySelector(a.item);
      const keyB = keySelector(b.item);
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
    return items.map(item => item.item);
  }

  /**
   * Convert to JavaScript array
   * @returns JavaScript array of elements
   */
  toArray(): T[] {
    return this.select(item => item);
  }

  // ===== CHANGE TRACKING =====

  /**
   * Enable change tracking
   * @param maxHistorySize Maximum history size
   */
  enableChangeTracking(maxHistorySize: number = 100): void {
    this._changeTracker = new ArrayChangeTracker(this, maxHistorySize);
  }

  /**
   * Disable change tracking
   */
  disableChangeTracking(): void {
    this._changeTracker = null;
  }

  /**
   * Check if change tracking is enabled
   */
  isChangeTrackingEnabled(): boolean {
    return this._changeTracker !== null;
  }

  /**
   * Get change history
   */
  getChangeHistory(): ArrayChangeEvent<T>[] {
    return this._changeTracker ? this._changeTracker.getHistory() : [];
  }

  /**
   * Get change summary
   */
  getChangeSummary(): ChangeSummary | null {
    return this._changeTracker ? this._changeTracker.getChangeSummary() : null;
  }

  /**
   * Clear change history
   */
  clearChangeHistory(): void {
    if (this._changeTracker) {
      this._changeTracker.clearHistory();
    }
  }

  // ===== MONITORING =====

  /**
   * Enable access monitoring
   */
  enableMonitoring(): void {
    this._monitoringEnabled = true;
  }

  /**
   * Disable access monitoring
   */
  disableMonitoring(): void {
    this._monitoringEnabled = false;
  }

  /**
   * Check if monitoring is enabled
   */
  isMonitoringEnabled(): boolean {
    return this._monitoringEnabled;
  }

  /**
   * Get access statistics
   */
  getAccessStats(): ArrayAccessStats {
    return { ...this._accessStats };
  }

  /**
   * Clear access statistics
   */
  clearAccessStats(): void {
    this._accessStats = {
      reads: 0,
      writes: 0,
      lastRead: null,
      lastWrite: null,
      readIndices: new Set(),
      writeIndices: new Set(),
      mostAccessedIndex: null
    };
  }

  // ===== SERIALIZATION =====

  /**
   * Serialize the entire array to a portable format
   */
  serialize(): SerializedArray<T> {
    try {
      const elements: any[] = [];
      const elementClass = this.getElementClass();

      // Serialize each element
      for (let i = 0; i < this.length; i++) {
        const element = this.getTyped(i);
        elements.push(this._serializeElement(element));
      }

      return {
        type: 'MonoArray',
        elementType: {
          name: elementClass.name,
          fullName: elementClass.fullName,
          namespace: elementClass.namespace,
          isValueType: elementClass.isValueType(),
          isEnum: elementClass.isEnum()
        },
        length: this.length,
        elementSize: this.getElementSize(),
        elements,
        metadata: {
          changeTracking: this.isChangeTrackingEnabled(),
          monitoring: this.isMonitoringEnabled(),
          accessStats: this.getAccessStats(),
          changeHistory: this._changeTracker?.exportData() || null
        },
        serializationInfo: {
          timestamp: Date.now(),
          version: '1.0.0',
          format: 'JSON'
        }
      };
    } catch (error) {
      throw new Error(`Failed to serialize array: ${error}`);
    }
  }

  /**
   * Deserialize array from serialized data
   */
  static deserialize<T>(api: MonoApi, data: SerializedArray<T>): MonoArray<T> {
    try {
      // Find or create the element class
      const elementClass = MonoArray._findOrCreateElementClass(api, data.elementType);

      // Create new array
      const array = MonoArray.new(api, elementClass, data.length) as MonoArray<T>;

      // Deserialize elements
      for (let i = 0; i < data.length; i++) {
        const deserializedElement = MonoArray._deserializeElement(data.elements[i], data.elementType);
        array.setTyped(i, deserializedElement);
      }

      // Restore metadata if available
      if (data.metadata?.changeTracking) {
        array.enableChangeTracking();
      }
      if (data.metadata?.monitoring) {
        array.enableMonitoring();
      }

      return array;
    } catch (error) {
      throw new Error(`Failed to deserialize array: ${error}`);
    }
  }

  /**
   * Export array to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.serialize(), null, 2);
  }

  /**
   * Create array from JSON string
   */
  static fromJSON<T>(api: MonoApi, jsonString: string): MonoArray<T> {
    try {
      const data = JSON.parse(jsonString) as SerializedArray<T>;
      return MonoArray.deserialize(api, data);
    } catch (error) {
      throw new Error(`Failed to create array from JSON: ${error}`);
    }
  }

  // ===== CONSISTENT API PATTERNS =====

  /**
   * Get a human-readable description of this array
   */
  describe(): string {
    const elementClass = this.getElementClass();
    return `${elementClass.getFullName()}[${this.length}] (size: ${this.getElementSize()} bytes)`;
  }

  /**
   * Get array information
   */
  getArrayInfo(): {
    elementClass: string;
    length: number;
    elementSize: number;
    totalSize: number;
    isChangeTrackingEnabled: boolean;
    isMonitoringEnabled: boolean;
  } {
    const elementClass = this.getElementClass();
    return {
      elementClass: elementClass.getFullName(),
      length: this.length,
      elementSize: this.getElementSize(),
      totalSize: this.length * this.getElementSize(),
      isChangeTrackingEnabled: this.isChangeTrackingEnabled(),
      isMonitoringEnabled: this.isMonitoringEnabled()
    };
  }

  /**
   * Validate array integrity
   */
  validateArray(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if pointer is null
      if (pointerIsNull(this.pointer)) {
        errors.push('Array pointer is null');
        return { isValid: false, errors };
      }

      // Check if length is reasonable
      const length = this.getLength();
      if (length < 0) {
        errors.push(`Invalid array length: ${length}`);
      }

      // Check if element class is valid
      const elementClass = this.getElementClass();
      if (!elementClass) {
        errors.push('Unable to determine element class');
      }

    } catch (error) {
      errors.push(`Array validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===== FACTORY METHODS =====

  /**
   * Create a new MonoArray
   * @param api MonoApi instance
   * @param elementClass Element class
   * @param length Array length
   * @returns New MonoArray instance
   */
  static new(api: MonoApi, elementClass: MonoClass, length: number): MonoArray {
    const domain = api.getRootDomain();
    const arrayPtr = api.native.mono_array_new(domain, elementClass.pointer, length);
    return new MonoArray(api, arrayPtr);
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Record a read access
   */
  private _recordRead(index: number): void {
    if (!this._monitoringEnabled) return;

    this._accessStats.reads++;
    this._accessStats.lastRead = Date.now();
    this._accessStats.readIndices.add(index);
    this._updateMostAccessedIndex(index);
  }

  /**
   * Record a write access
   */
  private _recordWrite(index: number, oldValue: T, newValue: T): void {
    if (!this._monitoringEnabled) return;

    this._accessStats.writes++;
    this._accessStats.lastWrite = Date.now();
    this._accessStats.writeIndices.add(index);
    this._updateMostAccessedIndex(index);
  }

  /**
   * Update most accessed index
   */
  private _updateMostAccessedIndex(index: number): void {
    const currentCount = (this._accessStats.readIndices.has(index) ? 1 : 0) +
                        (this._accessStats.writeIndices.has(index) ? 1 : 0);

    if (!this._accessStats.mostAccessedIndex) {
      this._accessStats.mostAccessedIndex = index;
    } else {
      const mostCount = (this._accessStats.readIndices.has(this._accessStats.mostAccessedIndex) ? 1 : 0) +
                       (this._accessStats.writeIndices.has(this._accessStats.mostAccessedIndex) ? 1 : 0);

      if (currentCount > mostCount) {
        this._accessStats.mostAccessedIndex = index;
      }
    }
  }

  /**
   * Serialize a single element based on its type
   */
  private _serializeElement(element: T): any {
    if (element === null || element === undefined) {
      return { type: 'null', value: null };
    }

    // Handle basic types
    const type = typeof element;
    switch (type) {
      case 'string':
        return { type: 'string', value: element };
      case 'number':
        return { type: 'number', value: element };
      case 'boolean':
        return { type: 'boolean', value: element };
      default:
        // For MonoObject instances or complex types
        if (element instanceof MonoObject) {
          return {
            type: 'monoObject',
            value: {
              className: element.getClass().getFullName(),
              // In a real implementation, you'd serialize the object's fields
              data: 'MonoObject serialization would require full object graph traversal'
            }
          };
        }
        // For arrays
        if (Array.isArray(element)) {
          return {
            type: 'array',
            value: element.map(el => this._serializeElement(el))
          };
        }
        // For plain objects
        if (typeof element === 'object') {
          return {
            type: 'object',
            value: Object.fromEntries(
              Object.entries(element).map(([key, value]) => [key, this._serializeElement(value)])
            )
          };
        }
        return {
          type: 'unknown',
          value: element
        };
    }
  }

  /**
   * Deserialize a single element
   */
  private static _deserializeElement(elementData: any, elementType: SerializedArray<any>['elementType']): any {
    if (!elementData || elementData.type === 'null') {
      return null;
    }

    switch (elementData.type) {
      case 'string':
        return elementData.value;
      case 'number':
        return elementData.value;
      case 'boolean':
        return elementData.value;
      case 'array':
        return elementData.value.map((item: any) => MonoArray._deserializeElement(item, elementType));
      case 'object':
        return Object.fromEntries(
          Object.entries(elementData.value).map(([key, val]) => [key, MonoArray._deserializeElement(val, elementType)])
        );
      default:
        return elementData.value;
    }
  }

  /**
   * Find or create element class from serialized type info
   */
  private static _findOrCreateElementClass(api: MonoApi, elementType: SerializedArray<any>['elementType']): MonoClass {
    // This would need to be implemented based on the actual Mono API
    // For now, return a basic implementation
    const domain = api.getRootDomain();
    const classPtr = api.native.mono_class_from_name(domain, elementType.namespace, elementType.name);

    if (pointerIsNull(classPtr)) {
      throw new Error(`Could not find class: ${elementType.fullName}`);
    }

    return new MonoClass(api, classPtr);
  }

  // ===== DEBUGGING AND PROFILING HELPERS =====

  /**
   * Debug information interface
   */
  getDebugInfo(): {
    pointer: NativePointer;
    length: number;
    elementClass: string;
    elementSize: number;
    totalSize: number;
    memoryLayout: {
      startAddress: NativePointer;
      endAddress: NativePointer;
      elementAddresses: NativePointer[];
    };
    monitoring: {
      enabled: boolean;
      accessStats: ArrayAccessStats;
      changeTracking: boolean;
      changeCount: number;
    };
  } {
    const elementClass = this.getElementClass();
    const startAddress = this.getElementAddress(0);
    const endAddress = this.getElementAddress(this.length - 1);

    // Sample a few element addresses for debugging
    const sampleIndices = [0, Math.floor(this.length / 4), Math.floor(this.length / 2), Math.floor(3 * this.length / 4), this.length - 1];
    const elementAddresses = sampleIndices.filter(i => i < this.length).map(i => this.getElementAddress(i));

    return {
      pointer: this.pointer,
      length: this.length,
      elementClass: elementClass.getFullName(),
      elementSize: this.getElementSize(),
      totalSize: this.length * this.getElementSize(),
      memoryLayout: {
        startAddress,
        endAddress,
        elementAddresses
      },
      monitoring: {
        enabled: this.isMonitoringEnabled(),
        accessStats: this.getAccessStats(),
        changeTracking: this.isChangeTrackingEnabled(),
        changeCount: this.getChangeHistory().length
      }
    };
  }

  /**
   * Profile array performance
   */
  profileAccess(pattern: 'sequential' | 'random' | 'specific', iterations: number = 1000): {
    totalTime: number;
    averageTime: number;
    operationsPerSecond: number;
    pattern: string;
    iterations: number;
    cacheInfo?: {
      cacheHits: number;
      cacheMisses: number;
      hitRate: number;
    };
  } {
    const startTime = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    switch (pattern) {
      case 'sequential':
        for (let iter = 0; iter < iterations; iter++) {
          for (let i = 0; i < this.length; i++) {
            const accessed = this._recordRead(i);
            if (this._accessStats.readIndices.has(i)) {
              cacheHits++;
            } else {
              cacheMisses++;
            }
          }
        }
        break;

      case 'random':
        for (let iter = 0; iter < iterations; iter++) {
          const randomIndex = Math.floor(Math.random() * this.length);
          this.getTyped(randomIndex);
        }
        break;

      case 'specific':
        // Test most accessed index if available
        const targetIndex = this._accessStats.mostAccessedIndex ?? Math.floor(this.length / 2);
        for (let iter = 0; iter < iterations; iter++) {
          this.getTyped(targetIndex);
        }
        break;
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const totalOperations = pattern === 'sequential' ? iterations * this.length : iterations;

    return {
      totalTime,
      averageTime: totalTime / totalOperations,
      operationsPerSecond: (totalOperations / totalTime) * 1000,
      pattern,
      iterations,
      cacheInfo: this.isMonitoringEnabled() ? {
        cacheHits,
        cacheMisses,
        hitRate: cacheHits / (cacheHits + cacheMisses)
      } : undefined
    };
  }

  /**
   * Dump array contents for debugging
   */
  dumpContents(options: {
    maxElements?: number;
    includeIndices?: boolean;
    format?: 'hex' | 'decimal' | 'binary';
    start?: number;
    end?: number;
  } = {}): {
    summary: string;
    elements: Array<{
      index: number;
      address: NativePointer;
      value: any;
      rawBytes: string;
    }>;
    metadata: {
      totalDumped: number;
      totalSkipped: number;
      dumpRange: { start: number; end: number };
      format: string;
    };
  } {
    const {
      maxElements = 100,
      includeIndices = true,
      format = 'decimal',
      start = 0,
      end = this.length - 1
    } = options;

    const actualStart = Math.max(0, start);
    const actualEnd = Math.min(this.length - 1, end);
    const range = actualEnd - actualStart + 1;
    const elementsToDump = Math.min(range, maxElements);

    const elements: Array<{
      index: number;
      address: NativePointer;
      value: any;
      rawBytes: string;
    }> = [];

    for (let i = actualStart; i < actualStart + elementsToDump; i++) {
      const address = this.getElementAddress(i);
      const value = this.getTyped(i);

      let rawBytes = '';
      const elementSize = this.getElementSize();
      for (let j = 0; j < Math.min(elementSize, 8); j++) {
        const byte = address.add(j).readU8();
        switch (format) {
          case 'hex':
            rawBytes += byte.toString(16).padStart(2, '0') + ' ';
            break;
          case 'binary':
            rawBytes += byte.toString(2).padStart(8, '0') + ' ';
            break;
          case 'decimal':
          default:
            rawBytes += byte.toString().padStart(3, ' ') + ' ';
            break;
        }
      }

      elements.push({
        index: includeIndices ? i : -1,
        address,
        value,
        rawBytes: rawBytes.trim()
      });
    }

    return {
      summary: `Dumped ${elementsToDump} elements from index ${actualStart} to ${actualStart + elementsToDump - 1}`,
      elements,
      metadata: {
        totalDumped: elementsToDump,
        totalSkipped: range - elementsToDump,
        dumpRange: { start: actualStart, end: actualStart + elementsToDump - 1 },
        format
      }
    };
  }

  /**
   * Validate memory integrity
   */
  validateMemoryIntegrity(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    memoryInfo: {
      pointerValid: boolean;
      lengthValid: boolean;
      elementClassValid: boolean;
      estimatedMemoryUsage: number;
      memoryLayout: {
        elements: Array<{
          index: number;
          address: NativePointer;
          readable: boolean;
          writable: boolean;
        }>;
      };
    };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate pointer
    const pointerValid = !pointerIsNull(this.pointer);
    if (!pointerValid) {
      errors.push('Array pointer is null or invalid');
    }

    // Validate length
    const length = this.length;
    const lengthValid = length >= 0;
    if (!lengthValid) {
      errors.push(`Invalid array length: ${length}`);
    }

    // Validate element class
    let elementClassValid = false;
    let elementClass: MonoClass | null = null;
    try {
      elementClass = this.getElementClass();
      elementClassValid = !!elementClass;
      if (!elementClassValid) {
        errors.push('Unable to determine element class');
      }
    } catch (error) {
      errors.push(`Error accessing element class: ${error}`);
    }

    // Test memory accessibility at various points
    const testIndices = [0, Math.floor(length / 4), Math.floor(length / 2), Math.floor(3 * length / 4), length - 1];
    const elements = testIndices.filter(i => i < length).map(index => {
      const address = this.getElementAddress(index);
      let readable = false;
      let writable = false;

      try {
        // Test readability
        this.getTyped(index);
        readable = true;
      } catch (error) {
        warnings.push(`Cannot read element at index ${index}: ${error}`);
      }

      try {
        // Test writability (only if not a production environment)
        if (readable) {
          const oldValue = this.getTyped(index);
          this.setTyped(index, oldValue);
          writable = true;
        }
      } catch (error) {
        warnings.push(`Cannot write element at index ${index}: ${error}`);
      }

      return { index, address, readable, writable };
    });

    const unreadableElements = elements.filter(el => !el.readable);
    if (unreadableElements.length > 0) {
      warnings.push(`${unreadableElements.length} elements are not readable`);
    }

    const unwritableElements = elements.filter(el => !el.writable);
    if (unwritableElements.length > 0) {
      warnings.push(`${unwritableElements.length} elements are not writable`);
    }

    const estimatedMemoryUsage = length * this.getElementSize();

    return {
      isValid: errors.length === 0 && warnings.length === 0,
      errors,
      warnings,
      memoryInfo: {
        pointerValid,
        lengthValid,
        elementClassValid,
        estimatedMemoryUsage,
        memoryLayout: {
          elements
        }
      }
    };
  }

  /**
   * Benchmark different operations
   */
  benchmark(operations: Array<{
    name: string;
    operation: () => void;
    iterations?: number;
  }>): Array<{
    name: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    operationsPerSecond: number;
    memoryUsage?: number;
  }> {
    const results = [];

    for (const test of operations) {
      const iterations = test.iterations || 1000;
      const startMemory = this._estimateMemoryUsage();
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        test.operation();
      }

      const endTime = Date.now();
      const endMemory = this._estimateMemoryUsage();

      results.push({
        name: test.name,
        iterations,
        totalTime: endTime - startTime,
        averageTime: (endTime - startTime) / iterations,
        operationsPerSecond: (iterations / (endTime - startTime)) * 1000,
        memoryUsage: endMemory - startMemory
      });
    }

    return results;
  }

  /**
   * Create a performance snapshot
   */
  createPerformanceSnapshot(): {
    timestamp: number;
    array: {
      length: number;
      elementClass: string;
      elementSize: number;
      totalSize: number;
    };
    monitoring: {
      enabled: boolean;
      accessStats: ArrayAccessStats;
      changeStats: ChangeSummary | null;
    };
    memory: {
      estimatedUsage: number;
      layoutValid: boolean;
    };
    recommendations: string[];
  } {
    const memoryValidation = this.validateMemoryIntegrity();
    const recommendations: string[] = [];

    // Generate recommendations based on current state
    if (this.length > 10000 && !this.isMonitoringEnabled()) {
      recommendations.push('Consider enabling monitoring for large arrays to track access patterns');
    }

    if (this.getAccessStats().reads > this.getAccessStats().writes * 10) {
      recommendations.push('Array is read-heavy - consider optimizing for read access');
    }

    if (this.getAccessStats().writes > this.getAccessStats().reads * 5) {
      recommendations.push('Array is write-heavy - consider using change tracking to monitor modifications');
    }

    const mostAccessed = this._accessStats.mostAccessedIndex;
    if (mostAccessed !== null) {
      const accessCount = (this._accessStats.readIndices.has(mostAccessed) ? 1 : 0) +
                         (this._accessStats.writeIndices.has(mostAccessed) ? 1 : 0);
      if (accessCount > this.length * 0.1) {
        recommendations.push(`Index ${mostAccessed} is heavily accessed (${Math.round(accessCount / this.length * 100)}% of total access)`);
      }
    }

    return {
      timestamp: Date.now(),
      array: {
        length: this.length,
        elementClass: this.getElementClass().getFullName(),
        elementSize: this.getElementSize(),
        totalSize: this.length * this.getElementSize()
      },
      monitoring: {
        enabled: this.isMonitoringEnabled(),
        accessStats: this.getAccessStats(),
        changeStats: this.getChangeSummary()
      },
      memory: {
        estimatedUsage: this._estimateMemoryUsage(),
        layoutValid: memoryValidation.isValid
      },
      recommendations
    };
  }

  // ===== PRIVATE TYPE VALIDATION HELPERS =====

  /**
   * Validate value type matches array element type
   */
  private _validateValueType(value: T): void {
    if (value === null || value === undefined) {
      // Allow null values for reference types
      if (this.getElementClass().isValueType()) {
        throw new Error(`Cannot assign null to value type array`);
      }
      return;
    }

    const elementClass = this.getElementClass();
    const isElementValueType = elementClass.isValueType();

    if (isElementValueType) {
      // Value type validation - check if it's a number for numeric arrays
      const type = elementClass.getType();
      const kind = type.getKind();

      const isNumeric = kind >= MonoTypeKind.I1 && kind <= MonoTypeKind.R8;
      if (isNumeric && typeof value !== 'number') {
        throw new Error(`Expected numeric value, got ${typeof value}`);
      }
    } else {
      // Reference type validation - check if it's a MonoObject
      if (!(value instanceof MonoObject)) {
        throw new Error(`Expected MonoObject for reference type array, got ${typeof value}`);
      }
    }
  }

  /**
   * Get element type string for debugging
   */
  private _getElementTypeName(): string {
    try {
      const elementClass = this.getElementClass();
      return elementClass.getFullName();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Validate array operation parameters
   */
  private _validateOperationParams(index: number, operation: string): void {
    if (!Number.isInteger(index)) {
      throw new Error(`${operation}: Index must be an integer, got ${index}`);
    }

    if (index < 0 || index >= this.length) {
      throw new Error(`${operation}: Index ${index} out of bounds for array of length ${this.length}`);
    }
  }

  // ===== PRIVATE DEBUGGING HELPERS =====

  /**
   * Estimate current memory usage
   */
  private _estimateMemoryUsage(): number {
    let usage = this.length * this.getElementSize();

    // Add overhead for monitoring and change tracking
    if (this.isMonitoringEnabled()) {
      usage += this._accessStats.readIndices.size * 4 + this._accessStats.writeIndices.size * 4;
    }

    if (this.isChangeTrackingEnabled() && this._changeTracker) {
      const historySize = this.getChangeHistory().length;
      usage += historySize * 64; // Rough estimate per change event
    }

    return usage;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create a new MonoArray
 * @param api MonoApi instance
 * @param elementClass Element class
 * @param length Array length
 * @returns New MonoArray instance
 */
export function createMonoArray(api: MonoApi, elementClass: MonoClass, length: number): MonoArray {
  return MonoArray.new(api, elementClass, length);
}

/**
 * Validate serialized array data
 */
export function validateSerializedArrayData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { isValid: false, errors };
  }

  if (data.type !== 'MonoArray') {
    errors.push('Invalid data type: expected MonoArray');
  }

  if (!data.elementType || !data.elementType.name) {
    errors.push('Missing or invalid element type information');
  }

  if (typeof data.length !== 'number' || data.length < 0) {
    errors.push('Invalid or missing array length');
  }

  if (!Array.isArray(data.elements)) {
    errors.push('Missing or invalid elements array');
  }

  if (data.elements.length !== data.length) {
    errors.push(`Elements array length (${data.elements.length}) does not match declared length (${data.length})`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
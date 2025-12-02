import { MonoApi } from "../runtime/api";
import { MonoObject } from "./object";
import { MonoClass } from "./class";
import { MonoTypeKind } from "./type";
import { pointerIsNull } from "../utils/memory";
import { setArrayReferenceWithBarrier } from "../utils/write-barrier";
import { allocUtf8 } from "../runtime/mem";

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
}

/**
 * Represents a Mono array object (System.Array)
 */
export class MonoArray<T = any> extends MonoObject {
  private _elementClass: MonoClass | null = null;
  private _elementSize: number | null = null;

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
   * Uses mono_array_length if available, otherwise calls System.Array.get_Length via invoke
   */
  getLength(): number {
    // Try using mono_array_length first (standard Mono)
    if (this.api.hasExport("mono_array_length")) {
      return this.native.mono_array_length(this.pointer) as number;
    }
    
    // Fallback: Call System.Array.get_Length property via managed code
    // This works on all Mono runtimes including Unity's custom builds
    const arrayClass = this.native.mono_get_array_class();
    if (pointerIsNull(arrayClass)) {
      throw new Error("Cannot get System.Array class");
    }
    
    // Get the Length property getter
    // mono_class_get_method_from_name(klass, name, param_count)
    const methodName = allocUtf8("get_Length");
    const getLengthMethod = this.native.mono_class_get_method_from_name(
      arrayClass, 
      methodName, 
      0
    );
    
    if (pointerIsNull(getLengthMethod)) {
      throw new Error("Cannot find Array.get_Length method");
    }
    
    // Invoke get_Length on this array instance
    const result = this.api.runtimeInvoke(getLengthMethod, this.pointer, []);
    
    if (pointerIsNull(result)) {
      return 0;
    }
    
    // Result is a boxed Int32, unbox it
    const unboxed = this.native.mono_object_unbox(result);
    return unboxed.readS32();
  }

  /**
   * Get element class (the type of elements in this array)
   * Uses mono_class_get_element_class on the array's class
   */
  getElementClass(): MonoClass {
    if (this._elementClass) {
      return this._elementClass;
    }
    // First get the array's class, then get its element class
    const arrayClass = this.getClass();
    const elementClassPtr = this.native.mono_class_get_element_class(arrayClass.pointer);
    this._elementClass = new MonoClass(this.api, elementClassPtr);
    return this._elementClass;
  }

  /**
   * Get element size in bytes
   * Uses available Mono APIs to determine element size
   */
  getElementSize(): number {
    if (this._elementSize !== null) {
      return this._elementSize;
    }
    
    const arrayClass = this.getClass();
    
    // Try mono_class_array_element_size first (most common)
    if (this.api.hasExport("mono_class_array_element_size")) {
      this._elementSize = this.native.mono_class_array_element_size(arrayClass.pointer) as number;
      return this._elementSize;
    }
    
    // Fallback: Try mono_array_element_size (standard Mono API, takes array class)
    if (this.api.hasExport("mono_array_element_size")) {
      this._elementSize = this.native.mono_array_element_size(arrayClass.pointer) as number;
      return this._elementSize;
    }
    
    // Last resort: Determine from element class using mono_class_value_size
    const elementClass = this.getElementClass();
    if (elementClass.isValueType()) {
      // Use mono_class_value_size for value types (returns size without boxing)
      if (this.api.hasExport("mono_class_value_size")) {
        // mono_class_value_size(klass, &align) - we pass NULL for align
        this._elementSize = this.native.mono_class_value_size(elementClass.pointer, NULL) as number;
        return this._elementSize;
      }
    }
    
    // Reference types are always pointer-sized
    this._elementSize = Process.pointerSize;
    return this._elementSize;
  }

  /**
   * Get element address at the specified index
   * Uses mono_array_addr_with_size API
   */
  getElementAddress(index: number): NativePointer {
    const size = this.getElementSize();
    // mono_array_addr_with_size is available in all Unity Mono builds
    return this.native.mono_array_addr_with_size(this.pointer, size, index);
  }

  // ===== BASIC ARRAY OPERATIONS =====

  /**
   * Get a value as a number (for numeric arrays)
   */
  getNumber(index: number): number {
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
   */
  setNumber(index: number, value: number): void {
    const address = this.getElementAddress(index);
    const elementSize = this.getElementSize();

    switch (elementSize) {
      case 1: address.writeU8(value); break;
      case 2: address.writeU16(value); break;
      case 4: address.writeU32(value); break;
      case 8: address.writeU64(value); break;
      default: throw new Error(`Unsupported element size: ${elementSize}`);
    }
  }

  /**
   * Get a reference element (for object arrays)
   */
  getReference(index: number): NativePointer {
    const address = this.getElementAddress(index);
    return address.readPointer();
  }

  /**
   * Set a reference element (for object arrays)
   * Uses write barrier for SGen GC compatibility
   * @see WRITE_BARRIER_ANALYSIS.md for details
   */
  setReference(index: number, value: NativePointer): void {
    const address = this.getElementAddress(index);
    setArrayReferenceWithBarrier(this.api, this.pointer, address, value);
  }

  /**
   * Get element as MonoObject (for object arrays)
   */
  getElement(index: number): MonoObject {
    const ptr = this.getReference(index);
    return new MonoObject(this.api, ptr);
  }

  /**
   * Set element as MonoObject (for object arrays)
   */
  setElement(index: number, value: MonoObject): void {
    this.setReference(index, value.pointer);
  }

  // ===== TYPE-SAFE METHODS =====

  /**
   * Get a typed value
   */
  getTyped(index: number): T {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }

    if (this.getElementClass().isValueType()) {
      return this.getNumber(index) as T;
    } else {
      return this.getElement(index) as T;
    }
  }

  /**
   * Set a typed value
   */
  setTyped(index: number, value: T): void {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }

    if (this.getElementClass().isValueType()) {
      this.setNumber(index, value as number);
    } else {
      if (value instanceof MonoObject) {
        this.setElement(index, value);
      } else {
        throw new Error(`Cannot set non-MonoObject value in object array`);
      }
    }
  }

  // ===== LINQ-LIKE METHODS =====

  /**
   * Filter elements based on predicate
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
   */
  elementAt(index: number): T {
    if (index < 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds for array of length ${this.length}`);
    }
    return this.getTyped(index);
  }

  /**
   * Aggregate elements using accumulator function
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
   */
  toArray(): T[] {
    return this.select(item => item);
  }

  /**
   * Iterate over each element
   */
  forEach(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.length; i++) {
      callback(this.getTyped(i), i);
    }
  }

  /**
   * Transform array elements (alias for select)
   */
  map<TResult>(transform: (item: T, index: number) => TResult): TResult[] {
    return this.select(transform);
  }

  /**
   * Filter array elements (alias for where)
   */
  filter(predicate: (item: T, index: number) => boolean): T[] {
    return this.where(predicate);
  }

  /**
   * Reduce array to a single value (alias for aggregate)
   */
  reduce<TResult>(reducer: (acc: TResult, item: T, index: number) => TResult, initial: TResult): TResult {
    return this.aggregate(reducer, initial);
  }

  /**
   * Find first matching element (alias for first with predicate)
   */
  find(predicate: (item: T, index: number) => boolean): T | null {
    return this.first(predicate);
  }

  /**
   * Find index of first matching element
   */
  findIndex(predicate: (item: T, index: number) => boolean): number {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this.getTyped(i), i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if array includes an element (by reference for objects)
   */
  includes(element: T): boolean {
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (element instanceof MonoObject && item instanceof MonoObject) {
        if (element.pointer.equals(item.pointer)) {
          return true;
        }
      } else if (item === element) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get a slice of the array
   */
  slice(start: number, end?: number): T[] {
    const result: T[] = [];
    const actualEnd = end ?? this.length;
    for (let i = start; i < actualEnd && i < this.length; i++) {
      result.push(this.getTyped(i));
    }
    return result;
  }

  /**
   * Make the array iterable with for...of
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.length; i++) {
      yield this.getTyped(i);
    }
  }

  // ===== UTILITY METHODS =====

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
  } {
    const elementClass = this.getElementClass();
    return {
      elementClass: elementClass.getFullName(),
      length: this.length,
      elementSize: this.getElementSize(),
      totalSize: this.length * this.getElementSize()
    };
  }

  /**
   * Validate array integrity
   */
  validateArray(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (pointerIsNull(this.pointer)) {
        errors.push('Array pointer is null');
        return { isValid: false, errors };
      }

      const length = this.getLength();
      if (length < 0) {
        errors.push(`Invalid array length: ${length}`);
      }

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
   */
  static new(api: MonoApi, elementClass: MonoClass, length: number): MonoArray {
    const domain = api.getRootDomain();
    const arrayPtr = api.native.mono_array_new(domain, elementClass.pointer, length);
    return new MonoArray(api, arrayPtr);
  }

  /**
   * Create numeric array
   */
  static createNumericArray(
    api: MonoApi,
    elementType: 'int8' | 'int16' | 'int32' | 'int64' | 'uint8' | 'uint16' | 'uint32' | 'uint64' | 'float32' | 'float64',
    length: number
  ): MonoArray<number> {
    const domain = api.getRootDomain();
    const elementClass = api.native.mono_class_from_name(domain, "mscorlib", elementType) as NativePointer;
    if (pointerIsNull(elementClass)) {
      throw new Error(`Could not find class: System.${elementType}`);
    }
    const classObj = new MonoClass(api, elementClass);
    return MonoArray.new(api, classObj, length) as MonoArray<number>;
  }

  /**
   * Create string array
   */
  static createStringArray(api: MonoApi, length: number): MonoArray<string> {
    const domain = api.getRootDomain();
    const stringClass = api.native.mono_class_from_name(domain, "mscorlib", "String") as NativePointer;
    if (pointerIsNull(stringClass)) {
      throw new Error("Could not find class: System.String");
    }
    const classObj = new MonoClass(api, stringClass);
    return MonoArray.new(api, classObj, length) as MonoArray<string>;
  }

  /**
   * Create object array
   */
  static createObjectArray<T extends MonoObject>(
    api: MonoApi,
    elementClass: MonoClass,
    length: number
  ): MonoArray<T> {
    return MonoArray.new(api, elementClass, length) as MonoArray<T>;
  }

  toString(): string {
    return `MonoArray(${this.describe()})`;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create a new MonoArray
 */
export function createMonoArray(api: MonoApi, elementClass: MonoClass, length: number): MonoArray {
  return MonoArray.new(api, elementClass, length);
}
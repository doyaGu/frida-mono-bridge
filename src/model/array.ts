import type { MonoApi } from "../runtime/api";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { MonoClass } from "./class";
import { MonoObject } from "./object";
import { MonoTypeKind } from "./type";

/**
 * Summary information about a MonoArray instance.
 * Provides comprehensive metadata for inspection and debugging.
 *
 * @example
 * ```typescript
 * const summary = array.getSummary();
 * console.log(`Array of ${summary.elementType} with ${summary.length} elements`);
 * console.log(`Total size: ${summary.totalSize} bytes`);
 * ```
 */
export interface MonoArraySummary {
  /** Pointer address of this array in memory */
  pointer: string;
  /** Full name of the element type (e.g., "System.Int32") */
  elementType: string;
  /** Number of elements in the array */
  length: number;
  /** Size of each element in bytes */
  elementSize: number;
  /** Total memory size of array data (length * elementSize) */
  totalSize: number;
  /** Whether elements are value types */
  isValueType: boolean;
  /** Whether elements are reference types */
  isReferenceType: boolean;
  /** Whether this is a primitive array (int, float, etc.) */
  isPrimitiveArray: boolean;
  /** Whether this is a string array */
  isStringArray: boolean;
}

/**
 * Type guards for MonoArray operations
 */
export namespace ArrayTypeGuards {
  /**
   * Check if array contains numeric values
   */
  export function isNumericArray(array: MonoArray<unknown>): array is MonoArray<number> {
    const type = array.elementClass.type;
    const kind = type.kind;
    return kind >= MonoTypeKind.I1 && kind <= MonoTypeKind.R8;
  }

  /**
   * Check if array contains string values
   */
  export function isStringArray(array: MonoArray<unknown>): array is MonoArray<string> {
    const type = array.elementClass.type;
    return type.kind === MonoTypeKind.String;
  }

  /**
   * Check if array contains object references
   */
  export function isObjectArray(array: MonoArray<unknown>): array is MonoArray<MonoObject> {
    return !array.elementClass.isValueType;
  }

  /**
   * Check if array contains enum values
   */
  export function isEnumArray(array: MonoArray<unknown>): array is MonoArray<number> {
    return array.elementClass.isEnum;
  }
}

/**
 * Represents a Mono array object (System.Array).
 *
 * Implements `Iterable<T>` for use with `for...of` loops and spread operator.
 * Provides both LINQ-style methods (where, select, first) and JavaScript Array
 * methods (filter, map, find) for maximum compatibility.
 *
 * @typeParam T The element type of the array
 *
 * @example
 * ```typescript
 * const array = MonoArray.new(api, intClass, 10);
 *
 * // Basic access
 * array.setTyped(0, 42);
 * console.log(array.getTyped(0)); // 42
 *
 * // Iteration with for...of
 * for (const item of array) {
 *   console.log(item);
 * }
 *
 * // Use spread operator
 * const jsArray = [...array];
 *
 * // LINQ-style methods
 * const filtered = array.where(x => x > 10);
 * const mapped = array.select(x => x * 2);
 *
 * // JavaScript Array methods
 * const found = array.find(x => x === 42);
 * const sum = array.reduce((acc, x) => acc + x, 0);
 * ```
 */
export class MonoArray<T = unknown> extends MonoObject implements Iterable<T> {
  // ===== CORE PROPERTIES =====
  /**
   * Get array length
   * Uses mono_array_length if available, otherwise calls System.Array.get_Length via invoke
   */
  @lazy
  get length(): number {
    // Try using mono_array_length first (standard Mono)
    if (this.api.hasExport("mono_array_length")) {
      const result = this.native.mono_array_length(this.pointer);
      // mono_array_length returns size_t which may be UInt64/Int64 object or BigInt on 64-bit
      // Use Number() to safely convert all numeric types to number
      return Number(result);
    }

    // Fallback: Call System.Array.get_Length property via managed code
    // This works on all Mono runtimes including Unity's custom builds
    const arrayClass = this.native.mono_get_array_class();
    if (pointerIsNull(arrayClass)) {
      raise(
        MonoErrorCodes.CLASS_NOT_FOUND,
        "Cannot get System.Array class",
        "Ensure Mono runtime is properly initialized",
      );
    }

    // Get the Length property getter
    // mono_class_get_method_from_name(klass, name, param_count)
    const methodName = this.api.allocUtf8StringCached("get_Length");
    const getLengthMethod = this.native.mono_class_get_method_from_name(arrayClass, methodName, 0);

    if (pointerIsNull(getLengthMethod)) {
      raise(
        MonoErrorCodes.METHOD_NOT_FOUND,
        "Cannot find Array.get_Length method",
        "System.Array may not be properly initialized",
      );
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
  @lazy
  get elementClass(): MonoClass {
    // First get the array's class, then get its element class
    const arrayClass = this.class;
    const elementClassPtr = this.native.mono_class_get_element_class(arrayClass.pointer);
    return new MonoClass(this.api, elementClassPtr);
  }

  /**
   * Get element size in bytes
   * Uses available Mono APIs to determine element size
   */
  @lazy
  get elementSize(): number {
    const arrayClass = this.class;

    // Try mono_array_element_size first - this is the correct API for getting element size
    // It takes the array class (e.g., System.Int32[]) and returns the size of each element
    if (this.api.hasExport("mono_array_element_size")) {
      return Number(this.native.mono_array_element_size(arrayClass.pointer));
    }

    // Fallback: Try mono_class_array_element_size (Note: on some Mono versions this may return
    // different values, so mono_array_element_size is preferred)
    return Number(this.native.mono_class_array_element_size(arrayClass.pointer));
  }

  /**
   * Get element address at the specified index
   * Uses mono_array_addr_with_size API
   */
  getElementAddress(index: number): NativePointer {
    // mono_array_addr_with_size is available in all Unity Mono builds
    return this.native.mono_array_addr_with_size(this.pointer, this.elementSize, index);
  }

  private resolveElementKind(): MonoTypeKind {
    const type = this.elementClass.type;
    if (type.kind === MonoTypeKind.Enum) {
      return type.underlyingType?.kind ?? type.kind;
    }
    return type.kind;
  }

  // ===== BASIC ARRAY OPERATIONS =====

  /**
   * Get a value as a number (for numeric arrays)
   */
  getNumber(index: number): number {
    const address = this.getElementAddress(index);
    const kind = this.resolveElementKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
        return address.readU8();
      case MonoTypeKind.I1:
        return address.readS8();
      case MonoTypeKind.U1:
        return address.readU8();
      case MonoTypeKind.Char:
        return address.readU16();
      case MonoTypeKind.I2:
        return address.readS16();
      case MonoTypeKind.U2:
        return address.readU16();
      case MonoTypeKind.I4:
        return address.readS32();
      case MonoTypeKind.U4:
        return address.readU32();
      case MonoTypeKind.I8:
        return address.readS64().toNumber();
      case MonoTypeKind.U8:
        return address.readU64().toNumber();
      case MonoTypeKind.R4:
        return address.readFloat();
      case MonoTypeKind.R8:
        return address.readDouble();
      case MonoTypeKind.Int:
        return Process.pointerSize === 8 ? address.readS64().toNumber() : address.readS32();
      case MonoTypeKind.UInt:
        return Process.pointerSize === 8 ? address.readU64().toNumber() : address.readU32();
      default:
        raise(
          MonoErrorCodes.NOT_SUPPORTED,
          `Unsupported element kind for numeric read: ${kind}`,
          "Use a numeric element type",
        );
    }
  }

  /**
   * Set a number value (for numeric arrays)
   */
  setNumber(index: number, value: number): void {
    const address = this.getElementAddress(index);
    const kind = this.resolveElementKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
        address.writeU8(value ? 1 : 0);
        break;
      case MonoTypeKind.I1:
        address.writeS8(value);
        break;
      case MonoTypeKind.U1:
        address.writeU8(value);
        break;
      case MonoTypeKind.Char:
        address.writeU16(value);
        break;
      case MonoTypeKind.I2:
        address.writeS16(value);
        break;
      case MonoTypeKind.U2:
        address.writeU16(value);
        break;
      case MonoTypeKind.I4:
        address.writeS32(value);
        break;
      case MonoTypeKind.U4:
        address.writeU32(value);
        break;
      case MonoTypeKind.I8:
        address.writeS64(value);
        break;
      case MonoTypeKind.U8:
        address.writeU64(value);
        break;
      case MonoTypeKind.R4:
        address.writeFloat(value);
        break;
      case MonoTypeKind.R8:
        address.writeDouble(value);
        break;
      case MonoTypeKind.Int:
        if (Process.pointerSize === 8) {
          address.writeS64(value);
        } else {
          address.writeS32(value);
        }
        break;
      case MonoTypeKind.UInt:
        if (Process.pointerSize === 8) {
          address.writeU64(value);
        } else {
          address.writeU32(value);
        }
        break;
      default:
        raise(
          MonoErrorCodes.NOT_SUPPORTED,
          `Unsupported element kind for numeric write: ${kind}`,
          "Use a numeric element type",
        );
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
   */
  setReference(index: number, value: NativePointer): void {
    const address = this.getElementAddress(index);
    // Write barrier for SGen GC
    if (value.isNull()) {
      address.writePointer(value);
    } else {
      this.native.mono_gc_wbarrier_set_arrayref(this.pointer, address, value);
    }
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
   * Get a typed value at the specified index.
   * @param index Array index (0-based)
   * @returns The element at the index
   * @throws {MonoValidationError} If index is out of bounds
   */
  getTyped(index: number): T {
    if (index < 0 || index >= this.length) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} is out of bounds for array of length ${this.length}`,
        "Ensure index is within [0, length-1]",
      );
    }

    if (this.elementClass.isValueType) {
      return this.getNumber(index) as T;
    }

    const ptr = this.getReference(index);
    if (pointerIsNull(ptr)) {
      return null as T;
    }
    return new MonoObject(this.api, ptr) as T;
  }

  /**
   * Try to get a typed value without throwing.
   * @param index Array index (0-based)
   * @returns The element if index is valid, undefined otherwise
   *
   * @example
   * ```typescript
   * const value = array.tryGetTyped(10);
   * if (value !== undefined) {
   *   console.log(value);
   * }
   * ```
   */
  tryGetTyped(index: number): T | undefined {
    if (index < 0 || index >= this.length) {
      return undefined;
    }

    if (this.elementClass.isValueType) {
      return this.getNumber(index) as T;
    }

    const ptr = this.getReference(index);
    if (pointerIsNull(ptr)) {
      return null as T;
    }
    return new MonoObject(this.api, ptr) as T;
  }

  /**
   * Set a typed value at the specified index.
   * @param index Array index (0-based)
   * @param value Value to set
   * @throws {MonoValidationError} If index is out of bounds
   */
  setTyped(index: number, value: T): void {
    if (index < 0 || index >= this.length) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} is out of bounds for array of length ${this.length}`,
        "Ensure index is within [0, length-1]",
      );
    }

    if (this.elementClass.isValueType) {
      this.setNumber(index, value as number);
    } else {
      if (value === null || value === undefined) {
        this.setReference(index, NULL);
      } else if (value instanceof MonoObject) {
        this.setElement(index, value);
      } else {
        raise(
          MonoErrorCodes.TYPE_MISMATCH,
          "Cannot set non-MonoObject value in object array",
          "Wrap the value in a MonoObject first",
        );
      }
    }
  }

  /**
   * Try to set a typed value without throwing.
   * @param index Array index (0-based)
   * @param value Value to set
   * @returns True if successful, false if index is out of bounds or type mismatch
   */
  trySetTyped(index: number, value: T): boolean {
    if (index < 0 || index >= this.length) {
      return false;
    }

    try {
      if (this.elementClass.isValueType) {
        this.setNumber(index, value as number);
      } else {
        if (value === null || value === undefined) {
          this.setReference(index, NULL);
        } else if (value instanceof MonoObject) {
          this.setElement(index, value);
        } else {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get element at relative index (supports negative indices).
   * Similar to JavaScript's Array.prototype.at().
   * @param index Relative index (negative counts from end)
   * @returns The element at the index
   * @throws {MonoValidationError} If resolved index is out of bounds
   *
   * @example
   * ```typescript
   * array.at(0);  // First element
   * array.at(-1); // Last element
   * array.at(-2); // Second to last
   * ```
   */
  at(index: number): T {
    const actualIndex = index < 0 ? this.length + index : index;
    return this.getTyped(actualIndex);
  }

  /**
   * Try to get element at relative index without throwing.
   * @param index Relative index (negative counts from end)
   * @returns The element if index is valid, undefined otherwise
   */
  tryAt(index: number): T | undefined {
    const actualIndex = index < 0 ? this.length + index : index;
    return this.tryGetTyped(actualIndex);
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
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} is out of bounds for array of length ${this.length}`,
        "Ensure index is within [0, length-1]",
      );
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
   * Filter array elements (alias for where).
   * @param predicate Filter predicate function
   * @returns New JavaScript array with filtered elements
   */
  filter(predicate: (item: T, index: number) => boolean): T[];
  /**
   * Filter array elements with type guard.
   * @param predicate Type guard predicate function
   * @returns New JavaScript array with filtered and typed elements
   */
  filter<S extends T>(predicate: (item: T, index: number) => item is S): S[];
  filter(predicate: (item: T, index: number) => boolean): T[] {
    return this.where(predicate);
  }

  /**
   * Reduce array to a single value (alias for aggregate).
   * @param reducer Reducer function
   * @param initial Initial value
   * @returns Reduced value
   */
  reduce<TResult>(reducer: (acc: TResult, item: T, index: number) => TResult, initial: TResult): TResult {
    return this.aggregate(reducer, initial);
  }

  /**
   * Reduce array from right to left.
   * @param reducer Reducer function
   * @param initial Initial value
   * @returns Reduced value
   */
  reduceRight<TResult>(reducer: (acc: TResult, item: T, index: number) => TResult, initial: TResult): TResult {
    let result = initial;
    for (let i = this.length - 1; i >= 0; i--) {
      const item = this.getTyped(i);
      result = reducer(result, item, i);
    }
    return result;
  }

  /**
   * Find first matching element (alias for first with predicate).
   * @param predicate Predicate function
   * @returns First matching element, or null if not found
   */
  find(predicate: (item: T, index: number) => boolean): T | null {
    return this.first(predicate);
  }

  /**
   * Find last matching element.
   * @param predicate Predicate function
   * @returns Last matching element, or null if not found
   */
  findLast(predicate: (item: T, index: number) => boolean): T | null {
    return this.last(predicate);
  }

  /**
   * Find index of first matching element.
   * @param predicate Predicate function
   * @returns Index of first match, or -1 if not found
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
   * Find index of last matching element.
   * @param predicate Predicate function
   * @returns Index of last match, or -1 if not found
   */
  findLastIndex(predicate: (item: T, index: number) => boolean): number {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this.getTyped(i), i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if array includes an element (by reference for objects).
   * @param element Element to search for
   * @param fromIndex Optional start index
   * @returns True if element is found
   */
  includes(element: T, fromIndex?: number): boolean {
    const start = fromIndex ?? 0;
    for (let i = start; i < this.length; i++) {
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
   * Get a slice of the array.
   * @param start Start index (supports negative)
   * @param end End index (supports negative, optional)
   * @returns New JavaScript array with sliced elements
   */
  slice(start?: number, end?: number): T[] {
    const len = this.length;
    const actualStart = start === undefined ? 0 : start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    const actualEnd = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);

    const result: T[] = [];
    for (let i = actualStart; i < actualEnd; i++) {
      result.push(this.getTyped(i));
    }
    return result;
  }

  // ===== NEW ARRAY METHODS =====

  /**
   * Get a number value as BigInt (for 64-bit numeric arrays)
   * Preserves full precision for Int64/UInt64 values
   * @param index Array index
   * @returns BigInt value
   */
  getBigInt(index: number): bigint {
    const address = this.getElementAddress(index);
    const kind = this.resolveElementKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
        return BigInt(address.readU8());
      case MonoTypeKind.I1:
        return BigInt(address.readS8());
      case MonoTypeKind.U1:
        return BigInt(address.readU8());
      case MonoTypeKind.Char:
        return BigInt(address.readU16());
      case MonoTypeKind.I2:
        return BigInt(address.readS16());
      case MonoTypeKind.U2:
        return BigInt(address.readU16());
      case MonoTypeKind.I4:
        return BigInt(address.readS32());
      case MonoTypeKind.U4:
        return BigInt(address.readU32());
      case MonoTypeKind.I8:
        return BigInt(address.readS64().toString());
      case MonoTypeKind.U8:
        return BigInt(address.readU64().toString());
      case MonoTypeKind.Int:
        return Process.pointerSize === 8
          ? BigInt(address.readS64().toString())
          : BigInt(address.readS32());
      case MonoTypeKind.UInt:
        return Process.pointerSize === 8
          ? BigInt(address.readU64().toString())
          : BigInt(address.readU32());
      default:
        raise(
          MonoErrorCodes.NOT_SUPPORTED,
          `Unsupported element kind for BigInt read: ${kind}`,
          "Use an integer element type",
        );
    }
  }

  /**
   * Set a BigInt value (for 64-bit numeric arrays)
   * @param index Array index
   * @param value BigInt value to set
   */
  setBigInt(index: number, value: bigint): void {
    const address = this.getElementAddress(index);
    const kind = this.resolveElementKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
        address.writeU8(value === 0n ? 0 : 1);
        break;
      case MonoTypeKind.I1:
        address.writeS8(Number(value));
        break;
      case MonoTypeKind.U1:
        address.writeU8(Number(value));
        break;
      case MonoTypeKind.Char:
        address.writeU16(Number(value));
        break;
      case MonoTypeKind.I2:
        address.writeS16(Number(value));
        break;
      case MonoTypeKind.U2:
        address.writeU16(Number(value));
        break;
      case MonoTypeKind.I4:
        address.writeS32(Number(value));
        break;
      case MonoTypeKind.U4:
        address.writeU32(Number(value));
        break;
      case MonoTypeKind.I8:
        address.writeS64(int64(value.toString()));
        break;
      case MonoTypeKind.U8:
        address.writeU64(uint64(value.toString()));
        break;
      case MonoTypeKind.Int:
        if (Process.pointerSize === 8) {
          address.writeS64(int64(value.toString()));
        } else {
          address.writeS32(Number(value));
        }
        break;
      case MonoTypeKind.UInt:
        if (Process.pointerSize === 8) {
          address.writeU64(uint64(value.toString()));
        } else {
          address.writeU32(Number(value));
        }
        break;
      default:
        raise(
          MonoErrorCodes.NOT_SUPPORTED,
          `Unsupported element kind for BigInt write: ${kind}`,
          "Use an integer element type",
        );
    }
  }

  /**
   * Reverse the array in place
   * Note: This modifies the original Mono array
   */
  reverse(): void {
    const len = this.length;
    const halfLen = Math.floor(len / 2);

    for (let i = 0; i < halfLen; i++) {
      const j = len - 1 - i;
      const temp = this.getTyped(i);
      this.setTyped(i, this.getTyped(j));
      this.setTyped(j, temp);
    }
  }

  /**
   * Fill the array with a value.
   * @param value Value to fill with
   * @param start Optional start index (default: 0)
   * @param end Optional end index (default: length)
   */
  fill(value: T, start?: number, end?: number): void {
    const actualStart = start ?? 0;
    const actualEnd = end ?? this.length;

    for (let i = actualStart; i < actualEnd && i < this.length; i++) {
      this.setTyped(i, value);
    }
  }

  /**
   * Copy elements to another MonoArray
   * @param target Target MonoArray
   * @param targetStart Start index in target array (default: 0)
   * @param sourceStart Start index in source array (default: 0)
   * @param sourceEnd End index in source array (default: length)
   */
  copyTo(target: MonoArray<T>, targetStart?: number, sourceStart?: number, sourceEnd?: number): void {
    const actualTargetStart = targetStart ?? 0;
    const actualSourceStart = sourceStart ?? 0;
    const actualSourceEnd = sourceEnd ?? this.length;

    let targetIndex = actualTargetStart;
    for (let i = actualSourceStart; i < actualSourceEnd && i < this.length && targetIndex < target.length; i++) {
      target.setTyped(targetIndex++, this.getTyped(i));
    }
  }

  /**
   * Copy elements to a JavaScript array
   * @param start Start index (default: 0)
   * @param end End index (default: length)
   * @returns New JavaScript array with copied elements
   */
  copyToArray(start?: number, end?: number): T[] {
    return this.slice(start ?? 0, end);
  }

  /**
   * Sort the array in place using a compare function
   * Note: This modifies the original Mono array
   * @param compareFn Compare function
   */
  sort(compareFn?: (a: T, b: T) => number): void {
    // Convert to JS array, sort, and copy back
    const items = this.toArray();
    items.sort(compareFn);

    for (let i = 0; i < items.length; i++) {
      this.setTyped(i, items[i]);
    }
  }

  /**
   * Join array elements into a string (for arrays with toString-able elements).
   * @param separator Separator string (default: ',')
   * @returns Joined string
   */
  join(separator?: string): string {
    const items: string[] = [];
    for (let i = 0; i < this.length; i++) {
      const item = this.getTyped(i);
      if (item instanceof MonoObject) {
        items.push(item.toString());
      } else {
        items.push(String(item));
      }
    }
    return items.join(separator ?? ",");
  }

  /**
   * Get index of first occurrence of an element
   * @param element Element to search for
   * @param fromIndex Start index for search
   * @returns Index of element, or -1 if not found
   */
  indexOf(element: T, fromIndex?: number): number {
    const start = fromIndex ?? 0;
    for (let i = start; i < this.length; i++) {
      const item = this.getTyped(i);
      if (element instanceof MonoObject && item instanceof MonoObject) {
        if (element.pointer.equals(item.pointer)) {
          return i;
        }
      } else if (item === element) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get index of last occurrence of an element
   * @param element Element to search for
   * @param fromIndex Start index for backward search
   * @returns Index of element, or -1 if not found
   */
  lastIndexOf(element: T, fromIndex?: number): number {
    const start = fromIndex ?? this.length - 1;
    for (let i = start; i >= 0; i--) {
      const item = this.getTyped(i);
      if (element instanceof MonoObject && item instanceof MonoObject) {
        if (element.pointer.equals(item.pointer)) {
          return i;
        }
      } else if (item === element) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Concatenate with another array (returns new JS array)
   * @param other Other array to concatenate
   * @returns New JavaScript array with combined elements
   */
  concat(other: MonoArray<T> | T[]): T[] {
    const result = this.toArray();
    if (other instanceof MonoArray) {
      result.push(...other.toArray());
    } else {
      result.push(...other);
    }
    return result;
  }

  /**
   * Flatten nested arrays (for arrays of arrays).
   * @param depth Depth to flatten (default: 1)
   * @returns Flattened JavaScript array
   */
  flat(depth: number = 1): unknown[] {
    const items = this.toArray();
    return items.flat(depth);
  }

  /**
   * Map and flatten in one operation.
   * @param callback Mapping function that returns array or value
   * @returns Flattened JavaScript array
   *
   * @example
   * ```typescript
   * // Split each string and flatten
   * const words = strArray.flatMap(s => s.split(' '));
   * ```
   */
  flatMap<U>(callback: (item: T, index: number) => U | U[]): U[] {
    const result: U[] = [];
    for (let i = 0; i < this.length; i++) {
      const mapped = callback(this.getTyped(i), i);
      if (Array.isArray(mapped)) {
        result.push(...mapped);
      } else {
        result.push(mapped);
      }
    }
    return result;
  }

  /**
   * Check if every element satisfies the predicate (alias for all).
   * @param predicate Predicate function
   * @returns True if all elements satisfy the predicate
   */
  every(predicate: (item: T, index: number) => boolean): boolean {
    return this.all(predicate);
  }

  /**
   * Check if some element satisfies the predicate (alias for any).
   * @param predicate Predicate function
   * @returns True if any element satisfies the predicate
   */
  some(predicate: (item: T, index: number) => boolean): boolean {
    return this.any(predicate);
  }

  // ===== NON-MUTATING COPY METHODS (ES2023+) =====

  /**
   * Returns a sorted copy of the array (non-mutating).
   * @param compareFn Compare function
   * @returns New sorted JavaScript array
   *
   * @example
   * ```typescript
   * const sorted = array.toSorted((a, b) => a - b);
   * ```
   */
  toSorted(compareFn?: (a: T, b: T) => number): T[] {
    const items = this.toArray();
    items.sort(compareFn);
    return items;
  }

  /**
   * Returns a reversed copy of the array (non-mutating).
   * @returns New reversed JavaScript array
   */
  toReversed(): T[] {
    const result: T[] = [];
    for (let i = this.length - 1; i >= 0; i--) {
      result.push(this.getTyped(i));
    }
    return result;
  }

  /**
   * Returns a copy with one element replaced (non-mutating).
   * @param index Index to replace (supports negative)
   * @param value New value
   * @returns New JavaScript array with the replacement
   * @throws {MonoValidationError} If index is out of bounds
   *
   * @example
   * ```typescript
   * const newArray = array.with(0, newValue);
   * const lastReplaced = array.with(-1, newValue);
   * ```
   */
  with(index: number, value: T): T[] {
    const actualIndex = index < 0 ? this.length + index : index;
    if (actualIndex < 0 || actualIndex >= this.length) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} is out of bounds for array of length ${this.length}`,
        "Ensure index is within valid range",
      );
    }

    const result = this.toArray();
    result[actualIndex] = value;
    return result;
  }

  /**
   * Returns a copy with elements spliced (non-mutating).
   * @param start Start index
   * @param deleteCount Number of elements to remove
   * @param items Items to insert
   * @returns New JavaScript array with modifications
   */
  toSpliced(start: number, deleteCount?: number, ...items: T[]): T[] {
    const result = this.toArray();
    result.splice(start, deleteCount ?? 0, ...items);
    return result;
  }

  // ===== ITERATION SUPPORT =====

  /**
   * Make the array iterable with for...of.
   *
   * @yields Each element in the array
   *
   * @example
   * ```typescript
   * for (const item of array) {
   *   console.log(item);
   * }
   *
   * // Use spread operator
   * const jsArray = [...array];
   *
   * // Use with Array.from
   * const copy = Array.from(array);
   * ```
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.length; i++) {
      yield this.getTyped(i);
    }
  }

  /**
   * Returns an iterator over the indices (keys) of this array.
   *
   * @yields Each index from 0 to length-1
   *
   * @example
   * ```typescript
   * for (const index of array.keys()) {
   *   console.log(index, array.getTyped(index));
   * }
   * ```
   */
  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.length; i++) {
      yield i;
    }
  }

  /**
   * Returns an iterator over the values (elements) of this array.
   *
   * @yields Each element in the array
   *
   * @example
   * ```typescript
   * for (const value of array.values()) {
   *   console.log(value);
   * }
   * ```
   */
  *values(): IterableIterator<T> {
    yield* this[Symbol.iterator]();
  }

  /**
   * Returns an iterator over [index, value] pairs.
   *
   * @yields Each [index, value] entry
   *
   * @example
   * ```typescript
   * for (const [index, value] of array.entries()) {
   *   console.log(`${index}: ${value}`);
   * }
   * ```
   */
  *entries(): IterableIterator<[number, T]> {
    for (let i = 0; i < this.length; i++) {
      yield [i, this.getTyped(i)];
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get a human-readable description of this array.
   *
   * @returns A multi-line string with detailed array information
   *
   * @example
   * ```typescript
   * console.log(array.describe());
   * // Output:
   * // MonoArray: System.Int32[10]
   * //   Element Type: System.Int32 (ValueType)
   * //   Length: 10, Element Size: 4 bytes, Total: 40 bytes
   * //   Pointer: 0x12345678
   * ```
   */
  describe(): string {
    const isValueType = this.elementClass.isValueType;
    const totalSize = this.length * this.elementSize;

    const lines = [
      `MonoArray: ${this.elementClass.fullName}[${this.length}]`,
      `  Element Type: ${this.elementClass.fullName} (${isValueType ? "ValueType" : "ReferenceType"})`,
      `  Length: ${this.length}, Element Size: ${this.elementSize} bytes, Total: ${totalSize} bytes`,
      `  Pointer: ${this.pointer}`,
    ];

    return lines.join("\n");
  }

  /**
   * Get comprehensive summary information about this array.
   *
   * @returns MonoArraySummary object with all array metadata
   *
   * @example
   * ```typescript
   * const summary = array.getSummary();
   * if (summary.isPrimitiveArray) {
   *   console.log(`Primitive array of ${summary.elementType}`);
   * }
   * ```
   */
  getSummary(): MonoArraySummary {
    const elementType = this.elementClass.type;
    const kind = elementType.kind;
    const isValueType = this.elementClass.isValueType;
    const isPrimitive = kind >= MonoTypeKind.I1 && kind <= MonoTypeKind.R8;
    const isString = kind === MonoTypeKind.String;

    return {
      pointer: this.pointer.toString(),
      elementType: this.elementClass.fullName,
      length: this.length,
      elementSize: this.elementSize,
      totalSize: this.length * this.elementSize,
      isValueType: isValueType,
      isReferenceType: !isValueType,
      isPrimitiveArray: isPrimitive,
      isStringArray: isString,
    };
  }

  /**
   * Check if this array is empty (length === 0).
   */
  @lazy
  get isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Check if this array is not empty (length > 0).
   */
  @lazy
  get isNotEmpty(): boolean {
    return this.length > 0;
  }

  /**
   * Check if this array contains primitive numeric types.
   */
  @lazy
  get isPrimitiveArray(): boolean {
    const elementType = this.elementClass.type;
    const kind = elementType.kind;
    return kind >= MonoTypeKind.I1 && kind <= MonoTypeKind.R8;
  }

  /**
   * Check if this array contains string elements.
   */
  @lazy
  get isStringArray(): boolean {
    const elementType = this.elementClass.type;
    return elementType.kind === MonoTypeKind.String;
  }

  /**
   * Compare two arrays for equality.
   *
   * @param other Another MonoHandle to compare with
   * @returns true if both have the same pointer
   *
   * @example
   * ```typescript
   * if (array1.equals(array2)) {
   *   console.log("Same array instance");
   * }
   * ```
   */
  override equals(other: MonoArray | MonoObject): boolean {
    if (!other) return false;
    return this.pointer.equals(other.pointer);
  }

  /**
   * Validate array integrity
   */
  validateArray(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      if (pointerIsNull(this.pointer)) {
        errors.push("Array pointer is null");
        return { isValid: false, errors };
      }

      if (this.length < 0) {
        errors.push(`Invalid array length: ${this.length}`);
      }

      if (!this.elementClass) {
        errors.push("Unable to determine element class");
      }
    } catch (error) {
      errors.push(`Array validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== FACTORY METHODS =====

  /**
   * Create a new MonoArray
   * @param api MonoApi instance
   * @param elementClass The element type class
   * @param length Number of elements
   * @returns A new MonoArray instance
   */
  static new<T = unknown>(api: MonoApi, elementClass: MonoClass, length: number): MonoArray<T> {
    const domain = api.getRootDomain();
    const arrayPtr = api.native.mono_array_new(domain, elementClass.pointer, length);
    return new MonoArray<T>(api, arrayPtr);
  }

  /**
   * Create numeric array
   */
  static createNumericArray(
    api: MonoApi,
    elementType:
      | "int8"
      | "int16"
      | "int32"
      | "int64"
      | "uint8"
      | "uint16"
      | "uint32"
      | "uint64"
      | "float32"
      | "float64",
    length: number,
  ): MonoArray<number> {
    const domain = api.getRootDomain();
    const elementClass = api.native.mono_class_from_name(domain, "mscorlib", elementType) as NativePointer;
    if (pointerIsNull(elementClass)) {
      raise(MonoErrorCodes.CLASS_NOT_FOUND, `Could not find class: System.${elementType}`, "Ensure mscorlib is loaded");
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
      raise(MonoErrorCodes.CLASS_NOT_FOUND, "Could not find class: System.String", "Ensure mscorlib is loaded");
    }
    const classObj = new MonoClass(api, stringClass);
    return MonoArray.new(api, classObj, length) as MonoArray<string>;
  }

  /**
   * Create object array
   */
  static createObjectArray<T extends MonoObject>(api: MonoApi, elementClass: MonoClass, length: number): MonoArray<T> {
    return MonoArray.new(api, elementClass, length) as MonoArray<T>;
  }

  /**
   * Returns a string representation of this array for debugging.
   *
   * @returns A concise string like "System.Int32[10]"
   *
   * @example
   * ```typescript
   * console.log(array.toString());
   * // "System.Int32[10]"
   * ```
   */
  override toString(): string {
    return `${this.elementClass.fullName}[${this.length}]`;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create a new MonoArray
 */
export function createMonoArray(api: MonoApi, elementClass: MonoClass, length: number): MonoArray {
  return MonoArray.new(api, elementClass, length);
}

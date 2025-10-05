import { MonoApi } from "../runtime/api";
import { pointerIsNull, readUtf16String } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";
import { MonoMethod } from "./method";
import { MonoField } from "./field";

/**
 * Represents a Mono object instance
 */
export class MonoObject extends MonoHandle {
  private _class: MonoClass | null = null;

  /**
   * Get the class of this object
   */
  get class(): MonoClass {
    return this.getClass();
  }

  /**
   * Get the size of this object in bytes
   */
  get size(): number {
    return this.getSize();
  }

  /**
   * Get the class of this object
   */
  getClass(): MonoClass {
    if (this._class) {
      return this._class;
    }
    const klassPtr = this.native.mono_object_get_class(this.pointer);
    this._class = new MonoClass(this.api, klassPtr);
    return this._class;
  }

  /**
   * Unbox a value type object
   * @returns Pointer to the unboxed value
   */
  unbox(): NativePointer {
    return this.native.mono_object_unbox(this.pointer);
  }

  /**
   * Check if this object pointer is null
   */
  isNull(): boolean {
    return pointerIsNull(this.pointer);
  }

  /**
   * Get the size of this object in bytes
   */
  getSize(): number {
    return this.native.mono_object_get_size(this.pointer) as number;
  }

  /**
   * Get a field value from this object
   * @param name Field name
   * @returns Field if found, null otherwise
   */
  field(name: string): MonoField | null {
    return this.getClass().field(name);
  }

  /**
   * Get field value directly
   * @param name Field name
   * @returns Field value
   */
  getFieldValue(name: string): any {
    const field = this.field(name);
    if (!field) {
      throw new Error(`Field '${name}' not found on ${this.getClass().fullName}`);
    }
    return field.getValue(this.pointer);
  }

  /**
   * Set field value directly
   * @param name Field name
   * @param value Value to set
   */
  setFieldValue(name: string, value: any): void {
    const field = this.field(name);
    if (!field) {
      throw new Error(`Field '${name}' not found on ${this.getClass().fullName}`);
    }
    field.setValue(this.pointer, value);
  }

  /**
   * Get a method from this object's class
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns Method if found, null otherwise
   */
  method(name: string, paramCount = -1): MonoMethod | null {
    return this.getClass().method(name, paramCount);
  }

  /**
   * Invoke a method on this object
   * @param name Method name
   * @param args Arguments to pass
   * @returns Method return value
   */
  invoke(name: string, args: any[] = []): any {
    const method = this.method(name, args.length);
    if (!method) {
      throw new Error(`Method '${name}' not found on ${this.getClass().fullName}`);
    }
    return method.invoke(this.pointer, args);
  }

  /**
   * Convert this object to a string representation
   */
  toString(): string {
    const strPtr = this.native.mono_object_to_string(this.pointer, NULL);
    if (pointerIsNull(strPtr)) {
      return `[${this.getClass().fullName}]`;
    }
    const chars = this.native.mono_string_chars(strPtr);
    const length = this.native.mono_string_length(strPtr) as number;
    return readUtf16String(chars, length);
  }

  // ===== CONSISTENT API PATTERNS =====

  /**
   * Get a human-readable description of this object
   */
  describe(): string {
    const klass = this.getClass();
    const className = klass.getFullName();
    const size = this.getSize();

    return `${className} object (size: ${size} bytes, ptr: ${this.pointer})`;
  }

  /**
   * Get object metadata information
   */
  getObjectInfo(): { className: string; size: number; pointer: NativePointer; isValueType: boolean } {
    const klass = this.getClass();
    return {
      className: klass.getFullName(),
      size: this.getSize(),
      pointer: this.pointer,
      isValueType: klass.isValueType()
    };
  }

  /**
   * Validate object integrity
   */
  validateObject(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if pointer is null
      if (pointerIsNull(this.pointer)) {
        errors.push('Object pointer is null');
        return { isValid: false, errors };
      }

      // Check if we can get the class
      const klass = this.getClass();
      if (!klass) {
        errors.push('Unable to determine object class');
      }

      // Check if size is reasonable
      const size = this.getSize();
      if (size < 0) {
        errors.push(`Invalid object size: ${size}`);
      }

    } catch (error) {
      errors.push(`Object validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

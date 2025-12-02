import { pointerIsNull } from "../utils/memory";
import { readUtf16String } from "../utils/string";
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
   * Check if this object is a value type (struct)
   * @returns true if this is a boxed value type
   */
  isValueType(): boolean {
    return this.getClass().isValueType();
  }

  /**
   * Get the appropriate instance pointer for method invocation.
   * For value types, returns the unboxed pointer.
   * For reference types, returns the object pointer.
   * @returns The correct pointer to use as 'this' for method calls
   */
  getInstancePointer(): NativePointer {
    if (this.isValueType()) {
      return this.unbox();
    }
    return this.pointer;
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
   * Get a method from this object's class hierarchy (searches parent classes too)
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns Method if found, null otherwise
   */
  methodInHierarchy(name: string, paramCount = -1): MonoMethod | null {
    let current: MonoClass | null = this.getClass();
    while (current) {
      const method = current.method(name, paramCount);
      if (method) return method;
      current = current.parent;
    }
    return null;
  }

  /**
   * Invoke a method on this object (raw - returns NativePointer)
   * @param name Method name
   * @param args Arguments to pass
   * @returns Raw NativePointer result
   * 
   * Note: For value types (structs), this automatically uses the unboxed
   * pointer as the 'this' argument.
   * 
   * @deprecated Use call() instead for automatic unboxing
   */
  invoke(name: string, args: any[] = []): NativePointer {
    const method = this.method(name, args.length) || this.methodInHierarchy(name, args.length);
    if (!method) {
      throw new Error(`Method '${name}' not found on ${this.getClass().fullName}`);
    }
    // Use getInstancePointer() to correctly handle value types
    return method.invoke(this.getInstancePointer(), args);
  }

  /**
   * Call a method on this object with automatic unboxing.
   * This is the preferred way to call methods.
   * 
   * @param name Method name
   * @param args Arguments to pass (will be auto-boxed)
   * @returns Unboxed return value with proper TypeScript type
   * 
   * @example
   * // Call a method that returns int
   * const count = obj.call<number>("GetCount");
   * 
   * // Call a method that returns string
   * const name = obj.call<string>("get_name");
   * 
   * // Call a method with arguments
   * const result = obj.call<boolean>("SetValue", [42, "test"]);
   */
  call<T = any>(name: string, args: any[] = []): T {
    const method = this.method(name, args.length) || this.methodInHierarchy(name, args.length);
    if (!method) {
      throw new Error(`Method '${name}' not found on ${this.getClass().fullName}`);
    }
    return method.call<T>(this.getInstancePointer(), args);
  }

  /**
   * Safely call a method, returning undefined if the method doesn't exist.
   * 
   * @param name Method name
   * @param args Arguments to pass
   * @returns Unboxed return value, or undefined if method not found
   */
  tryCall<T = any>(name: string, args: any[] = []): T | undefined {
    const method = this.method(name, args.length) || this.methodInHierarchy(name, args.length);
    if (!method) {
      return undefined;
    }
    return method.call<T>(this.getInstancePointer(), args);
  }

  /**
   * Get a property value using the getter method.
   * Automatically handles get_PropertyName convention.
   * 
   * @param name Property name (without "get_" prefix)
   * @returns Property value (automatically unboxed)
   * 
   * @example
   * const name = obj.get<string>("name");
   * const count = obj.get<number>("Count");
   */
  get<T = any>(name: string): T {
    // Try property getter
    const getterName = name.startsWith("get_") ? name : `get_${name}`;
    return this.call<T>(getterName, []);
  }

  /**
   * Try to get a property value, returning undefined if not found.
   * 
   * @param name Property name
   * @returns Property value or undefined
   */
  tryGet<T = any>(name: string): T | undefined {
    const getterName = name.startsWith("get_") ? name : `get_${name}`;
    return this.tryCall<T>(getterName, []);
  }

  /**
   * Set a property value using the setter method.
   * Automatically handles set_PropertyName convention.
   * 
   * @param name Property name (without "set_" prefix)
   * @param value Value to set
   * 
   * @example
   * obj.set("name", "NewName");
   * obj.set("Count", 42);
   */
  set(name: string, value: any): void {
    const setterName = name.startsWith("set_") ? name : `set_${name}`;
    this.call<void>(setterName, [value]);
  }

  /**
   * Check if this object has a method with the given name.
   * 
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns True if method exists
   */
  hasMethod(name: string, paramCount = -1): boolean {
    return this.methodInHierarchy(name, paramCount) !== null;
  }

  /**
   * Convert this object to a string representation
   */
  toString(): string {
    try {
      // Try mono_object_to_string first if available
      if (this.api.hasExport("mono_object_to_string")) {
        const excSlot = Memory.alloc(Process.pointerSize);
        excSlot.writePointer(NULL);
        const strPtr = this.native.mono_object_to_string(this.pointer, excSlot);
        
        // Check if ToString threw an exception
        if (!pointerIsNull(excSlot.readPointer())) {
          return `[${this.getClass().fullName}]`;
        }
        
        if (!pointerIsNull(strPtr)) {
          return this.monoStringToJs(strPtr);
        }
      }
      
      // Fallback: Call ToString() method directly via mono_runtime_invoke
      const klass = this.getClass();
      const toStringMethod = klass.getMethod("ToString", 0);
      if (toStringMethod) {
        const excSlot = Memory.alloc(Process.pointerSize);
        excSlot.writePointer(NULL);
        
        // For value types, we need to use the unboxed pointer
        const instancePtr = this.getInstancePointer();
        const strPtr = this.native.mono_runtime_invoke(
          toStringMethod.pointer,
          instancePtr,
          NULL,
          excSlot
        );
        
        if (!pointerIsNull(excSlot.readPointer())) {
          return `[${klass.fullName}]`;
        }
        
        if (!pointerIsNull(strPtr)) {
          return this.monoStringToJs(strPtr);
        }
      }
    } catch (e) {
      // Silently fall back to class name
    }
    
    return `[${this.getClass().fullName}]`;
  }

  /**
   * Convert a MonoString pointer to JavaScript string
   * Uses available Mono API with fallbacks
   */
  private monoStringToJs(strPtr: NativePointer): string {
    // Try mono_string_to_utf8 first (most common)
    if (this.api.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(strPtr);
      if (!pointerIsNull(utf8Ptr)) {
        const result = utf8Ptr.readUtf8String();
        return result || "";
      }
    }
    
    // Fallback: Try mono_string_to_utf16
    if (this.api.hasExport("mono_string_to_utf16")) {
      const utf16Ptr = this.native.mono_string_to_utf16(strPtr);
      if (!pointerIsNull(utf16Ptr)) {
        return readUtf16String(utf16Ptr);
      }
    }
    
    // Last resort: Try mono_string_chars + mono_string_length
    if (this.api.hasExport("mono_string_chars") && this.api.hasExport("mono_string_length")) {
      const chars = this.native.mono_string_chars(strPtr);
      const length = this.native.mono_string_length(strPtr) as number;
      return readUtf16String(chars, length);
    }
    
    return "";
  }

  // ===== CONSISTENT API PATTERNS =====

  /**
   * Get property value directly (shorthand)
   * @param name Property name
   * @returns Property value
   */
  getProperty(name: string): any {
    const klass = this.getClass();
    const prop = klass.getProperty(name);
    if (!prop) {
      throw new Error(`Property '${name}' not found on ${klass.fullName}`);
    }
    return prop.getValue(this);
  }

  /**
   * Set property value directly (shorthand)
   * @param name Property name
   * @param value Value to set
   */
  setProperty(name: string, value: any): void {
    const klass = this.getClass();
    const prop = klass.getProperty(name);
    if (!prop) {
      throw new Error(`Property '${name}' not found on ${klass.fullName}`);
    }
    prop.setValue(this, value);
  }

  /**
   * Get a field, property, or call a parameterless method by name
   * Provides a unified interface for accessing object members
   * @param name Member name
   * @returns Member value
   */
  getMember(name: string): any {
    const klass = this.getClass();
    
    // Try field first
    const field = klass.field(name);
    if (field) {
      return field.getValue(this.pointer);
    }
    
    // Try property
    const prop = klass.getProperty(name);
    if (prop) {
      return prop.getValue(this);
    }
    
    // Try method with no parameters (getter-like)
    const method = klass.method(name, 0);
    if (method) {
      return method.invoke(this.getInstancePointer(), []);
    }
    
    throw new Error(`Member '${name}' not found on ${klass.fullName}`);
  }

  /**
   * Check if this object has a specific field
   */
  hasField(name: string): boolean {
    return this.getClass().field(name) !== null;
  }

  /**
   * Check if this object has a specific property
   */
  hasProperty(name: string): boolean {
    return this.getClass().getProperty(name) !== null;
  }

  /**
   * Get all field values as an object
   */
  toObject(): Record<string, any> {
    const result: Record<string, any> = {};
    const klass = this.getClass();
    
    for (const field of klass.getFields()) {
      try {
        result[field.getName()] = field.getValue(this.pointer);
      } catch {
        result[field.getName()] = undefined;
      }
    }
    
    return result;
  }

  /**
   * Cast this object to a specific type wrapper
   * @param wrapperClass The wrapper class constructor
   * @returns Instance of the wrapper class
   */
  as<T extends MonoObject>(wrapperClass: new (api: any, pointer: NativePointer) => T): T {
    return new wrapperClass(this.api, this.pointer);
  }

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

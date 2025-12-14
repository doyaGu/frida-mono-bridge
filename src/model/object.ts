import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";
import { MonoField } from "./field";
import { MonoMethod } from "./method";

/**
 * Represents a Mono object instance.
 *
 * ## Member Access API Summary
 *
 * ### Field Access (direct memory read/write)
 * - `field(name)` / `tryField(name)` - Get MonoField object
 * - `getFieldValue(name)` / `setFieldValue(name, value)` - Direct field access
 *
 * ### Property Access (via MonoProperty reflection)
 * - `getProperty(name)` / `setProperty(name, value)` - Use MonoProperty.getValue/setValue
 * - `tryGetProperty(name)` / `trySetProperty(name, value)` - Non-throwing variants
 *
 * ### Method-Based Property Access (calls get_/set_ methods)
 * - `get(name)` / `set(name, value)` - Call getter/setter methods
 * - `tryGet(name)` / `trySet(name, value)` - Non-throwing variants
 *
 * ### Method Invocation
 * - `method(name)` / `tryMethod(name)` - Get MonoMethod object
 * - `call(name, args)` / `tryCall(name, args)` - Call method with auto-unboxing
 * - `invoke(name, args)` - Raw invoke returning NativePointer
 *
 * ### Unified Access (tries field -> property -> method)
 * - `getMember(name)` / `tryGetMember(name)` - Auto-detect member type
 */
export class MonoObject extends MonoHandle {
  // ===== CORE PROPERTIES =====

  /**
   * Get the class of this object
   */
  @lazy
  get class(): MonoClass {
    const klassPtr = this.native.mono_object_get_class(this.pointer);
    return new MonoClass(this.api, klassPtr);
  }

  /**
   * Get the size of this object in bytes
   */
  @lazy
  get size(): number {
    return this.native.mono_object_get_size(this.pointer) as number;
  }

  /**
   * Check if this object is a value type (struct)
   */
  @lazy
  get isValueType(): boolean {
    return this.class.isValueType;
  }

  /**
   * Get the appropriate instance pointer for method invocation.
   * For value types, returns the unboxed pointer.
   * For reference types, returns the object pointer.
   */
  @lazy
  get instancePointer(): NativePointer {
    if (this.isValueType) {
      return this.unbox();
    }
    return this.pointer;
  }

  /**
   * Check if this object pointer is null
   */
  @lazy
  get isNull(): boolean {
    return pointerIsNull(this.pointer);
  }

  /**
   * Unbox a value type object
   * @returns Pointer to the unboxed value
   */
  unbox(): NativePointer {
    return this.native.mono_object_unbox(this.pointer);
  }

  // ===== FIELD OPERATIONS =====

  /**
   * Get a field from this object, throwing if not found.
   * @param name Field name
   * @returns MonoField
   * @throws {MonoFieldNotFoundError} if field not found
   */
  field(name: string): MonoField {
    return this.class.field(name);
  }

  /**
   * Try to get a field from this object without throwing.
   * @param name Field name
   * @returns Field if found, null otherwise
   */
  tryField(name: string): MonoField | null {
    return this.class.tryField(name);
  }

  /**
   * Check if this object has a specific field
   */
  hasField(name: string): boolean {
    return this.class.tryField(name) !== null;
  }

  /**
   * Get field value directly
   * @param name Field name
   * @returns Field value
   * @throws {MonoFieldNotFoundError} if field not found
   */
  getFieldValue(name: string): any {
    const f = this.field(name);
    return f.getValue(this.pointer);
  }

  /**
   * Try to get field value directly without throwing for missing fields.
   * @param name Field name
   * @returns Field value or null if field not found
   */
  tryGetFieldValue(name: string): any | null {
    const f = this.tryField(name);
    if (!f) {
      return null;
    }
    return f.getValue(this.pointer);
  }

  /**
   * Set field value directly
   * @param name Field name
   * @param value Value to set
   * @throws {MonoFieldNotFoundError} if field not found
   */
  setFieldValue(name: string, value: any): void {
    const f = this.field(name);
    f.setValue(this.pointer, value);
  }

  /**
   * Try to set field value without throwing for missing fields.
   * @param name Field name
   * @param value Value to set
   * @returns True if field was set, false if field not found
   */
  trySetFieldValue(name: string, value: any): boolean {
    const f = this.tryField(name);
    if (!f) {
      return false;
    }
    f.setValue(this.pointer, value);
    return true;
  }

  // ===== METHOD OPERATIONS =====

  /**
   * Get a method from this object's class, throwing if not found.
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns MonoMethod
   * @throws {MonoMethodNotFoundError} if method not found
   */
  method(name: string, paramCount = -1): MonoMethod {
    return this.class.method(name, paramCount);
  }

  /**
   * Try to get a method from this object's class without throwing.
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns Method if found, null otherwise
   */
  tryMethod(name: string, paramCount = -1): MonoMethod | null {
    return this.class.tryMethod(name, paramCount);
  }

  /**
   * Get a method from this object's class hierarchy, throwing if not found.
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns MonoMethod
   * @throws {MonoMethodNotFoundError} if method not found in hierarchy
   */
  methodInHierarchy(name: string, paramCount = -1): MonoMethod {
    const m = this.tryMethodInHierarchy(name, paramCount);
    if (m) {
      return m;
    }
    const paramHint = paramCount >= 0 ? ` with ${paramCount} parameter(s)` : "";
    raise(
      MonoErrorCodes.METHOD_NOT_FOUND,
      `Method '${name}'${paramHint} not found on '${this.class.fullName}' or any of its base classes`,
      "Use tryMethodInHierarchy() to avoid throwing",
    );
  }

  /**
   * Try to get a method from this object's class hierarchy (searches parent classes too) without throwing.
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns Method if found, null otherwise
   */
  tryMethodInHierarchy(name: string, paramCount = -1): MonoMethod | null {
    let current: MonoClass | null = this.class;
    while (current) {
      const m = current.tryMethod(name, paramCount);
      if (m) return m;
      current = current.parent;
    }
    return null;
  }

  /**
   * Check if this object has a method with the given name.
   *
   * @param name Method name
   * @param paramCount Parameter count (-1 for any)
   * @returns True if method exists
   */
  hasMethod(name: string, paramCount = -1): boolean {
    return this.tryMethodInHierarchy(name, paramCount) !== null;
  }

  // ===== METHOD INVOCATION =====

  /**
   * Invoke a method on this object (raw - returns NativePointer)
   * @param name Method name
   * @param args Arguments to pass
   * @returns Raw NativePointer result
   * @throws {MonoMethodNotFoundError} if method not found
   *
   * Note: For value types (structs), this automatically uses the unboxed
   * pointer as the 'this' argument.
   */
  invoke(name: string, args: any[] = []): NativePointer {
    const m = this.tryMethod(name, args.length) || this.tryMethodInHierarchy(name, args.length);
    if (!m) {
      raise(
        MonoErrorCodes.METHOD_NOT_FOUND,
        `Method '${name}' with ${args.length} argument(s) not found on '${this.class.fullName}'`,
        "Use tryMethod() or tryMethodInHierarchy() to avoid throwing",
      );
    }
    // Use instancePointer to correctly handle value types
    return m.invoke(this.instancePointer, args);
  }

  /**
   * Call a method on this object with automatic unboxing.
   * This is the preferred way to call methods.
   *
   * @param name Method name
   * @param args Arguments to pass (will be auto-boxed)
   * @returns Unboxed return value with proper TypeScript type
   * @throws {MonoMethodNotFoundError} if method not found
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
    const m = this.tryMethod(name, args.length) || this.tryMethodInHierarchy(name, args.length);
    if (!m) {
      raise(
        MonoErrorCodes.METHOD_NOT_FOUND,
        `Method '${name}' with ${args.length} argument(s) not found on '${this.class.fullName}'`,
        "Use tryCall() to avoid throwing",
      );
    }
    return m.call<T>(this.instancePointer, args);
  }

  /**
   * Safely call a method, returning null if the method doesn't exist.
   *
   * @param name Method name
   * @param args Arguments to pass
   * @returns Unboxed return value, or null if method not found
   */
  tryCall<T = any>(name: string, args: any[] = []): T | null {
    const m = this.tryMethod(name, args.length) || this.tryMethodInHierarchy(name, args.length);
    if (!m) {
      return null;
    }
    return m.call<T>(this.instancePointer, args);
  }

  // ===== PROPERTY OPERATIONS VIA GETTER/SETTER METHODS =====

  /**
   * Get a property value by calling its getter method.
   * Automatically handles get_PropertyName convention.
   *
   * Note: This calls the getter METHOD (e.g., get_Name()).
   * For direct property access via MonoProperty, use getProperty().
   *
   * @param name Property name (without "get_" prefix)
   * @returns Property value (automatically unboxed)
   * @throws {MonoMethodNotFoundError} if getter method not found
   *
   * @example
   * const name = obj.get<string>("Name"); // calls get_Name()
   * const count = obj.get<number>("Count"); // calls get_Count()
   */
  get<T = any>(name: string): T {
    const getterName = name.startsWith("get_") ? name : `get_${name}`;
    return this.call<T>(getterName, []);
  }

  /**
   * Try to get a property value, returning null if not found.
   *
   * @param name Property name (without "get_" prefix)
   * @returns Property value or null if getter not found
   */
  tryGet<T = any>(name: string): T | null {
    const getterName = name.startsWith("get_") ? name : `get_${name}`;
    return this.tryCall<T>(getterName, []);
  }

  /**
   * Set a property value by calling its setter method.
   * Automatically handles set_PropertyName convention.
   *
   * Note: This calls the setter METHOD (e.g., set_Name()).
   * For direct property access via MonoProperty, use setProperty().
   *
   * @param name Property name (without "set_" prefix)
   * @param value Value to set
   * @throws {MonoMethodNotFoundError} if setter method not found
   *
   * @example
   * obj.set("Name", "NewName"); // calls set_Name("NewName")
   * obj.set("Count", 42); // calls set_Count(42)
   */
  set(name: string, value: any): void {
    const setterName = name.startsWith("set_") ? name : `set_${name}`;
    this.call<void>(setterName, [value]);
  }

  /**
   * Try to set a property value, returning false if setter not found.
   *
   * @param name Property name (without "set_" prefix)
   * @param value Value to set
   * @returns True if property was set, false if setter not found
   */
  trySet(name: string, value: any): boolean {
    const setterName = name.startsWith("set_") ? name : `set_${name}`;
    const result = this.tryCall<void>(setterName, [value]);
    return result !== null;
  }

  // ===== PROPERTY OPERATIONS VIA MONOPROPERTY =====

  /**
   * Get property value via MonoProperty object (direct field access).
   *
   * Note: This uses MonoProperty for direct access.
   * For calling getter methods (get_Name), use get() instead.
   *
   * @param name Property name
   * @returns Property value
   * @throws {MonoPropertyNotFoundError} if property not found
   */
  getProperty(name: string): any {
    const klass = this.class;
    const prop = klass.property(name);
    return prop.getValue(this);
  }

  /**
   * Try to get property value directly without throwing.
   * @param name Property name
   * @returns Property value or null if property not found
   */
  tryGetProperty(name: string): any | null {
    const klass = this.class;
    const prop = klass.tryProperty(name);
    if (!prop) {
      return null;
    }
    return prop.getValue(this);
  }

  /**
   * Set property value via MonoProperty object (direct field access).
   *
   * Note: This uses MonoProperty for direct access.
   * For calling setter methods (set_Name), use set() instead.
   *
   * @param name Property name
   * @param value Value to set
   * @throws {MonoPropertyNotFoundError} if property not found
   */
  setProperty(name: string, value: any): void {
    const klass = this.class;
    const prop = klass.property(name);
    prop.setValue(this, value);
  }

  /**
   * Try to set property value without throwing.
   * @param name Property name
   * @param value Value to set
   * @returns True if property was set, false if property not found
   */
  trySetProperty(name: string, value: any): boolean {
    const klass = this.class;
    const prop = klass.tryProperty(name);
    if (!prop) {
      return false;
    }
    prop.setValue(this, value);
    return true;
  }

  /**
   * Check if this object has a specific property
   */
  hasProperty(name: string): boolean {
    return this.class.tryProperty(name) !== null;
  }

  // ===== UNIFIED MEMBER ACCESS =====

  /**
   * Try to get a field, property, or call a parameterless method by name without throwing.
   * @param name Member name
   * @returns Member value or null if not found
   */
  tryGetMember(name: string): any | null {
    const klass = this.class;

    // Try field first
    const f = klass.tryField(name);
    if (f) {
      return f.getValue(this.pointer);
    }

    // Try property
    const prop = klass.tryProperty(name);
    if (prop) {
      return prop.getValue(this);
    }

    // Try method with no parameters (getter-like)
    const m = klass.tryMethod(name, 0);
    if (m) {
      return m.invoke(this.instancePointer, []);
    }

    return null;
  }

  /**
   * Get a field, property, or call a parameterless method by name
   * Provides a unified interface for accessing object members
   * @param name Member name
   * @returns Member value
   * @throws {MonoFieldNotFoundError} if member not found
   */
  getMember(name: string): any {
    const result = this.tryGetMember(name);
    if (result !== null) {
      return result;
    }
    raise(
      MonoErrorCodes.FIELD_NOT_FOUND,
      `Member '${name}' not found on ${this.class.fullName}`,
      "Use tryGetMember() to avoid throwing",
    );
  }

  // ===== OBJECT INSPECTION =====

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
          return `[${this.class.fullName}]`;
        }

        if (!pointerIsNull(strPtr)) {
          return this.api.readMonoString(strPtr, true);
        }
      }

      // Fallback: Call ToString() method directly via mono_runtime_invoke
      const klass = this.class;
      const toStringMethod = klass.tryMethod("ToString", 0);
      if (toStringMethod) {
        const excSlot = Memory.alloc(Process.pointerSize);
        excSlot.writePointer(NULL);

        // For value types, we need to use the unboxed pointer
        const instancePtr = this.instancePointer;
        const strPtr = this.native.mono_runtime_invoke(toStringMethod.pointer, instancePtr, NULL, excSlot);

        if (!pointerIsNull(excSlot.readPointer())) {
          return `[${klass.fullName}]`;
        }

        if (!pointerIsNull(strPtr)) {
          return this.api.readMonoString(strPtr, true);
        }
      }
    } catch (e) {
      // Silently fall back to class name
    }

    return `[${this.class.fullName}]`;
  }

  /**
   * Get a human-readable description of this object
   */
  describe(): string {
    const klass = this.class;
    const className = klass.fullName;
    const size = this.size;

    return `${className} object (size: ${size} bytes, ptr: ${this.pointer})`;
  }

  /**
   * Get object metadata information
   */
  @lazy
  get objectInfo(): { className: string; size: number; pointer: NativePointer; isValueType: boolean } {
    const klass = this.class;
    return {
      className: klass.fullName,
      size: this.size,
      pointer: this.pointer,
      isValueType: klass.isValueType,
    };
  }

  /**
   * Get all field values as an object
   */
  toObject(): Record<string, any> {
    const result: Record<string, any> = {};
    const klass = this.class;

    for (const field of klass.fields) {
      try {
        result[field.name] = field.getValue(this.pointer);
      } catch {
        result[field.name] = undefined;
      }
    }

    return result;
  }

  /**
   * Validate object integrity
   */
  validateObject(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if pointer is null
      if (pointerIsNull(this.pointer)) {
        errors.push("Object pointer is null");
        return { isValid: false, errors };
      }

      // Check if we can get the class
      const klass = this.class;
      if (!klass) {
        errors.push("Unable to determine object class");
      }

      // Check if size is reasonable
      const size = this.size;
      if (size < 0) {
        errors.push(`Invalid object size: ${size}`);
      }
    } catch (error) {
      errors.push(`Object validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check object equality using Equals() method
   * @param other Object to compare with
   * @returns True if objects are equal
   */
  equals(other: MonoObject): boolean {
    try {
      // Try calling Equals(object) method
      const equalsMethod = this.tryMethod("Equals", 1);
      if (equalsMethod) {
        return this.call<boolean>("Equals", [other.pointer]);
      }

      // Fallback to pointer equality
      return this.pointer.equals(other.pointer);
    } catch {
      return this.pointer.equals(other.pointer);
    }
  }

  /**
   * Get the hash code of this object
   * @returns Hash code
   */
  getHashCode(): number {
    try {
      // Try calling GetHashCode() method
      const hashMethod = this.tryMethod("GetHashCode", 0);
      if (hashMethod) {
        return this.call<number>("GetHashCode", []);
      }

      // Fallback to pointer hash
      return this.pointer.toInt32();
    } catch {
      return this.pointer.toInt32();
    }
  }

  /**
   * Get the Type object for this instance
   * @returns MonoObject representing System.Type
   */
  getType(): MonoObject {
    const typeMethod = this.method("GetType", 0);
    const typePtr = typeMethod.invoke(this.instancePointer, []);
    return new MonoObject(this.api, typePtr);
  }

  // ===== TYPE OPERATIONS =====

  /**
   * Cast this object to a specific type wrapper
   * @param wrapperClass The wrapper class constructor
   * @returns Instance of the wrapper class
   */
  as<T extends MonoObject>(wrapperClass: new (api: any, pointer: NativePointer) => T): T {
    return new wrapperClass(this.api, this.pointer);
  }

  // ===== OBJECT CLONING =====

  /**
   * Clone this object (shallow copy).
   * Creates a new instance and copies all field values.
   *
   * For reference type fields, only the reference is copied (shallow).
   * For value type fields, the value is copied.
   *
   * Note: This does not invoke constructors or ICloneable.Clone().
   * For proper deep cloning, implement ICloneable or use serialization.
   *
   * @returns A new MonoObject with copied field values
   *
   * @example
   * const player = domain.class('Game.Player').newObject();
   * const playerClone = player.clone();
   */
  clone(): MonoObject {
    const klass = this.class;

    // For value types (structs), we can use mono_object_clone if available
    if (this.api.hasExport("mono_object_clone")) {
      try {
        const clonedPtr = this.native.mono_object_clone(this.pointer);
        if (!pointerIsNull(clonedPtr)) {
          return new MonoObject(this.api, clonedPtr);
        }
      } catch {
        // Fall through to manual clone
      }
    }

    // Manual clone: create new object and copy fields
    const newObj = klass.newObject(false); // Don't initialize (no constructor call)

    // Copy all instance fields
    for (const field of klass.fields) {
      if (!field.isStatic) {
        try {
          const value = field.getValue(this.pointer);
          field.setValue(newObj.pointer, value);
        } catch {
          // Skip fields that fail to copy (might be special runtime fields)
        }
      }
    }

    return newObj;
  }

  /**
   * Clone this object with deep copying of reference types.
   *
   * Warning: This is a best-effort deep clone that may not work for all types.
   * Complex objects with circular references, native resources, or special
   * runtime state may not clone correctly.
   *
   * @param maxDepth Maximum recursion depth for deep cloning (default: 10)
   * @returns A new MonoObject with recursively cloned field values
   *
   * @example
   * const player = domain.class('Game.Player').newObject();
   * const deepClone = player.deepClone();
   */
  deepClone(maxDepth = 10): MonoObject {
    return this.deepCloneInternal(maxDepth, new Map());
  }

  /**
   * Internal deep clone implementation with cycle detection
   */
  private deepCloneInternal(maxDepth: number, visited: Map<string, MonoObject>): MonoObject {
    // Check for cycles
    const ptrKey = this.pointer.toString();
    if (visited.has(ptrKey)) {
      return visited.get(ptrKey)!;
    }

    // Depth limit reached, do shallow clone
    if (maxDepth <= 0) {
      return this.clone();
    }

    const klass = this.class;

    // Create new object without initialization
    const newObj = klass.newObject(false);
    visited.set(ptrKey, newObj);

    // Copy all instance fields
    for (const field of klass.fields) {
      if (field.isStatic) continue;

      try {
        const fieldType = field.type;
        const value = field.getValue(this.pointer);

        // Check if this is a reference type that needs deep cloning
        if (fieldType.referenceType && !pointerIsNull(value)) {
          // Don't deep clone strings (immutable) or null
          const typeName = fieldType.name;
          if (typeName !== "String" && typeName !== "System.String") {
            try {
              const refObj = new MonoObject(this.api, value);
              const clonedRef = refObj.deepCloneInternal(maxDepth - 1, visited);
              field.setValue(newObj.pointer, clonedRef.pointer);
              continue;
            } catch {
              // Fall through to shallow copy
            }
          }
        }

        // Shallow copy for value types, strings, and failed deep clones
        field.setValue(newObj.pointer, value);
      } catch {
        // Skip fields that fail to copy
      }
    }

    return newObj;
  }
}

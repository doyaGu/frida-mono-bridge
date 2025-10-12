import { MonoHandle } from "./base";
import { pointerIsNull, readUtf8String } from "../runtime/mem";
import { MonoMethod } from "./method";
import { MonoClass } from "./class";
import { MonoObject } from "./object";
import { MonoType } from "./type";

/**
 * Represents a Mono property (System.Reflection.PropertyInfo)
 */
export class MonoProperty<TValue = any> extends MonoHandle {
  getName(): string {
    const namePtr = this.native.mono_property_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  getParent(): MonoClass {
    const parentPtr = this.native.mono_property_get_parent(this.pointer);
    return new MonoClass(this.api, parentPtr);
  }

  getFlags(): number {
    return this.native.mono_property_get_flags(this.pointer) as number;
  }

  getGetter(): MonoMethod | null {
    const methodPtr = this.native.mono_property_get_get_method(this.pointer);
    if (pointerIsNull(methodPtr)) {
      return null;
    }
    return new MonoMethod(this.api, methodPtr);
  }

  getSetter(): MonoMethod | null {
    const methodPtr = this.native.mono_property_get_set_method(this.pointer);
    if (pointerIsNull(methodPtr)) {
      return null;
    }
    return new MonoMethod(this.api, methodPtr);
  }

  // ===== ENHANCED PROPERTY METHODS =====

  /**
   * Get property name (property accessor)
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get property type
   */
  getType(): MonoType {
    const getter = this.getGetter();
    if (!getter) {
      throw new Error(`Property ${this.getName()} has no getter method`);
    }
    return getter.getReturnType();
  }

  /**
   * Check if property can be read
   */
  canRead(): boolean {
    return this.getGetter() !== null;
  }

  /**
   * Check if property can be written
   */
  canWrite(): boolean {
    return this.getSetter() !== null;
  }

  /**
   * Check if property is static
   */
  isStatic(): boolean {
    const getter = this.getGetter();
    const setter = this.getSetter();

    if (getter) return getter.isStatic();
    if (setter) return setter.isStatic();
    return false;
  }

  /**
   * Check if property has parameters (indexed property)
   */
  hasParameters(): boolean {
    const getter = this.getGetter();
    if (getter) return getter.getParameterCount() > 0;
    return false;
  }

  /**
   * Get property parameters (for indexed properties)
   */
  getParameters(): MonoType[] {
    const getter = this.getGetter();
    if (getter) {
      // For now, return empty array as parameter handling needs more implementation
      // TODO: Implement proper parameter type extraction
      return [];
    }
    return [];
  }

  /**
   * Get property value from object
   * @param instance Object instance (for instance properties)
   * @returns Property value
   */
  getValue(instance: MonoObject | NativePointer | null = null): TValue {
    const getter = this.getGetter();
    if (!getter) {
      throw new Error(`Property ${this.getName()} is not readable`);
    }

    const rawResult = getter.invoke(this.resolveInstance(instance), []);
    const resultObject = pointerIsNull(rawResult) ? null : new MonoObject(this.api, rawResult);
    return this.convertResult(resultObject) as TValue;
  }

  /**
   * Set property value on object
   * @param instance Object instance (for instance properties)
   * @param value Value to set
   */
  setValue(instance: MonoObject | NativePointer | null = null, value: TValue): void {
    const setter = this.getSetter();
    if (!setter) {
      throw new Error(`Property ${this.getName()} is not writable`);
    }

    setter.invoke(this.resolveInstance(instance), [this.convertValue(value)]);
  }

  /**
   * Get typed property value
   * @param instance Object instance (optional for static properties)
   * @returns Typed property value
   */
  getTypedValue(instance: MonoObject | NativePointer | null = null): TValue {
    return this.getValue(instance);
  }

  /**
   * Set typed property value
   * @param instance Object instance (optional for static properties)
   * @param value Typed value to set
   */
  setTypedValue(instance: MonoObject | NativePointer | null = null, value: TValue): void {
    this.setValue(instance, value);
  }

  private resolveInstance(instance: MonoObject | NativePointer | null): MonoObject | null {
    if (instance === null) {
      return null;
    }
    if (instance instanceof MonoObject) {
      return instance;
    }
    if (instance.isNull()) {
      return null;
    }
    return new MonoObject(this.api, instance);
  }

  /**
   * Get property metadata information
   */
  getPropertyInfo(): PropertyInfo {
    return {
      name: this.getName(),
      typeName: this.getType().getName(),
      canRead: this.canRead(),
      canWrite: this.canWrite(),
      isStatic: this.isStatic(),
      hasParameters: this.hasParameters(),
      parameterCount: this.getParameters().length,
      declaringType: this.getParent().getFullName()
    };
  }

  /**
   * Get a human-readable description of this property
   */
  describe(): string {
    const type = this.getType().getName();
    const modifiers = [];

    if (this.isStatic()) modifiers.push('static');
    if (!this.canRead()) modifiers.push('writeonly');
    if (!this.canWrite()) modifiers.push('readonly');

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(' ')} ` : '';
    return `${modifierStr}${type} ${this.getName()}`;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Convert method result to appropriate type
   */
  private convertResult(result: MonoObject | null): any {
    if (!result) return null;

    const propertyType = this.getType();

    // For now, just return the result or unboxed value
    // TODO: Add proper type conversion based on property type
    try {
      if (propertyType.isValueType()) {
        return result.unbox();
      }
      return result;
    } catch {
      return result;
    }
  }

  /**
   * Convert value to appropriate parameter type
   */
  private convertValue(value: TValue): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof MonoObject) {
      return value;
    }

    // For now, just return the value as-is
    // TODO: Add proper type conversion for different property types
    console.warn(`Type conversion not implemented for ${typeof value}, using raw value`);
    return value;
  }
}

// ===== INTERFACES =====

export interface PropertyInfo {
  name: string;
  typeName: string;
  canRead: boolean;
  canWrite: boolean;
  isStatic: boolean;
  hasParameters: boolean;
  parameterCount: number;
  declaringType: string;
}

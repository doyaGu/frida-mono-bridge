import { MethodArgument, MonoHandle } from "./base";
import { pointerIsNull } from "../utils/pointer-utils";
import { readUtf8String } from "../utils/string-utils";
import { MonoMethod } from "./method";
import { MonoClass } from "./class";
import { MonoObject } from "./object";
import { MonoType } from "./type";
import { MonoValidationError } from "../patterns/errors";

/**
 * Represents a Mono property (System.Reflection.PropertyInfo)
 */
export class MonoProperty<TValue = any> extends MonoHandle {
  #name: string | null = null;
  #parent: MonoClass | null = null;
  #getter: MonoMethod | null | undefined;
  #setter: MonoMethod | null | undefined;
  #type: MonoType | null = null;

  getName(): string {
    if (this.#name !== null) {
      return this.#name;
    }
    const namePtr = this.native.mono_property_get_name(this.pointer);
    this.#name = readUtf8String(namePtr);
    return this.#name;
  }

  getParent(): MonoClass {
    if (this.#parent) {
      return this.#parent;
    }
    const parentPtr = this.native.mono_property_get_parent(this.pointer);
    this.#parent = new MonoClass(this.api, parentPtr);
    return this.#parent;
  }

  getFlags(): number {
    return this.native.mono_property_get_flags(this.pointer) as number;
  }

  getGetter(): MonoMethod | null {
    if (this.#getter !== undefined) {
      return this.#getter;
    }
    const methodPtr = this.native.mono_property_get_get_method(this.pointer);
    this.#getter = pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
    return this.#getter;
  }

  getSetter(): MonoMethod | null {
    if (this.#setter !== undefined) {
      return this.#setter;
    }
    const methodPtr = this.native.mono_property_get_set_method(this.pointer);
    this.#setter = pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
    return this.#setter;
  }

  // ===== ENHANCED PROPERTY METHODS =====

  /**
   * Get property name (property accessor)
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Declaring class accessor
   */
  get parent(): MonoClass {
    return this.getParent();
  }

  /**
   * Getter method accessor
   */
  get getter(): MonoMethod | null {
    return this.getGetter();
  }

  /**
   * Setter method accessor
   */
  get setter(): MonoMethod | null {
    return this.getSetter();
  }

  /**
   * Get property type
   */
  getType(): MonoType {
    if (this.#type) {
      return this.#type;
    }
    const getter = this.getGetter();
    if (getter) {
      this.#type = getter.getReturnType();
      return this.#type;
    }

    const setter = this.getSetter();
    if (!setter) {
      throw new MonoValidationError(
        `Property ${this.getName()} has no getter or setter method`,
        "property",
        this
      );
    }

    const parameterTypes = setter.getParameterTypes();
    if (parameterTypes.length === 0) {
      throw new MonoValidationError(
        `Property ${this.getName()} setter exposes no parameters to infer type from`,
        "property",
        this
      );
    }

    this.#type = parameterTypes[parameterTypes.length - 1];
    return this.#type;
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
   * Property type accessor
   */
  get type(): MonoType {
    return this.getType();
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
    return this.getParameters().length > 0;
  }

  /**
   * Get property parameters (for indexed properties)
   */
  getParameters(): MonoType[] {
    const getter = this.getGetter();
    if (getter) {
      return [...getter.getParameterTypes()];
    }

    const setter = this.getSetter();
    if (setter) {
      const setterParameters = setter.getParameterTypes();
      if (setterParameters.length <= 1) {
        return [];
      }
      return setterParameters.slice(0, setterParameters.length - 1);
    }

    return [];
  }

  /**
   * Get property value from object
   * @param instance Object instance (for instance properties)
   * @returns Property value
   */
  getValue(instance: MonoObject | NativePointer | null = null, parameters: MethodArgument[] = []): TValue {
    const getter = this.getGetter();
    if (!getter) {
      throw new Error(`Property ${this.getName()} is not readable`);
    }

    const rawResult = getter.invoke(this.resolveInstance(instance), parameters);
    const resultObject = pointerIsNull(rawResult) ? null : new MonoObject(this.api, rawResult);
    return this.convertResult(resultObject) as TValue;
  }

  /**
   * Set property value on object
   * @param instance Object instance (for instance properties)
   * @param value Value to set
   */
  setValue(instance: MonoObject | NativePointer | null = null, value: TValue, parameters: MethodArgument[] = []): void {
    const setter = this.getSetter();
    if (!setter) {
      throw new Error(`Property ${this.getName()} is not writable`);
    }

    const invocationArgs = [...parameters, this.convertValue(value)];
    setter.invoke(this.resolveInstance(instance), invocationArgs);
  }

  /**
   * Get typed property value
   * @param instance Object instance (optional for static properties)
   * @returns Typed property value
   */
  getTypedValue(instance: MonoObject | NativePointer | null = null, parameters: MethodArgument[] = []): TValue {
    return this.getValue(instance, parameters);
  }

  /**
   * Set typed property value
   * @param instance Object instance (optional for static properties)
   * @param value Typed value to set
   */
  setTypedValue(instance: MonoObject | NativePointer | null = null, value: TValue, parameters: MethodArgument[] = []): void {
    this.setValue(instance, value, parameters);
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
    const parameters = this.getParameters();
    return {
      name: this.getName(),
      typeName: this.getType().getName(),
      canRead: this.canRead(),
      canWrite: this.canWrite(),
      isStatic: this.isStatic(),
      hasParameters: parameters.length > 0,
      parameterCount: parameters.length,
      parameterTypeNames: parameters.map(param => param.getName()),
      declaringType: this.getParent().getFullName()
    };
  }

  /**
   * Get a human-readable description of this property
   */
  describe(): string {
    const type = this.getType().getName();
    const modifiers = [];
    const parameters = this.getParameters();

    if (this.isStatic()) modifiers.push('static');
    if (!this.canRead()) modifiers.push('writeonly');
    if (!this.canWrite()) modifiers.push('readonly');

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(' ')} ` : '';
    const parameterList = parameters.length > 0 ? `[${parameters.map(p => p.getName()).join(', ')}]` : '';
    return `${modifierStr}${type} ${this.getName()}${parameterList}`;
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
  parameterTypeNames: string[];
  declaringType: string;
}

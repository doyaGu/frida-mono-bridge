import { hasFlag, pickFlags } from "../runtime/metadata";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoArray } from "./array";
import { CustomAttribute, MemberAccessibility, MethodArgument, MonoHandle } from "./base";
import { MonoClass } from "./class";
import { createPropertyAttributeContext, getCustomAttributes } from "./custom-attributes";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { MonoType, MonoTypeSummary } from "./type";
import { convertJsToMono, convertMonoToJs, resolveInstance as resolveInstanceHelper } from "./value-conversion";

// ===== PROPERTY ATTRIBUTES =====

/**
 * Property attribute flags from ECMA-335 II.23.1.14
 * @see https://www.ecma-international.org/publications-and-standards/standards/ecma-335/
 */
export const PropertyAttribute = Object.freeze({
  /** Property has a special name */
  SpecialName: 0x0200,
  /** Runtime should check name encoding */
  RTSpecialName: 0x0400,
  /** Property has a default value */
  HasDefault: 0x1000,
  /** Reserved mask for property attributes */
  ReservedMask: 0xf400,
} as const);

const PROPERTY_FLAGS: Record<string, number> = {
  SpecialName: PropertyAttribute.SpecialName,
  RTSpecialName: PropertyAttribute.RTSpecialName,
  HasDefault: PropertyAttribute.HasDefault,
};

// ===== TYPE DEFINITIONS =====

export type PropertyAccessibility = MemberAccessibility;

/**
 * Summary information for a property
 */
export interface MonoPropertySummary {
  name: string;
  typeName: string;
  type: MonoTypeSummary;
  declaringType: string;
  flags: number;
  flagNames: string[];
  canRead: boolean;
  canWrite: boolean;
  isStatic: boolean;
  isIndexer: boolean;
  parameterCount: number;
  parameterTypeNames: string[];
  hasDefault: boolean;
  isSpecialName: boolean;
}

/**
 * Property metadata information
 */
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

// ===== MAIN CLASS =====

/**
 * Represents a Mono property (System.Reflection.PropertyInfo)
 *
 * Properties in .NET are named members that provide a flexible mechanism to read,
 * write, or compute values. Properties can be used as if they are public data members,
 * but they are actually special methods called accessors.
 *
 * @template TValue The type of the property value
 *
 * @example
 * ```typescript
 * // Get a property from a class
 * const prop = monoClass.getProperty('Name');
 *
 * // Read property value
 * const value = prop.getValue(instance);
 *
 * // Write property value
 * prop.setValue(instance, 'NewValue');
 *
 * // Check property capabilities
 * if (prop.canRead() && prop.canWrite()) {
 *   console.log('Property is readable and writable');
 * }
 * ```
 */
export class MonoProperty<TValue = any> extends MonoHandle {
  // ===== CORE PROPERTIES =====

  /**
   * Property name
   */
  @lazy
  get name(): string {
    const namePtr = this.native.mono_property_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  /**
   * Declaring class
   */
  @lazy
  get parent(): MonoClass {
    const parentPtr = this.native.mono_property_get_parent(this.pointer);
    return new MonoClass(this.api, parentPtr);
  }

  /**
   * Property attribute flags (see PropertyAttribute)
   */
  @lazy
  get flags(): number {
    return this.native.mono_property_get_flags(this.pointer) as number;
  }

  /**
   * Getter method (or null if property is write-only)
   */
  @lazy
  get getter(): MonoMethod | null {
    const methodPtr = this.native.mono_property_get_get_method(this.pointer);
    return pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
  }

  /**
   * Setter method (or null if property is read-only)
   */
  @lazy
  get setter(): MonoMethod | null {
    const methodPtr = this.native.mono_property_get_set_method(this.pointer);
    return pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
  }

  // ===== TYPE INFORMATION =====

  /**
   * Property type
   * @throws {MonoValidationError} if type cannot be determined
   */
  @lazy
  get type(): MonoType {
    if (this.getter) {
      return this.getter.returnType;
    }

    if (!this.setter) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Property ${this.name} has no getter or setter method`,
        "Ensure property has at least one accessor",
      );
    }

    const parameterTypes = this.setter.parameterTypes;
    if (parameterTypes.length === 0) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Property ${this.name} setter exposes no parameters to infer type from`,
        "Ensure setter has at least one parameter",
      );
    }

    return parameterTypes[parameterTypes.length - 1];
  }
  // ===== CAPABILITY CHECKS =====

  /**
   * Check if property can be read (has a getter)
   */
  @lazy
  get canRead(): boolean {
    return this.getter !== null;
  }

  /**
   * Check if property can be written (has a setter)
   */
  @lazy
  get canWrite(): boolean {
    return this.setter !== null;
  }

  /**
   * Check if property is static
   */
  @lazy
  get isStatic(): boolean {
    if (this.getter) return this.getter.isStatic;
    if (this.setter) return this.setter.isStatic;
    return false;
  }

  /**
   * Check if property has parameters (indexed property/indexer)
   */
  @lazy
  get hasParameters(): boolean {
    return this.parameters.length > 0;
  }

  /**
   * Check if this property has a special name
   */
  @lazy
  get isSpecialName(): boolean {
    return hasFlag(this.flags, PropertyAttribute.SpecialName);
  }

  /**
   * Check if this property has a runtime special name
   */
  @lazy
  get isRTSpecialName(): boolean {
    return hasFlag(this.flags, PropertyAttribute.RTSpecialName);
  }

  /**
   * Check if this property has a default value
   */
  @lazy
  get hasDefault(): boolean {
    return hasFlag(this.flags, PropertyAttribute.HasDefault);
  }

  /**
   * Custom attributes applied to this property.
   * Uses mono_custom_attrs_from_property API to retrieve attribute metadata.
   */
  @lazy
  get customAttributes(): CustomAttribute[] {
    return getCustomAttributes(
      createPropertyAttributeContext(this.api, this.parent.pointer, this.pointer, this.native),
      ptr => new MonoClass(this.api, ptr).name,
      ptr => new MonoClass(this.api, ptr).fullName,
    );
  }

  /**
   * Check if this property is an indexer (has 'Item' name and parameters)
   */
  @lazy
  get isIndexer(): boolean {
    return this.name === "Item" && this.hasParameters;
  }

  // ===== PARAMETER INFORMATION =====

  /**
   * Property parameters (for indexed properties/indexers)
   */
  @lazy
  get parameters(): MonoType[] {
    if (this.getter) {
      return [...this.getter.parameterTypes];
    }

    if (this.setter) {
      const setterParameters = this.setter.parameterTypes;
      if (setterParameters.length <= 1) {
        return [];
      }
      return setterParameters.slice(0, setterParameters.length - 1);
    }

    return [];
  }

  // ===== VALUE ACCESS =====

  /**
   * Get property value from an object instance
   *
   * @param instance Object instance (null for static properties)
   * @param parameters Index parameters (for indexers)
   * @returns Property value
   * @throws {MonoValidationError} if property is write-only
   *
   * @example
   * ```typescript
   * // Instance property
   * const name = nameProp.getValue(instance);
   *
   * // Static property
   * const count = countProp.getValue(null);
   *
   * // Indexer
   * const item = indexerProp.getValue(instance, [0]);
   * ```
   */
  getValue(instance: MonoObject | NativePointer | null = null, parameters: MethodArgument[] = []): TValue {
    if (!this.getter) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Property ${this.name} is not readable (no getter)`,
        "Use canRead to check if property is readable",
      );
    }

    const rawResult = this.getter.invoke(this.resolveInstance(instance), parameters);
    const resultObject = pointerIsNull(rawResult) ? null : new MonoObject(this.api, rawResult);
    return this.convertResult(resultObject) as TValue;
  }

  /**
   * Set property value on an object instance
   *
   * @param instance Object instance (null for static properties)
   * @param value Value to set
   * @param parameters Index parameters (for indexers)
   * @throws {MonoValidationError} if property is read-only
   *
   * @example
   * ```typescript
   * // Instance property
   * nameProp.setValue(instance, 'NewName');
   *
   * // Static property
   * countProp.setValue(null, 42);
   *
   * // Indexer
   * indexerProp.setValue(instance, 'value', [0]);
   * ```
   */
  setValue(instance: MonoObject | NativePointer | null = null, value: TValue, parameters: MethodArgument[] = []): void {
    if (!this.setter) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Property ${this.name} is not writable (no setter)`,
        "Use canWrite to check if property is writable",
      );
    }

    const invocationArgs = [...parameters, this.convertValue(value)];
    this.setter.invoke(this.resolveInstance(instance), invocationArgs);
  }

  /**
   * Try to get property value without throwing
   *
   * @param instance Object instance (null for static properties)
   * @param parameters Index parameters (for indexers)
   * @returns Property value if readable, null otherwise
   *
   * @example
   * ```typescript
   * const value = prop.tryGetValue(instance);
   * if (value !== null) {
   *   console.log('Value:', value);
   * }
   * ```
   */
  tryGetValue(instance: MonoObject | NativePointer | null = null, parameters: MethodArgument[] = []): TValue | null {
    if (!this.canRead) {
      return null;
    }
    try {
      return this.getValue(instance, parameters);
    } catch {
      return null;
    }
  }

  /**
   * Try to set property value without throwing
   *
   * @param instance Object instance (null for static properties)
   * @param value Value to set
   * @param parameters Index parameters (for indexers)
   * @returns true if successful, false otherwise
   *
   * @example
   * ```typescript
   * if (prop.trySetValue(instance, 42)) {
   *   console.log('Value set successfully');
   * }
   * ```
   */
  trySetValue(
    instance: MonoObject | NativePointer | null = null,
    value: TValue,
    parameters: MethodArgument[] = [],
  ): boolean {
    if (!this.canWrite) {
      return false;
    }
    try {
      this.setValue(instance, value, parameters);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get typed property value (alias for getValue)
   * @param instance Object instance (optional for static properties)
   * @param parameters Index parameters (for indexers)
   * @returns Typed property value
   */
  getTypedValue(instance: MonoObject | NativePointer | null = null, parameters: MethodArgument[] = []): TValue {
    return this.getValue(instance, parameters);
  }

  /**
   * Set typed property value (alias for setValue)
   * @param instance Object instance (optional for static properties)
   * @param value Typed value to set
   * @param parameters Index parameters (for indexers)
   */
  setTypedValue(
    instance: MonoObject | NativePointer | null = null,
    value: TValue,
    parameters: MethodArgument[] = [],
  ): void {
    this.setValue(instance, value, parameters);
  }

  // ===== METADATA AND REFLECTION =====

  /**
   * Get property metadata information
   * @returns PropertyInfo object with property details
   */
  @lazy get propertyInfo(): PropertyInfo {
    return {
      name: this.name,
      typeName: this.type.name,
      canRead: this.canRead,
      canWrite: this.canWrite,
      isStatic: this.isStatic,
      hasParameters: this.parameters.length > 0,
      parameterCount: this.parameters.length,
      parameterTypeNames: this.parameters.map(param => param.name),
      declaringType: this.parent.fullName,
    };
  }

  /**
   * Get comprehensive summary of this property
   * @returns MonoPropertySummary with detailed property information
   */
  getSummary(): MonoPropertySummary {
    return {
      name: this.name,
      typeName: this.type.name,
      type: this.type.getSummary(),
      declaringType: this.parent.fullName,
      flags: this.flags,
      flagNames: pickFlags(this.flags, PROPERTY_FLAGS),
      canRead: this.canRead,
      canWrite: this.canWrite,
      isStatic: this.isStatic,
      isIndexer: this.isIndexer,
      parameterCount: this.parameters.length,
      parameterTypeNames: this.parameters.map(param => param.name),
      hasDefault: this.hasDefault,
      isSpecialName: this.isSpecialName,
    };
  }

  /**
   * Get a human-readable description of this property
   * @returns Formatted property signature string
   *
   * @example
   * ```typescript
   * // Returns: "static readonly int Count"
   * // Returns: "string Name { get; set; }"
   * // Returns: "object this[int index]"
   * ```
   */
  describe(): string {
    const typeName = this.type.name;
    const modifiers: string[] = [];
    const accessors: string[] = [];

    if (this.isStatic) modifiers.push("static");
    if (this.canRead) accessors.push("get");
    if (this.canWrite) accessors.push("set");

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
    const accessorStr = ` { ${accessors.join("; ")}; }`;

    if (this.isIndexer) {
      const paramList = this.parameters.map(p => p.name).join(", ");
      return `${modifierStr}${typeName} this[${paramList}]${accessorStr}`;
    }

    return `${modifierStr}${typeName} ${this.name}${accessorStr}`;
  }

  /**
   * Get string representation of this property
   * @returns String in format "PropertyName (PropertyType)"
   */
  override toString(): string {
    return `${this.name} (${this.type.name})`;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Resolve instance pointer from MonoObject or NativePointer.
   * Delegates to shared helper for consistency across model types.
   */
  private resolveInstance(instance: MonoObject | NativePointer | null): NativePointer | null {
    return resolveInstanceHelper(instance);
  }

  /**
   * Convert method result to appropriate JavaScript type.
   * Uses shared conversion for consistency with MonoMethod.call().
   */
  private convertResult(result: MonoObject | null): any {
    if (!result) return null;

    const propertyType = this.type;

    // Use shared conversion logic
    return convertMonoToJs(this.api, result.pointer, propertyType);
  }

  /**
   * Convert value to appropriate Mono type.
   * Uses shared conversion for consistency across model types.
   *
   * Special handling for:
   * - Arrays (converted to MonoArray)
   * - Enums (name-to-value lookup)
   * - Delegates (explicit error)
   *
   * @param value The value to convert
   * @returns The converted value suitable for Mono runtime
   */
  private convertValue(value: TValue): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof MonoObject) {
      return value;
    }

    const propertyType = this.type;

    // Array handling (special case - needs element type info)
    if (Array.isArray(value)) {
      return this.convertArrayValue(value, propertyType);
    }

    // Enum handling - convert string or number to enum value
    if (propertyType.valueType) {
      const enumResult = this.tryConvertEnumValue(value, propertyType);
      if (enumResult !== undefined) {
        return enumResult;
      }
    }

    // Delegate handling
    if (typeof value === "function") {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Cannot convert JavaScript function to delegate",
        "Use MonoDelegate.new() instead",
      );
    }

    // Use shared conversion for primitives, strings, bigints, etc.
    return convertJsToMono(this.api, value, propertyType);
  }

  /**
   * Convert array value to MonoArray
   */
  private convertArrayValue(value: any[], propertyType: MonoType): any {
    // If property type is array, try to convert
    if (propertyType.isArray) {
      const elementType = propertyType.elementType;
      let elementClass = elementType?.class ?? null;

      if (!elementType) {
        return value;
      }

      if (!elementClass) {
        try {
          const klassPtr = this.native.mono_class_from_mono_type(elementType.pointer);
          if (!pointerIsNull(klassPtr)) {
            elementClass = new MonoClass(this.api, klassPtr);
          }
        } catch {
          // ignore
        }
      }

      if (!elementClass) {
        return value;
      }

      const monoArray = MonoArray.new(this.api, elementClass, value.length);

      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];

        if (elementClass.isValueType) {
          if (typeof item === "bigint" && typeof (monoArray as any).setBigInt === "function") {
            (monoArray as any).setBigInt(index, item);
          } else {
            monoArray.setNumber(index, Number(item));
          }
          continue;
        }

        // Reference-type array.
        if (item === null || item === undefined) {
          monoArray.setReference(index, NULL);
          continue;
        }

        if (item instanceof MonoObject) {
          monoArray.setReference(index, item.pointer);
          continue;
        }

        if (typeof item === "string") {
          const strPtr = this.api.stringNew(item);
          monoArray.setReference(index, strPtr);
          continue;
        }

        // Best-effort: allow passing raw pointers.
        monoArray.setReference(index, item as NativePointer);
      }

      return monoArray.pointer;
    }
    return value;
  }

  /**
   * Try to convert value to enum type
   * @returns The converted value, or undefined if not an enum
   */
  private tryConvertEnumValue(value: any, propertyType: MonoType): any {
    const propClass = propertyType.class;
    if (!propClass || !propClass.isEnum) {
      return undefined;
    }

    // Number value for enum
    if (typeof value === "number") {
      return Math.floor(value);
    }

    // String value - try to parse enum name
    if (typeof value === "string") {
      // Try to find enum field by name
      const enumField = propClass.tryField(value);
      if (enumField && enumField.isLiteral) {
        try {
          return enumField.getStaticValue();
        } catch {
          // Fall through
        }
      }
      // Try parsing as number string
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        return numValue;
      }
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Cannot convert '${value}' to enum type ${propertyType.name}`,
        "Provide a valid enum name or numeric value",
      );
    }

    return undefined;
  }
}

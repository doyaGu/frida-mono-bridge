import { MethodArgument, MonoHandle, MemberAccessibility, CustomAttribute, parseCustomAttributes } from "./base";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoMethod } from "./method";
import { MonoClass } from "./class";
import { MonoObject } from "./object";
import { MonoType, MonoTypeSummary } from "./type";
import { MonoValidationError } from "../utils/errors";
import { hasFlag, pickFlags } from "../runtime/metadata";

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

// ===== NUMERIC RANGE DEFINITIONS =====

interface NumericRange {
  min: number;
  max: number;
  name: string;
}

const NUMERIC_RANGES: Record<string, NumericRange> = {
  Byte: { min: 0, max: 255, name: "Byte" },
  "System.Byte": { min: 0, max: 255, name: "Byte" },
  SByte: { min: -128, max: 127, name: "SByte" },
  "System.SByte": { min: -128, max: 127, name: "SByte" },
  Int16: { min: -32768, max: 32767, name: "Int16" },
  "System.Int16": { min: -32768, max: 32767, name: "Int16" },
  UInt16: { min: 0, max: 65535, name: "UInt16" },
  "System.UInt16": { min: 0, max: 65535, name: "UInt16" },
  Int32: { min: -2147483648, max: 2147483647, name: "Int32" },
  "System.Int32": { min: -2147483648, max: 2147483647, name: "Int32" },
  UInt32: { min: 0, max: 4294967295, name: "UInt32" },
  "System.UInt32": { min: 0, max: 4294967295, name: "UInt32" },
};

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
  #name: string | null = null;
  #parent: MonoClass | null = null;
  #getter: MonoMethod | null | undefined;
  #setter: MonoMethod | null | undefined;
  #type: MonoType | null = null;
  #flags: number | null = null;

  // ===== BASIC PROPERTY INFORMATION =====

  /**
   * Get the name of this property
   * @returns Property name
   */
  getName(): string {
    if (this.#name !== null) {
      return this.#name;
    }
    const namePtr = this.native.mono_property_get_name(this.pointer);
    this.#name = readUtf8String(namePtr);
    return this.#name;
  }

  /**
   * Get the class that declares this property
   * @returns Parent class
   */
  getParent(): MonoClass {
    if (this.#parent) {
      return this.#parent;
    }
    const parentPtr = this.native.mono_property_get_parent(this.pointer);
    this.#parent = new MonoClass(this.api, parentPtr);
    return this.#parent;
  }

  /**
   * Get property attribute flags
   * @returns Property flags (see PropertyAttribute)
   */
  getFlags(): number {
    if (this.#flags !== null) {
      return this.#flags;
    }
    this.#flags = this.native.mono_property_get_flags(this.pointer) as number;
    return this.#flags;
  }

  /**
   * Get the getter method for this property
   * @returns Getter method or null if property is write-only
   */
  getGetter(): MonoMethod | null {
    if (this.#getter !== undefined) {
      return this.#getter;
    }
    const methodPtr = this.native.mono_property_get_get_method(this.pointer);
    this.#getter = pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
    return this.#getter;
  }

  /**
   * Get the setter method for this property
   * @returns Setter method or null if property is read-only
   */
  getSetter(): MonoMethod | null {
    if (this.#setter !== undefined) {
      return this.#setter;
    }
    const methodPtr = this.native.mono_property_get_set_method(this.pointer);
    this.#setter = pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
    return this.#setter;
  }

  // ===== PROPERTY ACCESSORS =====

  /**
   * Property name accessor
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
   * Property flags accessor
   */
  get flags(): number {
    return this.getFlags();
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
   * Property type accessor
   */
  get type(): MonoType {
    return this.getType();
  }

  // ===== TYPE INFORMATION =====

  /**
   * Get the type of this property
   * @returns Property type
   * @throws MonoValidationError if type cannot be determined
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
      throw new MonoValidationError(`Property ${this.getName()} has no getter or setter method`, "property", this);
    }

    const parameterTypes = setter.getParameterTypes();
    if (parameterTypes.length === 0) {
      throw new MonoValidationError(
        `Property ${this.getName()} setter exposes no parameters to infer type from`,
        "property",
        this,
      );
    }

    this.#type = parameterTypes[parameterTypes.length - 1];
    return this.#type;
  }
  // ===== CAPABILITY CHECKS =====

  /**
   * Check if property can be read (has a getter)
   * @returns True if property has a getter
   */
  canRead(): boolean {
    return this.getGetter() !== null;
  }

  /**
   * Check if property can be written (has a setter)
   * @returns True if property has a setter
   */
  canWrite(): boolean {
    return this.getSetter() !== null;
  }

  /**
   * Check if property is static
   * @returns True if property is static
   */
  isStatic(): boolean {
    const getter = this.getGetter();
    const setter = this.getSetter();

    if (getter) return getter.isStatic();
    if (setter) return setter.isStatic();
    return false;
  }

  /**
   * Check if property has parameters (indexed property/indexer)
   * @returns True if property is an indexer
   */
  hasParameters(): boolean {
    return this.getParameters().length > 0;
  }

  /**
   * Check if this property has a special name
   * @returns True if property has SpecialName attribute
   */
  isSpecialName(): boolean {
    return hasFlag(this.getFlags(), PropertyAttribute.SpecialName);
  }

  /**
   * Check if this property has a runtime special name
   * @returns True if property has RTSpecialName attribute
   */
  isRTSpecialName(): boolean {
    return hasFlag(this.getFlags(), PropertyAttribute.RTSpecialName);
  }

  /**
   * Check if this property has a default value
   * @returns True if property has HasDefault attribute
   */
  hasDefault(): boolean {
    return hasFlag(this.getFlags(), PropertyAttribute.HasDefault);
  }

  /**
   * Get custom attributes applied to this property.
   * Uses mono_custom_attrs_from_property API to retrieve attribute metadata.
   * @returns Array of CustomAttribute objects with attribute type information
   */
  getCustomAttributes(): CustomAttribute[] {
    if (!this.api.hasExport("mono_custom_attrs_from_property")) {
      return [];
    }

    try {
      const parentClass = this.getParent();
      const customAttrInfoPtr = this.native.mono_custom_attrs_from_property(parentClass.pointer, this.pointer);
      return parseCustomAttributes(
        this.api,
        customAttrInfoPtr,
        ptr => new MonoClass(this.api, ptr).getName(),
        ptr => new MonoClass(this.api, ptr).getFullName(),
      );
    } catch {
      return [];
    }
  }

  /**
   * Check if this property is an indexer (has 'Item' name and parameters)
   * @returns True if property is an indexer
   */
  isIndexer(): boolean {
    return this.getName() === "Item" && this.hasParameters();
  }

  // ===== PARAMETER INFORMATION =====

  /**
   * Get property parameters (for indexed properties/indexers)
   * @returns Array of parameter types
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

  // ===== VALUE ACCESS =====

  /**
   * Get property value from an object instance
   *
   * @param instance Object instance (null for static properties)
   * @param parameters Index parameters (for indexers)
   * @returns Property value
   * @throws Error if property is write-only
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
    const getter = this.getGetter();
    if (!getter) {
      throw new MonoValidationError(`Property ${this.getName()} is not readable (no getter)`, "property", this);
    }

    const rawResult = getter.invoke(this.resolveInstance(instance), parameters);
    const resultObject = pointerIsNull(rawResult) ? null : new MonoObject(this.api, rawResult);
    return this.convertResult(resultObject) as TValue;
  }

  /**
   * Set property value on an object instance
   *
   * @param instance Object instance (null for static properties)
   * @param value Value to set
   * @param parameters Index parameters (for indexers)
   * @throws Error if property is read-only
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
    const setter = this.getSetter();
    if (!setter) {
      throw new MonoValidationError(`Property ${this.getName()} is not writable (no setter)`, "property", this);
    }

    const invocationArgs = [...parameters, this.convertValue(value)];
    setter.invoke(this.resolveInstance(instance), invocationArgs);
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
      declaringType: this.getParent().getFullName(),
    };
  }

  /**
   * Get comprehensive summary of this property
   * @returns MonoPropertySummary with detailed property information
   */
  getSummary(): MonoPropertySummary {
    const propType = this.getType();
    const parameters = this.getParameters();
    const flags = this.getFlags();

    return {
      name: this.getName(),
      typeName: propType.getName(),
      type: propType.getSummary(),
      declaringType: this.getParent().getFullName(),
      flags,
      flagNames: pickFlags(flags, PROPERTY_FLAGS),
      canRead: this.canRead(),
      canWrite: this.canWrite(),
      isStatic: this.isStatic(),
      isIndexer: this.isIndexer(),
      parameterCount: parameters.length,
      parameterTypeNames: parameters.map(param => param.getName()),
      hasDefault: this.hasDefault(),
      isSpecialName: this.isSpecialName(),
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
    const type = this.getType().getName();
    const modifiers: string[] = [];
    const parameters = this.getParameters();
    const accessors: string[] = [];

    if (this.isStatic()) modifiers.push("static");
    if (this.canRead()) accessors.push("get");
    if (this.canWrite()) accessors.push("set");

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
    const accessorStr = ` { ${accessors.join("; ")}; }`;

    if (this.isIndexer()) {
      const paramList = parameters.map(p => p.getName()).join(", ");
      return `${modifierStr}${type} this[${paramList}]${accessorStr}`;
    }

    return `${modifierStr}${type} ${this.getName()}${accessorStr}`;
  }

  /**
   * Get string representation of this property
   * @returns String in format "PropertyName (PropertyType)"
   */
  override toString(): string {
    return `${this.getName()} (${this.getType().getName()})`;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Resolve instance pointer from MonoObject or NativePointer
   */
  private resolveInstance(instance: MonoObject | NativePointer | null): NativePointer | null {
    if (instance === null) {
      return null;
    }
    if (instance instanceof MonoObject) {
      // For value types, use the unboxed pointer; for reference types, use the object pointer
      return instance.getInstancePointer();
    }
    if (instance.isNull()) {
      return null;
    }
    // If it's a raw NativePointer, use it directly (caller is responsible for correctness)
    return instance;
  }

  /**
   * Convert method result to appropriate type
   */
  private convertResult(result: MonoObject | null): any {
    if (!result) return null;

    const propertyType = this.getType();

    // Convert value based on property type
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
   * Validate and convert a numeric value to the target type
   * @param value The numeric value to validate
   * @param typeName The target type name
   * @returns The converted value
   * @throws MonoValidationError if value is out of range
   */
  private validateNumericValue(value: number, typeName: string): number {
    const range = NUMERIC_RANGES[typeName];
    if (range) {
      if (value < range.min || value > range.max) {
        throw new MonoValidationError(
          `Value ${value} is out of range for ${range.name} (${range.min} to ${range.max})`,
          "property",
          this,
        );
      }
      return Math.floor(value);
    }

    // Float types don't need range validation
    if (
      typeName === "Single" ||
      typeName === "System.Single" ||
      typeName === "Double" ||
      typeName === "System.Double"
    ) {
      return value;
    }

    // Default: return as-is
    return value;
  }

  /**
   * Convert value to appropriate parameter type.
   * Supports automatic boxing of primitives and type coercion.
   *
   * Supported conversions:
   * - number → Byte, SByte, Int16, UInt16, Int32, UInt32, Single, Double
   * - boolean → Boolean, or numeric 0/1
   * - string → String, Char
   * - bigint → Int64, UInt64
   * - Array → MonoArray (when target is array type)
   * - MonoObject → passthrough
   * - NativePointer → passthrough
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

    // Get the property type for conversion hints
    const propertyType = this.getType();
    const typeName = propertyType.getName();

    // Handle primitive type conversions
    if (typeof value === "number") {
      return this.validateNumericValue(value, typeName);
    }

    if (typeof value === "boolean") {
      return this.convertBooleanValue(value, typeName, propertyType);
    }

    if (typeof value === "string") {
      return this.convertStringValue(value, typeName);
    }

    if (typeof value === "bigint") {
      return this.convertBigIntValue(value, typeName);
    }

    // Array handling
    if (Array.isArray(value)) {
      return this.convertArrayValue(value, propertyType);
    }

    // Enum handling - convert string or number to enum value
    if (propertyType.isValueType()) {
      const enumResult = this.tryConvertEnumValue(value, propertyType, typeName);
      if (enumResult !== undefined) {
        return enumResult;
      }
    }

    // Delegate handling
    if (typeof value === "function") {
      throw new MonoValidationError(
        "Cannot convert JavaScript function to delegate. Use MonoDelegate.create() instead.",
        "property",
        this,
      );
    }

    // NativePointer passthrough
    if (value instanceof NativePointer) {
      return value;
    }

    // Object/Dictionary handling - for complex types
    // Return as-is and let the caller handle it
    return value;
  }

  /**
   * Convert boolean value to appropriate type
   */
  private convertBooleanValue(value: boolean, typeName: string, propertyType: MonoType): any {
    if (typeName === "Boolean" || typeName === "System.Boolean") {
      return value;
    }
    // Convert boolean to number if target is numeric value type
    if (propertyType.isValueType()) {
      return value ? 1 : 0;
    }
    return value;
  }

  /**
   * Convert string value to appropriate type
   */
  private convertStringValue(value: string, typeName: string): any {
    // String to MonoString conversion
    if (typeName === "String" || typeName === "System.String") {
      return this.api.stringNew(value);
    }
    // Char conversion (first character)
    if (typeName === "Char" || typeName === "System.Char") {
      if (value.length === 0) {
        throw new MonoValidationError("Cannot convert empty string to Char", "property", this);
      }
      return value.charCodeAt(0);
    }
    return value;
  }

  /**
   * Convert bigint value to appropriate type
   */
  private convertBigIntValue(value: bigint, typeName: string): any {
    if (typeName === "Int64" || typeName === "System.Int64") {
      return int64(value.toString());
    }
    if (typeName === "UInt64" || typeName === "System.UInt64") {
      return uint64(value.toString());
    }
    // Fallback to number if within safe range
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    throw new MonoValidationError(
      `BigInt value ${value} cannot be safely converted to target type ${typeName}`,
      "property",
      this,
    );
  }

  /**
   * Convert array value to MonoArray
   */
  private convertArrayValue(value: any[], propertyType: MonoType): any {
    // If property type is array, try to convert
    if (propertyType.isArray()) {
      try {
        const { MonoArray } = require("./array");
        const elementClass = propertyType.getClass();
        if (elementClass) {
          const monoArray = MonoArray.from(this.api, elementClass, value);
          return monoArray.pointer;
        }
      } catch {
        // Fall through to return as-is
      }
    }
    return value;
  }

  /**
   * Try to convert value to enum type
   * @returns The converted value, or undefined if not an enum
   */
  private tryConvertEnumValue(value: any, propertyType: MonoType, typeName: string): any {
    const propClass = propertyType.getClass();
    if (!propClass || !propClass.isEnum()) {
      return undefined;
    }

    // Number value for enum
    if (typeof value === "number") {
      return Math.floor(value);
    }

    // String value - try to parse enum name
    if (typeof value === "string") {
      // Try to find enum field by name
      const enumField = propClass.tryGetField(value);
      if (enumField && enumField.isLiteral()) {
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
      throw new MonoValidationError(`Cannot convert '${value}' to enum type ${typeName}`, "property", this);
    }

    return undefined;
  }
}

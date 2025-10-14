/**
 * Advanced type safety utilities and validation
 * Provides compile-time and runtime type checking for Mono operations
 */

import { MonoApi } from "../runtime/api";
import { MonoClass } from "../model/class";
import { MonoMethod } from "../model/method";
import { MonoField } from "../model/field";
import { MonoAssembly } from "../model/assembly";
import { MonoArray } from "../model/array";
import { MonoObject } from "../model/object";
import { MonoType } from "../model/type";
import { MonoParameterInfo } from "../model/method-signature";
import { Logger } from "./log";
import { pointerIsNull } from "./pointer-utils";

const logger = new Logger({ tag: "TypeSafety" });

/**
 * Runtime type validator for Mono types
 */
export class TypeValidator {
  /**
   * Validate that a value matches the expected Mono type
   */
  static validateMonoType<T>(
    value: any,
    expectedType: MonoClass,
    allowNull: boolean = true
  ): value is T {
    if (value === null || value === undefined) {
      if (!allowNull) {
        throw new TypeError(`Null value not allowed for type ${expectedType.getFullName()}`);
      }
      return true;
    }

    if (!(value instanceof MonoObject)) {
      throw new TypeError(`Expected MonoObject, got ${typeof value}`);
    }

    const actualClass = value.getClass();
    if (!this.isAssignableTo(actualClass, expectedType)) {
      throw new TypeError(
        `Type mismatch: expected ${expectedType.getFullName()}, ` +
        `got ${actualClass.getFullName()}`
      );
    }

    return true;
  }

  /**
   * Validate method parameter types
   */
  static validateMethodParameters(
    method: MonoMethod,
    args: any[],
    allowCoercion: boolean = true
  ): boolean {
    const signature = method.getSignature();
    const parameters = signature.getParameters();

    if (args.length !== parameters.length) {
      throw new TypeError(
        `Parameter count mismatch: expected ${parameters.length}, got ${args.length}`
      );
    }

    for (let i = 0; i < args.length; i++) {
      const param = parameters[i];
      const arg = args[i];
      const paramType = param.type;

      try {
        const paramClass = paramType.getClass();
        if (paramClass && !this.validateParameterType(arg, paramClass, allowCoercion)) {
          throw new TypeError(
            `Parameter ${i} type mismatch: expected ${param.type.getFullName()}, ` +
            `got ${typeof arg}`
          );
        }
      } catch (error) {
        throw new TypeError(
          `Parameter ${i} validation failed: ${error}`
        );
      }
    }

    return true;
  }

  /**
   * Validate a single parameter type
   */
  static validateParameterType(
    value: any,
    expectedType: MonoClass,
    allowCoercion: boolean
  ): boolean {
    if (value === null || value === undefined) {
      // Allow null for reference types
      return !expectedType.isValueType();
    }

    // Direct MonoObject check
    if (value instanceof MonoObject) {
      return this.isAssignableTo(value.getClass(), expectedType);
    }

    // Primitive type coercion
    if (allowCoercion) {
      return this.canCoerceType(typeof value, expectedType);
    }

    return false;
  }

  /**
   * Check if a type can be assigned to another
   */
  static isAssignableTo(from: MonoClass, to: MonoClass): boolean {
    if (from.pointer.equals(to.pointer)) {
      return true;
    }

    // Check inheritance
    let current = from.getParent();
    while (current && !current.pointer.isNull()) {
      if (current.pointer.equals(to.pointer)) {
        return true;
      }
      current = current.getParent();
    }

    // Check interface implementation (would need additional logic)
    return false;
  }

  /**
   * Check if a primitive type can be coerced to a Mono type
   */
  static canCoerceType(from: string, to: MonoClass): boolean {
    const typeName = to.getName();

    // String conversions
    if (from === 'string') {
      return typeName === 'String' || typeName === 'Object';
    }

    // Numeric conversions
    if (from === 'number') {
      return [
        'Int32', 'Int64', 'Single', 'Double', 'Decimal',
        'Int16', 'UInt16', 'UInt32', 'UInt64',
        'Byte', 'SByte', 'Object'
      ].includes(typeName);
    }

    // Boolean conversions
    if (from === 'boolean') {
      return typeName === 'Boolean' || typeName === 'Object';
    }

    return false;
  }
}

/**
 * Type-safe wrapper for Mono operations
 */
export class TypeSafeOperations {
  /**
   * Type-safe method invocation
   */
  static invokeMethod<T = any>(
    method: MonoMethod,
    instance: MonoObject | null,
    args: any[],
    options: {
      strictTypeChecking?: boolean;
      allowNullResult?: boolean;
      validateParameters?: boolean;
    } = {}
  ): T {
    const {
      strictTypeChecking = true,
      allowNullResult = true,
      validateParameters = true
    } = options;

    try {
      // Simplified parameter validation
      if (validateParameters) {
        try {
          const signature = method.getSignature();
          const parameters = signature.getParameters();

          if (args.length !== parameters.length) {
            logger.warn(`Parameter count mismatch: expected ${parameters.length}, got ${args.length}`, {
              methodName: method.getName()
            });
          }
        } catch (error) {
          // Parameter validation is optional
          logger.debug(`Parameter validation skipped: ${error}`);
        }
      }

      // Invoke the method
      const result = method.invoke(instance, args);

      // Simplified result type validation
      if (result !== null && result !== undefined && strictTypeChecking) {
        try {
          // Basic validation that result is a valid type
          if (!(result instanceof MonoObject) && typeof result !== 'string' && typeof result !== 'number' && typeof result !== 'boolean' && typeof result !== 'undefined') {
            logger.debug(`Method result may not be a valid Mono type: ${typeof result}`, {
              methodName: method.getName()
            });
          }
        } catch (error) {
          // Type validation is optional for return values
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe method invocation failed: ${error}`, {
        methodName: method.getName(),
        args: args.length
      });
      throw error;
    }
  }

  /**
   * Type-safe field access
   */
  static getField<T = any>(
    field: MonoField,
    instance: MonoObject | null,
    options: {
      strictTypeChecking?: boolean;
      allowNull?: boolean;
    } = {}
  ): T {
    const { strictTypeChecking = true, allowNull = true } = options;

    try {
      const result = field.getValue(instance);

      // Simplified type validation for field values
      if (strictTypeChecking && result !== null && result !== undefined) {
        try {
          // Basic validation that result is a MonoObject if it's not null
          if (!(result instanceof MonoObject) && typeof result !== 'string' && typeof result !== 'number' && typeof result !== 'boolean') {
            logger.warn(`Field value may not be a valid Mono type: ${typeof result}`, {
              fieldName: field.getName()
            });
          }
        } catch (error) {
          // Type validation is optional for field values
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe field access failed: ${error}`, {
        fieldName: field.getName()
      });
      throw error;
    }
  }

  /**
   * Type-safe field assignment
   */
  static setField<T = any>(
    field: MonoField,
    instance: MonoObject | null,
    value: T,
    options: {
      strictTypeChecking?: boolean;
      allowCoercion?: boolean;
    } = {}
  ): void {
    const { strictTypeChecking = true, allowCoercion = true } = options;

    try {
      // Simplified type validation for field assignment
      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          // Basic validation that value is a valid type
          if (!(value instanceof MonoObject) && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
            logger.warn(`Field assignment value may not be a valid Mono type: ${typeof value}`, {
              fieldName: field.getName()
            });
          }
        } catch (error) {
          // Type validation is optional for field assignment
        }
      }

      field.setValue(instance, value as any);
    } catch (error) {
      logger.error(`Type-safe field assignment failed: ${error}`, {
        fieldName: field.getName(),
        valueType: typeof value
      });
      throw error;
    }
  }

  /**
   * Type-safe array element access
   */
  static getArrayElement<T = any>(
    array: MonoArray,
    index: number,
    options: {
      boundsCheck?: boolean;
      strictTypeChecking?: boolean;
    } = {}
  ): T {
    const { boundsCheck = true, strictTypeChecking = true } = options;

    try {
      if (boundsCheck && (index < 0 || index >= array.length)) {
        throw new RangeError(`Index ${index} out of bounds for array of length ${array.length}`);
      }

      const result = array.getTyped(index);

      if (strictTypeChecking && result !== null && result !== undefined) {
        try {
          // Basic validation that array element is a valid type
          if (!(result instanceof MonoObject) && typeof result !== 'string' && typeof result !== 'number' && typeof result !== 'boolean') {
            logger.warn(`Array element may not be a valid Mono type: ${typeof result}`, {
              arrayLength: array.length,
              index
            });
          }
        } catch (error) {
          // Type validation is optional for array elements
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe array element access failed: ${error}`, {
        arrayLength: array.length,
        index
      });
      throw error;
    }
  }

  /**
   * Type-safe array element assignment
   */
  static setArrayElement<T = any>(
    array: MonoArray,
    index: number,
    value: T,
    options: {
      boundsCheck?: boolean;
      strictTypeChecking?: boolean;
      allowCoercion?: boolean;
    } = {}
  ): void {
    const {
      boundsCheck = true,
      strictTypeChecking = true,
      allowCoercion = true
    } = options;

    try {
      if (boundsCheck && (index < 0 || index >= array.length)) {
        throw new RangeError(`Index ${index} out of bounds for array of length ${array.length}`);
      }

      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          // Basic validation that value is a valid type for array assignment
          if (!(value instanceof MonoObject) && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
            logger.warn(`Array assignment value may not be a valid Mono type: ${typeof value}`, {
              arrayLength: array.length,
              index
            });
          }
        } catch (error) {
          // Type validation is optional for array assignment
        }
      }

      // Cast value to any to avoid type constraints with setTyped
      array.setTyped(index, value as any);
    } catch (error) {
      logger.error(`Type-safe array element assignment failed: ${error}`, {
        arrayLength: array.length,
        index,
        valueType: typeof value
      });
      throw error;
    }
  }
}

/**
 * Compile-time type constraints for Mono operations
 */
export namespace MonoTypeConstraints {
  /**
   * Ensure a value is a valid MonoObject
   */
  export type IsMonoObject<T> = T extends MonoObject ? T : never;

  /**
   * Ensure a value is not null
   */
  export type NonNullable<T> = T extends null | undefined ? never : T;

  /**
   * Ensure a value is a valid array index
   */
  export type ValidArrayIndex<T extends number> =
    T extends number
    ? number extends T
      ? never
      : T extends 0
        ? 0
        : T extends `${infer N extends number}`
          ? N
          : never
    : never;

  /**
   * Ensure a value is a valid method parameter
   */
  export type ValidMethodParam<T> =
    T extends string | number | boolean | MonoObject | null | undefined ? T : never;

  /**
   * Ensure a type is a valid field type
   */
  export type ValidFieldType<T> =
    T extends string | number | boolean | MonoObject | null | undefined ? T : never;
}

/**
 * Runtime type assertion helpers
 */
export class TypeAssertions {
  /**
   * Assert that a value is a MonoObject
   */
  static assertMonoObject(value: any, message?: string): asserts value is MonoObject {
    if (!(value instanceof MonoObject)) {
      throw new TypeError(message || `Expected MonoObject, got ${typeof value}`);
    }
  }

  /**
   * Assert that a value is not null
   */
  static assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
      throw new TypeError(message || 'Value cannot be null or undefined');
    }
  }

  /**
   * Assert that a value is within array bounds
   */
  static assertArrayIndex(index: number, length: number, message?: string): void {
    if (index < 0 || index >= length) {
      throw new RangeError(
        message || `Index ${index} out of bounds for array of length ${length}`
      );
    }
  }

  /**
   * Assert that a value is of the expected Mono type
   */
  static assertMonoType<T>(
    value: any,
    expectedType: MonoClass,
    message?: string
  ): asserts value is T {
    TypeValidator.validateMonoType(value, expectedType, false);
  }
}

/**
 * Type-safe builders for common operations
 */
export class TypeSafeBuilder {
  /**
   * Build a type-safe method invocation
   */
  static methodInvocation<T = any>(
    method: MonoMethod,
    instance: MonoObject | null = null
  ): MethodInvocationBuilder<T> {
    return new MethodInvocationBuilder(method, instance);
  }

  /**
   * Build a type-safe field access
   */
  static fieldAccess<T = any>(
    field: MonoField,
    instance: MonoObject | null = null
  ): FieldAccessBuilder<T> {
    return new FieldAccessBuilder(field, instance);
  }

  /**
   * Build a type-safe array operation
   */
  static arrayOperation<T = any>(
    array: MonoArray
  ): ArrayOperationBuilder<T> {
    return new ArrayOperationBuilder(array);
  }
}

class MethodInvocationBuilder<T> {
  private args: any[] = [];
  private options: {
    strictTypeChecking?: boolean;
    allowNullResult?: boolean;
    validateParameters?: boolean;
  } = {};

  constructor(
    private method: MonoMethod,
    private instance: MonoObject | null
  ) {}

  withArguments(...args: any[]): this {
    this.args = args;
    return this;
  }

  withOptions(options: {
    strictTypeChecking?: boolean;
    allowNullResult?: boolean;
    validateParameters?: boolean;
  }): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  invoke(): T {
    return TypeSafeOperations.invokeMethod(this.method, this.instance, this.args, this.options);
  }
}

class FieldAccessBuilder<T> {
  private options: {
    strictTypeChecking?: boolean;
    allowNull?: boolean;
  } = {};

  constructor(
    private field: MonoField,
    private instance: MonoObject | null
  ) {}

  withOptions(options: {
    strictTypeChecking?: boolean;
    allowNull?: boolean;
  }): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  getValue(): T {
    return TypeSafeOperations.getField(this.field, this.instance, this.options);
  }

  setValue<U>(value: U, options?: { strictTypeChecking?: boolean; allowCoercion?: boolean }): void {
    TypeSafeOperations.setField(this.field, this.instance, value, {
      ...this.options,
      ...options
    });
  }
}

class ArrayOperationBuilder<T> {
  private options: {
    boundsCheck?: boolean;
    strictTypeChecking?: boolean;
  } = {};

  constructor(private array: MonoArray) {}

  withOptions(options: {
    boundsCheck?: boolean;
    strictTypeChecking?: boolean;
  }): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  getElement(index: number): T {
    return TypeSafeOperations.getArrayElement(this.array, index, this.options);
  }

  setElement(index: number, value: T, options?: {
    strictTypeChecking?: boolean;
    allowCoercion?: boolean;
  }): void {
    TypeSafeOperations.setArrayElement(this.array, index, value, {
      ...this.options,
      ...options
    });
  }
}

/**
 * Advanced type inference utilities
 */
export class TypeInference {
  /**
   * Infer the most specific type for a value
   */
  static inferType(value: any): {
    isMonoObject: boolean;
    isNull: boolean;
    isPrimitive: boolean;
    typeName: string;
    monoClass?: MonoClass;
  } {
    if (value === null || value === undefined) {
      return {
        isMonoObject: false,
        isNull: true,
        isPrimitive: false,
        typeName: 'null'
      };
    }

    if (value instanceof MonoObject) {
      return {
        isMonoObject: true,
        isNull: false,
        isPrimitive: false,
        typeName: value.getClass().getFullName(),
        monoClass: value.getClass()
      };
    }

    const primitiveType = typeof value;
    return {
      isMonoObject: false,
      isNull: false,
      isPrimitive: true,
      typeName: primitiveType
    };
  }

  /**
   * Check if two types are compatible for assignment
   */
  static areTypesCompatible(
    source: any,
    targetType: MonoClass,
    allowCoercion: boolean = true
  ): boolean {
    try {
      return TypeValidator.validateParameterType(source, targetType, allowCoercion);
    } catch {
      return false;
    }
  }

  /**
   * Get the common type for multiple values
   */
  static getCommonType(values: any[]): {
    isMonoObject: boolean;
    isPrimitive: boolean;
    typeName: string;
    monoClass?: MonoClass;
    canBeNull: boolean;
  } {
    if (values.length === 0) {
      return {
        isMonoObject: false,
        isPrimitive: false,
        typeName: 'unknown',
        canBeNull: true
      };
    }

    const types = values.map(v => this.inferType(v));
    const hasNull = types.some(t => t.isNull);
    const hasMonoObject = types.some(t => t.isMonoObject);
    const hasPrimitive = types.some(t => t.isPrimitive);

    if (hasMonoObject && hasPrimitive) {
      // Mixed types, return object as common type
      return {
        isMonoObject: false,
        isPrimitive: false,
        typeName: 'object',
        canBeNull: hasNull
      };
    }

    if (hasMonoObject) {
      // All are MonoObjects, find common base class
      const monoClasses = types
        .filter(t => t.isMonoObject && t.monoClass)
        .map(t => t.monoClass!);

      if (monoClasses.length > 0) {
        const commonClass = this.findCommonBaseClass(monoClasses);
        return {
          isMonoObject: true,
          isPrimitive: false,
          typeName: commonClass.getFullName(),
          monoClass: commonClass,
          canBeNull: hasNull
        };
      }
    }

    // All are primitives or null
    const primitiveTypes = types
      .filter(t => t.isPrimitive)
      .map(t => t.typeName);

    if (primitiveTypes.length > 0) {
      // For simplicity, return the most common primitive type
      const typeCounts = new Map<string, number>();
      for (const type of primitiveTypes) {
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      }

      const mostCommonType = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])[0][0];

      return {
        isMonoObject: false,
        isPrimitive: true,
        typeName: mostCommonType,
        canBeNull: hasNull
      };
    }

    return {
      isMonoObject: false,
      isPrimitive: false,
      typeName: 'unknown',
      canBeNull: hasNull
    };
  }

  private static findCommonBaseClass(classes: MonoClass[]): MonoClass {
    if (classes.length === 0) {
      throw new Error('No classes provided');
    }

    if (classes.length === 1) {
      return classes[0];
    }

    // Start with the first class and traverse up its hierarchy
    let current: MonoClass | null = classes[0];
    while (current && !current.pointer.isNull()) {
      if (classes.every(c => this.isAssignableTo(c, current!))) {
        return current;
      }
      current = current.getParent();
    }

    // Fallback to System.Object
    try {
      const domain = classes[0].api.getRootDomain();
      const objectClass = classes[0].api.native.mono_class_from_name(domain, 'mscorlib', 'Object');
      if (!objectClass.isNull()) {
        return new MonoClass(classes[0].api, objectClass);
      }
    } catch {
      // If even System.Object fails, return the first class
    }

    return classes[0];
  }

  private static isAssignableTo(from: MonoClass, to: MonoClass): boolean {
    if (from.pointer.equals(to.pointer)) {
      return true;
    }

    let current = from.getParent();
    while (current && !current.pointer.isNull()) {
      if (current.pointer.equals(to.pointer)) {
        return true;
      }
      current = current.getParent();
    }

    return false;
  }
}
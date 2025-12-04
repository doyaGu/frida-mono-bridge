/**
 * Advanced type operations, guards, and safety utilities for Mono operations
 */

import { MonoValidationError } from "./errors";
import { Logger } from "./log";
import { MonoObject, MonoClass, MonoMethod, MonoField, MonoArray, MonoDomain } from "../model";

const logger = new Logger({ tag: "TypeSafety" });

declare const NativePointer: any;

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Check if value represents a pointer-like type based on Mono type kind
 * @param kind - MonoTypeKind enum value
 */
export function isPointerLike(kind: number): boolean {
  // Common pointer-like type kinds in Mono
  return (
    kind === 0x1 || // OBJECT
    kind === 0x2 || // SZARRAY
    kind === 0x3 || // STRING
    kind === 0x4 || // CLASS
    kind === 0x6 || // GENERICINST
    kind === 0x8 || // ARRAY
    kind === 0x1c
  ); // PTR
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

function throwValidationError(parameter: string, message: string, value?: unknown): never {
  throw new MonoValidationError(message, parameter, value);
}

/**
 * Check if value is a valid NativePointer
 */
export function isNativePointer(value: any): value is any {
  if (value instanceof NativePointer) {
    return true;
  }
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.isNull === "function" &&
    typeof value.toString === "function"
  );
}

/**
 * Check if value is null or undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Check if array is not empty
 */
export function isNonEmptyArray(value: any): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if object has specific property
 */
export function hasProperty<T extends object, K extends PropertyKey>(obj: T, prop: K): boolean {
  return obj && prop in obj;
}

/**
 * Type guard for Mono handle objects
 */
export function isMonoHandle(value: any): boolean {
  return isObject(value) && value && typeof (value as any).handle === "object";
}

/**
 * Type guard for Mono class objects
 */
export function isMonoClass(value: any): boolean {
  return (
    isObject(value) &&
    hasProperty(value, "name") &&
    isString((value as any).name) &&
    hasProperty(value, "methods") &&
    isArray((value as any).methods) &&
    hasProperty(value, "fields") &&
    isArray((value as any).fields)
  );
}

/**
 * Type guard for Mono method objects
 */
export function isMonoMethod(value: any): boolean {
  return (
    isObject(value) &&
    hasProperty(value, "name") &&
    isString((value as any).name) &&
    hasMethod(value, "isStatic") &&
    hasMethod(value, "invoke")
  );
}

/**
 * Type guard for Mono field objects
 */
export function isMonoField(value: any): boolean {
  return (
    isObject(value) &&
    hasProperty(value, "name") &&
    isString((value as any).name) &&
    hasProperty(value, "type") &&
    hasMethod(value, "isStatic")
  );
}

/**
 * Check if value is a string
 */
export function isString(value: any): value is string {
  return typeof value === "string";
}

/**
 * Check if value is a number
 */
export function isNumber(value: any): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === "boolean";
}

/**
 * Check if value is a function
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function isFunction(value: any): value is Function {
  return typeof value === "function";
}

/**
 * Check if value is an object (not null, not array)
 */
export function isObject(value: any): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * Check if object has specific method
 */
export function hasMethod<T extends object, K extends PropertyKey>(obj: T, method: K): boolean {
  return hasProperty(obj, method) && isFunction((obj as any)[method]);
}

/**
 * Check if value is a valid method signature string
 */
export function isValidMethodSignature(value: any): value is string {
  if (!isString(value)) return false;

  // Basic validation for method signatures like "ClassName:Method(Type,Type)"
  const signaturePattern = /^[^:]+:[^()]+\([^)]*\)$/;
  return signaturePattern.test(value.trim());
}

/**
 * Validate and throw if invalid
 */
export function validateRequired<T>(value: T | null | undefined, name: string, validator?: (value: T) => boolean): T {
  if (isNullOrUndefined(value)) {
    throwValidationError(name, `Required parameter '${name}' is null or undefined`, value as unknown);
  }

  if (validator && !validator(value)) {
    throwValidationError(name, `Parameter '${name}' failed validation`, value);
  }

  return value;
}

/**
 * Validate string and throw if invalid
 */
export function validateString(
  value: string | null | undefined,
  name: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {},
): string {
  if (isNullOrUndefined(value)) {
    throwValidationError(name, `Parameter '${name}' is null or undefined`, value as unknown);
  }

  if (!isString(value)) {
    throwValidationError(name, `Parameter '${name}' is not a string`, value);
  }

  const { minLength = 0, maxLength = Infinity, pattern } = options;

  if (value.length < minLength) {
    throwValidationError(name, `Parameter '${name}' must be at least ${minLength} characters long`, value);
  }

  if (value.length > maxLength) {
    throwValidationError(name, `Parameter '${name}' must be no more than ${maxLength} characters long`, value);
  }

  if (pattern && !pattern.test(value)) {
    throwValidationError(name, `Parameter '${name}' does not match required pattern`, value);
  }

  return value;
}

// ============================================================================
// TYPE SAFETY UTILITIES
// ============================================================================

/**
 * Simplified type validation utilities
 */
export class TypeValidator {
  /**
   * Basic type validation for method parameters
   */
  static validateMethodParameters(method: MonoMethod, args: any[], allowCoercion: boolean = true): boolean {
    try {
      const signature = method.getSignature();
      const parameters = signature.getParameters();

      if (args.length !== parameters.length) {
        logger.warn(`Parameter count mismatch: expected ${parameters.length}, got ${args.length}`, {
          methodName: method.getName(),
        });
        return false;
      }

      // Basic type compatibility check
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const param = parameters[i];
        const paramType = param.type.getClass();

        if (paramType && !this.isCompatible(arg, paramType, allowCoercion)) {
          logger.debug(`Parameter ${i} may be incompatible`, {
            methodName: method.getName(),
            expectedType: param.type.getFullName(),
            actualType: typeof arg,
          });
        }
      }

      return true;
    } catch (error) {
      logger.debug(`Parameter validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Basic type compatibility check
   */
  static isCompatible(value: any, expectedType: MonoClass, allowCoercion: boolean = true): boolean {
    if (value === null || value === undefined) {
      return true; // Null can be assigned to most types
    }

    // Basic JavaScript to Mono type compatibility
    if (value instanceof MonoObject) {
      return expectedType.isAssignableFrom(value.getClass());
    }

    const valueType = typeof value;
    switch (valueType) {
      case "string":
        return allowCoercion; // Most string assignments can be coerced
      case "number":
        return allowCoercion; // Most numeric assignments can be coerced
      case "boolean":
        return allowCoercion; // Boolean assignments can be coerced
      default:
        return false;
    }
  }

  /**
   * Validate Mono type against expected type
   */
  static validateMonoType(value: any, expectedType: MonoClass, allowNull: boolean = true): boolean {
    if (value === null || value === undefined) {
      return allowNull;
    }

    if (value instanceof MonoObject) {
      return expectedType.isAssignableFrom(value.getClass());
    }

    // Basic validation for primitive types
    return typeof value === "object" || typeof value === "string" || typeof value === "number";
  }

  /**
   * Validate parameter type compatibility
   */
  static validateParameterType(value: any, paramType: MonoClass, allowCoercion: boolean = true): boolean {
    return this.isCompatible(value, paramType, allowCoercion);
  }
}

/**
 * Simplified type-safe wrapper for Mono operations
 */
export class TypeSafeOperations {
  /**
   * Type-safe method invocation with basic validation
   */
  static invokeMethod<T = any>(
    method: MonoMethod,
    instance: MonoObject | null,
    args: any[],
    options: {
      strictTypeChecking?: boolean;
      validateParameters?: boolean;
    } = {},
  ): T {
    const { strictTypeChecking = false, validateParameters = false } = options;

    try {
      // Basic parameter validation if requested
      if (validateParameters) {
        try {
          const signature = method.getSignature();
          const parameters = signature.getParameters();

          if (args.length !== parameters.length) {
            logger.warn(`Parameter count mismatch: expected ${parameters.length}, got ${args.length}`, {
              methodName: method.getName(),
            });
          }
        } catch (error) {
          logger.debug(`Parameter validation skipped: ${error}`);
        }
      }

      // Invoke the method
      const result = method.invoke(instance, args);

      // Basic result validation
      if (result !== null && result !== undefined && strictTypeChecking) {
        try {
          if (
            !(result instanceof MonoObject) &&
            typeof result !== "string" &&
            typeof result !== "number" &&
            typeof result !== "boolean"
          ) {
            logger.debug(`Method result may not be a valid Mono type: ${typeof result}`, {
              methodName: method.getName(),
            });
          }
        } catch (error) {
          // Type validation is optional
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe method invocation failed: ${error}`, {
        methodName: method.getName(),
        args: args.length,
      });
      throw error;
    }
  }

  /**
   * Type-safe field access with basic validation
   */
  static getField<T = any>(
    field: MonoField,
    instance: MonoObject | null,
    options: {
      strictTypeChecking?: boolean;
    } = {},
  ): T {
    const { strictTypeChecking = false } = options;

    try {
      const result = field.getValue(instance);

      // Basic validation for field values
      if (strictTypeChecking && result !== null && result !== undefined) {
        try {
          if (
            !(result instanceof MonoObject) &&
            typeof result !== "string" &&
            typeof result !== "number" &&
            typeof result !== "boolean"
          ) {
            logger.warn(`Field value may not be a valid Mono type: ${typeof result}`, {
              fieldName: field.getName(),
            });
          }
        } catch (error) {
          // Type validation is optional
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe field access failed: ${error}`, {
        fieldName: field.getName(),
      });
      throw error;
    }
  }

  /**
   * Type-safe field assignment with basic validation
   */
  static setField<T = any>(
    field: MonoField,
    instance: MonoObject | null,
    value: T,
    options: {
      strictTypeChecking?: boolean;
    } = {},
  ): void {
    const { strictTypeChecking = false } = options;

    try {
      // Basic validation for field assignment
      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          if (
            !(value instanceof MonoObject) &&
            typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean"
          ) {
            logger.warn(`Field assignment value may not be a valid Mono type: ${typeof value}`, {
              fieldName: field.getName(),
            });
          }
        } catch (error) {
          // Type validation is optional
        }
      }

      field.setValue(instance, value as any);
    } catch (error) {
      logger.error(`Type-safe field assignment failed: ${error}`, {
        fieldName: field.getName(),
        valueType: typeof value,
      });
      throw error;
    }
  }

  /**
   * Type-safe array element access with bounds checking
   */
  static getArrayElement<T = any>(
    array: MonoArray,
    index: number,
    options: {
      boundsCheck?: boolean;
      strictTypeChecking?: boolean;
    } = {},
  ): T {
    const { boundsCheck = true, strictTypeChecking = false } = options;

    try {
      if (boundsCheck && (index < 0 || index >= array.length)) {
        throw new RangeError(`Index ${index} out of bounds for array of length ${array.length}`);
      }

      const result = array.getTyped(index);

      // Basic validation for array elements
      if (strictTypeChecking && result !== null && result !== undefined) {
        try {
          if (
            !(result instanceof MonoObject) &&
            typeof result !== "string" &&
            typeof result !== "number" &&
            typeof result !== "boolean"
          ) {
            logger.warn(`Array element may not be a valid Mono type: ${typeof result}`, {
              arrayLength: array.length,
              index,
            });
          }
        } catch (error) {
          // Type validation is optional
        }
      }

      return result as T;
    } catch (error) {
      logger.error(`Type-safe array element access failed: ${error}`, {
        arrayLength: array.length,
        index,
      });
      throw error;
    }
  }

  /**
   * Type-safe array element assignment with bounds checking
   */
  static setArrayElement<T = any>(
    array: MonoArray,
    index: number,
    value: T,
    options: {
      boundsCheck?: boolean;
      strictTypeChecking?: boolean;
    } = {},
  ): void {
    const { boundsCheck = true, strictTypeChecking = false } = options;

    try {
      if (boundsCheck && (index < 0 || index >= array.length)) {
        throw new RangeError(`Index ${index} out of bounds for array of length ${array.length}`);
      }

      // Basic validation for array assignment
      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          if (
            !(value instanceof MonoObject) &&
            typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean"
          ) {
            logger.warn(`Array assignment value may not be a valid Mono type: ${typeof value}`, {
              arrayLength: array.length,
              index,
            });
          }
        } catch (error) {
          // Type validation is optional
        }
      }

      array.setTyped(index, value as any);
    } catch (error) {
      logger.error(`Type-safe array element assignment failed: ${error}`, {
        arrayLength: array.length,
        index,
        valueType: typeof value,
      });
      throw error;
    }
  }
}

/**
 * Simplified compile-time type constraints for Mono operations
 */
export class TypeConstraints {
  /**
   * Check if a value can be assigned to a Mono class type
   */
  static isAssignable<T>(value: any, targetType: MonoClass): value is T {
    return TypeValidator.isCompatible(value, targetType, true);
  }

  /**
   * Create a typed wrapper for better type safety
   */
  static createTypedWrapper<T>(value: any, validator?: (value: any) => boolean): T {
    if (validator && !validator(value)) {
      throw new TypeError(`Value failed type validation`);
    }
    return value as T;
  }
}

/**
 * Find common type between multiple Mono classes
 */
export function findCommonType(classes: MonoClass[]): MonoClass | null {
  if (classes.length === 0) {
    return null;
  }

  if (classes.length === 1) {
    return classes[0];
  }

  // Simple implementation: start with the first class and traverse up its hierarchy
  let current: MonoClass | null = classes[0];
  while (current && !current.pointer.isNull()) {
    if (classes.every(c => current!.isAssignableFrom(c))) {
      return current;
    }
    current = current.getParent();
  }

  // Fallback to System.Object
  try {
    const domain = MonoDomain.getRoot(classes[0].api);
    const mscorlib = domain.getAssembly("mscorlib");
    if (mscorlib) {
      return mscorlib.image.class("System.Object");
    }
    return null;
  } catch {
    return null;
  }
}

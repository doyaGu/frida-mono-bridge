/**
 * Simplified type safety utilities for Mono operations
 */

import { Logger } from "./log";
import { MonoObject, MonoClass, MonoMethod, MonoField, MonoArray, MonoType, MonoDomain } from "../model";

const logger = new Logger({ tag: "TypeSafety" });

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
          methodName: method.getName()
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
            actualType: typeof arg
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
      case 'string':
        return allowCoercion; // Most string assignments can be coerced
      case 'number':
        return allowCoercion; // Most numeric assignments can be coerced
      case 'boolean':
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
    return typeof value === 'object' || typeof value === 'string' || typeof value === 'number';
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
      allowNullResult?: boolean;
      validateParameters?: boolean;
    } = {}
  ): T {
    const {
      strictTypeChecking = false,
      allowNullResult = true,
      validateParameters = false
    } = options;

    try {
      // Basic parameter validation if requested
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
          logger.debug(`Parameter validation skipped: ${error}`);
        }
      }

      // Invoke the method
      const result = method.invoke(instance, args);

      // Basic result validation
      if (result !== null && result !== undefined && strictTypeChecking) {
        try {
          if (!(result instanceof MonoObject) &&
              typeof result !== 'string' &&
              typeof result !== 'number' &&
              typeof result !== 'boolean') {
            logger.debug(`Method result may not be a valid Mono type: ${typeof result}`, {
              methodName: method.getName()
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
        args: args.length
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
      allowNull?: boolean;
    } = {}
  ): T {
    const { strictTypeChecking = false, allowNull = true } = options;

    try {
      const result = field.getValue(instance);

      // Basic validation for field values
      if (strictTypeChecking && result !== null && result !== undefined) {
        try {
          if (!(result instanceof MonoObject) &&
              typeof result !== 'string' &&
              typeof result !== 'number' &&
              typeof result !== 'boolean') {
            logger.warn(`Field value may not be a valid Mono type: ${typeof result}`, {
              fieldName: field.getName()
            });
          }
        } catch (error) {
          // Type validation is optional
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
   * Type-safe field assignment with basic validation
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
    const { strictTypeChecking = false, allowCoercion = true } = options;

    try {
      // Basic validation for field assignment
      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          if (!(value instanceof MonoObject) &&
              typeof value !== 'string' &&
              typeof value !== 'number' &&
              typeof value !== 'boolean') {
            logger.warn(`Field assignment value may not be a valid Mono type: ${typeof value}`, {
              fieldName: field.getName()
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
        valueType: typeof value
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
    } = {}
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
          if (!(result instanceof MonoObject) &&
              typeof result !== 'string' &&
              typeof result !== 'number' &&
              typeof result !== 'boolean') {
            logger.warn(`Array element may not be a valid Mono type: ${typeof result}`, {
              arrayLength: array.length,
              index
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
        index
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
      allowCoercion?: boolean;
    } = {}
  ): void {
    const {
      boundsCheck = true,
      strictTypeChecking = false,
      allowCoercion = true
    } = options;

    try {
      if (boundsCheck && (index < 0 || index >= array.length)) {
        throw new RangeError(`Index ${index} out of bounds for array of length ${array.length}`);
      }

      // Basic validation for array assignment
      if (strictTypeChecking && value !== null && value !== undefined) {
        try {
          if (!(value instanceof MonoObject) &&
              typeof value !== 'string' &&
              typeof value !== 'number' &&
              typeof value !== 'boolean') {
            logger.warn(`Array assignment value may not be a valid Mono type: ${typeof value}`, {
              arrayLength: array.length,
              index
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
        valueType: typeof value
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
/**
 * Simplified type guards for Mono operations
 */

import { MonoValidationError } from "../patterns/errors";

declare const NativePointer: any;

function throwValidationError(
  parameter: string,
  message: string,
  value?: unknown
): never {
  throw new MonoValidationError(message, parameter, value);
}

/**
 * Check if value is a valid NativePointer
 */
export function isNativePointer(value: any): value is any {
  if (value instanceof NativePointer) {
    return true;
  }
  return value !== null
    && typeof value === "object"
    && typeof value.isNull === "function"
    && typeof value.toString === "function";
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
  return typeof value === 'string' && value.trim().length > 0;
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
export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  prop: K
): boolean {
  return obj && prop in obj;
}

/**
 * Type guard for Mono handle objects
 */
export function isMonoHandle(value: any): boolean {
  return isObject(value) && value && typeof (value as any).handle === 'object';
}

/**
 * Type guard for Mono class objects
 */
export function isMonoClass(value: any): boolean {
  return isObject(value) &&
         hasProperty(value, 'name') && isString((value as any).name) &&
         hasProperty(value, 'methods') && isArray((value as any).methods) &&
         hasProperty(value, 'fields') && isArray((value as any).fields);
}

/**
 * Type guard for Mono method objects
 */
export function isMonoMethod(value: any): boolean {
  return isObject(value) &&
         hasProperty(value, 'name') && isString((value as any).name) &&
         hasMethod(value, 'isStatic') &&
         hasMethod(value, 'invoke');
}

/**
 * Type guard for Mono field objects
 */
export function isMonoField(value: any): boolean {
  return isObject(value) &&
         hasProperty(value, 'name') && isString((value as any).name) &&
         hasProperty(value, 'type') &&
         hasMethod(value, 'isStatic');
}

/**
 * Check if value is a string
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is a function
 */
export function isFunction(value: any): value is Function {
  return typeof value === 'function';
}

/**
 * Check if value is an object (not null, not array)
 */
export function isObject(value: any): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
export function hasMethod<T extends object, K extends PropertyKey>(
  obj: T,
  method: K
): boolean {
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
export function validateRequired<T>(
  value: T | null | undefined,
  name: string,
  validator?: (value: T) => boolean
): T {
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
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
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
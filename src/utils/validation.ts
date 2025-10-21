/**
 * Validation utilities for input checking and method parameter preparation
 */

import { MonoApi } from "../runtime/api";
import { MonoValidationError } from "../patterns/errors";
import { pointerIsNull, safeAlloc } from "./memory";

declare const NativePointer: any;
declare const ptr: any;

// ============================================================================
// INPUT VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that a string is non-empty after trimming
 * @param value String to validate
 * @param paramName Parameter name for error message
 * @throws Error if string is empty or whitespace-only
 */
export function validateNonEmptyString(value: string, paramName: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${paramName} must be a non-empty string`);
  }
}

/**
 * Validates that a pointer is not null
 * @param value Pointer to validate
 * @param paramName Parameter name for error message
 * @throws Error if pointer is null
 */
export function validateNonNullPointer(value: NativePointer | null | undefined, paramName: string): void {
  if (pointerIsNull(value ?? NULL)) {
    throw new Error(`${paramName} must not be null`);
  }
}

// ============================================================================
// METHOD AND PARAMETER UTILITIES
// ============================================================================

/**
 * Prepare argument for delegate or method invocation
 * Handles null, NativePointer, objects with handle, strings, and numbers
 */
export function prepareDelegateArgument(api: MonoApi, arg: any): NativePointer {
  if (arg === null || arg === undefined) {
    return ptr(0);
  }

  if (arg instanceof NativePointer) {
    return arg;
  }

  if (arg.handle) {
    return arg.handle;
  }

  // For simple values, allocate and write them
  if (typeof arg === 'string') {
    const monoString = api.stringNew(arg);
    return monoString;
  }

  if (typeof arg === 'number') {
    const pointer = safeAlloc(8);
    pointer.writeS64(arg);
    return pointer;
  }

  return ptr(0);
}

/**
 * Get parameter count from method or pointer
 */
export function getParameterCount(api: MonoApi, method: any): number {
  if (!method) {
    return 0;
  }

  try {
    // These methods might not exist on all MonoApi implementations
    if (!api.native || !api.native.mono_method_signature) {
      return 0;
    }

    const pointer = method instanceof NativePointer ? method : method.pointer || method;
    const signature = api.native.mono_method_signature(pointer);
    if (!signature || signature.isNull()) {
      return 0;
    }

    const paramCount = api.native.mono_signature_get_param_count(signature);
    return paramCount || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Verify parameter count matches expected
 */
export function verifyParameterCount(api: MonoApi, method: any, expected: number, context?: string): void {
  const actual = getParameterCount(api, method);

  if (actual !== expected) {
    const message = context
      ? `${context}: Expected ${expected} parameters, got ${actual}`
      : `Expected ${expected} parameters, got ${actual}`;
    throw new MonoValidationError(message, context ?? "method", method);
  }
}
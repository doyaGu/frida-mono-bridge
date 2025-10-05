/**
 * Validation utilities for input checking
 */

import { pointerIsNull } from "../runtime/mem";

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

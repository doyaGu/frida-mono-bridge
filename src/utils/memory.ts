/**
 * Memory allocation, pointer validation, and manipulation utilities
 */

import { MonoMemoryError, MonoValidationError } from "./errors";
import { isNativePointer } from "./type-operations";

declare const NativePointer: any;
declare const Memory: any;
declare const ptr: any;

// ============================================================================
// POINTER UTILITIES
// ============================================================================

/**
 * Resolve a value to a NativePointer
 * Handles NativePointer, objects with handle/pointer properties, and toPointer() methods
 */
export function resolveNativePointer(value: any): NativePointer | null {
  if (isNativePointer(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (isNativePointer((value as any).handle)) {
      return (value as any).handle;
    }
    if (isNativePointer((value as any).pointer)) {
      return (value as any).pointer;
    }
    if (typeof (value as any).toPointer === "function") {
      const candidate = (value as any).toPointer();
      if (isNativePointer(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * Try to create a pointer from string, number, or bigint
 */
export function tryMakePointer(value: string | number | bigint): NativePointer | null {
  try {
    return ptr(value);
  } catch (_error) {
    return null;
  }
}

/**
 * Determine whether a pointer-like value is null
 * Handles NativePointer, numbers, strings, bigints, and objects with handle/pointer
 */
export function pointerIsNull(
  value: NativePointer | number | string | bigint | null | undefined | { handle?: NativePointer; pointer?: NativePointer },
): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "number") {
    return value === 0;
  }

  if (typeof value === "string" || typeof value === "bigint") {
    const pointer = tryMakePointer(value);
    return pointer ? pointer.isNull() : false;
  }

  const resolved = resolveNativePointer(value);
  if (resolved) {
    return resolved.isNull();
  }

  return false;
}

/**
 * Ensure a value is a valid NativePointer, throw error if not
 */
export function ensurePointer(value: NativePointer | null | undefined, message: string): NativePointer {
  const pointer = resolveNativePointer(value);
  if (!pointer || pointer.isNull()) {
    throw new MonoValidationError(message || "Invalid pointer", "pointer", value ?? null);
  }
  return pointer;
}

/**
 * Require a valid pointer or throw an error with context
 * This is an alias for ensurePointer with more explicit naming
 */
export function requireValidPointer(
  pointer: NativePointer | null | undefined,
  errorMessage: string
): NativePointer {
  return ensurePointer(pointer, errorMessage);
}

/**
 * Check if pointer is valid (not null and not undefined)
 */
export function isValidPointer(pointer: NativePointer | null | undefined): pointer is NativePointer {
  const resolved = resolveNativePointer(pointer);
  return resolved !== null && !resolved.isNull();
}

/**
 * Unwrap instance to NativePointer with null checks
 * Returns ptr(0) for null/undefined values
 */
export function unwrapInstance(instance: any): NativePointer {
  if (instance === null || instance === undefined) {
    return ptr(0);
  }

  const resolved = resolveNativePointer(instance);
  if (resolved) {
    return resolved;
  }

  if (typeof instance === "string" || typeof instance === "number") {
    try {
      return ptr(instance);
    } catch (_error) {
      return ptr(0);
    }
  }

  return ptr(0);
}

/**
 * Unwrap instance with required validation
 * Throws MonoValidationError if pointer is invalid
 */
export function unwrapInstanceRequired(
  instance: any,
  context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string }
): NativePointer {
  const pointer = unwrapInstance(instance);

  if (!isValidPointer(pointer)) {
    const description = describeContext(context);
    throw new MonoValidationError(
      `Invalid instance${description ? ` in ${description}` : ""}`,
      "instance",
      instance
    );
  }

  return pointer;
}

/**
 * Describe context for error messages
 * Tries getFullName(), getName(), and toString() in order
 */
function describeContext(
  context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string }
): string {
  if (typeof context === "string") {
    return context;
  }

  if (!context) {
    return "";
  }

  try {
    if (typeof context.getFullName === "function") {
      const value = context.getFullName();
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  } catch (_error) {
    // ignore and fall back
  }

  try {
    if (typeof context.getName === "function") {
      const value = context.getName();
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  } catch (_error) {
    // ignore and fall back
  }

  if (typeof context.toString === "function") {
    const value = context.toString();
    if (typeof value === "string" && value.length > 0 && value !== "[object Object]") {
      return value;
    }
  }

  return "";
}

// ============================================================================
// MEMORY UTILITIES
// ============================================================================

/**
 * Safe memory allocation with validation
 */
export function safeAlloc(size: number): NativePointer {
  if (size <= 0) {
    throw new MonoValidationError("Allocation size must be positive", "size", size);
  }

  try {
    return Memory.alloc(size);
  } catch (error) {
    throw new MonoMemoryError(
      `Failed to allocate ${size} bytes`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Safe memory write with validation
 */
export function safeWriteMemory(pointer: NativePointer, data: ArrayBuffer | number[]): void {
  if (!isValidPointer(pointer)) {
    throw new MonoValidationError("Invalid pointer for memory write", "pointer", pointer);
  }

  try {
    pointer.writeByteArray(data);
  } catch (error) {
    throw new MonoMemoryError(
      `Failed to write memory at ${pointer}`,
      error instanceof Error ? error : undefined
    );
  }
}
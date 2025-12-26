/**
 * Memory allocation, pointer validation, and manipulation utilities.
 *
 * Provides:
 * - Pointer type guards and resolution
 * - Pointer array allocation
 * - Instance unwrapping for Mono objects
 * - Memory address validation
 *
 * @module utils/memory
 */

import { MonoErrorCodes, raise, raiseFrom } from "./errors";

const POINTER_SIZE = Process.pointerSize;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a valid NativePointer or NativePointer-like object.
 *
 * @returns `true` if the value can be used as a NativePointer.
 */
export function isNativePointer(value: unknown): value is NativePointer {
  if (value instanceof NativePointer) {
    return true;
  }
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { isNull?: unknown }).isNull === "function" &&
    typeof (value as { toString?: unknown }).toString === "function"
  );
}

// ============================================================================
// MEMORY ALLOCATION UTILITIES
// ============================================================================

/**
 * Allocate an array of pointers in memory
 * @param items Array of pointers to store
 * @returns Pointer to allocated array
 */
export function allocPointerArray(items: NativePointer[]): NativePointer {
  if (items.length === 0) {
    return NULL;
  }

  const buffer = Memory.alloc(items.length * POINTER_SIZE);
  for (let index = 0; index < items.length; index += 1) {
    const offset = index * POINTER_SIZE;
    const pointer = buffer.add(offset);
    pointer.writePointer(items[index] ?? NULL);
  }

  return buffer;
}

// ============================================================================
// POINTER UTILITIES
// ============================================================================

/**
 * Resolve a value to a NativePointer
 * Handles NativePointer, objects with handle/pointer properties, and toPointer() methods
 */
export function resolveNativePointer(value: unknown): NativePointer | null {
  if (isNativePointer(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("handle" in obj && isNativePointer(obj.handle)) {
      return obj.handle;
    }
    if ("pointer" in obj && isNativePointer(obj.pointer)) {
      return obj.pointer;
    }
    if ("toPointer" in obj && typeof obj.toPointer === "function") {
      const candidate = (obj.toPointer as () => unknown)();
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
    // Frida's ptr() doesn't accept bigint directly, convert to hex string
    if (typeof value === "bigint") {
      return ptr("0x" + value.toString(16));
    }
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
  value:
    | NativePointer
    | number
    | string
    | bigint
    | null
    | undefined
    | { handle?: NativePointer; pointer?: NativePointer },
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
    raise(MonoErrorCodes.INVALID_ARGUMENT, message || "Invalid pointer", "Provide a non-null NativePointer", {
      parameter: "pointer",
      value: value ?? null,
    });
  }
  return pointer;
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
 * For value types (structs), returns the unboxed pointer
 */
export function unwrapInstance(instance: unknown): NativePointer {
  if (instance === null || instance === undefined) {
    return ptr(0);
  }

  // Check if it's a MonoObject with getInstancePointer method (handles value types correctly)
  if (
    typeof instance === "object" &&
    instance !== null &&
    "getInstancePointer" in instance &&
    typeof instance.getInstancePointer === "function"
  ) {
    return instance.getInstancePointer();
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
  instance: unknown,
  context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string },
): NativePointer {
  const pointer = unwrapInstance(instance);

  if (!isValidPointer(pointer)) {
    const description = describeContext(context);
    raise(
      MonoErrorCodes.INVALID_ARGUMENT,
      `Invalid instance${description ? ` in ${description}` : ""}`,
      "Provide a managed object instance or a valid NativePointer",
      { parameter: "instance", value: instance },
    );
  }

  return pointer;
}

/**
 * Describe context for error messages
 * Tries getFullName(), getName(), and toString() in order
 */
function describeContext(
  context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string },
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
    raise(MonoErrorCodes.INVALID_ARGUMENT, "Allocation size must be positive", "Provide a size > 0", {
      parameter: "size",
      value: size,
    });
  }

  try {
    return Memory.alloc(size);
  } catch (error) {
    raiseFrom(
      error,
      MonoErrorCodes.MEMORY_ERROR,
      `Failed to allocate ${size} bytes`,
      "Reduce allocation size or ensure the target process has enough memory",
      { size },
    );
  }
}

/**
 * Safe memory write with validation
 */
export function safeWriteMemory(pointer: NativePointer, data: ArrayBuffer | number[]): void {
  if (!isValidPointer(pointer)) {
    raise(MonoErrorCodes.INVALID_ARGUMENT, "Invalid pointer for memory write", "Provide a non-null NativePointer", {
      parameter: "pointer",
      value: pointer,
    });
  }

  try {
    pointer.writeByteArray(data);
  } catch (error) {
    raiseFrom(
      error,
      MonoErrorCodes.MEMORY_ERROR,
      `Failed to write memory at ${pointer}`,
      "Ensure the pointer is writable and the data size is valid",
      { pointer: pointer.toString() },
    );
  }
}

// ============================================================================
// MONO HANDLE ENUMERATION
// ============================================================================

/**
 * Lazy generator for Mono handle enumeration.
 * Creates wrapper objects on-demand as you iterate, reducing memory usage
 * when only a subset of items is needed.
 *
 * @param fetch Function that takes iterator pointer and returns next handle
 * @param factory Function to create typed object from handle pointer
 * @yields Enumerated objects one at a time
 *
 * @example
 * ```typescript
 * // Find first method matching a condition without creating all wrappers
 * for (const method of iterateMonoHandles(
 *   (iter) => api.native.mono_class_get_methods(classPtr, iter),
 *   (ptr) => new MonoMethod(api, ptr)
 * )) {
 *   if (method.name === "ToString") {
 *     return method; // Early exit, no more wrappers created
 *   }
 * }
 * ```
 */
export function* iterateMonoHandles<T>(
  fetch: (iter: NativePointer) => NativePointer,
  factory: (ptr: NativePointer) => T,
): Generator<T, void, undefined> {
  // Allocate iterator state pointer for Mono's iteration API.
  // Mono iteration functions (e.g., mono_class_get_methods) expect a pointer
  // to a gpointer that they update in-place to track iteration state.
  // Initialize with NULL to signal "start from beginning".
  const iterator = Memory.alloc(Process.pointerSize);
  iterator.writePointer(NULL);

  // Iterate until fetch returns NULL (end of enumeration).
  // The fetch function updates the iterator pointer in-place for the next iteration.
  while (true) {
    const handle = fetch(iterator);
    if (pointerIsNull(handle)) {
      break;
    }
    yield factory(handle);
  }
}

/**
 * Generic Mono handle enumeration using iterator pattern.
 * Eagerly collects all items into an array.
 *
 * For large collections where you only need a subset, consider using
 * `iterateMonoHandles()` which creates wrappers lazily.
 *
 * @param fetch Function that takes iterator pointer and returns next handle
 * @param factory Function to create typed object from handle pointer
 * @returns Array of enumerated objects
 *
 * @example
 * ```typescript
 * const methods = enumerateMonoHandles(
 *   (iter) => api.native.mono_class_get_methods(classPtr, iter),
 *   (ptr) => new MonoMethod(api, ptr)
 * );
 * ```
 */
export function enumerateMonoHandles<T>(
  fetch: (iter: NativePointer) => NativePointer,
  factory: (ptr: NativePointer) => T,
): T[] {
  // Use the generator internally for consistent implementation
  return Array.from(iterateMonoHandles(fetch, factory));
}

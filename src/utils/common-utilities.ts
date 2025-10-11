/**
 * Common utility functions to reduce duplication across modules
 * Consolidated from various model and runtime modules
 */

import { MonoApi } from "../runtime/api";

declare const NativePointer: any;
declare const ptr: any;
declare const Memory: any;

/**
 * Pointer validation and manipulation utilities
 */

/**
 * Ensure a value is a valid NativePointer, throw error if not
 */
export function ensurePointer(value: NativePointer | null | undefined, message: string): NativePointer {
  if (!value || value.isNull()) {
    throw new Error(message || "Invalid pointer");
  }
  return value;
}

/**
 * Check if pointer is valid (not null and not undefined)
 */
export function isValidPointer(pointer: NativePointer | null | undefined): pointer is NativePointer {
  return pointer !== null && pointer !== undefined && !pointer.isNull();
}

/**
 * String manipulation utilities
 */

/**
 * Safely read UTF-8 string from pointer
 */
export function readUtf8String(pointer: NativePointer | null): string {
  if (!isValidPointer(pointer)) {
    return "";
  }

  try {
    return pointer.readUtf8String() || "";
  } catch (error) {
    return "";
  }
}

/**
 * Safely read UTF-16 string from pointer
 */
export function readUtf16String(pointer: NativePointer | null, length?: number): string {
  if (!isValidPointer(pointer)) {
    return "";
  }

  try {
    return pointer.readUtf16String(length) || "";
  } catch (error) {
    return "";
  }
}

/**
 * Instance unwrapping utilities
 */

/**
 * Unwrap instance to NativePointer with null checks
 */
export function unwrapInstance(instance: any): NativePointer {
  if (instance === null || instance === undefined) {
    return ptr(0);
  }

  if (instance.handle) {
    return instance.handle;
  }

  if (instance instanceof NativePointer) {
    return instance;
  }

  return ptr(0);
}

/**
 * Unwrap instance with required validation
 */
export function unwrapInstanceRequired(instance: any, context: string): NativePointer {
  const pointer = unwrapInstance(instance);

  if (!isValidPointer(pointer)) {
    throw new Error(`Invalid instance in ${context}`);
  }

  return pointer;
}

/**
 * Type checking utilities
 */

/**
 * Check if value represents a pointer-like type
 */
export function isPointerLike(kind: number): boolean {
  // Common pointer-like type kinds in Mono
  return kind === 0x1 || // OBJECT
         kind === 0x2 || // SZARRAY
         kind === 0x3 || // STRING
         kind === 0x4 || // CLASS
         kind === 0x6 || // GENERICINST
         kind === 0x8 || // ARRAY
         kind === 0x1C; // PTR
}

/**
 * Memory management utilities
 */

/**
 * Safe memory allocation with validation
 */
export function safeAlloc(size: number): NativePointer {
  if (size <= 0) {
    throw new Error(`Invalid allocation size: ${size}`);
  }

  try {
    return Memory.alloc(size);
  } catch (error) {
    throw new Error(`Failed to allocate ${size} bytes: ${error}`);
  }
}

/**
 * Safe memory write with validation
 */
export function safeWriteMemory(pointer: NativePointer, data: ArrayBuffer | number[]): void {
  if (!isValidPointer(pointer)) {
    throw new Error("Invalid pointer for memory write");
  }

  try {
    pointer.writeByteArray(data);
  } catch (error) {
    throw new Error(`Failed to write memory at ${pointer}: ${error}`);
  }
}

/**
 * Method and function utilities
 */

/**
 * Prepare argument for delegate or method invocation
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
 * Parameter validation utilities
 */

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
    throw new Error(message);
  }
}

/**
 * Enumeration utilities
 */

/**
 * Generic function to enumerate handles from collections
 */
export function enumerateHandles<T>(
  api: MonoApi,
  fetch: (iter: NativePointer) => NativePointer,
  factory: (ptr: NativePointer) => T,
  countMethod?: string
): T[] {
  const results: T[] = [];

  try {
    // This would need to be implemented based on actual Mono API patterns
    // Common patterns in Mono:
    // - mono_class_get_methods
    // - mono_class_get_fields
    // - mono_image_get_assemblies

    // For now, return empty array
    // Implementation would depend on the specific enumeration pattern
  } catch (error) {
    // Log error but don't throw to maintain compatibility
  }

  return results;
}

/**
 * Value conversion utilities
 */

/**
 * Convert value to safe JSON representation
 */
export function safeStringify(value: any): string {
  try {
    return JSON.stringify(value, (key, val) => {
      if (val instanceof NativePointer) {
        return `NativePointer(${val})`;
      }
      if (typeof val === 'function') {
        return `Function(${val.name || 'anonymous'})`;
      }
      return val;
    });
  } catch (error) {
    return String(value);
  }
}

/**
 * Create error with context information
 */
export function createError(message: string, context?: any, cause?: Error): Error {
  const error = new Error(message);
  if (cause) {
    error.stack = `${error.stack}\nCaused by: ${cause.stack}`;
  }
  if (context) {
    error.message += ` (Context: ${safeStringify(context)})`;
  }
  return error;
}

/**
 * Performance timing utilities
 */

/**
 * Simple performance timer
 */
export class PerformanceTimer {
  private start: number;

  constructor() {
    this.start = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.start;
  }

  elapsedMs(): number {
    return this.elapsed();
  }

  elapsedSeconds(): number {
    return this.elapsedMs() / 1000;
  }

  restart(): void {
    this.start = Date.now();
  }
}

/**
 * Create performance timer
 */
export function createTimer(): PerformanceTimer {
  return new PerformanceTimer();
}
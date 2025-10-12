/**
 * Common utility functions to reduce duplication across modules
 * Consolidated from various model and runtime modules
 */

import { MonoApi } from "../runtime/api";
import { MonoError, MonoMemoryError, MonoValidationError } from "../patterns/errors";

declare const NativePointer: any;
declare const ptr: any;
declare const Memory: any;

/**
 * Pointer validation and manipulation utilities
 */

function isNativePointer(value: any): value is NativePointer {
  if (value instanceof NativePointer) {
    return true;
  }
  return value !== null
    && typeof value === "object"
    && typeof value.isNull === "function"
    && typeof value.toString === "function";
}

function resolveNativePointer(value: any): NativePointer | null {
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

function tryMakePointer(value: string | number | bigint): NativePointer | null {
  try {
    return ptr(value);
  } catch (_error) {
    return null;
  }
}

/**
 * Determine whether a pointer-like value is null
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
 * Check if pointer is valid (not null and not undefined)
 */
export function isValidPointer(pointer: NativePointer | null | undefined): pointer is NativePointer {
  const resolved = resolveNativePointer(pointer);
  return resolved !== null && !resolved.isNull();
}

/**
 * String manipulation utilities
 */

/**
 * Safely read UTF-8 string from pointer
 */
export function readUtf8String(pointer: NativePointer | null): string {
  const resolved = resolveNativePointer(pointer);
  if (!resolved || resolved.isNull()) {
    return "";
  }

  try {
    return resolved.readUtf8String() || "";
  } catch (error) {
    return "";
  }
}

/**
 * Safely read UTF-16 string from pointer
 */
export function readUtf16String(pointer: NativePointer | null, length?: number): string {
  const resolved = resolveNativePointer(pointer);
  if (!resolved || resolved.isNull()) {
    return "";
  }

  try {
    return resolved.readUtf16String(length) || "";
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
 */
export function unwrapInstanceRequired(instance: any, context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string }): NativePointer {
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

function describeContext(context: string | { getFullName?: () => string; getName?: () => string; toString?: () => string }): string {
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
    throw new MonoValidationError(message, context ?? "method", method);
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
export function createError(message: string, context?: any, cause?: Error): MonoError {
  const hasContext = Boolean(context);
  const formattedMessage = hasContext
    ? `${message} (Context: ${safeStringify(context)})`
    : message;
  const contextLabel = typeof context === "string" ? context : undefined;
  return new MonoError(formattedMessage, contextLabel, cause);
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

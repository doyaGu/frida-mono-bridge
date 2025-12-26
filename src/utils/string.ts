/**
 * String reading, writing, formatting, and conversion utilities for Mono.
 *
 * Provides:
 * - Safe UTF-8/UTF-16 string reading from pointers
 * - MonoString pointer resolution
 * - JSON serialization with pointer/function handling
 *
 * @module utils/string
 */

import { MonoError } from "./errors";
import { resolveNativePointer } from "./memory";

// ============================================================================
// STRING READING/WRITING UTILITIES
// ============================================================================

/**
 * Safely read UTF-8 string from pointer.
 *
 * @returns Empty string if pointer is null or reading fails.
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
 * Read UTF-8 string from Mono string or pointer
 * Handles both MonoString objects and raw pointers
 */
export function readMonoString(monoStringOrPointer: unknown): string {
  if (!monoStringOrPointer) {
    return "";
  }

  // If it's a MonoString object, get its handle
  if (
    typeof monoStringOrPointer === "object" &&
    monoStringOrPointer !== null &&
    "handle" in monoStringOrPointer &&
    monoStringOrPointer.handle
  ) {
    return readUtf8String(monoStringOrPointer.handle as NativePointer);
  }

  // If it's a MonoString object with toPointer method
  if (
    typeof monoStringOrPointer === "object" &&
    monoStringOrPointer !== null &&
    "toPointer" in monoStringOrPointer &&
    typeof monoStringOrPointer.toPointer === "function"
  ) {
    return readUtf8String(monoStringOrPointer.toPointer());
  }

  // Otherwise treat it as a raw pointer
  return readUtf8String(monoStringOrPointer as NativePointer);
}

/**
 * Safely read UTF-16 string from pointer
 * Returns empty string if pointer is null or reading fails
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

// ============================================================================
// FORMATTING AND CONVERSION UTILITIES
// ============================================================================

/**
 * Convert value to safe JSON representation
 * Handles NativePointer and Function types gracefully
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof NativePointer) {
        return `NativePointer(${val})`;
      }
      if (typeof val === "function") {
        return `Function(${val.name || "anonymous"})`;
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
export function createError(message: string, context?: unknown, cause?: Error): MonoError {
  const hasContext = Boolean(context);
  const formattedMessage = hasContext ? `${message} (Context: ${safeStringify(context)})` : message;
  const contextLabel = typeof context === "string" ? context : undefined;
  return new MonoError(formattedMessage, contextLabel, cause);
}

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

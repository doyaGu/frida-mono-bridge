/**
 * String reading and writing utilities for Mono
 */

import { resolveNativePointer } from "./pointer-utils";

declare const NativePointer: any;

/**
 * Safely read UTF-8 string from pointer
 * Returns empty string if pointer is null or reading fails
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

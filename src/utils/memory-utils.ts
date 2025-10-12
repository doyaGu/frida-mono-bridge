/**
 * Memory allocation and manipulation utilities
 * Extracted from common-utilities.ts for better organization
 */

import { MonoMemoryError, MonoValidationError } from "../patterns/errors";
import { isValidPointer } from "./pointer-utils";

declare const NativePointer: any;
declare const Memory: any;

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

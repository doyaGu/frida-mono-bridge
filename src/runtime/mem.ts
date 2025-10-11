const POINTER_SIZE = Process.pointerSize;

/**
 * Allocate a UTF-8 string in memory
 * @param value String to allocate
 * @returns Pointer to allocated string
 */
export function allocUtf8(value: string): NativePointer {
  return Memory.allocUtf8String(value);
}

/**
 * Allocate an array of pointers
 * @param items Array of pointers
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

/**
 * Allocate a buffer for boxing values
 * @param size Buffer size in bytes
 * @returns Pointer to allocated buffer
 */
export function allocValueBoxBuffer(size: number): NativePointer {
  return Memory.alloc(size);
}

/**
 * Check if a pointer is null or invalid
 * @param value Value to check
 * @returns True if pointer is null
 */
export function pointerIsNull(value: NativePointer | null | number | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "number") {
    return value === 0;
  }
  if (typeof value === "object" && typeof (value as any).isNull === "function") {
    return (value as any).isNull();
  }
  return false;
}

// String reading utilities - re-exported from common utilities
import { readUtf8String, readUtf16String } from "../utils/common-utilities";

// Re-export for backward compatibility
export { readUtf8String, readUtf16String };

export function readU16(pointer: NativePointer): number {
  const reader = (Memory as any).readU16 as ((address: NativePointer) => number) | undefined;
  if (typeof reader === "function") {
    return reader(pointer);
  }
  const readBytes = (Memory as any).readByteArray as
    | ((address: NativePointer, size: number) => ArrayBuffer | null)
    | undefined;
  const buffer = typeof readBytes === "function" ? readBytes(pointer, 2) : null;
  if (!buffer) {
    return 0;
  }
  return new Uint16Array(buffer as ArrayBuffer)[0];
}

export function readU32(pointer: NativePointer): number {
  const reader = (Memory as any).readU32 as ((address: NativePointer) => number) | undefined;
  if (typeof reader === "function") {
    return reader(pointer);
  }
  const readBytes = (Memory as any).readByteArray as
    | ((address: NativePointer, size: number) => ArrayBuffer | null)
    | undefined;
  const buffer = typeof readBytes === "function" ? readBytes(pointer, 4) : null;
  if (!buffer) {
    return 0;
  }
  return new Uint32Array(buffer as ArrayBuffer)[0];
}

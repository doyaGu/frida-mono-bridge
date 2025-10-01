const POINTER_SIZE = Process.pointerSize;

export function allocUtf8(value: string): NativePointer {
  return Memory.allocUtf8String(value);
}

export function allocPointerArray(items: NativePointer[]): NativePointer {
  if (items.length === 0) {
    return NULL;
  }

  const buffer = Memory.alloc(items.length * POINTER_SIZE);
  for (let index = 0; index < items.length; index += 1) {
    const offset = index * POINTER_SIZE;
    const pointer = buffer.add(offset);
    Memory.writePointer(pointer, items[index] ?? NULL);
  }

  return buffer;
}

export function allocValueBoxBuffer(size: number): NativePointer {
  return Memory.alloc(size);
}

export function pointerIsNull(value: NativePointer): boolean {
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

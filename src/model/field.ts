import { MonoHandle } from "./base";
import { MonoObject } from "./object";

export class MonoField extends MonoHandle {
  getValue(instance: MonoObject | NativePointer): NativePointer {
    return this.withThread(() => {
      const buffer = Memory.alloc(Process.pointerSize);
      this.api.native.mono_field_get_value(unwrapInstance(instance), this.pointer, buffer);
      return Memory.readPointer(buffer);
    });
  }

  setValue(instance: MonoObject | NativePointer, value: NativePointer): void {
    this.withThread(() => {
      this.api.native.mono_field_set_value(unwrapInstance(instance), this.pointer, value);
    });
  }
}

function unwrapInstance(instance: MonoObject | NativePointer): NativePointer {
  if (instance instanceof MonoObject) {
    return instance.pointer;
  }
  return instance;
}

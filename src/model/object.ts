import { MonoApi } from "../runtime/api";
import { pointerIsNull } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoKlass } from "./klass";

export class MonoObject extends MonoHandle {
  getClass(): MonoKlass {
    const klassPtr = this.withThread(() => this.api.native.mono_object_get_class(this.pointer));
    return new MonoKlass(this.api, klassPtr);
  }

  unbox(): NativePointer {
    return this.withThread(() => this.api.native.mono_object_unbox(this.pointer));
  }

  isNull(): boolean {
    return pointerIsNull(this.pointer);
  }
}

export class MonoString extends MonoObject {}

export class MonoArray extends MonoObject {
  get length(): number {
    return this.withThread(() => this.api.native.mono_array_length(this.pointer) as number);
  }
}

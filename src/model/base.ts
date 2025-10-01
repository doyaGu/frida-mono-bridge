import { MonoApi } from "../runtime/api";
import { pointerIsNull } from "../runtime/mem";
import { withAttachedThread } from "../runtime/guard";

export abstract class MonoHandle {
  constructor(protected readonly api: MonoApi, protected readonly handle: NativePointer) {
    if (pointerIsNull(handle)) {
      throw new Error(`${this.constructor.name} received a NULL handle.`);
    }
  }

  get pointer(): NativePointer {
    return this.handle;
  }

  protected withThread<T>(fn: () => T): T {
    return withAttachedThread(this.api, fn);
  }
}

export type MethodArgument = NativePointer | number | boolean | string | null | undefined;

export function ensurePointer(value: NativePointer | null | undefined, message: string): NativePointer {
  if (pointerIsNull(value ?? NULL)) {
    throw new Error(message);
  }
  return value as NativePointer;
}

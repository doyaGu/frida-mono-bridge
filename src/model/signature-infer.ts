import { MonoApi } from "../runtime/api";
import { MonoMethod } from "../model/method";

export function getParameterCount(api: MonoApi, method: MonoMethod | NativePointer): number {
  const pointer = method instanceof MonoMethod ? method.pointer : method;
  const signature = api.native.mono_method_signature(pointer);
  return api.native.mono_signature_get_param_count(signature) as number;
}

export function verifyParameterCount(api: MonoApi, method: MonoMethod | NativePointer, expected: number): void {
  const count = getParameterCount(api, method);
  if (count !== expected) {
    throw new Error(`Parameter count mismatch. Expected ${expected}, got ${count}`);
  }
}

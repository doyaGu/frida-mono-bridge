import { MonoApi } from "../runtime/api";
import { withAttachedThread } from "../runtime/guard";

export function registerInternalCall(api: MonoApi, name: string, callback: NativePointer): void {
  withAttachedThread(api, () => api.addInternalCall(name, callback));
}

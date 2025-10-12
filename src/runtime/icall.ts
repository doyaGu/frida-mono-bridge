import { MonoApi } from "../runtime/api";

export function registerInternalCall(api: MonoApi, name: string, callback: NativePointer): void {
  api._threadManager.run(() => api.addInternalCall(name, callback));
}

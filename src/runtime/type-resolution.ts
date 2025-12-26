import { pointerIsNull } from "../utils/memory";
import type { MonoApi } from "./api";

export function tryGetClassPtrFromMonoType(api: MonoApi, monoType: NativePointer): NativePointer | null {
  if (pointerIsNull(monoType)) {
    return null;
  }

  if (!api.hasExport("mono_class_from_mono_type")) {
    return null;
  }

  try {
    const klassPtr = api.native.mono_class_from_mono_type(monoType);
    return pointerIsNull(klassPtr) ? null : klassPtr;
  } catch {
    return null;
  }
}

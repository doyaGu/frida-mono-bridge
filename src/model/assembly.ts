import { MonoApi } from "../runtime/api";
import { MonoHandle } from "./base";
import { MonoImage } from "./image";

export class MonoAssembly extends MonoHandle {
  constructor(api: MonoApi, pointer: NativePointer) {
    super(api, pointer);
  }

  getImage(): MonoImage {
    const imagePtr = this.withThread(() => this.api.native.mono_assembly_get_image(this.pointer));
    return new MonoImage(this.api, imagePtr);
  }
}

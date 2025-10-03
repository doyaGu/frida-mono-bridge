import { MonoApi } from "../runtime/api";
import { allocUtf8, pointerIsNull } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoDomain } from "./domain";
import { MonoKlass } from "./klass";

export class MonoImage extends MonoHandle {
  static fromAssemblyPath(api: MonoApi, path: string, domain: MonoDomain = MonoDomain.getRoot(api)): MonoImage {
    return domain.assemblyOpen(path).getImage();
  }

  classFromName(namespace: string, name: string): MonoKlass {
    const nsPtr = namespace ? allocUtf8(namespace) : NULL;
    const namePtr = allocUtf8(name);
    const klassPtr = this.withThread(() => this.api.native.mono_class_from_name(this.pointer, nsPtr, namePtr));
    if (pointerIsNull(klassPtr)) {
      throw new Error(`Class ${namespace}.${name} not found in image.`);
    }
    return new MonoKlass(this.api, klassPtr);
  }
}

import { MonoApi } from "../runtime/api";
import { allocUtf8, pointerIsNull } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoAssembly } from "./assembly";

export class MonoDomain extends MonoHandle {
  static getRoot(api: MonoApi): MonoDomain {
    const domainPtr = api.getRootDomain();
    return new MonoDomain(api, domainPtr);
  }

  static current(api: MonoApi): MonoDomain {
    const domainPtr = api.call("mono_domain_get");
    return new MonoDomain(api, domainPtr);
  }

  static fromPointer(api: MonoApi, pointer: NativePointer): MonoDomain {
    return new MonoDomain(api, pointer);
  }

  assemblyOpen(path: string): MonoAssembly {
    const pathPtr = allocUtf8(path);
    const assemblyPtr = this.withThread(() => this.api.call("mono_domain_assembly_open", this.pointer, pathPtr));
    if (pointerIsNull(assemblyPtr)) {
      throw new Error(`Unable to open assembly at ${path}`);
    }
    return new MonoAssembly(this.api, assemblyPtr);
  }
}

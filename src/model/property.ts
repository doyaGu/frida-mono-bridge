import { MonoHandle } from "./base";
import { MonoMethod } from "./method";

export class MonoProperty extends MonoHandle {
  getGetter(): MonoMethod {
    const methodPtr = this.withThread(() => this.api.call("mono_property_get_get_method", this.pointer));
    return new MonoMethod(this.api, methodPtr);
  }

  getSetter(): MonoMethod {
    const methodPtr = this.withThread(() => this.api.call("mono_property_get_set_method", this.pointer));
    return new MonoMethod(this.api, methodPtr);
  }
}

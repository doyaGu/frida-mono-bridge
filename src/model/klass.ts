import { MonoApi } from "../runtime/api";
import { allocUtf8, pointerIsNull } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoField } from "./field";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { MonoProperty } from "./property";

export class MonoKlass extends MonoHandle {
  getMethod(name: string, paramCount = -1): MonoMethod {
    const namePtr = allocUtf8(name);
    const methodPtr = this.withThread(() => this.api.call("mono_class_get_method_from_name", this.pointer, namePtr, paramCount));
    if (pointerIsNull(methodPtr)) {
      throw new Error(`Method ${name}(${paramCount}) not found on klass.`);
    }
    return new MonoMethod(this.api, methodPtr);
  }

  getField(name: string): MonoField {
    const namePtr = allocUtf8(name);
    const fieldPtr = this.withThread(() => this.api.call("mono_class_get_field_from_name", this.pointer, namePtr));
    if (pointerIsNull(fieldPtr)) {
      throw new Error(`Field ${name} not found on klass.`);
    }
    return new MonoField(this.api, fieldPtr);
  }

  getProperty(name: string): MonoProperty {
    const namePtr = allocUtf8(name);
    const propertyPtr = this.withThread(() => this.api.call("mono_class_get_property_from_name", this.pointer, namePtr));
    if (pointerIsNull(propertyPtr)) {
      throw new Error(`Property ${name} not found on klass.`);
    }
    return new MonoProperty(this.api, propertyPtr);
  }

  newObject(initialise = true): MonoObject {
    const domain = this.api.getRootDomain();
    const objectPtr = this.withThread(() => this.api.call("mono_object_new", domain, this.pointer));
    if (initialise) {
      this.withThread(() => this.api.call("mono_runtime_object_init", objectPtr));
    }
    return new MonoObject(this.api, objectPtr);
  }
}

import { MonoApi, MonoManagedExceptionError } from "../runtime/api";
import { allocUtf8, pointerIsNull } from "../runtime/mem";
import { MonoHandle, MethodArgument } from "./base";
import { MonoImage } from "./image";
import { MonoObject } from "./object";

export interface InvokeOptions {
  throwOnManagedException?: boolean;
}

export class MonoMethod extends MonoHandle {
  static find(api: MonoApi, image: MonoImage, descriptor: string): MonoMethod {
    const descPtr = allocUtf8(descriptor);
    const methodDesc = api.call("mono_method_desc_new", descPtr, true);
    if (!methodDesc) {
      throw new Error(`mono_method_desc_new failed for descriptor ${descriptor}`);
    }
    try {
      const methodPtr = api.call("mono_method_desc_search_in_image", methodDesc, image.pointer);
      if (pointerIsNull(methodPtr)) {
        throw new Error(`Method ${descriptor} not found in image.`);
      }
      return new MonoMethod(api, methodPtr);
    } finally {
      api.call("mono_method_desc_free", methodDesc);
    }
  }

  getName(): string {
    const namePtr = this.withThread(() => this.api.call("mono_method_get_name", this.pointer));
    return Memory.readUtf8String(namePtr) ?? "";
  }

  getParamCount(): number {
    return this.withThread(() => {
      const signature = this.api.call("mono_method_signature", this.pointer);
      return this.api.call<number>("mono_signature_get_param_count", signature);
    });
  }

  invoke(instance: MonoObject | NativePointer | null, args: MethodArgument[] = [], options: InvokeOptions = {}): NativePointer {
    return this.withThread(() => {
      const argv = args.map((arg) => prepareArgument(this.api, arg));
      try {
        const result = this.api.runtimeInvoke(this.pointer, unwrapInstance(instance), argv);
        return result;
      } catch (error) {
        if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
          return NULL;
        }
        throw error;
      }
    });
  }
}

function prepareArgument(api: MonoApi, arg: MethodArgument): NativePointer {
  if (arg === null || arg === undefined) {
    return NULL;
  }
  if (arg instanceof MonoObject) {
    return arg.pointer;
  }
  if (typeof arg === "string") {
    return api.stringNew(arg);
  }
  if (typeof arg === "number" || typeof arg === "boolean") {
    throw new Error("Primitive arguments need manual boxing before invocation");
  }
  return arg as NativePointer;
}

function unwrapInstance(instance: MonoObject | NativePointer | null): NativePointer {
  if (instance === null || instance === undefined) {
    return NULL;
  }
  if (instance instanceof MonoObject) {
    return instance.pointer;
  }
  return instance as NativePointer;
}

import { MonoApi, MonoArg, MonoManagedExceptionError } from "../runtime/api";
import { withAttachedThread } from "../runtime/guard";
import { MonoKlass } from "./klass";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";

export interface DelegateInvokeOptions {
  throwOnManagedException?: boolean;
}

export class MonoDelegate extends MonoObject {
  #invokePtr: NativePointer | null = null;
  #thunkPtr: NativePointer | null = null;
  #nativeFunctions = new Map<string, NativeFunction>();
  static create(api: MonoApi, delegateClass: MonoKlass, target: MonoObject | NativePointer | null, method: MonoMethod | NativePointer): MonoDelegate {
    const instance = delegateClass.newObject(false);
    const methodPtr = method instanceof MonoMethod ? method.pointer : (method as NativePointer);
    const targetPtr = target instanceof MonoObject ? target.pointer : (target ?? NULL);
    withAttachedThread(api, () => api.native.mono_delegate_ctor(instance.pointer, targetPtr, methodPtr));
    return new MonoDelegate(api, instance.pointer);
  }

  getInvokeMethod(): MonoMethod {
    const { invoke } = this.ensureInvokeData();
    return new MonoMethod(this.api, invoke);
  }

  getNativeThunk(): NativePointer {
    const { thunk } = this.ensureInvokeData();
    return thunk;
  }

  invokeManaged(args: MonoArg[] = [], options: DelegateInvokeOptions = {}): NativePointer {
    const { invoke } = this.ensureInvokeData();
    return this.withThread(() => {
      const prepared = args.map((arg) => prepareDelegateArgument(this.api, arg));
      try {
        return this.api.runtimeInvoke(invoke, this.pointer, prepared);
      } catch (error) {
        if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
          return NULL;
        }
        throw error;
      }
    });
  }

  compileNative<T extends NativeFunction = NativeFunction>(returnType: string, argTypes: string[], cache = true): T {
    const cacheKey = `${returnType}->${argTypes.join(",")}`;
    if (cache) {
      const cached = this.#nativeFunctions.get(cacheKey);
      if (cached) {
        return cached as T;
      }
    }

    const { thunk } = this.ensureInvokeData();
    const nativeFn = new NativeFunction(thunk, returnType, argTypes) as T;
    if (cache) {
      this.#nativeFunctions.set(cacheKey, nativeFn);
    }
    return nativeFn;
  }

  private ensureInvokeData(): { invoke: NativePointer; thunk: NativePointer } {
    if (this.#invokePtr && this.#thunkPtr) {
      return { invoke: this.#invokePtr, thunk: this.#thunkPtr };
    }
    const klass = this.getClass();
    const { invoke, thunk } = this.api.getDelegateThunk(klass.pointer);
    this.#invokePtr = invoke;
    this.#thunkPtr = thunk;
    return { invoke, thunk };
  }
}

function prepareDelegateArgument(api: MonoApi, arg: MonoArg): NativePointer {
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

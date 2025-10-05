import { MonoApi, MonoArg, MonoManagedExceptionError } from "../runtime/api";
import { MonoClass } from "./class";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";

type AnyNativeFunction = NativeFunction<any, any[]>;

export interface DelegateInvokeOptions {
  throwOnManagedException?: boolean;
}

/**
 * Wrapper for Mono delegate objects with managed and native invocation support.
 * Provides both safe managed invocation and high-performance native thunk compilation.
 */
export class MonoDelegate extends MonoObject {
  #invokePtr: NativePointer | null = null;
  #thunkPtr: NativePointer | null = null;
  #nativeFunctions = new Map<string, AnyNativeFunction>();

  /**
   * Creates a new delegate instance bound to a target and method.
   *
   * @param api MonoApi instance
   * @param delegateClass MonoClass representing the delegate type
   * @param target Target object instance (null for static methods)
   * @param method MonoMethod or method pointer to bind
   * @returns New MonoDelegate instance
   */
  static create(api: MonoApi, delegateClass: MonoClass, target: MonoObject | NativePointer | null, method: MonoMethod | NativePointer): MonoDelegate {
    const instance = delegateClass.newObject(false);
    const methodPtr = method instanceof MonoMethod ? method.pointer : (method as NativePointer);
    const targetPtr = target instanceof MonoObject ? target.pointer : (target ?? NULL);
    const delegate = new MonoDelegate(api, instance.pointer);
    delegate.native.mono_delegate_ctor(instance.pointer, targetPtr, methodPtr);
    return delegate;
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
    const prepared = args.map((arg) => prepareDelegateArgument(this.api, arg));
    try {
      return this.api.runtimeInvoke(invoke, this.pointer, prepared);
    } catch (error) {
      if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
        return NULL;
      }
      throw error;
    }
  }

  /**
   * Compiles a native thunk for high-performance delegate invocation.
   *
   * SAFETY WARNING: Incorrect return/argument types will crash the target process.
   * Ensure types match the delegate's Invoke method signature exactly.
   * The calling convention must match the target platform (cdecl, stdcall, etc.).
   *
   * Use invokeManaged() if unsure about ABI compatibility - it's safer but slower.
   *
   * @param returnType Native return type (e.g., "void", "int", "pointer")
   * @param argTypes Array of native argument types. First arg is always the delegate instance pointer.
   * @param cache Whether to cache the compiled thunk (default: true)
   * @returns Compiled native function ready for high-frequency invocation
   *
   * @example
   * // For Action<string> delegate (void Invoke(string)):
   * const thunk = delegate.compileNative<NativeFunction<"void", ["pointer", "pointer"]>>(
   *   "void",
   *   ["pointer", "pointer"] // this (delegate) + string parameter
   * );
   * thunk(delegate.pointer, stringPtr);
   *
   * @example
   * // For Func<int, bool> delegate (bool Invoke(int)):
   * const thunk = delegate.compileNative<NativeFunction<"bool", ["pointer", "int"]>>(
   *   "bool",
   *   ["pointer", "int"] // this (delegate) + int parameter
   * );
   * const result = thunk(delegate.pointer, 42);
   */
  compileNative<T extends AnyNativeFunction = AnyNativeFunction>(
    returnType: NativeFunctionReturnType,
    argTypes: NativeFunctionArgumentType[],
    cache = true,
  ): T {
    const cacheKey = `${returnType}->${argTypes.join(",")}`;
    if (cache) {
      const cached = this.#nativeFunctions.get(cacheKey);
      if (cached) {
        return cached as T;
      }
    }

    const { thunk } = this.ensureInvokeData();
    const nativeFn = new NativeFunction<any, any[]>(
      thunk,
      returnType as any,
      argTypes as any[],
    ) as T;
    if (cache) {
      this.#nativeFunctions.set(cacheKey, nativeFn);
    }
    return nativeFn;
  }

  /**
   * Cleans up cached native functions and invoke data.
   * Should be called when the delegate is no longer needed.
   */
  dispose(): void {
    this.#nativeFunctions.clear();
    this.#invokePtr = null;
    this.#thunkPtr = null;
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

import { allocPointerArray, allocUtf8, pointerIsNull } from "./mem";
import { MonoModuleInfo } from "./module";
import { MONO_EXPORTS, MonoApiName, MonoExportSignature, getSignature } from "./signatures";

export type MonoArg = NativePointer | number | boolean | string | null | undefined;

export type MonoNativeBindings = {
  [Name in MonoApiName]: (...args: MonoArg[]) => any;
};

export class MonoFunctionResolutionError extends Error {
  constructor(public readonly exportName: string, message: string) {
    super(message);
    this.name = "MonoFunctionResolutionError";
  }
}

export class MonoManagedExceptionError extends Error {
  constructor(public readonly exception: NativePointer) {
    super("Managed exception thrown by mono_runtime_invoke");
    this.name = "MonoManagedExceptionError";
  }
}

export interface DelegateThunkInfo {
  invoke: NativePointer;
  thunk: NativePointer;
}

export class MonoApi {
  private readonly functionCache = new Map<MonoApiName, NativeFunction>();
  private readonly addressCache = new Map<MonoApiName, NativePointer>();
  private readonly delegateThunkCache = new Map<string, DelegateThunkInfo>();
  private exceptionSlot: NativePointer | null = null;
  private rootDomain: NativePointer | null = null;
  // Lazily bound invokers keyed by Mono export name.
  public readonly native: MonoNativeBindings = this.createNativeBindings();

  constructor(private readonly module: MonoModuleInfo) {}

  attachThread(): NativePointer {
    const rootDomain = this.getRootDomain();
    const thread = this.native.mono_thread_attach(rootDomain);
    if (pointerIsNull(thread)) {
      throw new Error("mono_thread_attach returned NULL; ensure the Mono runtime is initialised");
    }
    return thread;
  }

  detachThread(thread: NativePointer): void {
    this.native.mono_thread_detach(thread);
  }

  getRootDomain(): NativePointer {
    if (this.rootDomain && !pointerIsNull(this.rootDomain)) {
      return this.rootDomain;
    }
    const domain = this.native.mono_get_root_domain();
    if (pointerIsNull(domain)) {
      throw new Error("mono_get_root_domain returned NULL. Mono may not be initialised in this process");
    }
    this.rootDomain = domain;
    return domain;
  }

  stringNew(text: string): NativePointer {
    const domain = this.getRootDomain();
    const data = allocUtf8(text);
    return this.native.mono_string_new(domain, data);
  }

  runtimeInvoke(method: NativePointer, instance: NativePointer | null, args: NativePointer[]): NativePointer {
    const invoke = this.native.mono_runtime_invoke;
    const exceptionSlot = this.getExceptionSlot();
    Memory.writePointer(exceptionSlot, NULL);
    const argv = allocPointerArray(args);
    const result = invoke(method, instance ?? NULL, argv, exceptionSlot);
    const exception = Memory.readPointer(exceptionSlot);
    if (!pointerIsNull(exception)) {
      throw new MonoManagedExceptionError(exception);
    }
    return result;
  }

  getDelegateThunk(delegateClass: NativePointer): DelegateThunkInfo {
    const key = delegateClass.toString();
    const cached = this.delegateThunkCache.get(key);
    if (cached) {
      return cached;
    }
    const invoke = this.native.mono_get_delegate_invoke(delegateClass);
    if (pointerIsNull(invoke)) {
      throw new Error("Delegate invoke method not available for provided class");
    }
    const thunk = this.native.mono_method_get_unmanaged_thunk(invoke);
    if (pointerIsNull(thunk)) {
      throw new Error("mono_method_get_unmanaged_thunk returned NULL. This Mono build may not support unmanaged thunks");
    }
    const info = { invoke, thunk } as DelegateThunkInfo;
    this.delegateThunkCache.set(key, info);
    return info;
  }

  addInternalCall(name: string, callback: NativePointer): void {
    const namePtr = allocUtf8(name);
    this.native.mono_add_internal_call(namePtr, callback);
  }

  call<T = NativePointer>(name: MonoApiName, ...args: MonoArg[]): T {
    const fn = this.native[name] as (...fnArgs: MonoArg[]) => T;
    return fn(...args);
  }

  hasExport(name: MonoApiName): boolean {
    try {
      const address = this.resolveAddress(name, false);
      return !pointerIsNull(address);
    } catch (_error) {
      return false;
    }
  }

  getNativeFunction(name: MonoApiName): NativeFunction {
    let fn = this.functionCache.get(name);
    if (fn) {
      return fn;
    }
    const signature = getSignature(name);
    const address = this.resolveAddress(name, true, signature);
    fn = new NativeFunction(address, signature.retType, signature.argTypes);
    this.functionCache.set(name, fn);
    return fn;
  }

  private createNativeBindings(): MonoNativeBindings {
    const bindings: Partial<MonoNativeBindings> = {};
    const target = bindings as Record<MonoApiName, (...args: MonoArg[]) => any>;
    for (const name of ALL_MONO_EXPORTS) {
      Object.defineProperty(target, name, {
        configurable: true,
        enumerable: true,
        get: () => {
          const nativeFn = this.getNativeFunction(name);
          const wrapper = (...args: MonoArg[]) => nativeFn(...args.map(normalizeArg));
          Object.defineProperty(target, name, {
            configurable: false,
            enumerable: true,
            value: wrapper,
            writable: false,
          });
          return wrapper;
        },
      });
    }
    return target as MonoNativeBindings;
  }

  private getExceptionSlot(): NativePointer {
    if (this.exceptionSlot && !pointerIsNull(this.exceptionSlot)) {
      return this.exceptionSlot;
    }
    this.exceptionSlot = Memory.alloc(Process.pointerSize);
    return this.exceptionSlot;
  }

  private resolveAddress(
    name: MonoApiName,
    throwOnMissing: boolean,
    signature: MonoExportSignature = getSignature(name),
  ): NativePointer {
    const cached = this.addressCache.get(name);
    if (cached) {
      return cached;
    }

    const exportNames = [signature.name, ...(signature.aliases ?? [])];
    for (const exportName of exportNames) {
      const address = Module.findExportByName(this.module.name, exportName);
      if (address) {
        this.addressCache.set(name, address);
        return address;
      }
    }

    const nearMatch = this.findNearExport(signature.name);
    if (nearMatch) {
      this.addressCache.set(name, nearMatch);
      return nearMatch;
    }

    if (throwOnMissing) {
      throw new MonoFunctionResolutionError(
        signature.name,
        `Unable to resolve Mono export ${signature.name} in ${this.module.name}. Consider providing an alias or enabling probing tools.`,
      );
    }

    return NULL;
  }

  private findNearExport(exportName: string): NativePointer | null {
    try {
      const exports = Module.enumerateExportsSync(this.module.name);
      const canonical = normalizeExportName(exportName);
      for (const item of exports) {
        if (normalizeExportName(item.name) === canonical) {
          return item.address;
        }
      }
      const fuzzy = exports.find((exp) => exp.name.includes(exportName));
      return fuzzy ? fuzzy.address : null;
    } catch (_error) {
      return null;
    }
  }
}

function normalizeArg(arg: MonoArg): any {
  if (arg === null || arg === undefined) {
    return NULL;
  }
  return arg;
}

function normalizeExportName(name: string): string {
  return name.replace(/[_-]/g, "").toLowerCase();
}

export function createMonoApi(module: MonoModuleInfo): MonoApi {
  return new MonoApi(module);
}

export const ALL_MONO_EXPORTS = Object.keys(MONO_EXPORTS) as MonoApiName[];

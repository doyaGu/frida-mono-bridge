type NativePointer = any;
type UInt64 = any;

interface NativeFunction<R = any, A extends any[] = any[]> {
  (...args: A): R;
}

declare const NativeFunction: {
  new <R = any, A extends any[] = any[]>(address: NativePointer, returnType: string, argumentTypes: string[], options?: any): NativeFunction<R, A>;
};

declare class NativeCallback<F extends Function = (...args: any[]) => any> {
  constructor(retType: string, argTypes: string[], options: any, implementation: F);
}

declare namespace Module {
  function findBaseAddress(name: string): NativePointer | null;
  function findExportByName(moduleName: string | null, exportName: string): NativePointer | null;
  function enumerateExportsSync(name: string): Array<{ type: string; name: string; address: NativePointer }>;
  function enumerateModulesSync(): Array<{
    name: string;
    base: NativePointer;
    size: number;
    path: string;
  }>;
}

declare namespace Process {
  const pointerSize: number;
  function getCurrentThreadId(): number;
  function enumerateModules(): Array<{
    name: string;
    base: NativePointer;
    size: number;
    path: string;
  }>;
}

declare namespace Memory {
  function alloc(size: number): NativePointer;
  function allocUtf8String(value: string): NativePointer;
  function writePointer(address: NativePointer, value: NativePointer): void;
  function writeUtf8String(address: NativePointer, value: string): void;
  function readUtf8String(address: NativePointer): string | null;
  function readPointer(address: NativePointer): NativePointer;
  function dup(address: NativePointer, size: number): NativePointer;
}

declare const NULL: NativePointer;

declare const ptr: (address: string | number) => NativePointer;

declare const Mono: any;

declare interface InvocationContext {
  threadId: number;
  context: Record<string, NativePointer>;
  returnAddress: NativePointer;
}

declare const Polyfill: any;

declare const rpc: any;

declare namespace Interceptor {
  function attach(target: NativePointer, callbacks: { onEnter?: (args: NativePointer[]) => void; onLeave?: (retval: NativePointer) => void; }): void;
  function detachAll(): void;
}

declare const console: {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

type NativePointer = any;
type UInt64 = any;

interface NativeFunction<R = any, A extends any[] = any[]> {
  (...args: A): R;
}

declare const NativeFunction: {
  new <R = any, A extends any[] = any[]>(address: NativePointer, returnType: string, argumentTypes: string[], options?: any): NativeFunction<R, A>;
};

declare class NativeCallback<F extends Function = (...args: any[]) => any> {
  constructor(implementation: F, retType: string, argTypes: string[], abi?: any);
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
  function readU8(address: NativePointer): number;
  function readS8(address: NativePointer): number;
  function readU16(address: NativePointer): number;
  function readS16(address: NativePointer): number;
  function readU32(address: NativePointer): number;
  function readS32(address: NativePointer): number;
  function readU64(address: NativePointer): UInt64;
  function readS64(address: NativePointer): UInt64;
  function readFloat(address: NativePointer): number;
  function readDouble(address: NativePointer): number;
  function writeU8(address: NativePointer, value: number): void;
  function writeS8(address: NativePointer, value: number): void;
  function writeU16(address: NativePointer, value: number): void;
  function writeS16(address: NativePointer, value: number): void;
  function writeU32(address: NativePointer, value: number): void;
  function writeS32(address: NativePointer, value: number): void;
  function writeU64(address: NativePointer, value: UInt64 | number): void;
  function writeS64(address: NativePointer, value: UInt64 | number): void;
  function writeFloat(address: NativePointer, value: number): void;
  function writeDouble(address: NativePointer, value: number): void;
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

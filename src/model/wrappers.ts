import type { MonoApi } from "../runtime/api";

export type MonoWrapperCtor = new (api: MonoApi, ptr: NativePointer) => object;

const wrappers = {
  array: null as MonoWrapperCtor | null,
  delegate: null as MonoWrapperCtor | null,
};

export function registerArrayWrapper(ctor: MonoWrapperCtor): void {
  wrappers.array = ctor;
}

export function registerDelegateWrapper(ctor: MonoWrapperCtor): void {
  wrappers.delegate = ctor;
}

export function getArrayWrapper(): MonoWrapperCtor | null {
  return wrappers.array;
}

export function getDelegateWrapper(): MonoWrapperCtor | null {
  return wrappers.delegate;
}

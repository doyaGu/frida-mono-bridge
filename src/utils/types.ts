import { MonoObject } from "../model/object";

export type MonoPointer = NativePointer;
export type MonoStringLike = string | MonoObject | null | undefined;

export function isMonoObject(value: unknown): value is MonoObject {
  return value instanceof MonoObject;
}

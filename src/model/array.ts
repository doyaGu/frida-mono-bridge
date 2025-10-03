import { MonoApi } from "../runtime/api";
import { MonoArray as MonoArrayModel } from "./object";
import { MonoKlass } from "./klass";

export { MonoArrayModel as MonoArray };

export function createMonoArray(api: MonoApi, elementClass: MonoKlass, length: number): MonoArrayModel {
  const domain = api.getRootDomain();
  const arrayPtr = api.native.mono_array_new(domain, elementClass.pointer, length);
  return new MonoArrayModel(api, arrayPtr);
}

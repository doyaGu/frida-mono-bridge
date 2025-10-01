import { MonoApi } from "../runtime/api";
import { MonoString as MonoStringModel } from "./object";

export { MonoStringModel as MonoString };

export function createMonoString(api: MonoApi, value: string): MonoStringModel {
  const pointer = api.stringNew(value);
  return new MonoStringModel(api, pointer);
}

import type { MonoApi } from "../runtime/api";

import { MonoArray } from "./array";
import { MonoObject } from "./object";

/**
 * Internal helpers for populating managed arrays.
 *
 * This is intentionally not exported from the package entrypoint; it's a shared
 * implementation used by multiple model helpers to avoid duplicating
 * write-barrier and JS-to-managed element conversion logic.
 */

export function setMonoArrayElementFromJs(
  api: MonoApi,
  monoArray: MonoArray<unknown>,
  index: number,
  item: unknown,
): void {
  if (monoArray.elementClass.isValueType) {
    if (typeof item === "bigint") {
      try {
        monoArray.setBigInt(index, item);
        return;
      } catch {
        // Fall back to number below.
      }
    }

    monoArray.setNumber(index, Number(item));
    return;
  }

  // Reference-type array.
  if (item === null || item === undefined) {
    monoArray.setReference(index, NULL);
    return;
  }

  if (item instanceof MonoObject) {
    monoArray.setReference(index, item.pointer);
    return;
  }

  if (item instanceof NativePointer) {
    monoArray.setReference(index, item);
    return;
  }

  if (typeof item === "string") {
    monoArray.setReference(index, api.stringNew(item));
    return;
  }

  // Best-effort: allow passing raw pointers.
  monoArray.setReference(index, item as NativePointer);
}

export function fillMonoArrayFromJs(api: MonoApi, monoArray: MonoArray<unknown>, items: unknown[]): void {
  for (let index = 0; index < items.length; index += 1) {
    setMonoArrayElementFromJs(api, monoArray, index, items[index]);
  }
}

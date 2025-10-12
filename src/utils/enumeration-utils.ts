/**
 * Enumeration utilities for Mono collections
 * Implements iterator patterns for methods, fields, properties, assemblies, etc.
 * Extracted from common-utilities.ts for better organization
 */

import { MonoApi } from "../runtime/api";
import { pointerIsNull } from "./pointer-utils";

declare const NativePointer: any;
declare const Memory: any;
declare const Process: any;
declare const ptr: any;

/**
 * Generic function to enumerate Mono handles using iterator pattern
 * Used for methods, fields, properties, etc.
 *
 * @param fetch - Function that takes an iterator pointer and returns the next handle
 * @param factory - Function to convert handle pointer to typed object
 * @returns Array of enumerated objects
 *
 * @example
 * enumerateHandles(
 *   (iter) => api.native.mono_class_get_methods(classPtr, iter),
 *   (ptr) => new MonoMethod(api, ptr)
 * )
 */
export function enumerateHandles<T>(
  fetch: (iter: NativePointer) => NativePointer,
  factory: (ptr: NativePointer) => T
): T[] {
  const iterator = Memory.alloc(Process.pointerSize);
  iterator.writePointer(ptr(0));
  const results: T[] = [];

  try {
    while (true) {
      const handle = fetch(iterator);
      if (pointerIsNull(handle)) {
        break;
      }
      results.push(factory(handle));
    }
  } catch (error) {
    // If enumeration fails partway through, return what we got
  }

  return results;
}

/**
 * Enumerate assemblies in a domain using the Mono iterator pattern
 *
 * @param api - MonoApi instance
 * @param domainPtr - Pointer to MonoDomain
 * @param factory - Function to convert assembly pointer to typed object
 * @returns Array of enumerated assemblies
 */
export function enumerateAssemblies(
  api: MonoApi,
  domainPtr: NativePointer,
  factory: (ptr: NativePointer) => any
): any[] {
  const iterator = Memory.alloc(Process.pointerSize);
  iterator.writePointer(ptr(0));
  const results: any[] = [];

  try {
    while (true) {
      const assemblyPtr = api.native.mono_domain_assembly_open(domainPtr, iterator);
      if (iterator.readPointer().isNull()) {
        break;
      }
      if (!pointerIsNull(assemblyPtr)) {
        results.push(factory(assemblyPtr));
      }
    }
  } catch (error) {
    // Return partial results if enumeration fails
  }

  return results;
}

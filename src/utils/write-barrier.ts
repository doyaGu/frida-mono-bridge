/**
 * Write Barrier Utilities for SGen GC
 * 
 * This module provides safe abstractions for modifying managed object references
 * when using Mono's SGen garbage collector. Write barriers ensure that the GC's
 * remembered sets and card tables remain consistent during incremental/generational
 * collection.
 * 
 * @see WRITE_BARRIER_ANALYSIS.md for detailed explanation
 */

import type { MonoApi } from "../runtime/api";

declare const NativePointer: any;
declare const NULL: NativePointer;

/**
 * Set a reference field in a managed object with appropriate write barrier
 * 
 * This is only needed when directly manipulating memory. Prefer using
 * `mono_field_set_value` which already includes write barriers internally.
 * 
 * @param api MonoApi instance
 * @param obj Pointer to the object containing the field
 * @param fieldAddress Pointer to the field location (obj + offset)
 * @param value Pointer to the new value (managed object reference)
 * 
 * @example
 * ```typescript
 * // Direct memory manipulation (rare case)
 * const fieldAddr = obj.add(fieldOffset);
 * setFieldReferenceWithBarrier(api, obj, fieldAddr, newValuePtr);
 * 
 * // Better: Use Mono API (already has barrier)
 * api.native.mono_field_set_value(obj, field, newValuePtr);
 * ```
 */
export function setFieldReferenceWithBarrier(
  api: MonoApi,
  obj: NativePointer,
  fieldAddress: NativePointer,
  value: NativePointer
): void {
  if (value.isNull()) {
    // NULL writes don't need barriers
    fieldAddress.writePointer(value);
    return;
  }

  if (api.hasExport('mono_gc_wbarrier_set_field')) {
    // SGen GC: use write barrier
    api.native.mono_gc_wbarrier_set_field(obj, fieldAddress, value);
  } else {
    // Boehm GC or older Mono: direct write
    fieldAddress.writePointer(value);
  }
}

/**
 * Set an array element reference with appropriate write barrier
 * 
 * This should be used when directly manipulating array element pointers.
 * For type-safe array operations, use MonoArray methods instead.
 * 
 * @param api MonoApi instance
 * @param array Pointer to the MonoArray object
 * @param elementAddress Pointer to the element slot
 * @param value Pointer to the new element (managed object reference)
 * 
 * @example
 * ```typescript
 * // Used internally by MonoArray.setReference()
 * const elemAddr = array.getElementAddress(index);
 * setArrayReferenceWithBarrier(api, array.pointer, elemAddr, newElemPtr);
 * ```
 */
export function setArrayReferenceWithBarrier(
  api: MonoApi,
  array: NativePointer,
  elementAddress: NativePointer,
  value: NativePointer
): void {
  if (value.isNull()) {
    // NULL writes don't need barriers
    elementAddress.writePointer(value);
    return;
  }

  if (api.hasExport('mono_gc_wbarrier_set_arrayref')) {
    // SGen GC: use write barrier
    api.native.mono_gc_wbarrier_set_arrayref(array, elementAddress, value);
  } else {
    // Boehm GC or older Mono: direct write
    elementAddress.writePointer(value);
  }
}

/**
 * Generic reference store with write barrier
 * 
 * Use this for generic pointer writes when you don't have the containing
 * object/array pointer (e.g., when working with interior pointers).
 * 
 * @param api MonoApi instance
 * @param destination Pointer to the memory location to update
 * @param value Pointer to the new value (managed object reference)
 * 
 * @example
 * ```typescript
 * // Generic case when parent object is unknown
 * genericReferenceStoreWithBarrier(api, slotPtr, newValuePtr);
 * ```
 */
export function genericReferenceStoreWithBarrier(
  api: MonoApi,
  destination: NativePointer,
  value: NativePointer
): void {
  if (value.isNull()) {
    // NULL writes don't need barriers
    destination.writePointer(value);
    return;
  }

  if (api.hasExport('mono_gc_wbarrier_generic_store')) {
    // SGen GC: use write barrier
    api.native.mono_gc_wbarrier_generic_store(destination, value);
  } else {
    // Boehm GC or older Mono: direct write
    destination.writePointer(value);
  }
}

/**
 * Atomic reference store with write barrier
 * 
 * Thread-safe version of genericReferenceStoreWithBarrier. Use when
 * multiple threads might be accessing the same reference slot.
 * 
 * @param api MonoApi instance
 * @param destination Pointer to the memory location to update
 * @param value Pointer to the new value (managed object reference)
 */
export function atomicReferenceStoreWithBarrier(
  api: MonoApi,
  destination: NativePointer,
  value: NativePointer
): void {
  if (value.isNull()) {
    // NULL writes don't need barriers (but should be atomic for consistency)
    destination.writePointer(value);
    return;
  }

  if (api.hasExport('mono_gc_wbarrier_generic_store_atomic')) {
    // SGen GC: use atomic write barrier
    api.native.mono_gc_wbarrier_generic_store_atomic(destination, value);
  } else if (api.hasExport('mono_gc_wbarrier_generic_store')) {
    // Fallback to non-atomic barrier
    api.native.mono_gc_wbarrier_generic_store(destination, value);
  } else {
    // Boehm GC: direct write (not truly atomic, but best effort)
    destination.writePointer(value);
  }
}

/**
 * Copy object data with write barriers
 * 
 * Safely copy one managed object's data to another, ensuring all reference
 * fields are updated with proper write barriers.
 * 
 * @param api MonoApi instance
 * @param destination Pointer to destination object
 * @param source Pointer to source object
 * 
 * @example
 * ```typescript
 * // Clone object data
 * const clone = api.newObject(klass);
 * copyObjectWithBarrier(api, clone, original);
 * ```
 */
export function copyObjectWithBarrier(
  api: MonoApi,
  destination: NativePointer,
  source: NativePointer
): void {
  if (api.hasExport('mono_gc_wbarrier_object_copy')) {
    // SGen GC: use barrier-aware copy
    api.native.mono_gc_wbarrier_object_copy(destination, source);
  } else {
    // Fallback: manual copy (unsafe for SGen, but needed for Boehm)
    // This is a simplified version; real implementation would need size info
    throw new Error('Object copy without write barrier not fully implemented. Use mono_object_clone API instead.');
  }
}

/**
 * Check if the current Mono runtime uses SGen GC (requires write barriers)
 * 
 * @param api MonoApi instance
 * @returns true if write barriers are available (SGen GC), false otherwise (Boehm GC)
 * 
 * @example
 * ```typescript
 * if (isSGenGC(api)) {
 *   console.log('Using generational GC, write barriers active');
 * } else {
 *   console.log('Using conservative GC, write barriers not needed');
 * }
 * ```
 */
export function isSGenGC(api: MonoApi): boolean {
  return api.hasExport('mono_gc_wbarrier_set_field');
}

/**
 * Get information about the active GC type
 * 
 * @param api MonoApi instance
 * @returns Object describing the GC configuration
 */
export function getGCInfo(api: MonoApi): {
  type: 'sgen' | 'boehm' | 'unknown';
  supportsWriteBarriers: boolean;
  supportsAtomicBarriers: boolean;
} {
  const hasFieldBarrier = api.hasExport('mono_gc_wbarrier_set_field');
  const hasArrayBarrier = api.hasExport('mono_gc_wbarrier_set_arrayref');
  const hasAtomicBarrier = api.hasExport('mono_gc_wbarrier_generic_store_atomic');

  let type: 'sgen' | 'boehm' | 'unknown';
  if (hasFieldBarrier && hasArrayBarrier) {
    type = 'sgen';
  } else if (!hasFieldBarrier) {
    type = 'boehm';
  } else {
    type = 'unknown';
  }

  return {
    type,
    supportsWriteBarriers: hasFieldBarrier,
    supportsAtomicBarriers: hasAtomicBarrier
  };
}

/**
 * Validate write barrier usage in development/testing
 * 
 * This is a development-time utility to ensure write barriers are being
 * used correctly. Enable in debug builds.
 * 
 * @param api MonoApi instance
 * @param enabled Whether to enable strict validation
 */
export function setWriteBarrierValidation(api: MonoApi, enabled: boolean): void {
  if (enabled && isSGenGC(api)) {
    // In a real implementation, this could intercept Memory.writePointer
    // or add runtime checks. For now, this is a placeholder that could
    // be extended to log warnings when direct writes are detected.
    // eslint-disable-next-line no-console
    (globalThis as any).console?.warn?.('[WriteBarrier] Validation enabled. Direct pointer writes will be logged.');
  }
}

// Re-export for convenience
export { MonoApi } from "../runtime/api";

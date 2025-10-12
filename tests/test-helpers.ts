/**
 * Shared test helpers and utilities
 * Consolidates repeated patterns from test files to follow DRY principles
 */

import Mono from "../src";
import { MonoImage } from "../src/model/image";
import { MonoApi } from "../src/runtime/api";

declare const NativePointer: any;
declare const Memory: any;

/**
 * Core library image management
 */
export const CORELIB_CANDIDATES = ["mscorlib", "System.Private.CoreLib", "netstandard"];
let cachedCorlibImage: MonoImage | null = null;

/**
 * Get the core library image (mscorlib, System.Private.CoreLib, or netstandard)
 * Uses caching to avoid repeated lookups
 */
export function getCorlibImage(): MonoImage {
  if (cachedCorlibImage) {
    return cachedCorlibImage;
  }

  return Mono.perform(() => {
    const domain = Mono.domain;

    // Try domain.assembly first (cleaner API)
    for (const name of CORELIB_CANDIDATES) {
      const assembly = domain.assembly(name);
      if (assembly) {
        cachedCorlibImage = assembly.image;
        return cachedCorlibImage;
      }
    }

    // Fallback: Try mono_image_loaded API
    for (const name of CORELIB_CANDIDATES) {
      const namePtr = Memory.allocUtf8String(name);
      const imagePtr = Mono.api.native.mono_image_loaded(namePtr);
      if (!imagePtr.isNull()) {
        cachedCorlibImage = new MonoImage(Mono.api, imagePtr);
        return cachedCorlibImage;
      }
    }

    throw new Error(`Unable to locate core library image (tried: ${CORELIB_CANDIDATES.join(", ")})`);
  });
}

/**
 * Reset cached corlib image (useful for test isolation)
 */
export function resetCorlibCache(): void {
  cachedCorlibImage = null;
}

/**
 * String conversion utilities for tests
 */
let cachedStringToUtf8: ((input: NativePointer) => NativePointer) | null = null;

/**
 * Get mono_string_to_utf8 function with caching
 */
export function getStringToUtf8(): (input: NativePointer) => NativePointer {
  if (cachedStringToUtf8) {
    return cachedStringToUtf8;
  }

  if (Mono.api.hasExport("mono_string_to_utf8")) {
    cachedStringToUtf8 = Mono.api.native.mono_string_to_utf8 as (input: NativePointer) => NativePointer;
    return cachedStringToUtf8;
  }

  throw new Error("mono_string_to_utf8 export not available on this Mono runtime");
}

/**
 * Read a managed string pointer and convert to JavaScript string
 */
export function readManagedString(pointer: NativePointer): string {
  if (pointer.isNull()) {
    return "";
  }
  return Mono.perform(() => {
    const toUtf8 = getStringToUtf8();
    const utf8Ptr = toUtf8(pointer);
    if (utf8Ptr.isNull()) {
      return "";
    }
    try {
      return utf8Ptr.readUtf8String() ?? "";
    } finally {
      Mono.api.native.mono_free(utf8Ptr);
    }
  });
}

/**
 * Read a managed boolean value (boxed)
 */
export function readManagedBool(pointer: NativePointer): boolean {
  if (pointer.isNull()) {
    throw new Error("Expected boxed boolean value but received NULL pointer");
  }
  return Mono.perform(() => {
    const unboxed = Mono.api.native.mono_object_unbox(pointer);
    return unboxed.readU8() !== 0;
  });
}

/**
 * Read a managed integer value (boxed)
 */
export function readManagedInt(pointer: NativePointer): number {
  if (pointer.isNull()) {
    throw new Error("Expected boxed integer value but received NULL pointer");
  }
  return Mono.perform(() => {
    const unboxed = Mono.api.native.mono_object_unbox(pointer);
    return unboxed.readS32();
  });
}

/**
 * Reset string conversion cache
 */
export function resetStringCache(): void {
  cachedStringToUtf8 = null;
}

/**
 * Assembly validation helpers
 */
export interface AssemblyValidationOptions {
  maxAssemblies?: number;
  validateClasses?: boolean;
  validateImageName?: boolean;
  customValidation?: (assembly: any, image: any) => void;
}

/**
 * Validate assemblies with common checks
 */
export function validateAssemblies(
  assemblies: any[],
  options: AssemblyValidationOptions = {}
): void {
  const { maxAssemblies = 3, validateClasses = true, validateImageName = false } = options;

  if (!Array.isArray(assemblies)) {
    throw new Error("Assemblies should be an array");
  }

  if (assemblies.length === 0) {
    throw new Error("Should have at least one assembly");
  }

  console.log(`    Found ${assemblies.length} total assemblies`);

  for (let i = 0; i < Math.min(maxAssemblies, assemblies.length); i++) {
    const assembly = assemblies[i];
    const name = assembly.getName();
    const image = assembly.image;

    if (typeof name !== "string" || name.length === 0) {
      throw new Error("Assembly name should be a non-empty string");
    }

    if (image === null) {
      throw new Error("Assembly should have an image");
    }

    if (validateClasses) {
      const classes = image.getClasses();
      console.log(`    ${name}: ${classes.length} classes`);
    }

    if (validateImageName) {
      const imageName = image.getName();
      if (imageName) {
        if (typeof imageName !== "string") {
          throw new Error("Image name should be a string");
        }
        console.log(`    Validated ${name} -> ${imageName}`);
      }
    }

    options.customValidation?.(assembly, image);
  }
}

/**
 * Test execution utilities
 */

/**
 * Execute a test function with proper error handling
 */
export function safeExecute(fn: () => void, context?: string): { success: boolean; error?: Error } {
  try {
    fn();
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (context) {
      console.error(`    Error in ${context}: ${err.message}`);
    }
    return { success: false, error: err };
  }
}

/**
 * Execute a test that requires Mono.perform wrapper
 */
export function executeMonoTest(fn: () => void, context?: string): { success: boolean; error?: Error } {
  return safeExecute(() => {
    Mono.perform(fn);
  }, context);
}

/**
 * Class discovery helpers
 */

/**
 * Find a class by name with fallback options
 */
export function findClass(className: string, options?: { throwOnError?: boolean }): any | null {
  return Mono.perform(() => {
    const domain = Mono.domain;
    const cls = domain.class(className);

    if (!cls && options?.throwOnError) {
      throw new Error(`Class ${className} not found`);
    }

    return cls;
  });
}

/**
 * Validate that a class has expected structure
 */
export function validateClass(cls: any, options?: { requireMethods?: boolean; requireFields?: boolean }): void {
  if (typeof cls.getName !== 'function') {
    throw new Error("Class should have getName method");
  }

  const name = cls.getName();
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error("Class name should be a non-empty string");
  }

  if (options?.requireMethods) {
    if (typeof cls.getMethods !== 'function') {
      throw new Error("Class should have getMethods method");
    }
    const methods = cls.getMethods();
    if (!Array.isArray(methods)) {
      throw new Error("getMethods should return an array");
    }
  }

  if (options?.requireFields) {
    if (typeof cls.getFields !== 'function') {
      throw new Error("Class should have getFields method");
    }
    const fields = cls.getFields();
    if (!Array.isArray(fields)) {
      throw new Error("getFields should return an array");
    }
  }
}

/**
 * Feature detection helpers
 */

/**
 * Check if a Mono feature is available
 */
export function hasFeature(featureName: keyof typeof Mono.version.features): boolean {
  return Mono.version.features[featureName] === true;
}

/**
 * Skip test if feature is not available
 */
export function requireFeature(
  featureName: keyof typeof Mono.version.features,
  testName: string
): boolean {
  if (!hasFeature(featureName)) {
    console.log(`    âŠ?Skipping ${testName}: ${featureName} not supported`);
    return false;
  }
  return true;
}

/**
 * Memory helpers
 */

/**
 * Allocate and write a managed string
 */
export function allocateManagedString(value: string): NativePointer {
  return Mono.perform(() => {
    return Mono.api.stringNew(value);
  });
}

/**
 * Check if pointer is null or zero
 */
export function isNullPointer(ptr: NativePointer): boolean {
  return ptr === null || ptr.isNull();
}

/**
 * frida-mono-bridge - Main entry point
 *
 * Root entry only exports `Mono` (default + named)
 * plus essential types (errors/config).
 *
 * All runtime access goes through the Mono facade:
 * - `Mono.domain` - domain/assembly/class navigation
 * - `Mono.gc` - garbage collection utilities
 * - `Mono.find` - search utilities
 * - `Mono.trace` - method hooking
 *
 * @example
 * import Mono from "frida-mono-bridge";
 *
 * await Mono.perform(() => {
 *   const domain = Mono.domain;
 *   domain.assemblies.forEach(a => console.log(a.name));
 * });
 */

// Import the main Mono facade
import { Mono, MonoNamespace } from "./mono";

// ============================================================================
// PRIMARY EXPORTS
// ============================================================================

// Named and default export of the facade
export { Mono };
export default Mono;

// NOTE: `globalThis.Mono` installation is handled lazily by the Mono facade
// (during `Mono.initialize()`/`Mono.perform()`) so `Mono.config.installGlobal`
// can be configured before first use.

// ============================================================================
// ERROR TYPES (needed for catch blocks)
// ============================================================================

export {
  // Error Result utilities
  asResult,
  MonoAssemblyNotFoundError,
  MonoClassNotFoundError,
  // Base error class
  MonoError,
  // Error codes enum
  MonoErrorCodes,
  monoErrorResult,
  MonoExportNotFoundError,
  MonoFieldNotFoundError,
  MonoImageNotFoundError,
  monoInvariant,
  // Managed exception error for catch blocks
  MonoManagedExceptionError,
  MonoMemoryError,
  MonoMethodNotFoundError,
  // Specific error classes for typed catch
  MonoModuleNotFoundError,
  MonoPropertyNotFoundError,
  MonoRuntimeNotReadyError,
  monoSuccess,
  MonoThreadError,
  MonoValidationError,
  // Error generation utilities
  raise,
  raiseUnless,
  ValidationBuilder,
  withErrorHandling,
} from "./utils/errors";

// ============================================================================
// UTILITY EXPORTS (commonly needed in tests and scripts)
// ============================================================================

// Memory utilities
export {
  allocPointerArray,
  ensurePointer,
  enumerateMonoHandles,
  isNativePointer,
  isValidPointer,
  pointerIsNull,
  resolveNativePointer,
  safeAlloc,
  tryMakePointer,
  unwrapInstance,
  unwrapInstanceRequired,
} from "./utils/memory";

// String utilities
export {
  createError,
  createTimer,
  PerformanceTimer,
  readMonoString,
  readUtf16String,
  readUtf8String,
  safeStringify,
} from "./utils/string";

// Cache utilities
export { lazy, LruCache } from "./utils/cache";

// Logger
export { Logger } from "./utils/log";

// ============================================================================
// RUNTIME CONSTANTS (enums and defines)
// ============================================================================

export { MonoDefines, MonoEnums } from "./runtime/enums";

// ============================================================================
// TYPE CONSTANTS
// ============================================================================

export { MonoTypeKind, MonoTypeNameFormat } from "./model/type";

// ============================================================================
// GC TYPES (for advanced GC handle management)
// ============================================================================

export { GCHandle, GCHandlePool } from "./runtime/gchandle";
export { createGCUtilities, GCUtilities } from "./utils/gc";
export type { GenerationStats, MemoryStats } from "./utils/gc";

// ============================================================================
// TRACE TYPES (for method hooking callbacks)
// ============================================================================

export type { FindOptions } from "./utils/find";
export type {
  FieldAccessCallbacks,
  MethodCallbacks,
  MethodCallbacksExtended,
  MethodCallbacksTimed,
  MethodStats,
  PerformanceTracker,
  PropertyAccessCallbacks,
} from "./utils/trace";

// ============================================================================
// TYPE-ONLY EXPORTS (for type annotations, not runtime values)
// ============================================================================

// Re-export namespace types for IDE discoverability
export type { MonoNamespace };

// Handle/model types - exported as types only (values accessed via Mono.domain)
export type { MonoArray } from "./model/array";
export type { MonoAssembly } from "./model/assembly";
export type { MonoClass } from "./model/class";
export type { MonoDomain } from "./model/domain";
export type { MonoField } from "./model/field";
export type { MonoImage } from "./model/image";
export type { MonoMethod } from "./model/method";
// MonoObject exported as value for boxing/wrapping scenarios
export type { CustomAttribute } from "./model/base";
export { MonoObject } from "./model/object";
export type { MonoProperty } from "./model/property";
export type { MonoString } from "./model/string";
export type { MonoType } from "./model/type";

// Runtime types - type-only export
export type { MonoApi } from "./runtime/api";

/**
 * frida-mono-bridge - Main entry point
 *
 * Root entry only exports `Mono` (default + named)
 * plus essential types (errors/config).
 *
 * All runtime access goes through the Mono facade:
 * - `Mono.domain` - domain/assembly/class navigation
 * - `Mono.gc` - garbage collection utilities
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
import { Mono } from "./mono";
import { MonoArray } from "./model/array";
import { MonoDelegate } from "./model/delegate";
import { registerArrayWrapper, registerDelegateWrapper } from "./model/wrappers";

// ============================================================================
// PRIMARY EXPORTS
// ============================================================================

// Named and default export of the facade
export { Mono };
export default Mono;

registerArrayWrapper(MonoArray);
registerDelegateWrapper(MonoDelegate);

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
// POWER-USER EXPORTS (runtime/model/utils)
// ============================================================================

// Runtime layer (low-level API + module/thread helpers)
export { createMonoApi, MonoApi } from "./runtime/api";
export { tryWaitForMonoModule, waitForMonoModule } from "./runtime/module";
export { ThreadManager } from "./runtime/thread";
export { MonoRuntimeVersion } from "./runtime/version";

// Model layer (high-level object model)
export { MonoArray } from "./model/array";
export { MonoAssembly } from "./model/assembly";
export { MonoClass } from "./model/class";
export { MonoDelegate } from "./model/delegate";
export { MonoDomain } from "./model/domain";
export { MonoField } from "./model/field";
export { GarbageCollector } from "./model/gc";
export { MonoImage } from "./model/image";
export { MonoMethod } from "./model/method";
export { MonoObject } from "./model/object";
export { MonoProperty } from "./model/property";
export { MonoString } from "./model/string";
export { Tracer } from "./model/trace";
export { MonoType } from "./model/type";

// Utils (logging + caching are commonly used standalone)
export { lazy, LruCache, memoize } from "./utils/cache";
export { Logger } from "./utils/log";

// Value conversion helpers (used by properties/methods; handy standalone)
export {
  allocPrimitiveValue,
  convertJsToMono,
  convertMonoToJs,
  resolveInstance,
  resolveUnderlyingPrimitive,
  unboxValue,
  validateNumericValue,
} from "./runtime/value-conversion";
export type { ConversionOptions, MonoValueWrappers } from "./runtime/value-conversion";

// ============================================================================
// TRACE TYPES (for method hooking callbacks)
// ============================================================================

// NOTE: Consumers often need access to the full type surface area of the
// runtime/model layers for typings (without pulling in runtime modules).
// These are type-only re-exports and do not change runtime behavior.
export type * from "./model";
export type * from "./runtime";
export type * from "./types";

// ============================================================================
// FACADE TYPES
// ============================================================================

// Allow creating additional namespaces (advanced use-cases / multi-runtime workflows)
export { MonoNamespace } from "./mono";

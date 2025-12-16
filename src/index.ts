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
// TRACE TYPES (for method hooking callbacks)
// ============================================================================

export type { FindOptions } from "./model/domain";
export type {
  FieldAccessCallbacks,
  MethodCallbacks,
  MethodCallbacksExtended,
  MethodCallbacksTimed,
  MethodStats,
  PerformanceTracker,
  PropertyAccessCallbacks,
} from "./model/trace";

// ============================================================================
// FACADE TYPES
// ============================================================================

// Re-export namespace types for IDE discoverability
export type { MonoNamespace };

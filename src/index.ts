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

// Install global if config allows (default: true)
// This respects Mono.config.installGlobal which defaults to true
if (Mono.config.installGlobal !== false) {
  (globalThis as any).Mono = Mono;
}

// ============================================================================
// ERROR TYPES (needed for catch blocks)
// ============================================================================

export {
  MonoAssemblyNotFoundError,
  MonoClassNotFoundError,
  // Base error class
  MonoError,
  // Error codes enum
  MonoErrorCodes,
  MonoExportNotFoundError,
  MonoFieldNotFoundError,
  MonoImageNotFoundError,
  MonoMethodNotFoundError,
  // Specific error classes for typed catch
  MonoModuleNotFoundError,
  MonoPropertyNotFoundError,
  MonoRuntimeNotReadyError,
  MonoThreadError,
  MonoValidationError,
} from "./utils/errors";

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
export type { MonoObject } from "./model/object";
export type { MonoProperty } from "./model/property";
export type { MonoString } from "./model/string";

// Runtime types - type-only export
export type { MonoApi } from "./runtime/api";

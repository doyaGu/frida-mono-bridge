/**
 * Internal Call Registration - High-level abstraction for registering native functions
 * callable from managed code.
 *
 * This module provides a model-layer abstraction over the low-level runtime internal
 * call registration, with proper lifecycle management, duplicate handling, and
 * NativeCallback keep-alive to prevent GC issues.
 *
 * @module model/internal-call
 */

import { MonoApi } from "../runtime/api";
import { MonoRuntimeVersion } from "../runtime/version";
import { MonoErrorCodes, raise } from "../utils/errors";
import { isNativePointer, pointerIsNull, resolveNativePointer } from "../utils/memory";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Callback type that can be registered as an internal call.
 * Accepts both raw NativePointer and NativeCallback objects.
 */
export type InternalCallCallback = NativePointer | NativeCallback<any, any>;

/**
 * Policy for handling duplicate registrations of the same method name.
 */
export enum DuplicatePolicy {
  /** Throw an error if the name is already registered with a different pointer (default) */
  Throw = "throw",
  /** Skip registration silently if the name is already registered */
  Skip = "skip",
  /** Overwrite the existing registration with the new callback */
  Overwrite = "overwrite",
}

/**
 * Definition of an internal call to be registered.
 */
export interface InternalCallDefinition {
  /**
   * Fully qualified method name.
   * Format: "Namespace.Class::MethodName" or "Namespace.Class/NestedClass::MethodName"
   *
   * @example "UnityEngine.Object::Internal_Instantiate"
   * @example "System.Runtime.CompilerServices.RuntimeHelpers::InitializeArray"
   */
  name: string;

  /**
   * Native callback function pointer.
   * Can be a NativePointer or NativeCallback.
   *
   * When providing a NativeCallback, consider using `keepAlive: true` (default)
   * to prevent the callback from being garbage collected while Mono holds the pointer.
   */
  callback: InternalCallCallback;

  /**
   * Whether to keep a strong reference to prevent garbage collection.
   * Defaults to `true` when callback is a NativeCallback to prevent crashes.
   *
   * Set to `false` only if you are managing the callback lifetime externally.
   */
  keepAlive?: boolean;
}

/**
 * Options for internal call registration.
 */
export interface InternalCallRegistrationOptions {
  /**
   * Policy for handling duplicate registrations.
   * @default DuplicatePolicy.Throw
   */
  duplicatePolicy?: DuplicatePolicy;

  /**
   * Whether to validate the callback pointer before registration.
   * @default true
   */
  validateCallback?: boolean;
}

/**
 * Information about a registered internal call.
 */
export interface InternalCallRegistrationInfo {
  /** Fully qualified method name */
  name: string;

  /** Native function pointer */
  callbackPtr: NativePointer;

  /** Registration timestamp (Unix epoch ms) */
  registeredAt: number;

  /** Whether this registration is keeping the callback alive */
  keepAlive: boolean;
}

/**
 * Summary of internal call registrar state.
 */
export interface InternalCallRegistrarSummary {
  /** Number of registered internal calls */
  count: number;

  /** Whether internal call feature is supported by the runtime */
  supported: boolean;

  /** List of registered method names */
  names: string[];
}

// ============================================================================
// INTERNAL CALL REGISTRAR
// ============================================================================

/**
 * High-level registrar for internal calls (native functions callable from managed code).
 *
 * This class provides a safe, per-instance abstraction over Mono's internal call
 * registration system with:
 * - Duplicate registration handling with configurable policy
 * - NativeCallback keep-alive to prevent GC issues
 * - Batch registration support
 * - Introspection and debugging capabilities
 *
 * **IMPORTANT**: Callers must be in an attached thread context (e.g., inside
 * `Mono.perform()` or `api._threadManager.run()`). The registrar does not
 * auto-attach threads.
 *
 * @example
 * ```typescript
 * import { Mono, InternalCallRegistrar, DuplicatePolicy } from "frida-mono-bridge";
 *
 * await Mono.perform(() => {
 *   const registrar = new InternalCallRegistrar(Mono.api);
 *
 *   // Register a single internal call
 *   const callback = new NativeCallback(() => {
 *     console.log("Called from C#!");
 *   }, "void", []);
 *
 *   registrar.register({
 *     name: "MyNamespace.MyClass::MyMethod",
 *     callback,
 *   });
 *
 *   // Batch registration
 *   registrar.registerAll([
 *     { name: "NS.Class::Method1", callback: cb1 },
 *     { name: "NS.Class::Method2", callback: cb2 },
 *   ], { duplicatePolicy: DuplicatePolicy.Skip });
 *
 *   // Introspection
 *   console.log(`Registered ${registrar.count} internal calls`);
 *   for (const info of registrar.getAll()) {
 *     console.log(`  ${info.name} -> ${info.callbackPtr}`);
 *   }
 * });
 * ```
 */
export class InternalCallRegistrar {
  /** Map of registered internal calls by name */
  private readonly registry = new Map<string, InternalCallRegistrationInfo>();

  /** Strong references to NativeCallbacks to prevent GC */
  private readonly keepAliveRefs = new Map<string, NativeCallback<any, any>>();

  /** Cached feature support check */
  private featureSupported: boolean | null = null;

  /**
   * Create a new internal call registrar.
   *
   * @param api MonoApi instance (required for registration)
   */
  constructor(private readonly api: MonoApi) {}

  // ============================================================================
  // REGISTRATION METHODS
  // ============================================================================

  /**
   * Register an internal call.
   *
   * The callback will be registered with the Mono runtime so that managed
   * code can call it using `[MethodImpl(MethodImplOptions.InternalCall)]`.
   *
   * @param definition Internal call definition
   * @param options Registration options
   * @throws {MonoError} if name is invalid, callback is NULL, or duplicate with different pointer
   *
   * @example
   * ```typescript
   * registrar.register({
   *   name: "MyNamespace.MyClass::MyMethod",
   *   callback: new NativeCallback(() => { ... }, "void", []),
   * });
   * ```
   */
  register(definition: InternalCallDefinition, options: InternalCallRegistrationOptions = {}): void {
    const { duplicatePolicy = DuplicatePolicy.Throw, validateCallback = true } = options;

    // Ensure feature is supported
    this.ensureSupported();

    // Validate name
    const name = definition.name?.trim();
    if (!name || name.length === 0) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Internal call name must be a non-empty string",
        "Provide a fully qualified method name like 'Namespace.Class::Method'",
      );
    }

    // Resolve callback to pointer
    const callbackPtr = this.resolveCallback(definition.callback);
    if (validateCallback && pointerIsNull(callbackPtr)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        "Internal call callback must not be NULL",
        "Provide a valid NativePointer or NativeCallback",
      );
    }

    // Handle duplicates
    const existing = this.registry.get(name);
    if (existing) {
      const samePointer = existing.callbackPtr.equals(callbackPtr);

      switch (duplicatePolicy) {
        case DuplicatePolicy.Skip:
          // Silently skip if already registered (regardless of pointer)
          return;

        case DuplicatePolicy.Throw:
          if (!samePointer) {
            raise(
              MonoErrorCodes.INVALID_ARGUMENT,
              `Internal call '${name}' is already registered with a different callback`,
              "Use DuplicatePolicy.Overwrite to replace, or DuplicatePolicy.Skip to ignore",
              { existingPtr: existing.callbackPtr.toString(), newPtr: callbackPtr.toString() },
            );
          }
          // Same pointer - treat as idempotent success
          return;

        case DuplicatePolicy.Overwrite:
          // Continue to registration, will overwrite
          break;
      }
    }

    // Determine keep-alive behavior
    const isNativeCallback = this.isNativeCallback(definition.callback);
    const keepAlive = definition.keepAlive ?? isNativeCallback; // Default true for NativeCallback

    // Register with Mono runtime (caller must be in attached context)
    if (validateCallback) {
      // Use the API method which validates
      this.api.addInternalCall(name, callbackPtr);
    } else {
      // Bypass validation - call native function directly
      const namePtr = Memory.allocUtf8String(name);
      this.api.native.mono_add_internal_call(namePtr, callbackPtr);
    }

    // Track in registry
    this.registry.set(name, {
      name,
      callbackPtr,
      registeredAt: Date.now(),
      keepAlive,
    });

    // Keep alive if needed
    if (keepAlive && isNativeCallback) {
      this.keepAliveRefs.set(name, definition.callback as NativeCallback<any, any>);
    } else {
      // Remove any existing keep-alive ref if overwriting with non-keepalive
      this.keepAliveRefs.delete(name);
    }
  }

  /**
   * Try to register an internal call without throwing.
   *
   * @param definition Internal call definition
   * @param options Registration options
   * @returns `true` if registration succeeded, `false` otherwise
   */
  tryRegister(definition: InternalCallDefinition, options: InternalCallRegistrationOptions = {}): boolean {
    try {
      this.register(definition, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Register multiple internal calls.
   *
   * All registrations share the same options. If any registration fails
   * (and duplicatePolicy is Throw), an error is thrown and remaining
   * registrations are not performed.
   *
   * @param definitions Array of internal call definitions
   * @param options Registration options (applied to all)
   *
   * @example
   * ```typescript
   * registrar.registerAll([
   *   { name: "NS.Class::Method1", callback: cb1 },
   *   { name: "NS.Class::Method2", callback: cb2 },
   *   { name: "NS.Class::Method3", callback: cb3 },
   * ], { duplicatePolicy: DuplicatePolicy.Skip });
   * ```
   */
  registerAll(definitions: InternalCallDefinition[], options: InternalCallRegistrationOptions = {}): void {
    for (const definition of definitions) {
      this.register(definition, options);
    }
  }

  /**
   * Try to register multiple internal calls, returning count of successful registrations.
   *
   * @param definitions Array of internal call definitions
   * @param options Registration options
   * @returns Number of successfully registered calls
   */
  tryRegisterAll(definitions: InternalCallDefinition[], options: InternalCallRegistrationOptions = {}): number {
    let successCount = 0;
    for (const definition of definitions) {
      if (this.tryRegister(definition, options)) {
        successCount++;
      }
    }
    return successCount;
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Check if an internal call is registered (in this registrar).
   *
   * @param name Fully qualified method name
   * @returns `true` if registered through this registrar
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Get registration info for an internal call.
   *
   * @param name Fully qualified method name
   * @returns Registration info if registered, `undefined` otherwise
   */
  get(name: string): InternalCallRegistrationInfo | undefined {
    return this.registry.get(name);
  }

  /**
   * Get all registered internal calls.
   *
   * @returns Array of registration info objects
   */
  getAll(): InternalCallRegistrationInfo[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get the number of registered internal calls.
   */
  get count(): number {
    return this.registry.size;
  }

  /**
   * Get all registered method names.
   */
  get names(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get a summary of the registrar state.
   */
  getSummary(): InternalCallRegistrarSummary {
    return {
      count: this.count,
      supported: this.isSupported(),
      names: this.names,
    };
  }

  // ============================================================================
  // FEATURE SUPPORT
  // ============================================================================

  /**
   * Check if internal call registration is supported by the runtime.
   *
   * @returns `true` if `mono_add_internal_call` is available
   */
  isSupported(): boolean {
    if (this.featureSupported === null) {
      const version = MonoRuntimeVersion.fromApi(this.api);
      this.featureSupported = version.features.internalCalls;
    }
    return this.featureSupported;
  }

  /**
   * Ensure internal call feature is supported, throwing if not.
   *
   * @throws {MonoError} if internal calls are not supported
   */
  ensureSupported(): void {
    if (!this.isSupported()) {
      raise(
        MonoErrorCodes.NOT_SUPPORTED,
        "Internal call registration is not supported by this Mono runtime",
        "The mono_add_internal_call export is not available in the loaded Mono module",
      );
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Clear the registrar's local tracking state.
   *
   * **WARNING**: This only clears the local registry. Mono retains the registered
   * internal calls - they cannot be unregistered from the runtime. Use this
   * primarily for testing or when you need to re-register with different callbacks.
   *
   * Releases keep-alive references, which may allow NativeCallbacks to be garbage
   * collected (potentially causing crashes if managed code calls them).
   */
  clear(): void {
    this.registry.clear();
    this.keepAliveRefs.clear();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Resolve a callback value to a NativePointer.
   */
  private resolveCallback(callback: InternalCallCallback): NativePointer {
    // Direct NativePointer
    if (isNativePointer(callback)) {
      return callback;
    }

    // Try resolving via utility (handles objects with .pointer, .handle, etc.)
    const resolved = resolveNativePointer(callback);
    if (resolved !== null) {
      return resolved;
    }

    // Fallback - shouldn't reach here for valid inputs
    return NULL;
  }

  /**
   * Check if a value is a NativeCallback (not just a NativePointer).
   */
  private isNativeCallback(value: unknown): value is NativeCallback<any, any> {
    // NativeCallback has specific constructor name in Frida
    return value !== null && typeof value === "object" && value.constructor?.name === "NativeCallback";
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new internal call registrar.
 *
 * @param api MonoApi instance
 * @returns New InternalCallRegistrar instance
 *
 * @example
 * ```typescript
 * const registrar = createInternalCallRegistrar(Mono.api);
 * ```
 */
export function createInternalCallRegistrar(api: MonoApi): InternalCallRegistrar {
  return new InternalCallRegistrar(api);
}

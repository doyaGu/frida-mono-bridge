/**
 * Internal Call Registration - Register native functions callable from managed code.
 *
 * Internal calls allow managed C# code to call native functions directly.
 * This is commonly used by Unity's runtime to expose native functionality.
 *
 * @module runtime/icall
 */

import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { MonoApi } from "./api";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Information about a registered internal call.
 */
export interface InternalCallInfo {
  /** Fully qualified method name */
  name: string;
  /** Native function pointer */
  callback: NativePointer;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Options for internal call registration.
 */
export interface RegisterInternalCallOptions {
  /** Whether to skip thread attachment (use if already attached) */
  skipThreadAttach?: boolean;
  /** Whether to validate the callback pointer */
  validateCallback?: boolean;
}

// ============================================================================
// INTERNAL CALL REGISTRY
// ============================================================================

/**
 * Registry for tracking registered internal calls.
 * Useful for debugging and ensuring calls aren't registered multiple times.
 */
class InternalCallRegistry {
  private readonly calls = new Map<string, InternalCallInfo>();

  /**
   * Record a registered internal call.
   */
  register(name: string, callback: NativePointer): void {
    this.calls.set(name, {
      name,
      callback,
      registeredAt: Date.now(),
    });
  }

  /**
   * Check if an internal call is already registered.
   */
  has(name: string): boolean {
    return this.calls.has(name);
  }

  /**
   * Get info about a registered call.
   */
  get(name: string): InternalCallInfo | undefined {
    return this.calls.get(name);
  }

  /**
   * Get all registered calls.
   */
  getAll(): InternalCallInfo[] {
    return Array.from(this.calls.values());
  }

  /**
   * Get the count of registered calls.
   */
  get size(): number {
    return this.calls.size;
  }

  /**
   * Clear the registry.
   */
  clear(): void {
    this.calls.clear();
  }
}

/** Global registry for tracking internal calls */
const globalRegistry = new InternalCallRegistry();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Register an internal call (native function callable from managed code).
 *
 * The function will be registered with the Mono runtime so that managed
 * code can call it using `[MethodImpl(MethodImplOptions.InternalCall)]`.
 *
 * @param api MonoApi instance
 * @param name Fully qualified method name (e.g., "UnityEngine.Object::Internal_Instantiate")
 * @param callback Native function pointer to invoke
 * @param options Registration options
 * @throws {MonoError} if name is empty or callback is NULL
 *
 * @example
 * ```typescript
 * // Create a native callback
 * const callback = new NativeCallback(() => {
 *   console.log('Called from managed code!');
 * }, 'void', []);
 *
 * // Register it
 * registerInternalCall(api, 'MyNamespace.MyClass::MyMethod', callback);
 * ```
 */
export function registerInternalCall(
  api: MonoApi,
  name: string,
  callback: NativePointer,
  options: RegisterInternalCallOptions = {},
): void {
  const { skipThreadAttach = false, validateCallback = true } = options;

  // Validate inputs
  if (!name || name.trim().length === 0) {
    raise(
      MonoErrorCodes.INVALID_ARGUMENT,
      "Internal call name must be a non-empty string",
      "Provide a fully qualified method name like 'Namespace.Class::Method'",
    );
  }

  if (validateCallback && pointerIsNull(callback)) {
    raise(
      MonoErrorCodes.INVALID_ARGUMENT,
      "Internal call callback must not be NULL",
      "Provide a valid NativePointer or NativeCallback",
    );
  }

  // Register with appropriate thread handling
  if (skipThreadAttach) {
    api.addInternalCall(name, callback);
  } else {
    api._threadManager.run(() => api.addInternalCall(name, callback));
  }

  // Track in registry
  globalRegistry.register(name, callback);
}

/**
 * Try to register an internal call without throwing.
 *
 * @param api MonoApi instance
 * @param name Fully qualified method name
 * @param callback Native function pointer
 * @param options Registration options
 * @returns True if registration succeeded, false otherwise
 */
export function tryRegisterInternalCall(
  api: MonoApi,
  name: string,
  callback: NativePointer,
  options: RegisterInternalCallOptions = {},
): boolean {
  try {
    registerInternalCall(api, name, callback, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an internal call has been registered.
 *
 * Note: This only tracks calls registered through this module,
 * not calls registered directly through the Mono API.
 *
 * @param name Fully qualified method name
 * @returns True if registered through this module
 */
export function hasInternalCall(name: string): boolean {
  return globalRegistry.has(name);
}

/**
 * Get information about a registered internal call.
 *
 * @param name Fully qualified method name
 * @returns Info if registered, undefined otherwise
 */
export function getInternalCallInfo(name: string): InternalCallInfo | undefined {
  return globalRegistry.get(name);
}

/**
 * Get all registered internal calls.
 * @returns Array of internal call info
 */
export function getAllInternalCalls(): InternalCallInfo[] {
  return globalRegistry.getAll();
}

/**
 * Get the count of registered internal calls.
 */
export function getInternalCallCount(): number {
  return globalRegistry.size;
}

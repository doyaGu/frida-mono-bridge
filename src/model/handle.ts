import type { MonoApi } from "../runtime/api";
import { MonoErrorCodes, raise } from "../utils/errors";
import { isValidPointer } from "../utils/memory";

/**
 * Common accessibility levels for Mono members.
 * Matches C# accessibility modifiers.
 */
export type MemberAccessibility =
  | "private-scope" // FamANDAssem - Not accessible outside the type
  | "private" // Private - Only accessible within the declaring type
  | "protected-and-internal" // FamANDAssem - Protected AND internal
  | "internal" // Assembly - Only accessible within the same assembly
  | "protected" // Family - Accessible to derived types
  | "protected-internal" // FamORAssem - Protected OR internal
  | "public"; // Public - Accessible everywhere

/**
 * Interface for objects that have a native pointer.
 * Used for type checking in comparison operations.
 */
export interface HasPointer {
  pointer: NativePointer;
}

/**
 * Method argument type for Mono method invocations.
 * Supports all common .NET types that can be passed as arguments.
 */
export type MethodArgument = NativePointer | number | boolean | string | bigint | null | undefined;

/**
 * Base class for all Mono handles.
 *
 * Provides automatic thread-safe access to native API and common handle operations.
 * Individual methods don't need to worry about thread attachment.
 */
export abstract class MonoHandle<THandle extends NativePointer = NativePointer> {
  private _native: any = null;

  /**
   * Create a new Mono handle.
   * @param _api Mono API instance
   * @param handle Native pointer handle
   */
  constructor(
    protected readonly _api: MonoApi,
    protected readonly handle: THandle,
  ) {
    if (!isValidPointer(handle)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `${this.constructor.name} received a NULL or invalid handle`,
        "Ensure the native pointer is valid before creating a handle",
      );
    }
  }

  /** Get the Mono API instance. */
  get api(): MonoApi {
    return this._api;
  }

  /**
   * Get thread-safe native API.
   * All calls are automatically wrapped with thread attachment when needed.
   */
  protected get native(): any {
    if (!this._native) {
      this._native = this._api.native;
    }
    return this._native;
  }

  /** Direct access to the underlying Mono object pointer. */
  get pointer(): THandle {
    return this.handle;
  }

  /** Check if this handle is valid (not null). */
  get isValid(): boolean {
    return isValidPointer(this.pointer);
  }

  /** Compare underlying native pointers. */
  equals(other: HasPointer | null | undefined): boolean {
    if (!other || !other.pointer) return false;
    return this.pointer.equals(other.pointer);
  }

  /** Try to check equality without throwing. */
  tryEquals(other: HasPointer | null | undefined): boolean {
    try {
      return this.equals(other);
    } catch {
      return false;
    }
  }

  /** Hash code suitable for use in hash tables. */
  getHashCode(): number {
    return this.pointer.toInt32();
  }

  /** String representation for debugging. */
  toString(): string {
    return `${this.constructor.name}(${this.pointer})`;
  }
}

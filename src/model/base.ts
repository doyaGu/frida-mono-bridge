import { MonoApi } from "../runtime/api";
import { isValidPointer } from "../utils/memory";
import { MonoError } from "../utils/errors";

/**
 * Common accessibility levels for Mono members
 */
export type MemberAccessibility =
  | "private-scope"
  | "private"
  | "protected-and-internal"
  | "internal"
  | "protected"
  | "protected-internal"
  | "public";

/**
 * Base class for all Mono handles
 *
 * Provides automatic thread-safe access to native API.
 * Individual methods don't need to worry about thread attachment.
 */
export abstract class MonoHandle<THandle extends NativePointer = NativePointer> {
  private _native: any = null;

  constructor(protected readonly _api: MonoApi, protected readonly handle: THandle) {
    if (!isValidPointer(handle)) {
      throw new MonoError(
        `${this.constructor.name} received a NULL handle.`,
        "Handle Creation",
        undefined
      );
    }
  }

  /**
   * Get the Mono API instance
   */
  get api(): MonoApi {
    return this._api;
  }

  /**
   * Get thread-safe native API
   * All calls are automatically wrapped with thread attachment when needed
   * Avoids nested attachments by checking if already in attached context
   */
  protected get native(): any {
    if (!this._native) {
      this._native = this._api.native;
    }
    return this._native;
  }

  /**
   * Get the native pointer handle
   */
  get pointer(): THandle {
    return this.handle;
  }

  /**
   * Check if this handle points to the same object as another
   */
  equals(other: MonoHandle<THandle>): boolean {
    return (this.pointer as any).toInt32() === (other.pointer as any).toInt32();
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `${this.constructor.name}(${this.pointer})`;
  }
}

/**
 * Generic reference wrapper for Mono objects
 */
export class MonoReference<T extends MonoHandle> {
  private _value: T | null = null;
  private readonly _factory: () => T;

  constructor(factory: () => T) {
    this._factory = factory;
  }

  /**
   * Get the referenced value
   */
  get value(): T {
    if (!this._value) {
      this._value = this._factory();
    }
    return this._value;
  }

  /**
   * Check if reference is valid (not null)
   */
  get isValid(): boolean {
    try {
      return this.value !== null;
    } catch {
      return false;
    }
  }

  /**
   * Resolve the reference
   */
  resolve(): T {
    return this.value;
  }

  /**
   * Clear the cached value
   */
  reset(): void {
    this._value = null;
  }
}

/**
 * Method argument type
 */
export type MethodArgument = NativePointer | number | boolean | string | bigint | null | undefined;


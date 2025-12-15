/**
 * Reference wrapper for lazy-loaded Mono objects.
 *
 * Provides deferred creation with caching: the factory is invoked once
 * on first `.value` access, and the result is cached for subsequent reads.
 *
 * @module model/reference
 */

import { MonoHandle } from "./handle";

/**
 * Generic lazy reference wrapper for Mono objects.
 *
 * Provides deferred object creation with caching. The factory function
 * is only called once, on first access, and the result is cached.
 */
export class MonoReference<T extends MonoHandle> {
  private _value: T | null = null;
  private readonly _factory: () => T;

  constructor(factory: () => T) {
    this._factory = factory;
  }

  /** Get the referenced value (creates and caches on first access). */
  get value(): T {
    if (!this._value) {
      this._value = this._factory();
    }
    return this._value;
  }

  /** Whether the reference has been resolved. */
  get isResolved(): boolean {
    return this._value !== null;
  }

  /** Whether the reference can be resolved without error. */
  get isValid(): boolean {
    try {
      return this.value !== null && this.value.isValid;
    } catch {
      return false;
    }
  }

  /** Resolve the reference (alias for value getter). */
  resolve(): T {
    return this.value;
  }

  /** Try to resolve without throwing. */
  tryResolve(): T | null {
    try {
      return this.value;
    } catch {
      return null;
    }
  }

  /** Clear the cached value. */
  reset(): void {
    this._value = null;
  }

  /** Force immediate resolution and caching. */
  preload(): T {
    return this.value;
  }

  toString(): string {
    if (this._value) {
      return `MonoReference(resolved: ${this._value})`;
    }
    return "MonoReference(unresolved)";
  }

  toJSON(): MonoReferenceJSON {
    let value: unknown = null;
    if (this._value) {
      const v = this._value as unknown;
      if (
        typeof v === "object" &&
        v !== null &&
        "toJSON" in v &&
        typeof (v as { toJSON: unknown }).toJSON === "function"
      ) {
        value = (v as { toJSON(): unknown }).toJSON();
      } else {
        value = this._value;
      }
    }
    return {
      isResolved: this.isResolved,
      value,
    };
  }
}

/** JSON representation of MonoReference. */
export interface MonoReferenceJSON {
  isResolved: boolean;
  value: unknown;
}

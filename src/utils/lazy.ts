/**
 * Lazy Value - Deferred evaluation with caching
 */

export class LazyValue<T> {
  private _value: T | undefined;
  private _isInitialized = false;
  private readonly _factory: () => T;

  constructor(factory: () => T) {
    this._factory = factory;
  }

  /**
   * Get the value, initializing if needed
   */
  get value(): T {
    if (!this._isInitialized) {
      this._value = this._factory();
      this._isInitialized = true;
    }
    return this._value!;
  }

  /**
   * Check if value has been initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Reset the lazy value, forcing re-evaluation on next access
   */
  reset(): void {
    this._value = undefined;
    this._isInitialized = false;
  }

  /**
   * Get value if initialized, otherwise return undefined
   */
  tryGetValue(): T | undefined {
    return this._isInitialized ? this._value : undefined;
  }
}

/**
 * Create a lazy value
 */
export function lazy<T>(factory: () => T): LazyValue<T> {
  return new LazyValue(factory);
}

/**
 * Method Interception Support
 */

export interface MethodHooks<TReturn = any, TArgs extends any[] = any[]> {
  /**
   * Called before method execution
   * @param args Method arguments
   */
  onEnter?(...args: TArgs): void;

  /**
   * Called after method execution
   * @param retval Return value
   * @returns Modified return value or void to keep original
   */
  onLeave?(retval: TReturn): TReturn | void;

  /**
   * Called when method throws an exception
   * @param error Exception object
   */
  onError?(error: any): void;
}

export class Interceptor {
  private _detached = false;
  private readonly _detachFn: () => void;

  constructor(detachFn: () => void) {
    this._detachFn = detachFn;
  }

  /**
   * Detach the interceptor
   */
  detach(): void {
    if (!this._detached) {
      this._detachFn();
      this._detached = true;
    }
  }

  /**
   * Check if interceptor is still attached
   */
  get isAttached(): boolean {
    return !this._detached;
  }
}

/**
 * Create an interceptor from a Frida interceptor
 */
export function createInterceptor(fridaInterceptor: InvocationListenerCallbacks): Interceptor {
  return new Interceptor(() => {
    // Frida doesn't provide direct detach for individual interceptors
    // This would need to be tracked separately
  });
}

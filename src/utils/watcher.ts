/**
 * Field Watching Support
 */

export interface WatchCallback<T = any> {
  (oldValue: T, newValue: T, fieldName: string): void;
}

export class Watcher {
  private _active = true;
  private readonly _stopFn: () => void;

  constructor(stopFn: () => void) {
    this._stopFn = stopFn;
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this._active) {
      this._stopFn();
      this._active = false;
    }
  }

  /**
   * Check if watcher is active
   */
  get isActive(): boolean {
    return this._active;
  }
}

/**
 * Watch a memory location for changes
 */
export function watchMemory<T = any>(
  address: NativePointer,
  size: number,
  callback: WatchCallback<T>,
  fieldName: string,
  readFn: (addr: NativePointer) => T
): Watcher {
  let lastValue = readFn(address);
  let checking = true;

  const intervalId = setInterval(() => {
    if (!checking) return;

    const currentValue = readFn(address);
    if (currentValue !== lastValue) {
      callback(lastValue, currentValue, fieldName);
      lastValue = currentValue;
    }
  }, 100); // Check every 100ms

  return new Watcher(() => {
    checking = false;
    clearInterval(intervalId);
  });
}

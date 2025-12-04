/**
 * Safe property access utilities for Mono objects
 */

import { Logger } from "./log";
import { MonoError } from "./errors";

const logger = new Logger({ tag: "SafeAccess" });

/**
 * Options for safe property access
 */
export interface SafeAccessOptions {
  /** Whether to suppress error logging (useful for testing) */
  silent?: boolean;
}

/**
 * Utility for safe property access on Mono objects
 */
export class SafePropertyAccess {
  private silent: boolean;

  constructor(
    private obj: any,
    options?: SafeAccessOptions,
  ) {
    this.silent = options?.silent ?? false;
  }

  /**
   * Safely get a property value
   */
  get(propertyName: string): any {
    try {
      return this.obj[propertyName];
    } catch (error) {
      if (!this.silent) {
        logger.error(`Failed to get property '${propertyName}': ${error}`);
      }
      return null;
    }
  }

  /**
   * Safely call a method
   */
  call(methodName: string, ...args: any[]): any {
    try {
      const method = this.obj[methodName];
      if (typeof method === "function") {
        return method.apply(this.obj, args);
      }
      throw new MonoError(`Property '${methodName}' is not a function`, "Safe Property Access");
    } catch (error) {
      if (!this.silent) {
        logger.error(`Failed to call method '${methodName}': ${error}`);
      }
      return null;
    }
  }
}

/**
 * Create safe property accessor for an object
 * @param obj The object to access safely
 * @param options Optional configuration
 */
export function safeAccess(obj: any, options?: SafeAccessOptions): SafePropertyAccess {
  return new SafePropertyAccess(obj, options);
}

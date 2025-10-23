/**
 * Safe property access utilities for Mono objects
 */

import { Logger } from "./log";
import { MonoError } from "./errors";

const logger = new Logger({ tag: "SafeAccess" });

/**
 * Utility for safe property access on Mono objects
 */
export class SafePropertyAccess {
  constructor(private obj: any) {}

  /**
   * Safely get a property value
   */
  get(propertyName: string): any {
    try {
      return this.obj[propertyName];
    } catch (error) {
      logger.error(`Failed to get property '${propertyName}': ${error}`);
      return null;
    }
  }

  /**
   * Safely call a method
   */
  call(methodName: string, ...args: any[]): any {
    try {
      const method = this.obj[methodName];
      if (typeof method === 'function') {
        return method.apply(this.obj, args);
      }
      throw new MonoError(`Property '${methodName}' is not a function`, "Safe Property Access");
    } catch (error) {
      logger.error(`Failed to call method '${methodName}': ${error}`);
      return null;
    }
  }
}

/**
 * Create safe property accessor for an object
 */
export function safeAccess(obj: any): SafePropertyAccess {
  return new SafePropertyAccess(obj);
}
/**
 * Common patterns and utilities for Mono operations
 * Provides standardized patterns for error handling and operations
 */

import { Logger } from "../utils/log";

const logger = new Logger({ tag: "Patterns" });

/**
 * Base class for Mono operations with built-in error handling
 */
export abstract class MonoOperation<T> {
  protected abstract execute(): T;

  /**
   * Execute operation with error handling
   * @param context Operation context for error logging
   * @returns Result or null if operation fails
   */
  safeExecute(context: string): T | null {
    try {
      return this.execute();
    } catch (error) {
      logger.error(`Operation failed in ${context}: ${error}`);
      return null;
    }
  }

  /**
   * Execute operation with custom error handler
   * @param context Operation context
   * @param onError Custom error handler
   * @returns Result or null if operation fails
   */
  safeExecuteWithHandler(context: string, onError: (error: unknown) => void): T | null {
    try {
      return this.execute();
    } catch (error) {
      logger.error(`Operation failed in ${context}: ${error}`);
      onError(error);
      return null;
    }
  }
}

/**
 * Method invocation operation with standardized error handling
 */
export class MethodInvocation extends MonoOperation<any> {
  constructor(
    private method: any,
    private instance: any,
    private args: any[]
  ) {
    super();
  }

  protected execute(): any {
    return this.method.invoke(this.instance, this.args);
  }

  /**
   * Get method information for logging
   */
  getMethodInfo(): string {
    try {
      return `${this.method.getFullName?.() || 'Unknown method'}(${this.args.length} args)`;
    } catch {
      return 'Unknown method';
    }
  }
}

/**
 * Batch operation for executing multiple operations efficiently
 */
export class BatchOperation {
  private operations: Array<() => any> = [];

  /**
   * Add an operation to the batch
   */
  add<T>(operation: () => T): void {
    this.operations.push(operation);
  }

  /**
   * Execute all operations in sequence
   * @param context Context for error logging
   * @returns Array of results, failed operations return null
   */
  executeAll(context: string): Array<any> {
    const results: Array<any> = [];

    for (let i = 0; i < this.operations.length; i++) {
      try {
        const result = this.operations[i]();
        results.push(result);
      } catch (error) {
        logger.error(`Batch operation ${i + 1}/${this.operations.length} failed in ${context}: ${error}`);
        results.push(null);
      }
    }

    return results;
  }

  /**
   * Execute operations and return only successful results
   */
  executeSuccessfulOnly<T>(context: string): T[] {
    const results = this.executeAll(context);
    return results.filter(result => result !== null) as T[];
  }

  /**
   * Clear all operations from the batch
   */
  clear(): void {
    this.operations = [];
  }

  /**
   * Get number of operations in batch
   */
  get size(): number {
    return this.operations.length;
  }
}

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
      throw new Error(`Property '${methodName}' is not a function`);
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

/**
 * Utility for retrying failed operations
 */
export class RetryOperation {
  constructor(
    private maxRetries: number = 3,
    private delay: number = 100
  ) {}

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => T,
    context: string
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${this.maxRetries} failed for ${context}: ${error}`);

        if (attempt < this.maxRetries) {
          // Simple delay - in real scenarios might use exponential backoff
          await new Promise(resolve => setTimeout(resolve, this.delay));
        }
      }
    }

    logger.error(`All ${this.maxRetries} attempts failed for ${context}: ${lastError}`);
    throw lastError;
  }
}

/**
 * Create retry operation with default settings
 */
export function withRetry(maxRetries: number = 3, delay: number = 100): RetryOperation {
  return new RetryOperation(maxRetries, delay);
}
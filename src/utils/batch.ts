/**
 * Batch operation utilities for executing multiple operations efficiently
 */

import { Logger } from "./log";

const logger = new Logger({ tag: "BatchOperation" });

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
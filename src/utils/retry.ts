/**
 * Retry utilities for operations that might fail temporarily
 */

import { Logger } from "./log";

const logger = new Logger({ tag: "RetryOperation" });

/**
 * Utility for retrying failed operations
 */
export class RetryOperation {
  constructor(
    private maxRetries: number = 3,
    private delay: number = 100,
  ) {}

  /**
   * Execute operation with retry logic
   */
  async execute<T>(operation: () => T, context: string): Promise<T> {
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

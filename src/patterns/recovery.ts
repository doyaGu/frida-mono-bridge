/**
 * Simplified thread recovery and error handling utilities
 */

import { Logger } from "../utils/log";
import { MonoApi } from "../runtime/api";

const logger = new Logger({ tag: "ThreadRecovery" });

/**
 * Basic thread recovery strategy
 */
export class ThreadRecovery {
  private maxRetries: number = 3;
  private retryDelay: number = 100;

  constructor(maxRetries: number = 3, retryDelay: number = 100) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Execute operation with automatic thread recovery
   */
  async executeWithRecovery<T>(
    operation: () => T,
    api: MonoApi
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Ensure thread attachment
        const thread = api.attachThread();

        // Execute the operation
        const result = operation();

        // Detach thread
        api.detachThread(thread);

        if (attempt > 1) {
          logger.info(`Operation succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(`Operation failed on attempt ${attempt}: ${lastError.message}`);

        // Try basic recovery
        try {
          await this.performBasicRecovery(api);
        } catch (recoveryError) {
          logger.error(`Recovery failed on attempt ${attempt}: ${recoveryError}`);
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    // All attempts failed
    logger.error(`Operation failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Basic thread recovery operations
   */
  private async performBasicRecovery(api: MonoApi): Promise<void> {
    try {
      // Try to attach a fresh thread
      const thread = api.attachThread();
      await this.delay(50);
      api.detachThread(thread);
    } catch (error) {
      logger.debug(`Basic recovery failed: ${error}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Simple error handler for Mono operations
 */
export class ErrorHandler {
  private errors: ErrorInfo[] = [];
  private maxErrors: number = 100;

  /**
   * Handle and log an error
   */
  handleError(error: Error, context?: string): void {
    const errorInfo: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      context: context || 'Unknown',
      timestamp: Date.now()
    };

    this.errors.push(errorInfo);

    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors.splice(0, this.errors.length - this.maxErrors);
    }

    logger.error(`Mono operation failed: ${error.message}`, {
      context,
      stack: error.stack
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ErrorInfo[] {
    return this.errors.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > lastHour);

    return {
      total: this.errors.length,
      lastHour: recentErrors.length,
      lastError: this.errors.length > 0 ? this.errors[this.errors.length - 1] : null
    };
  }
}

// Global instances
export const threadRecovery = new ThreadRecovery();
export const errorHandler = new ErrorHandler();

// Interfaces
export interface ErrorInfo {
  message: string;
  stack?: string;
  context: string;
  timestamp: number;
}

export interface ErrorStats {
  total: number;
  lastHour: number;
  lastError: ErrorInfo | null;
}
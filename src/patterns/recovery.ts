/**
 * Enhanced error recovery patterns
 * Provides strategies for recovering from errors and preventing cascading failures
 */

import { Logger } from "../utils/log";
import { MonoError } from "./errors";

const logger = new Logger({ tag: "ErrorRecovery" });

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  canRecover(error: Error): boolean;
  recover(error: Error): any;
  getStrategyName(): string;
}

/**
 * Result type for operations that might fail
 */
export type RecoveryResult<T> = {
  success: true;
  data: T;
  strategy?: string;
} | {
  success: false;
  error: Error;
  attemptedStrategies: string[];
};

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is open');
      }
      this.state = 'half-open';
      logger.info('Circuit breaker entering half-open state');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      logger.info('Circuit breaker reset to closed state');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
    logger.info('Circuit breaker manually reset');
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Retry operation with exponential backoff
 */
export class RetryOperation {
  constructor(private readonly config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  async execute<T>(
    fn: () => Promise<T> | T,
    context?: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === this.config.maxAttempts) {
          logger.error(`All ${this.config.maxAttempts} attempts failed${context ? ` for ${context}` : ''}`);
          break;
        }
        
        const delay = this.calculateDelay(attempt);
        logger.warn(`Attempt ${attempt}/${this.config.maxAttempts} failed${context ? ` for ${context}` : ''}, retrying in ${delay}ms: ${lastError.message}`);
        
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);
    
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error recovery manager
 */
export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private retryOperation = new RetryOperation();

  /**
   * Add a recovery strategy
   */
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Remove a recovery strategy
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter(s => s.getStrategyName() !== strategyName);
  }

  /**
   * Get a circuit breaker for a specific operation
   */
  getCircuitBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, new CircuitBreaker());
    }
    return this.circuitBreakers.get(operation)!;
  }

  /**
   * Execute an operation with error recovery
   */
  async executeWithRecovery<T>(
    fn: () => Promise<T> | T,
    context: string,
    options: {
      useCircuitBreaker?: boolean;
      useRetry?: boolean;
      customStrategies?: RecoveryStrategy[];
    } = {}
  ): Promise<RecoveryResult<T>> {
    const {
      useCircuitBreaker = true,
      useRetry = true,
      customStrategies = []
    } = options;

    const strategies = [...customStrategies, ...this.strategies];
    const attemptedStrategies: string[] = [];

    // Wrap with circuit breaker if enabled
    const executeFn = async () => {
      if (useRetry) {
        return this.retryOperation.execute(fn, context);
      }
      return fn();
    };

    try {
      if (useCircuitBreaker) {
        const circuitBreaker = this.getCircuitBreaker(context);
        const result = await circuitBreaker.execute(executeFn);
        return {
          success: true,
          data: result
        };
      } else {
        const result = await executeFn();
        return {
          success: true,
          data: result
        };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Try recovery strategies
      for (const strategy of strategies) {
        if (strategy.canRecover(err)) {
          attemptedStrategies.push(strategy.getStrategyName());
          
          try {
            const recovered = strategy.recover(err);
            logger.info(`Recovered from error using ${strategy.getStrategyName()}: ${err.message}`);
            return {
              success: true,
              data: recovered,
              strategy: strategy.getStrategyName()
            };
          } catch (recoveryError) {
            logger.warn(`Recovery strategy ${strategy.getStrategyName()} failed: ${recoveryError}`);
          }
        }
      }

      return {
        success: false,
        error: err,
        attemptedStrategies
      };
    }
  }

  /**
   * Execute a synchronous operation with error recovery
   */
  async executeWithRecoverySync<T>(
    fn: () => T,
    context: string,
    options: {
      useCircuitBreaker?: boolean;
      customStrategies?: RecoveryStrategy[];
    } = {}
  ): Promise<RecoveryResult<T>> {
    // Convert sync function to async
    return this.executeWithRecovery(
      () => Promise.resolve(fn()),
      context,
      { ...options, useRetry: false }
    );
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Get statistics for all circuit breakers
   */
  getCircuitBreakerStats(): Record<string, { state: CircuitState; failures: number }> {
    const stats: Record<string, { state: CircuitState; failures: number }> = {};
    
    for (const [operation, circuitBreaker] of this.circuitBreakers.entries()) {
      stats[operation] = {
        state: circuitBreaker.getState(),
        failures: circuitBreaker.getFailures()
      };
    }
    
    return stats;
  }
}

/**
 * Common recovery strategies
 */
export const CommonRecoveryStrategies = {
  /**
   * Recover from null pointer errors by returning null
   */
  nullPointer: {
    canRecover(error: Error): boolean {
      return error.message.includes('NULL') || error.message.includes('null pointer');
    },
    recover(): null {
      return null;
    },
    getStrategyName(): string {
      return 'nullPointer';
    }
  } as RecoveryStrategy,

  /**
   * Recover from thread attachment errors by re-attaching
   */
  threadAttachment: {
    canRecover(error: Error): boolean {
      return error.message.includes('thread') || error.message.includes('attach');
    },
    recover(): never {
      // Attempt actual thread attachment recovery
      try {
        // Strategy 1: Try to attach current thread to Mono runtime
        // This simulates what ThreadManager.attach() would do
        const currentThreadId = Process.getCurrentThreadId();

        // Check if we can access any Mono runtime functions
        // This is a basic check to see if the runtime is available
        if (typeof (globalThis as any).Mono !== 'undefined') {
          // Try to force reattachment by accessing Mono runtime
          const monoApi = (globalThis as any).Mono.api;
          if (monoApi && monoApi.native) {
            // Attempt to get root domain as a connection test
            const domain = monoApi.getRootDomain();
            if (domain && !domain.isNull()) {
              // If we can access the domain, attachment might be working
              throw new Error(`Thread attachment recovered for thread ${currentThreadId}. Consider retrying the operation.`);
            }
          }
        }

        // Strategy 2: Check if we're in a Frida context and provide specific guidance
        if (typeof Process !== 'undefined') {
          const processName = Process.getCurrentThreadId();
          throw new Error(
            `Thread attachment failed in process ${processName}. ` +
            `Ensure Mono runtime is initialized and wrap operations with Mono.perform(). ` +
            `Current thread: ${currentThreadId}`
          );
        }

        // Strategy 3: Generic fallback with debugging info
        throw new Error(
          'Thread attachment recovery requires proper Mono runtime context. ' +
          'Common causes: 1) Mono runtime not initialized, 2) Wrong process attached, ' +
          '3) Operation called outside Mono.perform() wrapper, ' +
          `4) Thread context corruption. Thread: ${currentThreadId}`
        );
      } catch (recoveryError) {
        // Wrap the recovery error with more context
        const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
        throw new Error(`Thread attachment recovery failed: ${errorMessage}`);
      }
    },
    getStrategyName(): string {
      return 'threadAttachment';
    }
  } as RecoveryStrategy,

  /**
   * Recover from assembly not found errors by returning null
   */
  assemblyNotFound: {
    canRecover(error: Error): boolean {
      return error.message.includes('Assembly not found') || error.message.includes('assembly');
    },
    recover(): null {
      return null;
    },
    getStrategyName(): string {
      return 'assemblyNotFound';
    }
  } as RecoveryStrategy,

  /**
   * Recover from class not found errors by returning null
   */
  classNotFound: {
    canRecover(error: Error): boolean {
      return error.message.includes('Class not found') || error.message.includes('class');
    },
    recover(): null {
      return null;
    },
    getStrategyName(): string {
      return 'classNotFound';
    }
  } as RecoveryStrategy,

  /**
   * Recover from method not found errors by returning null
   */
  methodNotFound: {
    canRecover(error: Error): boolean {
      return error.message.includes('Method not found') || error.message.includes('method');
    },
    recover(): null {
      return null;
    },
    getStrategyName(): string {
      return 'methodNotFound';
    }
  } as RecoveryStrategy,
};

/**
 * Global error recovery manager instance
 */
export const globalRecoveryManager = new ErrorRecoveryManager();

// Add common strategies to the global manager
globalRecoveryManager.addStrategy(CommonRecoveryStrategies.nullPointer);
globalRecoveryManager.addStrategy(CommonRecoveryStrategies.assemblyNotFound);
globalRecoveryManager.addStrategy(CommonRecoveryStrategies.classNotFound);
globalRecoveryManager.addStrategy(CommonRecoveryStrategies.methodNotFound);
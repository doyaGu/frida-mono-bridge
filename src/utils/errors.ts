/**
 * Comprehensive error handling system for Mono operations
 * Provides consistent error types and handling patterns
 */

/**
 * Base Mono error class
 */
export class MonoError extends Error {
  constructor(
    message: string,
    public readonly context?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "MonoError";

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MonoError);
    }
  }

  /**
   * Get full error description
   */
  getFullDescription(): string {
    let description = this.message;

    if (this.context) {
      description = `[${this.context}] ${description}`;
    }

    if (this.cause) {
      description += ` (Caused by: ${this.cause.message})`;
    }

    return description;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): any {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : null,
      stack: this.stack
    };
  }
}

/**
 * Validation error
 */
export class MonoValidationError extends MonoError {
  constructor(
    message: string,
    public readonly parameter?: string,
    public readonly value?: unknown,
    cause?: Error
  ) {
    const context = parameter ? `Validation: ${parameter}` : "Validation";
    super(message, context, cause);
    this.name = "MonoValidationError";
  }

  override toJSON(): any {
    const base = super.toJSON();
    return {
      ...base,
      parameter: this.parameter,
      value: this.value,
    };
  }
}

/**
 * Helper for building validation errors with consistent messaging
 */
export function validationError(
  parameter: string,
  reason: string,
  value?: unknown,
  cause?: Error
): MonoValidationError {
  const message = `Parameter '${parameter}' ${reason}`;
  return new MonoValidationError(message, parameter, value, cause);
}

/**
 * Memory management error
 */
export class MonoMemoryError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, "Memory Management", cause);
    this.name = "MonoMemoryError";
  }
}

/**
 * Assert helper that throws a MonoError when condition fails
 */
export function monoInvariant(
  condition: unknown,
  errorFactory: () => MonoError
): asserts condition {
  if (!condition) {
    throw errorFactory();
  }
}

/**
 * Runtime initialization error
 */
export class MonoInitializationError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, "Initialization", cause);
    this.name = "MonoInitializationError";
  }
}

/**
 * Thread management error
 */
export class MonoThreadError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, "Thread Management", cause);
    this.name = "MonoThreadError";
  }
}

/**
 * Method invocation error
 */
export class MonoMethodError extends MonoError {
  constructor(
    message: string,
    public readonly methodName?: string,
    public readonly className?: string,
    cause?: Error
  ) {
    const context = className && methodName
      ? `Method Invocation: ${className}.${methodName}`
      : "Method Invocation";

    super(message, context, cause);
    this.name = "MonoMethodError";
  }
}

/**
 * Assembly loading error
 */
export class MonoAssemblyError extends MonoError {
  constructor(
    message: string,
    public readonly assemblyName?: string,
    cause?: Error
  ) {
    const context = assemblyName
      ? `Assembly Loading: ${assemblyName}`
      : "Assembly Loading";

    super(message, context, cause);
    this.name = "MonoAssemblyError";
  }
}

/**
 * Type conversion error
 */
export class MonoTypeError extends MonoError {
  constructor(
    message: string,
    public readonly expectedType?: string,
    public readonly actualType?: string,
    cause?: Error
  ) {
    const context = expectedType && actualType
      ? `Type Conversion: expected ${expectedType}, got ${actualType}`
      : "Type Conversion";

    super(message, context, cause);
    this.name = "MonoTypeError";
  }
}

/**
 * Handle Mono errors and convert to appropriate error type
 */
export function handleMonoError(
  error: unknown,
  context?: string
): MonoError {
  if (error instanceof MonoError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to categorize common error patterns
    const message = error.message.toLowerCase();

    if (message.includes('thread') || message.includes('attach')) {
      return new MonoThreadError(error.message, error);
    }

    if (message.includes('assembly') || message.includes('module')) {
      return new MonoAssemblyError(error.message, undefined, error);
    }

    if (message.includes('method') || message.includes('invoke')) {
      return new MonoMethodError(error.message, undefined, undefined, error);
    }

    if (message.includes('type') || message.includes('cast')) {
      return new MonoTypeError(error.message, undefined, undefined, error);
    }

    if (message.includes('memory') || message.includes('gc')) {
      return new MonoMemoryError(error.message, error);
    }

    // Generic Mono error
    return new MonoError(error.message, context, error);
  }

  // Non-Error objects
  return new MonoError(String(error), context);
}

/**
 * Wrap a function with standardized error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => R,
  context?: string
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      throw handleMonoError(error, context);
    }
  };
}

/**
 * Async version of error handling wrapper
 */
export async function withAsyncErrorHandling<T extends any[], R>(
  fn: (...params: T) => Promise<R>,
  params: T,
  context?: string
): Promise<R> {
  try {
    return await fn(...params);
  } catch (error) {
    throw handleMonoError(error, context);
  }
}

/**
 * Result type for operations that might fail
 */
export type MonoResult<T> = {
  success: true;
  data: T;
  error?: never;
} | {
  success: false;
  data?: never;
  error: MonoError;
};

/**
 * Create successful result
 */
export function monoSuccess<T>(data: T): MonoResult<T> {
  return { success: true, data };
}

/**
 * Create error result
 */
export function monoErrorResult<T>(error: MonoError): MonoResult<T> {
  return { success: false, error };
}

/**
 * Wrap function to return Result type instead of throwing
 */
export function asResult<T extends any[], R>(
  fn: (...args: T) => R,
  context?: string
): (...args: T) => MonoResult<R> {
  return (...args: T): MonoResult<R> => {
    try {
      const result = fn(...args);
      return monoSuccess(result);
    } catch (error) {
      return monoErrorResult(handleMonoError(error, context));
    }
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Builder for creating validation results with fluent API
 * Eliminates duplication of validation pattern across model classes
 */
export class ValidationBuilder {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Add a validation check
   */
  check(condition: boolean, errorMessage: string): this {
    if (!condition) {
      this.errors.push(errorMessage);
    }
    return this;
  }

  /**
   * Add a warning
   */
  warn(condition: boolean, warningMessage: string): this {
    if (condition) {
      this.warnings.push(warningMessage);
    }
    return this;
  }

  /**
   * Execute a function and catch errors as validation failures
   */
  execute(fn: () => void, errorPrefix?: string): this {
    try {
      fn();
    } catch (error) {
      const message = errorPrefix
        ? `${errorPrefix}: ${error}`
        : String(error);
      this.errors.push(message);
    }
    return this;
  }

  /**
   * Add a custom error
   */
  addError(errorMessage: string): this {
    this.errors.push(errorMessage);
    return this;
  }

  /**
   * Add a custom warning
   */
  addWarning(warningMessage: string): this {
    this.warnings.push(warningMessage);
    return this;
  }

  /**
   * Build and return validation result
   */
  build(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }

  /**
   * Build and throw if validation failed
   */
  buildOrThrow(context?: string): void {
    const result = this.build();
    if (!result.isValid) {
      const message = result.errors.join('; ');
      throw new MonoValidationError(message, context);
    }
  }
}
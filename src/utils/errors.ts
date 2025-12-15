/**
 * Comprehensive error handling system for Mono operations
 * Provides consistent error types and handling patterns
 *
 * Error codes and `raise` pattern for unified error messaging.
 */

import { lazy } from "./cache";

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standard error codes for Mono operations
 */
export const MonoErrorCodes = {
  // Initialization & Module
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
  RUNTIME_NOT_READY: "RUNTIME_NOT_READY",
  EXPORT_NOT_FOUND: "EXPORT_NOT_FOUND",
  INIT_FAILED: "INIT_FAILED",

  // Thread
  THREAD_ATTACH_FAILED: "THREAD_ATTACH_FAILED",
  THREAD_DETACH_FAILED: "THREAD_DETACH_FAILED",

  // Type System
  CLASS_NOT_FOUND: "CLASS_NOT_FOUND",
  METHOD_NOT_FOUND: "METHOD_NOT_FOUND",
  FIELD_NOT_FOUND: "FIELD_NOT_FOUND",
  PROPERTY_NOT_FOUND: "PROPERTY_NOT_FOUND",
  ASSEMBLY_NOT_FOUND: "ASSEMBLY_NOT_FOUND",
  IMAGE_NOT_FOUND: "IMAGE_NOT_FOUND",

  // Invocation
  INVOKE_FAILED: "INVOKE_FAILED",
  MANAGED_EXCEPTION: "MANAGED_EXCEPTION",
  JIT_FAILED: "JIT_FAILED",

  // Memory & GC
  MEMORY_ERROR: "MEMORY_ERROR",
  GC_HANDLE_ERROR: "GC_HANDLE_ERROR",

  // Resource Management
  RESOURCE_LIMIT: "RESOURCE_LIMIT",

  // Validation
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  NULL_POINTER: "NULL_POINTER",
  TYPE_MISMATCH: "TYPE_MISMATCH",

  // General
  NOT_SUPPORTED: "NOT_SUPPORTED",
  DISPOSED: "DISPOSED",
  UNKNOWN: "UNKNOWN",
} as const;

export type MonoErrorCode = (typeof MonoErrorCodes)[keyof typeof MonoErrorCodes];

// ============================================================================
// RAISE FUNCTION (unified error factory)
// ============================================================================

/**
 * Raise a MonoError with unified formatting.
 * Format: `[Mono:<code>] <action> failed: <reason>. <hint>`
 *
 * @param code Error code from MonoErrorCodes
 * @param message Action that failed + reason
 * @param hint Suggestion for fixing the issue
 * @param details Additional context (optional)
 */
export function raise(
  code: MonoErrorCode,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
  cause?: Error,
): never {
  const fullMessage = hint ? `${message}. ${hint}` : message;

  let error: MonoError;
  switch (code) {
    case MonoErrorCodes.INVALID_ARGUMENT: {
      const parameter = typeof details?.parameter === "string" ? details.parameter : undefined;
      const value = details?.value;
      error = new MonoValidationError(fullMessage, parameter, value, details, cause);
      break;
    }
    case MonoErrorCodes.INIT_FAILED:
      error = new MonoInitializationError(fullMessage, cause);
      break;
    case MonoErrorCodes.MODULE_NOT_FOUND:
      error = new MonoModuleNotFoundError(
        fullMessage,
        Array.isArray(details?.candidates) ? (details?.candidates as string[]) : undefined,
        Array.isArray(details?.loadedModules) ? (details?.loadedModules as string[]) : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.RUNTIME_NOT_READY:
      error = new MonoRuntimeNotReadyError(fullMessage, typeof details?.waitedMs === "number" ? details.waitedMs : undefined, cause);
      break;
    case MonoErrorCodes.EXPORT_NOT_FOUND:
      error = new MonoExportNotFoundError(
        fullMessage,
        typeof details?.exportName === "string" ? details.exportName : undefined,
        typeof details?.moduleName === "string" ? details.moduleName : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.THREAD_ATTACH_FAILED:
    case MonoErrorCodes.THREAD_DETACH_FAILED:
      error = new MonoThreadError(fullMessage, cause);
      break;
    case MonoErrorCodes.INVOKE_FAILED:
      error = new MonoMethodError(
        fullMessage,
        typeof details?.methodName === "string" ? details.methodName : undefined,
        typeof details?.className === "string" ? details.className : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.ASSEMBLY_NOT_FOUND: {
      const assemblyName = typeof details?.assemblyName === "string" ? details.assemblyName : undefined;
      const domainName = typeof details?.domainName === "string" ? details.domainName : undefined;
      error = domainName
        ? new MonoAssemblyNotFoundError(fullMessage, assemblyName, domainName, cause)
        : new MonoAssemblyError(fullMessage, assemblyName, cause);
      break;
    }
    case MonoErrorCodes.TYPE_MISMATCH:
      error = new MonoTypeError(
        fullMessage,
        typeof details?.expectedType === "string" ? details.expectedType : undefined,
        typeof details?.actualType === "string" ? details.actualType : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.MANAGED_EXCEPTION:
      error = new MonoManagedExceptionError(
        fullMessage,
        details?.exception instanceof NativePointer ? details.exception : undefined,
        typeof details?.exceptionType === "string" ? details.exceptionType : undefined,
        typeof details?.exceptionMessage === "string" ? details.exceptionMessage : undefined,
        typeof details?.stackTrace === "string" ? details.stackTrace : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.CLASS_NOT_FOUND:
      error = new MonoClassNotFoundError(
        fullMessage,
        typeof details?.className === "string" ? details.className : undefined,
        typeof details?.namespace === "string" ? details.namespace : undefined,
        typeof details?.imageName === "string" ? details.imageName : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.METHOD_NOT_FOUND:
      error = new MonoMethodNotFoundError(
        fullMessage,
        typeof details?.methodName === "string" ? details.methodName : undefined,
        typeof details?.className === "string" ? details.className : undefined,
        typeof details?.descriptor === "string" ? details.descriptor : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.FIELD_NOT_FOUND:
      error = new MonoFieldNotFoundError(
        fullMessage,
        typeof details?.fieldName === "string" ? details.fieldName : undefined,
        typeof details?.className === "string" ? details.className : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.PROPERTY_NOT_FOUND:
      error = new MonoPropertyNotFoundError(
        fullMessage,
        typeof details?.propertyName === "string" ? details.propertyName : undefined,
        typeof details?.className === "string" ? details.className : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.IMAGE_NOT_FOUND:
      error = new MonoImageNotFoundError(
        fullMessage,
        typeof details?.imageName === "string" ? details.imageName : undefined,
        typeof details?.assemblyName === "string" ? details.assemblyName : undefined,
        cause,
      );
      break;
    case MonoErrorCodes.MEMORY_ERROR:
      error = new MonoMemoryError(fullMessage, cause);
      break;
    case MonoErrorCodes.NOT_SUPPORTED:
      error = new MonoNotSupportedError(fullMessage, cause);
      break;
    case MonoErrorCodes.DISPOSED:
      error = new MonoDisposedError(fullMessage, cause);
      break;
    default:
      error = new MonoError(fullMessage, code, details, cause);
      break;
  }

  if (details) {
    error.details = { ...(error.details ?? {}), ...details };
  }

  throw error;
}

const MONO_CODE_PREFIX_RE = /^\[Mono:[A-Z0-9_]+\]\s*/;

function stripMonoCodePrefix(message: string): string {
  return message.replace(MONO_CODE_PREFIX_RE, "");
}

/**
 * Re-raise an unknown error as a MonoError, preserving the original as `cause`.
 *
 * Prefer this over `throw error` so the library consistently throws MonoError.
 */
export function raiseFrom(
  error: unknown,
  code: MonoErrorCode = MonoErrorCodes.UNKNOWN,
  message?: string,
  hint?: string,
  details?: Record<string, unknown>,
): never {
  const monoError = handleMonoError(error);
  const effectiveCode = code === MonoErrorCodes.UNKNOWN ? monoError.code : code;
  const effectiveMessage = message ?? stripMonoCodePrefix(monoError.message);
  const mergedDetails: Record<string, unknown> = {
    ...(monoError.details ?? {}),
    ...(details ?? {}),
    causeName: monoError.name,
    causeCode: monoError.code,
  };

  // Preserve the original error as a cause when possible.
  raise(effectiveCode, effectiveMessage, hint, mergedDetails, monoError);
}

/**
 * Raise only if condition is false
 */
export function raiseUnless(
  condition: unknown,
  code: MonoErrorCode,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    raise(code, message, hint, details);
  }
}

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

/**
 * Base Mono error class with error code support
 */
export class MonoError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: MonoErrorCode;

  /**
   * Additional context/details
   */
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    codeOrContext?: MonoErrorCode | string,
    detailsOrCause?: Record<string, unknown> | Error,
    public readonly cause?: Error,
  ) {
    // Format message with code prefix if code is provided
    const code = isMonoErrorCode(codeOrContext) ? codeOrContext : MonoErrorCodes.UNKNOWN;
    const formattedMessage = code !== MonoErrorCodes.UNKNOWN ? `[Mono:${code}] ${message}` : message;

    super(formattedMessage);
    this.name = "MonoError";
    this.code = code;

    // Handle overloaded constructor
    if (detailsOrCause instanceof Error) {
      this.cause = detailsOrCause;
      this.details = undefined;
    } else {
      this.details = detailsOrCause;
      // cause might be passed as 4th arg
    }

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MonoError);
    }
  }

  /**
   * Get full error description
   */
  @lazy get fullDescription(): string {
    let description = this.message;

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
      code: this.code,
      message: this.message,
      details: this.details,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : null,
      stack: this.stack,
    };
  }
}

/**
 * Type guard for MonoErrorCode
 */
function isMonoErrorCode(value: unknown): value is MonoErrorCode {
  return typeof value === "string" && Object.values(MonoErrorCodes).includes(value as MonoErrorCode);
}

// ============================================================================
// SPECIALIZED ERROR CLASSES
// ============================================================================

/**
 * Validation error
 */
export class MonoValidationError extends MonoError {
  constructor(
    message: string,
    public readonly parameter?: string,
    public readonly value?: unknown,
    detailsOrCause?: Record<string, unknown> | Error,
    cause?: Error,
  ) {
    const details = detailsOrCause instanceof Error ? undefined : detailsOrCause;
    const effectiveCause = detailsOrCause instanceof Error ? detailsOrCause : cause;
    super(message, MonoErrorCodes.INVALID_ARGUMENT, { ...(details ?? {}), parameter, value }, effectiveCause);
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
  cause?: Error,
): MonoValidationError {
  const message = `Parameter '${parameter}' ${reason}`;
  return new MonoValidationError(message, parameter, value, cause);
}

/**
 * Memory management error
 */
export class MonoMemoryError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, MonoErrorCodes.MEMORY_ERROR, undefined, cause);
    this.name = "MonoMemoryError";
  }
}

/**
 * Assert helper that throws a MonoError when condition fails
 */
export function monoInvariant(condition: unknown, errorFactory: () => MonoError): asserts condition {
  if (!condition) {
    const error = errorFactory();
    raiseFrom(
      error,
      error.code,
      stripMonoCodePrefix(error.message),
      undefined,
      error.details,
    );
  }
}

/**
 * Runtime initialization error
 */
export class MonoInitializationError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, MonoErrorCodes.INIT_FAILED, undefined, cause);
    this.name = "MonoInitializationError";
  }
}

/**
 * Module not found error
 */
export class MonoModuleNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly candidates?: string[],
    public readonly loadedModules?: string[],
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.MODULE_NOT_FOUND, { candidates, loadedModules }, cause);
    this.name = "MonoModuleNotFoundError";
  }
}

/**
 * Runtime not ready error (root domain not initialized)
 */
export class MonoRuntimeNotReadyError extends MonoError {
  constructor(
    message: string,
    public readonly waitedMs?: number,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.RUNTIME_NOT_READY, { waitedMs }, cause);
    this.name = "MonoRuntimeNotReadyError";
  }
}

/**
 * Export not found error
 */
export class MonoExportNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly exportName?: string,
    public readonly moduleName?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.EXPORT_NOT_FOUND, { exportName, moduleName }, cause);
    this.name = "MonoExportNotFoundError";
  }
}

/**
 * Thread management error
 */
export class MonoThreadError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, MonoErrorCodes.THREAD_ATTACH_FAILED, undefined, cause);
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
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.INVOKE_FAILED, { methodName, className }, cause);
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
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.ASSEMBLY_NOT_FOUND, { assemblyName }, cause);
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
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.TYPE_MISMATCH, { expectedType, actualType }, cause);
    this.name = "MonoTypeError";
  }
}

/**
 * Managed exception error (thrown from managed code)
 */
export class MonoManagedExceptionError extends MonoError {
  constructor(
    message: string,
    public readonly exception?: NativePointer,
    public readonly exceptionType?: string,
    public readonly exceptionMessage?: string,
    public readonly stackTrace?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.MANAGED_EXCEPTION, { exception, exceptionType, exceptionMessage, stackTrace }, cause);
    this.name = "MonoManagedExceptionError";
  }
}

/**
 * Class not found error
 */
export class MonoClassNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly className?: string,
    public readonly namespace?: string,
    public readonly imageName?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.CLASS_NOT_FOUND, { className, namespace, imageName }, cause);
    this.name = "MonoClassNotFoundError";
  }
}

/**
 * Method not found error
 */
export class MonoMethodNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly methodName?: string,
    public readonly className?: string,
    public readonly descriptor?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.METHOD_NOT_FOUND, { methodName, className, descriptor }, cause);
    this.name = "MonoMethodNotFoundError";
  }
}

/**
 * Field not found error
 */
export class MonoFieldNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly fieldName?: string,
    public readonly className?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.FIELD_NOT_FOUND, { fieldName, className }, cause);
    this.name = "MonoFieldNotFoundError";
  }
}

/**
 * Property not found error
 */
export class MonoPropertyNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly propertyName?: string,
    public readonly className?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.PROPERTY_NOT_FOUND, { propertyName, className }, cause);
    this.name = "MonoPropertyNotFoundError";
  }
}

/**
 * Image not found error
 */
export class MonoImageNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly imageName?: string,
    public readonly assemblyName?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.IMAGE_NOT_FOUND, { imageName, assemblyName }, cause);
    this.name = "MonoImageNotFoundError";
  }
}

/**
 * Assembly not found error (more specific than MonoAssemblyError)
 */
export class MonoAssemblyNotFoundError extends MonoError {
  constructor(
    message: string,
    public readonly assemblyName?: string,
    public readonly domainName?: string,
    cause?: Error,
  ) {
    super(message, MonoErrorCodes.ASSEMBLY_NOT_FOUND, { assemblyName, domainName }, cause);
    this.name = "MonoAssemblyNotFoundError";
  }
}

/**
 * Not supported error
 */
export class MonoNotSupportedError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, MonoErrorCodes.NOT_SUPPORTED, undefined, cause);
    this.name = "MonoNotSupportedError";
  }
}

/**
 * Disposed error (accessing disposed resource)
 */
export class MonoDisposedError extends MonoError {
  constructor(message: string, cause?: Error) {
    super(message, MonoErrorCodes.DISPOSED, undefined, cause);
    this.name = "MonoDisposedError";
  }
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Handle Mono errors and convert to appropriate error type
 */
export function handleMonoError(error: unknown): MonoError {
  if (error instanceof MonoError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to categorize common error patterns
    const message = error.message.toLowerCase();

    if (message.includes("thread") || message.includes("attach")) {
      return new MonoThreadError(error.message, error);
    }

    if (message.includes("assembly") || message.includes("module")) {
      return new MonoAssemblyError(error.message, undefined, error);
    }

    if (message.includes("method") || message.includes("invoke")) {
      return new MonoMethodError(error.message, undefined, undefined, error);
    }

    if (message.includes("type") || message.includes("cast")) {
      return new MonoTypeError(error.message, undefined, undefined, error);
    }

    if (message.includes("memory") || message.includes("gc")) {
      return new MonoMemoryError(error.message, error);
    }

    // Generic Mono error
    return new MonoError(error.message, MonoErrorCodes.UNKNOWN, error);
  }

  // Non-Error objects
  return new MonoError(String(error), MonoErrorCodes.UNKNOWN);
}

/**
 * Wrap a function with standardized error handling
 */
export function withErrorHandling<T extends any[], R>(fn: (...args: T) => R): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      raiseFrom(error);
    }
  };
}

/**
 * Async version of error handling wrapper
 */
export async function withAsyncErrorHandling<T extends any[], R>(
  fn: (...params: T) => Promise<R>,
  params: T,
): Promise<R> {
  try {
    return await fn(...params);
  } catch (error) {
    raiseFrom(error);
  }
}

/**
 * Result type for operations that might fail
 */
export type MonoResult<T> =
  | {
      success: true;
      data: T;
      error?: never;
    }
  | {
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
export function asResult<T extends any[], R>(fn: (...args: T) => R): (...args: T) => MonoResult<R> {
  return (...args: T): MonoResult<R> => {
    try {
      const result = fn(...args);
      return monoSuccess(result);
    } catch (error) {
      return monoErrorResult(handleMonoError(error));
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
      const message = errorPrefix ? `${errorPrefix}: ${error}` : String(error);
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
      warnings: [...this.warnings],
    };
  }

  /**
   * Build and throw if validation failed
   */
  buildOrThrow(context?: string): void {
    const result = this.build();
    if (!result.isValid) {
      const message = result.errors.join("; ");
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        message,
        context ? `Context: ${context}` : "Fix validation errors and retry",
        { context, errors: result.errors, warnings: result.warnings },
      );
    }
  }
}

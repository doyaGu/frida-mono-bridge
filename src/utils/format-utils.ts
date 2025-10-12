/**
 * Formatting and conversion utilities
 */

import { MonoError } from "../patterns/errors";

declare const NativePointer: any;

/**
 * Convert value to safe JSON representation
 * Handles NativePointer and Function types gracefully
 */
export function safeStringify(value: any): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof NativePointer) {
        return `NativePointer(${val})`;
      }
      if (typeof val === 'function') {
        return `Function(${val.name || 'anonymous'})`;
      }
      return val;
    });
  } catch (error) {
    return String(value);
  }
}

/**
 * Create error with context information
 */
export function createError(message: string, context?: any, cause?: Error): MonoError {
  const hasContext = Boolean(context);
  const formattedMessage = hasContext
    ? `${message} (Context: ${safeStringify(context)})`
    : message;
  const contextLabel = typeof context === "string" ? context : undefined;
  return new MonoError(formattedMessage, contextLabel, cause);
}

/**
 * Simple performance timer
 */
export class PerformanceTimer {
  private start: number;

  constructor() {
    this.start = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.start;
  }

  elapsedMs(): number {
    return this.elapsed();
  }

  elapsedSeconds(): number {
    return this.elapsedMs() / 1000;
  }

  restart(): void {
    this.start = Date.now();
  }
}

/**
 * Create performance timer
 */
export function createTimer(): PerformanceTimer {
  return new PerformanceTimer();
}

/**
 * Lightweight logging system with configurable levels and tags.
 *
 * Supports debug/info/warn/error levels, optional tagging, and
 * timestamp-prefixed console output.
 *
 * @module utils/log
 */

/** Logging severity levels (debug < info < warn < error). */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Configuration options for creating a Logger instance. */
export interface LoggerOptions {
  /** Minimum severity level to log. */
  level?: LogLevel;
  /** Tag to prefix log messages (e.g., "MonoClass"). */
  tag?: string;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatLogArg(arg: unknown): string {
  if (arg === null || arg === undefined) {
    return String(arg);
  }
  if (typeof arg === "string") {
    return arg;
  }
  if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint" || typeof arg === "symbol") {
    return String(arg);
  }
  if (typeof arg === "function") {
    return `Function(${arg.name || "anonymous"})`;
  }

  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(arg, (_key, value) => {
      if (typeof value === "bigint") {
        return `${value.toString()}n`;
      }
      if (value instanceof NativePointer) {
        return `NativePointer(${value})`;
      }
      if (typeof value === "function") {
        return `Function(${value.name || "anonymous"})`;
      }
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      return value;
    });
  } catch (_error) {
    return String(arg);
  }
}

/**
 * Logger with configurable level and tag.
 *
 * @example
 * ```ts
 * const logger = Logger.withTag("MyClass");
 * logger.info("Operation completed");
 * logger.warn("Potential issue", { detail: "value" });
 * ```
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly tag: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.tag = options.tag ?? "Mono";
  }

  debug(message: string, ...args: unknown[]): void {
    this.log("debug", message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log("info", message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log("warn", message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log("error", message, args);
  }

  private log(level: LogLevel, message: string, args: unknown[] = []): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) {
      return;
    }
    const time = new Date().toISOString();
    const formattedMessage = args.length > 0 ? `${message} ${args.map(arg => formatLogArg(arg)).join(" ")}` : message;

    const logMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    logMethod(`[${time}] [${this.tag}] [${level.toUpperCase()}] ${formattedMessage}`);
  }

  // Static convenience methods
  static debug(message: string, ...args: unknown[]): void {
    new Logger().debug(message, ...args);
  }

  static info(message: string, ...args: unknown[]): void {
    new Logger().info(message, ...args);
  }

  static warn(message: string, ...args: unknown[]): void {
    new Logger().warn(message, ...args);
  }

  static error(message: string, ...args: unknown[]): void {
    new Logger().error(message, ...args);
  }

  // Create tagged logger instances
  static withTag(tag: string): Logger {
    return new Logger({ tag });
  }

  // Create logger with custom level
  static withLevel(level: LogLevel): Logger {
    return new Logger({ level });
  }

  // Create logger with both tag and level
  static create(options: LoggerOptions): Logger {
    return new Logger(options);
  }
}

/**
 * Tracing model (hooks + lightweight profiling).
 *
 * This module exposes:
 * - `Tracer`: high-level helpers to hook Mono methods/fields/properties
 * - `PerformanceTracker`: lightweight call-time aggregation for compiled methods
 * - Callback/config/stat types used by the `Mono.trace` facade
 *
 * @example
 * ```ts
 * const detach = Mono.trace.method(playerUpdate, {
 *   onEnter(args) {
 *     console.log("Update args:", args.length);
 *   },
 * });
 *
 * // later
 * detach();
 * ```
 *
 * @module model/trace
 */

import type { MonoApi } from "../runtime/api";
import { MonoErrorCodes, raise } from "../utils/errors";
import { Logger } from "../utils/log";
import type { MonoClass } from "./class";
import { MonoDomain } from "./domain";
import type { MonoField } from "./field";
import type { MonoMethod } from "./method";
import type { MonoProperty } from "./property";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Basic method hook callbacks.
 *
 * `onEnter` receives the managed method arguments (excluding `this` for instance methods).
 * `onLeave` receives the raw return value pointer.
 */
export interface MethodCallbacks {
  onEnter?: (args: NativePointer[]) => void;
  onLeave?: (retval: NativePointer) => void;
}

/**
 * Method hook callbacks that receive the Frida invocation context.
 *
 * Use this when you need access to registers, thread-id, backtrace, etc.
 */
export interface MethodCallbacksExtended {
  onEnter?: (this: InvocationContext, args: NativePointer[]) => void;
  onLeave?: (this: InvocationContext, retval: InvocationReturnValue) => void;
}

/**
 * Method hook callbacks that also include a call-stack and wall-clock duration.
 */
export interface MethodCallbacksTimed {
  onEnter?: (args: NativePointer[], callStack: string[]) => void;
  onLeave?: (retval: NativePointer, durationMs: number) => void;
}

/** Field read/write callbacks. */
export interface FieldAccessCallbacks {
  onRead?: (instance: NativePointer, value: NativePointer) => void;
  onWrite?: (instance: NativePointer, oldValue: NativePointer, newValue: NativePointer) => void;
}

/** Property get/set callbacks. */
export interface PropertyAccessCallbacks {
  onGet?: (instance: NativePointer, value: NativePointer) => void;
  onSet?: (instance: NativePointer, oldValue: NativePointer, newValue: NativePointer) => void;
}

/**
 * Callback that can override a method's return value.
 *
 * Return `undefined` to keep the original value.
 */
export type ReturnValueReplacer = (
  originalRetval: NativePointer,
  thisPtr: NativePointer,
  args: NativePointer[],
) => NativePointer | void;

/** Aggregated method timing stats (milliseconds). */
export interface MethodStats {
  callCount: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  lastCallTime: number;
}

/** Summary of currently active hooks/traces. */
export interface HookStats {
  activeMethodHooks: number;
  activeFieldHooks: number;
  activePropertyHooks: number;
  trackedMethods: number;
}

/**
 * Structured access trace info (field/property).
 *
 * Intended for consumer-side logging/recording.
 */
export interface AccessTraceInfo {
  className: string;
  memberName: string;
  memberType: "field" | "property";
  isStatic: boolean;
  timestamp: number;
}

/** Tracer resource limits and logging controls. */
export interface TracerConfig {
  maxHooks: number;
  maxTrackedMethods: number;
  logOperations: boolean;
  warnOnHighUsage: boolean;
  highUsageThreshold: number;
  maxCallRecordsPerMethod: number;
  autoEvictOnLimit: boolean;
}

/** Default configuration used by `Tracer` and `PerformanceTracker`. */
export const DEFAULT_TRACER_CONFIG: TracerConfig = {
  maxHooks: 1000,
  maxTrackedMethods: 500,
  logOperations: false,
  warnOnHighUsage: true,
  highUsageThreshold: 0.8,
  maxCallRecordsPerMethod: 10000,
  autoEvictOnLimit: true,
};

/** Metadata for a single installed hook. */
export interface HookInfo {
  id: string;
  methodName: string;
  type: "method" | "field" | "property";
  createdAt: number;
  detach: () => void;
}

/**
 * Helper result shape for APIs that want a non-throwing hook attempt.
 */
export interface HookResult {
  success: boolean;
  info?: HookInfo;
  error?: string;
}

const perfLogger = Logger.withTag("PerfTracker");

/**
 * Tracks call counts and wall-clock durations for compiled methods.
 *
 * This is meant as a lightweight profiler: it attaches Frida interceptors to
 * method implementations and aggregates call timing.
 */
export class PerformanceTracker {
  private readonly stats = new Map<string, MethodStats>();
  private readonly detachers = new Map<string, () => void>();
  private readonly config: Pick<TracerConfig, "maxTrackedMethods" | "autoEvictOnLimit" | "highUsageThreshold">;
  private disposed = false;

  /**
   * @param config Optional limits controlling how many methods can be tracked.
   */
  constructor(config?: Partial<Pick<TracerConfig, "maxTrackedMethods" | "autoEvictOnLimit" | "highUsageThreshold">>) {
    this.config = {
      maxTrackedMethods: config?.maxTrackedMethods ?? DEFAULT_TRACER_CONFIG.maxTrackedMethods,
      autoEvictOnLimit: config?.autoEvictOnLimit ?? DEFAULT_TRACER_CONFIG.autoEvictOnLimit,
      highUsageThreshold: config?.highUsageThreshold ?? DEFAULT_TRACER_CONFIG.highUsageThreshold,
    };
  }

  /** Whether the tracker has been disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Number of methods currently tracked. */
  get trackedCount(): number {
    return this.stats.size;
  }

  /** Maximum number of methods that can be tracked. */
  get maxTracked(): number {
    return this.config.maxTrackedMethods;
  }

  /** Whether a new method can be tracked without eviction. */
  get hasCapacity(): boolean {
    return this.stats.size < this.config.maxTrackedMethods;
  }

  /**
   * Start tracking a method.
   *
   * @returns A detach function that stops tracking the method.
   * @throws {MonoError} If the method cannot be compiled or the tracker is disposed.
   */
  track(method: MonoMethod): () => void {
    this.ensureNotDisposed();

    const methodName = method.fullName;

    if (this.stats.has(methodName)) {
      return this.detachers.get(methodName) ?? (() => {});
    }

    this.checkCapacity();

    this.stats.set(methodName, {
      callCount: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      avgTime: 0,
      lastCallTime: 0,
    });

    const stats = this.stats.get(methodName)!;

    const impl = method.tryCompile();
    if (!impl) {
      this.stats.delete(methodName);
      raise(
        MonoErrorCodes.JIT_FAILED,
        `Cannot track uncompilable method: ${methodName}`,
        "Call method.compile() first, or use tryTrack() to avoid throwing",
        { methodName },
      );
    }

    const listener = Interceptor.attach(impl, {
      onEnter() {
        (this as any)._perfStartTime = Date.now();
      },
      onLeave() {
        const duration = Date.now() - ((this as any)._perfStartTime ?? 0);
        stats.callCount++;
        stats.totalTime += duration;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.avgTime = stats.totalTime / stats.callCount;
        stats.lastCallTime = Date.now();
      },
    });

    const detach = () => {
      listener.detach();
      this.detachers.delete(methodName);
    };

    this.detachers.set(methodName, detach);
    return detach;
  }

  /** Like {@link track} but returns `null` instead of throwing. */
  tryTrack(method: MonoMethod): (() => void) | null {
    if (this.disposed) return null;

    try {
      return this.track(method);
    } catch {
      return null;
    }
  }

  /** Stop tracking by full method name. */
  untrack(methodName: string): void {
    const detach = this.detachers.get(methodName);
    if (detach) {
      detach();
    }
    this.stats.delete(methodName);
    this.detachers.delete(methodName);
  }

  /** Whether the given method name is currently tracked. */
  isTracking(methodName: string): boolean {
    return this.stats.has(methodName);
  }

  /** Get current stats for a tracked method. */
  getStats(methodName: string): MethodStats | undefined {
    return this.stats.get(methodName);
  }

  /** Get a snapshot of all tracked stats. */
  getAllStats(): Map<string, MethodStats> {
    return new Map(this.stats);
  }

  /** List tracked method names (full names). */
  getTrackedNames(): string[] {
    return Array.from(this.stats.keys());
  }

  /**
   * Render a human-readable report.
   * @param sortBy Sorting key for the report.
   */
  getReport(sortBy: "totalTime" | "callCount" | "avgTime" = "totalTime"): string {
    const lines: string[] = ["=== Performance Report ==="];

    const entries = Array.from(this.stats.entries()).sort((a, b) => {
      switch (sortBy) {
        case "callCount":
          return b[1].callCount - a[1].callCount;
        case "avgTime":
          return b[1].avgTime - a[1].avgTime;
        case "totalTime":
        default:
          return b[1].totalTime - a[1].totalTime;
      }
    });

    if (entries.length === 0) {
      lines.push("No methods being tracked.");
      return lines.join("\n");
    }

    lines.push(`Tracking ${entries.length} methods:`);
    lines.push("");

    for (const [name, s] of entries) {
      lines.push(`${name}:`);
      lines.push(`  Calls: ${s.callCount}`);
      lines.push(`  Total: ${s.totalTime.toFixed(2)}ms`);
      lines.push(`  Avg: ${s.avgTime.toFixed(2)}ms`);
      lines.push(`  Min: ${s.minTime === Infinity ? "N/A" : s.minTime.toFixed(2) + "ms"}`);
      lines.push(`  Max: ${s.maxTime.toFixed(2)}ms`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /** Reset all counters and timings (keeps tracking enabled). */
  reset(): void {
    this.resetStats();
  }

  /** Reset all counters and timings (keeps tracking enabled). */
  resetStats(): void {
    for (const [_name, stats] of this.stats) {
      stats.callCount = 0;
      stats.totalTime = 0;
      stats.minTime = Infinity;
      stats.maxTime = 0;
      stats.avgTime = 0;
      stats.lastCallTime = 0;
    }
  }

  /** Detach all interceptors and clear tracked stats. */
  clear(): void {
    for (const detach of this.detachers.values()) {
      try {
        detach();
      } catch {
        // ignore detach errors
      }
    }
    this.detachers.clear();
    this.stats.clear();
  }

  /** Detach all interceptors and permanently dispose this instance. */
  dispose(): void {
    if (this.disposed) return;

    this.clear();
    this.disposed = true;

    perfLogger.debug("PerformanceTracker disposed");
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      raise(
        MonoErrorCodes.DISPOSED,
        "PerformanceTracker has been disposed",
        "Create a new PerformanceTracker instance",
      );
    }
  }

  private checkCapacity(): void {
    const current = this.stats.size;
    const max = this.config.maxTrackedMethods;

    const threshold = max * this.config.highUsageThreshold;
    if (current >= threshold && current < max) {
      perfLogger.warn(
        `Performance tracker at ${((current / max) * 100).toFixed(1)}% capacity ` +
          `(${current}/${max}). Consider removing unused tracked methods.`,
      );
    }

    if (current >= max) {
      if (this.config.autoEvictOnLimit) {
        this.evictLeastUsed();
      } else {
        raise(
          MonoErrorCodes.RESOURCE_LIMIT,
          `Performance tracker limit reached: ${current}/${max}`,
          "Remove tracked methods or increase maxTrackedMethods",
        );
      }
    }
  }

  private evictLeastUsed(): void {
    let oldestName: string | null = null;
    let oldestTime = Infinity;

    for (const [name, stats] of this.stats) {
      if (stats.lastCallTime < oldestTime) {
        oldestTime = stats.lastCallTime;
        oldestName = name;
      }
    }

    if (oldestName) {
      perfLogger.debug(`Evicting least-used tracked method: ${oldestName}`);
      this.untrack(oldestName);
    }
  }
}

/**
 * Create a {@link PerformanceTracker}.
 *
 * @param config Optional limits controlling tracking capacity.
 */
export function createPerformanceTracker(
  config?: Partial<Pick<TracerConfig, "maxTrackedMethods" | "autoEvictOnLimit" | "highUsageThreshold">>,
): PerformanceTracker {
  return new PerformanceTracker(config);
}

const traceLogger = Logger.withTag("Tracer");

function extractMethodArgs(method: MonoMethod, args: InvocationArguments): NativePointer[] {
  const monoArgs: NativePointer[] = [];
  const paramCount = method.parameterCount;
  const isInstance = method.isInstanceMethod;
  const startIdx = isInstance ? 1 : 0;

  for (let i = 0; i < paramCount; i++) {
    monoArgs.push(args[startIdx + i]);
  }

  return monoArgs;
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

let hookIdCounter = 0;
function generateHookId(): string {
  return `hook_${++hookIdCounter}_${Date.now()}`;
}

/**
 * High-level tracing/hooking helper.
 *
 * This class installs Frida interceptors against compiled Mono method implementations.
 * Hooks are tracked so they can be detached later.
 */
export class Tracer {
  private readonly hooks = new Map<string, HookInfo>();
  private readonly config: TracerConfig;
  private disposed = false;

  /**
   * @param api Low-level Mono API used for find/search helpers.
   * @param config Optional resource limits and logging configuration.
   */
  constructor(
    private readonly api: MonoApi,
    config?: Partial<TracerConfig>,
  ) {
    this.config = { ...DEFAULT_TRACER_CONFIG, ...config };
  }

  /** Whether this tracer has been disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Number of active hooks currently installed. */
  get activeHookCount(): number {
    return this.hooks.size;
  }

  /** Maximum number of hooks allowed by config. */
  get maxHooks(): number {
    return this.config.maxHooks;
  }

  /** Whether a new hook can be installed without exceeding limits. */
  get hasCapacity(): boolean {
    return this.hooks.size < this.config.maxHooks;
  }

  /** Current effective configuration (defaults merged with overrides). */
  get currentConfig(): Readonly<TracerConfig> {
    return { ...this.config };
  }

  /**
   * Hook a method.
   * @returns A detach function.
   */
  method(monoMethod: MonoMethod, callbacks: MethodCallbacks): () => void {
    this.ensureNotDisposed();
    this.checkHookLimit();

    const impl = monoMethod.compile();
    const methodName = monoMethod.fullName;
    const hookId = generateHookId();

    const listener = Interceptor.attach(impl, {
      onEnter(args) {
        if (callbacks.onEnter) {
          callbacks.onEnter(extractMethodArgs(monoMethod, args));
        }
      },
      onLeave(retval) {
        if (callbacks.onLeave) {
          callbacks.onLeave(retval);
        }
      },
    });

    const detach = () => {
      listener.detach();
      this.hooks.delete(hookId);
      if (this.config.logOperations) {
        traceLogger.debug(`Detached hook: ${methodName}`);
      }
    };

    const hookInfo: HookInfo = {
      id: hookId,
      methodName,
      type: "method",
      createdAt: Date.now(),
      detach,
    };

    this.hooks.set(hookId, hookInfo);

    if (this.config.logOperations) {
      traceLogger.debug(`Hooked method: ${methodName}`);
    }

    return detach;
  }

  /**
   * Like {@link method} but returns `null` instead of throwing when compilation/hooking fails.
   */
  tryMethod(monoMethod: MonoMethod, callbacks: MethodCallbacks): (() => void) | null {
    if (this.disposed || !this.hasCapacity) return null;

    const impl = monoMethod.tryCompile();
    if (!impl) return null;

    try {
      const methodName = monoMethod.fullName;
      const hookId = generateHookId();

      const listener = Interceptor.attach(impl, {
        onEnter(args) {
          if (callbacks.onEnter) {
            callbacks.onEnter(extractMethodArgs(monoMethod, args));
          }
        },
        onLeave(retval) {
          if (callbacks.onLeave) {
            callbacks.onLeave(retval);
          }
        },
      });

      const detach = () => {
        listener.detach();
        this.hooks.delete(hookId);
      };

      this.hooks.set(hookId, {
        id: hookId,
        methodName,
        type: "method",
        createdAt: Date.now(),
        detach,
      });

      return detach;
    } catch (error) {
      traceLogger.debug(`Failed to hook ${monoMethod.fullName}: ${error}`);
      return null;
    }
  }

  /** Hook a method with Frida invocation context support. */
  methodExtended(monoMethod: MonoMethod, callbacks: MethodCallbacksExtended): () => void {
    this.ensureNotDisposed();
    this.checkHookLimit();

    const impl = monoMethod.compile();
    const methodName = monoMethod.fullName;
    const hookId = generateHookId();

    const listener = Interceptor.attach(impl, {
      onEnter(args) {
        if (callbacks.onEnter) {
          callbacks.onEnter.call(this, extractMethodArgs(monoMethod, args));
        }
      },
      onLeave(retval) {
        if (callbacks.onLeave) {
          callbacks.onLeave.call(this, retval);
        }
      },
    });

    const detach = () => {
      listener.detach();
      this.hooks.delete(hookId);
    };

    this.hooks.set(hookId, {
      id: hookId,
      methodName,
      type: "method",
      createdAt: Date.now(),
      detach,
    });

    return detach;
  }

  /** Like {@link methodExtended} but returns `null` instead of throwing. */
  tryMethodExtended(monoMethod: MonoMethod, callbacks: MethodCallbacksExtended): (() => void) | null {
    if (this.disposed || !this.hasCapacity) return null;

    const impl = monoMethod.tryCompile();
    if (!impl) return null;

    try {
      const methodName = monoMethod.fullName;
      const hookId = generateHookId();

      const listener = Interceptor.attach(impl, {
        onEnter(args) {
          if (callbacks.onEnter) {
            callbacks.onEnter.call(this, extractMethodArgs(monoMethod, args));
          }
        },
        onLeave(retval) {
          if (callbacks.onLeave) {
            callbacks.onLeave.call(this, retval);
          }
        },
      });

      const detach = () => {
        listener.detach();
        this.hooks.delete(hookId);
      };

      this.hooks.set(hookId, {
        id: hookId,
        methodName,
        type: "method",
        createdAt: Date.now(),
        detach,
      });

      return detach;
    } catch (error) {
      traceLogger.debug(`Failed to hook extended ${monoMethod.fullName}: ${error}`);
      return null;
    }
  }

  /**
   * Hook a method and optionally replace its return value.
   *
   * The replacer can return a new pointer to override the original return value.
   */
  replaceReturnValue(monoMethod: MonoMethod, replacement: ReturnValueReplacer): () => void {
    this.ensureNotDisposed();
    this.checkHookLimit();

    const impl = monoMethod.compile();
    const methodName = monoMethod.fullName;
    const hookId = generateHookId();

    const listener = Interceptor.attach(impl, {
      onEnter(args) {
        const isInstance = monoMethod.isInstanceMethod;
        (this as any).thisPtr = isInstance ? args[0] : ptr(0);
        (this as any).methodArgs = extractMethodArgs(monoMethod, args);
      },
      onLeave(retval) {
        const result = replacement(retval, (this as any).thisPtr, (this as any).methodArgs);
        if (result !== undefined) {
          retval.replace(result);
        }
      },
    });

    const detach = () => {
      listener.detach();
      this.hooks.delete(hookId);
      if (this.config.logOperations) {
        traceLogger.debug(`Detached return replacer: ${methodName}`);
      }
    };

    this.hooks.set(hookId, {
      id: hookId,
      methodName,
      type: "method",
      createdAt: Date.now(),
      detach,
    });

    return detach;
  }

  /** Like {@link replaceReturnValue} but returns `null` instead of throwing. */
  tryReplaceReturnValue(monoMethod: MonoMethod, replacement: ReturnValueReplacer): (() => void) | null {
    if (this.disposed || !this.hasCapacity) return null;

    const impl = monoMethod.tryCompile();
    if (!impl) return null;

    try {
      const methodName = monoMethod.fullName;
      const hookId = generateHookId();

      const listener = Interceptor.attach(impl, {
        onEnter(args) {
          const isInstance = monoMethod.isInstanceMethod;
          (this as any).thisPtr = isInstance ? args[0] : ptr(0);
          (this as any).methodArgs = extractMethodArgs(monoMethod, args);
        },
        onLeave(retval) {
          const result = replacement(retval, (this as any).thisPtr, (this as any).methodArgs);
          if (result !== undefined) {
            retval.replace(result);
          }
        },
      });

      const detach = () => {
        listener.detach();
        this.hooks.delete(hookId);
      };

      this.hooks.set(hookId, {
        id: hookId,
        methodName,
        type: "method",
        createdAt: Date.now(),
        detach,
      });

      return detach;
    } catch (error) {
      traceLogger.debug(`Failed to replace return value for ${monoMethod.fullName}: ${error}`);
      return null;
    }
  }

  /**
   * Hook a method and provide a symbolized call-stack + duration.
   *
   * Note: Symbolization and accurate backtraces may be expensive.
   */
  methodWithCallStack(monoMethod: MonoMethod, callbacks: MethodCallbacksTimed): () => void {
    this.ensureNotDisposed();
    this.checkHookLimit();

    const impl = monoMethod.compile();
    const methodName = monoMethod.fullName;
    const hookId = generateHookId();

    const listener = Interceptor.attach(impl, {
      onEnter(args) {
        const backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE);
        const callStack = backtrace.map(addr => {
          const symbol = DebugSymbol.fromAddress(addr);
          return symbol ? `${symbol.moduleName}!${symbol.name}` : addr.toString();
        });

        (this as any)._startTime = Date.now();

        if (callbacks.onEnter) {
          callbacks.onEnter(extractMethodArgs(monoMethod, args), callStack);
        }
      },
      onLeave(retval) {
        const duration = Date.now() - ((this as any)._startTime ?? 0);

        if (callbacks.onLeave) {
          callbacks.onLeave(retval, duration);
        }
      },
    });

    const detach = () => {
      listener.detach();
      this.hooks.delete(hookId);
    };

    this.hooks.set(hookId, {
      id: hookId,
      methodName,
      type: "method",
      createdAt: Date.now(),
      detach,
    });

    return detach;
  }

  /**
   * Hook all methods of a class.
   * @returns A detach-all function.
   */
  classAll(klass: MonoClass, callbacks: MethodCallbacks): () => void {
    this.ensureNotDisposed();

    const methods = klass.methods;
    const detachers: Array<() => void> = [];

    for (const m of methods) {
      const detach = this.tryMethod(m, callbacks);
      if (detach) {
        detachers.push(detach);
      } else {
        traceLogger.debug(`Skipped unhookable method: ${m.fullName}`);
      }
    }

    return () => {
      detachers.forEach(d => d());
    };
  }

  /**
   * Find methods by pattern and hook them.
   * @returns A detach-all function.
   */
  methodsByPattern(pattern: string, callbacks: MethodCallbacks, _domain?: MonoDomain): () => void {
    this.ensureNotDisposed();
    const domain = _domain ?? MonoDomain.getRoot(this.api);
    const methods = domain.findMethods(pattern);
    const detachers: Array<() => void> = [];
    let hookedCount = 0;

    traceLogger.info(`Found ${methods.length} methods matching "${pattern}"`);

    for (const m of methods) {
      const detach = this.tryMethod(m, {
        onEnter(args) {
          if (callbacks.onEnter) {
            traceLogger.debug(`-> ${m.fullName}`);
            callbacks.onEnter(args);
          }
        },
        onLeave(retval) {
          if (callbacks.onLeave) {
            traceLogger.debug(`<- ${m.fullName}`);
            callbacks.onLeave(retval);
          }
        },
      });
      if (detach) {
        detachers.push(detach);
        hookedCount++;
      }
    }

    traceLogger.info(`Successfully hooked ${hookedCount}/${methods.length} methods`);

    return () => {
      detachers.forEach(d => d());
    };
  }

  /**
   * Find classes by pattern and hook all methods on each class.
   * @returns A detach-all function.
   */
  classesByPattern(pattern: string, callbacks: MethodCallbacks): () => void {
    this.ensureNotDisposed();
    const domain = MonoDomain.getRoot(this.api);
    const classes = domain.findClasses(pattern);
    const detachers: Array<() => void> = [];

    traceLogger.info(`Tracing ${classes.length} classes matching "${pattern}"`);

    for (const klass of classes) {
      const detach = this.classAll(klass, callbacks);
      detachers.push(detach);
    }

    return () => {
      detachers.forEach(d => d());
    };
  }

  /**
   * Best-effort field access tracing.
   *
   * Currently implemented by attempting to hook matching property accessors when possible.
   * Returns `null` when tracing cannot be installed.
   */
  field(monoField: MonoField, callbacks: FieldAccessCallbacks): (() => void) | null {
    this.ensureNotDisposed();

    const klass = monoField.parent;
    const fieldName = monoField.name;

    const property =
      klass.tryProperty(fieldName) || klass.tryProperty(capitalize(fieldName)) || klass.tryProperty(`_${fieldName}`);

    if (property) {
      traceLogger.debug(`Using property accessors for field ${fieldName}`);
      return this.property(property, {
        onGet: callbacks.onRead,
        onSet: callbacks.onWrite,
      });
    }

    if (monoField.isStatic) {
      traceLogger.warn(`Static field tracing for ${klass.name}.${fieldName} not implemented`);
    } else {
      traceLogger.warn(`Cannot trace field ${klass.name}.${fieldName} - no accessor methods found`);
    }

    return null;
  }

  /** Find fields by pattern and attempt to trace access. */
  fieldsByPattern(pattern: string, callbacks: FieldAccessCallbacks): () => void {
    this.ensureNotDisposed();
    const domain = MonoDomain.getRoot(this.api);
    const fields = domain.findFields(pattern);
    const detachers: Array<() => void> = [];
    let tracedCount = 0;

    traceLogger.info(`Attempting to trace ${fields.length} fields matching "${pattern}"`);

    for (const f of fields) {
      try {
        const detach = this.field(f, callbacks);
        if (detach) {
          detachers.push(detach);
          tracedCount++;
        }
      } catch {
        // ignore
      }
    }

    traceLogger.info(`Successfully traced ${tracedCount}/${fields.length} fields`);

    return () => {
      detachers.forEach(d => d());
    };
  }

  /** Hook property getters/setters (when present). */
  property(monoProperty: MonoProperty, callbacks: PropertyAccessCallbacks): () => void {
    this.ensureNotDisposed();

    const detachers: Array<() => void> = [];
    const propertyName = monoProperty.name;
    const className = monoProperty.parent.name;

    const getter = monoProperty.getter;
    if (getter && callbacks.onGet) {
      try {
        const detach = this.tryMethod(getter, {
          onLeave(retval) {
            if (callbacks.onGet) {
              callbacks.onGet(NULL, retval);
            }
          },
        });
        if (detach) {
          detachers.push(detach);
          traceLogger.debug(`Hooked getter for ${className}.${propertyName}`);
        }
      } catch (error) {
        traceLogger.warn(`Failed to hook getter: ${error}`);
      }
    }

    const setter = monoProperty.setter;
    if (setter && callbacks.onSet) {
      try {
        const detach = this.tryMethodExtended(setter, {
          onEnter(args) {
            const isInstance = setter.isInstanceMethod;
            const newValueIdx = isInstance ? 1 : 0;
            (this as any)._newValue = args.length > newValueIdx ? args[newValueIdx] : NULL;
          },
          onLeave() {
            if (callbacks.onSet) {
              callbacks.onSet(NULL, NULL, (this as any)._newValue);
            }
          },
        });
        if (detach) {
          detachers.push(detach);
          traceLogger.debug(`Hooked setter for ${className}.${propertyName}`);
        }
      } catch (error) {
        traceLogger.warn(`Failed to hook setter: ${error}`);
      }
    }

    if (detachers.length === 0) {
      traceLogger.warn(`No accessors found for property ${className}.${propertyName}`);
    }

    return () => {
      detachers.forEach(d => d());
    };
  }

  /** Find properties by pattern and hook accessors. */
  propertiesByPattern(pattern: string, callbacks: PropertyAccessCallbacks): () => void {
    this.ensureNotDisposed();
    const domain = MonoDomain.getRoot(this.api);
    const properties = domain.findProperties(pattern);
    const detachers: Array<() => void> = [];

    traceLogger.info(`Tracing ${properties.length} properties matching "${pattern}"`);

    for (const p of properties) {
      try {
        const detach = this.property(p, callbacks);
        detachers.push(detach);
      } catch {
        // ignore
      }
    }

    return () => {
      detachers.forEach(d => d());
    };
  }

  /** Create a {@link PerformanceTracker} using current tracer defaults. */
  createPerformanceTracker(
    config?: Partial<Pick<TracerConfig, "maxTrackedMethods" | "autoEvictOnLimit" | "highUsageThreshold">>,
  ): PerformanceTracker {
    return createPerformanceTracker(
      config ?? {
        maxTrackedMethods: this.config.maxTrackedMethods,
        autoEvictOnLimit: this.config.autoEvictOnLimit,
        highUsageThreshold: this.config.highUsageThreshold,
      },
    );
  }

  /** Get counts of currently installed hooks. */
  getHookStats(): HookStats {
    let methodHooks = 0;
    let fieldHooks = 0;
    let propertyHooks = 0;

    for (const hook of this.hooks.values()) {
      switch (hook.type) {
        case "method":
          methodHooks++;
          break;
        case "field":
          fieldHooks++;
          break;
        case "property":
          propertyHooks++;
          break;
      }
    }

    return {
      activeMethodHooks: methodHooks,
      activeFieldHooks: fieldHooks,
      activePropertyHooks: propertyHooks,
      trackedMethods: 0,
    };
  }

  /** Get a snapshot of all active hooks. */
  getActiveHooks(): HookInfo[] {
    return Array.from(this.hooks.values());
  }

  /** Detach all hooks currently installed by this tracer. */
  detachAll(): void {
    for (const hook of this.hooks.values()) {
      try {
        hook.detach();
      } catch {
        // ignore
      }
    }
    this.hooks.clear();
  }

  /** Detach all hooks and permanently dispose this instance. */
  dispose(): void {
    if (this.disposed) return;

    this.detachAll();
    this.disposed = true;

    traceLogger.debug("Tracer disposed");
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      raise(
        MonoErrorCodes.DISPOSED,
        "Tracer has been disposed",
        "Create a new Tracer instance or avoid using after dispose()",
      );
    }
  }

  private checkHookLimit(): void {
    const current = this.hooks.size;
    const max = this.config.maxHooks;

    if (this.config.warnOnHighUsage) {
      const threshold = max * this.config.highUsageThreshold;
      if (current >= threshold && current < max) {
        traceLogger.warn(
          `Hook usage at ${((current / max) * 100).toFixed(1)}% ` +
            `(${current}/${max}). Consider detaching unused hooks.`,
        );
      }
    }

    if (current >= max) {
      raise(
        MonoErrorCodes.RESOURCE_LIMIT,
        `Hook limit reached: ${current}/${max}`,
        "Detach unused hooks or increase config.maxHooks",
      );
    }
  }
}

/**
 * Create a {@link Tracer}.
 * @param api Low-level Mono API.
 * @param config Optional resource limits and logging configuration.
 */
export function createTracer(api: MonoApi, config?: Partial<TracerConfig>): Tracer {
  return new Tracer(api, config);
}

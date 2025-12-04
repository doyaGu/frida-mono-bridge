/**
 * Tracing and hooking utilities for monitoring Mono runtime behavior
 */

import { MonoClass } from "../model/class";
import { MonoField } from "../model/field";
import { MonoMethod } from "../model/method";
import { MonoProperty } from "../model/property";
import { MonoApi } from "../runtime/api";
import * as Find from "./find";
import { Logger } from "./log";

const traceLogger = Logger.withTag("Trace");

export interface MethodCallbacks {
  onEnter?: (args: NativePointer[]) => void;
  onLeave?: (retval: NativePointer) => void;
}

/**
 * Extended method callbacks with access to invocation context
 */
export interface MethodCallbacksExtended {
  onEnter?: (this: InvocationContext, args: NativePointer[]) => void;
  onLeave?: (this: InvocationContext, retval: InvocationReturnValue) => void;
}

/**
 * Callbacks for field access tracing
 */
export interface FieldAccessCallbacks {
  onRead?: (instance: NativePointer, value: NativePointer) => void;
  onWrite?: (instance: NativePointer, oldValue: NativePointer, newValue: NativePointer) => void;
}

/**
 * Callbacks for property access tracing
 */
export interface PropertyAccessCallbacks {
  onGet?: (instance: NativePointer, value: NativePointer) => void;
  onSet?: (instance: NativePointer, oldValue: NativePointer, newValue: NativePointer) => void;
}

/**
 * Information about a traced field/property access
 */
export interface AccessTraceInfo {
  className: string;
  memberName: string;
  memberType: "field" | "property";
  isStatic: boolean;
  timestamp: number;
}

/**
 * Extract method arguments from Frida's InvocationArguments
 */
function extractMethodArgs(method: MonoMethod, args: InvocationArguments): NativePointer[] {
  const monoArgs: NativePointer[] = [];
  const paramCount = method.getParameterCount();
  const isInstance = method.isInstanceMethod();
  const startIdx = isInstance ? 1 : 0;

  for (let i = 0; i < paramCount; i++) {
    monoArgs.push(args[startIdx + i]);
  }

  return monoArgs;
}

/**
 * Hook a single method
 *
 * @param method Method to hook
 * @param callbacks Callbacks for entry/exit
 * @returns Detach function that only detaches this specific hook
 */
export function method(monoMethod: MonoMethod, callbacks: MethodCallbacks): () => void {
  const impl = monoMethod.api.native.mono_compile_method(monoMethod.pointer);

  if (impl.isNull()) {
    throw new Error(`Failed to compile method: ${monoMethod.getFullName()}`);
  }

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

  return () => listener.detach();
}

/**
 * Hook a single method with extended context access
 *
 * @param method Method to hook
 * @param callbacks Callbacks for entry/exit with access to InvocationContext
 * @returns Detach function
 */
export function methodExtended(monoMethod: MonoMethod, callbacks: MethodCallbacksExtended): () => void {
  const impl = monoMethod.api.native.mono_compile_method(monoMethod.pointer);

  if (impl.isNull()) {
    throw new Error(`Failed to compile method: ${monoMethod.getFullName()}`);
  }

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

  return () => listener.detach();
}

/**
 * Replace a method's return value.
 * The replacement function is called after the original method executes,
 * allowing you to modify or replace the return value.
 *
 * @param method Method to intercept
 * @param replacement Function that receives (originalRetval, thisPtr, ...args) and returns new result
 * @returns Revert function to restore original behavior
 */
export function replaceReturnValue(
  monoMethod: MonoMethod,
  replacement: (originalRetval: NativePointer, thisPtr: NativePointer, args: NativePointer[]) => NativePointer | void,
): () => void {
  const impl = monoMethod.api.native.mono_compile_method(monoMethod.pointer);

  if (impl.isNull()) {
    throw new Error(`Failed to compile method: ${monoMethod.getFullName()}`);
  }

  const listener = Interceptor.attach(impl, {
    onEnter(args) {
      const isInstance = monoMethod.isInstanceMethod();
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

  return () => listener.detach();
}

/**
 * Hook all methods in a class
 *
 * @param klass Class to hook
 * @param callbacks Callbacks for entry/exit
 * @returns Detach function
 */
export function classAll(klass: MonoClass, callbacks: MethodCallbacks): () => void {
  const methods = klass.getMethods();
  const detachers: Array<() => void> = [];

  for (const m of methods) {
    try {
      const detach = method(m, callbacks);
      detachers.push(detach);
    } catch (error) {
      // Some methods might not be hookable (abstract, etc)
      traceLogger.warn(`Failed to hook ${m.getFullName()}: ${error}`);
    }
  }

  return () => {
    detachers.forEach(d => d());
  };
}

/**
 * Hook all methods matching a pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern for method names
 * @param callbacks Callbacks for entry/exit
 * @returns Detach function
 *
 * @example
 * // Trace all Attack methods
 * Mono.trace.methods("*Attack*", {
 *   onEnter(args) {
 *     console.log("Attack called");
 *   }
 * });
 */
export function methodsByPattern(api: MonoApi, pattern: string, callbacks: MethodCallbacks): () => void {
  const methods = Find.methods(api, pattern);
  const detachers: Array<() => void> = [];

  traceLogger.info(`Tracing ${methods.length} methods matching "${pattern}"`);

  for (const m of methods) {
    try {
      const detach = method(m, {
        onEnter(args) {
          if (callbacks.onEnter) {
            traceLogger.debug(`-> ${m.getFullName()}`);
            callbacks.onEnter(args);
          }
        },
        onLeave(retval) {
          if (callbacks.onLeave) {
            traceLogger.debug(`<- ${m.getFullName()}`);
            callbacks.onLeave(retval);
          }
        },
      });
      detachers.push(detach);
    } catch (error) {
      traceLogger.warn(`Failed to hook ${m.getFullName()}`);
    }
  }

  return () => {
    detachers.forEach(d => d());
  };
}

/**
 * Hook all classes matching a pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern for class names
 * @param callbacks Callbacks for entry/exit
 * @returns Detach function
 *
 * @example
 * // Trace all classes in Game namespace
 * Mono.trace.classes("Game.*", {
 *   onEnter(args) {
 *     console.log("Method called");
 *   }
 * });
 */
export function classesByPattern(api: MonoApi, pattern: string, callbacks: MethodCallbacks): () => void {
  const classes = Find.classes(api, pattern);
  const detachers: Array<() => void> = [];

  traceLogger.info(`Tracing ${classes.length} classes matching "${pattern}"`);

  for (const klass of classes) {
    const detach = classAll(klass, callbacks);
    detachers.push(detach);
  }

  return () => {
    detachers.forEach(d => d());
  };
}

// ===== FIELD TRACING =====

/**
 * Trace field access by hooking getter/setter methods if available,
 * or by monitoring memory access patterns.
 *
 * Note: Direct field access cannot be intercepted at the instruction level
 * without advanced techniques. This function traces property-style access
 * patterns when the field has associated accessor methods.
 *
 * @param field The field to trace
 * @param callbacks Callbacks for read/write access
 * @returns Detach function, or null if tracing is not possible
 *
 * @example
 * const playerHealth = playerClass.field('health');
 * Mono.trace.field(playerHealth, {
 *   onRead: (instance, value) => console.log(`Health read: ${value}`),
 *   onWrite: (instance, oldVal, newVal) => console.log(`Health changed: ${oldVal} -> ${newVal}`)
 * });
 */
export function field(monoField: MonoField, callbacks: FieldAccessCallbacks): (() => void) | null {
  // Direct field access at the memory level is hard to intercept
  // We can try to find associated property accessors or use memory watches

  const klass = monoField.getParent();
  const fieldName = monoField.getName();

  // Try to find a property with the same name (common C# pattern)
  const property =
    klass.tryGetProperty(fieldName) ||
    klass.tryGetProperty(capitalize(fieldName)) ||
    klass.tryGetProperty(`_${fieldName}`);

  if (property) {
    traceLogger.debug(`Using property accessors for field ${fieldName}`);
    return propertyTrace(property, {
      onGet: callbacks.onRead,
      onSet: callbacks.onWrite,
    });
  }

  // For static fields, we can potentially use memory watches
  if (monoField.isStatic()) {
    return traceStaticField(monoField, callbacks);
  }

  traceLogger.warn(`Cannot trace field ${klass.getName()}.${fieldName} - no accessor methods found`);
  traceLogger.warn(`Consider using a memory watch or hooking methods that access this field`);
  return null;
}

/**
 * Trace a static field using memory access monitoring
 */
function traceStaticField(monoField: MonoField, _callbacks: FieldAccessCallbacks): (() => void) | null {
  const klass = monoField.getParent();
  const vtable = klass.getVTable();

  if (!vtable || vtable.isNull()) {
    traceLogger.warn(`Cannot get VTable for ${klass.getName()}`);
    return null;
  }

  // Static fields are stored in the VTable's static data area
  // This is a complex operation that requires understanding mono's internal structures
  traceLogger.warn(`Static field tracing via memory watch is experimental`);

  // Log the field info for manual debugging
  const offset = monoField.getOffset();
  traceLogger.debug(`Static field ${monoField.getName()} offset: ${offset}`);

  return null;
}

/**
 * Trace multiple fields matching a pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern for field names
 * @param callbacks Callbacks for read/write access
 * @returns Detach function
 */
export function fieldsByPattern(api: MonoApi, pattern: string, callbacks: FieldAccessCallbacks): () => void {
  const fields = Find.fields(api, pattern);
  const detachers: Array<() => void> = [];
  let tracedCount = 0;

  traceLogger.info(`Attempting to trace ${fields.length} fields matching "${pattern}"`);

  for (const f of fields) {
    try {
      const detach = field(f, callbacks);
      if (detach) {
        detachers.push(detach);
        tracedCount++;
      }
    } catch (error) {
      // Field might not be traceable
    }
  }

  traceLogger.info(`Successfully traced ${tracedCount}/${fields.length} fields`);

  return () => {
    detachers.forEach(d => d());
  };
}

// ===== PROPERTY TRACING =====

/**
 * Trace property access by hooking the getter and setter methods
 *
 * @param property The property to trace
 * @param callbacks Callbacks for get/set access
 * @returns Detach function
 *
 * @example
 * const nameProperty = playerClass.property('Name');
 * Mono.trace.property(nameProperty, {
 *   onGet: (instance, value) => console.log(`Name read: ${value}`),
 *   onSet: (instance, oldVal, newVal) => console.log(`Name changed`)
 * });
 */
export function propertyTrace(monoProperty: MonoProperty, callbacks: PropertyAccessCallbacks): () => void {
  const detachers: Array<() => void> = [];
  const propertyName = monoProperty.name;
  const className = monoProperty.parent.getName();

  // Hook the getter if available
  const getter = monoProperty.getter;
  if (getter && callbacks.onGet) {
    try {
      const detach = method(getter, {
        onLeave(retval) {
          if (callbacks.onGet) {
            callbacks.onGet(NULL, retval); // Instance captured in context
          }
        },
      });
      detachers.push(detach);
      traceLogger.debug(`Hooked getter for ${className}.${propertyName}`);
    } catch (error) {
      traceLogger.warn(`Failed to hook getter: ${error}`);
    }
  }

  // Hook the setter if available
  const setter = monoProperty.setter;
  if (setter && callbacks.onSet) {
    try {
      const detach = methodExtended(setter, {
        onEnter(args) {
          // Store the new value being set
          const isInstance = setter.isInstanceMethod();
          const newValueIdx = isInstance ? 1 : 0;
          (this as any).newValue = args.length > newValueIdx ? args[newValueIdx] : NULL;
        },
        onLeave() {
          if (callbacks.onSet) {
            // We don't have the old value easily accessible
            callbacks.onSet(NULL, NULL, (this as any).newValue);
          }
        },
      });
      detachers.push(detach);
      traceLogger.debug(`Hooked setter for ${className}.${propertyName}`);
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

/**
 * Trace multiple properties matching a pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern for property names
 * @param callbacks Callbacks for get/set access
 * @returns Detach function
 */
export function propertiesByPattern(api: MonoApi, pattern: string, callbacks: PropertyAccessCallbacks): () => void {
  const properties = Find.properties(api, pattern);
  const detachers: Array<() => void> = [];

  traceLogger.info(`Tracing ${properties.length} properties matching "${pattern}"`);

  for (const p of properties) {
    try {
      const detach = propertyTrace(p, callbacks);
      detachers.push(detach);
    } catch (error) {
      // Property might not be hookable
    }
  }

  return () => {
    detachers.forEach(d => d());
  };
}

// ===== PERFORMANCE TIMING AND CALL STACK UTILITIES =====

/**
 * Statistics for a traced method
 */
export interface MethodStats {
  callCount: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  lastCallTime: number;
}

/**
 * Extended callbacks with timing information
 */
export interface MethodCallbacksTimed {
  onEnter?: (args: NativePointer[], callStack: string[]) => void;
  onLeave?: (retval: NativePointer, duration: number) => void;
}

/**
 * Performance tracker for monitoring method call timing
 */
export class PerformanceTracker {
  private stats = new Map<string, MethodStats>();
  private detachers: Array<() => void> = [];

  /**
   * Track a method's performance
   *
   * @param method Method to track
   * @returns Detach function
   */
  track(monoMethod: MonoMethod): () => void {
    const methodName = monoMethod.getFullName();

    if (!this.stats.has(methodName)) {
      this.stats.set(methodName, {
        callCount: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        lastCallTime: 0,
      });
    }

    const stats = this.stats.get(methodName)!;

    const detach = methodExtended(monoMethod, {
      onEnter() {
        (this as any).startTime = Date.now();
      },
      onLeave() {
        const duration = Date.now() - ((this as any).startTime || 0);
        stats.callCount++;
        stats.totalTime += duration;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.avgTime = stats.totalTime / stats.callCount;
        stats.lastCallTime = Date.now();
      },
    });

    this.detachers.push(detach);
    return detach;
  }

  /**
   * Get stats for a specific method
   */
  getStats(methodName: string): MethodStats | undefined {
    return this.stats.get(methodName);
  }

  /**
   * Get all tracked methods' stats
   */
  getAllStats(): Map<string, MethodStats> {
    return new Map(this.stats);
  }

  /**
   * Get formatted performance report
   */
  getReport(): string {
    const lines: string[] = ["=== Performance Report ==="];

    const entries = Array.from(this.stats.entries()).sort((a, b) => b[1].totalTime - a[1].totalTime);

    for (const [name, s] of entries) {
      lines.push(`${name}:`);
      lines.push(`  Calls: ${s.callCount}`);
      lines.push(`  Total: ${s.totalTime}ms`);
      lines.push(`  Avg: ${s.avgTime.toFixed(2)}ms`);
      lines.push(`  Min: ${s.minTime === Infinity ? 0 : s.minTime}ms`);
      lines.push(`  Max: ${s.maxTime}ms`);
    }

    return lines.join("\n");
  }

  /**
   * Reset all stats
   */
  reset(): void {
    this.stats.clear();
  }

  /**
   * Stop all tracking
   */
  dispose(): void {
    this.detachers.forEach(d => d());
    this.detachers = [];
    this.stats.clear();
  }
}

/**
 * Hook a method with call stack capture
 *
 * @param monoMethod Method to hook
 * @param callbacks Callbacks with call stack info
 * @returns Detach function
 */
export function methodWithCallStack(monoMethod: MonoMethod, callbacks: MethodCallbacksTimed): () => void {
  const impl = monoMethod.api.native.mono_compile_method(monoMethod.pointer);

  if (impl.isNull()) {
    throw new Error(`Failed to compile method: ${monoMethod.getFullName()}`);
  }

  const listener = Interceptor.attach(impl, {
    onEnter(args) {
      // Capture call stack
      const backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE);
      const callStack = backtrace.map(addr => {
        const symbol = DebugSymbol.fromAddress(addr);
        return symbol ? `${symbol.moduleName}!${symbol.name}` : addr.toString();
      });

      (this as any).startTime = Date.now();

      if (callbacks.onEnter) {
        callbacks.onEnter(extractMethodArgs(monoMethod, args), callStack);
      }
    },
    onLeave(retval) {
      const duration = Date.now() - ((this as any).startTime || 0);

      if (callbacks.onLeave) {
        callbacks.onLeave(retval, duration);
      }
    },
  });

  return () => listener.detach();
}

/**
 * Create a performance tracker instance
 */
export function createPerformanceTracker(): PerformanceTracker {
  return new PerformanceTracker();
}

// ===== HELPER FUNCTIONS =====

/**
 * Capitalize the first letter of a string
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

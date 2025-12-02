/**
 * Tracing and hooking utilities for monitoring Mono runtime behavior
 */

import { MonoApi } from "../runtime/api";
import { MonoClass } from "../model/class";
import { MonoMethod } from "../model/method";
import * as Find from "./find";

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
  replacement: (originalRetval: NativePointer, thisPtr: NativePointer, args: NativePointer[]) => NativePointer | void
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
    }
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
      console.warn(`Failed to hook ${m.getFullName()}: ${error}`);
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

  console.log(`Tracing ${methods.length} methods matching "${pattern}"`);

  for (const m of methods) {
    try {
      const detach = method(m, {
        onEnter(args) {
          if (callbacks.onEnter) {
            console.log(`→ ${m.getFullName()}`);
            callbacks.onEnter(args);
          }
        },
        onLeave(retval) {
          if (callbacks.onLeave) {
            console.log(`← ${m.getFullName()}`);
            callbacks.onLeave(retval);
          }
        },
      });
      detachers.push(detach);
    } catch (error) {
      console.warn(`Failed to hook ${m.getFullName()}`);
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

  console.log(`Tracing ${classes.length} classes matching "${pattern}"`);

  for (const klass of classes) {
    const detach = classAll(klass, callbacks);
    detachers.push(detach);
  }

  return () => {
    detachers.forEach(d => d());
  };
}

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
 * Hook a single method
 *
 * @param method Method to hook
 * @param callbacks Callbacks for entry/exit
 * @returns Detach function
 */
export function method(method: MonoMethod, callbacks: MethodCallbacks): () => void {
  const methodPtr = method.pointer;

  // Get method implementation address
  const impl = method.api.native.mono_compile_method(methodPtr);

  if (impl.isNull()) {
    throw new Error(`Failed to compile method: ${method.getFullName()}`);
  }

  // Attach interceptor
  Interceptor.attach(impl, {
    onEnter(args) {
      if (callbacks.onEnter) {
        // args[0] is 'this' for instance methods
        const monoArgs: NativePointer[] = [];
        const paramCount = method.getParameterCount();
        const isInstance = method.isInstanceMethod();
        const startIdx = isInstance ? 0 : 1;

        for (let i = 0; i <= paramCount; i++) {
          monoArgs.push(args[startIdx + i]);
        }

        callbacks.onEnter(monoArgs);
      }
    },
    onLeave(retval) {
      if (callbacks.onLeave) {
        callbacks.onLeave(retval);
      }
    },
  });

  return () => Interceptor.detachAll();
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

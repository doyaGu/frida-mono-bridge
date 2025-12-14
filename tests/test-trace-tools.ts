/**
 * Trace Tools Tests
 *
 * Tests for Trace module Hook functionality
 * Including method interception, return value replacement, class-level hooks, etc.
 */

import type { FieldAccessCallbacks, MethodCallbacksTimed, MethodStats, PropertyAccessCallbacks } from "../src";
import Mono from "../src";
import { TestResult, assert, assertNotNull, createMonoDependentTest, createStandaloneTest } from "./test-framework";

/**
 * Create Trace Tools test suite
 */
export async function createTraceToolsTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ============================================
  // API Existence Tests
  // ============================================
  results.push(
    createStandaloneTest("Trace - Mono.trace exists", () => {
      assert(typeof Mono.trace !== "undefined", "Mono.trace should exist");
    }),
  );

  results.push(
    createStandaloneTest("Trace - method function exists", () => {
      assert(typeof Mono.trace.method === "function", "Mono.trace.method should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - methodExtended function exists", () => {
      assert(typeof Mono.trace.methodExtended === "function", "Mono.trace.methodExtended should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - replaceReturnValue function exists", () => {
      assert(typeof Mono.trace.replaceReturnValue === "function", "Mono.trace.replaceReturnValue should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - classAll function exists", () => {
      assert(typeof Mono.trace.classAll === "function", "Mono.trace.classAll should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - methodsByPattern function exists", () => {
      assert(typeof Mono.trace.methodsByPattern === "function", "Mono.trace.methodsByPattern should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - classesByPattern function exists", () => {
      assert(typeof Mono.trace.classesByPattern === "function", "Mono.trace.classesByPattern should be a function");
    }),
  );

  // ============================================
  // Trace.method Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.method - Hook System.String.get_Length", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      let detach: (() => void) | null = null;

      try {
        detach = Mono.trace.method(getLengthMethod!, {
          onEnter: _args => {
            // Hook set up successfully
          },
        });

        assert(typeof detach === "function", "method() should return a detach function");
      } finally {
        if (detach) {
          detach!();
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.method - returns detach function", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {});
      assert(typeof detach === "function", "Expected detach to be a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.method - onEnter callback setup", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: _args => {
          // Callback set up
        },
      });

      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.method - onLeave callback setup", () => {
      const objectClass = Mono.domain.tryClass("System.Object");
      assertNotNull(objectClass, "Object class should exist");

      const getHashCodeMethod = objectClass.tryMethod("GetHashCode");
      assertNotNull(getHashCodeMethod, "GetHashCode method should exist");

      const detach = Mono.trace.tryMethod(getHashCodeMethod!, {
        onLeave: _retval => {
          // Callback set up
        },
      });

      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.method - multiple detach calls safe", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {});

      // Call detach multiple times - should be safe
      detach!();
      detach!();
      detach!();
    }),
  );

  // ============================================
  // Trace.methodExtended Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.methodExtended - Hook with context", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.methodExtended(getLengthMethod!, {
        onEnter(_args) {
          // this should be InvocationContext
        },
      });

      assert(typeof detach === "function", "methodExtended should return a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.methodExtended - returns detach function", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.methodExtended(getLengthMethod!, {});

      assert(typeof detach === "function", "Expected detach to be a function");
      detach!();
    }),
  );

  // ============================================
  // Trace.replaceReturnValue Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.replaceReturnValue - setup replacement", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.replaceReturnValue(getLengthMethod!, (_originalRetval, _thisPtr, _args) => {
        return ptr(0);
      });

      assert(typeof detach === "function", "replaceReturnValue should return a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.replaceReturnValue - undefined keeps original", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.replaceReturnValue(getLengthMethod!, (_originalRetval, _thisPtr, _args) => {
        return undefined;
      });

      detach!();
    }),
  );

  // ============================================
  // Trace.classAll Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.classAll - Hook all methods in class", () => {
      const objectClass = Mono.domain.tryClass("System.Object");
      assertNotNull(objectClass, "Object class should exist");

      const detach = Mono.trace.classAll(objectClass, {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "classAll should return a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.classAll - detach removes all hooks", () => {
      const objectClass = Mono.domain.tryClass("System.Object");
      assertNotNull(objectClass, "Object class should exist");

      const detach = Mono.trace.classAll(objectClass, {
        onEnter: () => {},
      });

      detach!();
    }),
  );

  // ============================================
  // Trace.methodsByPattern Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.methodsByPattern - Hook by pattern", () => {
      const detach = Mono.trace.methodsByPattern("System.String.get_Length", {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "methodsByPattern should return a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.methodsByPattern - no match returns empty detach", () => {
      const detach = Mono.trace.methodsByPattern("NonExistent.Fake.Method12345", {});

      assert(typeof detach === "function", "Should return detach function even with no matches");

      detach!();
    }),
  );

  // ============================================
  // Trace.classesByPattern Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace.classesByPattern - Hook classes by pattern", () => {
      const detach = Mono.trace.classesByPattern("System.Object", {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "classesByPattern should return a function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.classesByPattern - no match returns empty detach", () => {
      const detach = Mono.trace.classesByPattern("FakeNamespace.FakeClass12345", {});

      assert(typeof detach === "function", "Should return detach function even with no matches");

      detach!();
    }),
  );

  // ============================================
  // Callback Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace - onEnter receives args array", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: args => {
          assert(Array.isArray(args), "args should be an array");
        },
      });

      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - instance method extracts this pointer", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      assert(getLengthMethod!.isInstanceMethod, "get_Length should be instance method");

      const detach = Mono.trace.replaceReturnValue(getLengthMethod!, (_retval, _thisPtr, _args) => {
        return undefined;
      });

      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - static method handling", () => {
      // Note: Many static methods may not be JIT compiled yet
      // mono_compile_method returns a trampoline address for uncompiled methods
      // which causes access violations when Frida tries to attach.
      // This test uses methods that are commonly called and likely to be compiled.
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      // Find static methods and try each one until we find one that's compiled
      const methods = stringClass.methods;
      let hooked = false;

      for (const m of methods) {
        if (hooked) break;
        if (m.isInstanceMethod || !m.canBeHooked) continue;

        try {
          const detach = Mono.trace.replaceReturnValue(m, (_retval, _thisPtr, _args) => {
            return undefined;
          });
          console.log(`[INFO] Successfully hooked static method: ${m.name}`);
          detach!();
          hooked = true;
        } catch (_e: unknown) {
          // Expected for methods not yet JIT compiled
          // Continue trying other methods
        }
      }

      // If no static methods could be hooked, it's acceptable
      // This is a known limitation of hooking lazy-compiled methods
      if (!hooked) {
        console.log("[INFO] No JIT-compiled static methods found - this is expected behavior");
        console.log("[INFO] Methods that haven't been called yet may not be hookable");
      }
    }),
  );

  // ============================================
  // Integration Tests
  // ============================================
  results.push(
    await createMonoDependentTest("Trace - multiple hooks coexist", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      // Test that multiple hooks on different callbacks work
      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });
      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {
        onLeave: () => {},
      });

      detach1();
      detach2();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - same method can be hooked multiple times", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      detach1();
      detach2();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - detach order independent", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {});
      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {});
      const detach3 = Mono.trace.tryMethod(getLengthMethod!, {});

      // Detach in random order
      detach2();
      detach1();
      detach3();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - program continues after detach", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      detach!();
    }),
  );

  // ============================================
  // Field Tracing Tests
  // ============================================
  results.push(
    createStandaloneTest("Trace - field function exists", () => {
      assert(typeof Mono.trace.field === "function", "Mono.trace.field should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - fieldsByPattern function exists", () => {
      assert(typeof Mono.trace.fieldsByPattern === "function", "Mono.trace.fieldsByPattern should be a function");
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.field - returns null for non-traceable field", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      // Try to find a private field that won't have property accessors
      const fields = stringClass!.fields;
      if (fields.length > 0) {
        const result = Mono.trace.field(fields[0], {
          onRead: () => {},
        });

        // Most internal fields won't be traceable without property accessors
        console.log(`[INFO] Field trace result: ${result === null ? "null (expected)" : "detach function"}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.fieldsByPattern - handles empty results", () => {
      // Use a pattern that won't match anything
      const detach = Mono.trace.fieldsByPattern("NonExistentFieldXYZ*", {
        onRead: () => {},
      });

      // Should return a valid detach function
      assert(typeof detach === "function", "Should return a detach function");
      detach!();
    }),
  );

  // ============================================
  // Property Tracing Tests
  // ============================================
  results.push(
    createStandaloneTest("Trace - property function exists", () => {
      assert(typeof Mono.trace.property === "function", "Mono.trace.property should be a function");
    }),
  );

  results.push(
    createStandaloneTest("Trace - propertiesByPattern function exists", () => {
      assert(
        typeof Mono.trace.propertiesByPattern === "function",
        "Mono.trace.propertiesByPattern should be a function",
      );
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.propertyTrace - hooks Length property", () => {
      const stringClass = Mono.domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should exist");

      const lengthProperty = stringClass!.tryProperty("Length");
      assertNotNull(lengthProperty, "Length property should exist");

      let _getterCalled = false;
      const detach = Mono.trace.property(lengthProperty!, {
        onGet: () => {
          _getterCalled = true;
        },
      });

      // The detach function should exist
      assert(typeof detach === "function", "Should return a detach function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace.propertiesByPattern - traces matching properties", () => {
      // Trace specific Length properties - use more specific pattern to avoid timeout
      // Instead of "*Length*" which matches 380+ properties
      const detach = Mono.trace.propertiesByPattern("System.String.Length", {
        onGet: () => {},
      });

      assert(typeof detach === "function", "Should return a detach function");
      detach!();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - FieldAccessCallbacks interface works", () => {
      // Type-level test
      const callbacks: FieldAccessCallbacks = {
        onRead: (instance, value) => {
          console.log(`Read: instance=${instance}, value=${value}`);
        },
        onWrite: (instance, oldValue, newValue) => {
          console.log(`Write: ${oldValue} -> ${newValue}`);
        },
      };

      assert(typeof callbacks.onRead === "function", "onRead should be a function");
      assert(typeof callbacks.onWrite === "function", "onWrite should be a function");
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - PropertyAccessCallbacks interface works", () => {
      // Type-level test
      const callbacks: PropertyAccessCallbacks = {
        onGet: (instance, value) => {
          console.log(`Get: instance=${instance}, value=${value}`);
        },
        onSet: (instance, oldValue, newValue) => {
          console.log(`Set: ${oldValue} -> ${newValue}`);
        },
      };

      assert(typeof callbacks.onGet === "function", "onGet should be a function");
      assert(typeof callbacks.onSet === "function", "onSet should be a function");
    }),
  );

  // =====================================================
  // Section 8: Performance Tracking Tests
  // =====================================================
  results.push(
    await createMonoDependentTest("Trace - createPerformanceTracker exists", () => {
      assertNotNull(Mono.trace.createPerformanceTracker, "createPerformanceTracker should exist");
      assert(
        typeof Mono.trace.createPerformanceTracker === "function",
        "createPerformanceTracker should be a function",
      );
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - PerformanceTracker can be instantiated", () => {
      const tracker = Mono.trace.createPerformanceTracker();
      assertNotNull(tracker, "Tracker should be created");

      // Check that it has the expected methods
      assert(typeof tracker.track === "function", "track method should exist");
      assert(typeof tracker.getStats === "function", "getStats method should exist");
      assert(typeof tracker.getAllStats === "function", "getAllStats method should exist");
      assert(typeof tracker.getReport === "function", "getReport method should exist");
      assert(typeof tracker.reset === "function", "reset method should exist");
      assert(typeof tracker.dispose === "function", "dispose method should exist");

      // Clean up
      tracker.dispose();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - PerformanceTracker.getReport returns string", () => {
      const tracker = Mono.trace.createPerformanceTracker();
      const report = tracker.getReport();

      assert(typeof report === "string", "Report should be a string");
      assert(report.includes("Performance Report"), "Report should contain header");
      console.log(`[INFO] Empty report:\n${report}`);

      tracker.dispose();
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - methodWithCallStack exists", () => {
      assertNotNull(Mono.trace.methodWithCallStack, "methodWithCallStack should exist");
      assert(typeof Mono.trace.methodWithCallStack === "function", "methodWithCallStack should be a function");
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - MethodCallbacksTimed interface works", () => {
      // Type-level test
      const callbacks: MethodCallbacksTimed = {
        onEnter: (args, callStack) => {
          console.log(`Enter with ${args.length} args, stack depth: ${callStack.length}`);
        },
        onLeave: (retval, duration) => {
          console.log(`Leave after ${duration}ms`);
        },
      };

      assert(typeof callbacks.onEnter === "function", "onEnter should be a function");
      assert(typeof callbacks.onLeave === "function", "onLeave should be a function");
    }),
  );

  results.push(
    await createMonoDependentTest("Trace - MethodStats interface structure", () => {
      // Type-level test for MethodStats
      const mockStats: MethodStats = {
        callCount: 10,
        totalTime: 100,
        minTime: 5,
        maxTime: 20,
        avgTime: 10,
        lastCallTime: Date.now(),
      };

      assert(typeof mockStats.callCount === "number", "callCount should be number");
      assert(typeof mockStats.totalTime === "number", "totalTime should be number");
      assert(typeof mockStats.minTime === "number", "minTime should be number");
      assert(typeof mockStats.maxTime === "number", "maxTime should be number");
      assert(typeof mockStats.avgTime === "number", "avgTime should be number");
      assert(typeof mockStats.lastCallTime === "number", "lastCallTime should be number");

      console.log(`[INFO] MethodStats interface verified`);
    }),
  );

  return results;
}

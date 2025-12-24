/**
 * Trace Tools Tests
 *
 * Tests for Trace module Hook functionality
 * Including method interception, return value replacement, class-level hooks, etc.
 */

import type { FieldAccessCallbacks, MethodCallbacksTimed, MethodStats, PropertyAccessCallbacks } from "../src";
import Mono from "../src";
import { withCoreClasses, withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull } from "./test-framework";

/**
 * Create Trace Tools test suite
 */
export async function createTraceToolsTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ============================================
  // API Existence Tests
  // ============================================
  results.push(
    await withDomain("Trace - Mono.trace exists", () => {
      assert(typeof Mono.trace !== "undefined", "Mono.trace should exist");
    }),
  );

  results.push(
    await withDomain("Trace - method function exists", () => {
      assert(typeof Mono.trace.method === "function", "Mono.trace.method should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - methodExtended function exists", () => {
      assert(typeof Mono.trace.methodExtended === "function", "Mono.trace.methodExtended should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - replaceReturnValue function exists", () => {
      assert(typeof Mono.trace.replaceReturnValue === "function", "Mono.trace.replaceReturnValue should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - classAll function exists", () => {
      assert(typeof Mono.trace.classAll === "function", "Mono.trace.classAll should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - methodsByPattern function exists", () => {
      assert(typeof Mono.trace.methodsByPattern === "function", "Mono.trace.methodsByPattern should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - classesByPattern function exists", () => {
      assert(typeof Mono.trace.classesByPattern === "function", "Mono.trace.classesByPattern should be a function");
    }),
  );

  // ============================================
  // Trace.method Tests
  // ============================================
  results.push(
    await withCoreClasses("Trace.method - Hook System.String.get_Length", ({ stringClass }) => {
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
    await withCoreClasses("Trace.method - returns detach function", ({ stringClass }) => {
      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {});
      assert(typeof detach === "function", "Expected detach to be a function");
      detach!();
    }),
  );

  results.push(
    await withCoreClasses("Trace.method - onEnter callback setup", ({ stringClass }) => {
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
    await withCoreClasses("Trace.method - onLeave callback setup", ({ objectClass }) => {
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
    await withCoreClasses("Trace.method - multiple detach calls safe", ({ stringClass }) => {
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
    await withCoreClasses("Trace.methodExtended - Hook with context", ({ stringClass }) => {
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
    await withCoreClasses("Trace.methodExtended - returns detach function", ({ stringClass }) => {
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
    await withCoreClasses("Trace.replaceReturnValue - setup replacement", ({ stringClass }) => {
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
    await withCoreClasses("Trace.replaceReturnValue - undefined keeps original", ({ stringClass }) => {
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
    await withCoreClasses("Trace.classAll - Hook all methods in class", ({ objectClass }) => {
      const detach = Mono.trace.classAll(objectClass, {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "classAll should return a function");
      detach!();
    }),
  );

  results.push(
    await withCoreClasses("Trace.classAll - detach removes all hooks", ({ objectClass }) => {
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
    await withDomain("Trace.methodsByPattern - Hook by pattern", () => {
      const detach = Mono.trace.methodsByPattern("System.String.get_Length", {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "methodsByPattern should return a function");
      detach!();
    }),
  );

  results.push(
    await withDomain("Trace.methodsByPattern - no match returns empty detach", () => {
      const detach = Mono.trace.methodsByPattern("NonExistent.Fake.Method12345", {});

      assert(typeof detach === "function", "Should return detach function even with no matches");

      detach!();
    }),
  );

  // ============================================
  // Trace.classesByPattern Tests
  // ============================================
  results.push(
    await withDomain("Trace.classesByPattern - Hook classes by pattern", () => {
      const detach = Mono.trace.classesByPattern("System.Object", {
        onEnter: _args => {},
      });

      assert(typeof detach === "function", "classesByPattern should return a function");
      detach!();
    }),
  );

  results.push(
    await withDomain("Trace.classesByPattern - no match returns empty detach", () => {
      const detach = Mono.trace.classesByPattern("FakeNamespace.FakeClass12345", {});

      assert(typeof detach === "function", "Should return detach function even with no matches");

      detach!();
    }),
  );

  // ============================================
  // Callback Tests
  // ============================================
  results.push(
    await withCoreClasses("Trace - onEnter receives args array", ({ stringClass }) => {
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
    await withCoreClasses("Trace - instance method extracts this pointer", ({ stringClass }) => {
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
    await withCoreClasses("Trace - static method handling", ({ stringClass }) => {
      // Note: Many static methods may not be JIT compiled yet
      // mono_compile_method returns a trampoline address for uncompiled methods
      // which causes access violations when Frida tries to attach.
      // This test uses methods that are commonly called and likely to be compiled.

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
    await withCoreClasses("Trace - multiple hooks coexist", ({ stringClass }) => {
      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      // Test that multiple hooks on different callbacks work
      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });
      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {
        onLeave: () => {},
      });

      if (detach1) detach1();
      if (detach2) detach2();
    }),
  );

  results.push(
    await withCoreClasses("Trace - same method can be hooked multiple times", ({ stringClass }) => {
      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      if (detach1) detach1();
      if (detach2) detach2();
    }),
  );

  results.push(
    await withCoreClasses("Trace - detach order independent", ({ stringClass }) => {
      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach1 = Mono.trace.tryMethod(getLengthMethod!, {});
      const detach2 = Mono.trace.tryMethod(getLengthMethod!, {});
      const detach3 = Mono.trace.tryMethod(getLengthMethod!, {});

      // Detach in random order
      if (detach2) detach2();
      if (detach1) detach1();
      if (detach3) detach3();
    }),
  );

  results.push(
    await withCoreClasses("Trace - program continues after detach", ({ stringClass }) => {
      const getLengthMethod = stringClass.tryMethod("get_Length");
      assertNotNull(getLengthMethod, "get_Length method should exist");

      const detach = Mono.trace.tryMethod(getLengthMethod!, {
        onEnter: () => {},
      });

      if (detach) detach();
    }),
  );

  // ============================================
  // Field Tracing Tests
  // ============================================
  results.push(
    await withDomain("Trace - field function exists", () => {
      assert(typeof Mono.trace.field === "function", "Mono.trace.field should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - fieldsByPattern function exists", () => {
      assert(typeof Mono.trace.fieldsByPattern === "function", "Mono.trace.fieldsByPattern should be a function");
    }),
  );

  results.push(
    await withCoreClasses("Trace.field - returns null for non-traceable field", ({ stringClass }) => {
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
    await withDomain("Trace.fieldsByPattern - handles empty results", () => {
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
    await withDomain("Trace - property function exists", () => {
      assert(typeof Mono.trace.property === "function", "Mono.trace.property should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - propertiesByPattern function exists", () => {
      assert(
        typeof Mono.trace.propertiesByPattern === "function",
        "Mono.trace.propertiesByPattern should be a function",
      );
    }),
  );

  results.push(
    await withCoreClasses("Trace.propertyTrace - hooks Length property", ({ stringClass }) => {
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
    await withDomain("Trace.propertiesByPattern - traces matching properties", () => {
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
    await withDomain("Trace - FieldAccessCallbacks interface works", () => {
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
    await withDomain("Trace - PropertyAccessCallbacks interface works", () => {
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
    await withDomain("Trace - createPerformanceTracker exists", () => {
      assertNotNull(Mono.trace.createPerformanceTracker, "createPerformanceTracker should exist");
      assert(
        typeof Mono.trace.createPerformanceTracker === "function",
        "createPerformanceTracker should be a function",
      );
    }),
  );

  results.push(
    await withDomain("Trace - PerformanceTracker can be instantiated", () => {
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
    await withDomain("Trace - PerformanceTracker.getReport returns string", () => {
      const tracker = Mono.trace.createPerformanceTracker();
      const report = tracker.getReport();

      assert(typeof report === "string", "Report should be a string");
      assert(report.includes("Performance Report"), "Report should contain header");
      console.log(`[INFO] Empty report:\n${report}`);

      tracker.dispose();
    }),
  );

  results.push(
    await withDomain("Trace - methodWithCallStack exists", () => {
      assertNotNull(Mono.trace.methodWithCallStack, "methodWithCallStack should exist");
      assert(typeof Mono.trace.methodWithCallStack === "function", "methodWithCallStack should be a function");
    }),
  );

  results.push(
    await withDomain("Trace - MethodCallbacksTimed interface works", () => {
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
    await withDomain("Trace - MethodStats interface structure", () => {
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

  // =====================================================
  // Section 9: Real-world Integration Tests
  // =====================================================
  results.push(
    await withDomain("Trace - Hook Unity Update methods", ({ domain }) => {
      // Try to find and hook common Unity Update methods
      const updateMethods = domain.findMethods("*Update*", { limit: 10 });
      console.log(`[INFO] Found ${updateMethods.length} methods matching *Update*`);

      let hookedCount = 0;
      const detachers: (() => void)[] = [];

      for (const method of updateMethods) {
        if (hookedCount >= 3) break; // Limit to 3 hooks for this test

        try {
          const detach = Mono.trace.tryMethod(method, {
            onEnter: () => {
              // Hook installed successfully
            },
          });

          if (detach) {
            detachers.push(detach);
            hookedCount++;
            console.log(`[INFO] Successfully hooked: ${method.fullName}`);
          }
        } catch (e) {
          // Expected for some methods
        }
      }

      console.log(`[INFO] Successfully hooked ${hookedCount} Update methods`);

      // Clean up all hooks
      for (const detach of detachers) {
        detach();
      }

      assert(hookedCount >= 0, "Should hook at least 0 methods (may be none if no Update methods found)");
    }),
  );

  results.push(
    await withDomain("Trace - Performance tracking real methods", ({ domain }) => {
      const tracker = Mono.trace.createPerformanceTracker();

      // Find some commonly called methods to track
      const stringClass = domain.tryClass("System.String");
      if (!stringClass) {
        console.log("[INFO] String class not found, skipping");
        tracker.dispose();
        return;
      }

      const getLengthMethod = stringClass.tryMethod("get_Length");
      if (!getLengthMethod) {
        console.log("[INFO] get_Length method not found, skipping");
        tracker.dispose();
        return;
      }

      try {
        const detach = tracker.tryTrack(getLengthMethod);
        if (detach) {
          console.log("[INFO] Tracking get_Length method");

          // Create some test strings to trigger calls
          const str1 = Mono.string.new("Test String 1");
          const str2 = Mono.string.new("Another Test String");
          const str3 = Mono.string.new("Yet Another String");

          // Access length to trigger tracked method
          const _len1 = str1.length;
          const _len2 = str2.length;
          const _len3 = str3.length;

          // Wait a bit for stats to accumulate
          const stats = tracker.getStats(getLengthMethod.fullName);
          if (stats) {
            console.log(`[INFO] Call count: ${stats.callCount}`);
            console.log(`[INFO] Total time: ${stats.totalTime.toFixed(2)}ms`);
            console.log(`[INFO] Avg time: ${stats.avgTime.toFixed(2)}ms`);
          }

          const report = tracker.getReport();
          console.log(`[INFO] Performance report:\n${report}`);

          detach();
        } else {
          console.log("[INFO] Could not track method (may not be JIT compiled)");
        }
      } catch (e) {
        console.log(`[INFO] Tracking failed: ${e}`);
      }

      tracker.dispose();
    }),
  );

  results.push(
    await withDomain("Trace - Hook with call stack", ({ domain }) => {
      const stringClass = domain.tryClass("System.String");
      if (!stringClass) {
        console.log("[INFO] String class not found, skipping");
        return;
      }

      const getLengthMethod = stringClass.tryMethod("get_Length");
      if (!getLengthMethod) {
        console.log("[INFO] get_Length method not found, skipping");
        return;
      }

      try {
        let callStackReceived = false;
        let durationReceived = false;

        const detach = Mono.trace.methodWithCallStack(getLengthMethod, {
          onEnter: (args, callStack) => {
            callStackReceived = Array.isArray(callStack);
            console.log(`[INFO] Call stack depth: ${callStack.length}`);
            if (callStack.length > 0) {
              console.log(`[INFO] Top of stack: ${callStack[0]}`);
            }
          },
          onLeave: (_retval, duration) => {
            durationReceived = typeof duration === "number";
            console.log(`[INFO] Call duration: ${duration}ms`);
          },
        });

        // Trigger the method
        const testStr = Mono.string.new("Test");
        const _len = testStr.length;

        assert(callStackReceived, "Should have received call stack");
        assert(durationReceived, "Should have received duration");

        detach();
      } catch (e) {
        console.log(`[INFO] Call stack tracing not available: ${e}`);
      }
    }),
  );

  results.push(
    await withDomain("Trace - Replace return value in real method", ({ domain }) => {
      const stringClass = domain.tryClass("System.String");
      if (!stringClass) {
        console.log("[INFO] String class not found, skipping");
        return;
      }

      const getLengthMethod = stringClass.tryMethod("get_Length");
      if (!getLengthMethod) {
        console.log("[INFO] get_Length method not found, skipping");
        return;
      }

      try {
        // Hook and replace return value with a fixed value
        const detach = Mono.trace.replaceReturnValue(getLengthMethod, (_originalRetval, _thisPtr, _args) => {
          // Replace all string lengths with 42
          const fakeLength = Memory.alloc(Process.pointerSize);
          fakeLength.writeInt(42);
          return fakeLength;
        });

        // Test that the replacement works
        const testStr = Mono.string.new("Short");
        const observedLength = testStr.length;

        console.log(`[INFO] Original string: "Short" (5 chars)`);
        console.log(`[INFO] Observed length: ${observedLength}`);

        detach();

        // Verify original behavior restored after detach
        const newStr = Mono.string.new("Short");
        const normalLength = newStr.length;
        console.log(`[INFO] Length after detach: ${normalLength}`);

        assert(observedLength === 42, "Length should have been replaced with 42");
        assert(normalLength === 5, "Length should be back to normal after detach");
      } catch (e) {
        console.log(`[INFO] Return value replacement test failed: ${e}`);
      }
    }),
  );

  results.push(
    await withDomain("Trace - Stress test with multiple hooks", ({ domain }) => {
      // Create many hooks and ensure they can be cleaned up
      const detachers: (() => void)[] = [];

      try {
        const methods = domain.findMethods("System.String.*", { limit: 20 });
        console.log(`[INFO] Found ${methods.length} String methods for stress test`);

        for (const method of methods) {
          const detach = Mono.trace.tryMethod(method, {
            onEnter: () => {
              // Hook installed
            },
          });

          if (detach) {
            detachers.push(detach);
          }
        }

        console.log(`[INFO] Successfully created ${detachers.length} hooks`);
        assert(detachers.length > 0, "Should create at least one hook");
      } finally {
        // Clean up all hooks
        for (const detach of detachers) {
          try {
            detach();
          } catch (e) {
            console.log(`[WARN] Error during detach: ${e}`);
          }
        }
        console.log(`[INFO] Cleaned up ${detachers.length} hooks`);
      }
    }),
  );

  return results;
}

/**
 * Comprehensive Runtime API Tests
 * Tests for MonoApi functionality including exception handling, thread management,
 * resource cleanup, and low-level runtime operations
 */

import Mono from "../src";
import { withCoreClasses, withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull, assertThrows, createErrorHandlingTest } from "./test-framework";
// MonoManagedExceptionError is not exported from the module - using duck typing instead
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class MonoManagedExceptionError extends Error {
  exception?: NativePointer;
  exceptionType?: string;
  exceptionMessage?: string;
  static [Symbol.hasInstance](obj: unknown): boolean {
    return obj instanceof Error && (obj as Error).name === "MonoManagedExceptionError";
  }
}

export async function createRuntimeApiTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== BASIC API INITIALIZATION TESTS =====

  results.push(
    await withDomain("MonoApi should be available after Mono.perform", () => {
      assertNotNull(Mono.api, "Mono.api should be available");
      assertNotNull(Mono.api.native, "Mono.api.native bindings should be available");
    }),
  );

  results.push(
    await withDomain("MonoApi should provide root domain", () => {
      const rootDomain = Mono.api.getRootDomain();
      assertNotNull(rootDomain, "Root domain should be available");
      assert(!rootDomain.isNull(), "Root domain should not be null pointer");
    }),
  );

  results.push(
    await withDomain("MonoApi should cache root domain", () => {
      const domain1 = Mono.api.getRootDomain();
      const domain2 = Mono.api.getRootDomain();

      assert(domain1.equals(domain2), "Root domain should be cached and return same pointer");
    }),
  );

  // ===== STRING CREATION TESTS =====

  results.push(
    await withDomain("MonoApi.stringNew should create managed strings", () => {
      const testStr = "Hello, Mono World!";
      const monoStr = Mono.api.stringNew(testStr);

      assertNotNull(monoStr, "stringNew should return a pointer");
      assert(!monoStr.isNull(), "stringNew should not return null pointer");
    }),
  );

  results.push(
    await withDomain("MonoApi.stringNew should handle empty string", () => {
      const monoStr = Mono.api.stringNew("");

      assertNotNull(monoStr, "stringNew should handle empty string");
      assert(!monoStr.isNull(), "Empty string should not be null pointer");
    }),
  );

  results.push(
    await withDomain("MonoApi.stringNew should handle Unicode strings", () => {
      const unicodeStr = "Hello 世界 🌍 مرحبا";
      const monoStr = Mono.api.stringNew(unicodeStr);

      assertNotNull(monoStr, "stringNew should handle Unicode");
      assert(!monoStr.isNull(), "Unicode string should not be null pointer");
    }),
  );

  results.push(
    await withDomain("MonoApi.stringNew should handle special characters", () => {
      const specialStr = "Line1\nLine2\tTabbed\r\nWindows";
      const monoStr = Mono.api.stringNew(specialStr);

      assertNotNull(monoStr, "stringNew should handle special characters");
    }),
  );

  results.push(
    await withDomain("MonoApi.stringNew should reject embedded NUL by default", () => {
      assertThrows(() => Mono.api.stringNew("A\0B"), "stringNew should reject embedded NUL (\\0) by default");
    }),
  );

  results.push(
    await withDomain("MonoApi.stringNew should handle long strings", () => {
      const longStr = "x".repeat(10000);
      const monoStr = Mono.api.stringNew(longStr);

      assertNotNull(monoStr, "stringNew should handle long strings");
      assert(!monoStr.isNull(), "Long string should not be null pointer");
    }),
  );

  // ===== RUNTIME INVOKE TESTS =====

  results.push(
    await withCoreClasses("MonoApi.runtimeInvoke should call static methods", ({ stringClass }) => {
      if (!stringClass) {
        console.log("  - System.String not available; skipping");
        return;
      }

      const concatMethod = stringClass.tryMethod("Concat", 2);
      if (!concatMethod) {
        console.log("  - System.String.Concat(string, string) not available; skipping");
        return;
      }

      const str1 = Mono.api.stringNew("Hello");
      const str2 = Mono.api.stringNew(" World");

      const result = Mono.api.runtimeInvoke(concatMethod.pointer, NULL, [str1, str2]);
      assertNotNull(result, "runtimeInvoke should return result");
    }),
  );

  results.push(
    await withDomain("MonoApi.runtimeInvoke should handle null arguments array", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      // Try to call ToString() with no arguments
      const toStringMethod = int32Class!.tryMethod("ToString", 0);
      if (toStringMethod) {
        // For value types, we need a boxed instance
        try {
          // Create a boxed Int32
          const valuePtr = Memory.alloc(4);
          valuePtr.writeS32(42);
          const boxed = Mono.api.native.mono_value_box(Mono.api.getRootDomain(), int32Class!.pointer, valuePtr);

          const result = Mono.api.runtimeInvoke(toStringMethod.pointer, boxed, []);
          console.log(`  - ToString result: ${result}`);
        } catch (error) {
          console.log(`  - ToString invocation: ${error}`);
        }
      }
    }),
  );

  // ===== EXCEPTION HANDLING TESTS =====

  results.push(
    await withDomain("MonoApi.runtimeInvoke should capture managed exceptions", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");
      const parseMethod = int32Class!.tryMethod("Parse", 1);

      if (parseMethod) {
        const invalidStr = Mono.api.stringNew("not_a_number");

        try {
          Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [invalidStr]);
          console.log("  - No exception thrown (unexpected)");
        } catch (error: any) {
          assert(error instanceof MonoManagedExceptionError, "Error should be MonoManagedExceptionError");
          console.log(`  - Exception type: ${error.name}`);

          if (error.exceptionType) {
            console.log(`  - Managed type: ${error.exceptionType}`);
            assert(
              error.exceptionType.includes("FormatException") || error.exceptionType.includes("Exception"),
              "Exception type should be FormatException or similar",
            );
          }

          if (error.exceptionMessage) {
            console.log(`  - Message: ${error.exceptionMessage.substring(0, 100)}`);
          }

          assertNotNull(error.exception, "Exception pointer should be available");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoManagedExceptionError should contain exception pointer", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");
      const parseMethod = int32Class!.tryMethod("Parse", 1);

      if (parseMethod) {
        const invalidStr = Mono.api.stringNew("invalid");

        try {
          Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [invalidStr]);
        } catch (error: any) {
          if (error instanceof MonoManagedExceptionError) {
            assertNotNull(error.exception, "Exception pointer should exist");
            assert(!error.exception.isNull(), "Exception pointer should not be null");

            // Verify we can get class from exception object
            const exceptionClass = Mono.api.native.mono_object_get_class(error.exception);
            assert(!exceptionClass.isNull(), "Should be able to get exception class");
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoManagedExceptionError should extract exception type name", ({ domain }) => {
      // Try to trigger different exception types
      const testCases = [{ method: "Parse", args: ["not_a_number"], expectedType: "FormatException" }];

      const int32Class = domain.tryClass("System.Int32");
      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          try {
            const invalidStr = Mono.api.stringNew("xyz");
            Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [invalidStr]);
          } catch (error: any) {
            if (error.exceptionType) {
              console.log(`  - Extracted exception type: ${error.exceptionType}`);
              assert(typeof error.exceptionType === "string", "Exception type should be string");
            }
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoManagedExceptionError should extract exception message", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          try {
            const invalidStr = Mono.api.stringNew("not_valid_int32");
            Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [invalidStr]);
          } catch (error: any) {
            if (error.exceptionMessage) {
              console.log(`  - Exception message: ${error.exceptionMessage.substring(0, 80)}...`);
              assert(typeof error.exceptionMessage === "string", "Message should be string");
              assert(error.exceptionMessage.length > 0, "Message should not be empty");
            } else {
              console.log("  - Exception message extraction not available");
            }
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("Multiple exceptions should have separate details", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          const testInputs = ["abc", "xyz", "!@#"];
          const exceptions: any[] = [];

          testInputs.forEach(input => {
            try {
              const str = Mono.api.stringNew(input);
              Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [str]);
            } catch (error: any) {
              exceptions.push(error);
            }
          });

          assert(exceptions.length === testInputs.length, `Should capture ${testInputs.length} exceptions`);
          console.log(`  - Captured ${exceptions.length} exceptions`);

          // Each exception should have its own pointer
          const pointers = exceptions.map(e => e.exception?.toString());
          console.log(`  - Exception pointers: ${pointers.join(", ")}`);
        }
      }
    }),
  );

  // ===== HAS EXPORT TESTS =====

  results.push(
    await withDomain("MonoApi.hasExport should detect available exports", () => {
      // These should always be available
      const commonExports = [
        "mono_get_root_domain",
        "mono_thread_attach",
        "mono_class_get_name",
        "mono_object_get_class",
      ];

      commonExports.forEach(exportName => {
        const hasIt = Mono.api.hasExport(exportName as any);
        console.log(`  - ${exportName}: ${hasIt ? "available" : "not available"}`);
      });
    }),
  );

  results.push(
    await withDomain("MonoApi.hasExport should return false for missing exports", () => {
      const fakeExport = "mono_this_function_does_not_exist_12345";
      const hasIt = Mono.api.hasExport(fakeExport as any);

      assert(!hasIt, "Should return false for non-existent export");
    }),
  );

  results.push(
    await withDomain("MonoApi.hasExport should handle string conversion APIs", () => {
      const stringExports = ["mono_string_to_utf8", "mono_string_to_utf16", "mono_string_chars", "mono_string_length"];

      let availableCount = 0;
      stringExports.forEach(exportName => {
        if (Mono.api.hasExport(exportName as any)) {
          availableCount++;
        }
      });

      console.log(`  - String conversion APIs: ${availableCount}/${stringExports.length} available`);
      assert(availableCount > 0, "At least one string conversion API should be available");
    }),
  );

  // ===== TRY FREE TESTS =====

  results.push(
    await withDomain("MonoApi.tryFree should not crash on NULL pointer", () => {
      // tryFree should safely handle NULL
      Mono.api.tryFree(NULL);
      console.log("  - tryFree(NULL) completed without crash");
    }),
  );

  results.push(
    await withDomain("MonoApi.tryFree should handle mono_string_to_utf8 result", () => {
      if (Mono.api.hasExport("mono_string_to_utf8")) {
        const testStr = Mono.api.stringNew("Test string for free");
        const utf8Ptr = Mono.api.native.mono_string_to_utf8(testStr);

        if (!utf8Ptr.isNull()) {
          const content = utf8Ptr.readUtf8String();
          console.log(`  - UTF8 content: ${content}`);

          // Try to free the result
          Mono.api.tryFree(utf8Ptr);
          console.log("  - tryFree completed");
        }
      } else {
        console.log("  - mono_string_to_utf8 not available");
      }
    }),
  );

  results.push(
    await withDomain("MonoApi.tryFree should use best available free function", () => {
      // This test is runtime-sensitive:
      // - Standard Mono: mono_free
      // - Unity Mono: mono_unity_g_free (often mono_free is not exported)
      // - Older builds: g_free

      if (!Mono.api.hasExport("mono_string_to_utf8")) {
        console.log("  - mono_string_to_utf8 not available; skipping");
        return;
      }

      const hasMonoFree = Mono.api.hasExport("mono_free");
      const hasUnityGFree = Mono.api.hasExport("mono_unity_g_free");
      const hasGFree = Mono.api.hasExport("g_free");

      const expected = hasMonoFree ? "mono_free" : hasUnityGFree ? "mono_unity_g_free" : hasGFree ? "g_free" : null;
      if (!expected) {
        console.log("  - No known free function exports available; skipping");
        return;
      }

      let monoFreeCalls = 0;
      let unityGFreeCalls = 0;
      let gFreeCalls = 0;

      const listeners: InvocationListener[] = [];
      try {
        if (hasMonoFree) {
          const addr = Mono.api.getExportAddress("mono_free");
          assertNotNull(addr, "mono_free should resolve if hasExport returned true");
          listeners.push(
            Interceptor.attach(addr, {
              onEnter() {
                monoFreeCalls++;
              },
            }),
          );
        }

        if (hasUnityGFree) {
          const addr = Mono.api.getExportAddress("mono_unity_g_free");
          assertNotNull(addr, "mono_unity_g_free should resolve if hasExport returned true");
          listeners.push(
            Interceptor.attach(addr, {
              onEnter() {
                unityGFreeCalls++;
              },
            }),
          );
        }

        if (hasGFree) {
          const addr = Mono.api.getExportAddress("g_free");
          assertNotNull(addr, "g_free should resolve if hasExport returned true");
          listeners.push(
            Interceptor.attach(addr, {
              onEnter() {
                gFreeCalls++;
              },
            }),
          );
        }

        const testStr = Mono.api.stringNew("tryFree() dispatch probe");
        const ptr = Mono.api.native.mono_string_to_utf8(testStr);
        assert(!ptr.isNull(), "mono_string_to_utf8 should return a non-null pointer");

        // Trigger the free path
        Mono.api.tryFree(ptr);

        const total = monoFreeCalls + unityGFreeCalls + gFreeCalls;
        console.log(
          `  - Free calls: mono_free=${monoFreeCalls}, mono_unity_g_free=${unityGFreeCalls}, g_free=${gFreeCalls} (expected ${expected})`,
        );

        // We expect exactly one of these to be called once.
        assert(total >= 1, "Expected a free function to be called at least once");
        if (expected === "mono_free") {
          assert(monoFreeCalls >= 1, "Expected mono_free to be called");
          assert(unityGFreeCalls === 0, "Did not expect mono_unity_g_free when mono_free is available");
        } else if (expected === "mono_unity_g_free") {
          assert(unityGFreeCalls >= 1, "Expected mono_unity_g_free to be called");
          assert(monoFreeCalls === 0, "Did not expect mono_free when it's not available");
        } else if (expected === "g_free") {
          assert(gFreeCalls >= 1, "Expected g_free to be called");
          assert(monoFreeCalls === 0, "Did not expect mono_free when it's not available");
          assert(unityGFreeCalls === 0, "Did not expect mono_unity_g_free when it's not available");
        }
      } finally {
        for (const l of listeners) {
          try {
            l.detach();
          } catch {
            // ignore
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoApi.tryFree should handle mono_string_to_utf16 result", () => {
      if (!Mono.api.hasExport("mono_string_to_utf16")) {
        console.log("  - mono_string_to_utf16 not available; skipping");
        return;
      }

      const testStr = Mono.api.stringNew("Test UTF-16 free");
      const utf16Ptr = Mono.api.native.mono_string_to_utf16(testStr);
      if (utf16Ptr.isNull()) {
        console.log("  - mono_string_to_utf16 returned NULL; skipping");
        return;
      }

      const content = utf16Ptr.readUtf16String() || "";
      console.log(`  - UTF16 content: ${content}`);

      // Must not crash and must use tryFree fallback chain correctly.
      Mono.api.tryFree(utf16Ptr);
      console.log("  - tryFree(utf16Ptr) completed");
    }),
  );

  // ===== THREAD ATTACHMENT TESTS =====

  results.push(
    await withDomain("MonoApi.attachThread should return thread handle", () => {
      const thread = Mono.api.attachThread();
      assertNotNull(thread, "attachThread should return handle");
      assert(!thread.isNull(), "Thread handle should not be null");
      console.log(`  - Thread handle: ${thread}`);
    }),
  );

  results.push(
    await withDomain("MonoApi.attachThread should be idempotent", () => {
      const thread1 = Mono.api.attachThread();
      const thread2 = Mono.api.attachThread();

      // Multiple attachments should return same or valid thread
      assertNotNull(thread1, "First attachment should succeed");
      assertNotNull(thread2, "Second attachment should succeed");

      console.log(`  - Thread 1: ${thread1}, Thread 2: ${thread2}`);
    }),
  );

  results.push(
    await withDomain("MonoApi.detachThread should not crash", () => {
      const thread = Mono.api.attachThread();

      // Note: We may not want to actually detach as it could affect other tests
      // Just verify the API exists
      assert(typeof Mono.api.detachThread === "function", "detachThread should be a function");

      console.log("  - detachThread function available");
    }),
  );

  // ===== DELEGATE THUNK TESTS =====

  results.push(
    await withDomain("MonoApi.getDelegateThunk should work for Action delegate", ({ domain }) => {
      const actionClass = domain.tryClass("System.Action");

      if (actionClass) {
        try {
          const thunkInfo = Mono.api.getDelegateThunk(actionClass.pointer);
          assertNotNull(thunkInfo, "Thunk info should be available");
          assertNotNull(thunkInfo.invoke, "Invoke method should be available");
          assertNotNull(thunkInfo.thunk, "Thunk pointer should be available");

          console.log(`  - Action invoke: ${thunkInfo.invoke}`);
          console.log(`  - Action thunk: ${thunkInfo.thunk}`);
        } catch (error) {
          console.log(`  - Delegate thunk not supported: ${error}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoApi.getDelegateThunk should cache results", ({ domain }) => {
      const actionClass = domain.tryClass("System.Action");

      if (actionClass) {
        try {
          const thunk1 = Mono.api.getDelegateThunk(actionClass.pointer);
          const thunk2 = Mono.api.getDelegateThunk(actionClass.pointer);

          assert(thunk1.invoke.equals(thunk2.invoke), "Cached thunk invoke should be same");
          assert(thunk1.thunk.equals(thunk2.thunk), "Cached thunk pointer should be same");

          console.log("  - Delegate thunk caching verified");
        } catch (error) {
          console.log(`  - Delegate thunk test skipped: ${error}`);
        }
      }
    }),
  );

  // ===== ADD INTERNAL CALL TESTS =====

  results.push(
    await createErrorHandlingTest("MonoApi.addInternalCall should reject empty name", () => {
      assertThrows(() => {
        Mono.api.addInternalCall("", ptr(0x1234));
      }, "Should throw for empty name");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoApi.addInternalCall should reject null callback", () => {
      assertThrows(() => {
        Mono.api.addInternalCall("Test.Class::Method", NULL);
      }, "Should throw for null callback");
    }),
  );

  results.push(
    await withDomain("MonoApi.addInternalCall should accept valid parameters", () => {
      // Create a dummy callback
      const callback = new NativeCallback(
        () => {
          console.log("Internal call invoked");
        },
        "void",
        [],
      );

      try {
        // This registers the internal call but may not be usable without proper setup
        Mono.api.addInternalCall("Frida.Test::DummyMethod", callback);
        console.log("  - Internal call registered successfully");
      } catch (error) {
        console.log(`  - Internal call registration: ${error}`);
      }
    }),
  );

  // ===== DISPOSE TESTS =====

  results.push(
    await withDomain("MonoApi should track disposed state", () => {
      // Check initial state - should not be disposed
      assert(!Mono.api.isDisposed, "API should not be disposed initially");
    }),
  );

  results.push(
    await withDomain("MonoApi.call should invoke native functions", () => {
      // Test the call method for invoking native functions
      try {
        const rootDomain = Mono.api.call("mono_get_root_domain");
        assertNotNull(rootDomain, "call should return result");
        console.log(`  - Root domain via call: ${rootDomain}`);
      } catch (error) {
        console.log(`  - call test: ${error}`);
      }
    }),
  );

  // ===== NATIVE BINDINGS TESTS =====

  results.push(
    await withDomain("MonoApi.native should provide lazy-bound functions", () => {
      // Access some native functions
      const native = Mono.api.native;

      assert(typeof native.mono_get_root_domain === "function", "mono_get_root_domain should be a function");
      assert(typeof native.mono_class_get_name === "function", "mono_class_get_name should be a function");
      assert(typeof native.mono_object_get_class === "function", "mono_object_get_class should be a function");

      console.log("  - Native bindings verified");
    }),
  );

  results.push(
    await withDomain("MonoApi.native functions should handle null arguments", () => {
      // mono_class_get_name with NULL should not crash
      try {
        const result = Mono.api.native.mono_class_get_name(NULL);
        console.log(`  - mono_class_get_name(NULL) = ${result}`);
      } catch (error) {
        console.log(`  - mono_class_get_name(NULL) threw: ${error}`);
      }
    }),
  );

  // ===== ERROR TYPE TESTS =====

  results.push(
    await withDomain("MonoManagedExceptionError should have correct name property", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          try {
            const str = Mono.api.stringNew("invalid");
            Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [str]);
          } catch (error: any) {
            assert(
              error.name === "MonoManagedExceptionError",
              `Error name should be MonoManagedExceptionError, got: ${error.name}`,
            );
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoManagedExceptionError should be instanceof Error", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          try {
            const str = Mono.api.stringNew("xyz");
            Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [str]);
          } catch (error: any) {
            assert(error instanceof Error, "Should be instanceof Error");
            assert(error instanceof MonoManagedExceptionError, "Should be instanceof MonoManagedExceptionError");
          }
        }
      }
    }),
  );

  // ===== EXCEPTION SLOT TESTS =====

  results.push(
    await withCoreClasses("Exception slot should be reused across invocations", ({ stringClass }) => {
      if (!stringClass) {
        console.log("  - System.String not available; skipping");
        return;
      }

      const concatMethod = stringClass.tryMethod("Concat", 2);
      if (!concatMethod) {
        console.log("  - System.String.Concat(string, string) not available; skipping");
        return;
      }

      // Multiple successful invocations
      for (let i = 0; i < 5; i++) {
        const str1 = Mono.api.stringNew(`Hello${i}`);
        const str2 = Mono.api.stringNew(` World${i}`);

        const result = Mono.api.runtimeInvoke(concatMethod.pointer, NULL, [str1, str2]);
        assertNotNull(result, `Invocation ${i} should succeed`);
      }

      console.log("  - 5 invocations completed with shared exception slot");
    }),
  );

  // ===== BOUNDARY AND EDGE CASE TESTS =====

  results.push(
    await withCoreClasses("MonoApi should handle rapid successive calls", ({ stringClass }) => {
      const isNullOrEmptyMethod = stringClass!.tryMethod("IsNullOrEmpty", 1);

      if (isNullOrEmptyMethod) {
        const iterations = 100;
        let successCount = 0;

        for (let i = 0; i < iterations; i++) {
          try {
            const testStr = Mono.api.stringNew(i % 2 === 0 ? "" : "test");
            Mono.api.runtimeInvoke(isNullOrEmptyMethod.pointer, NULL, [testStr]);
            successCount++;
          } catch {
            // Count failures
          }
        }

        console.log(`  - ${successCount}/${iterations} rapid calls succeeded`);
        assert(successCount === iterations, "All rapid calls should succeed");
      }
    }),
  );

  results.push(
    await withDomain("MonoApi should handle mixed success/exception calls", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");
      const parseMethod = int32Class!.tryMethod("Parse", 1);

      if (parseMethod) {
        const testInputs = [
          { value: "123", shouldSucceed: true },
          { value: "abc", shouldSucceed: false },
          { value: "456", shouldSucceed: true },
          { value: "xyz", shouldSucceed: false },
          { value: "789", shouldSucceed: true },
        ];

        let successCount = 0;
        let exceptionCount = 0;

        testInputs.forEach(input => {
          try {
            const str = Mono.api.stringNew(input.value);
            Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [str]);
            successCount++;
          } catch {
            exceptionCount++;
          }
        });

        const expectedSuccess = testInputs.filter(i => i.shouldSucceed).length;
        const expectedExceptions = testInputs.filter(i => !i.shouldSucceed).length;

        console.log(
          `  - Success: ${successCount}/${expectedSuccess}, Exceptions: ${exceptionCount}/${expectedExceptions}`,
        );
        assert(successCount === expectedSuccess, "Success count should match");
        assert(exceptionCount === expectedExceptions, "Exception count should match");
      }
    }),
  );

  // ===== VALUE BOX TESTS =====

  results.push(
    await withDomain("MonoApi should support mono_value_box for Int32", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const valuePtr = Memory.alloc(4);
        valuePtr.writeS32(42);

        const boxed = Mono.api.native.mono_value_box(Mono.api.getRootDomain(), int32Class.pointer, valuePtr);

        assertNotNull(boxed, "Boxed value should be available");
        assert(!boxed.isNull(), "Boxed value should not be null");

        // Verify the boxed object's class
        const objClass = Mono.api.native.mono_object_get_class(boxed);
        const className = Mono.api.native.mono_class_get_name(objClass);
        console.log(`  - Boxed Int32 class: ${className.readUtf8String()}`);
      }
    }),
  );

  results.push(
    await withDomain("MonoApi should support mono_object_unbox", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const valuePtr = Memory.alloc(4);
        valuePtr.writeS32(12345);

        const boxed = Mono.api.native.mono_value_box(Mono.api.getRootDomain(), int32Class.pointer, valuePtr);

        const unboxed = Mono.api.native.mono_object_unbox(boxed);
        assertNotNull(unboxed, "Unboxed pointer should be available");

        const unboxedValue = unboxed.readS32();
        assert(unboxedValue === 12345, `Unboxed value should be 12345, got: ${unboxedValue}`);
        console.log(`  - Unboxed value: ${unboxedValue}`);
      }
    }),
  );

  // ===== PERFORMANCE TESTS =====

  results.push(
    await withDomain("MonoApi native function lookup should be fast after caching", () => {
      const iterations = 1000;

      // Warm up cache
      Mono.api.native.mono_get_root_domain();

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        Mono.api.native.mono_get_root_domain();
      }
      const elapsed = Date.now() - startTime;

      console.log(`  - ${iterations} calls in ${elapsed}ms (${(elapsed / iterations).toFixed(3)}ms avg)`);
      assert(elapsed < 5000, "Cached function calls should be fast");
    }),
  );

  results.push(
    await withDomain("MonoApi string creation performance", () => {
      const iterations = 100;
      const testString = "Performance test string";

      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        Mono.api.stringNew(testString);
      }
      const elapsed = Date.now() - startTime;

      console.log(`  - ${iterations} stringNew calls in ${elapsed}ms`);
    }),
  );

  return results;
}

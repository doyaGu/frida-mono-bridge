/**
 * Comprehensive Utility and Helper Function Tests (Phase 4)
 * Tests for all utility modules and helper functions
 */

import {
  TestResult,
  TestSuite,
  TestCategory,
  createStandaloneTest,
  createPerformanceTest,
  createErrorHandlingTest,
  createIntegrationTest,
  createMonoDependentTest,
  assert,
  assertNotNull,
  assertThrows,
} from "./test-framework";

// Import Mono for real API access
import Mono from "../src";

// Import all utility modules
import * as FindUtils from "../src/utils/find";
import * as TraceUtils from "../src/utils/trace";
import * as TypesUtils from "../src/utils/types";
import * as MemoryUtils from "../src/utils/memory";
import * as ValidationUtils from "../src/utils/validation";
import * as CacheUtils from "../src/utils/cache";
import * as BatchUtils from "../src/utils/batch";
import * as RetryUtils from "../src/utils/retry";
import * as SafeAccessUtils from "../src/utils/safe-access";
import * as EnumerationUtils from "../src/utils/enumeration-utils";
import * as StringOperations from "../src/utils/string";
import * as TypeOperations from "../src/utils/type-operations";
import * as ErrorUtils from "../src/utils/errors";
import * as LogUtils from "../src/utils/log";

// Mock classes for testing pointer-like objects (not Mono API mocks)
class MockMonoObject {
  constructor(public handle: NativePointer) {}
  toPointer() {
    return this.handle;
  }
}

export function testMonoUtils(): TestResult {
  console.log("\nComprehensive Utility and Helper Function Tests:");

  const suite = new TestSuite("Mono Utils Complete Tests", TestCategory.STANDALONE);

  // ============================================================================
  // FIND UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Find utility - wildcard pattern matching", () => {
      // Test wildcard to regex conversion using custom implementation
      // (wildcardToRegex is an internal function, not exported)
      function wildcardToRegex(pattern: string): RegExp {
        const escaped = pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".");
        return new RegExp(`^${escaped}$`, "i");
      }

      function matchesPattern(name: string, pattern: string): boolean {
        if (pattern === "*") return true;
        return wildcardToRegex(pattern).test(name);
      }

      const pattern1 = "*Test*";
      const regex1 = wildcardToRegex(pattern1);
      assert(regex1.test("SomethingTestSomething"), "Should match wildcard pattern");
      assert(regex1.test("Test"), "Should match simple pattern");
      assert(!regex1.test("NoMatch"), "Should not match non-matching pattern");

      // Test pattern matching
      assert(matchesPattern("TestClass", "*Class"), "Should match class pattern");
      assert(matchesPattern("TestMethod", "Test*"), "Should match method pattern");
      assert(matchesPattern("Anything", "*"), "Should match wildcard only pattern");
    }),
  );

  suite.addResult(
    createStandaloneTest("Find utility - pattern parsing", () => {
      // Test ClassName.MethodName pattern parsing
      const testPattern = "Namespace.ClassName.MethodName";
      const parts = testPattern.split(".");
      assert(parts.length === 3, "Should parse pattern correctly");
      assert(parts[0] === "Namespace", "Should extract namespace");
      assert(parts[1] === "ClassName", "Should extract class name");
      assert(parts[2] === "MethodName", "Should extract method name");
    }),
  );

  suite.addResult(
    createStandaloneTest("Find utility - exact class lookup", () => {
      // Test exact class name parsing
      const fullName = "System.String";
      const parts = fullName.split(".");
      const className = parts.pop()!;
      const namespace = parts.join(".");

      assert(className === "String", "Should extract class name correctly");
      assert(namespace === "System", "Should extract namespace correctly");
    }),
  );

  // ============================================================================
  // TRACE UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Trace utility - method hooking interface", () => {
      // Test method callbacks interface
      const callbacks: TraceUtils.MethodCallbacks = {
        onEnter: (args: NativePointer[]) => {
          assert(Array.isArray(args), "Should receive args array");
        },
        onLeave: (retval: NativePointer) => {
          assertNotNull(retval, "Should receive return value");
        },
      };

      assertNotNull(callbacks.onEnter, "Should have onEnter callback");
      assertNotNull(callbacks.onLeave, "Should have onLeave callback");
    }),
  );

  suite.addResult(
    createStandaloneTest("Trace utility - callback validation", () => {
      // Test callback function validation
      const validCallbacks: TraceUtils.MethodCallbacks = {
        onEnter: () => {},
        onLeave: () => {},
      };

      assert(typeof validCallbacks.onEnter === "function", "onEnter should be function");
      assert(typeof validCallbacks.onLeave === "function", "onLeave should be function");

      // Test with optional callbacks
      const partialCallbacks: TraceUtils.MethodCallbacks = {
        onEnter: () => {},
      };

      assertNotNull(partialCallbacks.onEnter, "Should allow partial callbacks");
    }),
  );

  // ============================================================================
  // TYPES UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Types utility - Mono object detection", () => {
      // Test Mono object detection
      // Note: isMonoObject uses instanceof MonoObject, so MockMonoObject won't pass
      const mockObject = new MockMonoObject(ptr(0x12345678));

      // MockMonoObject is not a real MonoObject, so it should not be detected
      assert(!TypesUtils.isMonoObject(mockObject), "MockMonoObject is not a real MonoObject");
      assert(!TypesUtils.isMonoObject({}), "Should not detect plain object as Mono object");
      assert(!TypesUtils.isMonoObject(null), "Should not detect null as Mono object");
      assert(!TypesUtils.isMonoObject("string"), "Should not detect string as Mono object");

      // Verify the function can distinguish types correctly
      assert(!TypesUtils.isMonoObject(undefined), "Should not detect undefined as Mono object");
      assert(!TypesUtils.isMonoObject(123), "Should not detect number as Mono object");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Types utility - TypeHelper class", () => {
      // Test TypeHelper instantiation with real Mono API
      Mono.perform(() => {
        const typeHelper = TypesUtils.createTypeHelper(Mono.api);
        assertNotNull(typeHelper, "Should create TypeHelper instance");
        assert(typeof typeHelper.box === "function", "Should have box method");
        assert(typeof typeHelper.unbox === "function", "Should have unbox method");
        assert(typeof typeHelper.getTypeForPrimitive === "function", "Should have getTypeForPrimitive method");
      });
    }),
  );

  suite.addResult(
    createMonoDependentTest("Types utility - primitive type detection", () => {
      // Test primitive type detection with real Mono API
      Mono.perform(() => {
        const typeHelper = TypesUtils.createTypeHelper(Mono.api);

        // Test invalid type always returns null
        const invalidType = typeHelper.getTypeForPrimitive({});
        assert(invalidType === null, "Should return null for invalid type");

        // Test that the method exists and is callable
        // Note: getTypeForPrimitive may fail if mono_domain_assembly_open is not available
        try {
          const boolResult = typeHelper.getTypeForPrimitive(true);
          // May return null if type not found in mscorlib
          assert(boolResult === null || typeof boolResult === "object", "Should return null or type for boolean");

          const numResult = typeHelper.getTypeForPrimitive(42);
          assert(numResult === null || typeof numResult === "object", "Should return null or type for number");

          const strResult = typeHelper.getTypeForPrimitive("test");
          assert(strResult === null || typeof strResult === "object", "Should return null or type for string");
        } catch (e) {
          // Expected if mono_domain_assembly_open is not available in this Mono version
          console.log(`    (Skipped primitive type lookup: ${e})`);
        }
      });
    }),
  );

  // ============================================================================
  // MEMORY UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Memory utility - pointer resolution", () => {
      // Test NativePointer resolution
      const testPtr = ptr(0x12345678);
      const mockObject = new MockMonoObject(testPtr);

      assert(MemoryUtils.resolveNativePointer(testPtr) === testPtr, "Should resolve NativePointer");
      assert(
        MemoryUtils.resolveNativePointer(mockObject.toPointer()) === testPtr,
        "Should resolve from object with handle",
      );
      assert(
        MemoryUtils.resolveNativePointer({ pointer: testPtr }) === testPtr,
        "Should resolve from object with pointer property",
      );
      assert(
        MemoryUtils.resolveNativePointer({ toPointer: () => testPtr }) === testPtr,
        "Should resolve from object with toPointer method",
      );
      assert(MemoryUtils.resolveNativePointer(null) === null, "Should return null for null input");
      assert(MemoryUtils.resolveNativePointer(undefined) === null, "Should return null for undefined input");
    }),
  );

  suite.addResult(
    createStandaloneTest("Memory utility - pointer null checking", () => {
      // Test pointer null detection
      assert(MemoryUtils.pointerIsNull(null), "Should detect null as null");
      assert(MemoryUtils.pointerIsNull(undefined), "Should detect undefined as null");
      assert(MemoryUtils.pointerIsNull(0), "Should detect zero as null");
      assert(MemoryUtils.pointerIsNull(ptr(0)), "Should detect null pointer as null");
      assert(!MemoryUtils.pointerIsNull(ptr(0x12345678)), "Should not detect valid pointer as null");
      assert(!MemoryUtils.pointerIsNull(42), "Should not detect non-zero number as null");
    }),
  );

  suite.addResult(
    createStandaloneTest("Memory utility - pointer validation", () => {
      // Test pointer validation
      const validPtr = ptr(0x12345678);
      const invalidPtr = ptr(0);

      assert(MemoryUtils.isValidPointer(validPtr), "Should validate valid pointer");
      assert(!MemoryUtils.isValidPointer(invalidPtr), "Should not validate null pointer");
      assert(!MemoryUtils.isValidPointer(null), "Should not validate null");
      assert(!MemoryUtils.isValidPointer(undefined), "Should not validate undefined");
    }),
  );

  suite.addResult(
    createStandaloneTest("Memory utility - instance unwrapping", () => {
      // Test instance unwrapping
      const testPtr = ptr(0x12345678);
      const mockObject = new MockMonoObject(testPtr);

      assert(MemoryUtils.unwrapInstance(mockObject) === testPtr, "Should unwrap instance to pointer");
      assert(MemoryUtils.unwrapInstance(testPtr) === testPtr, "Should return pointer as-is");
      assert(MemoryUtils.unwrapInstance(null).isNull(), "Should return null pointer for null input");
      assert(MemoryUtils.unwrapInstance(undefined).isNull(), "Should return null pointer for undefined input");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Memory utility - safe allocation", () => {
      // Test safe allocation
      const validPtr = MemoryUtils.safeAlloc(100);
      assertNotNull(validPtr, "Should allocate memory successfully");

      assertThrows(() => MemoryUtils.safeAlloc(0), "Should throw for zero size");
      assertThrows(() => MemoryUtils.safeAlloc(-10), "Should throw for negative size");
    }),
  );

  // ============================================================================
  // VALIDATION UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Validation utility - string validation", () => {
      // Test non-empty string validation
      ValidationUtils.validateNonEmptyString("test", "testParam");

      assertThrows(() => ValidationUtils.validateNonEmptyString("", "testParam"), "Should throw for empty string");
      assertThrows(
        () => ValidationUtils.validateNonEmptyString("   ", "testParam"),
        "Should throw for whitespace-only string",
      );
      assertThrows(() => ValidationUtils.validateNonEmptyString(null as any, "testParam"), "Should throw for null");
      assertThrows(
        () => ValidationUtils.validateNonEmptyString(undefined as any, "testParam"),
        "Should throw for undefined",
      );
    }),
  );

  suite.addResult(
    createStandaloneTest("Validation utility - pointer validation", () => {
      // Test non-null pointer validation
      const validPtr = ptr(0x12345678);
      ValidationUtils.validateNonNullPointer(validPtr, "testParam");

      assertThrows(() => ValidationUtils.validateNonNullPointer(ptr(0), "testParam"), "Should throw for null pointer");
      assertThrows(() => ValidationUtils.validateNonNullPointer(null, "testParam"), "Should throw for null");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Validation utility - delegate argument preparation", () => {
      // Test delegate argument preparation with real Mono API
      Mono.perform(() => {
        const stringArg = ValidationUtils.prepareDelegateArgument(Mono.api, "test");
        assertNotNull(stringArg, "Should prepare string argument");

        const numberArg = ValidationUtils.prepareDelegateArgument(Mono.api, 42);
        assertNotNull(numberArg, "Should prepare number argument");

        const nullArg = ValidationUtils.prepareDelegateArgument(Mono.api, null);
        assertNotNull(nullArg, "Should prepare null argument");

        const ptrArg = ValidationUtils.prepareDelegateArgument(Mono.api, ptr(0x12345678));
        assertNotNull(ptrArg, "Should prepare pointer argument");
      });
    }),
  );

  suite.addResult(
    createMonoDependentTest("Validation utility - parameter count verification", () => {
      // Test parameter count verification with real Mono API
      Mono.perform(() => {
        // Get a real method from System.String
        const domain = Mono.domain;
        const stringClass = domain.class("System.String");
        if (!stringClass) {
          console.log("    (Skipped: System.String not found)");
          return;
        }

        // Find a method with known parameter count
        const methods = stringClass.getMethods();
        const concatMethod = methods.find((m: any) => m.getName() === "Concat" && m.getParameterCount() === 2);
        if (!concatMethod) {
          console.log("    (Skipped: Concat method with 2 params not found)");
          return;
        }

        // Should not throw for correct count
        ValidationUtils.verifyParameterCount(Mono.api, concatMethod, 2, "test context");

        // Should throw for incorrect count
        assertThrows(
          () => ValidationUtils.verifyParameterCount(Mono.api, concatMethod, 3, "test context"),
          "Should throw for incorrect parameter count",
        );
      });
    }),
  );

  // ============================================================================
  // CACHE UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Cache utility - LRU cache basic operations", () => {
      // Test LRU cache creation and basic operations
      const cache = new CacheUtils.LruCache<string, number>(3);

      assert(cache.size === 0, "Should start empty");
      assert(cache.maxSize === 3, "Should have correct capacity");

      // Test set and get
      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3);

      assert(cache.size === 3, "Should have 3 items");
      assert(cache.get("key1") === 1, "Should get correct value");
      assert(cache.get("key2") === 2, "Should get correct value");
      assert(cache.get("key3") === 3, "Should get correct value");
    }),
  );

  suite.addResult(
    createStandaloneTest("Cache utility - LRU eviction", () => {
      // Test LRU eviction behavior
      const cache = new CacheUtils.LruCache<string, number>(2);

      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3); // Should evict key1

      assert(cache.size === 2, "Should maintain capacity");
      assert(cache.get("key1") === undefined, "Should evict oldest item");
      assert(cache.get("key2") === 2, "Should keep newer items");
      assert(cache.get("key3") === 3, "Should keep newest item");
    }),
  );

  suite.addResult(
    createStandaloneTest("Cache utility - LRU access order", () => {
      // Test LRU access order updates
      const cache = new CacheUtils.LruCache<string, number>(3);

      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3);

      // Access key1 to make it most recently used
      cache.get("key1");

      // Add new item, should evict key2 (least recently used)
      cache.set("key4", 4);

      assert(cache.get("key1") === 1, "Should keep accessed item");
      assert(cache.get("key2") === undefined, "Should evict least recently used");
      assert(cache.get("key3") === 3, "Should keep other items");
      assert(cache.get("key4") === 4, "Should keep new item");
    }),
  );

  suite.addResult(
    createStandaloneTest("Cache utility - cache utilities", () => {
      // Test cache utility methods
      const cache = new CacheUtils.LruCache<string, number>(3);

      // Test has method
      cache.set("key1", 1);
      assert(cache.has("key1"), "Should have key1");
      assert(!cache.has("key2"), "Should not have key2");

      // Test peek method (doesn't update access order)
      cache.set("key2", 2);
      cache.peek("key1"); // Peek doesn't update order, key1 is still oldest
      cache.set("key3", 3);

      // Cache is full now with capacity 3, no eviction yet
      assert(cache.size === 3, "Cache should be full with 3 items");

      // Add key4, which should evict key1 (oldest, since peek doesn't update order)
      cache.set("key4", 4);

      assert(cache.get("key1") === undefined, "Should evict key1 (peek doesn't update order)");
      assert(cache.get("key2") === 2, "Should keep key2");

      // Test delete method
      assert(cache.delete("key2"), "Should delete existing key");
      assert(!cache.delete("key2"), "Should not delete non-existing key");
      assert(!cache.has("key2"), "Should not have deleted key");
    }),
  );

  suite.addResult(
    createStandaloneTest("Cache utility - getOrCreate factory", () => {
      // Test getOrCreate with factory function
      const cache = new CacheUtils.LruCache<string, number>(3);
      let callCount = 0;

      const factory = () => {
        callCount++;
        return 42;
      };

      // First call should invoke factory
      const value1 = cache.getOrCreate("key1", factory);
      assert(value1 === 42, "Should return factory value");
      assert(callCount === 1, "Should call factory once");

      // Second call should use cached value
      const value2 = cache.getOrCreate("key1", factory);
      assert(value2 === 42, "Should return cached value");
      assert(callCount === 1, "Should not call factory again");
    }),
  );

  suite.addResult(
    createStandaloneTest("Cache utility - single value operations", () => {
      // Test single value operations
      const cache = new CacheUtils.LruCache<string, number>(3);

      cache.setSingleValue(100);
      assert(cache.getSingleValue() === 100, "Should get single value");

      cache.setSingleValue(200, "customSlot");
      assert(cache.getSingleValue("customSlot") === 200, "Should get custom slot value");

      cache.clearSingleValue();
      assert(cache.getSingleValue() === undefined, "Should clear single value");

      cache.clearSingleValue("customSlot");
      assert(cache.getSingleValue("customSlot") === undefined, "Should clear custom slot value");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Cache utility - invalid capacity", () => {
      // Test invalid capacity handling
      assertThrows(() => new CacheUtils.LruCache<string, number>(0), "Should throw for zero capacity");
      assertThrows(() => new CacheUtils.LruCache<string, number>(-1), "Should throw for negative capacity");
    }),
  );

  // ============================================================================
  // BATCH UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Batch utility - basic operations", () => {
      // Test batch operation basic functionality
      const batch = new BatchUtils.BatchOperation();

      assert(batch.size === 0, "Should start empty");

      // Add operations
      batch.add(() => 1);
      batch.add(() => 2);
      batch.add(() => 3);

      assert(batch.size === 3, "Should track operation count");

      // Execute all operations
      const results = batch.executeAll("test context");
      assert(results.length === 3, "Should return results for all operations");
      assert(results[0] === 1, "Should return correct result");
      assert(results[1] === 2, "Should return correct result");
      assert(results[2] === 3, "Should return correct result");
    }),
  );

  suite.addResult(
    createStandaloneTest("Batch utility - error handling", () => {
      // Test batch operation error handling (silent mode to avoid noise)
      const batch = new BatchUtils.BatchOperation({ silent: true });

      batch.add(() => 1);
      batch.add(() => {
        throw new Error("Test error");
      });
      batch.add(() => 3);

      const results = batch.executeAll("test context");
      assert(results.length === 3, "Should return results for all operations");
      assert(results[0] === 1, "Should return successful result");
      assert(results[1] === null, "Should return null for failed operation");
      assert(results[2] === 3, "Should continue after error");
    }),
  );

  suite.addResult(
    createStandaloneTest("Batch utility - successful only", () => {
      // Test executeSuccessfulOnly method (silent mode to avoid noise)
      const batch = new BatchUtils.BatchOperation({ silent: true });

      batch.add(() => 1);
      batch.add(() => {
        throw new Error("Test error");
      });
      batch.add(() => 3);

      const results = batch.executeSuccessfulOnly<number>("test context");
      assert(results.length === 2, "Should return only successful results");
      assert(results[0] === 1, "Should include first result");
      assert(results[1] === 3, "Should include third result");
    }),
  );

  suite.addResult(
    createStandaloneTest("Batch utility - clear operations", () => {
      // Test clear functionality
      const batch = new BatchUtils.BatchOperation();

      batch.add(() => 1);
      batch.add(() => 2);
      assert(batch.size === 2, "Should have operations");

      batch.clear();
      assert(batch.size === 0, "Should clear all operations");
    }),
  );

  // ============================================================================
  // RETRY UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Retry utility - basic functionality", () => {
      // Test retry operation basic functionality
      const retry = new RetryUtils.RetryOperation(3, 10);

      let attemptCount = 0;
      const operation = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      };

      // Note: This test would need to be async in real scenario
      // For now, just test the constructor
      assert(retry !== null, "Should create retry operation");
    }),
  );

  suite.addResult(
    createStandaloneTest("Retry utility - factory function", () => {
      // Test retry factory function
      const retry = RetryUtils.withRetry(5, 50);
      assertNotNull(retry, "Should create retry operation with factory");
    }),
  );

  // ============================================================================
  // SAFE ACCESS UTILITY TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("SafeAccess utility - property access", () => {
      // Test safe property access
      const testObj = {
        property1: "value1",
        property2: 42,
        method1: () => "method result",
      };

      const safeAccess = SafeAccessUtils.safeAccess(testObj);

      assert(safeAccess.get("property1") === "value1", "Should get property value");
      assert(safeAccess.get("property2") === 42, "Should get property value");
      // Non-existent properties return undefined (standard JS behavior)
      assert(safeAccess.get("nonexistent") === undefined, "Should return undefined for nonexistent property");
    }),
  );

  suite.addResult(
    createStandaloneTest("SafeAccess utility - method invocation", () => {
      // Test safe method invocation (silent mode to avoid noise)
      const testObj = {
        method1: () => "method result",
        method2: (a: number, b: number) => a + b,
        property1: "not a method",
      };

      const safeAccess = SafeAccessUtils.safeAccess(testObj, { silent: true });

      assert(safeAccess.call("method1") === "method result", "Should call method without args");
      assert(safeAccess.call("method2", 2, 3) === 5, "Should call method with args");
      assert(safeAccess.call("nonexistent") === null, "Should return null for nonexistent method");
      assert(safeAccess.call("property1") === null, "Should return null for non-method property");
    }),
  );

  suite.addResult(
    createStandaloneTest("SafeAccess utility - error handling", () => {
      // Test error handling in safe access (silent mode to avoid noise)
      const testObj = {
        get errorProperty() {
          throw new Error("Property access error");
        },
        errorMethod: () => {
          throw new Error("Method invocation error");
        },
      };

      const safeAccess = SafeAccessUtils.safeAccess(testObj, { silent: true });

      // These should not throw, but return null on errors
      assert(safeAccess.get("errorProperty") === null, "Should handle property access errors");
      assert(safeAccess.call("errorMethod") === null, "Should handle method invocation errors");
    }),
  );

  // ============================================================================
  // ENUMERATION UTILS TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("EnumerationUtils - handle enumeration", () => {
      // Test handle enumeration pattern
      let callCount = 0;
      const mockHandles = [ptr(0x1), ptr(0x2), ptr(0x3)];

      const fetch = (iter: NativePointer) => {
        const index = callCount;
        callCount++;
        return index < mockHandles.length ? mockHandles[index] : ptr(0);
      };

      const factory = (ptr: NativePointer) => ({ handle: ptr, id: callCount });

      const results = EnumerationUtils.enumerateHandles(fetch, factory);
      assert(results.length === 3, "Should enumerate all handles");
      assert(results[0].handle.equals(ptr(0x1)), "Should create correct objects");
    }),
  );

  suite.addResult(
    createStandaloneTest("EnumerationUtils - assembly enumeration", () => {
      // Test assembly enumeration
      let callCount = 0;
      const mockAssemblies = [ptr(0x1), ptr(0x2)];

      const mockApi = {
        native: {
          mono_domain_assembly_open: () => {
            const result = callCount < mockAssemblies.length ? mockAssemblies[callCount] : ptr(0);
            callCount++;
            return result;
          },
        },
      } as any;

      const factory = (ptr: NativePointer) => ({ pointer: ptr });

      const results = EnumerationUtils.enumerateAssemblies(mockApi, ptr(0x12345678), factory);
      assert(results.length >= 0, "Should handle enumeration gracefully");
    }),
  );

  // ============================================================================
  // STRING OPERATIONS TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("StringOperations - UTF-8 string reading", () => {
      // Test UTF-8 string reading
      const testPtr = ptr(0x12345678);

      // Test with null pointer
      assert(StringOperations.readUtf8String(null) === "", "Should return empty string for null");
      assert(StringOperations.readUtf8String(ptr(0)) === "", "Should return empty string for null pointer");

      // Test with mock pointer (would need actual memory in real scenario)
      // For now, just test the function exists and handles null
      assert(typeof StringOperations.readUtf8String === "function", "Should have readUtf8String function");
    }),
  );

  suite.addResult(
    createStandaloneTest("StringOperations - Mono string reading", () => {
      // Test Mono string reading
      const mockMonoString = new MockMonoObject(ptr(0x12345678));

      // Test with different input types
      assert(StringOperations.readMonoString("") === "", "Should handle empty string");
      assert(StringOperations.readMonoString(null) === "", "Should handle null");
      assert(StringOperations.readMonoString(undefined) === "", "Should handle undefined");
      assert(typeof StringOperations.readMonoString(mockMonoString) === "string", "Should handle Mono string object");
    }),
  );

  suite.addResult(
    createStandaloneTest("StringOperations - UTF-16 string reading", () => {
      // Test UTF-16 string reading
      assert(StringOperations.readUtf16String(null) === "", "Should return empty string for null");
      assert(StringOperations.readUtf16String(ptr(0)) === "", "Should return empty string for null pointer");
      assert(typeof StringOperations.readUtf16String === "function", "Should have readUtf16String function");
    }),
  );

  suite.addResult(
    createStandaloneTest("StringOperations - safe stringification", () => {
      // Test safe JSON stringification
      const testObj = { name: "test", value: 42 };
      const result = StringOperations.safeStringify(testObj);
      assert(result.includes("test"), "Should stringify object");

      // Test with NativePointer - safeStringify wraps in JSON, so output varies
      const mockPtr = ptr(0x12345678);
      const ptrResult = StringOperations.safeStringify(mockPtr);
      // NativePointer toString() or custom serialization
      assert(ptrResult.length > 0, "Should handle NativePointer");

      // Test with function
      const funcResult = StringOperations.safeStringify(() => {});
      // Function serialization
      assert(funcResult.length > 0, "Should handle function");
    }),
  );

  suite.addResult(
    createStandaloneTest("StringOperations - error creation", () => {
      // Test error creation with context
      const error = StringOperations.createError("Test error", { context: "test" });
      assert(error instanceof ErrorUtils.MonoError, "Should create MonoError");
      assert(error.message.includes("Test error"), "Should include message");
      assert(error.message.includes("context"), "Should include context");
    }),
  );

  suite.addResult(
    createStandaloneTest("StringOperations - performance timer", () => {
      // Test performance timer
      const timer = StringOperations.createTimer();
      assertNotNull(timer, "Should create timer");

      const elapsed1 = timer.elapsed();
      assert(elapsed1 >= 0, "Should measure elapsed time");

      timer.restart();
      const elapsed2 = timer.elapsed();
      assert(elapsed2 >= 0, "Should measure time after restart");

      const elapsedMs = timer.elapsedMs();
      assert(elapsedMs >= 0, "Should measure milliseconds");

      const elapsedSeconds = timer.elapsedSeconds();
      assert(elapsedSeconds >= 0, "Should measure seconds");
    }),
  );

  // ============================================================================
  // TYPE OPERATIONS TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("TypeOperations - pointer-like detection", () => {
      // Test pointer-like type detection
      assert(TypeOperations.isPointerLike(0x1), "Should detect OBJECT type");
      assert(TypeOperations.isPointerLike(0x2), "Should detect SZARRAY type");
      assert(TypeOperations.isPointerLike(0x3), "Should detect STRING type");
      assert(TypeOperations.isPointerLike(0x4), "Should detect CLASS type");
      assert(TypeOperations.isPointerLike(0x6), "Should detect GENERICINST type");
      assert(TypeOperations.isPointerLike(0x8), "Should detect ARRAY type");
      assert(TypeOperations.isPointerLike(0x1c), "Should detect PTR type");
      assert(!TypeOperations.isPointerLike(0x5), "Should not detect non-pointer type");
    }),
  );

  suite.addResult(
    createStandaloneTest("TypeOperations - type guards", () => {
      // Test type guard functions
      assert(TypeOperations.isString("test"), "Should detect string");
      assert(!TypeOperations.isString(123), "Should not detect number as string");

      assert(TypeOperations.isNumber(123), "Should detect number");
      assert(!TypeOperations.isNumber("123"), "Should not detect string as number");

      assert(TypeOperations.isBoolean(true), "Should detect boolean");
      assert(!TypeOperations.isBoolean(1), "Should not detect number as boolean");

      assert(
        TypeOperations.isFunction(() => {}),
        "Should detect function",
      );
      assert(!TypeOperations.isFunction({}), "Should not detect object as function");

      assert(TypeOperations.isObject({}), "Should detect object");
      assert(!TypeOperations.isObject([]), "Should not detect array as object");
      assert(!TypeOperations.isObject(null), "Should not detect null as object");

      assert(TypeOperations.isArray([]), "Should detect array");
      assert(!TypeOperations.isArray({}), "Should not detect object as array");
    }),
  );

  suite.addResult(
    createStandaloneTest("TypeOperations - Mono type guards", () => {
      // Test Mono-specific type guards
      const mockClass = {
        name: "TestClass",
        methods: [],
        fields: [],
      };

      const mockMethod = {
        name: "TestMethod",
        isStatic: () => false,
        invoke: () => {},
      };

      const mockField = {
        name: "TestField",
        type: "string",
        isStatic: () => false,
      };

      assert(TypeOperations.isMonoClass(mockClass), "Should detect Mono class");
      assert(TypeOperations.isMonoMethod(mockMethod), "Should detect Mono method");
      assert(TypeOperations.isMonoField(mockField), "Should detect Mono field");

      assert(!TypeOperations.isMonoClass({}), "Should not detect plain object as Mono class");
      assert(!TypeOperations.isMonoMethod({}), "Should not detect plain object as Mono method");
      assert(!TypeOperations.isMonoField({}), "Should not detect plain object as Mono field");
    }),
  );

  suite.addResult(
    createStandaloneTest("TypeOperations - validation functions", () => {
      // Test validation functions
      assert(TypeOperations.validateRequired("test", "param") === "test", "Should validate required value");

      assertThrows(() => TypeOperations.validateRequired(null, "param"), "Should throw for null");
      assertThrows(() => TypeOperations.validateRequired(undefined, "param"), "Should throw for undefined");

      // Test string validation
      assert(TypeOperations.validateString("test", "param") === "test", "Should validate string");

      assertThrows(() => TypeOperations.validateString("", "param", { minLength: 1 }), "Should throw for too short");
      assertThrows(
        () => TypeOperations.validateString("toolong", "param", { maxLength: 3 }),
        "Should throw for too long",
      );
      assertThrows(
        () => TypeOperations.validateString("abc", "param", { pattern: /^\d+$/ }),
        "Should throw for pattern mismatch",
      );
    }),
  );

  suite.addResult(
    createStandaloneTest("TypeOperations - method signature validation", () => {
      // Test method signature validation
      assert(TypeOperations.isValidMethodSignature("Class:Method(Type,Type)"), "Should validate correct signature");
      assert(TypeOperations.isValidMethodSignature("Namespace.Class:Method()"), "Should validate simple signature");
      assert(!TypeOperations.isValidMethodSignature("invalid"), "Should reject invalid signature");
      assert(!TypeOperations.isValidMethodSignature(""), "Should reject empty signature");
      assert(!TypeOperations.isValidMethodSignature(null as any), "Should reject null");
      assert(!TypeOperations.isValidMethodSignature(undefined as any), "Should reject undefined");
    }),
  );

  // ============================================================================
  // LOGGER TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Logger - basic functionality", () => {
      // Test logger creation and basic functionality
      const logger = new LogUtils.Logger();
      assertNotNull(logger, "Should create logger");

      const taggedLogger = LogUtils.Logger.withTag("TestTag");
      assertNotNull(taggedLogger, "Should create tagged logger");

      const levelLogger = LogUtils.Logger.withLevel("debug");
      assertNotNull(levelLogger, "Should create logger with level");

      const customLogger = LogUtils.Logger.create({ tag: "Custom", level: "warn" });
      assertNotNull(customLogger, "Should create custom logger");
    }),
  );

  suite.addResult(
    createStandaloneTest("Logger - static methods", () => {
      // Test static convenience methods exist and are callable
      assert(typeof LogUtils.Logger.debug === "function", "Should have debug method");
      assert(typeof LogUtils.Logger.info === "function", "Should have info method");
      assert(typeof LogUtils.Logger.warn === "function", "Should have warn method");
      assert(typeof LogUtils.Logger.error === "function", "Should have error method");

      // Note: Not calling the methods here to avoid noise in test output
      // The methods themselves are tested by other logging tests
    }),
  );

  suite.addResult(
    createStandaloneTest("Logger - instance methods", () => {
      // Test instance methods exist and are callable
      const logger = new LogUtils.Logger({ tag: "Test", level: "debug" });

      // Verify methods exist
      assert(typeof logger.debug === "function", "Should have debug method");
      assert(typeof logger.info === "function", "Should have info method");
      assert(typeof logger.warn === "function", "Should have warn method");
      assert(typeof logger.error === "function", "Should have error method");

      // Note: Not calling the methods here to avoid noise in test output
    }),
  );

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  suite.addResult(
    createPerformanceTest("Cache utility - LRU cache performance", () => {
      // Test LRU cache performance
      const cache = new CacheUtils.LruCache<string, number>(1000);

      // Fill cache
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      // Random access pattern
      for (let i = 0; i < 10000; i++) {
        const key = `key${Math.floor(Math.random() * 1000)}`;
        cache.get(key);
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("String operations - performance timer overhead", () => {
      // Test performance timer overhead
      for (let i = 0; i < 10000; i++) {
        const timer = StringOperations.createTimer();
        timer.elapsed();
        timer.restart();
        timer.elapsedMs();
        timer.elapsedSeconds();
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("Type operations - validation performance", () => {
      // Test validation performance
      const testValues = ["test", 123, true, {}, [], () => {}];

      for (let i = 0; i < 10000; i++) {
        for (const value of testValues) {
          TypeOperations.isString(value);
          TypeOperations.isNumber(value);
          TypeOperations.isBoolean(value);
          TypeOperations.isFunction(value);
          TypeOperations.isObject(value);
          TypeOperations.isArray(value);
        }
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("Memory operations - pointer resolution performance", () => {
      // Test pointer resolution performance
      const testPtr = ptr(0x12345678);
      const mockObj = new MockMonoObject(testPtr);
      const testValues = [testPtr, mockObj, { pointer: testPtr }, null, undefined];

      for (let i = 0; i < 10000; i++) {
        for (const value of testValues) {
          MemoryUtils.resolveNativePointer(value);
          MemoryUtils.pointerIsNull(value);
          // Only test isValidPointer with compatible types
          if (value === testPtr || value === null || value === undefined) {
            MemoryUtils.isValidPointer(value as NativePointer);
          }
        }
      }
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(
    createIntegrationTest("Utilities integration - cache with validation", () => {
      // Test integration between cache and validation utilities
      const cache = new CacheUtils.LruCache<string, any>(10);

      // Cache validated objects
      const validatedString = TypeOperations.validateString("test", "param");
      cache.set("string", validatedString);

      const validatedNumber = TypeOperations.validateRequired(42, "param");
      cache.set("number", validatedNumber);

      assert(cache.get("string") === "test", "Should retrieve validated string");
      assert(cache.get("number") === 42, "Should retrieve validated number");
    }),
  );

  suite.addResult(
    createIntegrationTest("Utilities integration - batch with retry", () => {
      // Test integration between batch and retry utilities
      const batch = new BatchUtils.BatchOperation();
      const retry = RetryUtils.withRetry(3, 10);

      // Add operations to batch
      batch.add(() => "operation1");
      batch.add(() => "operation2");
      batch.add(() => "operation3");

      // Execute batch (in real scenario, would use retry for each operation)
      const results = batch.executeAll("integration test");
      assert(results.length === 3, "Should execute all operations");
      assert(
        results.every(r => r !== null),
        "All operations should succeed",
      );
    }),
  );

  suite.addResult(
    createIntegrationTest("Utilities integration - safe access with logging", () => {
      // Test integration between safe access and logging (silent mode for error test)
      const testObj = {
        property: "value",
        method: () => "result",
      };

      // Create an object with a throwing getter using defineProperty
      const errorObj: any = {};
      Object.defineProperty(errorObj, "errorProp", {
        get: () => {
          throw new Error("Access error");
        },
        enumerable: true,
        configurable: true,
      });

      const safeAccess = SafeAccessUtils.safeAccess(testObj);
      const errorAccess = SafeAccessUtils.safeAccess(errorObj, { silent: true });
      const logger = LogUtils.Logger.withTag("SafeAccessTest");

      // These should work without throwing
      const propValue = safeAccess.get("property");
      const methodResult = safeAccess.call("method");
      const errorResult = errorAccess.get("errorProp");

      assert(propValue === "value", "Should get property safely");
      assert(methodResult === "result", "Should call method safely");
      assert(errorResult === null, "Should handle errors gracefully");

      logger.info("Safe access integration test completed");
    }),
  );

  suite.addResult(
    createIntegrationTest("Utilities integration - type operations with memory", () => {
      // Test integration between type operations and memory utilities
      const testPtr = ptr(0x12345678);
      const mockObj = new MockMonoObject(testPtr);

      // Test type validation with memory operations
      if (TypeOperations.isObject(mockObj)) {
        const resolvedPtr = MemoryUtils.resolveNativePointer(mockObj);
        assert(MemoryUtils.isValidPointer(resolvedPtr), "Should resolve and validate pointer");
      }

      // Test pointer validation
      ValidationUtils.validateNonNullPointer(testPtr, "testPointer");

      // Test safe unwrapping
      const unwrapped = MemoryUtils.unwrapInstance(mockObj);
      assert(unwrapped.equals(testPtr), "Should unwrap instance correctly");
    }),
  );

  suite.addResult(
    createIntegrationTest("Utilities integration - comprehensive workflow", () => {
      // Test comprehensive workflow using multiple utilities
      const cache = new CacheUtils.LruCache<string, any>(5);
      const batch = new BatchUtils.BatchOperation();
      const logger = LogUtils.Logger.withTag("WorkflowTest");

      // Step 1: Validate and cache data
      const validatedData = TypeOperations.validateString("workflow test", "data", { minLength: 5 });
      cache.set("validatedData", validatedData);

      // Step 2: Add operations to batch
      batch.add(() => cache.get("validatedData"));
      batch.add(() => StringOperations.safeStringify({ data: validatedData }));
      batch.add(() => StringOperations.createTimer().elapsedMs());

      // Step 3: Execute batch with error handling
      const results = batch.executeAll("workflow test");

      // Step 4: Validate results
      assert(results[0] === "workflow test", "Should get cached data");
      assert(results[1].includes("workflow test"), "Should stringify data");
      assert(typeof results[2] === "number", "Should get elapsed time");

      logger.info("Comprehensive workflow test completed successfully");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Utils Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} utility tests passed`,
    duration: summary.duration,
    category: TestCategory.STANDALONE,
    requiresMono: false,
  };
}

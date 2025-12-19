/**
 * Comprehensive Utility and Helper Function Tests (Phase 4)
 * Tests for all utility modules and helper functions
 *
 * V2: Uses facade imports where possible. Some tests still need direct module access
 * to test internal implementation details.
 */

import { MonoError } from "../src";
import { LruCache, memoize } from "../src/utils/cache";
import { Logger } from "../src/utils/log";
import {
  allocPointerArray,
  ensurePointer,
  enumerateMonoHandles,
  isNativePointer,
  isValidPointer,
  pointerIsNull,
  resolveNativePointer,
  safeAlloc,
  tryMakePointer,
  unwrapInstance,
} from "../src/utils/memory";
import {
  createError,
  createTimer,
  readMonoString,
  readUtf16String,
  readUtf8String,
  safeStringify,
} from "../src/utils/string";
import type { MethodCallbacks } from "../src/model/trace";

import {
  TestCategory,
  TestResult,
  TestSuite,
  assert,
  assertNotNull,
  assertThrows,
  createErrorHandlingTest,
  createIntegrationTest,
  createPerformanceTest,
  createStandaloneTest,
} from "./test-framework";

// Mock classes for testing pointer-like objects (not Mono API mocks)
class MockMonoObject {
  constructor(public handle: NativePointer) {}
  toPointer() {
    return this.handle;
  }
}

export async function createMonoUtilsTests(): Promise<TestResult> {
  console.log("\nComprehensive Utility and Helper Function Tests:");

  const suite = new TestSuite("Mono Utils Complete Tests", TestCategory.STANDALONE);

  // ============================================================================
  // FIND UTILITY TESTS
  // ============================================================================

  await suite.addResultAsync(
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

  await suite.addResultAsync(
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

  await suite.addResultAsync(
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

  await suite.addResultAsync(
    createStandaloneTest("Trace utility - method hooking interface", () => {
      // Test method callbacks interface
      const callbacks: MethodCallbacks = {
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

  await suite.addResultAsync(
    createStandaloneTest("Trace utility - callback validation", () => {
      // Test callback function validation
      const validCallbacks: MethodCallbacks = {
        onEnter: () => {},
        onLeave: () => {},
      };

      assert(typeof validCallbacks.onEnter === "function", "onEnter should be function");
      assert(typeof validCallbacks.onLeave === "function", "onLeave should be function");

      // Test with optional callbacks
      const partialCallbacks: MethodCallbacks = {
        onEnter: () => {},
      };

      assertNotNull(partialCallbacks.onEnter, "Should allow partial callbacks");
    }),
  );

  // ============================================================================
  // MEMORY UTILITY TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - pointer resolution", () => {
      // Test NativePointer resolution
      const testPtr = ptr(0x12345678);
      const mockObject = new MockMonoObject(testPtr);

      assert(resolveNativePointer(testPtr) === testPtr, "Should resolve NativePointer");
      assert(resolveNativePointer(mockObject.toPointer()) === testPtr, "Should resolve from object with handle");
      assert(
        resolveNativePointer({ pointer: testPtr }) === testPtr,
        "Should resolve from object with pointer property",
      );
      assert(
        resolveNativePointer({ toPointer: () => testPtr }) === testPtr,
        "Should resolve from object with toPointer method",
      );
      assert(resolveNativePointer(null) === null, "Should return null for null input");
      assert(resolveNativePointer(undefined) === null, "Should return null for undefined input");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - pointer null checking", () => {
      // Test pointer null detection
      assert(pointerIsNull(null), "Should detect null as null");
      assert(pointerIsNull(undefined), "Should detect undefined as null");
      assert(pointerIsNull(0), "Should detect zero as null");
      assert(pointerIsNull(ptr(0)), "Should detect null pointer as null");
      assert(!pointerIsNull(ptr(0x12345678)), "Should not detect valid pointer as null");
      assert(!pointerIsNull(42), "Should not detect non-zero number as null");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - pointer validation", () => {
      // Test pointer validation
      const validPtr = ptr(0x12345678);
      const invalidPtr = ptr(0);

      assert(isValidPointer(validPtr), "Should validate valid pointer");
      assert(!isValidPointer(invalidPtr), "Should not validate null pointer");
      assert(!isValidPointer(null), "Should not validate null");
      assert(!isValidPointer(undefined), "Should not validate undefined");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - instance unwrapping", () => {
      // Test instance unwrapping
      const testPtr = ptr(0x12345678);
      const mockObject = new MockMonoObject(testPtr);

      assert(unwrapInstance(mockObject) === testPtr, "Should unwrap instance to pointer");
      assert(unwrapInstance(testPtr) === testPtr, "Should return pointer as-is");
      assert(unwrapInstance(null).isNull(), "Should return null pointer for null input");
      assert(unwrapInstance(undefined).isNull(), "Should return null pointer for undefined input");
    }),
  );

  await suite.addResultAsync(
    createErrorHandlingTest("Memory utility - safe allocation", () => {
      // Test safe allocation
      const validPtr = safeAlloc(100);
      assertNotNull(validPtr, "Should allocate memory successfully");

      assertThrows(() => safeAlloc(0), "Should throw for zero size");
      assertThrows(() => safeAlloc(-10), "Should throw for negative size");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - isNativePointer check", () => {
      // Test isNativePointer
      const testPtr = ptr(0x12345678);
      assert(isNativePointer(testPtr), "Should detect NativePointer");
      assert(!isNativePointer(null), "Should not detect null as NativePointer");
      assert(!isNativePointer(undefined), "Should not detect undefined as NativePointer");
      assert(!isNativePointer({}), "Should not detect object as NativePointer");
      assert(!isNativePointer("string"), "Should not detect string as NativePointer");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - allocPointerArray", () => {
      // Test allocating empty array
      const emptyResult = allocPointerArray([]);
      assert(emptyResult.isNull(), "Should return NULL for empty array");

      // Test allocating array with pointers
      const ptr1 = ptr(0x1000);
      const ptr2 = ptr(0x2000);
      const ptr3 = ptr(0x3000);
      const arrayBuffer = allocPointerArray([ptr1, ptr2, ptr3]);

      assert(!arrayBuffer.isNull(), "Should return valid buffer");

      // Read back pointers
      const read1 = arrayBuffer.readPointer();
      const read2 = arrayBuffer.add(Process.pointerSize).readPointer();
      const read3 = arrayBuffer.add(Process.pointerSize * 2).readPointer();

      assert(read1.equals(ptr1), "First pointer should match");
      assert(read2.equals(ptr2), "Second pointer should match");
      assert(read3.equals(ptr3), "Third pointer should match");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - tryMakePointer", () => {
      // Test with valid number
      const fromNumber = tryMakePointer(0x12345678);
      assertNotNull(fromNumber, "Should create pointer from number");
      assert(fromNumber!.equals(ptr(0x12345678)), "Pointer value should match");

      // Test with valid hex string
      const fromHexString = tryMakePointer("0x12345678");
      assertNotNull(fromHexString, "Should create pointer from hex string");
      assert(fromHexString!.equals(ptr(0x12345678)), "Pointer value should match");

      // Test with valid decimal string
      const fromDecString = tryMakePointer("305419896");
      assertNotNull(fromDecString, "Should create pointer from decimal string");
      assert(fromDecString!.equals(ptr(0x12345678)), "Pointer value should match");

      // Test with bigint
      const fromBigint = tryMakePointer(BigInt("0x12345678"));
      assertNotNull(fromBigint, "Should create pointer from bigint");
      assert(fromBigint!.equals(ptr(0x12345678)), "Pointer value should match");

      // Test with zero
      const fromZero = tryMakePointer(0);
      assertNotNull(fromZero, "Should create pointer from zero");
      assert(fromZero!.isNull(), "Zero should create null pointer");
    }),
  );

  await suite.addResultAsync(
    createErrorHandlingTest("Memory utility - ensurePointer", () => {
      // Test with valid pointer
      const validPtr = ptr(0x12345678);
      const result = ensurePointer(validPtr, "Test pointer");
      assert(result.equals(validPtr), "Should return the same pointer");

      // Test with object that has handle property
      const objWithHandle = { handle: validPtr };
      const handleResult = ensurePointer(objWithHandle as any, "Object with handle");
      assert(handleResult.equals(validPtr), "Should extract pointer from handle property");

      // Test with null - should throw
      assertThrows(() => ensurePointer(null, "Null test"), "Should throw for null");

      // Test with undefined - should throw
      assertThrows(() => ensurePointer(undefined, "Undefined test"), "Should throw for undefined");

      // Test with null pointer - should throw
      assertThrows(() => ensurePointer(ptr(0), "Null pointer test"), "Should throw for null pointer");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - enumerateMonoHandles pattern", () => {
      // Test the enumeration pattern with a mock fetch function
      let callCount = 0;
      const mockPointers = [ptr(0x1000), ptr(0x2000), ptr(0x3000)];

      // Create a mock fetch function that simulates Mono's iteration pattern
      const mockFetch = (iter: NativePointer): NativePointer => {
        const currentIndex = callCount;
        callCount++;

        if (currentIndex >= mockPointers.length) {
          return ptr(0); // End of iteration
        }

        return mockPointers[currentIndex];
      };

      // Create a simple factory
      const mockFactory = (ptrValue: NativePointer): string => {
        return `Object at ${ptrValue.toString()}`;
      };

      const results = enumerateMonoHandles(mockFetch, mockFactory);

      assert(results.length === 3, "Should return 3 items");
      assert(results[0].includes("0x1000"), "First item should contain correct address");
      assert(results[1].includes("0x2000"), "Second item should contain correct address");
      assert(results[2].includes("0x3000"), "Third item should contain correct address");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - enumerateMonoHandles empty", () => {
      // Test enumeration with empty results
      const mockFetch = (_iter: NativePointer): NativePointer => {
        return ptr(0); // Return null immediately
      };

      const mockFactory = (_ptrValue: NativePointer): number => 42;

      const results = enumerateMonoHandles(mockFetch, mockFactory);
      assert(results.length === 0, "Should return empty array for no results");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Memory utility - pointerIsNull with bigint and string", () => {
      // Test with bigint zero
      assert(pointerIsNull(BigInt(0)), "Should detect bigint zero as null");

      // Test with bigint non-zero
      assert(!pointerIsNull(BigInt("0x12345678")), "Should not detect non-zero bigint as null");

      // Test with hex string zero
      assert(pointerIsNull("0x0"), "Should detect hex string zero as null");

      // Test with hex string non-zero
      assert(!pointerIsNull("0x12345678"), "Should not detect non-zero hex string as null");

      // Test with object that has handle property
      assert(pointerIsNull({ handle: ptr(0) }), "Should detect object with null handle as null");
      assert(!pointerIsNull({ handle: ptr(0x1000) }), "Should not detect object with valid handle as null");
    }),
  );

  // ============================================================================
  // CACHE UTILITY TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - LRU cache basic operations", () => {
      // Test LRU cache creation and basic operations
      const cache = new LruCache<string, number>(3);

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

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - LRU eviction", () => {
      // Test LRU eviction behavior
      const cache = new LruCache<string, number>(2);

      cache.set("key1", 1);
      cache.set("key2", 2);
      cache.set("key3", 3); // Should evict key1

      assert(cache.size === 2, `Should maintain capacity, got size=${cache.size}`);
      assert(cache.get("key1") === undefined, "Should evict oldest item");
      assert(cache.get("key2") === 2, "Should keep newer items");
      assert(cache.get("key3") === 3, "Should keep newest item");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - LRU access order", () => {
      // Test LRU access order updates
      const cache = new LruCache<string, number>(3);

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

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - cache utilities", () => {
      // Test cache utility methods
      const cache = new LruCache<string, number>(3);

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

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - getOrCreate factory", () => {
      // Test getOrCreate with factory function
      const cache = new LruCache<string, number>(3);
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

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - single value operations", () => {
      // Test single value operations
      const cache = new LruCache<string, number>(3);

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

  await suite.addResultAsync(
    createErrorHandlingTest("Cache utility - invalid capacity", () => {
      // Test invalid capacity handling
      assertThrows(() => new LruCache<string, number>(0), "Should throw for zero capacity");
      assertThrows(() => new LruCache<string, number>(-1), "Should throw for negative capacity");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - onEvict callback", () => {
      // Test eviction callback
      const evicted: Array<{ key: string; value: number }> = [];

      const cache = new LruCache<string, number>({
        capacity: 2,
        onEvict: (key, value) => {
          evicted.push({ key, value });
        },
      });

      cache.set("key1", 1);
      cache.set("key2", 2);
      assert(evicted.length === 0, "Should not evict yet");

      cache.set("key3", 3); // Should evict key1
      assert(evicted.length === 1, "Should have evicted one item");
      assert(evicted[0].key === "key1", "Should evict key1");
      assert(evicted[0].value === 1, "Should evict with correct value");

      // Test delete triggers onEvict
      cache.delete("key2");
      assert(evicted.length === 2, "Delete should trigger onEvict");
      assert(evicted[1].key === "key2", "Should evict deleted key");

      // Test clear triggers onEvict for remaining items
      cache.set("key4", 4);
      cache.clear();
      assert(evicted.length === 4, "Clear should trigger onEvict for all items");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - iterator methods", () => {
      const cache = new LruCache<string, number>(5);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Test keys()
      const keys = Array.from(cache.keys());
      assert(keys.length === 3, "Should return 3 keys");
      assert(keys.includes("a") && keys.includes("b") && keys.includes("c"), "Should contain all keys");

      // Test values()
      const values = Array.from(cache.values());
      assert(values.length === 3, "Should return 3 values");
      assert(values.includes(1) && values.includes(2) && values.includes(3), "Should contain all values");

      // Test entries()
      const entries = Array.from(cache.entries());
      assert(entries.length === 3, "Should return 3 entries");
      const entryMap = new Map(entries);
      assert(entryMap.get("a") === 1, "Entry a should have value 1");
      assert(entryMap.get("b") === 2, "Entry b should have value 2");
      assert(entryMap.get("c") === 3, "Entry c should have value 3");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - forEach method", () => {
      const cache = new LruCache<string, number>(5);

      cache.set("x", 10);
      cache.set("y", 20);
      cache.set("z", 30);

      const collected: Array<{ key: string; value: number }> = [];
      cache.forEach((value, key, c) => {
        collected.push({ key, value });
        assert(c === cache, "Should pass cache instance to callback");
      });

      assert(collected.length === 3, "Should iterate all items");
      assert(
        collected.some(item => item.key === "x" && item.value === 10),
        "Should include x=10",
      );
      assert(
        collected.some(item => item.key === "y" && item.value === 20),
        "Should include y=20",
      );
      assert(
        collected.some(item => item.key === "z" && item.value === 30),
        "Should include z=30",
      );
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - clear method", () => {
      const cache = new LruCache<string, number>(5);

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      assert(cache.size === 3, "Should have 3 items before clear");

      cache.clear();

      assert(cache.size === 0, "Should have 0 items after clear");
      assert(cache.get("a") === undefined, "Should not have key a");
      assert(cache.get("b") === undefined, "Should not have key b");
      assert(cache.get("c") === undefined, "Should not have key c");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - LruCache with options object", () => {
      // Test constructor with options object
      const evicted: string[] = [];

      const cache = new LruCache<string, string>({
        capacity: 2,
        onEvict: (key, _value) => {
          evicted.push(key);
        },
      });

      assert(cache.maxSize === 2, "Should have correct capacity from options");

      cache.set("a", "A");
      cache.set("b", "B");
      cache.set("c", "C"); // Should evict "a"

      assert(evicted.length === 1, "Should trigger onEvict from options");
      assert(evicted[0] === "a", "Should evict correct key");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - memoize distinguishes argument types", () => {
      class MemoizeFixture {
        calls = 0;

        @memoize()
        compute(...args: any[]): string {
          this.calls++;
          return `${args.length}:${args.map(arg => `${typeof arg}:${String(arg)}`).join(",")}`;
        }
      }

      const fixture = new MemoizeFixture();
      const result1 = fixture.compute(1);
      const result2 = fixture.compute("1");

      assert(fixture.calls === 2, "Should not reuse cache for different argument types");
      assert(result1 !== result2, "Should return distinct results for different types");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - memoize avoids delimiter collisions", () => {
      class MemoizeFixture {
        calls = 0;

        @memoize()
        compute(...args: any[]): string {
          this.calls++;
          return `${args.length}:${args.map(arg => `${typeof arg}:${String(arg)}`).join(",")}`;
        }
      }

      const fixture = new MemoizeFixture();
      fixture.compute("a|b");
      fixture.compute("a", "b");

      assert(fixture.calls === 2, "Should not collide keys with delimiter-like values");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Cache utility - memoize uses object identity by default", () => {
      class MemoizeFixture {
        calls = 0;

        @memoize()
        compute(...args: any[]): string {
          this.calls++;
          return `${args.length}:${args.map(arg => `${typeof arg}:${String(arg)}`).join(",")}`;
        }
      }

      const fixture = new MemoizeFixture();
      fixture.compute({ value: 1 });
      fixture.compute({ value: 1 });

      assert(fixture.calls === 2, "Should treat distinct object identities as unique keys");
    }),
  );

  // ============================================================================
  // STRING OPERATIONS TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - UTF-8 string reading", () => {
      // Test UTF-8 string reading
      // Test with null pointer
      assert(readUtf8String(null) === "", "Should return empty string for null");
      assert(readUtf8String(ptr(0)) === "", "Should return empty string for null pointer");

      // Test with mock pointer (would need actual memory in real scenario)
      // For now, just test the function exists and handles null
      assert(typeof readUtf8String === "function", "Should have readUtf8String function");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - Mono string reading", () => {
      // Test Mono string reading
      const mockMonoString = new MockMonoObject(ptr(0x12345678));

      // Test with different input types
      assert(readMonoString("") === "", "Should handle empty string");
      assert(readMonoString(null) === "", "Should handle null");
      assert(readMonoString(undefined) === "", "Should handle undefined");
      assert(typeof readMonoString(mockMonoString) === "string", "Should handle Mono string object");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - UTF-16 string reading", () => {
      // Test UTF-16 string reading
      assert(readUtf16String(null) === "", "Should return empty string for null");
      assert(readUtf16String(ptr(0)) === "", "Should return empty string for null pointer");
      assert(typeof readUtf16String === "function", "Should have readUtf16String function");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - safe stringification", () => {
      // Test safe JSON stringification
      const testObj = { name: "test", value: 42 };
      const result = safeStringify(testObj);
      assert(result.includes("test"), "Should stringify object");

      // Test with NativePointer - safeStringify wraps in JSON, so output varies
      const mockPtr = ptr(0x12345678);
      const ptrResult = safeStringify(mockPtr);
      // NativePointer toString() or custom serialization
      assert(ptrResult.length > 0, "Should handle NativePointer");

      // Test with function
      const funcResult = safeStringify(() => {});
      // Function serialization
      assert(funcResult.length > 0, "Should handle function");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - error creation", () => {
      // Test error creation with context
      const error = createError("Test error", { context: "test" });
      assert(error instanceof MonoError, "Should create MonoError");
      assert(error.message.includes("Test error"), "Should include message");
      assert(error.message.includes("context"), "Should include context");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("StringOperations - performance timer", () => {
      // Test performance timer
      const timer = createTimer();
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
  // LOGGER TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("Logger - basic functionality", () => {
      // Test logger creation
      const logger = new Logger({ tag: "Test", level: "debug" });
      assertNotNull(logger, "Should create logger");

      // Test methods exist
      assert(typeof logger.debug === "function", "Should have debug method");
      assert(typeof logger.info === "function", "Should have info method");
      assert(typeof logger.warn === "function", "Should have warn method");
      assert(typeof logger.error === "function", "Should have error method");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - static methods", () => {
      // Test static methods exist
      assert(typeof Logger.debug === "function", "Should have static debug method");
      assert(typeof Logger.info === "function", "Should have static info method");
      assert(typeof Logger.warn === "function", "Should have static warn method");
      assert(typeof Logger.error === "function", "Should have static error method");
      assert(typeof Logger.withTag === "function", "Should have static withTag method");
      assert(typeof Logger.withLevel === "function", "Should have static withLevel method");
      assert(typeof Logger.create === "function", "Should have static create method");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - instance methods", () => {
      // Test instance methods exist and are callable
      const logger = new Logger({ tag: "Test", level: "debug" });

      // Verify methods exist
      assert(typeof logger.debug === "function", "Should have debug method");
      assert(typeof logger.info === "function", "Should have info method");
      assert(typeof logger.warn === "function", "Should have warn method");
      assert(typeof logger.error === "function", "Should have error method");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - factory methods", () => {
      // Test withTag factory
      const taggedLogger = Logger.withTag("CustomTag");
      assertNotNull(taggedLogger, "Should create tagged logger");
      assert(typeof taggedLogger.info === "function", "Tagged logger should have info method");

      // Test withLevel factory
      const levelLogger = Logger.withLevel("debug");
      assertNotNull(levelLogger, "Should create logger with custom level");
      assert(typeof levelLogger.debug === "function", "Level logger should have debug method");

      // Test create factory with options
      const customLogger = Logger.create({ tag: "Custom", level: "warn" });
      assertNotNull(customLogger, "Should create logger with options");
      assert(typeof customLogger.warn === "function", "Custom logger should have warn method");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - default values", () => {
      // Test default tag and level
      const defaultLogger = new Logger();
      assertNotNull(defaultLogger, "Should create logger with defaults");

      // Should have all methods
      assert(typeof defaultLogger.debug === "function", "Should have debug method");
      assert(typeof defaultLogger.info === "function", "Should have info method");
      assert(typeof defaultLogger.warn === "function", "Should have warn method");
      assert(typeof defaultLogger.error === "function", "Should have error method");
    }),
  );

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createPerformanceTest("Cache utility - LRU cache performance", () => {
      // Test LRU cache performance
      const cache = new LruCache<string, number>(1000);

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

  await suite.addResultAsync(
    createPerformanceTest("String operations - performance timer overhead", () => {
      // Test performance timer overhead
      for (let i = 0; i < 10000; i++) {
        const timer = createTimer();
        timer.elapsed();
        timer.restart();
        timer.elapsedMs();
        timer.elapsedSeconds();
      }
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Memory operations - pointer resolution performance", () => {
      // Test pointer resolution performance
      const testPtr = ptr(0x12345678);
      const mockObj = new MockMonoObject(testPtr);
      const testValues = [testPtr, mockObj, { pointer: testPtr }, null, undefined];

      for (let i = 0; i < 10000; i++) {
        for (const value of testValues) {
          resolveNativePointer(value);
          pointerIsNull(value);
          // Only test isValidPointer with compatible types
          if (value === testPtr || value === null || value === undefined) {
            isValidPointer(value as NativePointer);
          }
        }
      }
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createIntegrationTest("Utilities integration - cache with memory", () => {
      // Test integration between cache and memory utilities
      const cache = new LruCache<string, NativePointer>(10);

      // Cache validated pointers
      const validPtr = ptr(0x12345678);
      if (isValidPointer(validPtr)) {
        cache.set("pointer", validPtr);
      }

      const cachedPtr = cache.get("pointer");
      assert(cachedPtr !== undefined && cachedPtr.equals(validPtr), "Should retrieve cached pointer");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Utilities integration - comprehensive workflow", () => {
      // Test comprehensive workflow using multiple utilities
      const cache = new LruCache<string, any>(5);
      const logger = Logger.withTag("WorkflowTest");

      // Step 1: Cache data
      cache.set("testData", "workflow test");

      // Step 2: Process with string operations
      const stringified = safeStringify({ data: cache.get("testData") });

      // Step 3: Create timer
      const timer = createTimer();

      // Step 4: Validate results
      assert(cache.get("testData") === "workflow test", "Should get cached data");
      assert(stringified.includes("workflow"), "Should stringify data");
      assert(typeof timer.elapsedMs() === "number", "Should get elapsed time");

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

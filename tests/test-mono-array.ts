/**
 * MonoArray Complete Tests
 *
 * Tests MonoArray API:
 * - length
 * - getElementClass()
 * - getElementSize()
 * - getElementAddress(index)
 * - getNumber() / setNumber()
 * - getTyped() / setTyped()
 * - LINQ-like methods: where, select, first, last, any, all, count, etc.
 * - Iteration support
 * - Static factory methods
 * - Validation
 * - Edge cases
 */

import Mono, { MonoArray } from "../src";
import { withCoreClasses, withDomain, withNumericTypes } from "./test-fixtures";
import { TestResult, assert, assertNotNull, assertThrows } from "./test-framework";

export async function createMonoArrayTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // =====================================================
  // SECTION 1: Basic Property Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - create array with Mono.array.new()", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 10);
      assertNotNull(arr, "Created array should not be null");
      assert(!arr.pointer.isNull(), "Array pointer should not be null");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - length property", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 10);
      assert(arr.length === 10, `Array length should be 10, got ${arr.length}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - length property (non-trivial size)", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 15);
      assert(arr.length === 15, `length should be 15, got ${arr.length}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - length is stable across reads", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 20);
      const first = arr.length;
      const second = arr.length;
      assert(first === 20, `length should be 20, got ${first}`);
      assert(second === 20, `length should remain 20, got ${second}`);
    }),
  );

  // =====================================================
  // SECTION 2: Element Class Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - elementClass property for Int32 array", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 5);
      const elementClass = arr.elementClass;

      assertNotNull(elementClass, "Element class should not be null");
      const className = elementClass.name;
      assert(className === "Int32", `Element class should be Int32, got ${className}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - elementClass property for String array", ({ stringClass }) => {
      const arr = Mono.array.new(stringClass, 5);
      const elementClass = arr.elementClass;

      assertNotNull(elementClass, "Element class should not be null");
      const className = elementClass.name;
      assert(className === "String", `Element class should be String, got ${className}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - elementClass property for Object array", ({ objectClass }) => {
      const arr = Mono.array.new(objectClass, 5);
      const elementClass = arr.elementClass;

      assertNotNull(elementClass, "Element class should not be null");
      const className = elementClass.name;
      assert(className === "Object", `Element class should be Object, got ${className}`);
    }),
  );

  // =====================================================
  // SECTION 3: Element Size Tests
  // =====================================================
  results.push(
    await withNumericTypes("MonoArray - elementSize property for byte array", ({ byteClass }) => {
      const arr = Mono.array.new(byteClass, 5);
      const size = arr.elementSize;

      assert(size === 1, `Byte element size should be 1, got ${size}`);
    }),
  );

  results.push(
    await withNumericTypes("MonoArray - elementSize property for Int16 array", ({ int16Class }) => {
      if (!int16Class) {
        console.log("[SKIP] Int16 class not available");
        return;
      }

      const arr = Mono.array.new(int16Class, 5);
      const size = arr.elementSize;

      assert(size === 2, `Int16 element size should be 2, got ${size}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - elementSize property for Int32 array", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 5);
      const size = arr.elementSize;

      assert(size === 4, `Int32 element size should be 4, got ${size}`);
    }),
  );

  results.push(
    await withNumericTypes("MonoArray - elementSize property for Int64 array", ({ int64Class }) => {
      if (!int64Class) {
        console.log("[SKIP] Int64 class not available");
        return;
      }

      const arr = Mono.array.new(int64Class, 5);
      const size = arr.elementSize;

      assert(size === 8, `Int64 element size should be 8, got ${size}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - elementSize property for reference type (pointer size)", ({ stringClass }) => {
      const arr = Mono.array.new(stringClass, 5);
      const size = arr.elementSize;

      assert(size === Process.pointerSize, `String element size should be ${Process.pointerSize}, got ${size}`);
    }),
  );

  // =====================================================
  // SECTION 4: Numeric Array Read/Write Tests
  // =====================================================
  results.push(
    await withNumericTypes("MonoArray - setNumber() and getNumber() for byte array", ({ byteClass }) => {
      const arr = Mono.array.new<number>(byteClass, 5);

      arr.setNumber(0, 0);
      arr.setNumber(1, 127);
      arr.setNumber(2, 255);

      assert(arr.getNumber(0) === 0, "getNumber(0) should return 0");
      assert(arr.getNumber(1) === 127, "getNumber(1) should return 127");
      assert(arr.getNumber(2) === 255, "getNumber(2) should return 255");
    }),
  );

  results.push(
    await withNumericTypes("MonoArray - setNumber() and getNumber() for Int16 array", ({ int16Class }) => {
      if (!int16Class) {
        console.log("[SKIP] Int16 class not available");
        return;
      }

      const arr = Mono.array.new<number>(int16Class, 5);

      arr.setNumber(0, 0);
      arr.setNumber(1, 32767);
      arr.setNumber(2, 12345);

      assert(arr.getNumber(0) === 0, "getNumber(0) should return 0");
      assert(arr.getNumber(1) === 32767, "getNumber(1) should return 32767");
      assert(arr.getNumber(2) === 12345, "getNumber(2) should return 12345");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - setNumber() and getNumber() for Int32 array", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);

      arr.setNumber(0, 0);
      arr.setNumber(1, 2147483647);
      arr.setNumber(2, 123456789);

      assert(arr.getNumber(0) === 0, "getNumber(0) should return 0");
      assert(arr.getNumber(1) === 2147483647, "getNumber(1) should return 2147483647");
      assert(arr.getNumber(2) === 123456789, "getNumber(2) should return 123456789");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - setNumber() and getNumber() sequence", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 10);

      // Write sequence
      for (let i = 0; i < 10; i++) {
        arr.setNumber(i, i * 10);
      }

      // Read and verify
      for (let i = 0; i < 10; i++) {
        const value = arr.getNumber(i);
        assert(value === i * 10, `getNumber(${i}) should return ${i * 10}, got ${value}`);
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - overwrite number values", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);

      // Initial write
      arr.setNumber(0, 100);
      assert(arr.getNumber(0) === 100, "Initial value should be 100");

      // Overwrite
      arr.setNumber(0, 200);
      assert(arr.getNumber(0) === 200, "Overwritten value should be 200");
    }),
  );

  results.push(
    await withNumericTypes("MonoArray - setNumber() rejects out-of-range values", ({ byteClass, int16Class, uint16Class, uint32Class }) => {
      const byteArr = Mono.array.new<number>(byteClass, 1);
      assertThrows(() => byteArr.setNumber(0, 256), "Byte array should reject values > 255");
      assertThrows(() => byteArr.setNumber(0, -1), "Byte array should reject negative values");
      assertThrows(() => byteArr.setNumber(0, 1.5), "Byte array should reject non-integer values");

      if (int16Class) {
        const int16Arr = Mono.array.new<number>(int16Class, 1);
        assertThrows(() => int16Arr.setNumber(0, 40000), "Int16 array should reject out-of-range values");
      }

      if (uint16Class) {
        const uint16Arr = Mono.array.new<number>(uint16Class, 1);
        assertThrows(() => uint16Arr.setNumber(0, -1), "UInt16 array should reject negative values");
      }

      if (uint32Class) {
        const uint32Arr = Mono.array.new<number>(uint32Class, 1);
        assertThrows(() => uint32Arr.setNumber(0, -1), "UInt32 array should reject negative values");
      }
    }),
  );

  results.push(
    await withNumericTypes("MonoArray - getNumber() rejects unsafe Int64/UInt64 values", ({ int64Class, uint64Class }) => {
      const unsafeValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

      if (int64Class) {
        const int64Arr = Mono.array.new<number>(int64Class, 1);
        int64Arr.setBigInt(0, unsafeValue);
        assertThrows(() => int64Arr.getNumber(0), "Int64 getNumber should reject unsafe values");
      }

      if (uint64Class) {
        const uint64Arr = Mono.array.new<number>(uint64Class, 1);
        uint64Arr.setBigInt(0, unsafeValue);
        assertThrows(() => uint64Arr.getNumber(0), "UInt64 getNumber should reject unsafe values");
      }
    }),
  );

  results.push(
    await withNumericTypes(
      "MonoArray - setBigInt() rejects out-of-range values",
      ({ byteClass, sbyteClass, int16Class, uint16Class, int64Class, uint64Class }) => {
        const byteArr = Mono.array.new<number>(byteClass, 1);
        assertThrows(() => byteArr.setBigInt(0, 256n), "Byte array should reject values > 255");
        assertThrows(() => byteArr.setBigInt(0, -1n), "Byte array should reject negative values");

        if (sbyteClass) {
          const sbyteArr = Mono.array.new<number>(sbyteClass, 1);
          assertThrows(() => sbyteArr.setBigInt(0, 128n), "SByte array should reject values > 127");
          assertThrows(() => sbyteArr.setBigInt(0, -129n), "SByte array should reject values < -128");
        }

        if (int16Class) {
          const int16Arr = Mono.array.new<number>(int16Class, 1);
          assertThrows(() => int16Arr.setBigInt(0, 32768n), "Int16 array should reject values > 32767");
          assertThrows(() => int16Arr.setBigInt(0, -32769n), "Int16 array should reject values < -32768");
        }

        if (uint16Class) {
          const uint16Arr = Mono.array.new<number>(uint16Class, 1);
          assertThrows(() => uint16Arr.setBigInt(0, -1n), "UInt16 array should reject negative values");
          assertThrows(() => uint16Arr.setBigInt(0, 65536n), "UInt16 array should reject values > 65535");
        }

        if (int64Class) {
          const int64Arr = Mono.array.new<number>(int64Class, 1);
          const int64Max = (1n << 63n) - 1n;
          const int64Min = -(1n << 63n);
          assertThrows(() => int64Arr.setBigInt(0, int64Max + 1n), "Int64 array should reject values > max");
          assertThrows(() => int64Arr.setBigInt(0, int64Min - 1n), "Int64 array should reject values < min");
        }

        if (uint64Class) {
          const uint64Arr = Mono.array.new<number>(uint64Class, 1);
          const uint64Max = (1n << 64n) - 1n;
          assertThrows(() => uint64Arr.setBigInt(0, uint64Max + 1n), "UInt64 array should reject values > max");
          assertThrows(() => uint64Arr.setBigInt(0, -1n), "UInt64 array should reject negative values");
        }
      },
    ),
  );

  results.push(
    await withDomain("MonoArray - createNumericArray supports primitive aliases", () => {
      const intArray = MonoArray.createNumericArray(Mono.api, "int32", 3);
      assert(intArray.elementClass.name === "Int32", `Expected Int32, got ${intArray.elementClass.name}`);
      assert(intArray.length === 3, "int32 array length should be 3");

      const byteArray = MonoArray.createNumericArray(Mono.api, "uint8", 2);
      assert(byteArray.elementClass.name === "Byte", `Expected Byte, got ${byteArray.elementClass.name}`);

      const floatArray = MonoArray.createNumericArray(Mono.api, "float32", 1);
      assert(floatArray.elementClass.name === "Single", `Expected Single, got ${floatArray.elementClass.name}`);
    }),
  );

  // =====================================================
  // SECTION 5: getTyped() / setTyped() Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - getTyped() for numeric array", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      arr.setNumber(2, 42);

      const value = arr.getTyped(2);
      assert(value === 42, `getTyped(2) should return 42, got ${value}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - setTyped() for numeric array", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      arr.setTyped(3, 99);

      const value = arr.getNumber(3);
      assert(value === 99, `setTyped should set value to 99, got ${value}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - setTyped() accepts boolean values", ({ booleanClass }) => {
      const arr = Mono.array.new<boolean>(booleanClass, 2);
      arr.setTyped(0, true);
      arr.setTyped(1, false);

      assert(arr.getTyped(0) === true, "Boolean array should return true");
      assert(arr.getTyped(1) === false, "Boolean array should return false");
      assert(arr.getNumber(0) === 1, "Boolean array should store true as 1");
      assert(arr.getNumber(1) === 0, "Boolean array should store false as 0");
    }),
  );

  results.push(
    await withDomain("MonoArray - getTyped() returns string for Char arrays", ({ domain }) => {
      const charClass = domain.tryClass("System.Char");
      if (!charClass) {
        console.log("  [SKIP] System.Char class not available");
        return;
      }

      const arr = Mono.array.new<string>(charClass, 2);
      arr.setTyped(0, "A");
      arr.setTyped(1, "Z");

      assert(arr.getTyped(0) === "A", "Char array should return 'A'");
      assert(arr.getTyped(1) === "Z", "Char array should return 'Z'");
    }),
  );

  results.push(
    await withDomain("MonoArray - getTyped() returns pointer for struct arrays", ({ domain }) => {
      const dateTimeClass = domain.tryClass("System.DateTime");
      if (!dateTimeClass) {
        console.log("  [SKIP] System.DateTime class not available");
        return;
      }

      const arr = Mono.array.new<NativePointer>(dateTimeClass, 1);
      const value = arr.getTyped(0);

      assertNotNull(value, "Struct array element should return a pointer");
      assert(
        value instanceof NativePointer || typeof value === "object",
        `Struct array element should be NativePointer, got: ${typeof value}`,
      );
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - getTyped() bounds check (out of range)", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);

      let threw = false;
      try {
        arr.getTyped(10); // Out of bounds
      } catch (e) {
        threw = true;
      }

      assert(threw, "getTyped() should throw for out of bounds index");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - setTyped() bounds check (negative index)", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);

      let threw = false;
      try {
        arr.setTyped(-1, 100); // Negative index
      } catch (e) {
        threw = true;
      }

      assert(threw, "setTyped() should throw for negative index");
    }),
  );

  // =====================================================
  // SECTION 6: elementAt() Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - elementAt() basic usage", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);

      assert(arr.elementAt(0) === 10, "elementAt(0) should return 10");
      assert(arr.elementAt(1) === 20, "elementAt(1) should return 20");
      assert(arr.elementAt(2) === 30, "elementAt(2) should return 30");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - elementAt() throws for out of bounds", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);

      let threw = false;
      try {
        arr.elementAt(5);
      } catch (e) {
        threw = true;
      }

      assert(threw, "elementAt() should throw for out of bounds");
    }),
  );

  // =====================================================
  // SECTION 7: LINQ-like Methods Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - where() filter", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const result = arr.where(item => item > 20);
      assert(result.length === 2, `where(>20) should return 2 items, got ${result.length}`);
      assert(result[0] === 30, "First filtered item should be 30");
      assert(result[1] === 40, "Second filtered item should be 40");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - select() transform", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const result = arr.select(item => item * 2);
      assert(result.length === 3, "select should return same count");
      assert(result[0] === 2, "select(0) should be 2");
      assert(result[1] === 4, "select(1) should be 4");
      assert(result[2] === 6, "select(2) should be 6");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - first() without predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);

      const result = arr.first();
      assert(result === 100, `first() should return 100, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - first() with predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const result = arr.first(item => item > 25);
      assert(result === 30, `first(>25) should return 30, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - first() returns null when not found", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const result = arr.first(item => item > 100);
      assert(result === null, "first() should return null when predicate matches nothing");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - last() without predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);

      const result = arr.last();
      assert(result === 300, `last() should return 300, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - last() with predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const result = arr.last(item => item < 35);
      assert(result === 30, `last(<35) should return 30, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - any() without predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);

      assert(arr.any() === true, "any() should return true for non-empty array");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - any() returns false for empty array", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 0);
      assert(arr.any() === false, "any() should return false for empty array");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - any() with predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      assert(arr.any(item => item > 2) === true, "any(>2) should return true");
      assert(arr.any(item => item > 10) === false, "any(>10) should return false");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - all() predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);

      assert(arr.all(item => item > 0) === true, "all(>0) should return true");
      assert(arr.all(item => item > 15) === false, "all(>15) should return false");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - count() without predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      assert(arr.count() === 5, `count() should return 5, got ${arr.count()}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - count() with predicate", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i);
      }

      const result = arr.count(item => item > 2);
      assert(result === 2, `count(>2) should return 2, got ${result}`);
    }),
  );

  // =====================================================
  // SECTION 8: More LINQ-like Methods
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - aggregate() / reduce()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 4);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      arr.setNumber(3, 4);

      const sum = arr.aggregate((acc, item) => acc + item, 0);
      assert(sum === 10, `aggregate sum should be 10, got ${sum}`);

      const product = arr.reduce((acc, item) => acc * item, 1);
      assert(product === 24, `reduce product should be 24, got ${product}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - toArray()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);

      const jsArray = arr.toArray();
      assert(Array.isArray(jsArray), "toArray() should return JS array");
      assert(jsArray.length === 3, "JS array should have 3 elements");
      assert(jsArray[0] === 10, "First element should be 10");
      assert(jsArray[1] === 20, "Second element should be 20");
      assert(jsArray[2] === 30, "Third element should be 30");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - forEach()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const collected: number[] = [];
      arr.forEach(item => collected.push(item));

      assert(collected.length === 3, "forEach should iterate all elements");
      assert(collected[0] === 1, "First collected should be 1");
      assert(collected[1] === 2, "Second collected should be 2");
      assert(collected[2] === 3, "Third collected should be 3");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - map() (alias for select)", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const result = arr.map(item => item * 10);
      assert(result[0] === 10, "map result[0] should be 10");
      assert(result[1] === 20, "map result[1] should be 20");
      assert(result[2] === 30, "map result[2] should be 30");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - filter() (alias for where)", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i);
      }

      const result = arr.filter(item => item % 2 === 0);
      assert(result.length === 3, "filter for even should return 3 items");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - find() (alias for first with predicate)", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const result = arr.find(item => item > 25);
      assert(result === 30, `find(>25) should return 30, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - findIndex()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const index = arr.findIndex(item => item === 30);
      assert(index === 3, `findIndex(30) should return 3, got ${index}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - findIndex() returns -1 when not found", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const index = arr.findIndex(item => item > 100);
      assert(index === -1, `findIndex for missing item should return -1, got ${index}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - includes()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);

      assert(arr.includes(20) === true, "should include 20");
      assert(arr.includes(50) === false, "should not include 50");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - slice()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }

      const sliced = arr.slice(1, 4);
      assert(sliced.length === 3, `slice(1,4) should have 3 elements, got ${sliced.length}`);
      assert(sliced[0] === 10, "slice[0] should be 10");
      assert(sliced[1] === 20, "slice[1] should be 20");
      assert(sliced[2] === 30, "slice[2] should be 30");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - distinct()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 6);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 1);
      arr.setNumber(3, 3);
      arr.setNumber(4, 2);
      arr.setNumber(5, 1);

      const result = arr.distinct();
      assert(result.length === 3, `distinct should return 3 unique items, got ${result.length}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - orderBy()", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 4);
      arr.setNumber(0, 30);
      arr.setNumber(1, 10);
      arr.setNumber(2, 40);
      arr.setNumber(3, 20);

      const ordered = arr.orderBy(item => item);
      assert(ordered[0] === 10, "orderBy first should be 10");
      assert(ordered[1] === 20, "orderBy second should be 20");
      assert(ordered[2] === 30, "orderBy third should be 30");
      assert(ordered[3] === 40, "orderBy fourth should be 40");
    }),
  );

  // =====================================================
  // SECTION 9: Iterator Support
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - Symbol.iterator support", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);

      const collected: number[] = [];
      for (const item of arr) {
        collected.push(item);
      }

      assert(collected.length === 3, "for...of should iterate all elements");
      assert(collected[0] === 100, "First iterated should be 100");
      assert(collected[1] === 200, "Second iterated should be 200");
      assert(collected[2] === 300, "Third iterated should be 300");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - spread operator with iterator", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);

      const spread = [...arr];
      assert(spread.length === 3, "Spread should create array with 3 elements");
      assert(spread[0] === 1, "Spread[0] should be 1");
    }),
  );

  // =====================================================
  // SECTION 10: Utility Methods
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - describe()", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 10);
      const description = arr.describe();

      assert(typeof description === "string", "describe() should return string");
      assert(description.includes("Int32"), "Description should include element type");
      assert(description.includes("10"), "Description should include length");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - validateArray()", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 5);
      const validation = arr.validateArray();

      assert(validation.isValid === true, "Valid array should pass validation");
      assert(validation.errors.length === 0, "Valid array should have no errors");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - toString()", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 5);
      const str = arr.toString();

      assert(typeof str === "string", "toString() should return string");
      // toString() returns format like "System.Int32[5]"
      assert(str.includes("Int32"), "toString() should include element type");
      assert(str.includes("[5]"), "toString() should include array length");
    }),
  );

  // =====================================================
  // SECTION 11: Empty Array Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - empty array properties", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 0);

      assert(arr.length === 0, "Empty array length should be 0");
      assert(arr.elementSize === 4, `Empty array element size should still be 4, got ${arr.elementSize}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - empty array LINQ operations", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 0);

      assert(arr.any() === false, "any() on empty should return false");
      assert(arr.first() === null, "first() on empty should return null");
      assert(arr.last() === null, "last() on empty should return null");
      assert(arr.count() === 0, "count() on empty should return 0");
      assert(arr.toArray().length === 0, "toArray() on empty should return empty array");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - empty array iteration", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 0);

      let iterationCount = 0;
      for (const _item of arr) {
        iterationCount++;
      }

      assert(iterationCount === 0, "Empty array should not iterate");
    }),
  );

  // =====================================================
  // SECTION 12: Different Element Type Arrays
  // =====================================================
  results.push(
    await withDomain("MonoArray - UInt32 array", ({ domain }) => {
      const uintClass = domain.tryClass("System.UInt32");
      assertNotNull(uintClass, "UInt32 class should exist");

      const arr = Mono.array.new<number>(uintClass, 3);
      arr.setNumber(0, 0);
      arr.setNumber(1, 2147483647);
      arr.setNumber(2, 4294967295);

      assert(arr.getNumber(0) === 0, "UInt32[0] should be 0");
      assert(arr.getNumber(1) === 2147483647, "UInt32[1] should be 2147483647");
      assert(arr.getNumber(2) === 4294967295, "UInt32[2] should be 4294967295");
    }),
  );

  results.push(
    await withDomain("MonoArray - Boolean array", ({ domain }) => {
      const boolClass = domain.tryClass("System.Boolean");
      assertNotNull(boolClass, "Boolean class should exist");

      const arr = Mono.array.new<number>(boolClass, 3);
      arr.setNumber(0, false);
      arr.setNumber(1, true);
      arr.setNumber(2, false);

      assert(arr.getNumber(0) === 0, "Boolean[0] should be 0 (false)");
      assert(arr.getNumber(1) === 1, "Boolean[1] should be 1 (true)");
      assert(arr.getNumber(2) === 0, "Boolean[2] should be 0 (false)");
    }),
  );

  results.push(
    await withDomain("MonoArray - Char array", ({ domain }) => {
      const charClass = domain.tryClass("System.Char");
      assertNotNull(charClass, "Char class should exist");

      const arr = Mono.array.new<number>(charClass, 3);
      arr.setNumber(0, 65); // 'A'
      arr.setNumber(1, 66); // 'B'
      arr.setNumber(2, 67); // 'C'

      assert(arr.getNumber(0) === 65, "Char[0] should be 65 (A)");
      assert(arr.getNumber(1) === 66, "Char[1] should be 66 (B)");
      assert(arr.getNumber(2) === 67, "Char[2] should be 67 (C)");
      assert(arr.elementSize === 2, "Char element size should be 2");
    }),
  );

  // =====================================================
  // SECTION 13: Large Array Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - large array creation", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 1000);
      assert(arr.length === 1000, `Large array length should be 1000, got ${arr.length}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - large array read/write", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 100);

      // Write all elements
      for (let i = 0; i < 100; i++) {
        arr.setNumber(i, i * i);
      }

      // Verify
      for (let i = 0; i < 100; i++) {
        const expected = i * i;
        const actual = arr.getNumber(i);
        assert(actual === expected, `arr[${i}] should be ${expected}, got ${actual}`);
      }
    }),
  );

  // =====================================================
  // SECTION 14: getElementAddress() Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - getElementAddress() returns valid pointers", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 5);

      for (let i = 0; i < 5; i++) {
        const addr = arr.getElementAddress(i);
        assert(!addr.isNull(), `Element address ${i} should not be null`);
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - getElementAddress() sequential addresses", ({ int32Class }) => {
      const arr = Mono.array.new(int32Class, 3);
      const elementSize = arr.elementSize;

      const addr0 = arr.getElementAddress(0);
      const addr1 = arr.getElementAddress(1);
      const addr2 = arr.getElementAddress(2);

      // Addresses should be sequential with element size spacing
      const diff1 = addr1.sub(addr0).toInt32();
      const diff2 = addr2.sub(addr1).toInt32();

      assert(diff1 === elementSize, `Address gap 0->1 should be ${elementSize}, got ${diff1}`);
      assert(diff2 === elementSize, `Address gap 1->2 should be ${elementSize}, got ${diff2}`);
    }),
  );

  // =====================================================
  // SECTION 15: Integration Tests
  // =====================================================
  results.push(
    await withCoreClasses("MonoArray - chained operations", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 10);
      for (let i = 0; i < 10; i++) {
        arr.setNumber(i, i);
      }

      // Chain: filter -> map -> reduce
      const result = arr
        .filter(x => x > 3) // [4, 5, 6, 7, 8, 9]
        .map(x => x * 2) // [8, 10, 12, 14, 16, 18]
        .reduce((acc, x) => acc + x, 0); // 78

      assert(result === 78, `Chained result should be 78, got ${result}`);
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - multiple arrays independent", ({ int32Class }) => {
      const arr1 = Mono.array.new<number>(int32Class, 3);
      const arr2 = Mono.array.new<number>(int32Class, 3);

      arr1.setNumber(0, 100);
      arr2.setNumber(0, 200);

      // Arrays should be independent
      assert(arr1.getNumber(0) === 100, "arr1[0] should be 100");
      assert(arr2.getNumber(0) === 200, "arr2[0] should be 200");

      // Modifying one shouldn't affect the other
      arr1.setNumber(0, 150);
      assert(arr2.getNumber(0) === 200, "arr2[0] should still be 200");
    }),
  );

  results.push(
    await withCoreClasses("MonoArray - pointer validity after operations", ({ int32Class }) => {
      const arr = Mono.array.new<number>(int32Class, 5);

      // Perform various operations
      arr.setNumber(0, 42);
      arr.getNumber(0);
      arr.toArray();
      arr.where(x => x > 0);
      arr.describe();

      // Pointer should still be valid
      assert(!arr.pointer.isNull(), "Array pointer should remain valid");
      assert(arr.length === 5, "Array length should remain 5");
    }),
  );

  return results;
}

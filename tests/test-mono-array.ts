/**
 * MonoArray Complete Tests
 * 
 * Tests MonoArray API:
 * - length / getLength()
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

import Mono from "../src";
import { MonoArray } from '../src';
import { 
  TestResult, 
  createMonoDependentTest, 
  assert, 
  assertNotNull,
} from './test-framework';

export function createMonoArrayTests(): TestResult[] {
  const results: TestResult[] = [];

  // =====================================================
  // SECTION 1: Basic Property Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - create array with MonoArray.new()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 10);
      assertNotNull(arr, 'Created array should not be null');
      assert(!arr.pointer.isNull(), 'Array pointer should not be null');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - length property',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 10);
      assert(arr.length === 10, `Array length should be 10, got ${arr.length}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getLength() method',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 15);
      assert(arr.getLength() === 15, `getLength() should return 15, got ${arr.getLength()}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - length equals getLength()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 20);
      assert(arr.length === arr.getLength(), 
        `length (${arr.length}) should equal getLength() (${arr.getLength()})`);
    }
  ));

  // =====================================================
  // SECTION 2: Element Class Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - getElementClass() for Int32 array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 5);
      const elementClass = arr.getElementClass();
      
      assertNotNull(elementClass, 'Element class should not be null');
      const className = elementClass.getName();
      assert(className === 'Int32', `Element class should be Int32, got ${className}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementClass() for String array',
    () => {
      const stringClass = Mono.domain.class('System.String');
      assertNotNull(stringClass, 'String class should exist');
      
      const arr = MonoArray.new(Mono.api, stringClass, 5);
      const elementClass = arr.getElementClass();
      
      assertNotNull(elementClass, 'Element class should not be null');
      const className = elementClass.getName();
      assert(className === 'String', `Element class should be String, got ${className}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementClass() for Object array',
    () => {
      const objectClass = Mono.domain.class('System.Object');
      assertNotNull(objectClass, 'Object class should exist');
      
      const arr = MonoArray.new(Mono.api, objectClass, 5);
      const elementClass = arr.getElementClass();
      
      assertNotNull(elementClass, 'Element class should not be null');
      const className = elementClass.getName();
      assert(className === 'Object', `Element class should be Object, got ${className}`);
    }
  ));

  // =====================================================
  // SECTION 3: Element Size Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - getElementSize() for byte array',
    () => {
      const byteClass = Mono.domain.class('System.Byte');
      assertNotNull(byteClass, 'Byte class should exist');
      
      const arr = MonoArray.new(Mono.api, byteClass, 5);
      const size = arr.getElementSize();
      
      assert(size === 1, `Byte element size should be 1, got ${size}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementSize() for Int16 array',
    () => {
      const shortClass = Mono.domain.class('System.Int16');
      assertNotNull(shortClass, 'Int16 class should exist');
      
      const arr = MonoArray.new(Mono.api, shortClass, 5);
      const size = arr.getElementSize();
      
      assert(size === 2, `Int16 element size should be 2, got ${size}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementSize() for Int32 array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 5);
      const size = arr.getElementSize();
      
      assert(size === 4, `Int32 element size should be 4, got ${size}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementSize() for Int64 array',
    () => {
      const longClass = Mono.domain.class('System.Int64');
      assertNotNull(longClass, 'Int64 class should exist');
      
      const arr = MonoArray.new(Mono.api, longClass, 5);
      const size = arr.getElementSize();
      
      assert(size === 8, `Int64 element size should be 8, got ${size}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementSize() for reference type (pointer size)',
    () => {
      const stringClass = Mono.domain.class('System.String');
      assertNotNull(stringClass, 'String class should exist');
      
      const arr = MonoArray.new(Mono.api, stringClass, 5);
      const size = arr.getElementSize();
      
      assert(size === Process.pointerSize, 
        `String element size should be ${Process.pointerSize}, got ${size}`);
    }
  ));

  // =====================================================
  // SECTION 4: Numeric Array Read/Write Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - setNumber() and getNumber() for byte array',
    () => {
      const byteClass = Mono.domain.class('System.Byte');
      assertNotNull(byteClass, 'Byte class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, byteClass, 5);
      
      arr.setNumber(0, 0);
      arr.setNumber(1, 127);
      arr.setNumber(2, 255);
      
      assert(arr.getNumber(0) === 0, 'getNumber(0) should return 0');
      assert(arr.getNumber(1) === 127, 'getNumber(1) should return 127');
      assert(arr.getNumber(2) === 255, 'getNumber(2) should return 255');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - setNumber() and getNumber() for Int16 array',
    () => {
      const shortClass = Mono.domain.class('System.Int16');
      assertNotNull(shortClass, 'Int16 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, shortClass, 5);
      
      arr.setNumber(0, 0);
      arr.setNumber(1, 32767);
      arr.setNumber(2, 12345);
      
      assert(arr.getNumber(0) === 0, 'getNumber(0) should return 0');
      assert(arr.getNumber(1) === 32767, 'getNumber(1) should return 32767');
      assert(arr.getNumber(2) === 12345, 'getNumber(2) should return 12345');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - setNumber() and getNumber() for Int32 array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      
      arr.setNumber(0, 0);
      arr.setNumber(1, 2147483647);
      arr.setNumber(2, 123456789);
      
      assert(arr.getNumber(0) === 0, 'getNumber(0) should return 0');
      assert(arr.getNumber(1) === 2147483647, 'getNumber(1) should return 2147483647');
      assert(arr.getNumber(2) === 123456789, 'getNumber(2) should return 123456789');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - setNumber() and getNumber() sequence',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 10);
      
      // Write sequence
      for (let i = 0; i < 10; i++) {
        arr.setNumber(i, i * 10);
      }
      
      // Read and verify
      for (let i = 0; i < 10; i++) {
        const value = arr.getNumber(i);
        assert(value === i * 10, `getNumber(${i}) should return ${i * 10}, got ${value}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - overwrite number values',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      
      // Initial write
      arr.setNumber(0, 100);
      assert(arr.getNumber(0) === 100, 'Initial value should be 100');
      
      // Overwrite
      arr.setNumber(0, 200);
      assert(arr.getNumber(0) === 200, 'Overwritten value should be 200');
    }
  ));

  // =====================================================
  // SECTION 5: getTyped() / setTyped() Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - getTyped() for numeric array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      arr.setNumber(2, 42);
      
      const value = arr.getTyped(2);
      assert(value === 42, `getTyped(2) should return 42, got ${value}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - setTyped() for numeric array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      arr.setTyped(3, 99);
      
      const value = arr.getNumber(3);
      assert(value === 99, `setTyped should set value to 99, got ${value}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getTyped() bounds check (out of range)',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      
      let threw = false;
      try {
        arr.getTyped(10); // Out of bounds
      } catch (e) {
        threw = true;
      }
      
      assert(threw, 'getTyped() should throw for out of bounds index');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - setTyped() bounds check (negative index)',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      
      let threw = false;
      try {
        arr.setTyped(-1, 100); // Negative index
      } catch (e) {
        threw = true;
      }
      
      assert(threw, 'setTyped() should throw for negative index');
    }
  ));

  // =====================================================
  // SECTION 6: elementAt() Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - elementAt() basic usage',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);
      
      assert(arr.elementAt(0) === 10, 'elementAt(0) should return 10');
      assert(arr.elementAt(1) === 20, 'elementAt(1) should return 20');
      assert(arr.elementAt(2) === 30, 'elementAt(2) should return 30');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - elementAt() throws for out of bounds',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      
      let threw = false;
      try {
        arr.elementAt(5);
      } catch (e) {
        threw = true;
      }
      
      assert(threw, 'elementAt() should throw for out of bounds');
    }
  ));

  // =====================================================
  // SECTION 7: LINQ-like Methods Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - where() filter',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const result = arr.where((item) => item > 20);
      assert(result.length === 2, `where(>20) should return 2 items, got ${result.length}`);
      assert(result[0] === 30, 'First filtered item should be 30');
      assert(result[1] === 40, 'Second filtered item should be 40');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - select() transform',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const result = arr.select((item) => item * 2);
      assert(result.length === 3, 'select should return same count');
      assert(result[0] === 2, 'select(0) should be 2');
      assert(result[1] === 4, 'select(1) should be 4');
      assert(result[2] === 6, 'select(2) should be 6');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - first() without predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);
      
      const result = arr.first();
      assert(result === 100, `first() should return 100, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - first() with predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const result = arr.first((item) => item > 25);
      assert(result === 30, `first(>25) should return 30, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - first() returns null when not found',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const result = arr.first((item) => item > 100);
      assert(result === null, 'first() should return null when predicate matches nothing');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - last() without predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);
      
      const result = arr.last();
      assert(result === 300, `last() should return 300, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - last() with predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const result = arr.last((item) => item < 35);
      assert(result === 30, `last(<35) should return 30, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - any() without predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      
      assert(arr.any() === true, 'any() should return true for non-empty array');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - any() returns false for empty array',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 0);
      assert(arr.any() === false, 'any() should return false for empty array');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - any() with predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      assert(arr.any((item) => item > 2) === true, 'any(>2) should return true');
      assert(arr.any((item) => item > 10) === false, 'any(>10) should return false');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - all() predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);
      
      assert(arr.all((item) => item > 0) === true, 'all(>0) should return true');
      assert(arr.all((item) => item > 15) === false, 'all(>15) should return false');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - count() without predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      assert(arr.count() === 5, `count() should return 5, got ${arr.count()}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - count() with predicate',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i);
      }
      
      const result = arr.count((item) => item > 2);
      assert(result === 2, `count(>2) should return 2, got ${result}`);
    }
  ));

  // =====================================================
  // SECTION 8: More LINQ-like Methods
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - aggregate() / reduce()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 4);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      arr.setNumber(3, 4);
      
      const sum = arr.aggregate((acc, item) => acc + item, 0);
      assert(sum === 10, `aggregate sum should be 10, got ${sum}`);
      
      const product = arr.reduce((acc, item) => acc * item, 1);
      assert(product === 24, `reduce product should be 24, got ${product}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - toArray()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);
      
      const jsArray = arr.toArray();
      assert(Array.isArray(jsArray), 'toArray() should return JS array');
      assert(jsArray.length === 3, 'JS array should have 3 elements');
      assert(jsArray[0] === 10, 'First element should be 10');
      assert(jsArray[1] === 20, 'Second element should be 20');
      assert(jsArray[2] === 30, 'Third element should be 30');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - forEach()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const collected: number[] = [];
      arr.forEach((item) => collected.push(item));
      
      assert(collected.length === 3, 'forEach should iterate all elements');
      assert(collected[0] === 1, 'First collected should be 1');
      assert(collected[1] === 2, 'Second collected should be 2');
      assert(collected[2] === 3, 'Third collected should be 3');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - map() (alias for select)',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const result = arr.map((item) => item * 10);
      assert(result[0] === 10, 'map result[0] should be 10');
      assert(result[1] === 20, 'map result[1] should be 20');
      assert(result[2] === 30, 'map result[2] should be 30');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - filter() (alias for where)',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i);
      }
      
      const result = arr.filter((item) => item % 2 === 0);
      assert(result.length === 3, 'filter for even should return 3 items');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - find() (alias for first with predicate)',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const result = arr.find((item) => item > 25);
      assert(result === 30, `find(>25) should return 30, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - findIndex()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const index = arr.findIndex((item) => item === 30);
      assert(index === 3, `findIndex(30) should return 3, got ${index}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - findIndex() returns -1 when not found',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const index = arr.findIndex((item) => item > 100);
      assert(index === -1, `findIndex for missing item should return -1, got ${index}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - includes()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 10);
      arr.setNumber(1, 20);
      arr.setNumber(2, 30);
      
      assert(arr.includes(20) === true, 'should include 20');
      assert(arr.includes(50) === false, 'should not include 50');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - slice()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      for (let i = 0; i < 5; i++) {
        arr.setNumber(i, i * 10);
      }
      
      const sliced = arr.slice(1, 4);
      assert(sliced.length === 3, `slice(1,4) should have 3 elements, got ${sliced.length}`);
      assert(sliced[0] === 10, 'slice[0] should be 10');
      assert(sliced[1] === 20, 'slice[1] should be 20');
      assert(sliced[2] === 30, 'slice[2] should be 30');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - distinct()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 6);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 1);
      arr.setNumber(3, 3);
      arr.setNumber(4, 2);
      arr.setNumber(5, 1);
      
      const result = arr.distinct();
      assert(result.length === 3, `distinct should return 3 unique items, got ${result.length}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - orderBy()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 4);
      arr.setNumber(0, 30);
      arr.setNumber(1, 10);
      arr.setNumber(2, 40);
      arr.setNumber(3, 20);
      
      const ordered = arr.orderBy((item) => item);
      assert(ordered[0] === 10, 'orderBy first should be 10');
      assert(ordered[1] === 20, 'orderBy second should be 20');
      assert(ordered[2] === 30, 'orderBy third should be 30');
      assert(ordered[3] === 40, 'orderBy fourth should be 40');
    }
  ));

  // =====================================================
  // SECTION 9: Iterator Support
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - Symbol.iterator support',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 100);
      arr.setNumber(1, 200);
      arr.setNumber(2, 300);
      
      const collected: number[] = [];
      for (const item of arr) {
        collected.push(item);
      }
      
      assert(collected.length === 3, 'for...of should iterate all elements');
      assert(collected[0] === 100, 'First iterated should be 100');
      assert(collected[1] === 200, 'Second iterated should be 200');
      assert(collected[2] === 300, 'Third iterated should be 300');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - spread operator with iterator',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 3);
      arr.setNumber(0, 1);
      arr.setNumber(1, 2);
      arr.setNumber(2, 3);
      
      const spread = [...arr];
      assert(spread.length === 3, 'Spread should create array with 3 elements');
      assert(spread[0] === 1, 'Spread[0] should be 1');
    }
  ));

  // =====================================================
  // SECTION 10: Utility Methods
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - describe()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 10);
      const description = arr.describe();
      
      assert(typeof description === 'string', 'describe() should return string');
      assert(description.includes('Int32'), 'Description should include element type');
      assert(description.includes('10'), 'Description should include length');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getArrayInfo()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 10);
      const info = arr.getArrayInfo();
      
      assert(info.length === 10, `info.length should be 10, got ${info.length}`);
      assert(info.elementSize === 4, `info.elementSize should be 4, got ${info.elementSize}`);
      assert(info.totalSize === 40, `info.totalSize should be 40, got ${info.totalSize}`);
      assert(info.elementClass.includes('Int32'), 'info.elementClass should include Int32');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - validateArray()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 5);
      const validation = arr.validateArray();
      
      assert(validation.isValid === true, 'Valid array should pass validation');
      assert(validation.errors.length === 0, 'Valid array should have no errors');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - toString()',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 5);
      const str = arr.toString();
      
      assert(typeof str === 'string', 'toString() should return string');
      assert(str.includes('MonoArray'), 'toString() should include MonoArray');
    }
  ));

  // =====================================================
  // SECTION 11: Empty Array Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - empty array properties',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 0);
      
      assert(arr.length === 0, 'Empty array length should be 0');
      assert(arr.getLength() === 0, 'Empty array getLength() should be 0');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - empty array LINQ operations',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 0);
      
      assert(arr.any() === false, 'any() on empty should return false');
      assert(arr.first() === null, 'first() on empty should return null');
      assert(arr.last() === null, 'last() on empty should return null');
      assert(arr.count() === 0, 'count() on empty should return 0');
      assert(arr.toArray().length === 0, 'toArray() on empty should return empty array');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - empty array iteration',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 0);
      
      let iterationCount = 0;
      for (const _item of arr) {
        iterationCount++;
      }
      
      assert(iterationCount === 0, 'Empty array should not iterate');
    }
  ));

  // =====================================================
  // SECTION 12: Different Element Type Arrays
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - UInt32 array',
    () => {
      const uintClass = Mono.domain.class('System.UInt32');
      assertNotNull(uintClass, 'UInt32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, uintClass, 3);
      arr.setNumber(0, 0);
      arr.setNumber(1, 2147483647);
      arr.setNumber(2, 4294967295);
      
      assert(arr.getNumber(0) === 0, 'UInt32[0] should be 0');
      assert(arr.getNumber(1) === 2147483647, 'UInt32[1] should be 2147483647');
      assert(arr.getNumber(2) === 4294967295, 'UInt32[2] should be 4294967295');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - Boolean array',
    () => {
      const boolClass = Mono.domain.class('System.Boolean');
      assertNotNull(boolClass, 'Boolean class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, boolClass, 3);
      arr.setNumber(0, 0); // false
      arr.setNumber(1, 1); // true
      arr.setNumber(2, 0); // false
      
      assert(arr.getNumber(0) === 0, 'Boolean[0] should be 0 (false)');
      assert(arr.getNumber(1) === 1, 'Boolean[1] should be 1 (true)');
      assert(arr.getNumber(2) === 0, 'Boolean[2] should be 0 (false)');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - Char array',
    () => {
      const charClass = Mono.domain.class('System.Char');
      assertNotNull(charClass, 'Char class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, charClass, 3);
      arr.setNumber(0, 65); // 'A'
      arr.setNumber(1, 66); // 'B'
      arr.setNumber(2, 67); // 'C'
      
      assert(arr.getNumber(0) === 65, 'Char[0] should be 65 (A)');
      assert(arr.getNumber(1) === 66, 'Char[1] should be 66 (B)');
      assert(arr.getNumber(2) === 67, 'Char[2] should be 67 (C)');
      assert(arr.getElementSize() === 2, 'Char element size should be 2');
    }
  ));

  // =====================================================
  // SECTION 13: Large Array Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - large array creation',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 1000);
      assert(arr.length === 1000, `Large array length should be 1000, got ${arr.length}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - large array read/write',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 100);
      
      // Write all elements
      for (let i = 0; i < 100; i++) {
        arr.setNumber(i, i * i);
      }
      
      // Verify
      for (let i = 0; i < 100; i++) {
        const expected = i * i;
        const actual = arr.getNumber(i);
        assert(actual === expected, 
          `arr[${i}] should be ${expected}, got ${actual}`);
      }
    }
  ));

  // =====================================================
  // SECTION 14: getElementAddress() Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - getElementAddress() returns valid pointers',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 5);
      
      for (let i = 0; i < 5; i++) {
        const addr = arr.getElementAddress(i);
        assert(!addr.isNull(), `Element address ${i} should not be null`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - getElementAddress() sequential addresses',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new(Mono.api, intClass, 3);
      const elementSize = arr.getElementSize();
      
      const addr0 = arr.getElementAddress(0);
      const addr1 = arr.getElementAddress(1);
      const addr2 = arr.getElementAddress(2);
      
      // Addresses should be sequential with element size spacing
      const diff1 = addr1.sub(addr0).toInt32();
      const diff2 = addr2.sub(addr1).toInt32();
      
      assert(diff1 === elementSize, 
        `Address gap 0->1 should be ${elementSize}, got ${diff1}`);
      assert(diff2 === elementSize, 
        `Address gap 1->2 should be ${elementSize}, got ${diff2}`);
    }
  ));

  // =====================================================
  // SECTION 15: Integration Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'MonoArray - chained operations',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 10);
      for (let i = 0; i < 10; i++) {
        arr.setNumber(i, i);
      }
      
      // Chain: filter -> map -> reduce
      const result = arr
        .filter((x) => x > 3)  // [4, 5, 6, 7, 8, 9]
        .map((x) => x * 2)     // [8, 10, 12, 14, 16, 18]
        .reduce((acc, x) => acc + x, 0); // 78
      
      assert(result === 78, `Chained result should be 78, got ${result}`);
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - multiple arrays independent',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr1 = MonoArray.new<number>(Mono.api, intClass, 3);
      const arr2 = MonoArray.new<number>(Mono.api, intClass, 3);
      
      arr1.setNumber(0, 100);
      arr2.setNumber(0, 200);
      
      // Arrays should be independent
      assert(arr1.getNumber(0) === 100, 'arr1[0] should be 100');
      assert(arr2.getNumber(0) === 200, 'arr2[0] should be 200');
      
      // Modifying one shouldn't affect the other
      arr1.setNumber(0, 150);
      assert(arr2.getNumber(0) === 200, 'arr2[0] should still be 200');
    }
  ));

  results.push(createMonoDependentTest(
    'MonoArray - pointer validity after operations',
    () => {
      const intClass = Mono.domain.class('System.Int32');
      assertNotNull(intClass, 'Int32 class should exist');
      
      const arr = MonoArray.new<number>(Mono.api, intClass, 5);
      
      // Perform various operations
      arr.setNumber(0, 42);
      arr.getNumber(0);
      arr.toArray();
      arr.where((x) => x > 0);
      arr.describe();
      
      // Pointer should still be valid
      assert(!arr.pointer.isNull(), 'Array pointer should remain valid');
      assert(arr.length === 5, 'Array length should remain 5');
    }
  ));

  return results;
}

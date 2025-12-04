/**
 * MonoString Complete Tests
 *
 * Tests MonoString API:
 * - length / getLength()
 * - charAt(index)
 * - substring(start, length?)
 * - contains(search)
 * - startsWith(prefix)
 * - endsWith(suffix)
 * - toString()
 * - static new(api, value)
 * - Unicode handling
 * - Empty strings
 * - Caching behavior
 * - Edge cases
 */

import Mono, { MonoString } from "../src";
import { TestResult, assert, assertNotNull, createMonoDependentTest } from "./test-framework";

export function createMonoStringTests(): TestResult[] {
  const results: TestResult[] = [];

  // =====================================================
  // SECTION 1: Basic Property Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - length property (from static field)", () => {
      // Get String.Empty which has length 0
      const stringClass = Mono.domain.class("System.String");
      assertNotNull(stringClass, "String class should exist");

      const emptyField = stringClass.tryGetField("Empty");
      assertNotNull(emptyField, "String.Empty field should exist");

      const emptyString = emptyField!.getStringValue(null);
      assertNotNull(emptyString, "Empty string should not be null");

      const length = emptyString!.length;
      assert(length === 0, `String.Empty should have length 0, got ${length}`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - getLength() method", () => {
      const stringClass = Mono.domain.class("System.String");
      assertNotNull(stringClass, "String class should exist");

      const emptyField = stringClass.tryGetField("Empty");
      assertNotNull(emptyField, "String.Empty field should exist");

      const emptyString = emptyField!.getStringValue(null);
      assertNotNull(emptyString, "Empty string should not be null");

      const length = emptyString!.getLength();
      assert(length === 0, `getLength() should return 0 for empty string, got ${length}`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - length property equals getLength()", () => {
      // Get a non-empty string
      const boolClass = Mono.domain.class("System.Boolean");
      assertNotNull(boolClass, "Boolean class should exist");

      const trueStringField = boolClass.tryGetField("TrueString");
      if (!trueStringField) {
        console.log("[SKIP] TrueString field not found");
        return;
      }

      const trueString = trueStringField.getStringValue(null);
      if (!trueString || trueString.pointer.isNull()) {
        console.log("[SKIP] TrueString value is null");
        return;
      }

      const lengthProp = trueString.length;
      const lengthMethod = trueString.getLength();
      assert(lengthProp === lengthMethod, `length property (${lengthProp}) should equal getLength() (${lengthMethod})`);
    }),
  );

  // =====================================================
  // SECTION 2: String Creation Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString.new() - create empty string", () => {
      const str = MonoString.new(Mono.api, "");
      assertNotNull(str, "Created string should not be null");
      assert(str.length === 0, `Empty string should have length 0, got ${str.length}`);
      assert(str.toString() === "", "toString() should return empty string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create ASCII string", () => {
      const testValue = "Hello, World!";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.length === testValue.length, `String length should be ${testValue.length}, got ${str.length}`);
      assert(str.toString() === testValue, `toString() should return "${testValue}", got "${str.toString()}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create Unicode string (Chinese)", () => {
      const testValue = "你好世界";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.length === testValue.length, `String length should be ${testValue.length}, got ${str.length}`);
      assert(str.toString() === testValue, `toString() should return "${testValue}", got "${str.toString()}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create Unicode string (Japanese)", () => {
      const testValue = "こんにちは";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.length === testValue.length, `String length should be ${testValue.length}, got ${str.length}`);
      assert(str.toString() === testValue, `toString() should return "${testValue}", got "${str.toString()}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create Unicode string (Korean)", () => {
      const testValue = "안녕하세요";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.length === testValue.length, `String length should be ${testValue.length}, got ${str.length}`);
      assert(str.toString() === testValue, `toString() should return "${testValue}", got "${str.toString()}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create Unicode string (emoji)", () => {
      const testValue = "😀🎉🔥";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      // Note: emoji are surrogate pairs, each takes 2 UTF-16 code units
      const expectedLength = 6; // 3 emojis * 2 surrogate pairs
      assert(
        str.length === expectedLength,
        `Emoji string length should be ${expectedLength} (surrogate pairs), got ${str.length}`,
      );
      assert(str.toString() === testValue, "toString() should return original emoji string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create mixed content string", () => {
      const testValue = "Hello 你好 🌍";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.toString() === testValue, `toString() should return "${testValue}", got "${str.toString()}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create string with special characters", () => {
      const testValue = "Line1\nLine2\tTabbed\r\nWindows";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      assert(str.toString() === testValue, "toString() should preserve special characters");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString.new() - create string with null character", () => {
      const testValue = "Before\0After";
      const str = MonoString.new(Mono.api, testValue);
      assertNotNull(str, "Created string should not be null");
      // Note: toString() may truncate at null char depending on implementation
      const result = str.toString();
      assert(result.startsWith("Before"), `String should start with "Before", got "${result}"`);
    }),
  );

  // =====================================================
  // SECTION 3: charAt() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - charAt() basic usage", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);

      for (let i = 0; i < testValue.length; i++) {
        const char = str.charAt(i);
        assert(char === testValue.charAt(i), `charAt(${i}) should be '${testValue.charAt(i)}', got '${char}'`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - charAt() with Unicode", () => {
      const testValue = "你好";
      const str = MonoString.new(Mono.api, testValue);

      for (let i = 0; i < testValue.length; i++) {
        const char = str.charAt(i);
        assert(char === testValue.charAt(i), `charAt(${i}) should be '${testValue.charAt(i)}', got '${char}'`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - charAt() first character", () => {
      const testValue = "Test";
      const str = MonoString.new(Mono.api, testValue);
      const char = str.charAt(0);
      assert(char === "T", `First character should be 'T', got '${char}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - charAt() last character", () => {
      const testValue = "Test";
      const str = MonoString.new(Mono.api, testValue);
      const char = str.charAt(testValue.length - 1);
      assert(char === "t", `Last character should be 't', got '${char}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - charAt() middle character", () => {
      const testValue = "ABCDE";
      const str = MonoString.new(Mono.api, testValue);
      const char = str.charAt(2);
      assert(char === "C", `Middle character should be 'C', got '${char}'`);
    }),
  );

  // =====================================================
  // SECTION 4: substring() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - substring() with start only", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(6);
      assert(sub === "World", `substring(6) should be 'World', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() with start and length", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(0, 5);
      assert(sub === "Hello", `substring(0, 5) should be 'Hello', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() from beginning", () => {
      const testValue = "ABCDEFG";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(0, 3);
      assert(sub === "ABC", `substring(0, 3) should be 'ABC', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() from middle", () => {
      const testValue = "ABCDEFG";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(2, 3);
      assert(sub === "CDE", `substring(2, 3) should be 'CDE', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() to end", () => {
      const testValue = "ABCDEFG";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(4);
      assert(sub === "EFG", `substring(4) should be 'EFG', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() with Unicode", () => {
      const testValue = "你好世界";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(1, 2);
      assert(sub === "好世", `substring(1, 2) should be '好世', got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() entire string", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(0, testValue.length);
      assert(sub === testValue, "substring(0, length) should return entire string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() empty result", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(0, 0);
      assert(sub === "", `substring(0, 0) should return empty string, got '${sub}'`);
    }),
  );

  // =====================================================
  // SECTION 5: contains() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - contains() found at start", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("Hello") === true, 'Should contain "Hello"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() found at end", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("World") === true, 'Should contain "World"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() found in middle", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("lo Wo") === true, 'Should contain "lo Wo"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() not found", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("xyz") === false, 'Should not contain "xyz"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() empty search", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("") === true, "Should contain empty string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() case sensitive", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("hello") === false, 'Should not contain "hello" (case sensitive)');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() with Unicode", () => {
      const testValue = "你好世界";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("好世") === true, 'Should contain "好世"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() entire string", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.contains("Hello") === true, "Should contain entire string");
    }),
  );

  // =====================================================
  // SECTION 6: startsWith() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - startsWith() true", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("Hello") === true, 'Should start with "Hello"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() false", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("World") === false, 'Should not start with "World"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() empty prefix", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("") === true, "Should start with empty string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() entire string", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("Hello") === true, "Should start with entire string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() case sensitive", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("hello") === false, 'Should not start with "hello" (case sensitive)');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() single char", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("H") === true, 'Should start with "H"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() with Unicode", () => {
      const testValue = "你好世界";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.startsWith("你好") === true, 'Should start with "你好"');
    }),
  );

  // =====================================================
  // SECTION 7: endsWith() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - endsWith() true", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("World") === true, 'Should end with "World"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() false", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("Hello") === false, 'Should not end with "Hello"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() empty suffix", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("") === true, "Should end with empty string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() entire string", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("Hello") === true, "Should end with entire string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() case sensitive", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("world") === false, 'Should not end with "world" (case sensitive)');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() single char", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("o") === true, 'Should end with "o"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() with Unicode", () => {
      const testValue = "你好世界";
      const str = MonoString.new(Mono.api, testValue);
      assert(str.endsWith("世界") === true, 'Should end with "世界"');
    }),
  );

  // =====================================================
  // SECTION 8: toString() Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - toString() returns string value", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);
      const result = str.toString();
      assert(typeof result === "string", "toString() should return a string");
      assert(result === testValue, `toString() should return "${testValue}", got "${result}"`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - toString() caching (returns same value)", () => {
      const testValue = "Cached String";
      const str = MonoString.new(Mono.api, testValue);

      const result1 = str.toString();
      const result2 = str.toString();

      assert(result1 === result2, "Cached toString() should return identical value");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - toString() with long string", () => {
      const testValue = "A".repeat(1000);
      const str = MonoString.new(Mono.api, testValue);
      const result = str.toString();
      assert(result === testValue, "toString() should handle long strings");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - toString() from runtime string", () => {
      // Get a string from .NET runtime
      const stringClass = Mono.domain.class("System.String");
      assertNotNull(stringClass, "String class should exist");

      const emptyField = stringClass.tryGetField("Empty");
      assertNotNull(emptyField, "String.Empty field should exist");

      const emptyString = emptyField!.getStringValue(null);
      assertNotNull(emptyString, "Empty string should not be null");

      const result = emptyString!.toString();
      assert(result === "", `String.Empty toString() should return "", got "${result}"`);
    }),
  );

  // =====================================================
  // SECTION 9: Edge Cases
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - empty string operations", () => {
      const str = MonoString.new(Mono.api, "");

      assert(str.length === 0, "Empty string length should be 0");
      assert(str.toString() === "", 'Empty string toString() should return ""');
      assert(str.contains("") === true, "Empty string contains empty string");
      assert(str.startsWith("") === true, "Empty string starts with empty string");
      assert(str.endsWith("") === true, "Empty string ends with empty string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - single character string", () => {
      const str = MonoString.new(Mono.api, "X");

      assert(str.length === 1, "Single char string length should be 1");
      assert(str.charAt(0) === "X", "charAt(0) should return the single char");
      assert(str.toString() === "X", 'toString() should return "X"');
      assert(str.substring(0, 1) === "X", 'substring(0, 1) should return "X"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - string with spaces", () => {
      const testValue = "   ";
      const str = MonoString.new(Mono.api, testValue);

      assert(str.length === 3, "Space string length should be 3");
      assert(str.toString() === testValue, "toString() should preserve spaces");
      assert(str.contains(" ") === true, "Should contain space");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - string with numbers", () => {
      const testValue = "12345";
      const str = MonoString.new(Mono.api, testValue);

      assert(str.length === 5, "Number string length should be 5");
      assert(str.toString() === testValue, "toString() should return number string");
      assert(str.charAt(2) === "3", 'charAt(2) should return "3"');
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - mixed ASCII and Unicode", () => {
      const testValue = "ABC你好XYZ";
      const str = MonoString.new(Mono.api, testValue);

      assert(str.length === testValue.length, `Length should be ${testValue.length}`);
      assert(str.toString() === testValue, "toString() should preserve mixed content");
      assert(str.contains("ABC") === true, "Should contain ASCII part");
      assert(str.contains("你好") === true, "Should contain Unicode part");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - very long string", () => {
      const testValue = "LongString".repeat(100);
      const str = MonoString.new(Mono.api, testValue);

      assert(str.length === testValue.length, `Length should be ${testValue.length}`);
      assert(str.toString() === testValue, "toString() should handle very long strings");
    }),
  );

  // =====================================================
  // SECTION 10: API Quality Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - immutability (create new for modifications)", () => {
      const str1 = MonoString.new(Mono.api, "Original");
      const str2 = MonoString.new(Mono.api, "Modified");

      // Strings should be separate objects
      assert(!str1.pointer.equals(str2.pointer), "Different strings should have different pointers");
      assert(str1.toString() === "Original", "str1 should remain unchanged");
      assert(str2.toString() === "Modified", "str2 should have new value");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - pointer validity", () => {
      const str = MonoString.new(Mono.api, "Test");
      assert(!str.pointer.isNull(), "String pointer should not be null");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - consistent length across operations", () => {
      const testValue = "TestString";
      const str = MonoString.new(Mono.api, testValue);

      // Length should be consistent
      const len1 = str.length;
      const len2 = str.getLength();
      const len3 = str.toString().length;

      assert(len1 === len2, "length property should equal getLength()");
      assert(len1 === len3, "length should equal toString().length");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring does not modify original", () => {
      const testValue = "Hello World";
      const str = MonoString.new(Mono.api, testValue);

      const sub = str.substring(0, 5);

      assert(str.toString() === testValue, "Original string should be unchanged");
      assert(sub === "Hello", 'Substring should be "Hello"');
    }),
  );

  // =====================================================
  // SECTION 11: Boundary Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - charAt() boundary test (first index)", () => {
      const str = MonoString.new(Mono.api, "Test");
      const char = str.charAt(0);
      assert(char === "T", `charAt(0) should be 'T', got '${char}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - charAt() boundary test (last index)", () => {
      const str = MonoString.new(Mono.api, "Test");
      const char = str.charAt(3);
      assert(char === "t", `charAt(3) should be 't', got '${char}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - substring() from end", () => {
      const testValue = "Hello";
      const str = MonoString.new(Mono.api, testValue);
      const sub = str.substring(testValue.length);
      assert(sub === "", `substring(length) should return empty string, got '${sub}'`);
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - contains() longer than string", () => {
      const str = MonoString.new(Mono.api, "Hi");
      assert(str.contains("Hello") === false, "Should not contain longer string");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - startsWith() longer prefix", () => {
      const str = MonoString.new(Mono.api, "Hi");
      assert(str.startsWith("Hello") === false, "Should not start with longer prefix");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - endsWith() longer suffix", () => {
      const str = MonoString.new(Mono.api, "Hi");
      assert(str.endsWith("Hello") === false, "Should not end with longer suffix");
    }),
  );

  // =====================================================
  // SECTION 12: Integration Tests
  // =====================================================
  results.push(
    createMonoDependentTest("MonoString - round trip: create and read back", () => {
      const values = ["Simple", "你好", "Mixed 混合 Content", "!@#$%^&*()", "   spaces   ", "Tab\tNewline\n"];

      for (const testValue of values) {
        const str = MonoString.new(Mono.api, testValue);
        const result = str.toString();
        assert(result === testValue, `Round trip failed for "${testValue}", got "${result}"`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - chained operations", () => {
      const str = MonoString.new(Mono.api, "Hello World from Mono");

      // Multiple operations on same string
      assert(str.startsWith("Hello"), "Should start with Hello");
      assert(str.endsWith("Mono"), "Should end with Mono");
      assert(str.contains("World"), "Should contain World");
      assert(str.substring(6, 5) === "World", "substring should work");
      assert(str.charAt(0) === "H", "charAt should work");
    }),
  );

  results.push(
    createMonoDependentTest("MonoString - multiple strings independent", () => {
      const str1 = MonoString.new(Mono.api, "First");
      const str2 = MonoString.new(Mono.api, "Second");
      const str3 = MonoString.new(Mono.api, "Third");

      assert(str1.toString() === "First", "str1 should be First");
      assert(str2.toString() === "Second", "str2 should be Second");
      assert(str3.toString() === "Third", "str3 should be Third");

      // Operations on one shouldn't affect others
      str2.substring(0, 3);
      assert(str1.toString() === "First", "str1 should still be First");
    }),
  );

  return results;
}

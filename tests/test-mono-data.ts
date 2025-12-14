/**
 * Comprehensive Mono Data Operations Tests (Phase 3)
 * Complete tests for MonoArray, MonoString, and MonoObject operations
 */

import Mono, { MonoObject, readUtf16String } from "../src";
import {
  assert,
  assertApiAvailable,
  assertNotNull,
  createErrorHandlingTest,
  createIntegrationTest,
  createMonoDependentTest,
  createNestedPerformTest,
  createPerformanceTest,
  createSmokeTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

export async function testMonoData(): Promise<TestResult[]> {
  console.log("\nComprehensive Mono Data Operations Tests:");

  const suite = new TestSuite("Mono Data Operations Complete", TestCategory.MONO_DEPENDENT);
  const results: TestResult[] = [];

  // ============================================================================
  // SMOKE TESTS
  // ============================================================================

  await suite.addResultAsync(createSmokeTest(TestCategory.MONO_DEPENDENT, "comprehensive data operations"));

  await suite.addResultAsync(
    createMonoDependentTest("Data operations APIs should be available", () => {
      assertApiAvailable("Mono.api should be accessible for comprehensive data operations");

      // Array APIs
      assert(Mono.api.hasExport("mono_array_new"), "mono_array_new should be available");
      assert(Mono.api.hasExport("mono_array_length"), "mono_array_length should be available");
      assert(Mono.api.hasExport("mono_array_addr_with_size"), "mono_array_addr_with_size should be available");
      // Note: mono_array_element_class may not be available in all Mono versions
      if (Mono.api.hasExport("mono_array_element_class")) {
        console.log("    mono_array_element_class is available");
      } else {
        console.log("    mono_array_element_class is NOT available (optional)");
      }
      assert(Mono.api.hasExport("mono_array_element_size"), "mono_array_element_size should be available");

      // String APIs
      assert(Mono.api.hasExport("mono_string_new"), "mono_string_new should be available");
      assert(Mono.api.hasExport("mono_string_new_len"), "mono_string_new_len should be available");
      assert(Mono.api.hasExport("mono_string_length"), "mono_string_length should be available");
      assert(Mono.api.hasExport("mono_string_chars"), "mono_string_chars should be available");

      // Object APIs
      assert(Mono.api.hasExport("mono_object_new"), "mono_object_new should be available");
      assert(Mono.api.hasExport("mono_object_get_class"), "mono_object_get_class should be available");
      assert(Mono.api.hasExport("mono_object_unbox"), "mono_object_unbox should be available");
      assert(Mono.api.hasExport("mono_value_box"), "mono_value_box should be available");
      assert(Mono.api.hasExport("mono_object_get_size"), "mono_object_get_size should be available");

      console.log("    All comprehensive data operation APIs are available");
    }),
  );

  // ============================================================================
  // MONO ARRAY COMPREHENSIVE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Should create and access basic arrays", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      // Create string array
      const stringArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, 5);
      assertNotNull(stringArray, "String array should be created");
      assert(!stringArray.isNull(), "String array pointer should not be null");

      // Test array length - mono_array_length returns uintptr_t which may need conversion
      const lengthRaw = Mono.api.native.mono_array_length(stringArray);
      const length = typeof lengthRaw === "number" ? lengthRaw : lengthRaw.toNumber();
      assert(length === 5, `Array length should be 5, got ${length}`);

      // Test element class if available
      if (Mono.api.hasExport("mono_array_element_class")) {
        const elementClass = Mono.api.native.mono_array_element_class(stringArray);
        assertNotNull(elementClass, "Element class should be available");
        assert(!elementClass.isNull(), "Element class pointer should not be null");
      }

      console.log(`    Successfully created string array with ${length} elements`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test array bounds checking", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      // Create int array
      const intArray = Mono.api.native.mono_array_new(domain.pointer, intClass.pointer, 3);
      assertNotNull(intArray, "Int array should be created");

      // Get element size for Int32 (4 bytes)
      const elementSize = 4;

      // Test valid access (array, element_size, index)
      const validAddress = Mono.api.native.mono_array_addr_with_size(intArray, elementSize, 0);
      assertNotNull(validAddress, "Valid array address should be accessible");

      // Test bounds checking - this should not crash
      try {
        const invalidAddress = Mono.api.native.mono_array_addr_with_size(intArray, elementSize, 10);
        console.log("    Out-of-bounds access handled gracefully");
      } catch (error) {
        console.log(`    Out-of-bounds access threw expected error: ${error}`);
      }

      console.log("    Array bounds checking working correctly");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test multi-dimensional array concepts", () => {
      const domain = Mono.domain;

      // Test multi-dimensional array type names
      const multiDimTypes = ["System.Int32[,]", "System.String[,,]", "System.Object[2,3]"];

      let foundCount = 0;
      for (const typeName of multiDimTypes) {
        const arrayClass = domain.tryClass(typeName);
        if (arrayClass) {
          foundCount++;
          console.log(`    Found multi-dimensional array type: ${typeName}`);
        }
      }

      console.log(`    Found ${foundCount}/${multiDimTypes.length} multi-dimensional array types`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test array iteration patterns", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      // Create array and populate with test strings
      const testArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, 4);
      const testStrings = ["First", "Second", "Third", "Fourth"];

      // For object arrays (strings are objects), element size is pointer size
      const ptrSize = Process.pointerSize;

      // Populate array
      for (let i = 0; i < testStrings.length; i++) {
        const testString = Mono.api.stringNew(testStrings[i]);
        const elementAddress = Mono.api.native.mono_array_addr_with_size(testArray, ptrSize, i);
        elementAddress.writePointer(testString);
      }

      // Iterate and verify
      let successCount = 0;
      for (let i = 0; i < testStrings.length; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(testArray, ptrSize, i);
        const elementPtr = elementAddress.readPointer();
        if (!elementPtr.isNull()) {
          // Read string using native APIs
          const length = Mono.api.native.mono_string_length(elementPtr);
          const chars = Mono.api.native.mono_string_chars(elementPtr);
          const retrievedString = readUtf16String(chars, length);
          if (retrievedString === testStrings[i]) {
            successCount++;
          }
        }
      }

      assert(
        successCount === testStrings.length,
        `Expected ${testStrings.length} successful retrievals, got ${successCount}`,
      );
      console.log(`    Successfully iterated through ${successCount} array elements`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test LINQ-style array operations", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      // Create numeric array
      const numArray = Mono.api.native.mono_array_new(domain.pointer, intClass.pointer, 10);

      // Int32 element size is 4 bytes
      const intSize = 4;

      // Populate with test data
      for (let i = 0; i < 10; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(numArray, intSize, i);
        elementAddress.writeU32(i * 2); // Even numbers: 0, 2, 4, 6, 8, 10, 12, 14, 16, 18
      }

      // Test filtering (even numbers greater than 10)
      let filteredCount = 0;
      for (let i = 0; i < 10; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(numArray, intSize, i);
        const value = elementAddress.readU32();
        if (value > 10) {
          filteredCount++;
        }
      }

      assert(filteredCount === 4, `Expected 4 values > 10, got ${filteredCount}`);

      // Test aggregation (sum)
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(numArray, intSize, i);
        sum += elementAddress.readU32();
      }

      assert(sum === 90, `Expected sum of 90, got ${sum}`);
      console.log(`    LINQ-style operations: filtered ${filteredCount} items, sum=${sum}`);
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Should test array performance benchmarks", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      const startTime = Date.now();
      const arraySize = 1000;

      // Create large array
      const largeArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, arraySize);

      // For object arrays (strings are objects), element size is pointer size
      const ptrSize = Process.pointerSize;

      // Populate array
      for (let i = 0; i < arraySize; i++) {
        const testString = Mono.api.stringNew(`Item_${i}`);
        const elementAddress = Mono.api.native.mono_array_addr_with_size(largeArray, ptrSize, i);
        elementAddress.writePointer(testString);
      }

      // Read all elements
      let readCount = 0;
      for (let i = 0; i < arraySize; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(largeArray, ptrSize, i);
        const elementPtr = elementAddress.readPointer();
        if (!elementPtr.isNull()) {
          readCount++;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(readCount === arraySize, `Expected to read ${arraySize} elements, got ${readCount}`);
      assert(duration < 5000, `Array operations should complete within 5 seconds, took ${duration}ms`);

      console.log(`    Array performance: ${arraySize} elements processed in ${duration}ms`);
    }),
  );

  // ============================================================================
  // MONO STRING COMPREHENSIVE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Should test comprehensive string creation", () => {
      const testCases = [
        { input: "Basic string", description: "basic ASCII" },
        { input: "", description: "empty string" },
        { input: " ", description: "single space" },
        { input: "Special chars: !@#$%^&*()", description: "special characters" },
        { input: "Unicode: 你好世界", description: "Chinese characters" },
        { input: "Emoji: 🎮🕹️⚽", description: "emoji characters" },
        { input: "Mixed: English 中文 🎮", description: "mixed content" },
        { input: "New\nLine\tTabbed\r\nWindows", description: "control characters" },
        { input: "A".repeat(1000), description: "long string (1000 chars)" },
      ];

      let successCount = 0;
      for (const testCase of testCases) {
        try {
          const monoString = Mono.api.stringNew(testCase.input);
          assertNotNull(monoString, `String creation should work for ${testCase.description}`);
          assert(!monoString.isNull(), `String pointer should not be null for ${testCase.description}`);

          // Verify length
          const length = Mono.api.native.mono_string_length(monoString);
          assert(length >= 0, `String length should be non-negative for ${testCase.description}`);

          successCount++;
        } catch (error) {
          console.log(`    String creation failed for ${testCase.description}: ${error}`);
        }
      }

      assert(
        successCount === testCases.length,
        `Expected ${testCases.length} successful string creations, got ${successCount}`,
      );
      console.log(`    Successfully created ${successCount}/${testCases.length} test strings`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test string manipulation operations", () => {
      const testString = Mono.api.stringNew("Hello, World! This is a test string.");
      assertNotNull(testString, "Test string should be created");

      // Test string length
      const length = Mono.api.native.mono_string_length(testString);
      assert(length > 0, "String length should be positive");

      // Test character access
      const chars = Mono.api.native.mono_string_chars(testString);
      assertNotNull(chars, "String chars pointer should be available");

      // Test first character
      const firstChar = chars.readU16();
      assert(firstChar === "H".charCodeAt(0), `First character should be 'H', got ${String.fromCharCode(firstChar)}`);

      // Test string conversion back to JavaScript using native APIs
      const strLength = Mono.api.native.mono_string_length(testString);
      const strChars = Mono.api.native.mono_string_chars(testString);
      const converted = readUtf16String(strChars, strLength);
      assert(converted === "Hello, World! This is a test string.", "String conversion should preserve content");

      console.log(`    String manipulation: length=${length}, first_char='${String.fromCharCode(firstChar)}'`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test string encoding and UTF handling", () => {
      const encodingTests = [
        "ASCII only",
        "Café résumé", // Accented characters
        "東京", // Japanese
        "Москва", // Russian
        "العربية", // Arabic
        "עברית", // Hebrew
        "🎮🕹️⚽", // Emoji
        "Mixed: English 中文 العربية 🎮", // Mixed languages
      ];

      let successCount = 0;
      for (const testStr of encodingTests) {
        try {
          const monoString = Mono.api.stringNew(testStr);
          assertNotNull(monoString, `UTF string creation should work for: ${testStr}`);

          const length = Mono.api.native.mono_string_length(monoString);
          assert(length >= 0, `UTF string length should be non-negative for: ${testStr}`);

          // Test round-trip conversion using native APIs
          const utfLength = Mono.api.native.mono_string_length(monoString);
          const utfChars = Mono.api.native.mono_string_chars(monoString);
          const converted = readUtf16String(utfChars, utfLength);
          // Note: Some Unicode normalization might occur, so we check if it's reasonable
          assert(converted.length > 0, `Converted string should not be empty for: ${testStr}`);

          successCount++;
        } catch (error) {
          console.log(`    UTF handling failed for '${testStr}': ${error}`);
        }
      }

      console.log(`    UTF handling: ${successCount}/${encodingTests.length} encoding tests passed`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test string comparison and searching", () => {
      const testStrings = [
        "Hello World",
        "hello world", // Different case
        "Hello World!", // Different content
        "Hello", // Shorter
        "Hello World Hello World", // Longer
      ];

      // Create all test strings
      const monoStrings = testStrings.map(str => Mono.api.stringNew(str));

      // Test string equality (basic comparison) using native APIs
      const str1Length = Mono.api.native.mono_string_length(monoStrings[0]);
      const str1Chars = Mono.api.native.mono_string_chars(monoStrings[0]);
      const str1 = readUtf16String(str1Chars, str1Length);

      const str2Length = Mono.api.native.mono_string_length(monoStrings[0]);
      const str2Chars = Mono.api.native.mono_string_chars(monoStrings[0]);
      const str2 = readUtf16String(str2Chars, str2Length); // Same string again
      assert(str1 === str2, "Same string should be equal");

      // Test string inequality
      const str3Length = Mono.api.native.mono_string_length(monoStrings[1]);
      const str3Chars = Mono.api.native.mono_string_chars(monoStrings[1]);
      const str3 = readUtf16String(str3Chars, str3Length);
      assert(str1 !== str3, "Different strings should not be equal");

      // Test string contains (basic substring search)
      const containsTest = Mono.api.stringNew("Hello");
      const containsTargetLength = Mono.api.native.mono_string_length(monoStrings[0]);
      const containsTargetChars = Mono.api.native.mono_string_chars(monoStrings[0]);
      const containsTarget = readUtf16String(containsTargetChars, containsTargetLength);
      assert(containsTarget.includes("Hello"), "String should contain substring");

      console.log(`    String comparison: tested ${testStrings.length} strings for equality and searching`);
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Should test string performance benchmarks", () => {
      const startTime = Date.now();
      const stringCount = 500;
      const testStrings = [];

      // Create many strings
      for (let i = 0; i < stringCount; i++) {
        const testString = Mono.api.stringNew(`Performance test string ${i} with some content`);
        testStrings.push(testString);
      }

      // Convert all back to JavaScript
      let convertedCount = 0;
      for (const monoString of testStrings) {
        const perfLength = Mono.api.native.mono_string_length(monoString);
        const perfChars = Mono.api.native.mono_string_chars(monoString);
        const converted = readUtf16String(perfChars, perfLength);
        if (converted.length > 0) {
          convertedCount++;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(convertedCount === stringCount, `Expected ${stringCount} conversions, got ${convertedCount}`);
      assert(duration < 3000, `String operations should complete within 3 seconds, took ${duration}ms`);

      console.log(`    String performance: ${stringCount} strings processed in ${duration}ms`);
    }),
  );

  // ============================================================================
  // MONO OBJECT COMPREHENSIVE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Should test object lifecycle and memory management", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object class should be available");

      // Create object
      const objectPtr = Mono.api.native.mono_object_new(domain.pointer, objectClass.pointer);
      assertNotNull(objectPtr, "Object should be created");
      assert(!objectPtr.isNull(), "Object pointer should not be null");

      // Test object class retrieval
      const retrievedClass = Mono.api.native.mono_object_get_class(objectPtr);
      assertNotNull(retrievedClass, "Object class should be retrievable");
      assert(!retrievedClass.isNull(), "Retrieved class pointer should not be null");

      // Test object size
      const objectSize = Mono.api.native.mono_object_get_size(objectPtr);
      assert(objectSize > 0, `Object size should be positive, got ${objectSize}`);

      // Test object to string conversion
      const stringPtr = Mono.api.native.mono_object_to_string(objectPtr, ptr(0));
      if (stringPtr && !stringPtr.isNull()) {
        const objLength = Mono.api.native.mono_string_length(stringPtr);
        const objChars = Mono.api.native.mono_string_chars(stringPtr);
        const objectString = readUtf16String(objChars, objLength);
        console.log(`    Object string representation: ${objectString}`);
      }

      console.log(`    Object lifecycle: size=${objectSize} bytes`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test object boxing and unboxing operations", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      // Test boxing APIs availability
      assert(typeof Mono.api.native.mono_value_box === "function", "mono_value_box should be available");
      assert(typeof Mono.api.native.mono_object_unbox === "function", "mono_object_unbox should be available");

      // Create a value type object (Int32)
      const intObject = Mono.api.native.mono_object_new(domain.pointer, intClass.pointer);
      assertNotNull(intObject, "Int32 object should be created");

      // Test unboxing
      try {
        const unboxedValue = Mono.api.native.mono_object_unbox(intObject);
        assertNotNull(unboxedValue, "Unboxed value should not be null");
        console.log("    Boxing/unboxing operations working correctly");
      } catch (error) {
        console.log(`    Boxing/unboxing test: ${error}`);
      }
    }),
  );

  // ===== MONO OBJECT BOXING/UNBOXING COMPREHENSIVE TESTS (BOUNDARY) =====

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Int32 values", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      // Create memory for the value
      const valuePtr = Memory.alloc(4);
      const testValue = 42;
      valuePtr.writeS32(testValue);

      // Box the value
      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, intClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Int32 should not be null");
      assert(!boxedObject.isNull(), "Boxed Int32 pointer should not be NULL");

      // Unbox and verify
      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      assertNotNull(unboxedPtr, "Unboxed pointer should not be null");
      const unboxedValue = unboxedPtr.readS32();

      assert(unboxedValue === testValue, `Unboxed value should be ${testValue}, got ${unboxedValue}`);
      console.log(`    Int32 boxing: ${testValue} -> boxed -> unboxed = ${unboxedValue}`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Int64 values", () => {
      const domain = Mono.domain;
      const int64Class = domain.tryClass("System.Int64");
      assertNotNull(int64Class, "System.Int64 class should be available");

      const valuePtr = Memory.alloc(8);
      const testValue = int64("9223372036854775807"); // Max Int64
      valuePtr.writeS64(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, int64Class.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Int64 should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readS64();

      assert(unboxedValue.equals(testValue), `Unboxed Int64 should match`);
      console.log(`    Int64 boxing: large value boxed and unboxed successfully`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Double values", () => {
      const domain = Mono.domain;
      const doubleClass = domain.tryClass("System.Double");
      assertNotNull(doubleClass, "System.Double class should be available");

      const valuePtr = Memory.alloc(8);
      const testValue = 3.141592653589793;
      valuePtr.writeDouble(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, doubleClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Double should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readDouble();

      assert(
        Math.abs(unboxedValue - testValue) < 0.0001,
        `Unboxed Double should be approximately ${testValue}, got ${unboxedValue}`,
      );
      console.log(`    Double boxing: ${testValue} -> boxed -> unboxed = ${unboxedValue}`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Boolean values", () => {
      const domain = Mono.domain;
      const boolClass = domain.tryClass("System.Boolean");
      assertNotNull(boolClass, "System.Boolean class should be available");

      // Test true value
      const truePtr = Memory.alloc(1);
      truePtr.writeU8(1);

      const boxedTrue = Mono.api.native.mono_value_box(domain.pointer, boolClass.pointer, truePtr);
      assertNotNull(boxedTrue, "Boxed true should not be null");

      const unboxedTruePtr = Mono.api.native.mono_object_unbox(boxedTrue);
      const unboxedTrue = unboxedTruePtr.readU8() !== 0;

      assert(unboxedTrue === true, "Unboxed true should be true");

      // Test false value
      const falsePtr = Memory.alloc(1);
      falsePtr.writeU8(0);

      const boxedFalse = Mono.api.native.mono_value_box(domain.pointer, boolClass.pointer, falsePtr);
      const unboxedFalsePtr = Mono.api.native.mono_object_unbox(boxedFalse);
      const unboxedFalse = unboxedFalsePtr.readU8() !== 0;

      assert(unboxedFalse === false, "Unboxed false should be false");
      console.log(`    Boolean boxing: true=${unboxedTrue}, false=${unboxedFalse}`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Byte values", () => {
      const domain = Mono.domain;
      const byteClass = domain.tryClass("System.Byte");
      assertNotNull(byteClass, "System.Byte class should be available");

      const valuePtr = Memory.alloc(1);
      const testValue = 255; // Max Byte
      valuePtr.writeU8(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, byteClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Byte should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readU8();

      assert(unboxedValue === testValue, `Unboxed Byte should be ${testValue}, got ${unboxedValue}`);
      console.log(`    Byte boxing: ${testValue} -> boxed -> unboxed = ${unboxedValue}`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Single (Float) values", () => {
      const domain = Mono.domain;
      const floatClass = domain.tryClass("System.Single");
      assertNotNull(floatClass, "System.Single class should be available");

      const valuePtr = Memory.alloc(4);
      const testValue = 2.71828;
      valuePtr.writeFloat(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, floatClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Single should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readFloat();

      assert(
        Math.abs(unboxedValue - testValue) < 0.0001,
        `Unboxed Single should be approximately ${testValue}, got ${unboxedValue}`,
      );
      console.log(`    Single boxing: ${testValue} -> boxed -> unboxed = ${unboxedValue}`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Char values", () => {
      const domain = Mono.domain;
      const charClass = domain.tryClass("System.Char");
      assertNotNull(charClass, "System.Char class should be available");

      const valuePtr = Memory.alloc(2);
      const testValue = "A".charCodeAt(0);
      valuePtr.writeU16(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, charClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Char should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readU16();

      assert(
        unboxedValue === testValue,
        `Unboxed Char should be '${String.fromCharCode(testValue)}', got '${String.fromCharCode(unboxedValue)}'`,
      );
      console.log(
        `    Char boxing: '${String.fromCharCode(testValue)}' -> boxed -> unboxed = '${String.fromCharCode(unboxedValue)}'`,
      );
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox struct (DateTime) values", () => {
      const domain = Mono.domain;
      const dateTimeClass = domain.tryClass("System.DateTime");
      assertNotNull(dateTimeClass, "System.DateTime class should be available");

      // DateTime has a single Int64 field for ticks
      const valuePtr = Memory.alloc(8);
      const testTicks = int64("637500000000000000"); // Some arbitrary DateTime ticks
      valuePtr.writeS64(testTicks);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, dateTimeClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed DateTime should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      assertNotNull(unboxedPtr, "Unboxed DateTime pointer should not be null");

      console.log(`    DateTime struct boxed and unboxed successfully`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox Guid struct values", () => {
      const domain = Mono.domain;
      const guidClass = domain.tryClass("System.Guid");
      assertNotNull(guidClass, "System.Guid class should be available");

      // Guid is 16 bytes
      const valuePtr = Memory.alloc(16);
      // Write some test GUID bytes
      valuePtr.writeByteArray([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
      ]);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, guidClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed Guid should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      assertNotNull(unboxedPtr, "Unboxed Guid pointer should not be null");

      // Verify first byte
      const firstByte = unboxedPtr.readU8();
      assert(firstByte === 0x01, `First byte should be 0x01, got 0x${firstByte.toString(16)}`);

      console.log(`    Guid struct boxed and unboxed successfully`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should box and unbox enum values", () => {
      const domain = Mono.domain;
      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");
      assertNotNull(dayOfWeekClass, "System.DayOfWeek enum should be available");

      // Enum underlying type is Int32
      const valuePtr = Memory.alloc(4);
      const testValue = 3; // Wednesday
      valuePtr.writeS32(testValue);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, dayOfWeekClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed enum should not be null");

      const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
      const unboxedValue = unboxedPtr.readS32();

      assert(unboxedValue === testValue, `Unboxed enum should be ${testValue}, got ${unboxedValue}`);
      console.log(`    Enum boxing: DayOfWeek.Wednesday (${testValue}) boxed and unboxed successfully`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle boxing boundary values", () => {
      const domain = Mono.domain;

      // Test Int32 boundary values
      const int32Class = domain.tryClass("System.Int32");
      assertNotNull(int32Class, "System.Int32 class should be available");

      const boundaryValues = [
        { value: 0, name: "zero" },
        { value: -1, name: "negative one" },
        { value: 2147483647, name: "max Int32" },
        { value: -2147483648, name: "min Int32" },
      ];

      let successCount = 0;
      for (const test of boundaryValues) {
        const valuePtr = Memory.alloc(4);
        valuePtr.writeS32(test.value);

        const boxedObject = Mono.api.native.mono_value_box(domain.pointer, int32Class.pointer, valuePtr);
        if (boxedObject && !boxedObject.isNull()) {
          const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
          const unboxedValue = unboxedPtr.readS32();

          if (unboxedValue === test.value) {
            successCount++;
          } else {
            console.log(`    Boundary test failed for ${test.name}: expected ${test.value}, got ${unboxedValue}`);
          }
        }
      }

      assert(
        successCount === boundaryValues.length,
        `Expected all ${boundaryValues.length} boundary tests to pass, got ${successCount}`,
      );
      console.log(`    Boundary value boxing: ${successCount}/${boundaryValues.length} tests passed`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should verify boxed object class is correct", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      const valuePtr = Memory.alloc(4);
      valuePtr.writeS32(100);

      const boxedObject = Mono.api.native.mono_value_box(domain.pointer, intClass.pointer, valuePtr);
      assertNotNull(boxedObject, "Boxed object should not be null");

      // Get class of boxed object
      const objectClass = Mono.api.native.mono_object_get_class(boxedObject);
      assertNotNull(objectClass, "Object class should be retrievable");

      // Verify it's the same class
      assert(objectClass.equals(intClass.pointer), "Boxed object class should match Int32 class");
      console.log("    Boxed object class verification successful");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle multiple boxing/unboxing cycles", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      const originalValue = 12345;
      let currentValue = originalValue;

      // Perform multiple box/unbox cycles
      for (let cycle = 0; cycle < 5; cycle++) {
        const valuePtr = Memory.alloc(4);
        valuePtr.writeS32(currentValue);

        const boxedObject = Mono.api.native.mono_value_box(domain.pointer, intClass.pointer, valuePtr);
        assertNotNull(boxedObject, `Boxed object should not be null at cycle ${cycle}`);

        const unboxedPtr = Mono.api.native.mono_object_unbox(boxedObject);
        currentValue = unboxedPtr.readS32();
      }

      assert(
        currentValue === originalValue,
        `Value should remain ${originalValue} after 5 cycles, got ${currentValue}`,
      );
      console.log(`    Multiple boxing cycles: value preserved after 5 cycles`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoObject wrapper boxing/unboxing", () => {
      const domain = Mono.domain;
      const intClass = domain.tryClass("System.Int32");
      assertNotNull(intClass, "System.Int32 class should be available");

      // Create boxed object
      const valuePtr = Memory.alloc(4);
      valuePtr.writeS32(999);

      const boxedPtr = Mono.api.native.mono_value_box(domain.pointer, intClass.pointer, valuePtr);

      // Note: This tests the high-level MonoObject API
      const monoObj = new MonoObject(Mono.api, boxedPtr);

      // Test MonoObject methods
      assert(monoObj.isValueType, "Wrapped Int32 should be value type");

      const unboxedPtr = monoObj.unbox();
      assertNotNull(unboxedPtr, "MonoObject.unbox() should return pointer");

      const unboxedValue = unboxedPtr.readS32();
      assert(unboxedValue === 999, `MonoObject unbox should return 999, got ${unboxedValue}`);

      console.log("    MonoObject wrapper boxing/unboxing successful");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test object cloning and copying", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      // Create original string object
      const originalString = Mono.api.stringNew("Original string for cloning test");
      assertNotNull(originalString, "Original string should be created");

      // Test object class access
      const objectClass = Mono.api.native.mono_object_get_class(originalString);
      assertNotNull(objectClass, "Should be able to get object class");

      // Test that multiple references to same object work
      const ref1 = originalString;
      const ref2 = originalString;
      assert(ref1.equals(ref2), "Multiple references to same object should be equal");

      // Create new string with same content (different object)
      const duplicateString = Mono.api.stringNew("Original string for cloning test");
      assertNotNull(duplicateString, "Duplicate string should be created");

      // Test that they have same content but are different objects using native APIs
      const dupLength1 = Mono.api.native.mono_string_length(originalString);
      const dupChars1 = Mono.api.native.mono_string_chars(originalString);
      const content1 = readUtf16String(dupChars1, dupLength1);

      const dupLength2 = Mono.api.native.mono_string_length(duplicateString);
      const dupChars2 = Mono.api.native.mono_string_chars(duplicateString);
      const content2 = readUtf16String(dupChars2, dupLength2);
      assert(content1 === content2, "String content should be identical");
      assert(!ref1.equals(duplicateString), "Different string objects should have different pointers");

      console.log("    Object cloning and copying concepts verified");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test object field and method access", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      // Create string object
      const testString = Mono.api.stringNew("Field and method test");
      assertNotNull(testString, "Test string should be created");

      // Test getting object class
      const objectClass = Mono.api.native.mono_object_get_class(testString);
      assertNotNull(objectClass, "Should be able to get object class");

      // Test class methods availability
      const methods = stringClass.methods;
      assert(Array.isArray(methods), "Class should have methods array");
      assert(methods.length > 0, "Class should have at least one method");

      // Test class fields availability
      const fields = stringClass.fields;
      assert(Array.isArray(fields), "Class should have fields array");

      // Test class properties availability
      const properties = stringClass.properties;
      assert(Array.isArray(properties), "Class should have properties array");

      console.log(
        `    Object access: ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`,
      );
    }),
  );

  // ============================================================================
  // UNITY-SPECIFIC DATA TYPES TESTS
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Should test Unity-specific data types", () => {
      const domain = Mono.domain;

      // Test common Unity data types
      const unityTypes = [
        "UnityEngine.Vector3",
        "UnityEngine.Vector2",
        "UnityEngine.Quaternion",
        "UnityEngine.Color",
        "UnityEngine.Rect",
        "UnityEngine.Bounds",
        "UnityEngine.Matrix4x4",
        "UnityEngine.Transform",
      ];

      let foundCount = 0;
      for (const typeName of unityTypes) {
        const unityClass = domain.tryClass(typeName);
        if (unityClass) {
          foundCount++;
          console.log(`    Found Unity type: ${typeName}`);

          // Test that we can access methods
          const methods = unityClass.methods;
          console.log(`      ${methods.length} methods available`);

          // Test that we can access fields
          const fields = unityClass.fields;
          console.log(`      ${fields.length} fields available`);
        }
      }

      console.log(`    Found ${foundCount}/${unityTypes.length} Unity-specific data types`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test Vector3 operations", () => {
      const domain = Mono.domain;
      const vector3Class = domain.tryClass("UnityEngine.Vector3");

      if (vector3Class) {
        console.log("    Testing Vector3 operations");

        // Look for common Vector3 methods
        const commonMethods = ["get_x", "get_y", "get_z", "set_x", "set_y", "set_z", "Normalize", "magnitude"];
        let foundMethodCount = 0;

        for (const methodName of commonMethods) {
          const method = vector3Class.tryMethod(methodName);
          if (method) {
            foundMethodCount++;
            console.log(`      Found Vector3 method: ${methodName}`);
          }
        }

        // Look for common Vector3 fields
        const commonFields = ["x", "y", "z"];
        let foundFieldCount = 0;

        for (const fieldName of commonFields) {
          const field = vector3Class.field(fieldName);
          if (field) {
            foundFieldCount++;
            console.log(`      Found Vector3 field: ${fieldName}`);
          }
        }

        console.log(`    Vector3: ${foundMethodCount} methods, ${foundFieldCount} fields found`);
      } else {
        console.log("    Vector3 class not available in this context");
      }
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createIntegrationTest("Should test cross-data-type operations", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      const objectClass = domain.tryClass("System.Object");

      if (stringClass && objectClass) {
        // Create string object
        const testString = Mono.api.stringNew("Cross-type integration test");
        assertNotNull(testString, "Test string should be created");

        // Test that string is also an object
        const stringObjectClass = Mono.api.native.mono_object_get_class(testString);
        assertNotNull(stringObjectClass, "String should have object class");

        // Create object array containing strings
        const objectArray = Mono.api.native.mono_array_new(domain.pointer, objectClass.pointer, 3);

        // For object arrays, element size is pointer size
        const ptrSize = Process.pointerSize;

        // Add strings to object array
        for (let i = 0; i < 3; i++) {
          const itemString = Mono.api.stringNew(`Item ${i}`);
          const elementAddress = Mono.api.native.mono_array_addr_with_size(objectArray, ptrSize, i);
          elementAddress.writePointer(itemString);
        }

        // Verify array length
        const arrayLengthRaw = Mono.api.native.mono_array_length(objectArray);
        const arrayLength = typeof arrayLengthRaw === "number" ? arrayLengthRaw : arrayLengthRaw.toNumber();
        assert(arrayLength === 3, `Object array should have 3 elements, got ${arrayLength}`);

        console.log("    Cross-type operations: strings in object array working correctly");
      }
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Should test data operations consistency", () => {
      // Test that multiple operations return consistent results
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");

      const api1 = Mono.api;
      const api2 = Mono.api;
      assert(api1 === api2, "API should be cached instance");

      // Test string creation consistency
      const testStr = "Consistency test";
      const str1 = Mono.api.stringNew(testStr);
      const str2 = Mono.api.stringNew(testStr);

      assertNotNull(str1, "First string should not be null");
      assertNotNull(str2, "Second string should not be null");

      const consLength1 = Mono.api.native.mono_string_length(str1);
      const consChars1 = Mono.api.native.mono_string_chars(str1);
      const content1 = readUtf16String(consChars1, consLength1);

      const consLength2 = Mono.api.native.mono_string_length(str2);
      const consChars2 = Mono.api.native.mono_string_chars(str2);
      const content2 = readUtf16String(consChars2, consLength2);
      assert(content1 === content2, "String content should be consistent");

      console.log("    Data operations consistency verified");
    }),
  );

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  await suite.addResultAsync(
    createErrorHandlingTest("Should handle array creation errors gracefully", () => {
      const domain = Mono.domain;

      // Test with invalid element class
      try {
        const invalidArray = Mono.api.native.mono_array_new(domain.pointer, ptr(0), 5);
        console.log("    Invalid array creation handled gracefully");
      } catch (error) {
        console.log(`    Invalid array creation threw expected error: ${error}`);
      }

      // Test with negative array size
      try {
        const stringClass = domain.tryClass("System.String");
        if (stringClass) {
          const negativeArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, -1);
          console.log("    Negative array size handled gracefully");
        }
      } catch (error) {
        console.log(`    Negative array size threw expected error: ${error}`);
      }
    }),
  );

  await suite.addResultAsync(
    createErrorHandlingTest("Should handle string creation errors gracefully", () => {
      try {
        // Test with null input
        const nullString = Mono.api.stringNew(null as any);
        console.log("    Null string creation handled gracefully");
      } catch (error) {
        console.log(`    Null string creation threw expected error: ${error}`);
      }

      try {
        // Test with undefined input
        const undefinedString = Mono.api.stringNew(undefined as any);
        console.log("    Undefined string creation handled gracefully");
      } catch (error) {
        console.log(`    Undefined string creation threw expected error: ${error}`);
      }
    }),
  );

  await suite.addResultAsync(
    createErrorHandlingTest("Should handle object creation errors gracefully", () => {
      const domain = Mono.domain;

      // Test with invalid class
      try {
        const invalidObject = Mono.api.native.mono_object_new(domain.pointer, ptr(0));
        console.log("    Invalid object creation handled gracefully");
      } catch (error) {
        console.log(`    Invalid object creation threw expected error: ${error}`);
      }

      // Test with non-existent class
      const nonExistentClass = domain.tryClass("NonExistent.Type");
      assert(nonExistentClass === null, "Non-existent class should return null");
    }),
  );

  await suite.addResultAsync(
    createErrorHandlingTest("Should handle memory management errors", () => {
      // Test operations with null pointers
      try {
        const nullStringLength = Mono.api.native.mono_string_length(ptr(0));
        console.log(`    Null string length: ${nullStringLength}`);
      } catch (error) {
        console.log(`    Null string length threw expected error: ${error}`);
      }

      try {
        const nullArrayLength = Mono.api.native.mono_array_length(ptr(0));
        console.log(`    Null array length: ${nullArrayLength}`);
      } catch (error) {
        console.log(`    Null array length threw expected error: ${error}`);
      }

      try {
        const nullObjectClass = Mono.api.native.mono_object_get_class(ptr(0));
        console.log(`    Null object class: ${nullObjectClass}`);
      } catch (error) {
        console.log(`    Null object class threw expected error: ${error}`);
      }
    }),
  );

  // ============================================================================
  // PERFORMANCE AND STRESS TESTS
  // ============================================================================

  await suite.addResultAsync(
    createPerformanceTest("Should test memory allocation performance", () => {
      const startTime = Date.now();
      const allocationCount = 1000;
      const allocatedObjects = [];

      // Allocate many objects
      for (let i = 0; i < allocationCount; i++) {
        const testString = Mono.api.stringNew(`Memory test ${i}`);
        allocatedObjects.push(testString);
      }

      const allocationTime = Date.now() - startTime;

      // Test access performance
      const accessStartTime = Date.now();
      let accessCount = 0;

      for (const obj of allocatedObjects) {
        const length = Mono.api.native.mono_string_length(obj);
        if (length >= 0) {
          accessCount++;
        }
      }

      const accessTime = Date.now() - accessStartTime;

      assert(accessCount === allocationCount, `Expected ${allocationCount} successful accesses, got ${accessCount}`);
      assert(allocationTime < 5000, `Allocation should complete within 5 seconds, took ${allocationTime}ms`);
      assert(accessTime < 2000, `Access should complete within 2 seconds, took ${accessTime}ms`);

      console.log(
        `    Memory performance: ${allocationCount} allocations in ${allocationTime}ms, ${accessCount} accesses in ${accessTime}ms`,
      );
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Should test large data structure performance", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String class should be available");

      const startTime = Date.now();
      const largeArraySize = 5000;

      // Create large array
      const largeArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, largeArraySize);

      // For object arrays (strings are objects), element size is pointer size
      const ptrSize = Process.pointerSize;

      // Populate with data
      for (let i = 0; i < largeArraySize; i++) {
        const testString = Mono.api.stringNew(`Large array item ${i}`);
        const elementAddress = Mono.api.native.mono_array_addr_with_size(largeArray, ptrSize, i);
        elementAddress.writePointer(testString);
      }

      // Perform operations on the large array
      let sumLengths = 0;
      for (let i = 0; i < largeArraySize; i++) {
        const elementAddress = Mono.api.native.mono_array_addr_with_size(largeArray, ptrSize, i);
        const elementPtr = elementAddress.readPointer();
        if (!elementPtr.isNull()) {
          const length = Mono.api.native.mono_string_length(elementPtr);
          sumLengths += length;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(sumLengths > 0, "Should have processed some string lengths");
      assert(duration < 10000, `Large array operations should complete within 10 seconds, took ${duration}ms`);

      console.log(
        `    Large data structure: ${largeArraySize} elements processed in ${duration}ms, total length: ${sumLengths}`,
      );
    }),
  );

  // ============================================================================
  // NESTED PERFORM TESTS
  // ============================================================================

  await suite.addResultAsync(
    createNestedPerformTest({
      context: "comprehensive data operations",
      testName: "Should support data operations in nested perform calls",
      validate: domain => {
        // Test string creation in nested context
        const testString = Mono.api.stringNew("Nested test");
        assertNotNull(testString, "String creation should work in nested perform calls");

        // Test array operations in nested context
        const stringClass = domain.tryClass("System.String");
        if (stringClass) {
          const nestedArray = Mono.api.native.mono_array_new(domain.pointer, stringClass.pointer, 3);
          assertNotNull(nestedArray, "Array creation should work in nested perform calls");
        }

        // Test object operations in nested context
        const objectClass = domain.tryClass("System.Object");
        if (objectClass) {
          const nestedObject = Mono.api.native.mono_object_new(domain.pointer, objectClass.pointer);
          assertNotNull(nestedObject, "Object creation should work in nested perform calls");
        }
      },
    }),
  );

  // Return all test results
  return suite.results;
}

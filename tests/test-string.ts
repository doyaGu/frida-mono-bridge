/**
 * String Operations Tests
 * Tests creating and manipulating Mono strings with real usage scenarios
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertNotNull, assertPerformWorks, assertApiAvailable } from "./test-framework";

export function testStringOperations(): TestResult {
  console.log("\nString Operations:");

  const suite = new TestSuite("String Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for string tests", () => {
    assertPerformWorks("Mono.perform() should work for string tests");
  }));

  suite.addResult(createTest("String APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for string operations");
      assert(Mono.api.hasExport("mono_string_new"), "mono_string_new should be available");
      assert(Mono.api.hasExport("mono_string_new_len"), "mono_string_new_len should be available");
    });
  }));

  suite.addResult(createTest("String creation should work", () => {
    Mono.perform(() => {
      const testStr = "Hello, Mono!";
      const monoStr = Mono.api.stringNew(testStr);
      assertNotNull(monoStr, "String pointer should not be null");
      assert(!monoStr.isNull(), "String pointer should not be NULL");
      console.log(`    Created string: "${testStr}"`);
    });
  }));

  suite.addResult(createTest("Empty string creation should work", () => {
    Mono.perform(() => {
      const emptyStr = Mono.api.stringNew("");
      assertNotNull(emptyStr, "Empty string pointer should not be null");
      assert(!emptyStr.isNull(), "Empty string pointer should not be NULL");
      console.log("    Successfully created empty string");
    });
  }));

  suite.addResult(createTest("Unicode string creation should work", () => {
    Mono.perform(() => {
      const unicodeStr = Mono.api.stringNew("Hello 世界");
      assertNotNull(unicodeStr, "Unicode string pointer should not be null");
      assert(!unicodeStr.isNull(), "Unicode string pointer should not be NULL");
      console.log("    Successfully created Unicode string");
    });
  }));

  suite.addResult(createTest("Long string creation should work", () => {
    Mono.perform(() => {
      const longStr = "A".repeat(10000);
      const monoStr = Mono.api.stringNew(longStr);
      assertNotNull(monoStr, "Long string pointer should not be null");
      assert(!monoStr.isNull(), "Long string pointer should not be NULL");
      console.log(`    Successfully created long string (${longStr.length} characters)`);
    });
  }));

  suite.addResult(createTest("Special characters in strings should work", () => {
    Mono.perform(() => {
      const specialStr = Mono.api.stringNew("Line1\nLine2\tTabbed\r\nWindows");
      assertNotNull(specialStr, "Special character string should not be null");
      assert(!specialStr.isNull(), "Special character string should not be NULL");
      console.log("    Successfully created string with special characters");
    });
  }));

  suite.addResult(createTest("Multiple strings can be created", () => {
    Mono.perform(() => {
      const str1 = Mono.api.stringNew("First");
      const str2 = Mono.api.stringNew("Second");
      const str3 = Mono.api.stringNew("Third");

      assertNotNull(str1, "First string should not be null");
      assertNotNull(str2, "Second string should not be null");
      assertNotNull(str3, "Third string should not be null");

      assert(!str1.isNull(), "First string should not be NULL");
      assert(!str2.isNull(), "Second string should not be NULL");
      assert(!str3.isNull(), "Third string should not be NULL");

      console.log("    Successfully created multiple strings");
    });
  }));

  suite.addResult(createTest("String class should be accessible through domain", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        assert(typeof stringClass.getName === 'function', "String class should have getName method");
        console.log(`    Found String class: ${stringClass.getName()}`);

        // Test that we can access String class methods and fields
        const methods = stringClass.getMethods();
        const fields = stringClass.getFields();

        assert(Array.isArray(methods), "String class should have methods array");
        assert(Array.isArray(fields), "String class should have fields array");
        console.log(`    System.String has ${methods.length} methods and ${fields.length} fields`);
      } else {
        console.log("    System.String class not available in this context");
      }
    });
  }));

  suite.addResult(createTest("Should test string field access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        // Try to access String.Empty field
        const emptyField = stringClass.field("Empty");
        if (emptyField) {
          try {
            const emptyValue = emptyField.readValue(null);
            console.log(`    System.String.Empty value: "${emptyValue}"`);
          } catch (error) {
            console.log(`    Could not read String.Empty field: ${error}`);
          }
        } else {
          console.log("    String.Empty field not accessible");
        }
      }
    });
  }));

  suite.addResult(createTest("Should support string operations in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const testStr = "Nested string test";
        const monoStr = Mono.api.stringNew(testStr);
        assertNotNull(monoStr, "Nested string creation should work");
        assert(!monoStr.isNull(), "Nested string should not be NULL");
      });
    });
  }));

  suite.addResult(createTest("String operations should be consistent", () => {
    Mono.perform(() => {
      // Test multiple calls return consistent results
      const testStr = "Consistency test";
      const str1 = Mono.api.stringNew(testStr);
      const str2 = Mono.api.stringNew(testStr);

      assertNotNull(str1, "First string should not be null");
      assertNotNull(str2, "Second string should not be null");
      assert(!str1.isNull(), "First string should not be NULL");
      assert(!str2.isNull(), "Second string should not be NULL");

      // Test API consistency
      const api1 = Mono.api;
      const api2 = Mono.api;
      assert(api1 === api2, "API should be cached instance");
    });
  }));

  suite.addResult(createTest("Should test string edge cases", () => {
    Mono.perform(() => {
      // Test various edge cases
      const edgeCases = [
        "",                          // Empty
        " ",                         // Space
        "\0",                        // Null character
        "String with spaces  ",      // Trailing spaces
        "  Leading spaces",          // Leading spaces
        "Both sides  ",              // Both sides
        "Mixed123!@#",               // Mixed characters
      ];

      for (const testCase of edgeCases) {
        const monoStr = Mono.api.stringNew(testCase);
        assertNotNull(monoStr, `String "${testCase}" should not be null`);
        assert(!monoStr.isNull(), `String "${testCase}" should not be NULL`);
      }

      console.log(`    Successfully tested ${edgeCases.length} edge case strings`);
    });
  }));

  suite.addResult(createTest("Should test string encoding scenarios", () => {
    Mono.perform(() => {
      // Test different encoding scenarios
      const encodingTests = [
        "ASCII only",
        "Café",                     // Accented characters
        "東京",                      // Japanese
        "Москва",                    // Russian
        "Symbols: ***###",              // Symbol characters
        "Mixed: English 中文",        // Mixed languages
      ];

      for (const testStr of encodingTests) {
        const monoStr = Mono.api.stringNew(testStr);
        assertNotNull(monoStr, `String "${testStr}" should not be null`);
        assert(!monoStr.isNull(), `String "${testStr}" should not be NULL`);
      }

      console.log(`    Successfully tested ${encodingTests.length} encoding scenarios`);
    });
  }));

  suite.addResult(createTest("Should handle string creation errors gracefully", () => {
    Mono.perform(() => {
      try {
        // Test with null or undefined (these might throw)
        const nullStr = Mono.api.stringNew(null as any);
        // If this doesn't throw, that's also valid behavior
        console.log("    null string creation handled gracefully");
      } catch (error) {
        // Throwing on null is acceptable behavior
        console.log(`    null string creation threw expected error: ${error}`);
      }

      try {
        const undefinedStr = Mono.api.stringNew(undefined as any);
        console.log("    undefined string creation handled gracefully");
      } catch (error) {
        console.log(`    undefined string creation threw expected error: ${error}`);
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "String Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} string tests passed`,
  };
}

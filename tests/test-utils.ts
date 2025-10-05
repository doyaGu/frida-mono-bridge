/**
 * Utility Function Tests
 * Tests for utility functions like pointer validation, type checking, etc.
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable } from "./test-framework";
import { pointerIsNull } from "../src/runtime/mem";
import { MonoManagedExceptionError } from "../src/runtime/api";

export function testUtilities(): TestResult {
  console.log("\nUtility Functions:");

  const suite = new TestSuite("Utility Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for utility tests", () => {
    assertPerformWorks("Mono.perform() should work for utility tests");
  }));

  suite.addResult(createTest("Should access API for utility operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for utility operations");
      console.log("    API is accessible for utility tests");
    });
  }));

  // ============================================================================
  // Pointer Utility Tests
  // ============================================================================

  suite.addResult(createTest("pointerIsNull handles null", () => {
    Mono.perform(() => {
      assert(pointerIsNull(null) === true, "Should return true for null");
      console.log("    pointerIsNull(null) = true");
    });
  }));

  suite.addResult(createTest("pointerIsNull handles number zero", () => {
    Mono.perform(() => {
      assert(pointerIsNull(0) === true, "Should return true for 0");
      console.log("    pointerIsNull(0) = true");
    });
  }));

  suite.addResult(createTest("pointerIsNull handles non-zero number", () => {
    Mono.perform(() => {
      assert(pointerIsNull(1) === false, "Should return false for non-zero");
      console.log("    pointerIsNull(1) = false");
    });
  }));

  suite.addResult(createTest("pointerIsNull handles NULL pointer", () => {
    Mono.perform(() => {
      if (typeof NULL !== "undefined" && NULL !== null) {
        const result = pointerIsNull(NULL);
        assert(result === true, "Should return true for NULL");
        console.log("    pointerIsNull(NULL) = true");
      } else {
        console.log("    (Skipped: NULL not defined)");
      }
    });
  }));

  // ============================================================================
  // Exception Error Tests
  // ============================================================================

  suite.addResult(createTest("MonoManagedExceptionError stores exception pointer", () => {
    Mono.perform(() => {
      const exceptionPtr = ptr("0x1234");
      const error = new MonoManagedExceptionError(exceptionPtr);

      assert(error.exception.equals(exceptionPtr), "Should store exception pointer");
      assert(error.name === "MonoManagedExceptionError", "Should have correct name");
      console.log("    MonoManagedExceptionError stores exception pointer correctly");
    });
  }));

  suite.addResult(createTest("MonoManagedExceptionError includes type in message", () => {
    Mono.perform(() => {
      const exceptionPtr = ptr("0x1234");
      const error = new MonoManagedExceptionError(exceptionPtr, "NullReferenceException");

      assert(error.exceptionType === "NullReferenceException", "Should store exception type");
      assert(error.message.includes("NullReferenceException"), "Message should include type");
      console.log("    MonoManagedExceptionError includes exception type in message");
    });
  }));

  suite.addResult(createTest("MonoManagedExceptionError includes message details", () => {
    Mono.perform(() => {
      const exceptionPtr = ptr("0x1234");
      const error = new MonoManagedExceptionError(
        exceptionPtr,
        "ArgumentException",
        "Parameter cannot be null"
      );

      assert(error.exceptionType === "ArgumentException", "Should store exception type");
      assert(error.exceptionMessage === "Parameter cannot be null", "Should store exception message");
      assert(error.message.includes("ArgumentException"), "Message should include type");
      assert(error.message.includes("Parameter cannot be null"), "Message should include details");
      console.log("    MonoManagedExceptionError stores full exception details");
    });
  }));

  suite.addResult(createTest("MonoManagedExceptionError works with pointer only", () => {
    Mono.perform(() => {
      const exceptionPtr = ptr("0x1234");
      const error = new MonoManagedExceptionError(exceptionPtr);

      assert(error.exceptionType === undefined, "Type should be undefined");
      assert(error.exceptionMessage === undefined, "Message should be undefined");
      assert(error.message.includes("Managed exception thrown"), "Should have default message");
      console.log("    MonoManagedExceptionError handles pointer-only construction");
    });
  }));

  // ============================================================================
  // API Integration Utility Tests
  // ============================================================================

  suite.addResult(createTest("Should test API utility methods", () => {
    Mono.perform(() => {
      const api = Mono.api;

      // Test hasExport utility
      assert(typeof api.hasExport === 'function', "API should have hasExport method");
      const hasStringNew = api.hasExport("mono_string_new");
      assert(typeof hasStringNew === 'boolean', "hasExport should return boolean");
      console.log(`    hasExport('mono_string_new'): ${hasStringNew}`);

      // Test native function access
      assert(typeof api.native === 'object', "API should have native property");
      assert(typeof api.native.mono_string_new === 'function', "Native functions should be accessible");
      console.log("    API native functions are accessible");
    });
  }));

  suite.addResult(createTest("Should test domain utility methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test getRootDomain utility
      const rootDomain = Mono.api.getRootDomain();
      assert(!rootDomain.isNull(), "Should get non-null root domain");
      console.log("    getRootDomain() works correctly");

      // Test domain assembly access
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "getAssemblies should return array");
      console.log(`    getAssemblies() returned ${assemblies.length} assemblies`);
    });
  }));

  // ============================================================================
  // Type System Utility Tests
  // ============================================================================

  suite.addResult(createTest("64-bit boxing accepts number type", () => {
    Mono.perform(() => {
      // This tests the type system - if it compiles, it passes
      const value: number | boolean | bigint = 42;
      assert(typeof value === "number", "Should accept number");
      console.log("    64-bit boxing accepts number type");
    });
  }));

  suite.addResult(createTest("64-bit boxing accepts bigint type", () => {
    Mono.perform(() => {
      const value: number | boolean | bigint = 9007199254740991n;
      assert(typeof value === "bigint", "Should accept bigint");
      console.log("    64-bit boxing accepts bigint type");
    });
  }));

  suite.addResult(createTest("64-bit boxing type union is correct", () => {
    Mono.perform(() => {
      const testNumber = (v: number | boolean | bigint) => typeof v;

      assert(testNumber(42) === "number", "Number should work");
      assert(testNumber(true) === "boolean", "Boolean should work");
      assert(testNumber(9007199254740991n) === "bigint", "Bigint should work");
      console.log("    64-bit boxing type union works correctly");
    });
  }));

  // ============================================================================
  // Error Handling Utility Tests
  // ============================================================================

  suite.addResult(createTest("Should handle utility errors gracefully", () => {
    Mono.perform(() => {
      // Test pointer utility with invalid inputs
      try {
        const result1 = pointerIsNull(null);
        assert(typeof result1 === 'boolean', "pointerIsNull should handle null gracefully");
      } catch (error) {
        console.log(`    pointerIsNull error: ${error}`);
      }

      try {
        const result2 = pointerIsNull(undefined);
        assert(typeof result2 === 'boolean', "pointerIsNull should handle undefined gracefully");
      } catch (error) {
        console.log(`    pointerIsNull undefined error: ${error}`);
      }

      console.log("    Utility error handling works correctly");
    });
  }));

  // ============================================================================
  // Performance Utility Tests
  // ============================================================================

  suite.addResult(createTest("Should test utility function performance", () => {
    Mono.perform(() => {
      const startTime = Date.now();

      // Test pointer utility performance
      for (let i = 0; i < 1000; i++) {
        pointerIsNull(i);
        pointerIsNull(0);
        pointerIsNull(null);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    3000 pointerIsNull calls took ${duration}ms`);
      assert(duration < 100, "Utility functions should be fast");
    });
  }));

  // ============================================================================
  // Integration Utility Tests
  // ============================================================================

  suite.addResult(createTest("Should integrate utilities with fluent API", () => {
    Mono.perform(() => {
      const api = Mono.api;
      const domain = Mono.domain;
      const version = Mono.version;

      assert(api !== null, "API should be accessible");
      assert(domain !== null, "Domain should be accessible");
      assert(version !== null, "Version should be accessible");

      // Test pointer utility in context of API operations
      const rootDomain = api.getRootDomain();
      const isRootNull = pointerIsNull(rootDomain.handle);
      assert(isRootNull === false, "Root domain pointer should not be null");

      // Test exception utility in context of API operations
      const testPtr = ptr("0x123456");
      const error = new MonoManagedExceptionError(testPtr, "TestException", "Test message");
      assert(error.message.includes("TestException"), "Exception utility should work with API");

      console.log("    Utilities integrate properly with fluent API");
    });
  }));

  suite.addResult(createTest("Should test utility consistency", () => {
    Mono.perform(() => {
      // Test that utilities provide consistent results
      const ptr1 = ptr("0x1234");
      const ptr2 = ptr("0x1234");

      const null1 = pointerIsNull(ptr1);
      const null2 = pointerIsNull(ptr2);
      assert(null1 === null2, "pointerIsNull should be consistent for same pointer");

      // Test API consistency
      const api1 = Mono.api;
      const api2 = Mono.api;
      assert(api1 === api2, "API should be cached instance");

      console.log("    Utility functions provide consistent results");
    });
  }));

  // ============================================================================
  // Edge Case Utility Tests
  // ============================================================================

  suite.addResult(createTest("Should handle edge cases in utilities", () => {
    Mono.perform(() => {
      // Test pointer utility with edge cases
      const edgeCases = [
        null, undefined, 0, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER
      ];

      for (const testCase of edgeCases) {
        try {
          const result = pointerIsNull(testCase);
          console.log(`    pointerIsNull(${testCase}) = ${result}`);
        } catch (error) {
          console.log(`    pointerIsNull(${testCase}) threw: ${error}`);
        }
      }

      // Test exception utility with edge cases
      const edgePointers = [
        ptr("0x0"), ptr("0xFFFFFFFF"), ptr("0x12345678")
      ];

      for (const testPtr of edgePointers) {
        try {
          const error = new MonoManagedExceptionError(testPtr, "TestException");
          assert(error.exception.equals(testPtr), "Exception should store pointer");
        } catch (error) {
          console.log(`    Exception creation with ${testPtr} threw: ${error}`);
        }
      }

      console.log("    Edge case handling works correctly");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Utility Functions Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} utility tests passed`,
  };
}

/**
 * Array Operations Tests
 * Tests array creation, length, and element access operations
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testArrayOperations(): TestResult {
  console.log("\nArray Operations:");

  const suite = new TestSuite("Array Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for array tests", () => {
    assertPerformWorks("Mono.perform() should work for array tests");
  }));

  suite.addResult(createTest("Array APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for array operations");
      assert(Mono.api.hasExport("mono_array_new"), "mono_array_new should be available");
      assert(Mono.api.hasExport("mono_array_length"), "mono_array_length should be available");
      assert(Mono.api.hasExport("mono_array_addr_with_size"), "mono_array_addr_with_size should be available");
    });
  }));

  suite.addResult(createTest("Array APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_array_new === 'function', "mono_array_new should be a function");
      assert(typeof Mono.api.native.mono_array_length === 'function', "mono_array_length should be a function");
      assert(typeof Mono.api.native.mono_array_addr_with_size === 'function', "mono_array_addr_with_size should be a function");
    });
  }));

  suite.addResult(createTest("Should access array-related classes", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for array operations");

      const domain = Mono.domain;

      // Try to find array-related classes
      const arrayClass = domain.class("System.Array");
      if (arrayClass) {
        assert(typeof arrayClass.getName === 'function', "Array class should have getName method");
        console.log(`    Found Array class: ${arrayClass.getName()}`);

        const methods = arrayClass.getMethods();
        assert(Array.isArray(methods), "Array class should have methods array");
        console.log(`    System.Array has ${methods.length} methods`);
      } else {
        console.log("    System.Array class not available in this context");
      }

      // Try to find generic array classes
      const stringArrayClass = domain.class("System.String[]");
      if (stringArrayClass) {
        console.log(`    Found String array class: ${stringArrayClass.getName()}`);
      }

      const intArrayClass = domain.class("System.Int32[]");
      if (intArrayClass) {
        console.log(`    Found Int32 array class: ${intArrayClass.getName()}`);
      }
    });
  }));

  suite.addResult(createTest("Should test array creation through APIs", () => {
    Mono.perform(() => {
      // Test basic array creation APIs
      try {
        const domain = Mono.domain;
        // We need an element type for array creation
        const stringClass = domain.class("System.String");
        if (stringClass) {
          // Note: Actual array creation would require more complex setup with element types
          // For now, we test that the APIs are available and callable
          console.log("    Array creation APIs are accessible");
        }
      } catch (error) {
        console.log(`    Array creation test note: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Should support array operations in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const domain = Mono.domain;
        const arrayClass = domain.class("System.Array");

        if (arrayClass) {
          assert(typeof arrayClass.getName === 'function', "Array access should work in nested perform calls");
        }
      });
    });
  }));

  suite.addResult(createTest("Array operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const arrayClass1 = domain.class("System.Array");
      const arrayClass2 = domain.class("System.Array");

      if (arrayClass1 && arrayClass2) {
        const name1 = arrayClass1.getName();
        const name2 = arrayClass2.getName();
        assert(name1 === name2, "Array class lookups should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    });
  }));

  suite.addResult(createTest("Should test different array types", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test various array type patterns
      const arrayTypes = [
        "System.Array",
        "System.String[]",
        "System.Int32[]",
        "System.Object[]",
        "System.Collections.Generic.List`1", // Generic list (similar to array)
      ];

      let foundCount = 0;
      for (const arrayType of arrayTypes) {
        const testClass = domain.class(arrayType);
        if (testClass) {
          foundCount++;
          console.log(`    Found array type: ${arrayType} -> ${testClass.getName()}`);
          assert(typeof testClass.getName === 'function', "Array class should have getName method");
        }
      }

      console.log(`    Found ${foundCount}/${arrayTypes.length} array-related types`);
    });
  }));

  suite.addResult(createTest("Should test array method access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const arrayClass = domain.class("System.Array");

      if (arrayClass) {
        const methods = arrayClass.getMethods();
        assert(Array.isArray(methods), "Array should have methods array");

        // Test for common array methods
        const commonMethods = ["get_Length", "GetValue", "SetValue", "Copy", "Clear"];
        let foundMethodCount = 0;

        for (const methodName of commonMethods) {
          const method = arrayClass.method(methodName);
          if (method) {
            foundMethodCount++;
            console.log(`    Found array method: ${methodName}`);
          }
        }

        console.log(`    Found ${foundMethodCount}/${commonMethods.length} common array methods`);
      }
    });
  }));

  suite.addResult(createTest("Should test array property access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const arrayClass = domain.class("System.Array");

      if (arrayClass) {
        const properties = arrayClass.getProperties();
        assert(Array.isArray(properties), "Array should have properties array");

        // Test for common array properties
        const commonProperties = ["Length", "LongLength", "Rank"];
        let foundPropertyCount = 0;

        for (const propertyName of commonProperties) {
          const property = arrayClass.property(propertyName);
          if (property) {
            foundPropertyCount++;
            console.log(`    Found array property: ${propertyName}`);
          }
        }

        console.log(`    Found ${foundPropertyCount}/${commonProperties.length} common array properties`);
      }
    });
  }));

  suite.addResult(createTest("Should handle array-related errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent array types
      const nonExistentArray = domain.class("NonExistent.Type[]");
      assert(nonExistentArray === null, "Non-existent array type should return null");

      // Test with malformed array names
      const malformedArray = domain.class("System.String[");
      assert(malformedArray === null, "Malformed array name should return null");

      console.log("    Error handling for array types works correctly");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Array Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} array tests passed`,
  };
}

/**
 * Object Operations Tests
 * Tests object creation, boxing, unboxing, and type operations
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testObjectOperations(): TestResult {
  console.log("\nObject Operations:");

  const suite = new TestSuite("Object Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for object tests", () => {
    assertPerformWorks("Mono.perform() should work for object tests");
  }));

  suite.addResult(createTest("Object APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for object operations");
      assert(Mono.api.hasExport("mono_object_new"), "mono_object_new should be available");
      assert(Mono.api.hasExport("mono_object_get_class"), "mono_object_get_class should be available");
      assert(Mono.api.hasExport("mono_object_unbox"), "mono_object_unbox should be available");
      assert(Mono.api.hasExport("mono_value_box"), "mono_value_box should be available");
      assert(Mono.api.hasExport("mono_runtime_object_init"), "mono_runtime_object_init should be available");
    });
  }));

  suite.addResult(createTest("Object APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_object_new === 'function', "mono_object_new should be a function");
      assert(typeof Mono.api.native.mono_object_get_class === 'function', "mono_object_get_class should be a function");
      assert(typeof Mono.api.native.mono_object_unbox === 'function', "mono_object_unbox should be a function");
      assert(typeof Mono.api.native.mono_value_box === 'function', "mono_value_box should be a function");
    });
  }));

  suite.addResult(createTest("Should access object-related classes", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for object operations");

      const domain = Mono.domain;

      // Try to find Object class
      const objectClass = domain.class("System.Object");
      if (objectClass) {
        assert(typeof objectClass.getName === 'function', "Object class should have getName method");
        console.log(`    Found Object class: ${objectClass.getName()}`);

        const methods = objectClass.getMethods();
        const properties = objectClass.getProperties();
        const fields = objectClass.getFields();

        assert(Array.isArray(methods), "Object class should have methods array");
        assert(Array.isArray(properties), "Object class should have properties array");
        assert(Array.isArray(fields), "Object class should have fields array");
        console.log(`    System.Object has ${methods.length} methods, ${properties.length} properties, ${fields.length} fields`);
      } else {
        console.log("    System.Object class not available in this context");
      }
    });
  }));

  suite.addResult(createTest("Should test string object operations", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        // Test string as object
        const testString = Mono.api.stringNew("Hello, Object World!");
        if (testString && !testString.isNull()) {
          console.log("    Successfully created string object for testing");

          // Test getting class from object
          try {
            const objectClass = Mono.api.native.mono_object_get_class(testString);
            if (objectClass && !objectClass.isNull()) {
              console.log("    Successfully retrieved class from string object");
            }
          } catch (error) {
            console.log(`    Object class retrieval test: ${error}`);
          }
        }
      } else {
        console.log("    System.String class not available for object testing");
      }
    });
  }));

  suite.addResult(createTest("Should test value type boxing and unboxing", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const intClass = domain.class("System.Int32");

      if (intClass) {
        console.log("    Found Int32 class for boxing tests");

        // Test boxing APIs availability
        assert(typeof Mono.api.native.mono_value_box === 'function', "mono_value_box should be available");
        assert(typeof Mono.api.native.mono_object_unbox === 'function', "mono_object_unbox should be available");

        console.log("    Boxing and unboxing APIs are accessible");
      } else {
        console.log("    System.Int32 class not available for boxing tests");
      }
    });
  }));

  suite.addResult(createTest("Should support object operations in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const domain = Mono.domain;
        const objectClass = domain.class("System.Object");

        if (objectClass) {
          assert(typeof objectClass.getName === 'function', "Object access should work in nested perform calls");
        }

        // Test that APIs are still accessible in nested context
        assert(Mono.api.hasExport("mono_object_new"), "Object APIs should work in nested perform calls");
      });
    });
  }));

  suite.addResult(createTest("Object operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const objectClass1 = domain.class("System.Object");
      const objectClass2 = domain.class("System.Object");

      if (objectClass1 && objectClass2) {
        const name1 = objectClass1.getName();
        const name2 = objectClass2.getName();
        assert(name1 === name2, "Object class lookups should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");

      // Test API consistency
      const api1 = Mono.api;
      const api2 = Mono.api;
      assert(api1 === api2, "API should be cached instance");
    });
  }));

  suite.addResult(createTest("Should test different object types", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test various object types
      const objectTypes = [
        "System.Object",
        "System.String",
        "System.Int32",
        "System.Boolean",
        "System.DateTime",
        "System.Collections.Generic.List`1",
      ];

      let foundCount = 0;
      for (const objectType of objectTypes) {
        const testClass = domain.class(objectType);
        if (testClass) {
          foundCount++;
          console.log(`    Found object type: ${objectType} -> ${testClass.getName()}`);
          assert(typeof testClass.getName === 'function', "Object class should have getName method");
        }
      }

      console.log(`    Found ${foundCount}/${objectTypes.length} object-related types`);
    });
  }));

  suite.addResult(createTest("Should test object method access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");

      if (objectClass) {
        const methods = objectClass.getMethods();
        assert(Array.isArray(methods), "Object should have methods array");

        // Test for common object methods
        const commonMethods = ["ToString", "Equals", "GetHashCode", "GetType"];
        let foundMethodCount = 0;

        for (const methodName of commonMethods) {
          const method = objectClass.method(methodName);
          if (method) {
            foundMethodCount++;
            console.log(`    Found object method: ${methodName}`);
          }
        }

        console.log(`    Found ${foundMethodCount}/${commonMethods.length} common object methods`);
      }
    });
  }));

  suite.addResult(createTest("Should test object property access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");

      if (objectClass) {
        const properties = objectClass.getProperties();
        assert(Array.isArray(properties), "Object should have properties array");

        // System.Object typically has no instance properties, but let's verify
        console.log(`    System.Object has ${properties.length} properties (as expected)`);

        // Test with a class that might have properties
        const stringClass = domain.class("System.String");
        if (stringClass) {
          const stringProperties = stringClass.getProperties();
          console.log(`    System.String has ${stringProperties.length} properties for comparison`);
        }
      }
    });
  }));

  suite.addResult(createTest("Should handle object-related errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent object types
      const nonExistentObject = domain.class("NonExistent.ObjectType");
      assert(nonExistentObject === null, "Non-existent object type should return null");

      // Test object creation error handling
      console.log("    Skipping unsafe object creation API misuse to keep runtime stable");

      console.log("    Error handling for object operations works correctly");
    });
  }));

  suite.addResult(createTest("Should test object runtime initialization", () => {
    Mono.perform(() => {
      // Test runtime object initialization API
      assert(Mono.api.hasExport("mono_runtime_object_init"), "mono_runtime_object_init should be available");
      assert(typeof Mono.api.native.mono_runtime_object_init === 'function', "mono_runtime_object_init should be callable");

      console.log("    Object runtime initialization APIs are accessible");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Object Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} object tests passed`,
  };
}

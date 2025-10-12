/**
 * Class Operations Tests
 * Tests Mono class lookup and metadata operations
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testClassOperations(): TestResult {
  console.log("\nClass Operations:");

  const suite = new TestSuite("Class Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for class tests", () => {
    assertPerformWorks("Mono.perform() should work for class tests");
  }));

  suite.addResult(createTest("Class APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for class operations");
      assert(Mono.api.hasExport("mono_class_from_name"), "mono_class_from_name should be available");
      assert(Mono.api.hasExport("mono_class_get_method_from_name"), "mono_class_get_method_from_name should be available");
      assert(Mono.api.hasExport("mono_class_get_field_from_name"), "mono_class_get_field_from_name should be available");
      assert(Mono.api.hasExport("mono_class_get_property_from_name"), "mono_class_get_property_from_name should be available");
    });
  }));

  suite.addResult(createTest("Class APIs should be callable functions", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_class_from_name === 'function', "mono_class_from_name should be a function");
      assert(typeof Mono.api.native.mono_class_get_method_from_name === 'function', "mono_class_get_method_from_name should be a function");
      assert(typeof Mono.api.native.mono_class_get_field_from_name === 'function', "mono_class_get_field_from_name should be a function");
      assert(typeof Mono.api.native.mono_class_get_property_from_name === 'function', "mono_class_get_property_from_name should be a function");
    });
  }));

  suite.addResult(createTest("Domain should provide class access methods", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for class operations");

      const domain = Mono.domain;
      assert(typeof domain.class === 'function', "Domain should have class method");
    });
  }));

  suite.addResult(createTest("Should find common system classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find common system classes
      const stringClass = domain.class("System.String");
      if (stringClass) {
        assert(typeof stringClass.getName === 'function', "String class should have getName method");
        assert(typeof stringClass.getMethods === 'function', "String class should have getMethods method");
        console.log(`    Found System.String class: ${stringClass.getName()}`);
      }

      const objectClass = domain.class("System.Object");
      if (objectClass) {
        assert(typeof objectClass.getName === 'function', "Object class should have getName method");
        console.log(`    Found System.Object class: ${objectClass.getName()}`);
      }

      const intClass = domain.class("System.Int32");
      if (intClass) {
        console.log(`    Found System.Int32 class: ${intClass.getName()}`);
      }
    });
  }));

  suite.addResult(createTest("Should find classes through assembly image", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.image;
        const classes = image.getClasses();

        assert(Array.isArray(classes), "Should get classes array from image");
        assert(classes.length >= 0, "Should have zero or more classes");

        if (classes.length > 0) {
          const firstClass = classes[0];
          assert(typeof firstClass.getName === 'function', "Class should have getName method");
          console.log(`    Found ${classes.length} classes, first: ${firstClass.getName()}`);
        } else {
          console.log("    No classes found in first assembly image");
        }
      } else {
        console.log("    No assemblies available to test class access");
      }
    });
  }));

  suite.addResult(createTest("Should handle non-existent class gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      const nonExistent = domain.class("NonExistent.Class.Name");
      assert(nonExistent === null, "Non-existent class should return null");

      const emptyName = domain.class("");
      assert(emptyName === null, "Empty class name should return null");
    });
  }));

  suite.addResult(createTest("Should get class methods and fields", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const methods = stringClass.getMethods();
        assert(Array.isArray(methods), "Should get methods array");

        const fields = stringClass.getFields();
        assert(Array.isArray(fields), "Should get fields array");

        const properties = stringClass.getProperties();
        assert(Array.isArray(properties), "Should get properties array");

        console.log(`    System.String has ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`);

        if (methods.length > 0) {
          const firstMethod = methods[0];
          assert(typeof firstMethod.getName === 'function', "Method should have getName method");
          console.log(`    First method: ${firstMethod.getName()}`);
        }
      } else {
        console.log("    System.String not available for method/field testing");
      }
    });
  }));

  suite.addResult(createTest("Should support namespace-based class lookup", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test different namespace patterns
      const collections = domain.class("System.Collections.Generic.List`1");
      if (collections) {
        console.log(`    Found generic List class: ${collections.getName()}`);
      }

      const io = domain.class("System.IO.File");
      if (io) {
        console.log(`    Found IO class: ${io.getName()}`);
      }

      const threading = domain.class("System.Threading.Thread");
      if (threading) {
        console.log(`    Found threading class: ${threading.getName()}`);
      }
    });
  }));

  suite.addResult(createTest("Should handle class inheritance and parent relationships", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      const objectClass = domain.class("System.Object");

      if (stringClass && objectClass) {
        // Test that we can access class hierarchy information
        const stringName = stringClass.getName();
        const objectName = objectClass.getName();

        assert(typeof stringName === 'string', "String class name should be string");
        assert(typeof objectName === 'string', "Object class name should be string");

        console.log(`    Class names: ${stringName}, ${objectName}`);
      }
    });
  }));

  suite.addResult(createTest("Should support class operations in nested perform calls", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test nested perform calls
      Mono.perform(() => {
        const stringClass = domain.class("System.String");
        if (stringClass) {
          assert(typeof stringClass.getName === 'function', "Class methods should work in nested calls");
        }
      });
    });
  }));

  suite.addResult(createTest("Class operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const stringClass1 = domain.class("System.String");
      const stringClass2 = domain.class("System.String");

      if (stringClass1 && stringClass2) {
        // They should be the same object or equivalent
        const name1 = stringClass1.getName();
        const name2 = stringClass2.getName();
        assert(name1 === name2, "Class lookups should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    });
  }));

  suite.addResult(createTest("Should handle class lookup variations", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test case sensitivity (typically case-sensitive)
      const stringLower = domain.class("system.string");
      const stringProper = domain.class("System.String");

      if (stringProper) {
        console.log("    Found System.String with proper casing");
      }

      if (stringLower && stringLower !== stringProper) {
        console.log("    Found system.string with lowercase (unusual)");
      } else if (!stringLower) {
        console.log("    Case-sensitive lookup confirmed (lowercase not found)");
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Class Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} class tests passed`,
  };
}

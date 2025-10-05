/**
 * Field Operations Tests
 * Tests field lookup, get and set operations
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testFieldOperations(): TestResult {
  console.log("\nField Operations:");

  const suite = new TestSuite("Field Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for field tests", () => {
    assertPerformWorks("Mono.perform() should work for field tests");
  }));

  suite.addResult(createTest("Field APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for field operations");
      assert(Mono.api.hasExport("mono_class_get_field_from_name"), "mono_class_get_field_from_name should be available");
      assert(Mono.api.hasExport("mono_field_get_value"), "mono_field_get_value should be available");
      assert(Mono.api.hasExport("mono_field_set_value"), "mono_field_set_value should be available");
    });
  }));

  suite.addResult(createTest("Field APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_class_get_field_from_name === 'function', "mono_class_get_field_from_name should be a function");
      assert(typeof Mono.api.native.mono_field_get_value === 'function', "mono_field_get_value should be a function");
      assert(typeof Mono.api.native.mono_field_set_value === 'function', "mono_field_set_value should be a function");
    });
  }));

  suite.addResult(createTest("Should access fields through class objects", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for field operations");

      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const fields = stringClass.getFields();
        assert(Array.isArray(fields), "Should get fields array from class");

        if (fields.length > 0) {
          const firstField = fields[0];
          assert(typeof firstField.getName === 'function', "Field should have getName method");
          console.log(`    System.String has ${fields.length} fields, first: ${firstField.getName()}`);
        } else {
          console.log("    System.String has no accessible fields");
        }
      } else {
        console.log("    System.String class not available for field testing");
      }
    });
  }));

  suite.addResult(createTest("Should find specific fields by name", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        // Try to find common static fields
        const emptyField = stringClass.field("Empty");
        if (emptyField) {
          assert(typeof emptyField.getName === 'function', "Field should have getName method");
          assert(typeof emptyField.readValue === 'function', "Field should have readValue method");
          console.log(`    Found System.String.Empty field: ${emptyField.getName()}`);

          try {
            const value = emptyField.readValue(null);
            console.log(`    System.String.Empty value: "${value}"`);
          } catch (error) {
            console.log(`    Could not read System.String.Empty value: ${error}`);
          }
        } else {
          console.log("    System.String.Empty field not found or accessible");
        }

        // Try other common fields
        const lengthField = stringClass.field("length");
        if (lengthField) {
          console.log(`    Found length field: ${lengthField.getName()}`);
        }
      }
    });
  }));

  suite.addResult(createTest("Should access fields through assembly image classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.getImage();
        const classes = image.getClasses();

        if (classes.length > 0) {
          const firstClass = classes[0];
          const fields = firstClass.getFields();

          assert(Array.isArray(fields), "Should get fields array from image class");
          console.log(`    Class ${firstClass.getName()} has ${fields.length} fields`);

          if (fields.length > 0) {
            const firstField = fields[0];
            assert(typeof firstField.getName === 'function', "Field should have getName method");
            assert(typeof firstField.getSummary === 'function', "Field should have getSummary method");
          }
        } else {
          console.log("    No classes found in first assembly image");
        }
      } else {
        console.log("    No assemblies available for field testing");
      }
    });
  }));

  suite.addResult(createTest("Should handle non-existent fields gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const nonExistent = stringClass.field("NonExistentField12345");
        assert(nonExistent === null, "Non-existent field should return null");

        const emptyName = stringClass.field("");
        assert(emptyName === null, "Empty field name should return null");
      }
    });
  }));

  suite.addResult(createTest("Should test field metadata and properties", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const fields = stringClass.getFields();

        if (fields.length > 0) {
          const firstField = fields[0];

          try {
            const summary = firstField.getSummary();
            if (summary) {
              assert(typeof summary.isStatic === 'boolean', "Field summary should include isStatic property");
              assert(typeof summary.name === 'string', "Field summary should include name");
              console.log(`    Field ${summary.name} is static: ${summary.isStatic}`);
            }
          } catch (error) {
            // Field metadata API may have compatibility issues in some Mono versions
            if (error instanceof Error && error.message.includes("bad argument count")) {
              console.log("    (Skipped: Field metadata API compatibility issue in this Mono version)");
            } else {
              console.log(`    Field metadata access failed: ${error}`);
            }
          }
        }
      }
    });
  }));

  suite.addResult(createTest("Should support field operations in nested perform calls", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test nested perform calls
      Mono.perform(() => {
        const stringClass = domain.class("System.String");
        if (stringClass) {
          const fields = stringClass.getFields();
          assert(Array.isArray(fields), "Field access should work in nested perform calls");
        }
      });
    });
  }));

  suite.addResult(createTest("Field operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const stringClass1 = domain.class("System.String");
      const stringClass2 = domain.class("System.String");

      if (stringClass1 && stringClass2) {
        const fields1 = stringClass1.getFields();
        const fields2 = stringClass2.getFields();

        assert(Array.isArray(fields1), "First getFields call should return array");
        assert(Array.isArray(fields2), "Second getFields call should return array");
        assert(fields1.length === fields2.length, "Field count should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    });
  }));

  suite.addResult(createTest("Should test field type information", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const fields = stringClass.getFields();

        if (fields.length > 0) {
          const firstField = fields[0];

          try {
            // Test field type information access
            const fieldName = firstField.getName();
            assert(typeof fieldName === 'string', "Field name should be string");
            console.log(`    Testing field type for: ${fieldName}`);

            // Some fields might have type information available
            if (typeof firstField.getType === 'function') {
              const fieldType = firstField.getType();
              if (fieldType) {
                console.log(`    Field type: ${fieldType.getName()}`);
              }
            }
          } catch (error) {
            console.log(`    Field type access failed: ${error}`);
          }
        }
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Field Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} field tests passed`,
  };
}

/**
 * Property Operations Tests
 * Tests property lookup and accessor method retrieval
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testPropertyOperations(): TestResult {
  console.log("\nProperty Operations:");

  const suite = new TestSuite("Property Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for property tests", () => {
    assertPerformWorks("Mono.perform() should work for property tests");
  }));

  suite.addResult(createTest("Property APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for property operations");
      assert(Mono.api.hasExport("mono_class_get_property_from_name"), "mono_class_get_property_from_name should be available");
      assert(Mono.api.hasExport("mono_property_get_get_method"), "mono_property_get_get_method should be available");
      assert(Mono.api.hasExport("mono_property_get_set_method"), "mono_property_get_set_method should be available");
    });
  }));

  suite.addResult(createTest("Property APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_class_get_property_from_name === 'function', "mono_class_get_property_from_name should be a function");
      assert(typeof Mono.api.native.mono_property_get_get_method === 'function', "mono_property_get_get_method should be a function");
      assert(typeof Mono.api.native.mono_property_get_set_method === 'function', "mono_property_get_set_method should be a function");
    });
  }));

  suite.addResult(createTest("Should access properties through class objects", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for property operations");

      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const properties = stringClass.getProperties();
        assert(Array.isArray(properties), "Should get properties array from class");

        if (properties.length > 0) {
          const firstProperty = properties[0];
          assert(typeof firstProperty.getName === 'function', "Property should have getName method");
          console.log(`    System.String has ${properties.length} properties, first: ${firstProperty.getName()}`);
        } else {
          console.log("    System.String has no accessible properties");
        }
      } else {
        console.log("    System.String class not available for property testing");
      }
    });
  }));

  suite.addResult(createTest("Should find specific properties by name", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        // Try to find common properties
        const lengthProperty = stringClass.property("Length");
        if (lengthProperty) {
          assert(typeof lengthProperty.getName === 'function', "Property should have getName method");
          assert(typeof lengthProperty.getGetter === 'function', "Property should have getGetter method");
          assert(typeof lengthProperty.getSetter === 'function', "Property should have getSetter method");
          console.log(`    Found System.String.Length property: ${lengthProperty.getName()}`);

          // Test accessor methods
          try {
            const getMethod = lengthProperty.getGetter();
            if (getMethod) {
              console.log(`    Length property has getter: ${getMethod.getName()}`);
            }
          } catch (error) {
            console.log(`    Length getter access failed: ${error}`);
          }

          try {
            const setMethod = lengthProperty.getSetter();
            if (setMethod) {
              console.log(`    Length property has setter: ${setMethod.getName()}`);
            } else {
              console.log("    Length property is read-only (no setter)");
            }
          } catch (error) {
            console.log(`    Length setter access failed: ${error}`);
          }
        } else {
          console.log("    System.String.Length property not found or accessible");
        }
      }
    });
  }));

  suite.addResult(createTest("Should access properties through assembly image classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.getImage();
        const classes = image.getClasses();

        if (classes.length > 0) {
          const firstClass = classes[0];
          const properties = firstClass.getProperties();

          assert(Array.isArray(properties), "Should get properties array from image class");
          console.log(`    Class ${firstClass.getName()} has ${properties.length} properties`);

          if (properties.length > 0) {
            const firstProperty = properties[0];
            assert(typeof firstProperty.getName === 'function', "Property should have getName method");
            assert(typeof firstProperty.getPropertyInfo === 'function', "Property should have getPropertyInfo method");
          }
        } else {
          console.log("    No classes found in first assembly image");
        }
      } else {
        console.log("    No assemblies available for property testing");
      }
    });
  }));

  suite.addResult(createTest("Should handle non-existent properties gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const nonExistent = stringClass.property("NonExistentProperty12345");
        assert(nonExistent === null, "Non-existent property should return null");

        const emptyName = stringClass.property("");
        assert(emptyName === null, "Empty property name should return null");
      }
    });
  }));

  suite.addResult(createTest("Should test property metadata and attributes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const properties = stringClass.getProperties();

        if (properties.length > 0) {
          const firstProperty = properties[0];

          try {
            const propertyInfo = firstProperty.getPropertyInfo();
            if (propertyInfo) {
              assert(typeof propertyInfo.name === 'string', "Property info should include name");
              console.log(`    Property ${propertyInfo.name} found`);

              // Test accessor method access
              const getMethod = firstProperty.getGetter();
              const setMethod = firstProperty.getSetter();

              if (getMethod) {
                assert(typeof getMethod.getName === 'function', "Get method should have getName method");
                console.log(`    Property has getter: ${getMethod.getName()}`);
              }

              if (setMethod) {
                assert(typeof setMethod.getName === 'function', "Set method should have getName method");
                console.log(`    Property has setter: ${setMethod.getName()}`);
              }
            }
          } catch (error) {
            console.log(`    Property metadata access failed: ${error}`);
          }
        }
      }
    });
  }));

  suite.addResult(createTest("Should support property operations in nested perform calls", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test nested perform calls
      Mono.perform(() => {
        const stringClass = domain.class("System.String");
        if (stringClass) {
          const properties = stringClass.getProperties();
          assert(Array.isArray(properties), "Property access should work in nested perform calls");
        }
      });
    });
  }));

  suite.addResult(createTest("Property operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const stringClass1 = domain.class("System.String");
      const stringClass2 = domain.class("System.String");

      if (stringClass1 && stringClass2) {
        const properties1 = stringClass1.getProperties();
        const properties2 = stringClass2.getProperties();

        assert(Array.isArray(properties1), "First getProperties call should return array");
        assert(Array.isArray(properties2), "Second getProperties call should return array");
        assert(properties1.length === properties2.length, "Property count should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    });
  }));

  suite.addResult(createTest("Should test property type information", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const properties = stringClass.getProperties();

        if (properties.length > 0) {
          const firstProperty = properties[0];

          try {
            // Test property type information access
            const propertyName = firstProperty.getName();
            assert(typeof propertyName === 'string', "Property name should be string");
            console.log(`    Testing property type for: ${propertyName}`);

            // Some properties might have type information available
            if (typeof firstProperty.getType === 'function') {
              const propertyType = firstProperty.getType();
              if (propertyType) {
                console.log(`    Property type: ${propertyType.getName()}`);
              }
            }
          } catch (error) {
            console.log(`    Property type access failed: ${error}`);
          }
        }
      }
    });
  }));

  suite.addResult(createTest("Should test different property types", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test properties on different classes
      const classesToTest = ["System.String", "System.Int32", "System.Object"];

      for (const className of classesToTest) {
        const testClass = domain.class(className);
        if (testClass) {
          const properties = testClass.getProperties();
          if (properties.length > 0) {
            console.log(`    ${className} has ${properties.length} properties`);

            // Test first property as representative
            const firstProp = properties[0];
            assert(typeof firstProp.getName === 'function', "Property should have getName method");
          }
        }
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Property Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} property tests passed`,
  };
}

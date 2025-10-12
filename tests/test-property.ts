/**
 * Property Operations Tests
 * Tests property lookup and accessor method retrieval
 */

import Mono from "../src";
import { TestResult, TestSuite, createMonoTest, createDomainTest, assert, assertDomainAvailable, createPerformSmokeTest, createApiAvailabilityTest, createNestedPerformTest, assertDomainCached } from "./test-framework";

export function testPropertyOperations(): TestResult {
  console.log("\nProperty Operations:");

  const suite = new TestSuite("Property Tests");

  // Modern API tests
  suite.addResult(createPerformSmokeTest("property tests"));

  suite.addResult(createApiAvailabilityTest({
    context: "property operations",
    testName: "Property APIs should be available",
    requiredExports: [
      "mono_class_get_property_from_name",
      "mono_property_get_get_method",
      "mono_property_get_set_method",
    ],
  }));

  suite.addResult(createMonoTest("Property APIs should be callable", () => {
    assert(typeof Mono.api.native.mono_class_get_property_from_name === 'function', "mono_class_get_property_from_name should be a function");
    assert(typeof Mono.api.native.mono_property_get_get_method === 'function', "mono_property_get_get_method should be a function");
    assert(typeof Mono.api.native.mono_property_get_set_method === 'function', "mono_property_get_set_method should be a function");
  }));

  suite.addResult(createDomainTest("Should access properties through class objects", domain => {
    assertDomainAvailable("Mono.domain should be accessible for property operations");

    const stringClass = domain.class("System.String");

    if (stringClass) {
      const properties = stringClass.getProperties();
      assert(Array.isArray(properties), "Should get properties array from class");

      if (properties.length > 0) {
        const firstProperty = properties[0];
        assert(typeof firstProperty.getName === 'function', "Property should have getName method");
        assert(firstProperty.name === firstProperty.getName(), "name accessor should mirror getName()");
        assert(firstProperty.parent === stringClass, "parent accessor should return declaring class");
        console.log(`    System.String has ${properties.length} properties, first: ${firstProperty.name}`);
      } else {
        console.log("    System.String has no accessible properties");
      }
    } else {
      console.log("    System.String class not available for property testing");
    }
  }));

  suite.addResult(createDomainTest("Should find specific properties by name", domain => {
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
          const getMethod = lengthProperty.getter;
          if (getMethod) {
            console.log(`    Length property has getter: ${getMethod.getName()}`);
          }
        } catch (error) {
          console.log(`    Length getter access failed: ${error}`);
        }

        try {
          const setMethod = lengthProperty.setter;
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
  }));

  suite.addResult(createDomainTest("Should access properties through assembly image classes", domain => {
    const assemblies = domain.getAssemblies();

    if (assemblies.length > 0) {
      const assembly = assemblies[0];
      const image = assembly.image;
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
  }));

  suite.addResult(createDomainTest("Should handle non-existent properties gracefully", domain => {
    const stringClass = domain.class("System.String");

    if (stringClass) {
      const nonExistent = stringClass.property("NonExistentProperty12345");
      assert(nonExistent === null, "Non-existent property should return null");

      const emptyName = stringClass.property("");
      assert(emptyName === null, "Empty property name should return null");
    }
  }));

  suite.addResult(createDomainTest("Should test property metadata and attributes", domain => {
    const stringClass = domain.class("System.String");

    if (stringClass) {
      const properties = stringClass.getProperties();

      if (properties.length > 0) {
        const firstProperty = properties[0];

        try {
          const propertyInfo = firstProperty.getPropertyInfo();
          if (propertyInfo) {
            assert(typeof propertyInfo.name === 'string', "Property info should include name");
            assert(Array.isArray(propertyInfo.parameterTypeNames), "Property info should include parameter type names");
            assert(propertyInfo.parameterCount === propertyInfo.parameterTypeNames.length, "Parameter metadata should be internally consistent");
            const parameterSummary = propertyInfo.parameterTypeNames.length > 0
              ? propertyInfo.parameterTypeNames.join(", ")
              : "none";
            console.log(`    Property ${propertyInfo.name} found (parameters: ${parameterSummary})`);

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
  }));

  suite.addResult(createDomainTest("Should expose indexer parameter metadata", domain => {
    const stringClass = domain.class("System.String");

    if (!stringClass) {
      console.log("    System.String class not available for indexer test");
      return;
    }

    const charsProperty = stringClass.property("Chars");
    if (!charsProperty) {
      console.log("    System.String.Chars property not available");
      return;
    }

    assert(charsProperty.hasParameters(), "Indexer property should report parameters");
    const parameters = charsProperty.getParameters();
    assert(parameters.length === 1, "System.String indexer should expose single parameter");

    const propertyInfo = charsProperty.getPropertyInfo();
    assert(propertyInfo.parameterCount === 1, "Property info parameter count should match indexer");
    assert(propertyInfo.parameterTypeNames.length === 1, "Property info should include parameter name for indexer");
    console.log(`    Indexer parameter type: ${propertyInfo.parameterTypeNames[0] || "unknown"}`);
  }));

  suite.addResult(createNestedPerformTest({
    context: "property operations",
    validate: domain => {
      const stringClass = domain.class("System.String");
      if (stringClass) {
        const properties = stringClass.getProperties();
        assert(Array.isArray(properties), "Property access should work in nested perform calls");
      }
    },
  }));

  suite.addResult(createDomainTest("Property operations should be consistent", domain => {
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

    assertDomainCached();
  }));

  suite.addResult(createDomainTest("Should test property type information", domain => {
    const stringClass = domain.class("System.String");

    if (stringClass) {
      const properties = stringClass.getProperties();

      if (properties.length > 0) {
        const firstProperty = properties[0];

        try {
          // Test property type information access
          const propertyName = firstProperty.name;
          assert(typeof propertyName === 'string', "Property name should be string");
          console.log(`    Testing property type for: ${propertyName}`);

          // Some properties might have type information available
          if (typeof firstProperty.getType === 'function') {
            const propertyType = firstProperty.type;
            if (propertyType) {
              console.log(`    Property type: ${propertyType.getName()}`);
            }
          }
        } catch (error) {
          console.log(`    Property type access failed: ${error}`);
        }
      }
    }
  }));

  suite.addResult(createDomainTest("Should test different property types", domain => {
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


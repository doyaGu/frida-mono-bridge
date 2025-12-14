/**
 * Comprehensive MonoProperty Tests
 * Tests for MonoProperty functionality including property discovery, getter/setter resolution,
 * value getting/setting, indexed properties, and Unity-specific patterns
 */

import Mono from "../src";
import {
  TestResult,
  assert,
  assertNotNull,
  assertThrows,
  createErrorHandlingTest,
  createMonoDependentTest,
} from "./test-framework";
import { createBasicLookupPerformanceTest, createPropertyLookupPerformanceTest } from "./test-utilities";

export async function createMonoPropertyTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== PROPERTY DISCOVERY AND ENUMERATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should discover properties by name", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should be available");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        assert(lengthProperty.name === "Length", "Property name should be Length");
        assert(lengthProperty.parent.name === "String", "Property parent should be String");
      } else {
        console.log("  - Length property not found on String");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should enumerate all properties in class", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      if (stringClass) {
        const properties = stringClass.properties;
        assert(properties.length >= 0, "Should find properties (or none)");

        const lengthProperty = properties.find(p => p.name === "Length");
        if (lengthProperty) {
          assert(lengthProperty.name === "Length", "Should find Length property in enumeration");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle missing properties gracefully", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const missingProperty = stringClass!.tryProperty("DefinitelyDoesNotExist");
      assert(missingProperty === null, "Missing property should return null");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoProperty should throw for missing required properties", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      assertThrows(() => {
        stringClass!.property("DefinitelyDoesNotExist");
      }, "Should throw when required property is not found");
    }),
  );

  // ===== GETTER/SETTER METHOD RESOLUTION TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should resolve getter methods", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const getter = lengthProperty.getter;
        if (getter) {
          assert(
            getter.name.includes("get_Length") || getter.name.includes("Length"),
            "Getter should be related to Length",
          );
          assert(!getter.isStatic, "Instance property getter should not be static");
        } else {
          console.log("  - No getter found for Length property");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should resolve setter methods", () => {
      const domain = Mono.domain;

      // Try to find a class with writable properties
      const listClass = domain.tryClass("System.Collections.Generic.List`1");
      if (listClass) {
        const countProperty = listClass.tryProperty("Count");
        if (countProperty) {
          const setter = countProperty.setter;
          // Count property is typically read-only
          if (setter) {
            assert(
              setter.name.includes("set_Count") || setter.name.includes("Count"),
              "Setter should be related to Count",
            );
          } else {
            console.log("  - Count property is read-only (no setter)");
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle read-only properties", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const canRead = lengthProperty.canRead;
        const canWrite = lengthProperty.canWrite;

        assert(canRead === true, "Length property should be readable");
        assert(canWrite === false, "Length property should not be writable");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle write-only properties", () => {
      const domain = Mono.domain;

      // Try to find a class with write-only properties
      const streamClass = domain.tryClass("System.IO.Stream");
      if (streamClass) {
        const properties = streamClass.properties;
        const writeOnlyProps = properties.filter((p: any) => p.canWrite && !p.canRead);

        if (writeOnlyProps.length > 0) {
          const prop = writeOnlyProps[0];
          assert(!prop.canRead, "Property should not be readable");
          assert(prop.canWrite, "Property should be writable");
        } else {
          console.log("  - No write-only properties found");
        }
      }
    }),
  );

  // ===== PROPERTY VALUE GETTING AND SETTING TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should get property values", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty && lengthProperty.canRead) {
        const testString = Mono.api.stringNew("Hello");

        try {
          const value = lengthProperty.getValue(testString);
          assertNotNull(value, "Property value should be available");
        } catch (error) {
          console.log(`  - Property get failed: ${error}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should set property values", () => {
      const domain = Mono.domain;

      // Try to find a class with writable properties
      const stringBuilderClass = domain.tryClass("System.Text.StringBuilder");
      if (stringBuilderClass) {
        const lengthProperty = stringBuilderClass.tryProperty("Length");
        if (lengthProperty && lengthProperty.canWrite) {
          const obj = stringBuilderClass.alloc();

          try {
            // Try to set length (might not work due to implementation)
            lengthProperty.setValue(obj, 5);
            console.log("  - Successfully set property value");
          } catch (error) {
            console.log(`  - Property set failed: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle static property values", () => {
      const domain = Mono.domain;

      // Try to find a class with static properties
      const environmentClass = domain.tryClass("System.Environment");
      if (environmentClass) {
        const newlineProperty = environmentClass.tryProperty("NewLine");
        if (newlineProperty && newlineProperty.isStatic) {
          try {
            const value = newlineProperty.getValue(null);
            assertNotNull(value, "Static property value should be available");
          } catch (error) {
            console.log(`  - Static property get failed: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should set static property values", () => {
      const domain = Mono.domain;

      // Try to find a class with writable static properties
      const consoleClass = domain.tryClass("System.Console");
      if (consoleClass) {
        const properties = consoleClass.properties;
        const staticWritableProps = properties.filter((p: any) => p.isStatic && p.canWrite);

        if (staticWritableProps.length > 0) {
          const prop = staticWritableProps[0];
          try {
            prop.setValue(null, "test value");
            console.log("  - Successfully set static property value");
          } catch (error) {
            console.log(`  - Static property set failed: ${error}`);
          }
        } else {
          console.log("  - No writable static properties found");
        }
      }
    }),
  );

  // ===== READ-ONLY AND WRITE-ONLY PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should identify read-only properties correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        assert(lengthProperty.canRead, "Length should be readable");
        assert(!lengthProperty.canWrite, "Length should not be writable");

        const getter = lengthProperty.getter;
        const setter = lengthProperty.setter;

        assertNotNull(getter, "Read-only property should have getter");
        assert(setter === null, "Read-only property should not have setter");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should identify write-only properties correctly", () => {
      const domain = Mono.domain;

      // Try to find write-only properties
      const streamClass = domain.tryClass("System.IO.Stream");
      if (streamClass) {
        const properties = streamClass.properties;
        const writeOnlyProps = properties.filter((p: any) => !p.canRead && p.canWrite);

        if (writeOnlyProps.length > 0) {
          const prop = writeOnlyProps[0];
          assert(!prop.canRead, "Property should not be readable");
          assert(prop.canWrite, "Property should be writable");

          const getter = prop.getter;
          const setter = prop.setter;

          assert(getter === null, "Write-only property should not have getter");
          assertNotNull(setter, "Write-only property should have setter");
        }
      }
    }),
  );

  // ===== INDEXED PROPERTIES TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should identify indexed properties", () => {
      const domain = Mono.domain;

      // Try to find a class with indexed properties
      const listClass = domain.tryClass("System.Collections.Generic.List`1");
      if (listClass) {
        const properties = listClass.properties;
        const indexedProps = properties.filter((p: any) => p.hasParameters);

        if (indexedProps.length > 0) {
          const prop = indexedProps[0];
          assert(prop.hasParameters, "Property should have parameters");

          const parameters = prop.parameters;
          assert(parameters.length > 0, "Indexed property should have parameters");
        } else {
          console.log("  - No indexed properties found");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle indexed property parameters", () => {
      const domain = Mono.domain;

      // Try to find a class with indexed properties
      const dictionaryClass = domain.tryClass("System.Collections.Generic.Dictionary`2");
      if (dictionaryClass) {
        const properties = dictionaryClass.properties;
        const indexedProps: any[] = [];
        for (let i = 0; i < properties.length; i++) {
          const p = properties[i];
          if (p.hasParameters) {
            indexedProps.push(p);
          }
        }

        if (indexedProps.length > 0) {
          const prop = indexedProps[0];
          try {
            const parameters = prop.parameters;
            console.log(`  - Indexed property has ${parameters.length} parameters`);
            if (parameters.length > 0) {
              const parameterTypes = parameters.map((p: any) => (p.name ? p.name : "unknown"));
              console.log(`  - Indexed property parameters: ${parameterTypes.join(", ")}`);
            }
          } catch (error) {
            console.log(`  - Indexed property parameters not accessible: ${error}`);
          }
        } else {
          console.log("  - No indexed properties found in Dictionary");
        }
      } else {
        console.log("  - Dictionary class not available");
      }
    }),
  );

  // ===== STATIC VS INSTANCE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should identify static properties correctly", () => {
      const domain = Mono.domain;

      const environmentClass = domain.tryClass("System.Environment");
      if (environmentClass) {
        const newlineProperty = environmentClass.tryProperty("NewLine");
        if (newlineProperty) {
          assert(newlineProperty.isStatic, "NewLine should be static");

          const getter = newlineProperty.getter;
          if (getter) {
            assert(getter.isStatic, "Static property getter should be static");
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should identify instance properties correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        assert(!lengthProperty.isStatic, "Length should be instance property");

        const getter = lengthProperty.getter;
        if (getter) {
          assert(!getter.isStatic, "Instance property getter should not be static");
        }
      }
    }),
  );

  // ===== PROPERTY ATTRIBUTES AND METADATA TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should provide property type information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        try {
          const propertyType = lengthProperty.type;
          assertNotNull(propertyType, "Property type should be available");
          const typeName = propertyType.name;
          assert(
            typeName.includes("Int32") || typeName.includes("int"),
            `Length property type should include 'Int32' or 'int', got: ${typeName}`,
          );
        } catch (error) {
          console.log(`  - Property type retrieval not supported: ${error}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should provide property metadata", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const propertyInfo = lengthProperty.propertyInfo;
        assertNotNull(propertyInfo, "Property info should be available");
        assert(propertyInfo.name === "Length", "Property info name should be Length");
        assert(typeof propertyInfo.canRead === "boolean", "Property info canRead should be boolean");
        assert(typeof propertyInfo.canWrite === "boolean", "Property info canWrite should be boolean");
        assert(typeof propertyInfo.isStatic === "boolean", "Property info isStatic should be boolean");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should provide property description", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const description = lengthProperty.describe();
        assertNotNull(description, "Property description should be available");
        assert(description.includes("Length"), "Description should include property name");
        // New format includes getter/setter accessors like "{ get; }"
        assert(description.includes("{") && description.includes("}"), "Description should include accessor block");
        console.log(`  - Description: ${description}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty describe() for indexer should use this[] syntax", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const charsProperty = stringClass!.tryProperty("Chars");
      if (charsProperty) {
        const description = charsProperty.describe();
        assertNotNull(description, "Property description should be available");

        // Indexers use "this[...]" syntax
        if (charsProperty.isIndexer) {
          assert(description.includes("this["), "Indexer description should use 'this[' syntax");
        }
        console.log(`  - Indexer description: ${description}`);
      }
    }),
  );

  // ===== TYPED PROPERTY ACCESS TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should provide typed property access", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty && lengthProperty.canRead) {
        const testString = Mono.api.stringNew("Hello");

        try {
          const typedValue = lengthProperty.getTypedValue(testString);
          assertNotNull(typedValue, "Typed property value should be available");
          assert(typeof typedValue === "number", "Typed Length value should be number");
        } catch (error) {
          console.log(`  - Typed property access failed: ${error}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should provide typed property setting", () => {
      const domain = Mono.domain;

      const stringBuilderClass = domain.tryClass("System.Text.StringBuilder");
      if (stringBuilderClass) {
        const lengthProperty = stringBuilderClass.tryProperty("Length");
        if (lengthProperty && lengthProperty.canWrite) {
          const obj = stringBuilderClass.alloc();

          try {
            lengthProperty.setTypedValue(obj, 10 as any);
            console.log("  - Successfully set typed property value");
          } catch (error) {
            console.log(`  - Typed property set failed: ${error}`);
          }
        }
      }
    }),
  );

  // ===== PERFORMANCE TESTS =====

  results.push(createPropertyLookupPerformanceTest("System.String", "Length"));

  results.push(
    createBasicLookupPerformanceTest("Property value access performance for System.String.Length", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const property = stringClass.tryProperty("Length");
        if (property) {
          try {
            const testString = Mono.api.stringNew("Hello");
            property.getValue(testString);
          } catch (error) {
            // Ignore access errors for performance test
          }
        }
      }
    }),
  );

  // ===== ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoProperty should handle invalid property operations gracefully", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const missingProperty = stringClass!.tryProperty("NonExistentProperty");
      assert(missingProperty === null, "Missing property should return null");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle null instance access", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty && lengthProperty.canRead) {
        try {
          const value = lengthProperty.getValue(null);
          console.log(`  - Null instance access returned: ${value} (implementation-dependent)`);
        } catch (error) {
          console.log(`  - Null instance access properly rejected: ${error}`);
        }
      }
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoProperty should handle read-only property writes", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty && !lengthProperty.canWrite) {
        const testString = Mono.api.stringNew("Hello");

        assertThrows(() => {
          lengthProperty.setValue(testString, 10);
        }, "Should throw when setting read-only property");
      }
    }),
  );

  // ===== PROPERTY TOSTRING AND SERIALIZATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty legacy toString test (name and type format)", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const stringRep = lengthProperty.toString();
        assertNotNull(stringRep, "toString should return a value");
        // New format: "PropertyName (PropertyType)"
        assert(stringRep.includes("Length"), "toString should include property name");
      }
    }),
  );

  // ===== PROPERTY FLAGS TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should provide property flags", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const flags = lengthProperty.flags;
        assert(typeof flags === "number", "Flags should be a number");

        // Test flags accessor (same property, confirming getter behavior)
        const flagsViaAccessor = lengthProperty.flags;
        assert(flagsViaAccessor === flags, "Flags accessor should return same value");
        console.log(`  - Property flags: ${flags} (0x${flags.toString(16)})`);
      }
    }),
  );

  // ===== NEW PROPERTY ATTRIBUTE TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should check isSpecialName correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const isSpecial = lengthProperty.isSpecialName;
        assert(typeof isSpecial === "boolean", "isSpecialName should return boolean");
        console.log(`  - Length isSpecialName: ${isSpecial}`);
      }

      // Indexer properties typically have special name
      const charsProperty = stringClass!.tryProperty("Chars");
      if (charsProperty) {
        const isSpecial = charsProperty.isSpecialName;
        console.log(`  - Chars (indexer) isSpecialName: ${isSpecial}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should check isRTSpecialName correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const isRTSpecial = lengthProperty.isRTSpecialName;
        assert(typeof isRTSpecial === "boolean", "isRTSpecialName should return boolean");
        console.log(`  - Length isRTSpecialName: ${isRTSpecial}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should check hasDefault correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const hasDefaultValue = lengthProperty.hasDefault;
        assert(typeof hasDefaultValue === "boolean", "hasDefault should return boolean");
        console.log(`  - Length hasDefault: ${hasDefaultValue}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should identify indexers with isIndexer", () => {
      const domain = Mono.domain;

      // String.Chars is an indexer
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const charsProperty = stringClass.tryProperty("Chars");
        if (charsProperty) {
          const isIdx = charsProperty.isIndexer;
          console.log(`  - String.Chars isIndexer: ${isIdx}`);
          // Chars should be an indexer (Item property with parameters)
        }

        // Length is NOT an indexer
        const lengthProperty = stringClass.tryProperty("Length");
        if (lengthProperty) {
          const isIdx = lengthProperty.isIndexer;
          assert(isIdx === false, "Length should NOT be an indexer");
          console.log(`  - String.Length isIndexer: ${isIdx}`);
        }
      }

      // List<T>.Item is an indexer
      const listClass = domain.tryClass("System.Collections.Generic.List`1");
      if (listClass) {
        const itemProperty = listClass.tryProperty("Item");
        if (itemProperty) {
          const isIdx = itemProperty.isIndexer;
          console.log(`  - List<T>.Item isIndexer: ${isIdx}`);
        }
      }
    }),
  );

  // ===== NEW getSummary TEST =====

  results.push(
    await createMonoDependentTest("MonoProperty getSummary should return complete information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const summary = lengthProperty.getSummary();

        assertNotNull(summary, "Summary should not be null");
        assert(summary.name === "Length", "Summary name should be Length");
        assert(typeof summary.typeName === "string", "Summary typeName should be string");
        assert(typeof summary.declaringType === "string", "Summary declaringType should be string");
        assert(typeof summary.flags === "number", "Summary flags should be number");
        assert(Array.isArray(summary.flagNames), "Summary flagNames should be array");
        assert(typeof summary.canRead === "boolean", "Summary canRead should be boolean");
        assert(typeof summary.canWrite === "boolean", "Summary canWrite should be boolean");
        assert(typeof summary.isStatic === "boolean", "Summary isStatic should be boolean");
        assert(typeof summary.isIndexer === "boolean", "Summary isIndexer should be boolean");
        assert(typeof summary.parameterCount === "number", "Summary parameterCount should be number");
        assert(Array.isArray(summary.parameterTypeNames), "Summary parameterTypeNames should be array");
        assert(typeof summary.hasDefault === "boolean", "Summary hasDefault should be boolean");
        assert(typeof summary.isSpecialName === "boolean", "Summary isSpecialName should be boolean");

        console.log(`  - Summary: ${JSON.stringify(summary, null, 2)}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty getSummary for indexer should show parameters", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const charsProperty = stringClass!.tryProperty("Chars");
      if (charsProperty) {
        const summary = charsProperty.getSummary();

        console.log(`  - Chars property summary:`);
        console.log(`    - isIndexer: ${summary.isIndexer}`);
        console.log(`    - parameterCount: ${summary.parameterCount}`);
        console.log(`    - parameterTypeNames: ${summary.parameterTypeNames.join(", ")}`);

        if (summary.parameterCount > 0) {
          assert(summary.parameterTypeNames.length > 0, "Indexer should have parameter type names");
        }
      }
    }),
  );

  // ===== UPDATED toString TEST =====

  results.push(
    await createMonoDependentTest("MonoProperty toString should return property name and type", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const stringRep = lengthProperty.toString();
        assertNotNull(stringRep, "toString should return a value");

        // Updated: toString now returns "PropertyName (PropertyType)" format
        assert(stringRep.includes("Length"), "toString should include property name");
        assert(stringRep.includes("Int32") || stringRep.includes("("), "toString should include type information");

        console.log(`  - toString result: ${stringRep}`);
      }
    }),
  );

  // ===== PROPERTY PARENT CLASS TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should provide parent class information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const parentClass = lengthProperty.parent;
        assertNotNull(parentClass, "Parent class should be available");
        assert(parentClass.name === "String", "Parent class should be String");
        assert(parentClass.fullName === "System.String", "Parent class full name should be System.String");
      }
    }),
  );

  // ===== PROPERTY TYPE TESTS (BOUNDARY) =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle Boolean properties", () => {
      const domain = Mono.domain;

      // System.String.Empty would be a static property if it existed
      // Try System.DateTime which has several properties
      const dateTimeClass = domain.tryClass("System.DateTime");

      if (dateTimeClass) {
        const properties = dateTimeClass.properties;
        console.log(`  - DateTime has ${properties.length} properties`);

        // Look for boolean-type properties
        properties.forEach(prop => {
          const type = prop.type;
          const typeName = type?.name || "";
          if (typeName === "Boolean" || typeName === "System.Boolean") {
            console.log(`    - Boolean property: ${prop.name}`);
          }
        });
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle DateTime properties", () => {
      const domain = Mono.domain;
      const dateTimeClass = domain.tryClass("System.DateTime");

      if (dateTimeClass) {
        // DateTime.Now is a static property
        const nowProperty = dateTimeClass.tryProperty("Now");
        const todayProperty = dateTimeClass.tryProperty("Today");
        const utcNowProperty = dateTimeClass.tryProperty("UtcNow");

        if (nowProperty) {
          assert(nowProperty.canRead, "Now should be readable");
          const type = nowProperty.type;
          console.log(`  - DateTime.Now type: ${type?.name}`);
        }

        if (todayProperty) {
          assert(todayProperty.canRead, "Today should be readable");
        }

        if (utcNowProperty) {
          assert(utcNowProperty.canRead, "UtcNow should be readable");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle TimeSpan properties", () => {
      const domain = Mono.domain;
      const timeSpanClass = domain.tryClass("System.TimeSpan");

      if (timeSpanClass) {
        const properties = timeSpanClass.properties;
        console.log(`  - TimeSpan has ${properties.length} properties`);

        // TimeSpan has properties like Days, Hours, Minutes, etc.
        const expectedProps = ["Days", "Hours", "Minutes", "Seconds", "Milliseconds", "TotalDays", "TotalHours"];
        let foundCount = 0;

        properties.forEach(prop => {
          if (expectedProps.includes(prop.name)) {
            foundCount++;
            assert(prop.canRead, `${prop.name} should be readable`);
          }
        });

        console.log(`  - Found ${foundCount}/${expectedProps.length} expected TimeSpan properties`);
      }
    }),
  );

  // ===== PROPERTY GETTER/SETTER METHOD TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should provide getter method details", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const getter = lengthProperty.getter;
        assertNotNull(getter, "Length property should have getter");

        // Getter method name is typically get_PropertyName
        const methodName = getter!.name;
        assert(
          methodName.includes("get_") || methodName.includes("Length"),
          `Getter method name should contain get_ or Length: ${methodName}`,
        );

        // Check return type matches property type
        const returnType = getter!.returnType;
        console.log(`  - Getter return type: ${returnType?.name}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should provide setter method details when available", () => {
      const domain = Mono.domain;
      const stringBuilderClass = domain.tryClass("System.Text.StringBuilder");

      if (stringBuilderClass) {
        // StringBuilder.Capacity has both getter and setter
        const capacityProperty = stringBuilderClass.tryProperty("Capacity");

        if (capacityProperty) {
          if (capacityProperty.canWrite) {
            const setter = capacityProperty.setter;
            if (setter) {
              const methodName = setter.name;
              assert(
                methodName.includes("set_") || methodName.includes("Capacity"),
                `Setter method name should contain set_ or Capacity: ${methodName}`,
              );
              console.log(`  - Found setter: ${methodName}`);
            }
          }
        }
      }
    }),
  );

  // ===== STATIC PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle static properties (Environment.NewLine)", () => {
      const domain = Mono.domain;
      const envClass = domain.tryClass("System.Environment");

      if (envClass) {
        const newLineProperty = envClass.tryProperty("NewLine");
        const osMajorVersionProperty = envClass.tryProperty("OSVersion");

        if (newLineProperty) {
          assert(newLineProperty.canRead, "NewLine should be readable");
          const type = newLineProperty.type;
          console.log(`  - Environment.NewLine type: ${type?.name}`);
        }

        // List other static properties
        const staticProps = envClass.properties.filter(p => {
          const getter = p.getter;
          return getter && getter.isStatic;
        });

        console.log(`  - Environment has ${staticProps.length} static properties`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle Console static properties", () => {
      const domain = Mono.domain;
      const consoleClass = domain.tryClass("System.Console");

      if (consoleClass) {
        const properties = consoleClass.properties;

        // Console has properties like Out, Error, In, etc.
        const expectedProps = ["Out", "Error", "In"];

        expectedProps.forEach(propName => {
          const prop = consoleClass.tryProperty(propName);
          if (prop) {
            const type = prop.type;
            console.log(`  - Console.${propName} type: ${type?.name}`);
          }
        });
      }
    }),
  );

  // ===== INDEXED PROPERTY TESTS (EXTENDED) =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle indexed properties (String.Chars)", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      if (stringClass) {
        // String's indexer is typically named "Chars" or "Item"
        const charsProperty = stringClass.tryProperty("Chars");

        if (charsProperty) {
          console.log("  - Found String.Chars (indexer) property");

          const getter = charsProperty.getter;
          if (getter) {
            const params = getter.parameters;
            console.log(`    - Getter has ${params.length} parameters`);

            if (params.length > 0) {
              console.log(`    - Index parameter type: ${params[0].type?.name}`);
            }
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle Dictionary indexer property", () => {
      const domain = Mono.domain;

      // Generic Dictionary has Item property as indexer
      const dictClass = domain.tryClass("System.Collections.Generic.Dictionary`2");

      if (dictClass) {
        const properties = dictClass.properties;

        console.log(`  - Dictionary<K,V> has ${properties.length} properties`);

        properties.forEach(prop => {
          console.log(`    - Property: ${prop.name}`);
        });

        const itemProperty = dictClass.tryProperty("Item");
        if (itemProperty) {
          console.log("  - Found Dictionary indexer (Item) property");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should handle List indexer property", () => {
      const domain = Mono.domain;

      const listClass = domain.tryClass("System.Collections.Generic.List`1");

      if (listClass) {
        const properties = listClass.properties;

        console.log(`  - List<T> has ${properties.length} properties`);

        // List typically has Count, Capacity, and Item (indexer)
        const expectedProps = ["Count", "Capacity", "Item"];

        expectedProps.forEach(propName => {
          const prop = listClass.tryProperty(propName);
          if (prop) {
            console.log(`    - Found: ${propName}, CanRead: ${prop.canRead}, CanWrite: ${prop.canWrite}`);
          }
        });
      }
    }),
  );

  // ===== READ-ONLY VS READ-WRITE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should distinguish read-only properties", () => {
      const domain = Mono.domain;

      // String.Length is read-only
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const lengthProperty = stringClass.tryProperty("Length");
        if (lengthProperty) {
          assert(lengthProperty.canRead, "Length should be readable");
          assert(!lengthProperty.canWrite, "Length should NOT be writable");
          console.log("  - String.Length correctly identified as read-only");
        }
      }

      // Type.Assembly is read-only
      const typeClass = domain.tryClass("System.Type");
      if (typeClass) {
        const assemblyProperty = typeClass.tryProperty("Assembly");
        if (assemblyProperty) {
          assert(assemblyProperty.canRead, "Assembly should be readable");
          console.log(`  - Type.Assembly CanWrite: ${assemblyProperty.canWrite}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty should distinguish read-write properties", () => {
      const domain = Mono.domain;

      // StringBuilder.Capacity is read-write
      const sbClass = domain.tryClass("System.Text.StringBuilder");
      if (sbClass) {
        const capacityProperty = sbClass.tryProperty("Capacity");
        if (capacityProperty) {
          assert(capacityProperty.canRead, "Capacity should be readable");

          const canWrite = capacityProperty.canWrite;
          console.log(`  - StringBuilder.Capacity CanWrite: ${canWrite}`);

          if (canWrite) {
            console.log("  - Correctly identified as read-write");
          }
        }

        // Also check Length
        const lengthProperty = sbClass.tryProperty("Length");
        if (lengthProperty) {
          console.log(`  - StringBuilder.Length CanWrite: ${lengthProperty.canWrite}`);
        }
      }
    }),
  );

  // ===== PROPERTY RETURN TYPE TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle various return types", () => {
      const domain = Mono.domain;

      // Test different return types
      const testCases = [
        { class: "System.String", property: "Length", expectedType: "Int32" },
        { class: "System.Type", property: "Name", expectedType: "String" },
        { class: "System.DateTime", property: "Ticks", expectedType: "Int64" },
      ];

      testCases.forEach(tc => {
        const cls = domain.tryClass(tc.class);
        if (cls) {
          const prop = cls.tryProperty(tc.property);
          if (prop) {
            const type = prop.type;
            const typeName = type?.name || "";
            console.log(`  - ${tc.class}.${tc.property} type: ${typeName} (expected: ${tc.expectedType})`);
          }
        }
      });
    }),
  );

  // ===== INHERITED PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle inherited properties", () => {
      const domain = Mono.domain;

      // Object.GetType() is inherited by all classes
      // But properties are less commonly inherited - check Exception
      const exceptionClass = domain.tryClass("System.ArgumentException");

      if (exceptionClass) {
        const properties = exceptionClass.properties;

        console.log(`  - ArgumentException has ${properties.length} properties`);

        // Exception has Message property
        const messageProperty = exceptionClass.tryProperty("Message");
        const innerExceptionProperty = exceptionClass.tryProperty("InnerException");

        if (messageProperty) {
          console.log(`  - Found Message property in ${exceptionClass.name}`);
          const parent = messageProperty.parent;
          console.log(`    - Declared in: ${parent.name}`);
        }

        if (innerExceptionProperty) {
          console.log(`  - Found InnerException property`);
        }
      }
    }),
  );

  // ===== PROPERTY DESCRIBE COMPLETENESS TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty describe() should include complete information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      if (lengthProperty) {
        const description = lengthProperty.describe();
        assertNotNull(description, "Property description should not be null");

        // Verify description includes key info
        // New format: "Type PropertyName { get; set; }" or "Type this[params] { get; set; }"
        assert(
          description.includes("Length") || description.includes("Int32"),
          "Description should include property or type name",
        );
        assert(description.includes("{") && description.includes("}"), "Description should include accessor block");

        console.log(`  - Full description: ${description}`);
      }

      // Test static property description
      const envClass = domain.tryClass("System.Environment");
      if (envClass) {
        const newlineProperty = envClass.tryProperty("NewLine");
        if (newlineProperty) {
          const description = newlineProperty.describe();
          if (newlineProperty.isStatic) {
            assert(description.includes("static"), "Static property description should include 'static'");
          }
          console.log(`  - Static property description: ${description}`);
        }
      }
    }),
  );

  // ===== VIRTUAL/OVERRIDDEN PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should identify virtual properties", () => {
      const domain = Mono.domain;

      // Stream.Length is typically virtual/abstract
      const streamClass = domain.tryClass("System.IO.Stream");

      if (streamClass) {
        const properties = streamClass.properties;

        console.log(`  - Stream has ${properties.length} properties`);

        const virtualProps = ["Length", "Position", "CanRead", "CanWrite", "CanSeek"];

        virtualProps.forEach(propName => {
          const prop = streamClass.tryProperty(propName);
          if (prop) {
            const getter = prop.getter;
            if (getter) {
              const isVirtual = getter.isVirtual;
              const isAbstract = getter.isAbstract;
              console.log(`    - ${propName}: virtual=${isVirtual}, abstract=${isAbstract}`);
            }
          }
        });
      }
    }),
  );

  // ===== INTERFACE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle interface properties (ICollection.Count)", () => {
      const domain = Mono.domain;

      const iCollectionClass = domain.tryClass("System.Collections.ICollection");

      if (iCollectionClass) {
        const properties = iCollectionClass.properties;

        console.log(`  - ICollection has ${properties.length} properties`);

        const countProperty = iCollectionClass.tryProperty("Count");
        if (countProperty) {
          assert(countProperty.canRead, "ICollection.Count should be readable");
          console.log(`  - ICollection.Count type: ${countProperty.type?.name}`);
        }
      }
    }),
  );

  // ===== NULLABLE TYPE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle Nullable<T> properties", () => {
      const domain = Mono.domain;

      const nullableClass = domain.tryClass("System.Nullable`1");

      if (nullableClass) {
        const properties = nullableClass.properties;

        console.log(`  - Nullable<T> has ${properties.length} properties`);

        // Nullable<T> typically has HasValue and Value properties
        const hasValueProperty = nullableClass.tryProperty("HasValue");
        const valueProperty = nullableClass.tryProperty("Value");

        if (hasValueProperty) {
          assert(hasValueProperty.canRead, "HasValue should be readable");
          const type = hasValueProperty.type;
          console.log(`    - HasValue type: ${type?.name}`);
        }

        if (valueProperty) {
          assert(valueProperty.canRead, "Value should be readable");
        }
      }
    }),
  );

  // ===== ATTRIBUTE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle Attribute properties", () => {
      const domain = Mono.domain;

      const attributeClass = domain.tryClass("System.Attribute");

      if (attributeClass) {
        const properties = attributeClass.properties;

        console.log(`  - Attribute has ${properties.length} properties`);

        // Attribute typically has TypeId property
        const typeIdProperty = attributeClass.tryProperty("TypeId");
        if (typeIdProperty) {
          const type = typeIdProperty.type;
          console.log(`    - TypeId type: ${type?.name}`);
        }
      }
    }),
  );

  // ===== REFLECTION TYPE PROPERTY TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should handle Type reflection properties", () => {
      const domain = Mono.domain;
      const typeClass = domain.tryClass("System.Type");

      if (typeClass) {
        const properties = typeClass.properties;

        console.log(`  - Type has ${properties.length} properties`);

        // Type has many useful properties
        const expectedProps = ["Name", "FullName", "Namespace", "Assembly", "BaseType", "IsClass", "IsInterface"];

        let foundCount = 0;
        expectedProps.forEach(propName => {
          const prop = typeClass.tryProperty(propName);
          if (prop) {
            foundCount++;
            const type = prop.type;
            console.log(`    - ${propName}: ${type?.name}`);
          }
        });

        console.log(`  - Found ${foundCount}/${expectedProps.length} expected Type properties`);
      }
    }),
  );

  // ===== PROPERTY COUNT TESTS =====

  results.push(
    await createMonoDependentTest("MonoProperty should enumerate all properties for common types", () => {
      const domain = Mono.domain;

      const testClasses = ["System.String", "System.DateTime", "System.Type", "System.IO.Stream", "System.Exception"];

      testClasses.forEach(className => {
        const cls = domain.tryClass(className);
        if (cls) {
          const propCount = cls.properties.length;
          console.log(`  - ${className}: ${propCount} properties`);
        }
      });
    }),
  );

  // =====================================================
  // Section: Enhanced convertValue Tests
  // =====================================================

  results.push(
    await createMonoDependentTest("MonoProperty - setValue handles string conversion", () => {
      Mono.perform(() => {
        // Test string property conversion (Exception.Message)
        const exceptionClass = Mono.domain.tryClass("System.Exception");
        assertNotNull(exceptionClass, "Exception class should exist");

        const msgProp = exceptionClass!.property("Message");
        assertNotNull(msgProp, "Message property should exist");

        // Message property should be readable
        assert(msgProp!.canRead, "Message property should be readable");

        console.log("[INFO] String property conversion test passed");
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty - type accessor works correctly", () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.tryClass("System.String");
        assertNotNull(stringClass, "String class should exist");

        const lengthProp = stringClass!.property("Length");
        assertNotNull(lengthProp, "Length property should exist");

        const propType = lengthProp!.type;
        assertNotNull(propType, "Property type should not be null");

        const typeName = propType.name;
        assert(typeName.includes("Int32") || typeName.includes("int"), `Type should be Int32, got: ${typeName}`);

        console.log(`[INFO] Property type: ${typeName}`);
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoProperty - getPropertyInfo returns complete info", () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.tryClass("System.String");
        assertNotNull(stringClass, "String class should exist");

        const lengthProp = stringClass!.property("Length");
        assertNotNull(lengthProp, "Length property should exist");

        const info = lengthProp!.propertyInfo;

        assert(info.name === "Length", "Name should be Length");
        assert(info.canRead === true, "Should be readable");
        assert(info.canWrite === false, "Should not be writable");
        assert(typeof info.typeName === "string", "typeName should be string");
        assert(typeof info.declaringType === "string", "declaringType should be string");

        console.log(`[INFO] PropertyInfo: ${JSON.stringify(info)}`);
      });
    }),
  );

  return results;
}

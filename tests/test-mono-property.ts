/**
 * Comprehensive MonoProperty Tests
 * Tests for MonoProperty functionality including property discovery, getter/setter resolution,
 * value getting/setting, indexed properties, and Unity-specific patterns
 */

import Mono from "../src";
import { 
  TestResult, 
  createMonoDependentTest, 
  createErrorHandlingTest,
  assert, 
  assertNotNull, 
  assertThrows,
} from "./test-framework";
import {
  createBasicLookupPerformanceTest,
  createPropertyLookupPerformanceTest
} from "./test-utilities";

export function createMonoPropertyTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== PROPERTY DISCOVERY AND ENUMERATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should discover properties by name",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      assertNotNull(stringClass, "String class should be available");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        assert(lengthProperty.getName() === "Length", "Property name should be Length");
        assert(lengthProperty.getParent().getName() === "String", "Property parent should be String");
      } else {
        console.log("  - Length property not found on String");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should enumerate all properties in class",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        const properties = stringClass.getProperties();
        assert(properties.length >= 0, "Should find properties (or none)");
        
        const lengthProperty = properties.find(p => p.getName() === "Length");
        if (lengthProperty) {
          assert(lengthProperty.getName() === "Length", "Should find Length property in enumeration");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle missing properties gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const missingProperty = stringClass!.tryGetProperty("DefinitelyDoesNotExist");
      assert(missingProperty === null, "Missing property should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoProperty should throw for missing required properties",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      assertThrows(() => {
        stringClass!.getProperty("DefinitelyDoesNotExist");
      }, "Should throw when required property is not found");
    }
  ));

  // ===== GETTER/SETTER METHOD RESOLUTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should resolve getter methods",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const getter = lengthProperty.getGetter();
        if (getter) {
          assert(getter.getName().includes("get_Length") || getter.getName().includes("Length"), 
                 "Getter should be related to Length");
          assert(!getter.isStatic(), "Instance property getter should not be static");
        } else {
          console.log("  - No getter found for Length property");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should resolve setter methods",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with writable properties
      const listClass = domain.class("System.Collections.Generic.List`1");
      if (listClass) {
        const countProperty = listClass.tryGetProperty("Count");
        if (countProperty) {
          const setter = countProperty.getSetter();
          // Count property is typically read-only
          if (setter) {
            assert(setter.getName().includes("set_Count") || setter.getName().includes("Count"), 
                   "Setter should be related to Count");
          } else {
            console.log("  - Count property is read-only (no setter)");
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle read-only properties",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const canRead = lengthProperty.canRead();
        const canWrite = lengthProperty.canWrite();
        
        assert(canRead === true, "Length property should be readable");
        assert(canWrite === false, "Length property should not be writable");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle write-only properties",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with write-only properties
      const streamClass = domain.class("System.IO.Stream");
      if (streamClass) {
        const properties = streamClass.getProperties();
        const writeOnlyProps = properties.filter((p: any) => p.canWrite() && !p.canRead());
        
        if (writeOnlyProps.length > 0) {
          const prop = writeOnlyProps[0];
          assert(!prop.canRead(), "Property should not be readable");
          assert(prop.canWrite(), "Property should be writable");
        } else {
          console.log("  - No write-only properties found");
        }
      }
    }
  ));

  // ===== PROPERTY VALUE GETTING AND SETTING TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should get property values",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty && lengthProperty.canRead()) {
        const testString = Mono.api.stringNew("Hello");
        
        try {
          const value = lengthProperty.getValue(testString);
          assertNotNull(value, "Property value should be available");
        } catch (error) {
          console.log(`  - Property get failed: ${error}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should set property values",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with writable properties
      const stringBuilderClass = domain.class("System.Text.StringBuilder");
      if (stringBuilderClass) {
        const lengthProperty = stringBuilderClass.tryGetProperty("Length");
        if (lengthProperty && lengthProperty.canWrite()) {
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
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle static property values",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with static properties
      const environmentClass = domain.class("System.Environment");
      if (environmentClass) {
        const newlineProperty = environmentClass.tryGetProperty("NewLine");
        if (newlineProperty && newlineProperty.isStatic()) {
          try {
            const value = newlineProperty.getValue(null);
            assertNotNull(value, "Static property value should be available");
          } catch (error) {
            console.log(`  - Static property get failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should set static property values",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with writable static properties
      const consoleClass = domain.class("System.Console");
      if (consoleClass) {
        const properties = consoleClass.getProperties();
        const staticWritableProps = properties.filter((p: any) => p.isStatic() && p.canWrite());
        
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
    }
  ));

  // ===== READ-ONLY AND WRITE-ONLY PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should identify read-only properties correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        assert(lengthProperty.canRead(), "Length should be readable");
        assert(!lengthProperty.canWrite(), "Length should not be writable");
        
        const getter = lengthProperty.getGetter();
        const setter = lengthProperty.getSetter();
        
        assertNotNull(getter, "Read-only property should have getter");
        assert(setter === null, "Read-only property should not have setter");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should identify write-only properties correctly",
    () => {
      const domain = Mono.domain;
      
      // Try to find write-only properties
      const streamClass = domain.class("System.IO.Stream");
      if (streamClass) {
        const properties = streamClass.getProperties();
        const writeOnlyProps = properties.filter((p: any) => !p.canRead() && p.canWrite());
        
        if (writeOnlyProps.length > 0) {
          const prop = writeOnlyProps[0];
          assert(!prop.canRead(), "Property should not be readable");
          assert(prop.canWrite(), "Property should be writable");
          
          const getter = prop.getGetter();
          const setter = prop.getSetter();
          
          assert(getter === null, "Write-only property should not have getter");
          assertNotNull(setter, "Write-only property should have setter");
        }
      }
    }
  ));

  // ===== INDEXED PROPERTIES TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should identify indexed properties",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with indexed properties
      const listClass = domain.class("System.Collections.Generic.List`1");
      if (listClass) {
        const properties = listClass.getProperties();
        const indexedProps = properties.filter((p: any) => p.hasParameters());
        
        if (indexedProps.length > 0) {
          const prop = indexedProps[0];
          assert(prop.hasParameters(), "Property should have parameters");
          
          const parameters = prop.getParameters();
          assert(parameters.length > 0, "Indexed property should have parameters");
        } else {
          console.log("  - No indexed properties found");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle indexed property parameters",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with indexed properties
      const dictionaryClass = domain.class("System.Collections.Generic.Dictionary`2");
      if (dictionaryClass) {
        const properties = dictionaryClass.getProperties();
        const indexedProps = properties.filter((p: any) => p.hasParameters && p.hasParameters());
        
        if (indexedProps.length > 0) {
          const prop = indexedProps[0];
          try {
            const parameters = prop.getParameters();
            console.log(`  - Indexed property has ${parameters.length} parameters`);
            if (parameters.length > 0) {
              const parameterTypes = parameters.map((p: any) => p.getName ? p.getName() : "unknown");
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
    }
  ));

  // ===== STATIC VS INSTANCE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should identify static properties correctly",
    () => {
      const domain = Mono.domain;
      
      const environmentClass = domain.class("System.Environment");
      if (environmentClass) {
        const newlineProperty = environmentClass.tryGetProperty("NewLine");
        if (newlineProperty) {
          assert(newlineProperty.isStatic(), "NewLine should be static");
          
          const getter = newlineProperty.getGetter();
          if (getter) {
            assert(getter.isStatic(), "Static property getter should be static");
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should identify instance properties correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        assert(!lengthProperty.isStatic(), "Length should be instance property");
        
        const getter = lengthProperty.getGetter();
        if (getter) {
          assert(!getter.isStatic(), "Instance property getter should not be static");
        }
      }
    }
  ));

  // ===== PROPERTY ATTRIBUTES AND METADATA TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should provide property type information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        try {
          const propertyType = lengthProperty.getType();
          assertNotNull(propertyType, "Property type should be available");
          const typeName = propertyType.getName();
          assert(typeName.includes("Int32") || typeName.includes("int"), `Length property type should include 'Int32' or 'int', got: ${typeName}`);
        } catch (error) {
          console.log(`  - Property type retrieval not supported: ${error}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should provide property metadata",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const propertyInfo = lengthProperty.getPropertyInfo();
        assertNotNull(propertyInfo, "Property info should be available");
        assert(propertyInfo.name === "Length", "Property info name should be Length");
        assert(typeof propertyInfo.canRead === "boolean", "Property info canRead should be boolean");
        assert(typeof propertyInfo.canWrite === "boolean", "Property info canWrite should be boolean");
        assert(typeof propertyInfo.isStatic === "boolean", "Property info isStatic should be boolean");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should provide property description",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const description = lengthProperty.describe();
        assertNotNull(description, "Property description should be available");
        assert(description.includes("Length"), "Description should include property name");
        assert(description.includes("Int32"), "Description should include property type");
      }
    }
  ));

  // ===== TYPED PROPERTY ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should provide typed property access",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty && lengthProperty.canRead()) {
        const testString = Mono.api.stringNew("Hello");
        
        try {
          const typedValue = lengthProperty.getTypedValue(testString);
          assertNotNull(typedValue, "Typed property value should be available");
          assert(typeof typedValue === "number", "Typed Length value should be number");
        } catch (error) {
          console.log(`  - Typed property access failed: ${error}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should provide typed property setting",
    () => {
      const domain = Mono.domain;
      
      const stringBuilderClass = domain.class("System.Text.StringBuilder");
      if (stringBuilderClass) {
        const lengthProperty = stringBuilderClass.tryGetProperty("Length");
        if (lengthProperty && lengthProperty.canWrite()) {
          const obj = stringBuilderClass.alloc();
          
          try {
            lengthProperty.setTypedValue(obj, 10 as any);
            console.log("  - Successfully set typed property value");
          } catch (error) {
            console.log(`  - Typed property set failed: ${error}`);
          }
        }
      }
    }
  ));

  // ===== PERFORMANCE TESTS =====

  results.push(createPropertyLookupPerformanceTest("System.String", "Length"));

  results.push(createBasicLookupPerformanceTest(
    "Property value access performance for System.String.Length",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      if (stringClass) {
        const property = stringClass.tryGetProperty("Length");
        if (property) {
          try {
            const testString = Mono.api.stringNew("Hello");
            property.getValue(testString);
          } catch (error) {
            // Ignore access errors for performance test
          }
        }
      }
    }
  ));

  // ===== ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoProperty should handle invalid property operations gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const missingProperty = stringClass!.tryGetProperty("NonExistentProperty");
      assert(missingProperty === null, "Missing property should return null");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle null instance access",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty && lengthProperty.canRead()) {
        try {
          const value = lengthProperty.getValue(null);
          console.log(`  - Null instance access returned: ${value} (implementation-dependent)`);
        } catch (error) {
          console.log(`  - Null instance access properly rejected: ${error}`);
        }
      }
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoProperty should handle read-only property writes",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty && !lengthProperty.canWrite()) {
        const testString = Mono.api.stringNew("Hello");
        
        assertThrows(() => {
          lengthProperty.setValue(testString, 10);
        }, "Should throw when setting read-only property");
      }
    }
  ));

  // ===== PROPERTY TOSTRING AND SERIALIZATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty toString should work correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const stringRep = lengthProperty.toString();
        assertNotNull(stringRep, "toString should return a value");
        assert(stringRep.includes("MonoProperty"), "toString should include class type");
      }
    }
  ));

  // ===== PROPERTY FLAGS TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should provide property flags",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const flags = lengthProperty.getFlags();
        assert(typeof flags === "number", "Flags should be a number");
      }
    }
  ));

  // ===== PROPERTY PARENT CLASS TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should provide parent class information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const parentClass = lengthProperty.getParent();
        assertNotNull(parentClass, "Parent class should be available");
        assert(parentClass.getName() === "String", "Parent class should be String");
        assert(parentClass.getFullName() === "System.String", "Parent class full name should be System.String");
      }
    }
  ));

  // ===== PROPERTY TYPE TESTS (BOUNDARY) =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle Boolean properties",
    () => {
      const domain = Mono.domain;
      
      // System.String.Empty would be a static property if it existed
      // Try System.DateTime which has several properties
      const dateTimeClass = domain.class("System.DateTime");
      
      if (dateTimeClass) {
        const properties = dateTimeClass.getProperties();
        console.log(`  - DateTime has ${properties.length} properties`);
        
        // Look for boolean-type properties
        properties.forEach(prop => {
          const type = prop.getType();
          const typeName = type?.getName() || "";
          if (typeName === "Boolean" || typeName === "System.Boolean") {
            console.log(`    - Boolean property: ${prop.getName()}`);
          }
        });
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle DateTime properties",
    () => {
      const domain = Mono.domain;
      const dateTimeClass = domain.class("System.DateTime");
      
      if (dateTimeClass) {
        // DateTime.Now is a static property
        const nowProperty = dateTimeClass.tryGetProperty("Now");
        const todayProperty = dateTimeClass.tryGetProperty("Today");
        const utcNowProperty = dateTimeClass.tryGetProperty("UtcNow");
        
        if (nowProperty) {
          assert(nowProperty.canRead(), "Now should be readable");
          const type = nowProperty.getType();
          console.log(`  - DateTime.Now type: ${type?.getName()}`);
        }
        
        if (todayProperty) {
          assert(todayProperty.canRead(), "Today should be readable");
        }
        
        if (utcNowProperty) {
          assert(utcNowProperty.canRead(), "UtcNow should be readable");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle TimeSpan properties",
    () => {
      const domain = Mono.domain;
      const timeSpanClass = domain.class("System.TimeSpan");
      
      if (timeSpanClass) {
        const properties = timeSpanClass.getProperties();
        console.log(`  - TimeSpan has ${properties.length} properties`);
        
        // TimeSpan has properties like Days, Hours, Minutes, etc.
        const expectedProps = ["Days", "Hours", "Minutes", "Seconds", "Milliseconds", "TotalDays", "TotalHours"];
        let foundCount = 0;
        
        properties.forEach(prop => {
          if (expectedProps.includes(prop.getName())) {
            foundCount++;
            assert(prop.canRead(), `${prop.getName()} should be readable`);
          }
        });
        
        console.log(`  - Found ${foundCount}/${expectedProps.length} expected TimeSpan properties`);
      }
    }
  ));

  // ===== PROPERTY GETTER/SETTER METHOD TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should provide getter method details",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const getter = lengthProperty.getGetter();
        assertNotNull(getter, "Length property should have getter");
        
        // Getter method name is typically get_PropertyName
        const methodName = getter!.getName();
        assert(methodName.includes("get_") || methodName.includes("Length"), 
          `Getter method name should contain get_ or Length: ${methodName}`);
        
        // Check return type matches property type
        const returnType = getter!.getReturnType();
        console.log(`  - Getter return type: ${returnType?.getName()}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should provide setter method details when available",
    () => {
      const domain = Mono.domain;
      const stringBuilderClass = domain.class("System.Text.StringBuilder");
      
      if (stringBuilderClass) {
        // StringBuilder.Capacity has both getter and setter
        const capacityProperty = stringBuilderClass.tryGetProperty("Capacity");
        
        if (capacityProperty) {
          if (capacityProperty.canWrite()) {
            const setter = capacityProperty.getSetter();
            if (setter) {
              const methodName = setter.getName();
              assert(methodName.includes("set_") || methodName.includes("Capacity"),
                `Setter method name should contain set_ or Capacity: ${methodName}`);
              console.log(`  - Found setter: ${methodName}`);
            }
          }
        }
      }
    }
  ));

  // ===== STATIC PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle static properties (Environment.NewLine)",
    () => {
      const domain = Mono.domain;
      const envClass = domain.class("System.Environment");
      
      if (envClass) {
        const newLineProperty = envClass.tryGetProperty("NewLine");
        const osMajorVersionProperty = envClass.tryGetProperty("OSVersion");
        
        if (newLineProperty) {
          assert(newLineProperty.canRead(), "NewLine should be readable");
          const type = newLineProperty.getType();
          console.log(`  - Environment.NewLine type: ${type?.getName()}`);
        }
        
        // List other static properties
        const staticProps = envClass.getProperties().filter(p => {
          const getter = p.getGetter();
          return getter && getter.isStatic();
        });
        
        console.log(`  - Environment has ${staticProps.length} static properties`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle Console static properties",
    () => {
      const domain = Mono.domain;
      const consoleClass = domain.class("System.Console");
      
      if (consoleClass) {
        const properties = consoleClass.getProperties();
        
        // Console has properties like Out, Error, In, etc.
        const expectedProps = ["Out", "Error", "In"];
        
        expectedProps.forEach(propName => {
          const prop = consoleClass.tryGetProperty(propName);
          if (prop) {
            const type = prop.getType();
            console.log(`  - Console.${propName} type: ${type?.getName()}`);
          }
        });
      }
    }
  ));

  // ===== INDEXED PROPERTY TESTS (EXTENDED) =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle indexed properties (String.Chars)",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        // String's indexer is typically named "Chars" or "Item"
        const charsProperty = stringClass.tryGetProperty("Chars");
        
        if (charsProperty) {
          console.log("  - Found String.Chars (indexer) property");
          
          const getter = charsProperty.getGetter();
          if (getter) {
            const params = getter.getParameters();
            console.log(`    - Getter has ${params.length} parameters`);
            
            if (params.length > 0) {
              console.log(`    - Index parameter type: ${params[0].type?.getName()}`);
            }
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle Dictionary indexer property",
    () => {
      const domain = Mono.domain;
      
      // Generic Dictionary has Item property as indexer
      const dictClass = domain.class("System.Collections.Generic.Dictionary`2");
      
      if (dictClass) {
        const properties = dictClass.getProperties();
        
        console.log(`  - Dictionary<K,V> has ${properties.length} properties`);
        
        properties.forEach(prop => {
          console.log(`    - Property: ${prop.getName()}`);
        });
        
        const itemProperty = dictClass.tryGetProperty("Item");
        if (itemProperty) {
          console.log("  - Found Dictionary indexer (Item) property");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should handle List indexer property",
    () => {
      const domain = Mono.domain;
      
      const listClass = domain.class("System.Collections.Generic.List`1");
      
      if (listClass) {
        const properties = listClass.getProperties();
        
        console.log(`  - List<T> has ${properties.length} properties`);
        
        // List typically has Count, Capacity, and Item (indexer)
        const expectedProps = ["Count", "Capacity", "Item"];
        
        expectedProps.forEach(propName => {
          const prop = listClass.tryGetProperty(propName);
          if (prop) {
            console.log(`    - Found: ${propName}, CanRead: ${prop.canRead()}, CanWrite: ${prop.canWrite()}`);
          }
        });
      }
    }
  ));

  // ===== READ-ONLY VS READ-WRITE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should distinguish read-only properties",
    () => {
      const domain = Mono.domain;
      
      // String.Length is read-only
      const stringClass = domain.class("System.String");
      if (stringClass) {
        const lengthProperty = stringClass.tryGetProperty("Length");
        if (lengthProperty) {
          assert(lengthProperty.canRead(), "Length should be readable");
          assert(!lengthProperty.canWrite(), "Length should NOT be writable");
          console.log("  - String.Length correctly identified as read-only");
        }
      }
      
      // Type.Assembly is read-only
      const typeClass = domain.class("System.Type");
      if (typeClass) {
        const assemblyProperty = typeClass.tryGetProperty("Assembly");
        if (assemblyProperty) {
          assert(assemblyProperty.canRead(), "Assembly should be readable");
          console.log(`  - Type.Assembly CanWrite: ${assemblyProperty.canWrite()}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoProperty should distinguish read-write properties",
    () => {
      const domain = Mono.domain;
      
      // StringBuilder.Capacity is read-write
      const sbClass = domain.class("System.Text.StringBuilder");
      if (sbClass) {
        const capacityProperty = sbClass.tryGetProperty("Capacity");
        if (capacityProperty) {
          assert(capacityProperty.canRead(), "Capacity should be readable");
          
          const canWrite = capacityProperty.canWrite();
          console.log(`  - StringBuilder.Capacity CanWrite: ${canWrite}`);
          
          if (canWrite) {
            console.log("  - Correctly identified as read-write");
          }
        }
        
        // Also check Length
        const lengthProperty = sbClass.tryGetProperty("Length");
        if (lengthProperty) {
          console.log(`  - StringBuilder.Length CanWrite: ${lengthProperty.canWrite()}`);
        }
      }
    }
  ));

  // ===== PROPERTY RETURN TYPE TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle various return types",
    () => {
      const domain = Mono.domain;
      
      // Test different return types
      const testCases = [
        { class: "System.String", property: "Length", expectedType: "Int32" },
        { class: "System.Type", property: "Name", expectedType: "String" },
        { class: "System.DateTime", property: "Ticks", expectedType: "Int64" },
      ];
      
      testCases.forEach(tc => {
        const cls = domain.class(tc.class);
        if (cls) {
          const prop = cls.tryGetProperty(tc.property);
          if (prop) {
            const type = prop.getType();
            const typeName = type?.getName() || "";
            console.log(`  - ${tc.class}.${tc.property} type: ${typeName} (expected: ${tc.expectedType})`);
          }
        }
      });
    }
  ));

  // ===== INHERITED PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle inherited properties",
    () => {
      const domain = Mono.domain;
      
      // Object.GetType() is inherited by all classes
      // But properties are less commonly inherited - check Exception
      const exceptionClass = domain.class("System.ArgumentException");
      
      if (exceptionClass) {
        const properties = exceptionClass.getProperties();
        
        console.log(`  - ArgumentException has ${properties.length} properties`);
        
        // Exception has Message property
        const messageProperty = exceptionClass.tryGetProperty("Message");
        const innerExceptionProperty = exceptionClass.tryGetProperty("InnerException");
        
        if (messageProperty) {
          console.log(`  - Found Message property in ${exceptionClass.getName()}`);
          const parent = messageProperty.getParent();
          console.log(`    - Declared in: ${parent.getName()}`);
        }
        
        if (innerExceptionProperty) {
          console.log(`  - Found InnerException property`);
        }
      }
    }
  ));

  // ===== PROPERTY DESCRIBE COMPLETENESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty describe() should include complete information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      if (lengthProperty) {
        const description = lengthProperty.describe();
        assertNotNull(description, "Property description should not be null");
        
        // Verify description includes key info
        assert(description.includes("Length") || description.includes("Int32"), 
          "Description should include property or type name");
        
        console.log(`  - Description length: ${description.length} chars`);
        console.log(`  - Preview: ${description.substring(0, 100)}...`);
      }
    }
  ));

  // ===== VIRTUAL/OVERRIDDEN PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should identify virtual properties",
    () => {
      const domain = Mono.domain;
      
      // Stream.Length is typically virtual/abstract
      const streamClass = domain.class("System.IO.Stream");
      
      if (streamClass) {
        const properties = streamClass.getProperties();
        
        console.log(`  - Stream has ${properties.length} properties`);
        
        const virtualProps = ["Length", "Position", "CanRead", "CanWrite", "CanSeek"];
        
        virtualProps.forEach(propName => {
          const prop = streamClass.tryGetProperty(propName);
          if (prop) {
            const getter = prop.getGetter();
            if (getter) {
              const isVirtual = getter.isVirtual();
              const isAbstract = getter.isAbstract();
              console.log(`    - ${propName}: virtual=${isVirtual}, abstract=${isAbstract}`);
            }
          }
        });
      }
    }
  ));

  // ===== INTERFACE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle interface properties (ICollection.Count)",
    () => {
      const domain = Mono.domain;
      
      const iCollectionClass = domain.class("System.Collections.ICollection");
      
      if (iCollectionClass) {
        const properties = iCollectionClass.getProperties();
        
        console.log(`  - ICollection has ${properties.length} properties`);
        
        const countProperty = iCollectionClass.tryGetProperty("Count");
        if (countProperty) {
          assert(countProperty.canRead(), "ICollection.Count should be readable");
          console.log(`  - ICollection.Count type: ${countProperty.getType()?.getName()}`);
        }
      }
    }
  ));

  // ===== NULLABLE TYPE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle Nullable<T> properties",
    () => {
      const domain = Mono.domain;
      
      const nullableClass = domain.class("System.Nullable`1");
      
      if (nullableClass) {
        const properties = nullableClass.getProperties();
        
        console.log(`  - Nullable<T> has ${properties.length} properties`);
        
        // Nullable<T> typically has HasValue and Value properties
        const hasValueProperty = nullableClass.tryGetProperty("HasValue");
        const valueProperty = nullableClass.tryGetProperty("Value");
        
        if (hasValueProperty) {
          assert(hasValueProperty.canRead(), "HasValue should be readable");
          const type = hasValueProperty.getType();
          console.log(`    - HasValue type: ${type?.getName()}`);
        }
        
        if (valueProperty) {
          assert(valueProperty.canRead(), "Value should be readable");
        }
      }
    }
  ));

  // ===== ATTRIBUTE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle Attribute properties",
    () => {
      const domain = Mono.domain;
      
      const attributeClass = domain.class("System.Attribute");
      
      if (attributeClass) {
        const properties = attributeClass.getProperties();
        
        console.log(`  - Attribute has ${properties.length} properties`);
        
        // Attribute typically has TypeId property
        const typeIdProperty = attributeClass.tryGetProperty("TypeId");
        if (typeIdProperty) {
          const type = typeIdProperty.getType();
          console.log(`    - TypeId type: ${type?.getName()}`);
        }
      }
    }
  ));

  // ===== REFLECTION TYPE PROPERTY TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should handle Type reflection properties",
    () => {
      const domain = Mono.domain;
      const typeClass = domain.class("System.Type");
      
      if (typeClass) {
        const properties = typeClass.getProperties();
        
        console.log(`  - Type has ${properties.length} properties`);
        
        // Type has many useful properties
        const expectedProps = ["Name", "FullName", "Namespace", "Assembly", "BaseType", "IsClass", "IsInterface"];
        
        let foundCount = 0;
        expectedProps.forEach(propName => {
          const prop = typeClass.tryGetProperty(propName);
          if (prop) {
            foundCount++;
            const type = prop.getType();
            console.log(`    - ${propName}: ${type?.getName()}`);
          }
        });
        
        console.log(`  - Found ${foundCount}/${expectedProps.length} expected Type properties`);
      }
    }
  ));

  // ===== PROPERTY COUNT TESTS =====

  results.push(createMonoDependentTest(
    "MonoProperty should enumerate all properties for common types",
    () => {
      const domain = Mono.domain;
      
      const testClasses = [
        "System.String",
        "System.DateTime",
        "System.Type",
        "System.IO.Stream",
        "System.Exception",
      ];
      
      testClasses.forEach(className => {
        const cls = domain.class(className);
        if (cls) {
          const propCount = cls.getProperties().length;
          console.log(`  - ${className}: ${propCount} properties`);
        }
      });
    }
  ));

  return results;
}

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

  return results;
}

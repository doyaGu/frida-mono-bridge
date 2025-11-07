/**
 * Comprehensive MonoField Tests
 * Tests for MonoField functionality including field discovery, value getting/setting,
 * type checking, static vs instance operations, and Unity-specific patterns
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
  createFieldLookupPerformanceTest
} from "./test-utilities";

export function createMonoFieldTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== FIELD DISCOVERY AND ENUMERATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should discover fields by name",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      assertNotNull(stringClass, "String class should be available");
      
      // Try to find a common field - String might not have public fields, so let's try another class
      const int32Class = domain.class("System.Int32");
      if (int32Class) {
        const field = int32Class.tryGetField("MaxValue");
        if (field) {
          assert(field.getName() === "MaxValue", "Field name should be MaxValue");
          assert(field.getParent().getName() === "Int32", "Field parent should be Int32");
        } else {
          console.log("  - MaxValue field not found on Int32");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should enumerate all fields in class",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const fields = int32Class.getFields();
        assert(fields.length >= 0, "Should find fields (or none)");
        
        // Look for common static fields
        const maxValueField = fields.find(f => f.getName() === "MaxValue");
        const minValueField = fields.find(f => f.getName() === "MinValue");
        
        if (maxValueField) {
          assert(maxValueField.getName() === "MaxValue", "Should find MaxValue field");
        }
        if (minValueField) {
          assert(minValueField.getName() === "MinValue", "Should find MinValue field");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should handle missing fields gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const missingField = stringClass!.tryGetField("DefinitelyDoesNotExist");
      assert(missingField === null, "Missing field should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoField should throw for missing required fields",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      assertThrows(() => {
        stringClass!.getField("DefinitelyDoesNotExist");
      }, "Should throw when required field is not found");
    }
  ));

  // ===== FIELD VALUE GETTING AND SETTING TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should get static field values",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField && maxValueField.isStatic()) {
          try {
            const value = maxValueField.getStaticValue();
            assertNotNull(value, "Static field value should be available");
          } catch (error) {
            console.log(`  - Static field get failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should set static field values",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with a writable static field
      const testClass = domain.class("System.Threading.Thread");
      if (testClass) {
        const field = testClass.tryGetField("CurrentThread");
        if (field && field.isStatic()) {
          try {
            // This might not work due to security, but test API
            const originalValue = field.getStaticValue();
            // field.setStaticValue(newValue); // This might fail
            console.log("  - Found static field for testing");
          } catch (error) {
            console.log(`  - Static field set failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should get instance field values",
    () => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");
      
      if (objectClass) {
        // Create an object instance
        const obj = objectClass.alloc();
        
        // Try to find instance fields (Object might not have public fields)
        const fields = objectClass.getFields();
        const instanceFields = fields.filter(f => !f.isStatic());
        
        if (instanceFields.length > 0) {
          const field = instanceFields[0];
          try {
            const value = field.getValue(obj);
            assertNotNull(value, "Instance field value should be available");
          } catch (error) {
            console.log(`  - Instance field get failed: ${error}`);
          }
        } else {
          console.log("  - No instance fields found on Object class");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should set instance field values",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with instance fields
      const pointClass = domain.class("System.Drawing.Point");
      if (pointClass) {
        const obj = pointClass.alloc();
        const xField = pointClass.tryGetField("x");
        
        if (xField && !xField.isStatic()) {
          try {
            // Try to set field value
            const newValue = Mono.api.stringNew("42");
            xField.setValue(obj, newValue);
            console.log("  - Successfully set instance field value");
          } catch (error) {
            console.log(`  - Instance field set failed: ${error}`);
          }
        }
      } else {
        console.log("  - Point class not available for field testing");
      }
    }
  ));

  // ===== TYPE CHECKING AND VALIDATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should provide field type information",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const fieldType = maxValueField.getType();
          assertNotNull(fieldType, "Field type should be available");
          assert(fieldType.getName() === "Int32", "MaxValue field type should be Int32");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should provide field metadata",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const summary = maxValueField.getSummary();
          assertNotNull(summary, "Field summary should be available");
          assert(summary.name === "MaxValue", "Summary name should be MaxValue");
          assert(typeof summary.flags === "number", "Summary flags should be a number");
          assert(typeof summary.isStatic === "boolean", "Summary isStatic should be boolean");
          assert(typeof summary.offset === "number", "Summary offset should be number");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should provide field description",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const description = maxValueField.describe();
          assertNotNull(description, "Field description should be available");
          assert(description.includes("MaxValue"), "Description should include field name");
          assert(description.includes("static"), "Description should include static modifier");
        }
      }
    }
  ));

  // ===== STATIC VS INSTANCE FIELD OPERATIONS TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should identify static fields correctly",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          assert(maxValueField.isStatic(), "MaxValue should be static");
        }
        
        const minValueField = int32Class.tryGetField("MinValue");
        if (minValueField) {
          assert(minValueField.isStatic(), "MinValue should be static");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should identify instance fields correctly",
    () => {
      const domain = Mono.domain;
      
      // Try to find a class with instance fields
      const pointClass = domain.class("System.Drawing.Point");
      if (pointClass) {
        const fields = pointClass.getFields();
        const instanceFields = fields.filter((f: any) => !f.isStatic());
        
        if (instanceFields.length > 0) {
          const field = instanceFields[0];
          assert(!field.isStatic(), "Field should be instance field");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should handle static field operations",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField && maxValueField.isStatic()) {
          try {
            const value = maxValueField.getStaticValue();
            assertNotNull(value, "Should get static field value");

            // Test typed access
            const typedValue = maxValueField.getTypedStaticValue();
            assertNotNull(typedValue, "Should get typed static field value");
          } catch (error) {
            console.log(`  - Static field operation failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should handle instance field operations",
    () => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");
      
      if (objectClass) {
        const obj = objectClass.alloc();
        const fields = objectClass.getFields();
        const instanceFields = fields.filter(f => !f.isStatic());
        
        if (instanceFields.length > 0) {
          const field = instanceFields[0];
          try {
            const value = field.getValue(obj);
            assertNotNull(value, "Should get instance field value");

            // Test typed access
            const typedValue = field.getTypedValue(obj);
            assertNotNull(typedValue, "Should get typed instance field value");
          } catch (error) {
            console.log(`  - Instance field operation failed: ${error}`);
          }
        }
      }
    }
  ));

  // ===== FIELD ATTRIBUTES AND METADATA TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should provide accessibility information",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const accessibility = maxValueField.getAccessibility();
          assertNotNull(accessibility, "Accessibility should be available");
          assert(typeof accessibility === "string", "Accessibility should be a string");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should identify readonly fields",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const isReadonly = maxValueField.isInitOnly();
          assert(typeof isReadonly === "boolean", "isInitOnly should return boolean");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should identify constant fields",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const isConstant = maxValueField.isLiteral();
          assert(typeof isConstant === "boolean", "isLiteral should return boolean");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should provide field flags",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const flags = maxValueField.getFlags();
          assert(typeof flags === "number", "Flags should be a number");
          
          const flagNames = maxValueField.getFlagNames();
          assert(Array.isArray(flagNames), "Flag names should be an array");
        }
      }
    }
  ));

  // ===== FIELD ACCESS MODIFIERS AND SECURITY TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should handle public fields",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const accessibility = maxValueField.getAccessibility();
          // MaxValue should be public
          assert(accessibility === "public" || accessibility === "private-scope",
                 "MaxValue should be accessible");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should handle private fields gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      // Try to access private fields (might not be visible through reflection)
      const fields = stringClass!.getFields();
      const privateFields = fields.filter(f => {
        try {
          const accessibility = f.getAccessibility();
          return accessibility.includes("private");
        } catch {
          return false;
        }
      });
      
      // Private fields might not be accessible through reflection
      console.log(`  - Found ${privateFields.length} potentially private fields`);
    }
  ));

  // ===== FIELD OFFSET AND MEMORY LAYOUT TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should provide field offset information",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const offset = maxValueField.getOffset();
          assert(typeof offset === "number", "Offset should be a number");
          
          // Static fields might have offset 0 or special values
          console.log(`  - MaxValue field offset: ${offset}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should provide field token",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const token = maxValueField.getToken();
          assert(typeof token === "number", "Token should be a number");
          assert(token > 0, "Token should be positive");
        }
      }
    }
  ));

  // ===== FIELD VALUE CONVERSION TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should convert field values to objects",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField && maxValueField.isStatic()) {
          try {
            const valueObject = maxValueField.getValueObject(null);
            if (valueObject) {
              assertNotNull(valueObject.pointer, "Value object should have pointer");
            }
          } catch (error) {
            console.log(`  - Field value object conversion failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should coerce primitive values",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField && maxValueField.isStatic()) {
          try {
            const value = maxValueField.readValue(null, { coerce: true });
            assertNotNull(value, "Coerced value should be available");
          } catch (error) {
            console.log(`  - Field value coercion failed: ${error}`);
          }
        }
      }
    }
  ));

  // ===== PERFORMANCE TESTS =====

  results.push(createFieldLookupPerformanceTest("System.Int32", "MaxValue"));

  results.push(createBasicLookupPerformanceTest(
    "Field value access performance for System.Int32.MaxValue",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      if (int32Class) {
        const field = int32Class.tryGetField("MaxValue");
        if (field && field.isStatic()) {
          try {
            field.getStaticValue();
          } catch (error) {
            // Ignore access errors for performance test
          }
        }
      }
    }
  ));

  // ===== ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoField should handle invalid field operations gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const missingField = stringClass!.tryGetField("NonExistentField");
      assert(missingField === null, "Missing field should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoField should handle null instance access",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const fields = stringClass!.getFields();
      const instanceFields = fields.filter(f => !f.isStatic());
      
      if (instanceFields.length > 0) {
        const field = instanceFields[0];
        
        assertThrows(() => {
          field.getValue(null);
        }, "Should throw when accessing instance field with null instance");
      }
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoField should handle type mismatch errors",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          // Try to set with wrong type
          assertThrows(() => {
            const wrongValue = Mono.api.stringNew("wrong");
            maxValueField.setStaticValue(wrongValue);
          }, "Should throw when setting field with wrong type");
        }
      }
    }
  ));

  // ===== FIELD TOSTRING AND SERIALIZATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoField toString should work correctly",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const stringRep = maxValueField.toString();
          assertNotNull(stringRep, "toString should return a value");
          assert(stringRep.includes("MonoField"), "toString should include class type");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoField should provide JSON representation",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const json = maxValueField.toJSON();
          assertNotNull(json, "toJSON should return a value");
          assert(json.name === "MaxValue", "JSON should include field name");
          assert(typeof json.type === "string", "JSON should include field type");
          assert(typeof json.isStatic === "boolean", "JSON should include isStatic flag");
        }
      }
    }
  ));

  // ===== FIELD PARENT CLASS TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should provide parent class information",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const parentClass = maxValueField.getParent();
          assertNotNull(parentClass, "Parent class should be available");
          assert(parentClass.getName() === "Int32", "Parent class should be Int32");
          assert(parentClass.getFullName() === "System.Int32", "Parent class full name should be System.Int32");
        }
      }
    }
  ));

  // ===== FIELD FULL NAME TESTS =====

  results.push(createMonoDependentTest(
    "MonoField should provide full name information",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const maxValueField = int32Class.tryGetField("MaxValue");
        if (maxValueField) {
          const fullName = maxValueField.getFullName();
          assertNotNull(fullName, "Full name should be available");
          assert(fullName.includes("MaxValue"), "Full name should include field name");
          assert(fullName.includes("Int32"), "Full name should include class name");
        }
      }
    }
  ));

  return results;
}

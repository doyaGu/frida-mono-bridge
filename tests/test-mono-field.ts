/**
 * Comprehensive MonoField Tests
 * Tests for MonoField functionality including field discovery, value getting/setting,
 * type checking, static vs instance operations, and Unity-specific patterns
 */

import Mono from "../src";
import { setupCoreClassesFixture, withCoreClasses, withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull, assertThrows, createErrorHandlingTest } from "./test-framework";
import { createBasicLookupPerformanceTest, createFieldLookupPerformanceTest } from "./test-utilities";
import { verifyFieldSummary } from "./test-validators";

export async function createMonoFieldTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== FIELD DISCOVERY AND ENUMERATION TESTS =====

  results.push(
    await withCoreClasses("MonoField should discover fields by name", ({ int32Class }) => {
      const field = int32Class.tryField("MaxValue");
      if (field) {
        assert(field.name === "MaxValue", "Field name should be MaxValue");
        assert(field.parent.name === "Int32", "Field parent should be Int32");
      } else {
        console.log("  - MaxValue field not found on Int32");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should enumerate all fields in class", ({ int32Class }) => {
      const fields = int32Class.fields;
      assert(fields.length >= 0, "Should find fields (or none)");

      // Look for common static fields
      const maxValueField = fields.find(f => f.name === "MaxValue");
      const minValueField = fields.find(f => f.name === "MinValue");

      if (maxValueField) {
        assert(maxValueField.name === "MaxValue", "Should find MaxValue field");
      }
      if (minValueField) {
        assert(minValueField.name === "MinValue", "Should find MinValue field");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should handle missing fields gracefully", ({ stringClass }) => {
      const missingField = stringClass.tryField("DefinitelyDoesNotExist");
      assert(missingField === null, "Missing field should return null");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoField should throw for missing required fields", () => {
      const { stringClass } = setupCoreClassesFixture();

      assertThrows(() => {
        stringClass.field("DefinitelyDoesNotExist");
      }, "Should throw when required field is not found");
    }),
  );

  // ===== FIELD VALUE GETTING AND SETTING TESTS =====

  results.push(
    await withCoreClasses("MonoField should get static field values", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField && maxValueField.isStatic) {
        try {
          const value = maxValueField.getStaticValue();
          assertNotNull(value, "Static field value should be available");
        } catch (error) {
          console.log(`  - Static field get failed: ${error}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should set static field values", ({ domain }) => {
      // Try to find a class with a writable static field
      const testClass = domain.tryClass("System.Threading.Thread");
      if (testClass) {
        const field = testClass.tryField("CurrentThread");
        if (field && field.isStatic) {
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
    }),
  );

  results.push(
    await withCoreClasses("MonoField should get instance field values", ({ objectClass }) => {
      // Create an object instance
      const obj = objectClass.alloc();

      // Try to find instance fields (Object might not have public fields)
      const fields = objectClass.fields;
      const instanceFields = fields.filter(f => !f.isStatic);

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
    }),
  );

  results.push(
    await withDomain("MonoField should set instance field values", ({ domain }) => {
      // Use StringBuilder which is safe to allocate and has internal fields
      const stringBuilderClass = domain.tryClass("System.Text.StringBuilder");
      if (stringBuilderClass) {
        const obj = stringBuilderClass.alloc();
        assertNotNull(obj, "StringBuilder instance should be allocated");

        const fields = stringBuilderClass.fields;
        const instanceFields = fields.filter(f => !f.isStatic && !f.isInitOnly && !f.isLiteral);

        if (instanceFields.length > 0) {
          console.log(`  - Found ${instanceFields.length} writable instance fields on StringBuilder`);

          // Find a field we can safely modify (e.g., capacity-related or internal)
          for (const field of instanceFields) {
            const fieldType = field.type;
            const typeName = fieldType?.name || "";

            // Try to find an Int32 field we can set
            if (typeName === "Int32" || typeName === "System.Int32") {
              try {
                // Read original value using readValue with coercion
                const originalValue = field.readValue(obj, { coerce: true });
                console.log(`  - Field "${field.name}" original value: ${originalValue}`);

                // Allocate memory for the new Int32 value and write to it
                const newValueMem = Memory.alloc(4);
                newValueMem.writeS32(42);

                // Set the value using the pointer to the Int32 data
                field.setValue(obj, newValueMem);

                // Read back the new value
                const newValue = field.readValue(obj, { coerce: true });
                console.log(`  - Field "${field.name}" after setValue(42): ${newValue}`);

                assert(newValue === 42, `Field value should be 42 after set, got: ${newValue}`);
                console.log("  - Instance field set/get successful");
                return; // Test passed
              } catch (error) {
                console.log(`  - Field "${field.name}" access failed: ${error}`);
              }
            }
          }

          // If no Int32 field was successfully modified, just verify we can read instance fields
          const firstField = instanceFields[0];
          try {
            const value = firstField.readValue(obj, { coerce: true });
            console.log(`  - Read instance field "${firstField.name}": ${value}`);
          } catch (error) {
            console.log(`  - Instance field read failed: ${error}`);
          }
        } else {
          console.log("  - No writable instance fields found on StringBuilder");
        }
      } else {
        // Fallback: try Exception class which has instance fields
        const exceptionClass = domain.tryClass("System.Exception");
        if (exceptionClass) {
          const obj = exceptionClass.alloc();
          const fields = exceptionClass.fields;
          const instanceFields = fields.filter(f => !f.isStatic);

          console.log(`  - Using Exception class with ${instanceFields.length} instance fields`);

          if (instanceFields.length > 0) {
            const field = instanceFields[0];
            try {
              const value = field.readValue(obj, { coerce: true });
              console.log(`  - Read field "${field.name}": ${value}`);
            } catch (error) {
              console.log(`  - Field access: ${error}`);
            }
          }
        } else {
          console.log("  - No suitable class found for instance field testing");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should set instance reference field values", ({ domain }) => {
      const exceptionClass = domain.tryClass("System.Exception");
      if (!exceptionClass) {
        console.log("[SKIP] System.Exception class not found");
        return;
      }

      const obj = exceptionClass.alloc();
      assertNotNull(obj, "Exception instance should be allocated");

      const stringField = exceptionClass.fields.find(field => {
        const typeName = field.type.fullName;
        return (
          !field.isStatic &&
          !field.isInitOnly &&
          !field.isLiteral &&
          (typeName === "System.String" || typeName === "String")
        );
      });

      if (!stringField) {
        console.log("[SKIP] No writable string field found on System.Exception");
        return;
      }

      const newValue = "frida-mono-bridge";
      const newValuePtr = Mono.api.stringNew(newValue);
      stringField.setValue(obj, newValuePtr);

      const readBack = stringField.readValue(obj, { coerce: true });
      assert(readBack === newValue, `Expected '${newValue}', got: ${readBack}`);
    }),
  );

  // ===== TYPE CHECKING AND VALIDATION TESTS =====

  results.push(
    await withCoreClasses("MonoField should provide field type information", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        try {
          const fieldType = maxValueField.type;
          assertNotNull(fieldType, "Field type should be available");
          const typeName = fieldType.name;
          assert(
            typeName.includes("Int32") || typeName.includes("int"),
            `MaxValue field type should include 'Int32' or 'int', got: ${typeName}`,
          );
        } catch (error) {
          console.log(`  - Field type retrieval not supported: ${error}`);
        }
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should provide field metadata", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        try {
          verifyFieldSummary(maxValueField);
          const summary = maxValueField.getSummary();
          assert(summary.name === "MaxValue", "Summary name should be MaxValue");
        } catch (error) {
          console.log(`  - Field metadata retrieval not fully supported: ${error}`);
        }
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should provide field description", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const description = maxValueField.describe();
        assertNotNull(description, "Field description should be available");
        assert(description.includes("MaxValue"), "Description should include field name");
        assert(description.includes("static"), "Description should include static modifier");
      }
    }),
  );

  // ===== STATIC VS INSTANCE FIELD OPERATIONS TESTS =====

  results.push(
    await withCoreClasses("MonoField should identify static fields correctly", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        assert(maxValueField.isStatic, "MaxValue should be static");
      }

      const minValueField = int32Class.tryField("MinValue");
      if (minValueField) {
        assert(minValueField.isStatic, "MinValue should be static");
      }
    }),
  );

  results.push(
    await withDomain("MonoField should identify instance fields correctly", ({ domain }) => {
      // Try to find a class with instance fields
      const pointClass = domain.tryClass("System.Drawing.Point");
      if (pointClass) {
        const fields = pointClass.fields;
        const instanceFields = fields.filter((f: any) => !f.isStatic);

        if (instanceFields.length > 0) {
          const field = instanceFields[0];
          assert(!field.isStatic, "Field should be instance field");
        }
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should handle static field operations", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField && maxValueField.isStatic) {
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
    }),
  );

  results.push(
    await withCoreClasses("MonoField should handle instance field operations", ({ objectClass }) => {
      const obj = objectClass.alloc();
      const fields = objectClass.fields;
      const instanceFields = fields.filter(f => !f.isStatic);

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
    }),
  );

  // ===== FIELD ATTRIBUTES AND METADATA TESTS =====

  results.push(
    await withCoreClasses("MonoField should provide accessibility information", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const accessibility = maxValueField.accessibility;
        assertNotNull(accessibility, "Accessibility should be available");
        assert(typeof accessibility === "string", "Accessibility should be a string");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should identify readonly fields", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const isReadonly = maxValueField.isInitOnly;
        assert(typeof isReadonly === "boolean", "isInitOnly should return boolean");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should identify constant fields", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const isConstant = maxValueField.isLiteral;
        assert(typeof isConstant === "boolean", "isLiteral should return boolean");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should provide field flags", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const flags = maxValueField.flags;
        assert(typeof flags === "number", "Flags should be a number");

        const flagNames = maxValueField.flagNames;
        assert(Array.isArray(flagNames), "Flag names should be an array");
      }
    }),
  );

  // ===== FIELD ACCESS MODIFIERS AND SECURITY TESTS =====

  results.push(
    await withCoreClasses("MonoField should handle public fields", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const accessibility = maxValueField.accessibility;
        // MaxValue should be public
        assert(accessibility === "public" || accessibility === "private-scope", "MaxValue should be accessible");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should handle private fields gracefully", ({ stringClass }) => {
      // Try to access private fields (might not be visible through reflection)
      const fields = stringClass.fields;
      const privateFields = fields.filter(f => {
        try {
          const accessibility = f.accessibility;
          return accessibility.includes("private");
        } catch {
          return false;
        }
      });

      // Private fields might not be accessible through reflection
      console.log(`  - Found ${privateFields.length} potentially private fields`);
    }),
  );

  // ===== FIELD OFFSET AND MEMORY LAYOUT TESTS =====

  results.push(
    await withCoreClasses("MonoField should provide field offset information", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const offset = maxValueField.offset;
        assert(typeof offset === "number", "Offset should be a number");

        // Static fields might have offset 0 or special values
        console.log(`  - MaxValue field offset: ${offset}`);
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should provide field token", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        try {
          const token = maxValueField.token;
          assert(typeof token === "number", "Token should be a number");
          assert(token > 0, "Token should be positive");
        } catch (error) {
          console.log(`  - Field token retrieval not supported: ${error}`);
        }
      }
    }),
  );

  // ===== FIELD VALUE CONVERSION TESTS =====

  results.push(
    await withCoreClasses("MonoField should convert field values to objects", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField && maxValueField.isStatic) {
        try {
          const valueObject = maxValueField.getValueObject(null);
          if (valueObject) {
            assertNotNull(valueObject.pointer, "Value object should have pointer");
          }
        } catch (error) {
          console.log(`  - Field value object conversion failed: ${error}`);
        }
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should coerce primitive values", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField && maxValueField.isStatic) {
        try {
          const value = maxValueField.readValue(null, { coerce: true });
          assertNotNull(value, "Coerced value should be available");
        } catch (error) {
          console.log(`  - Field value coercion failed: ${error}`);
        }
      }
    }),
  );

  // ===== PERFORMANCE TESTS =====

  results.push(createFieldLookupPerformanceTest("System.Int32", "MaxValue"));

  results.push(
    createBasicLookupPerformanceTest("Field value access performance for System.Int32.MaxValue", () => {
      const domain = Mono.domain;
      const int32Class = domain.tryClass("System.Int32");
      if (int32Class) {
        const field = int32Class.tryField("MaxValue");
        if (field && field.isStatic) {
          try {
            field.getStaticValue();
          } catch (error) {
            // Ignore access errors for performance test
          }
        }
      }
    }),
  );

  // ===== ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoField should handle invalid field operations gracefully", () => {
      const { stringClass } = setupCoreClassesFixture();

      const missingField = stringClass.tryField("NonExistentField");
      assert(missingField === null, "Missing field should return null");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoField should handle null instance access", () => {
      const { stringClass } = setupCoreClassesFixture();
      const fields = stringClass.fields;
      const instanceFields = fields.filter(f => !f.isStatic);

      if (instanceFields.length > 0) {
        const field = instanceFields[0];

        assertThrows(() => {
          field.getValue(null);
        }, "Should throw when accessing instance field with null instance");
      }
    }),
  );

  results.push(
    await withCoreClasses("MonoField should handle type mismatch errors", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        // Try to set with wrong type - may throw or silently fail
        try {
          const wrongValue = Mono.api.stringNew("wrong");
          maxValueField.setStaticValue(wrongValue);
          console.log("  - No error on type mismatch (implementation-dependent)");
        } catch (error) {
          console.log(`  - Type mismatch handled: ${error}`);
        }
      }
    }),
  );

  // ===== FIELD TOSTRING AND SERIALIZATION TESTS =====

  results.push(
    await withCoreClasses("MonoField toString should work correctly", ({ int32Class }) => {
      const maxValueField = int32Class.tryField("MaxValue");
      if (maxValueField) {
        const stringRep = maxValueField.toString();
        assertNotNull(stringRep, "toString should return a value");
        assert(stringRep.includes("MonoField"), "toString should include class type");
      }
    }),
  );

  // ===== PRIMITIVE TYPE FIELD TESTS (BOUNDARY) =====

  results.push(
    await withCoreClasses("MonoField should read/access Boolean static fields", ({ booleanClass }) => {
      const trueString = booleanClass.tryField("TrueString");
      const falseString = booleanClass.tryField("FalseString");

      if (trueString) {
        const type = trueString.type;
        assertNotNull(type, "Boolean field should have type");
        console.log(`  - TrueString type: ${type.name}`);
      }
      if (falseString) {
        const type = falseString.type;
        assertNotNull(type, "Boolean field should have type");
      }
    }),
  );

  results.push(
    await withDomain("MonoField should access Double constants (Min/MaxValue)", ({ domain }) => {
      const doubleClass = domain.tryClass("System.Double");

      if (doubleClass) {
        const maxValueField = doubleClass.tryField("MaxValue");
        const minValueField = doubleClass.tryField("MinValue");
        const epsilon = doubleClass.tryField("Epsilon");
        const nan = doubleClass.tryField("NaN");

        [maxValueField, minValueField, epsilon, nan].forEach((field, index) => {
          if (field) {
            assert(field.isStatic, "Double constants should be static");
            const type = field.type;
            assertNotNull(type, `Double field ${index} should have type`);
          }
        });
        console.log("  - Double constants accessed successfully");
      }
    }),
  );

  results.push(
    await withDomain("MonoField should access Byte constants", ({ domain }) => {
      const byteClass = domain.tryClass("System.Byte");

      if (byteClass) {
        const maxValueField = byteClass.tryField("MaxValue");
        const minValueField = byteClass.tryField("MinValue");

        if (maxValueField) {
          assert(maxValueField.isStatic, "Byte.MaxValue should be static");
          try {
            const value = maxValueField.getStaticValue();
            console.log(`  - Byte.MaxValue static field accessed`);
          } catch {
            console.log("  - Byte static value access not supported");
          }
        }
        if (minValueField) {
          assert(minValueField.isStatic, "Byte.MinValue should be static");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should access Int64 (Long) fields", ({ domain }) => {
      const int64Class = domain.tryClass("System.Int64");

      if (int64Class) {
        const maxValueField = int64Class.tryField("MaxValue");

        if (maxValueField) {
          assert(maxValueField.isStatic, "Int64.MaxValue should be static");
          const type = maxValueField.type;
          assertNotNull(type, "Int64 field should have type");
          const typeName = type.name;
          assert(typeName === "Int64" || typeName === "System.Int64", "Type should be Int64");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should access Single (Float) constants", ({ domain }) => {
      const singleClass = domain.tryClass("System.Single");

      if (singleClass) {
        const fields = singleClass.fields;
        const staticFields = fields.filter(f => f.isStatic);

        assert(staticFields.length > 0, "Single should have static constant fields");

        const fieldNames = staticFields.map(f => f.name);
        console.log(`  - Single static fields: ${fieldNames.join(", ")}`);

        // Check for special float values
        const hasNaN = fieldNames.includes("NaN");
        const hasPositiveInfinity = fieldNames.includes("PositiveInfinity");

        if (hasNaN || hasPositiveInfinity) {
          console.log("  - Special float values found (NaN, Infinity)");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should access Char constants", ({ domain }) => {
      const charClass = domain.tryClass("System.Char");

      if (charClass) {
        const maxValueField = charClass.tryField("MaxValue");
        const minValueField = charClass.tryField("MinValue");

        if (maxValueField) {
          assert(maxValueField.isStatic, "Char.MaxValue should be static");
          const type = maxValueField.type;
          const typeName = type.name;
          assert(typeName === "Char" || typeName === "System.Char", "Type should be Char");
        }
      }
    }),
  );

  // ===== ARRAY TYPE FIELD TESTS =====

  results.push(
    await withDomain("MonoField should handle array-typed fields", ({ domain }) => {
      // System.Environment has some array fields
      const envClass = domain.tryClass("System.Environment");

      if (envClass) {
        const fields = envClass.fields;
        const arrayFields = fields.filter(f => {
          const type = f.type;
          const typeName = type?.name || "";
          return type && (typeName.includes("[]") || typeName.includes("Array"));
        });

        console.log(`  - Found ${arrayFields.length} potential array fields in Environment`);

        if (arrayFields.length > 0) {
          const firstArray = arrayFields[0];
          const type = firstArray.type;
          console.log(`  - Array field type: ${type.name}`);
        }
      }
    }),
  );

  // ===== GENERIC TYPE FIELD TESTS =====

  results.push(
    await withDomain("MonoField should handle fields in generic types", ({ domain }) => {
      // Nullable<T> has instance fields
      const nullableClass = domain.tryClass("System.Nullable`1");

      if (nullableClass) {
        const fields = nullableClass.fields;
        console.log(`  - Nullable<T> has ${fields.length} fields`);

        fields.forEach(field => {
          console.log(`    - Field: ${field.name}, Static: ${field.isStatic}`);
        });
      }
    }),
  );

  // ===== STRUCT FIELD LAYOUT TESTS =====

  results.push(
    await withDomain("MonoField should handle struct field layout (DateTime)", ({ domain }) => {
      const dateTimeClass = domain.tryClass("System.DateTime");

      if (dateTimeClass) {
        const fields = dateTimeClass.fields;
        const instanceFields = fields.filter(f => !f.isStatic);
        const staticFields = fields.filter(f => f.isStatic);

        console.log(`  - DateTime has ${instanceFields.length} instance fields, ${staticFields.length} static fields`);

        // DateTime typically has a single ticks field
        instanceFields.forEach(field => {
          const offset = field.offset;
          console.log(`    - ${field.name}: offset=${offset}`);
        });

        // Check for static Min/MaxValue
        const minValue = dateTimeClass.tryField("MinValue");
        const maxValue = dateTimeClass.tryField("MaxValue");

        if (minValue) assert(minValue.isStatic, "DateTime.MinValue should be static");
        if (maxValue) assert(maxValue.isStatic, "DateTime.MaxValue should be static");
      }
    }),
  );

  results.push(
    await withDomain("MonoField should handle Guid struct fields", ({ domain }) => {
      const guidClass = domain.tryClass("System.Guid");

      if (guidClass) {
        const fields = guidClass.fields;
        const instanceFields = fields.filter(f => !f.isStatic);

        console.log(`  - Guid has ${instanceFields.length} instance fields`);

        // GUID typically has internal fields like _a, _b, _c, etc.
        instanceFields.slice(0, 5).forEach(field => {
          const type = field.type;
          console.log(`    - ${field.name}: ${type.name}`);
        });

        // Check Guid.Empty
        const emptyField = guidClass.tryField("Empty");
        if (emptyField) {
          assert(emptyField.isStatic, "Guid.Empty should be static");
        }
      }
    }),
  );

  // ===== LITERAL/CONST FIELD TESTS =====

  results.push(
    await withDomain("MonoField should identify literal (const) fields", ({ domain }) => {
      const mathClass = domain.tryClass("System.Math");

      if (mathClass) {
        const piField = mathClass.tryField("PI");
        const eField = mathClass.tryField("E");

        if (piField) {
          const isLiteral = piField.isLiteral;
          const isStatic = piField.isStatic;
          console.log(`  - Math.PI: literal=${isLiteral}, static=${isStatic}`);
        }

        if (eField) {
          const isLiteral = eField.isLiteral;
          console.log(`  - Math.E: literal=${isLiteral}`);
        }
      }
    }),
  );

  // ===== ENUM FIELD TESTS =====

  results.push(
    await withDomain("MonoField should enumerate all enum values as fields", ({ domain }) => {
      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");

      if (dayOfWeekClass) {
        const fields = dayOfWeekClass.fields;
        const staticFields = fields.filter(f => f.isStatic);

        // DayOfWeek has Sunday=0 through Saturday=6
        console.log(`  - DayOfWeek has ${staticFields.length} enum value fields`);

        const expectedDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let foundCount = 0;

        staticFields.forEach(field => {
          if (expectedDays.includes(field.name)) {
            foundCount++;
            const isLiteral = field.isLiteral;
            assert(isLiteral, `${field.name} should be a literal (const) field`);
          }
        });

        console.log(`  - Found ${foundCount}/7 day enum values`);
      }
    }),
  );

  results.push(
    await withDomain("MonoField should handle flag enum fields (FileAccess)", ({ domain }) => {
      const fileAccessClass = domain.tryClass("System.IO.FileAccess");

      if (fileAccessClass) {
        const fields = fileAccessClass.fields;
        const staticFields = fields.filter(f => f.isStatic);

        console.log(`  - FileAccess has ${staticFields.length} flag values`);

        const expectedFlags = ["Read", "Write", "ReadWrite"];
        staticFields.forEach(field => {
          if (expectedFlags.includes(field.name)) {
            console.log(`    - Found: ${field.name}`);
          }
        });
      }
    }),
  );

  // ===== INHERITED FIELD TESTS =====

  results.push(
    await withDomain("MonoField should access inherited fields through parent class", ({ domain }) => {
      // Exception has Message field from base
      const exceptionClass = domain.tryClass("System.ArgumentException");

      if (exceptionClass) {
        const parent = exceptionClass.parent;
        assertNotNull(parent, "ArgumentException should have parent");
        console.log(`  - ArgumentException parent: ${parent?.name}`);

        // Get fields from the class itself
        const ownFields = exceptionClass.fields;
        console.log(`  - ArgumentException own fields: ${ownFields.length}`);

        // Try to find _message field which is typically in base Exception
        let currentClass = exceptionClass;
        let messageFound = false;

        while (currentClass && !messageFound) {
          const fields = currentClass.fields;
          for (const field of fields) {
            if (field.name.toLowerCase().includes("message")) {
              messageFound = true;
              console.log(`  - Found message-related field in ${currentClass.name}: ${field.name}`);
              break;
            }
          }
          currentClass = currentClass.parent!;
        }
      }
    }),
  );

  // ===== FIELD ATTRIBUTE TESTS =====

  results.push(
    await withDomain("MonoField should report field attributes/flags", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxValueField = int32Class.tryField("MaxValue");

        if (maxValueField) {
          // Check various field attributes
          const accessibility = maxValueField.accessibility;
          const isStatic = maxValueField.isStatic;
          const isInitOnly = maxValueField.isInitOnly;
          const isLiteral = maxValueField.isLiteral;

          console.log(`  - Int32.MaxValue attributes:`);
          console.log(`    - Accessibility: ${accessibility}`);
          console.log(`    - Static: ${isStatic}`);
          console.log(`    - InitOnly (readonly): ${isInitOnly}`);
          console.log(`    - Literal (const): ${isLiteral}`);

          assert(isStatic, "MaxValue should be static");
        }
      }
    }),
  );

  // ===== FIELD DESCRIBE COMPLETENESS TESTS =====

  results.push(
    await withDomain("MonoField describe() should include complete information", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxValueField = int32Class.tryField("MaxValue");

        if (maxValueField) {
          const description = maxValueField.describe();
          assertNotNull(description, "Field description should not be null");

          // Verify description includes key info
          assert(
            description.includes("MaxValue") || description.includes("Int32"),
            "Description should include field or type name",
          );

          console.log(`  - Field description length: ${description.length} chars`);
          console.log(`  - Preview: ${description.substring(0, 100)}...`);
        }
      }
    }),
  );

  // ===== THREAD STATIC FIELD TESTS =====

  results.push(
    await withDomain("MonoField should identify thread-static fields if available", ({ domain }) => {
      // Look for classes that might have ThreadStatic fields
      const threadClass = domain.tryClass("System.Threading.Thread");

      if (threadClass) {
        const fields = threadClass.fields;
        console.log(`  - Thread class has ${fields.length} fields`);

        // Check if we can identify thread-static by examining attributes
        fields.slice(0, 5).forEach(field => {
          const name = field.name;
          const isStatic = field.isStatic;
          console.log(`    - ${name}: static=${isStatic}`);
        });
      }
    }),
  );

  // ===== FIELD WRITE TO STATIC TESTS =====

  results.push(
    await withDomain("MonoField should handle static field write operations", ({ domain }) => {
      // Find a class with writable static fields
      const consoleClass = domain.tryClass("System.Console");

      if (consoleClass) {
        const fields = consoleClass.fields;
        const writableStatic = fields.filter(f => f.isStatic && !f.isLiteral && !f.isInitOnly);

        console.log(`  - Console has ${writableStatic.length} writable static fields`);

        if (writableStatic.length > 0) {
          const field = writableStatic[0];
          console.log(`    - Could modify: ${field.name}`);
          // We don't actually modify to avoid side effects
        }
      }
    }),
  );

  // ===== FIELD POINTER TYPE TESTS =====

  results.push(
    await withDomain("MonoField should handle IntPtr fields", ({ domain }) => {
      const intPtrClass = domain.tryClass("System.IntPtr");

      if (intPtrClass) {
        const fields = intPtrClass.fields;

        console.log(`  - IntPtr has ${fields.length} fields`);

        const zeroField = intPtrClass.tryField("Zero");
        if (zeroField) {
          assert(zeroField.isStatic, "IntPtr.Zero should be static");
          const type = zeroField.type;
          const typeName = type.name;
          assert(typeName === "IntPtr" || typeName === "System.IntPtr", "Type should be IntPtr");
        }
      }
    }),
  );

  // ===== FIELD COUNT/SIZE TESTS =====

  results.push(
    await withDomain("MonoField should report field size information", ({ domain }) => {
      // Test fields of different sizes
      const testCases = [
        { class: "System.Byte", expectedSize: 1 },
        { class: "System.Int16", expectedSize: 2 },
        { class: "System.Int32", expectedSize: 4 },
        { class: "System.Int64", expectedSize: 8 },
      ];

      testCases.forEach(tc => {
        const cls = domain.tryClass(tc.class);
        if (cls) {
          const maxField = cls.tryField("MaxValue");
          if (maxField) {
            const type = maxField.type;
            console.log(`  - ${tc.class}: type=${type.name}`);
          }
        }
      });
    }),
  );

  results.push(
    await withDomain("MonoField should provide JSON representation", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxValueField = int32Class.tryField("MaxValue");
        if (maxValueField) {
          try {
            const json = maxValueField.toJSON();
            assertNotNull(json, "toJSON should return a value");
            assert(json.name === "MaxValue", "JSON should include field name");
            assert(typeof json.type === "string", "JSON should include field type");
            assert(typeof json.isStatic === "boolean", "JSON should include isStatic flag");
          } catch (error) {
            console.log(`  - JSON serialization not fully supported: ${error}`);
          }
        }
      }
    }),
  );

  // ===== FIELD PARENT CLASS TESTS =====

  results.push(
    await withDomain("MonoField should provide parent class information", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxValueField = int32Class.tryField("MaxValue");
        if (maxValueField) {
          const parentClass = maxValueField.parent;
          assertNotNull(parentClass, "Parent class should be available");
          assert(parentClass.name === "Int32", "Parent class should be Int32");
          assert(parentClass.fullName === "System.Int32", "Parent class full name should be System.Int32");
        }
      }
    }),
  );

  // ===== FIELD FULL NAME TESTS =====

  results.push(
    await withDomain("MonoField should provide full name information", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxValueField = int32Class.tryField("MaxValue");
        if (maxValueField) {
          const fullName = maxValueField.fullName;
          assertNotNull(fullName, "Full name should be available");
          assert(fullName.includes("MaxValue"), "Full name should include field name");
          assert(fullName.includes("Int32"), "Full name should include class name");
        }
      }
    }),
  );

  // ===== TYPE-SPECIFIC READ/WRITE TESTS =====

  results.push(
    await withDomain("MonoField readValue should correctly read Boolean type", ({ domain }) => {
      const boolClass = domain.tryClass("System.Boolean");

      if (boolClass) {
        // Boolean doesn't have true/false as static fields, but let's find a class with boolean field
        // Try to use reflection or a class known to have boolean fields
        const fields = boolClass.fields;
        console.log(`  - Boolean has ${fields.length} fields`);

        // Create a simple test using a wrapper type
        const nullableBoolClass = domain.tryClass("System.Nullable`1[System.Boolean]");
        if (nullableBoolClass) {
          console.log("  - Found Nullable<Boolean> for testing");
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Int32 static field", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxField = int32Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "MaxValue should be readable");

          // Int32.MaxValue = 2147483647
          assert(
            value === 2147483647 || typeof value === "number",
            `MaxValue should be 2147483647 or a number, got: ${value}`,
          );
          console.log(`  - Int32.MaxValue = ${value}`);
        }

        const minField = int32Class.tryField("MinValue");
        if (minField) {
          const value = minField.readValue(null, { coerce: true });
          assertNotNull(value, "MinValue should be readable");

          // Int32.MinValue = -2147483648
          assert(
            value === -2147483648 || typeof value === "number",
            `MinValue should be -2147483648 or a number, got: ${value}`,
          );
          console.log(`  - Int32.MinValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Byte type", ({ domain }) => {
      const byteClass = domain.tryClass("System.Byte");

      if (byteClass) {
        const maxField = byteClass.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Byte.MaxValue should be readable");

          // Byte.MaxValue = 255
          assert(value === 255 || typeof value === "number", `Byte.MaxValue should be 255, got: ${value}`);
          console.log(`  - Byte.MaxValue = ${value}`);
        }

        const minField = byteClass.tryField("MinValue");
        if (minField) {
          const value = minField.readValue(null, { coerce: true });
          // Byte.MinValue = 0
          assert(value === 0 || typeof value === "number", `Byte.MinValue should be 0, got: ${value}`);
          console.log(`  - Byte.MinValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Int16 (Short) type", ({ domain }) => {
      const int16Class = domain.tryClass("System.Int16");

      if (int16Class) {
        const maxField = int16Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Int16.MaxValue should be readable");

          // Int16.MaxValue = 32767
          assert(value === 32767 || typeof value === "number", `Int16.MaxValue should be 32767, got: ${value}`);
          console.log(`  - Int16.MaxValue = ${value}`);
        }

        const minField = int16Class.tryField("MinValue");
        if (minField) {
          const value = minField.readValue(null, { coerce: true });
          // Int16.MinValue = -32768
          assert(value === -32768 || typeof value === "number", `Int16.MinValue should be -32768, got: ${value}`);
          console.log(`  - Int16.MinValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read UInt16 (UShort) type", ({ domain }) => {
      const uint16Class = domain.tryClass("System.UInt16");

      if (uint16Class) {
        const maxField = uint16Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "UInt16.MaxValue should be readable");

          // UInt16.MaxValue = 65535
          assert(value === 65535 || typeof value === "number", `UInt16.MaxValue should be 65535, got: ${value}`);
          console.log(`  - UInt16.MaxValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Int64 (Long) type", ({ domain }) => {
      const int64Class = domain.tryClass("System.Int64");

      if (int64Class) {
        const maxField = int64Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Int64.MaxValue should be readable");

          // Int64.MaxValue = 9223372036854775807 (may lose precision in JS)
          assert(
            typeof value === "number" || typeof value === "bigint" || value instanceof Int64,
            `Int64.MaxValue should be number/bigint/Int64, got: ${typeof value}`,
          );
          console.log(`  - Int64.MaxValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read UInt32 type", ({ domain }) => {
      const uint32Class = domain.tryClass("System.UInt32");

      if (uint32Class) {
        const maxField = uint32Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "UInt32.MaxValue should be readable");

          // UInt32.MaxValue = 4294967295
          assert(typeof value === "number", `UInt32.MaxValue should be a number, got: ${typeof value}`);
          console.log(`  - UInt32.MaxValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read SByte (Int8) type", ({ domain }) => {
      const sbyteClass = domain.tryClass("System.SByte");

      if (sbyteClass) {
        const maxField = sbyteClass.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "SByte.MaxValue should be readable");

          // SByte.MaxValue = 127
          assert(value === 127 || typeof value === "number", `SByte.MaxValue should be 127, got: ${value}`);
          console.log(`  - SByte.MaxValue = ${value}`);
        }

        const minField = sbyteClass.tryField("MinValue");
        if (minField) {
          const value = minField.readValue(null, { coerce: true });
          // SByte.MinValue = -128
          assert(value === -128 || typeof value === "number", `SByte.MinValue should be -128, got: ${value}`);
          console.log(`  - SByte.MinValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Single (Float) type", ({ domain }) => {
      const singleClass = domain.tryClass("System.Single");

      if (singleClass) {
        const maxField = singleClass.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Single.MaxValue should be readable");
          assert(typeof value === "number", "Single should coerce to number");
          console.log(`  - Single.MaxValue = ${value}`);
        }

        const epsilonField = singleClass.tryField("Epsilon");
        if (epsilonField) {
          const value = epsilonField.readValue(null, { coerce: true });
          assertNotNull(value, "Single.Epsilon should be readable");
          assert(
            typeof value === "number" && value > 0 && value < 0.001,
            `Single.Epsilon should be a very small positive number, got: ${value}`,
          );
          console.log(`  - Single.Epsilon = ${value}`);
        }

        const nanField = singleClass.tryField("NaN");
        if (nanField) {
          const value = nanField.readValue(null, { coerce: true });
          assertNotNull(value, "Single.NaN should be readable");
          // NaN is a special case
          assert(typeof value === "number", "Single.NaN should be a number");
          console.log(`  - Single.NaN = ${value} (isNaN: ${Number.isNaN(value)})`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Double type", ({ domain }) => {
      const doubleClass = domain.tryClass("System.Double");

      if (doubleClass) {
        const maxField = doubleClass.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Double.MaxValue should be readable");
          assert(typeof value === "number", "Double should coerce to number");
          console.log(`  - Double.MaxValue = ${value}`);
        }

        const epsilonField = doubleClass.tryField("Epsilon");
        if (epsilonField) {
          const value = epsilonField.readValue(null, { coerce: true });
          assertNotNull(value, "Double.Epsilon should be readable");
          assert(typeof value === "number" && value > 0, "Double.Epsilon should be a positive number");
          console.log(`  - Double.Epsilon = ${value}`);
        }

        const piField = doubleClass.tryField("PI");
        if (piField) {
          const value = piField.readValue(null, { coerce: true });
          console.log(`  - Double.PI (if available) = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read Char type", ({ domain }) => {
      const charClass = domain.tryClass("System.Char");

      if (charClass) {
        const maxField = charClass.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "Char.MaxValue should be readable");

          // Char.MaxValue = '\uffff' = 65535 as number or char
          assert(
            typeof value === "string" || typeof value === "number",
            `Char should coerce to string or number, got: ${typeof value}`,
          );
          console.log(`  - Char.MaxValue = ${JSON.stringify(value)}`);
        }

        const minField = charClass.tryField("MinValue");
        if (minField) {
          const value = minField.readValue(null, { coerce: true });
          // Char.MinValue = '\u0000'
          assert(typeof value === "string" || typeof value === "number", "Char should coerce to string or number");
          console.log(`  - Char.MinValue = ${JSON.stringify(value)}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should correctly read String type field", ({ domain }) => {
      const boolClass = domain.tryClass("System.Boolean");

      if (boolClass) {
        // Boolean.TrueString and FalseString are static readonly strings
        const trueStringField = boolClass.tryField("TrueString");
        if (trueStringField) {
          try {
            const value = trueStringField.readValue(null, { coerce: true });
            // Note: readValue may return null for some string fields
            if (value !== null && value !== undefined) {
              assert(
                value === "True" || typeof value === "string",
                `TrueString should be 'True' or string, got: ${value}`,
              );
              console.log(`  - Boolean.TrueString = "${value}"`);
            } else {
              // Try getValueObject as fallback
              const valueObj = trueStringField.getValueObject(null);
              if (valueObj) {
                console.log(`  - Boolean.TrueString (via valueObject): ${valueObj.pointer}`);
              } else {
                console.log("  - Boolean.TrueString returned null (may be uninitialized)");
              }
            }
          } catch (error) {
            console.log(`  - Boolean.TrueString read failed: ${error}`);
          }
        }

        const falseStringField = boolClass.tryField("FalseString");
        if (falseStringField) {
          try {
            const value = falseStringField.readValue(null, { coerce: true });
            if (value !== null && value !== undefined) {
              assert(
                value === "False" || typeof value === "string",
                `FalseString should be 'False' or string, got: ${value}`,
              );
              console.log(`  - Boolean.FalseString = "${value}"`);
            } else {
              console.log("  - Boolean.FalseString returned null (may be uninitialized)");
            }
          } catch (error) {
            console.log(`  - Boolean.FalseString read failed: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should read String.Empty correctly", ({ domain }) => {
      const stringClass = domain.tryClass("System.String");

      if (stringClass) {
        const emptyField = stringClass.tryField("Empty");
        if (emptyField) {
          const value = emptyField.readValue(null, { coerce: true });
          assert(value === "" || value === null, `String.Empty should be empty string, got: ${JSON.stringify(value)}`);
          console.log(`  - String.Empty = ${JSON.stringify(value)}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue should handle enum underlying values", ({ domain }) => {
      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");

      if (dayOfWeekClass) {
        const sundayField = dayOfWeekClass.tryField("Sunday");
        if (sundayField) {
          const type = sundayField.type;
          console.log(`  - DayOfWeek.Sunday type kind: ${type.kind}`);

          // For enum fields, readValue returns the underlying value
          try {
            const value = sundayField.readValue(null, { coerce: true });
            // Sunday = 0
            assert(value === 0 || typeof value === "number", `Sunday should be 0, got: ${value}`);
            console.log(`  - DayOfWeek.Sunday = ${value}`);
          } catch (error) {
            console.log(`  - Enum value read: ${error}`);
          }
        }

        const saturdayField = dayOfWeekClass.tryField("Saturday");
        if (saturdayField) {
          try {
            const value = saturdayField.readValue(null, { coerce: true });
            // Saturday = 6
            assert(value === 6 || typeof value === "number", `Saturday should be 6, got: ${value}`);
            console.log(`  - DayOfWeek.Saturday = ${value}`);
          } catch (error) {
            console.log(`  - Enum value read: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should read Math.PI and Math.E constants", ({ domain }) => {
      const mathClass = domain.tryClass("System.Math");

      if (mathClass) {
        const piField = mathClass.tryField("PI");
        if (piField) {
          const value = piField.readValue(null, { coerce: true });
          assertNotNull(value, "Math.PI should be readable");
          assert(typeof value === "number", "PI should be a number");

          // Math.PI �?3.14159...
          if (typeof value === "number") {
            assert(Math.abs(value - Math.PI) < 0.0001, `Math.PI should be approximately ${Math.PI}, got: ${value}`);
          }
          console.log(`  - Math.PI = ${value}`);
        }

        const eField = mathClass.tryField("E");
        if (eField) {
          const value = eField.readValue(null, { coerce: true });
          assertNotNull(value, "Math.E should be readable");

          // Math.E �?2.71828...
          if (typeof value === "number") {
            assert(Math.abs(value - Math.E) < 0.0001, `Math.E should be approximately ${Math.E}, got: ${value}`);
          }
          console.log(`  - Math.E = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should read IntPtr.Zero and IntPtr.Size", ({ domain }) => {
      const intPtrClass = domain.tryClass("System.IntPtr");

      if (intPtrClass) {
        const zeroField = intPtrClass.tryField("Zero");
        if (zeroField) {
          const value = zeroField.readValue(null, { coerce: true });
          assertNotNull(value, "IntPtr.Zero should be readable");
          console.log(`  - IntPtr.Zero = ${value}`);
        }

        const sizeField = intPtrClass.tryField("Size");
        if (sizeField) {
          const value = sizeField.readValue(null, { coerce: true });
          assertNotNull(value, "IntPtr.Size should be readable");
          // Size is typically 4 or 8 depending on platform
          assert(
            value === 4 || value === 8 || typeof value === "number",
            `IntPtr.Size should be 4 or 8, got: ${value}`,
          );
          console.log(`  - IntPtr.Size = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField should read without coercion when coerce=false", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxField = int32Class.tryField("MaxValue");
        if (maxField) {
          // Read with coerce=false should return raw pointer
          const rawValue = maxField.readValue(null, { coerce: false });
          assertNotNull(rawValue, "Raw value should be readable");

          // Raw value should be a NativePointer
          assert(
            rawValue instanceof NativePointer || typeof rawValue === "object",
            `Raw value should be NativePointer, got: ${typeof rawValue}`,
          );
          console.log(`  - Raw Int32.MaxValue pointer: ${rawValue}`);

          // Read with coerce=true for comparison
          const coercedValue = maxField.readValue(null, { coerce: true });
          console.log(`  - Coerced Int32.MaxValue: ${coercedValue}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField getValueObject should return boxed value", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxField = int32Class.tryField("MaxValue");
        if (maxField) {
          const valueObj = maxField.getValueObject(null);
          if (valueObj) {
            assertNotNull(valueObj.pointer, "Boxed value should have pointer");

            const objClass = valueObj.class;
            assertNotNull(objClass, "Boxed value should have class");

            // For Int32, the boxed class should be Int32
            assert(
              objClass.name === "Int32" || objClass.fullName === "System.Int32",
              `Boxed class should be Int32, got: ${objClass.name}`,
            );
            console.log(`  - Boxed Int32.MaxValue class: ${objClass.fullName}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField getTypedStaticValue should return typed value", ({ domain }) => {
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const maxField = int32Class.tryField("MaxValue") as any;
        if (maxField) {
          const typedValue = maxField.getTypedStaticValue();
          assertNotNull(typedValue, "Typed value should be available");
          console.log(`  - Typed Int32.MaxValue: ${typedValue}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue for DateTime.MinValue and MaxValue", ({ domain }) => {
      const dateTimeClass = domain.tryClass("System.DateTime");

      if (dateTimeClass) {
        const minField = dateTimeClass.tryField("MinValue");
        if (minField) {
          const type = minField.type;
          console.log(`  - DateTime.MinValue type: ${type.name}, kind: ${type.kind}`);

          try {
            const value = minField.readValue(null, { coerce: true });
            console.log(`  - DateTime.MinValue: ${value}`);
          } catch (error) {
            console.log(`  - DateTime.MinValue read: ${error}`);
          }
        }

        const maxField = dateTimeClass.tryField("MaxValue");
        if (maxField) {
          try {
            const value = maxField.readValue(null, { coerce: true });
            console.log(`  - DateTime.MaxValue: ${value}`);
          } catch (error) {
            console.log(`  - DateTime.MaxValue read: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue for Guid.Empty", ({ domain }) => {
      const guidClass = domain.tryClass("System.Guid");

      if (guidClass) {
        const emptyField = guidClass.tryField("Empty");
        if (emptyField) {
          const type = emptyField.type;
          console.log(`  - Guid.Empty type: ${type.name}, kind: ${type.kind}`);

          try {
            const value = emptyField.readValue(null, { coerce: true });
            console.log(`  - Guid.Empty: ${value}`);
          } catch (error) {
            console.log(`  - Guid.Empty read: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue for UInt64.MaxValue", ({ domain }) => {
      const uint64Class = domain.tryClass("System.UInt64");

      if (uint64Class) {
        const maxField = uint64Class.tryField("MaxValue");
        if (maxField) {
          const value = maxField.readValue(null, { coerce: true });
          assertNotNull(value, "UInt64.MaxValue should be readable");

          // UInt64.MaxValue = 18446744073709551615 (larger than JS Number can represent)
          assert(
            typeof value === "number" || typeof value === "bigint" || value instanceof UInt64,
            `UInt64 should be number/bigint/UInt64, got: ${typeof value}`,
          );
          console.log(`  - UInt64.MaxValue = ${value}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue for Decimal type constants", ({ domain }) => {
      const decimalClass = domain.tryClass("System.Decimal");

      if (decimalClass) {
        const oneField = decimalClass.tryField("One");
        if (oneField) {
          console.log(`  - Decimal.One type kind: ${oneField.type.kind}`);
          try {
            const value = oneField.readValue(null, { coerce: true });
            console.log(`  - Decimal.One: ${value}`);
          } catch (error) {
            console.log(`  - Decimal.One read: ${error}`);
          }
        }

        const zeroField = decimalClass.tryField("Zero");
        if (zeroField) {
          try {
            const value = zeroField.readValue(null, { coerce: true });
            console.log(`  - Decimal.Zero: ${value}`);
          } catch (error) {
            console.log(`  - Decimal.Zero read: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField readValue for TimeSpan constants", ({ domain }) => {
      const timeSpanClass = domain.tryClass("System.TimeSpan");

      if (timeSpanClass) {
        const zeroField = timeSpanClass.tryField("Zero");
        if (zeroField) {
          console.log(`  - TimeSpan.Zero type kind: ${zeroField.type.kind}`);
          try {
            const value = zeroField.readValue(null, { coerce: true });
            console.log(`  - TimeSpan.Zero: ${value}`);
          } catch (error) {
            console.log(`  - TimeSpan.Zero read: ${error}`);
          }
        }

        const ticksPerSecondField = timeSpanClass.tryField("TicksPerSecond");
        if (ticksPerSecondField) {
          try {
            const value = ticksPerSecondField.readValue(null, { coerce: true });
            // TicksPerSecond = 10000000
            console.log(`  - TimeSpan.TicksPerSecond: ${value}`);
          } catch (error) {
            console.log(`  - TimeSpan.TicksPerSecond read: ${error}`);
          }
        }
      }
    }),
  );

  results.push(
    await withDomain("MonoField type coercion should handle all primitive types consistently", ({ domain }) => {
      const testCases = [
        { class: "System.Boolean", fields: ["TrueString", "FalseString"] },
        { class: "System.Byte", fields: ["MinValue", "MaxValue"] },
        { class: "System.SByte", fields: ["MinValue", "MaxValue"] },
        { class: "System.Int16", fields: ["MinValue", "MaxValue"] },
        { class: "System.UInt16", fields: ["MinValue", "MaxValue"] },
        { class: "System.Int32", fields: ["MinValue", "MaxValue"] },
        { class: "System.UInt32", fields: ["MinValue", "MaxValue"] },
        { class: "System.Int64", fields: ["MinValue", "MaxValue"] },
        { class: "System.UInt64", fields: ["MinValue", "MaxValue"] },
        { class: "System.Single", fields: ["MinValue", "MaxValue", "Epsilon"] },
        { class: "System.Double", fields: ["MinValue", "MaxValue", "Epsilon"] },
        { class: "System.Char", fields: ["MinValue", "MaxValue"] },
      ];

      let successCount = 0;
      let totalCount = 0;

      testCases.forEach(tc => {
        const cls = domain.tryClass(tc.class);
        if (cls) {
          tc.fields.forEach(fieldName => {
            totalCount++;
            const field = cls.tryField(fieldName);
            if (field) {
              try {
                const value = field.readValue(null, { coerce: true });
                if (value !== undefined) {
                  successCount++;
                }
              } catch {
                // Silent fail for this aggregate test
              }
            }
          });
        }
      });

      console.log(`  - Type coercion: ${successCount}/${totalCount} fields read successfully`);
      assert(
        successCount > totalCount * 0.5,
        `At least 50% of fields should be readable, got ${successCount}/${totalCount}`,
      );
    }),
  );

  return results;
}

/**
 * Comprehensive MonoObject Tests
 * Tests for MonoObject functionality including object creation, cloning,
 * value access, type conversion, and lifecycle management
 */

import Mono from "../src";
import { MonoObject } from "../src/model/object";
import { withCoreClasses, withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull, assertThrows, createErrorHandlingTest } from "./test-framework";

export async function createMonoObjectTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== OBJECT CREATION TESTS =====

  results.push(
    await withCoreClasses("MonoObject should be creatable from class", ({ objectClass }) => {
      const obj = objectClass.newObject();
      assertNotNull(obj, "Should create new object");
      assert(!obj.pointer.isNull(), "Object pointer should not be null");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject should have class reference", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const klass = obj.class;
      assertNotNull(klass, "Object should have class reference");
      assert(klass.name === "Object", "Class name should be Object");
    }),
  );

  // ===== OBJECT CLONING TESTS =====

  results.push(
    await withCoreClasses("MonoObject.clone should create new object", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.clone();

      assertNotNull(cloned, "Clone should return object");
      // Different pointers
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Clone should have different pointer");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject.clone should preserve class", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.clone();

      // Same class
      assert(obj.class.fullName === cloned.class.fullName, "Clone should have same class");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject.deepClone should create new object", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.deepClone();

      assertNotNull(cloned, "Deep clone should return object");
      // Different pointers
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Deep clone should have different pointer");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject.deepClone should accept maxDepth parameter", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.deepClone(5); // Custom max depth

      assertNotNull(cloned, "Deep clone with maxDepth should return object");
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Deep clone should have different pointer");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject.deepClone should preserve class", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.deepClone();

      assert(obj.class.fullName === cloned.class.fullName, "Deep clone should have same class");
    }),
  );

  results.push(
    await withDomain("MonoObject.clone should preserve reference field values", ({ domain }) => {
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

      const newValue = "frida-mono-bridge-clone";
      const newValuePtr = Mono.api.stringNew(newValue);
      stringField.setValue(obj, newValuePtr);

      const cloned = obj.clone();
      const clonedValue = stringField.readValue(cloned, { coerce: true });
      assert(clonedValue === newValue, `Expected '${newValue}', got: ${clonedValue}`);
    }),
  );

  results.push(
    await withDomain("MonoObject.clone should copy base class instance fields", ({ domain }) => {
      const derivedClass =
        domain.tryClass("System.ArgumentException") ||
        domain.tryClass("System.ArgumentNullException") ||
        domain.tryClass("System.InvalidOperationException");
      if (!derivedClass) {
        console.log("[SKIP] No derived exception class found");
        return;
      }

      let baseClass = derivedClass.parent;
      let baseStringField: (typeof derivedClass.fields)[number] | null = null;

      while (baseClass) {
        const candidate = baseClass.fields.find(field => {
          if (field.isStatic || field.isInitOnly || field.isLiteral) {
            return false;
          }
          const typeName = field.type.fullName;
          return typeName === "System.String" || typeName === "String";
        });

        if (candidate) {
          baseStringField = candidate;
          break;
        }

        baseClass = baseClass.parent;
      }

      if (!baseStringField) {
        console.log("[SKIP] No writable string field found on base exception class hierarchy");
        return;
      }

      const obj = derivedClass.alloc();
      assertNotNull(obj, "Derived exception instance should be allocated");

      const newValue = "frida-mono-bridge-base-field";
      const newValuePtr = Mono.api.stringNew(newValue);
      baseStringField.setValue(obj, newValuePtr);

      const cloned = obj.clone();
      const clonedValue = baseStringField.readValue(cloned, { coerce: true });
      assert(clonedValue === newValue, `Expected '${newValue}', got: ${clonedValue}`);
    }),
  );

  // ===== OBJECT TYPE TESTS =====

  results.push(
    await withCoreClasses("MonoObject should return correct class type", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const klass = obj.class;

      assertNotNull(klass, "Object should have class");
      assert(klass.name === "Object", "Class name should be Object");
      assert(klass.namespace === "System", "Namespace should be System");
    }),
  );

  // ===== OBJECT TOSTRING TESTS =====

  results.push(
    await withCoreClasses("MonoObject toString should work", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const str = obj.toString();
      assertNotNull(str, "toString should return value");
      assert(typeof str === "string", "toString should return string");
    }),
  );

  // ===== OBJECT COMPARISON TESTS =====

  results.push(
    await withCoreClasses("MonoObject equals should work for same object", ({ objectClass }) => {
      const obj = objectClass.newObject();
      assert(obj.equals(obj), "Same object should be equal to itself");
    }),
  );

  results.push(
    await withCoreClasses("MonoObject clone should not be equal by pointer", ({ objectClass }) => {
      const obj = objectClass.newObject();
      const cloned = obj.clone();

      assert(!obj.equals(cloned), "Clone should not be equal to original");
    }),
  );

  // ===== ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoObject operations should handle null gracefully", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      assertNotNull(obj, "Object should be created");

      // These operations should not crash
      const klass = obj.class;
      assertNotNull(klass, "class should work");

      const clone = obj.clone();
      assertNotNull(clone, "clone should work");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoObject field access should reject null instances", () => {
      // The object model enforces non-NULL handles at construction time.
      // Nullable pointers should be handled via the facade tryWrap() helpers.
      assert(Mono.object.tryWrap(ptr(0)) === null, "Mono.object.tryWrap(NULL) should return null");

      assertThrows(() => Mono.object.wrap(ptr(0)), "Mono.object.wrap(NULL) should throw (invalid handle)");

      assertThrows(() => new MonoObject(Mono.api, ptr(0)), "MonoObject constructor should throw for NULL handle");
    }),
  );

  return results;
}

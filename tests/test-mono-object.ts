/**
 * Comprehensive MonoObject Tests
 * Tests for MonoObject functionality including object creation, cloning,
 * value access, type conversion, and lifecycle management
 */

import Mono from "../src";
import { TestResult, assert, assertNotNull, createErrorHandlingTest, createMonoDependentTest } from "./test-framework";

export async function createMonoObjectTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== OBJECT CREATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoObject should be creatable from class", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      assertNotNull(obj, "Should create new object");
      assert(!obj.pointer.isNull(), "Object pointer should not be null");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject should have class reference", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const klass = obj.class;
      assertNotNull(klass, "Object should have class reference");
      assert(klass.name === "Object", "Class name should be Object");
    }),
  );

  // ===== OBJECT CLONING TESTS =====

  results.push(
    await createMonoDependentTest("MonoObject.clone should create new object", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.clone();

      assertNotNull(cloned, "Clone should return object");
      // Different pointers
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Clone should have different pointer");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject.clone should preserve class", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.clone();

      // Same class
      assert(obj.class.fullName === cloned.class.fullName, "Clone should have same class");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject.deepClone should create new object", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.deepClone();

      assertNotNull(cloned, "Deep clone should return object");
      // Different pointers
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Deep clone should have different pointer");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject.deepClone should accept maxDepth parameter", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.deepClone(5); // Custom max depth

      assertNotNull(cloned, "Deep clone with maxDepth should return object");
      assert(obj.pointer.toString() !== cloned.pointer.toString(), "Deep clone should have different pointer");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject.deepClone should preserve class", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.deepClone();

      assert(obj.class.fullName === cloned.class.fullName, "Deep clone should have same class");
    }),
  );

  // ===== OBJECT TYPE TESTS =====

  results.push(
    await createMonoDependentTest("MonoObject should return correct class type", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const klass = obj.class;

      assertNotNull(klass, "Object should have class");
      assert(klass.name === "Object", "Class name should be Object");
      assert(klass.namespace === "System", "Namespace should be System");
    }),
  );

  // ===== OBJECT TOSTRING TESTS =====

  results.push(
    await createMonoDependentTest("MonoObject toString should work", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const str = obj.toString();
      assertNotNull(str, "toString should return value");
      assert(typeof str === "string", "toString should return string");
    }),
  );

  // ===== OBJECT COMPARISON TESTS =====

  results.push(
    await createMonoDependentTest("MonoObject equals should work for same object", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      assert(obj.pointer.equals(obj.pointer), "Same object should be equal to itself");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoObject clone should not be equal by pointer", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should exist");

      const obj = objectClass!.newObject();
      const cloned = obj.clone();

      assert(!obj.pointer.equals(cloned.pointer), "Clone should have different pointer");
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

  return results;
}

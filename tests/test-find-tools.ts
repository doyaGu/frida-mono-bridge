/**
 * Find Tools Module Tests
 *
 * Tests for search and discovery tools API:
 * - classExact(fullName) - Exact class lookup by full name (fast path for System.*)
 * - classes/methods/fields/properties with wildcard/regex patterns
 *
 * PERFORMANCE NOTE:
 * The wildcard search functions (classes, methods, fields, properties) enumerate
 * ALL classes across ALL assemblies, which is very slow in large Unity projects.
 * These tests use classExact for System.* classes which uses a fast mscorlib lookup.
 * Wildcard search tests are intentionally limited and may be slow.
 */

import Mono from "../src";
import { TestResult, assert, assertNotNull, createMonoDependentTest } from "./test-framework";

export async function createFindToolTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // =====================================================
  // Section 1: API Availability Tests (Fast)
  // =====================================================
  results.push(
    await createMonoDependentTest("Find - Mono.find object exists", () => {
      assertNotNull(Mono.find, "Mono.find should exist");
      assert(typeof Mono.find === "object", "Mono.find should be an object");
    }),
  );

  results.push(
    await createMonoDependentTest("Find - all search functions exist", () => {
      assert(typeof Mono.find.classes === "function", "Mono.find.classes should be a function");
      assert(typeof Mono.find.methods === "function", "Mono.find.methods should be a function");
      assert(typeof Mono.find.fields === "function", "Mono.find.fields should be a function");
      assert(typeof Mono.find.properties === "function", "Mono.find.properties should be a function");
      assert(typeof Mono.find.classExact === "function", "Mono.find.classExact should be a function");
    }),
  );

  // =====================================================
  // Section 2: classExact - Fast Exact Lookup (mscorlib)
  // These tests use the optimized mscorlib fast-path
  // =====================================================
  results.push(
    await createMonoDependentTest("Find.classExact - System.String", () => {
      const klass = Mono.find.classExact("System.String");
      assertNotNull(klass, "Should find System.String");
      assert(klass!.name === "String", "Name should be String");
      assert(klass!.namespace === "System", "Namespace should be System");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Int32", () => {
      const klass = Mono.find.classExact("System.Int32");
      assertNotNull(klass, "Should find System.Int32");
      assert(klass!.name === "Int32", "Name should be Int32");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Object", () => {
      const klass = Mono.find.classExact("System.Object");
      assertNotNull(klass, "Should find System.Object");
      assert(klass!.name === "Object", "Name should be Object");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Boolean", () => {
      const klass = Mono.find.classExact("System.Boolean");
      assertNotNull(klass, "Should find System.Boolean");
      assert(klass!.name === "Boolean", "Name should be Boolean");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Double", () => {
      const klass = Mono.find.classExact("System.Double");
      assertNotNull(klass, "Should find System.Double");
      assert(klass!.name === "Double", "Name should be Double");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Array", () => {
      const klass = Mono.find.classExact("System.Array");
      assertNotNull(klass, "Should find System.Array");
      assert(klass!.name === "Array", "Name should be Array");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Type", () => {
      const klass = Mono.find.classExact("System.Type");
      assertNotNull(klass, "Should find System.Type");
      assert(klass!.name === "Type", "Name should be Type");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Exception", () => {
      const klass = Mono.find.classExact("System.Exception");
      assertNotNull(klass, "Should find System.Exception");
      assert(klass!.name === "Exception", "Name should be Exception");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Collections.Generic.List`1", () => {
      const klass = Mono.find.classExact("System.Collections.Generic.List`1");
      assertNotNull(klass, "Should find List<T>");
      assert(klass!.name === "List`1", "Name should be List`1");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - System.Collections.Generic.Dictionary`2", () => {
      const klass = Mono.find.classExact("System.Collections.Generic.Dictionary`2");
      assertNotNull(klass, "Should find Dictionary<K,V>");
      assert(klass!.name === "Dictionary`2", "Name should be Dictionary`2");
    }),
  );

  // =====================================================
  // Section 3: classExact - Result Validation
  // =====================================================
  results.push(
    await createMonoDependentTest("Find.classExact - result has valid methods", () => {
      const klass = Mono.find.classExact("System.String");
      assertNotNull(klass, "Should find System.String");

      const methods = klass!.methods;
      assert(Array.isArray(methods), "methods should be array");
      assert(methods.length > 0, "String should have methods");

      // Check for common String methods
      const methodNames = methods.map(m => m.name);
      assert(methodNames.includes("ToString"), "Should have ToString method");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - result has valid fields", () => {
      const klass = Mono.find.classExact("System.String");
      assertNotNull(klass, "Should find System.String");

      const fields = klass!.fields;
      assert(Array.isArray(fields), "fields should be array");
      // String.Empty is a static field
      const hasEmpty = fields.some(f => f.name === "Empty");
      console.log(`[INFO] String has ${fields.length} fields, Empty: ${hasEmpty}`);
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - result has valid properties", () => {
      const klass = Mono.find.classExact("System.String");
      assertNotNull(klass, "Should find System.String");

      const props = klass!.properties;
      assert(Array.isArray(props), "properties should be array");

      // Check for common String properties
      const propNames = props.map(p => p.name);
      assert(propNames.includes("Length"), "Should have Length property");
    }),
  );

  // =====================================================
  // Section 4: Unity Classes (Fast Path if Unity Project)
  // =====================================================
  results.push(
    await createMonoDependentTest("Find.classExact - UnityEngine.Object (Unity)", () => {
      const klass = Mono.find.classExact("UnityEngine.Object");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "Object", "Name should be Object");
      assert(klass.namespace === "UnityEngine", "Namespace should be UnityEngine");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - UnityEngine.GameObject (Unity)", () => {
      const klass = Mono.find.classExact("UnityEngine.GameObject");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "GameObject", "Name should be GameObject");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - UnityEngine.Transform (Unity)", () => {
      const klass = Mono.find.classExact("UnityEngine.Transform");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "Transform", "Name should be Transform");
    }),
  );

  results.push(
    await createMonoDependentTest("Find.classExact - UnityEngine.MonoBehaviour (Unity)", () => {
      const klass = Mono.find.classExact("UnityEngine.MonoBehaviour");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "MonoBehaviour", "Name should be MonoBehaviour");
    }),
  );

  return results;
}

export default createFindToolTests;

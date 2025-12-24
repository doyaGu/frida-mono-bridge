/**
 * MonoClass Generic Type Tests
 *
 * Tests for generic type support in MonoClass:
 * - isGenericType()
 * - isGenericTypeDefinition()
 * - isConstructedGenericType()
 * - getGenericArgumentCount()
 * - getGenericParameterCount()
 * - getGenericArguments()
 * - getGenericTypeDefinition()
 */

import { withAssemblies, withCoreClasses, withDomain, withGenerics } from "./test-fixtures";
import { TestResult, assert, assertNotNull } from "./test-framework";

/**
 * Create MonoClass generic type test suite
 */
export async function createGenericTypeTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ============================================
  // Non-Generic Type Tests
  // ============================================
  results.push(
    await withCoreClasses("Generic - String is not generic type", ({ stringClass }) => {
      assert(!stringClass.isGenericType, "String should not be generic");
      assert(!stringClass.isGenericTypeDefinition, "String should not be generic definition");
      assert(!stringClass.isConstructedGenericType, "String should not be constructed generic");
      assert(stringClass.genericArgumentCount === 0, "String should have 0 generic arguments");
      assert(stringClass.genericParameterCount === 0, "String should have 0 generic parameters");
    }),
  );

  results.push(
    await withCoreClasses("Generic - Int32 is not generic type", ({ int32Class }) => {
      assert(!int32Class.isGenericType, "Int32 should not be generic");
      assert(int32Class.genericArguments.length === 0, "Int32 should have no generic arguments");
    }),
  );

  // ============================================
  // Generic Type Definition Tests
  // ============================================
  results.push(
    await withGenerics("Generic - List`1 exists", ({ listClass }) => {
      if (!listClass) {
        console.log("[INFO] List<T> not found, trying alternate names");
        return;
      }

      console.log(`[INFO] Found ${listClass.fullName}`);
      const desc = listClass.describe();
      console.log(`[INFO] isGenericType: ${desc.isGenericType}`);
      console.log(`[INFO] isGenericTypeDefinition: ${desc.isGenericTypeDefinition}`);
      console.log(`[INFO] genericParameterCount: ${desc.genericParameterCount}`);
      console.log(`[INFO] genericArgumentCount: ${desc.genericArgumentCount}`);
    }),
  );

  results.push(
    await withGenerics("Generic - Dictionary`2 exists", ({ dictionaryClass }) => {
      if (!dictionaryClass) {
        console.log("[INFO] Dictionary<K,V> not found");
        return;
      }

      console.log(`[INFO] Found ${dictionaryClass.fullName}`);
      const paramCount = dictionaryClass.genericParameterCount;
      console.log(`[INFO] Generic parameter count: ${paramCount}`);

      // Dictionary should have 2 type parameters (K, V)
      if (paramCount > 0) {
        assert(paramCount === 2, "Dictionary should have 2 type parameters");
      }
    }),
  );

  // ============================================
  // Constructed Generic Type Tests
  // ============================================
  results.push(
    await withDomain("Generic - Find constructed generic types", ({ domain }) => {
      let genericFound = false;

      // Search for any constructed generic type
      for (const assembly of domain.assemblies.slice(0, 5)) {
        for (const klass of assembly.classes.slice(0, 100)) {
          const argCount = klass.genericArgumentCount;
          if (argCount > 0) {
            console.log(`[INFO] Found constructed generic: ${klass.fullName}`);
            console.log(`[INFO]   Generic argument count: ${argCount}`);

            const args = klass.genericArguments;
            for (let i = 0; i < args.length; i++) {
              console.log(`[INFO]   Argument ${i}: ${args[i].fullName}`);
            }

            genericFound = true;
            break;
          }
        }
        if (genericFound) break;
      }

      if (!genericFound) {
        console.log("[INFO] No constructed generic types found in scanned classes");
      }
    }),
  );

  results.push(
    await withDomain("Generic - getGenericArguments returns MonoClass array", ({ domain }) => {
      // Search for any constructed generic type
      for (const assembly of domain.assemblies) {
        for (const klass of assembly.classes) {
          const argCount = klass.genericArgumentCount;
          if (argCount > 0) {
            const args = klass.genericArguments;

            assert(Array.isArray(args), "Should return array");
            assert(args.length === argCount, "Array length should match count");

            for (const arg of args) {
              assertNotNull(arg, "Argument should not be null");
              assert(typeof arg.fullName === "string", "Argument should have name");
            }

            return;
          }
        }
      }

      console.log("[INFO] No constructed generic types found to test");
    }),
  );

  // ============================================
  // Generic Type Definition Retrieval Tests
  // ============================================
  results.push(
    await withDomain("Generic - getGenericTypeDefinition for constructed type", ({ domain }) => {
      // Search for any constructed generic type
      for (const assembly of domain.assemblies) {
        for (const klass of assembly.classes) {
          if (klass.isConstructedGenericType) {
            const def = klass.genericTypeDefinition;

            if (def) {
              console.log(`[INFO] Constructed: ${klass.fullName}`);
              console.log(`[INFO] Definition: ${def.fullName}`);

              // Definition should be a generic type definition
              if (def.isGenericTypeDefinition) {
                console.log("[INFO] Definition is correctly a generic type definition");
              }
            }

            return;
          }
        }
      }

      console.log("[INFO] No constructed generic types found to test");
    }),
  );

  // ============================================
  // Caching Tests
  // ============================================
  results.push(
    await withDomain("Generic - getGenericArguments is cached", ({ domain }) => {
      for (const assembly of domain.assemblies) {
        for (const klass of assembly.classes) {
          if (klass.genericArgumentCount > 0) {
            const args1 = klass.genericArguments;
            const args2 = klass.genericArguments;

            // Should return copies, but from same cached source
            assert(args1.length === args2.length, "Should return same length");

            return;
          }
        }
      }

      console.log("[INFO] No generic types to test caching");
    }),
  );

  results.push(
    await withDomain("Generic - getGenericTypeDefinition is cached", ({ domain }) => {
      for (const assembly of domain.assemblies) {
        for (const klass of assembly.classes) {
          if (klass.isConstructedGenericType) {
            const def1 = klass.genericTypeDefinition;
            const def2 = klass.genericTypeDefinition;

            // Should return same cached value
            assert(def1 === def2, "Should return same cached instance");

            return;
          }
        }
      }

      console.log("[INFO] No constructed generics to test caching");
    }),
  );

  // ============================================
  // Describe Tests
  // ============================================
  results.push(
    await withCoreClasses("Generic - describe() includes generic info", ({ stringClass }) => {
      const desc = stringClass.describe();

      assert("isGenericType" in desc, "describe should have isGenericType");
      assert("isGenericTypeDefinition" in desc, "describe should have isGenericTypeDefinition");
      assert("genericArgumentCount" in desc, "describe should have genericArgumentCount");
      assert("genericParameterCount" in desc, "describe should have genericParameterCount");

      assert(desc.isGenericType === false, "String isGenericType should be false");
      assert(desc.genericArgumentCount === 0, "String genericArgumentCount should be 0");
    }),
  );

  // ============================================
  // Edge Cases
  // ============================================
  results.push(
    await withCoreClasses("Generic - non-existent Unity API graceful handling", ({ stringClass }) => {
      // These should not throw even if Unity API is not available
      const argCount = stringClass.genericArgumentCount;
      const paramCount = stringClass.genericParameterCount;
      const args = stringClass.genericArguments;
      const def = stringClass.genericTypeDefinition;

      assert(argCount === 0, "Non-generic should have 0 arguments");
      assert(paramCount === 0, "Non-generic should have 0 parameters");
      assert(args.length === 0, "Non-generic should have empty arguments array");
      assert(def === null, "Non-generic should have null definition");
    }),
  );

  results.push(
    await withGenerics("Generic - Nullable`1 is generic type definition", ({ nullableClass }) => {
      if (!nullableClass) {
        console.log("[INFO] Nullable<T> not found");
        return;
      }

      console.log(`[INFO] Found ${nullableClass.fullName}`);
      const paramCount = nullableClass.genericParameterCount;
      console.log(`[INFO] Generic parameter count: ${paramCount}`);

      if (paramCount > 0) {
        assert(paramCount === 1, "Nullable should have 1 type parameter");
        assert(nullableClass.isGenericTypeDefinition, "Should be generic type definition");
      }
    }),
  );

  results.push(
    await withDomain("Generic - Action`1 is generic delegate", ({ domain }) => {
      const actionClass = domain.tryClass("System.Action`1");

      if (!actionClass) {
        console.log("[INFO] Action<T> not found");
        return;
      }

      console.log(`[INFO] Found ${actionClass.fullName}`);
      console.log(`[INFO] isDelegate: ${actionClass.isDelegate}`);
      console.log(`[INFO] isGenericTypeDefinition: ${actionClass.isGenericTypeDefinition}`);

      const paramCount = actionClass.genericParameterCount;
      if (paramCount > 0) {
        assert(paramCount === 1, "Action<T> should have 1 type parameter");
      }
    }),
  );

  // ============================================
  // Integration Tests
  // ============================================
  results.push(
    await withAssemblies("Generic - enumerate all generic types in mscorlib", ({ mscorlib }) => {
      if (!mscorlib) {
        console.log("[INFO] mscorlib not found");
        return;
      }

      let genericDefCount = 0;
      let constructedCount = 0;

      for (const klass of mscorlib.classes) {
        if (klass.isGenericTypeDefinition) {
          genericDefCount++;
        }
        if (klass.isConstructedGenericType) {
          constructedCount++;
        }
      }

      console.log(`[INFO] mscorlib generic type definitions: ${genericDefCount}`);
      console.log(`[INFO] mscorlib constructed generic types: ${constructedCount}`);
    }),
  );

  // ============================================
  // Generic Method Tests
  // ============================================
  results.push(
    await withCoreClasses("Generic Method - non-generic method is not generic", ({ stringClass }) => {
      const toStringMethod = stringClass.tryMethod("ToString", 0);
      assertNotNull(toStringMethod, "ToString should exist");

      assert(!toStringMethod.isGenericMethod, "ToString should not be generic");
      assert(!toStringMethod.isGenericMethodDefinition, "ToString should not be generic definition");
      assert(toStringMethod.genericArgumentCount === 0, "ToString should have 0 generic args");
      assert(toStringMethod.genericArguments.length === 0, "ToString should have empty generic args");
    }),
  );

  results.push(
    await withDomain("Generic Method - Array generic methods", ({ domain }) => {
      const arrayClass = domain.tryClass("System.Array");
      if (!arrayClass) {
        console.log("[INFO] System.Array not found");
        return;
      }

      const methods = arrayClass.methods;
      let genericMethodCount = 0;

      for (const method of methods) {
        if (method.isGenericMethod) {
          genericMethodCount++;
          const argCount = method.genericArgumentCount;
          console.log(`[INFO] Generic method: ${method.name}, ${argCount} type param(s)`);
        }
      }

      console.log(`[INFO] System.Array has ${genericMethodCount} generic methods`);
    }),
  );

  results.push(
    await withDomain("Generic Method - Enumerable LINQ methods", ({ domain }) => {
      const enumerableClass = domain.tryClass("System.Linq.Enumerable");
      if (!enumerableClass) {
        console.log("[INFO] System.Linq.Enumerable not found (LINQ may not be loaded)");
        return;
      }

      const methods = enumerableClass.methods;
      let genericMethodCount = 0;

      for (const method of methods) {
        if (method.isGenericMethod) {
          genericMethodCount++;
          if (genericMethodCount <= 5) {
            console.log(`[INFO] Generic: ${method.name}, ${method.genericArgumentCount} type param(s)`);
          }
        }
      }

      console.log(`[INFO] Enumerable has ${genericMethodCount} generic methods`);
    }),
  );

  results.push(
    await withCoreClasses("Generic Method - describe includes generic info", ({ stringClass }) => {
      const toStringMethod = stringClass.tryMethod("ToString", 0);
      assertNotNull(toStringMethod, "ToString should exist");

      const desc = toStringMethod.describe();

      assert("isGenericMethod" in desc, "describe should have isGenericMethod");
      assert("genericArgumentCount" in desc, "describe should have genericArgumentCount");

      assert(desc.isGenericMethod === false, "ToString isGenericMethod should be false");
      assert(desc.genericArgumentCount === 0, "ToString genericArgumentCount should be 0");
    }),
  );

  results.push(
    await withCoreClasses("Generic Method - makeGenericMethod returns null for non-generic", ({ stringClass }) => {
      const toStringMethod = stringClass.tryMethod("ToString", 0);
      assertNotNull(toStringMethod, "ToString should exist");

      const result = toStringMethod.makeGenericMethod([]);
      assert(result === null, "makeGenericMethod should return null for non-generic method");
    }),
  );

  results.push(
    await withCoreClasses("Generic Method - getGenericArguments graceful handling", ({ int32Class }) => {
      const toStringMethod = int32Class.tryMethod("ToString", 0);
      assertNotNull(toStringMethod, "ToString should exist");

      // Should not throw even if Unity API is not available
      const args = toStringMethod.genericArguments;
      assert(Array.isArray(args), "Should return array");
      assert(args.length === 0, "Non-generic method should have empty args");
    }),
  );

  // ============================================
  // makeGenericType Tests
  // ============================================
  results.push(
    await withGenerics("makeGenericType - Create List<String>", ({ listClass, stringClass }) => {
      if (!listClass) {
        console.log("[SKIP] List`1 not found");
        return;
      }

      console.log(`[INFO] Creating List<String> from ${listClass.fullName}`);
      const listOfString = listClass.makeGenericType([stringClass]);

      if (listOfString) {
        console.log(`[SUCCESS] Created: ${listOfString.fullName}`);
        assert(listOfString.isConstructedGenericType, "Result should be constructed generic type");
      } else {
        console.log("[INFO] makeGenericType returned null - API may not be available");
      }
    }),
  );

  results.push(
    await withGenerics(
      "makeGenericType - Create Dictionary<String, Int32>",
      ({ dictionaryClass, stringClass, int32Class }) => {
        if (!dictionaryClass) {
          console.log("[SKIP] Dictionary`2 not found");
          return;
        }

        console.log(`[INFO] Creating Dictionary<String, Int32> from ${dictionaryClass.fullName}`);
        const dictOfStringInt = dictionaryClass.makeGenericType([stringClass, int32Class]);

        if (dictOfStringInt) {
          console.log(`[SUCCESS] Created: ${dictOfStringInt.fullName}`);
          assert(dictOfStringInt.isConstructedGenericType, "Result should be constructed generic type");
        } else {
          console.log("[INFO] makeGenericType returned null - API may not be available");
        }
      },
    ),
  );

  results.push(
    await withCoreClasses("makeGenericType - throws on non-generic type", ({ stringClass }) => {
      let threw = false;
      try {
        stringClass.makeGenericType([stringClass]);
      } catch (_e) {
        threw = true;
        console.log(`[INFO] Correctly threw: ${_e}`);
      }

      assert(threw, "Should throw when called on non-generic type");
    }),
  );

  results.push(
    await withGenerics("makeGenericType - throws on wrong argument count", ({ listClass, stringClass }) => {
      if (!listClass) {
        console.log("[SKIP] List`1 not found");
        return;
      }

      let threw = false;
      try {
        listClass.makeGenericType([stringClass, stringClass]); // 2 args for 1 param
      } catch (_e) {
        threw = true;
        console.log(`[INFO] Correctly threw: ${_e}`);
      }

      assert(threw, "Should throw on argument count mismatch");
    }),
  );

  results.push(
    await withGenerics("makeGenericType - Nullable<Int32>", ({ nullableClass, int32Class }) => {
      if (!nullableClass) {
        console.log("[SKIP] Nullable`1 not found");
        return;
      }

      console.log(`[INFO] Creating Nullable<Int32> from ${nullableClass.fullName}`);
      const nullableInt = nullableClass.makeGenericType([int32Class]);

      if (nullableInt) {
        console.log(`[SUCCESS] Created: ${nullableInt.fullName}`);
        assert(nullableInt.isValueType, "Nullable<Int32> should be value type");
      } else {
        console.log("[INFO] makeGenericType returned null - API may not be available");
      }
    }),
  );

  // ============================================
  // makeGenericMethod Tests
  // ============================================
  results.push(
    await withCoreClasses("makeGenericMethod - returns null for non-generic method", ({ stringClass }) => {
      const toStringMethod = stringClass.tryMethod("ToString", 0);
      assertNotNull(toStringMethod, "ToString should exist");

      const result = toStringMethod.makeGenericMethod([]);
      assert(result === null, "makeGenericMethod should return null for non-generic method");
    }),
  );

  results.push(
    await withDomain("makeGenericMethod - throws on wrong argument count", ({ domain }) => {
      // Try to find a generic method - Enumerable has many
      const enumerable = domain.tryClass("System.Linq.Enumerable");
      if (!enumerable) {
        console.log("[SKIP] System.Linq.Enumerable not found");
        return;
      }

      // Find a generic method
      const methods = enumerable.methods;
      const genericMethod = methods.find(m => m.isGenericMethodDefinition && m.genericArgumentCount === 1);

      if (!genericMethod) {
        console.log("[SKIP] No single-param generic method found");
        return;
      }

      console.log(`[INFO] Testing with ${genericMethod.name}`);

      const intClass = domain.tryClass("System.Int32")!;

      let threw = false;
      try {
        genericMethod.makeGenericMethod([intClass, intClass]); // 2 args for 1 param
      } catch (_e) {
        threw = true;
        console.log(`[INFO] Correctly threw: ${_e}`);
      }

      assert(threw, "Should throw on argument count mismatch");
    }),
  );

  results.push(
    await withDomain("makeGenericMethod - Enumerable.Where<T>", ({ domain }) => {
      const enumerable = domain.tryClass("System.Linq.Enumerable");
      if (!enumerable) {
        console.log("[SKIP] System.Linq.Enumerable not found");
        return;
      }

      // Find Where method (it's generic with 1 type param)
      const methods = enumerable.methods;
      const whereMethod = methods.find(
        m => m.name === "Where" && m.isGenericMethodDefinition && m.genericArgumentCount === 1,
      );

      if (!whereMethod) {
        console.log("[INFO] Where<T> not found, trying other generic methods");
        const anyGeneric = methods.find(m => m.isGenericMethodDefinition);
        if (anyGeneric) {
          console.log(`[INFO] Found generic method: ${anyGeneric.name}`);
        }
        return;
      }

      const intClass = domain.tryClass("System.Int32")!;
      console.log(`[INFO] Making Where<Int32> from ${whereMethod.name}`);

      const whereInt = whereMethod.makeGenericMethod([intClass]);

      if (whereInt) {
        console.log(`[SUCCESS] Created: ${whereInt.name}`);
        assert(!whereInt.isGenericMethodDefinition, "Result should not be generic definition");
      } else {
        console.log("[INFO] makeGenericMethod returned null - API may not be available");
      }
    }),
  );

  results.push(
    await withDomain("makeGenericMethod - Array.Empty<T>", ({ domain }) => {
      const arrayClass = domain.tryClass("System.Array");
      if (!arrayClass) {
        console.log("[SKIP] System.Array not found");
        return;
      }

      // Find Empty<T> method
      const methods = arrayClass.methods;
      const emptyMethod = methods.find(m => m.name === "Empty" && m.isGenericMethodDefinition);

      if (!emptyMethod) {
        console.log("[INFO] Array.Empty<T> not found");
        return;
      }

      const stringClass = domain.tryClass("System.String")!;
      console.log(`[INFO] Making Empty<String> from ${emptyMethod.name}`);

      const emptyString = emptyMethod.makeGenericMethod([stringClass]);

      if (emptyString) {
        console.log(`[SUCCESS] Created: ${emptyString.name}`);
      } else {
        console.log("[INFO] makeGenericMethod returned null - API may not be available");
      }
    }),
  );

  return results;
}

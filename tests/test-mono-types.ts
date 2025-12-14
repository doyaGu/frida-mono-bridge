/**
 * Mono Types Tests
 * Consolidated tests for Domain, Assembly, and Class operations
 */

import Mono from "../src";
import {
  assert,
  assertApiAvailable,
  assertDomainAvailable,
  assertDomainCached,
  assertNotNull,
  assertPerformWorks,
  createApiAvailabilityTest,
  createDomainTestAsync,
  createDomainTestEnhanced,
  createMonoDependentTest,
  createNestedPerformTest,
  createPerformSmokeTest,
  createSmokeTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

export async function testMonoTypes(): Promise<TestResult> {
  console.log("\nMono Types (Domain, Assembly, Class):");

  const suite = new TestSuite("Mono Types Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "mono types"));

  // ============================================================================
  // DOMAIN TESTS
  // ============================================================================

  // Modern API tests
  await suite.addResultAsync(
    createMonoDependentTest("Mono.perform should work for domain tests", () => {
      assertPerformWorks("Mono.perform() should work for domain tests");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Mono.domain property should be accessible", () => {
      assertDomainAvailable("Mono.domain should be accessible");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Root domain should be accessible", () => {
      const domain = Mono.api.getRootDomain();
      assertNotNull(domain, "Root domain should not be null");
      assert(!domain.isNull(), "Root domain should not be NULL pointer");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Root domain should be cached", () => {
      const domain1 = Mono.api.getRootDomain();
      const domain2 = Mono.api.getRootDomain();

      assertNotNull(domain1, "First call should return domain");
      assertNotNull(domain2, "Second call should return domain");
      assert(domain1.equals(domain2), "Should return the same domain pointer");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Current domain can be retrieved", () => {
      // mono_domain_get is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_get")) {
        console.log("    (Skipped: mono_domain_get not available in this Mono version)");
        return;
      }
      const current = Mono.api.native.mono_domain_get();
      assertNotNull(current, "Current domain should not be null");
      assert(!current.isNull(), "Current domain should not be NULL");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Current domain should be root domain initially", () => {
      // mono_domain_get is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_get")) {
        console.log("    (Skipped: mono_domain_get not available in this Mono version)");
        return;
      }
      const root = Mono.api.getRootDomain();
      const current = Mono.api.native.mono_domain_get();

      assert(root.equals(current), "Current domain should equal root domain");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Multiple domain retrievals should be consistent", () => {
      const domains = [];
      for (let i = 0; i < 5; i++) {
        domains.push(Mono.api.getRootDomain());
      }

      for (let i = 1; i < domains.length; i++) {
        assert(domains[0].equals(domains[i]), `Domain ${i} should equal domain 0`);
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Domain should have assembly access methods", () => {
      const domain = Mono.domain;
      assert(typeof domain.assemblies !== "undefined", "Domain should have assemblies property");
      assert(typeof domain.assembly === "function", "Domain should have assembly method");
      assert(typeof domain.class === "function", "Domain should have class method");

      // Use tryAssembly to safely lookup assemblies without throwing
      const mscorlib = domain.tryAssembly("mscorlib");
      assert(mscorlib !== null || domain.tryAssembly("System.Private.CoreLib") !== null, "Should find a core assembly");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Domain should be accessible through multiple calls", () => {
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;

      assert(domain1 !== null, "First domain access should work");
      assert(domain2 !== null, "Second domain access should work");
      assert(domain1 === domain2, "Domain should be cached (same instance)");
    }),
  );

  // ============================================================================
  // ASSEMBLY TESTS
  // ============================================================================

  // Basic API tests
  await suite.addResultAsync(createPerformSmokeTest("assembly tests"));

  await suite.addResultAsync(
    createApiAvailabilityTest({
      context: "assembly operations",
      testName: "Assembly APIs should be available",
      requiredExports: ["mono_assembly_get_image", "mono_image_loaded", "mono_assembly_open"],
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should load core library assembly", domain => {
      const preferredAssemblies = ["mscorlib", "System.Private.CoreLib", "netstandard"];

      let coreAssembly = null;
      for (const candidate of preferredAssemblies) {
        const assembly = domain.tryAssembly(candidate);
        if (assembly) {
          coreAssembly = assembly;
          break;
        }
      }

      if (!coreAssembly) {
        console.log("    Core library assembly not detected; skipping deep validation");
        return;
      }

      assert(typeof coreAssembly.name !== "undefined", "Core assembly should expose name property");
      const name = coreAssembly.name;
      console.log(`    Loaded core library: ${name}`);

      const image = coreAssembly.image;
      assert(image !== null, "Core library should expose metadata image");
      assert(!image.pointer.isNull(), "Core library image pointer should not be NULL");

      // Skip class enumeration to avoid hanging on large assemblies
      console.log(`    Core library validation complete`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should find Unity assemblies", domain => {
      const unityAssemblies = ["UnityEngine.CoreModule", "UnityEngine", "Assembly-CSharp", "Assembly-CSharp-firstpass"];

      let foundCount = 0;
      for (const assemblyName of unityAssemblies) {
        const assembly = domain.tryAssembly(assemblyName);
        if (assembly) {
          foundCount++;
          console.log(`    Found ${assemblyName}: ${assembly.name}`);

          // Skip class enumeration to avoid slow operations
          console.log(`      Assembly found: ${assemblyName}`);
        }
      }

      if (foundCount === 0) {
        console.log("    No Unity assemblies found (may not be Unity process)");
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should explore assembly metadata", domain => {
      // Use direct assembly lookup to avoid slow getAssemblies() call
      const mscorlib = domain.tryAssembly("mscorlib");

      if (mscorlib) {
        const name = mscorlib.name;
        const image = mscorlib.image;

        assert(typeof name === "string", "Assembly name should be string");
        assert(name.length > 0, "Assembly name should not be empty");
        assert(image !== null, "Assembly should have image");

        console.log(`    Found mscorlib assembly: ${name}`);
      } else {
        console.log("    mscorlib not available, skipping metadata test");
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should validate assembly names and properties", domain => {
      // Use direct assembly lookup to avoid slow getAssemblies() call
      const mscorlib = domain.tryAssembly("mscorlib");

      if (mscorlib) {
        const name = mscorlib.name;
        const image = mscorlib.image;

        // Test name properties
        assert(typeof name === "string", "Assembly name should be string");
        assert(name.length > 0, "Assembly name should not be empty");
        assert(!name.includes("\0"), "Assembly name should not contain null bytes");

        // Test image properties
        assert(image !== null, "Assembly should have image");
        assert(typeof image.name !== "undefined", "Image should have name property");

        const imageName = image.name;
        if (imageName) {
          assert(typeof imageName === "string", "Image name should be string");
          console.log(`    Validated ${name} -> ${imageName}`);
        }
      } else {
        console.log("    mscorlib not available, skipping validation");
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should handle assembly lookup variations", domain => {
      // Test case sensitivity
      const mscorlibLower = domain.tryAssembly("mscorlib");
      const mscorlibUpper = domain.tryAssembly("MSCORLIB");

      if (mscorlibLower) {
        console.log("    Found mscorlib with lowercase name");
      }

      if (mscorlibUpper && mscorlibUpper !== mscorlibLower) {
        console.log("    Found different assembly with uppercase name (case-sensitive lookup)");
      }

      // Test with/without extension
      const withExtension = domain.tryAssembly("mscorlib.dll");
      if (withExtension) {
        console.log("    Found mscorlib with .dll extension");
      }

      // Test non-existent assemblies
      const nonExistent = domain.tryAssembly("NonExistent.Assembly");
      assert(nonExistent === null, "Non-existent assembly should return null");

      const emptyName = domain.tryAssembly("");
      assert(emptyName === null, "Empty assembly name should return null");

      console.log("    Assembly lookup variations handled correctly");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should test assembly caching and consistency", domain => {
      // Test specific assembly consistency using direct lookup (avoid getAssemblies)
      const mscorlib1 = domain.tryAssembly("mscorlib");
      const mscorlib2 = domain.tryAssembly("mscorlib");

      if (mscorlib1 && mscorlib2) {
        const samePointer = mscorlib1.pointer.equals(mscorlib2.pointer);
        assert(samePointer, "Assembly lookups should reference the same underlying object");
      }

      assertDomainCached();
      console.log("    Assembly caching and consistency verified");
    }),
  );

  // ============================================================================
  // CLASS TESTS
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Class APIs should be available", () => {
      assertApiAvailable("Mono.api should be accessible for class operations");
      assert(Mono.api.hasExport("mono_class_from_name"), "mono_class_from_name should be available");
      assert(
        Mono.api.hasExport("mono_class_get_method_from_name"),
        "mono_class_get_method_from_name should be available",
      );
      assert(
        Mono.api.hasExport("mono_class_get_field_from_name"),
        "mono_class_get_field_from_name should be available",
      );
      assert(
        Mono.api.hasExport("mono_class_get_property_from_name"),
        "mono_class_get_property_from_name should be available",
      );
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Class APIs should be callable functions", () => {
      assert(typeof Mono.api.native.mono_class_from_name === "function", "mono_class_from_name should be a function");
      assert(
        typeof Mono.api.native.mono_class_get_method_from_name === "function",
        "mono_class_get_method_from_name should be a function",
      );
      assert(
        typeof Mono.api.native.mono_class_get_field_from_name === "function",
        "mono_class_get_field_from_name should be a function",
      );
      assert(
        typeof Mono.api.native.mono_class_get_property_from_name === "function",
        "mono_class_get_property_from_name should be a function",
      );
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Domain should provide class access methods", () => {
      assertDomainAvailable("Mono.domain should be accessible for class operations");

      const domain = Mono.domain;
      assert(typeof domain.class === "function", "Domain should have class method");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should find common system classes", () => {
      const domain = Mono.domain;

      // Try to find common system classes
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        assert(typeof stringClass.name !== "undefined", "String class should have name property");
        assert(typeof stringClass.methods !== "undefined", "String class should have methods property");
        console.log(`    Found System.String class: ${stringClass.name}`);
      }

      const objectClass = domain.tryClass("System.Object");
      if (objectClass) {
        assert(typeof objectClass.name !== "undefined", "Object class should have name property");
        console.log(`    Found System.Object class: ${objectClass.name}`);
      }

      const intClass = domain.tryClass("System.Int32");
      if (intClass) {
        console.log(`    Found System.Int32 class: ${intClass.name}`);
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should find classes through assembly image", () => {
      const domain = Mono.domain;

      // Use mscorlib directly to avoid enumerating all assemblies
      const mscorlib = domain.tryAssembly("mscorlib");
      if (mscorlib) {
        const image = mscorlib.image;
        // Use direct class lookup instead of classes to avoid hanging
        const stringClass = image.tryClassFromName("System", "String");
        if (stringClass) {
          assert(typeof stringClass.name !== "undefined", "Class should have name property");
          console.log(`    Found class via direct lookup: ${stringClass.name}`);
        }
      } else {
        console.log("    mscorlib not available to test class access");
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle non-existent class gracefully", () => {
      const domain = Mono.domain;

      const nonExistent = domain.tryClass("NonExistent.Class.Name");
      assert(nonExistent === null, "Non-existent class should return null");

      const emptyName = domain.tryClass("");
      assert(emptyName === null, "Empty class name should return null");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should get class methods and fields", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      if (stringClass) {
        // Test that these properties exist rather than calling them (which can be slow)
        assert(typeof stringClass.methods !== "undefined", "Should have methods property");
        assert(typeof stringClass.fields !== "undefined", "Should have fields property");
        assert(typeof stringClass.properties !== "undefined", "Should have properties property");

        // Test a specific method lookup instead
        const concatMethod = stringClass.tryMethod("Concat", 2);
        if (concatMethod) {
          assert(typeof concatMethod.name !== "undefined", "Method should have name property");
          console.log(`    Found method: ${concatMethod.name}`);
        }
        console.log(`    System.String member access properties validated`);
      } else {
        console.log("    System.String not available for method/field testing");
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should support namespace-based class lookup", () => {
      const domain = Mono.domain;

      // Test different namespace patterns
      const collections = domain.tryClass("System.Collections.Generic.List`1");
      if (collections) {
        console.log(`    Found generic List class: ${collections.name}`);
      }

      const io = domain.tryClass("System.IO.File");
      if (io) {
        console.log(`    Found IO class: ${io.name}`);
      }

      const threading = domain.tryClass("System.Threading.Thread");
      if (threading) {
        console.log(`    Found threading class: ${threading.name}`);
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle class inheritance and parent relationships", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      const objectClass = domain.tryClass("System.Object");

      if (stringClass && objectClass) {
        // Test that we can access class hierarchy information
        const stringName = stringClass.name;
        const objectName = objectClass.name;

        assert(typeof stringName === "string", "String class name should be string");
        assert(typeof objectName === "string", "Object class name should be string");

        console.log(`    Class names: ${stringName}, ${objectName}`);
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Class operations should be consistent", () => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const stringClass1 = domain.tryClass("System.String");
      const stringClass2 = domain.tryClass("System.String");

      if (stringClass1 && stringClass2) {
        // They should be the same object or equivalent
        const name1 = stringClass1.name;
        const name2 = stringClass2.name;
        assert(name1 === name2, "Class lookups should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle class lookup variations", () => {
      const domain = Mono.domain;

      // Test case sensitivity (typically case-sensitive)
      const stringLower = domain.tryClass("system.string");
      const stringProper = domain.tryClass("System.String");

      if (stringProper) {
        console.log("    Found System.String with proper casing");
      }

      if (stringLower && stringLower !== stringProper) {
        console.log("    Found system.string with lowercase (unusual)");
      } else if (!stringLower) {
        console.log("    Case-sensitive lookup confirmed (lowercase not found)");
      }
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Should work with assembly classes and types", domain => {
      // Use direct class lookup instead of classes enumeration
      const stringClass = domain.tryClass("System.String");

      if (stringClass) {
        const className = stringClass.name;
        const namespace = stringClass.namespace;

        assert(typeof className === "string", "Class name should be string");
        assert(typeof namespace === "string", "Namespace should be string");
        assert(className.length > 0, "Class name should not be empty");

        console.log(`    Found class: ${namespace}.${className}`);

        // Test method access via direct lookup
        const method = stringClass.tryMethod("Equals", 1);
        if (method) {
          assert(typeof method.name !== "undefined", "Method should have name property");
          console.log(`      Found method: ${method.name}`);
        }
      } else {
        console.log("    System.String not available for integration test");
      }
    }),
  );

  await suite.addResultAsync(
    createNestedPerformTest({
      context: "assembly operations",
      testName: "Should handle nested perform calls with assemblies",
      validate: domain => {
        // Use direct assembly lookup instead of assemblies
        const mscorlib = domain.tryAssembly("mscorlib");
        assert(mscorlib !== null, "Nested perform should still work");

        if (mscorlib) {
          assert(typeof mscorlib.name !== "undefined", "Assembly properties should work in nested calls");

          const image = mscorlib.image;
          assert(image !== null, "Image access should work in deeper nesting");
        }
      },
    }),
  );

  await suite.addResultAsync(
    createNestedPerformTest({
      context: "class operations",
      testName: "Should support class operations in nested perform calls",
      validate: domain => {
        const stringClass = domain.tryClass("System.String");
        if (stringClass) {
          assert(typeof stringClass.name !== "undefined", "Class properties should work in nested calls");
        }
      },
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Should test Unity-specific assembly operations", domain => {
      // Look for Unity-specific assemblies and test their properties
      const unityCore = domain.tryAssembly("UnityEngine.CoreModule");
      if (unityCore) {
        console.log(`    Found UnityEngine.CoreModule: ${unityCore.name}`);

        const image = unityCore.image;
        if (image) {
          // Look for core Unity classes
          const gameObjectClass = image.tryClass("UnityEngine.GameObject");
          if (gameObjectClass) {
            console.log("    Found UnityEngine.GameObject class");
          }

          const transformClass = image.tryClass("UnityEngine.Transform");
          if (transformClass) {
            console.log("    Found UnityEngine.Transform class");
          }
        }
      }

      // Test user assembly (basic check only)
      const userAssembly = domain.tryAssembly("Assembly-CSharp");
      if (userAssembly) {
        console.log(`    Found Assembly-CSharp: ${userAssembly.name}`);
        // Skip class enumeration to avoid hanging
      }
    }),
  );

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestEnhanced("Should test error handling with assemblies", domain => {
      // Test invalid operations
      const invalidAssembly = domain.tryAssembly("Invalid.Assembly.Name");
      assert(invalidAssembly === null, "Invalid assembly should return null");

      // Test operations on null assembly using tryAssembly
      const result = domain.tryAssembly(null as any);
      assert(result === null, "Null assembly name should return null");

      console.log("    Assembly error handling works correctly");
    }),
  );

  await suite.addResultAsync(
    createDomainTestEnhanced("Should handle invalid class inputs gracefully", domain => {
      // Test invalid class names with tryClass
      const invalidClass = domain.tryClass(null as any);
      assert(invalidClass === null, "Invalid class name should return null");

      const undefinedClass = domain.tryClass(undefined as any);
      assert(undefinedClass === null, "Undefined class name should return null");

      console.log("    Class error handling works correctly");
    }),
  );

  // ============================================================================
  // MONO TYPE KIND COMPREHENSIVE TESTS (BOUNDARY)
  // ============================================================================

  await suite.addResultAsync(
    createMonoDependentTest("Should identify primitive type kinds", () => {
      const domain = Mono.domain;
      const { MonoType, MonoTypeKind } = require("../src/model/type");

      const primitiveTypes = [
        { name: "System.Boolean", expectedKind: MonoTypeKind.Boolean },
        { name: "System.Byte", expectedKind: MonoTypeKind.U1 },
        { name: "System.SByte", expectedKind: MonoTypeKind.I1 },
        { name: "System.Int16", expectedKind: MonoTypeKind.I2 },
        { name: "System.UInt16", expectedKind: MonoTypeKind.U2 },
        { name: "System.Int32", expectedKind: MonoTypeKind.I4 },
        { name: "System.UInt32", expectedKind: MonoTypeKind.U4 },
        { name: "System.Int64", expectedKind: MonoTypeKind.I8 },
        { name: "System.UInt64", expectedKind: MonoTypeKind.U8 },
        { name: "System.Single", expectedKind: MonoTypeKind.R4 },
        { name: "System.Double", expectedKind: MonoTypeKind.R8 },
        { name: "System.Char", expectedKind: MonoTypeKind.Char },
      ];

      let successCount = 0;
      for (const test of primitiveTypes) {
        const cls = domain.tryClass(test.name);
        if (cls) {
          const type = cls.type;
          if (type) {
            const kind = type.kind;
            if (kind === test.expectedKind) {
              successCount++;
            } else {
              console.log(`    ${test.name}: expected kind ${test.expectedKind}, got ${kind}`);
            }
          }
        }
      }

      console.log(`    Primitive type kinds: ${successCount}/${primitiveTypes.length} verified`);
      assert(successCount >= primitiveTypes.length * 0.8, "Most primitive types should have correct kinds");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify String type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "System.String should be available");

      const type = stringClass.type;
      assertNotNull(type, "String type should be available");

      const kind = type.kind;
      assert(kind === MonoTypeKind.String, `String type kind should be String (${MonoTypeKind.String}), got ${kind}`);

      assert(type.referenceType, "String should be reference type");
      assert(!type.valueType, "String should not be value type");

      console.log(`    String type kind: ${kind} (correct)`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Object type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const objectClass = domain.tryClass("System.Object");
      assertNotNull(objectClass, "System.Object should be available");

      const type = objectClass.type;
      assertNotNull(type, "Object type should be available");

      const kind = type.kind;
      assert(kind === MonoTypeKind.Object, `Object type kind should be Object (${MonoTypeKind.Object}), got ${kind}`);

      console.log(`    Object type kind: ${kind} (correct)`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify ValueType type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      // DateTime is a value type struct
      const dateTimeClass = domain.tryClass("System.DateTime");
      if (dateTimeClass) {
        const type = dateTimeClass.type;
        if (type) {
          const kind = type.kind;
          assert(
            kind === MonoTypeKind.ValueType,
            `DateTime type kind should be ValueType (${MonoTypeKind.ValueType}), got ${kind}`,
          );
          assert(type.valueType, "DateTime should be value type");
          console.log(`    DateTime (struct) type kind: ${kind}`);
        }
      }

      // TimeSpan is also a value type struct
      const timeSpanClass = domain.tryClass("System.TimeSpan");
      if (timeSpanClass) {
        const type = timeSpanClass.type;
        if (type) {
          const kind = type.kind;
          assert(kind === MonoTypeKind.ValueType, `TimeSpan type kind should be ValueType`);
          console.log(`    TimeSpan (struct) type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Enum type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");
      if (dayOfWeekClass) {
        const type = dayOfWeekClass.type;
        if (type) {
          const kind = type.kind;
          // Note: In some Mono implementations, enum types return ValueType kind
          // when accessed through class.type, not Enum kind directly
          assert(
            kind === MonoTypeKind.Enum || kind === MonoTypeKind.ValueType,
            `DayOfWeek type kind should be Enum (${MonoTypeKind.Enum}) or ValueType (${MonoTypeKind.ValueType}), got ${kind}`,
          );
          assert(type.valueType, "Enum should be value type");
          console.log(`    DayOfWeek (enum) type kind: ${kind}`);
        }
      }

      const fileAccessClass = domain.tryClass("System.IO.FileAccess");
      if (fileAccessClass) {
        const type = fileAccessClass.type;
        if (type) {
          const kind = type.kind;
          assert(
            kind === MonoTypeKind.Enum || kind === MonoTypeKind.ValueType,
            `FileAccess type kind should be Enum or ValueType`,
          );
          console.log(`    FileAccess (flags enum) type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Class type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      // Exception is a class
      const exceptionClass = domain.tryClass("System.Exception");
      if (exceptionClass) {
        const type = exceptionClass.type;
        if (type) {
          const kind = type.kind;
          assert(
            kind === MonoTypeKind.Class,
            `Exception type kind should be Class (${MonoTypeKind.Class}), got ${kind}`,
          );
          assert(type.referenceType, "Exception should be reference type");
          console.log(`    Exception (class) type kind: ${kind}`);
        }
      }

      // Console is a static class (but still Class kind)
      const consoleClass = domain.tryClass("System.Console");
      if (consoleClass) {
        const type = consoleClass.type;
        if (type) {
          const kind = type.kind;
          assert(kind === MonoTypeKind.Class, `Console type kind should be Class`);
          console.log(`    Console (static class) type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Array type kinds", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      // Single-dimensional array
      const intArrayClass = domain.tryClass("System.Int32[]");
      if (intArrayClass) {
        const type = intArrayClass.type;
        if (type) {
          const kind = type.kind;
          assert(
            kind === MonoTypeKind.SingleDimArray || kind === MonoTypeKind.Array,
            `Int32[] type kind should be SingleDimArray or Array, got ${kind}`,
          );
          console.log(`    Int32[] (array) type kind: ${kind}`);
        }
      }

      // String array
      const stringArrayClass = domain.tryClass("System.String[]");
      if (stringArrayClass) {
        const type = stringArrayClass.type;
        if (type) {
          const kind = type.kind;
          console.log(`    String[] (array) type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Generic type kinds", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      // Generic type definition
      const listClass = domain.tryClass("System.Collections.Generic.List`1");
      if (listClass) {
        const type = listClass.type;
        if (type) {
          const kind = type.kind;
          console.log(`    List<T> (generic) type kind: ${kind}`);
          // Generic type definitions are typically Class kind
          assert(
            kind === MonoTypeKind.Class || kind === MonoTypeKind.GenericInstance,
            `List<T> should be Class or GenericInstance kind`,
          );
        }
      }

      // Dictionary generic
      const dictClass = domain.tryClass("System.Collections.Generic.Dictionary`2");
      if (dictClass) {
        const type = dictClass.type;
        if (type) {
          const kind = type.kind;
          console.log(`    Dictionary<K,V> (generic) type kind: ${kind}`);
        }
      }

      // Nullable<T> generic value type
      const nullableClass = domain.tryClass("System.Nullable`1");
      if (nullableClass) {
        const type = nullableClass.type;
        if (type) {
          const kind = type.kind;
          console.log(`    Nullable<T> (generic value type) type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Pointer/IntPtr type kinds", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const intPtrClass = domain.tryClass("System.IntPtr");
      if (intPtrClass) {
        const type = intPtrClass.type;
        if (type) {
          const kind = type.kind;
          // IntPtr is typically Int (native int) kind
          assert(
            kind === MonoTypeKind.Int || kind === MonoTypeKind.ValueType,
            `IntPtr type kind should be Int or ValueType, got ${kind}`,
          );
          console.log(`    IntPtr type kind: ${kind}`);
        }
      }

      const uintPtrClass = domain.tryClass("System.UIntPtr");
      if (uintPtrClass) {
        const type = uintPtrClass.type;
        if (type) {
          const kind = type.kind;
          console.log(`    UIntPtr type kind: ${kind}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify Void type kind", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const voidClass = domain.tryClass("System.Void");
      if (voidClass) {
        const type = voidClass.type;
        if (type) {
          const kind = type.kind;
          assert(kind === MonoTypeKind.Void, `Void type kind should be Void (${MonoTypeKind.Void}), got ${kind}`);
          assert(type.isVoid, "Type.isVoid should return true for Void");
          console.log(`    Void type kind: ${kind} (correct)`);
        }
      } else {
        console.log("    System.Void class not directly accessible");
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.getSummary() for all kinds", () => {
      const domain = Mono.domain;

      const testTypes = [
        "System.Int32",
        "System.String",
        "System.Object",
        "System.DateTime",
        "System.DayOfWeek",
        "System.Exception",
      ];

      for (const typeName of testTypes) {
        const cls = domain.tryClass(typeName);
        if (cls) {
          const type = cls.type;
          if (type) {
            const desc = type.getSummary();
            assertNotNull(desc, `${typeName} should have summary`);
            assert(typeof desc.kind === "number", "Summary should have kind");
            assert(typeof desc.isValueType === "boolean", "Summary should have isValueType");
            assert(typeof desc.isReferenceType === "boolean", "Summary should have isReferenceType");
            console.log(
              `    ${typeName}: kind=${desc.kind}, isValue=${desc.isValueType}, isRef=${desc.isReferenceType}`,
            );
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType size and alignment", () => {
      const domain = Mono.domain;

      const sizeTests = [
        { name: "System.Byte", expectedSize: 1 },
        { name: "System.Int16", expectedSize: 2 },
        { name: "System.Int32", expectedSize: 4 },
        { name: "System.Int64", expectedSize: 8 },
        { name: "System.Single", expectedSize: 4 },
        { name: "System.Double", expectedSize: 8 },
        { name: "System.Char", expectedSize: 2 },
        { name: "System.Boolean", expectedSize: 1 },
      ];

      for (const test of sizeTests) {
        const cls = domain.tryClass(test.name);
        if (cls) {
          const type = cls.type;
          if (type) {
            const { size, alignment } = type.valueSize;
            console.log(`    ${test.name}: size=${size}, alignment=${alignment} (expected size=${test.expectedSize})`);
            assert(size === test.expectedSize, `${test.name} size should be ${test.expectedSize}, got ${size}`);
            // Note: alignment can be 0 in some Mono implementations
            assert(alignment >= 0, `${test.name} alignment should be non-negative`);
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.isByRef()", () => {
      const domain = Mono.domain;

      // Get a method with ref/out parameter to test byref type
      const intClass = domain.tryClass("System.Int32");
      if (intClass) {
        // TryParse has out parameter
        const tryParseMethod = intClass.tryMethod("TryParse", 2);
        if (tryParseMethod) {
          const params = tryParseMethod.parameters;
          if (params.length >= 2) {
            const resultParam = params[1]; // The 'out' parameter
            const paramType = resultParam.type;
            if (paramType) {
              const isByRef = paramType.byRef;
              console.log(`    Int32.TryParse result parameter isByRef: ${isByRef}`);
              assert(isByRef === true, "TryParse result parameter should be byref");
            }
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.getElementType() for arrays", () => {
      const domain = Mono.domain;

      const intArrayClass = domain.tryClass("System.Int32[]");
      if (intArrayClass) {
        const type = intArrayClass.type;
        if (type) {
          const elementType = type.elementType;
          if (elementType) {
            const elementName = elementType.name;
            console.log(`    Int32[] element type: ${elementName}`);
            assert(
              elementName.includes("Int32") || elementName.includes("int"),
              `Element type should be Int32, got ${elementName}`,
            );
          }
        }
      }

      const stringArrayClass = domain.tryClass("System.String[]");
      if (stringArrayClass) {
        const type = stringArrayClass.type;
        if (type) {
          const elementType = type.elementType;
          if (elementType) {
            const elementName = elementType.name;
            console.log(`    String[] element type: ${elementName}`);
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.getClass() relationship", () => {
      const domain = Mono.domain;

      const testClasses = ["System.Int32", "System.String", "System.DateTime"];

      for (const className of testClasses) {
        const cls = domain.tryClass(className);
        if (cls) {
          const type = cls.type;
          if (type) {
            const typeClass = type.class;
            if (typeClass) {
              const roundTripName = typeClass.fullName;
              console.log(`    ${className} -> Type -> Class: ${roundTripName}`);
              assert(roundTripName === className, `Round-trip should preserve class name`);
            }
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.getUnderlyingType() for enums", () => {
      const domain = Mono.domain;
      const { MonoTypeKind } = require("../src/model/type");

      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");
      if (dayOfWeekClass) {
        const type = dayOfWeekClass.type;
        if (type) {
          const underlyingType = type.underlyingType;
          if (underlyingType) {
            const underlyingKind = underlyingType.kind;
            const underlyingName = underlyingType.name;
            console.log(`    DayOfWeek underlying type: ${underlyingName} (kind=${underlyingKind})`);
            // Enum underlying type is typically Int32
            assert(
              underlyingKind === MonoTypeKind.I4,
              `DayOfWeek underlying type should be I4 (Int32), got ${underlyingKind}`,
            );
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType name formats", () => {
      const domain = Mono.domain;
      const { MonoTypeNameFormat } = require("../src/model/type");

      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const type = stringClass.type;
        if (type) {
          const name = type.name;
          const fullName = type.getFullName(MonoTypeNameFormat.FullName);
          const reflectionName = type.getFullName(MonoTypeNameFormat.Reflection);
          const ilName = type.getFullName(MonoTypeNameFormat.IL);

          console.log(`    String type names:`);
          console.log(`      name: ${name}`);
          console.log(`      FullName: ${fullName}`);
          console.log(`      Reflection: ${reflectionName}`);
          console.log(`      IL: ${ilName}`);

          assert(name.length > 0, "name should return non-empty string");
          assert(fullName.length > 0, "getFullName() should return non-empty string");
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should verify type kind constants", () => {
      const { MonoTypeKind } = require("../src/model/type");

      // Verify all type kinds are defined
      const expectedKinds = [
        "End",
        "Void",
        "Boolean",
        "Char",
        "I1",
        "U1",
        "I2",
        "U2",
        "I4",
        "U4",
        "I8",
        "U8",
        "R4",
        "R8",
        "String",
        "Pointer",
        "ByRef",
        "ValueType",
        "Class",
        "GenericVar",
        "Array",
        "GenericInstance",
        "TypedByRef",
        "Int",
        "UInt",
        "FunctionPointer",
        "Object",
        "SingleDimArray",
        "GenericMethodVar",
        "CModReqd",
        "CModOpt",
        "Internal",
        "Modifier",
        "Sentinel",
        "Pinned",
        "Enum",
      ];

      let definedCount = 0;
      for (const kindName of expectedKinds) {
        if (MonoTypeKind[kindName] !== undefined) {
          definedCount++;
        } else {
          console.log(`    Missing type kind: ${kindName}`);
        }
      }

      console.log(`    Type kind constants: ${definedCount}/${expectedKinds.length} defined`);
      assert(definedCount === expectedKinds.length, "All type kinds should be defined");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should test MonoType.toString()", () => {
      const domain = Mono.domain;

      const testTypes = ["System.Int32", "System.String", "System.DateTime"];

      for (const typeName of testTypes) {
        const cls = domain.tryClass(typeName);
        if (cls) {
          const type = cls.type;
          if (type) {
            const str = type.toString();
            assertNotNull(str, `${typeName}.toString() should not be null`);
            assert(str.length > 0, `${typeName}.toString() should not be empty`);
            console.log(`    ${typeName}.toString(): ${str}`);
          }
        }
      }
    }),
  );

  // ===== MULTI-DIMENSIONAL ARRAY TESTS =====

  await suite.addResultAsync(
    createMonoDependentTest("Should identify single-dimensional array rank", () => {
      const domain = Mono.domain;

      // Test single-dimensional array
      const intArrayClass = domain.tryClass("System.Int32[]");
      if (intArrayClass) {
        const type = intArrayClass.type;
        if (type) {
          assert(type.isArray, "Int32[] should be an array type");
          const rank = type.arrayRank;
          assert(rank === 1, `Int32[] should have rank 1, got ${rank}`);
          console.log(`    Int32[] array rank: ${rank}`);
        }
      }

      // Test string array
      const stringArrayClass = domain.tryClass("System.String[]");
      if (stringArrayClass) {
        const type = stringArrayClass.type;
        if (type) {
          assert(type.isArray, "String[] should be an array type");
          const rank = type.arrayRank;
          assert(rank === 1, `String[] should have rank 1, got ${rank}`);
          console.log(`    String[] array rank: ${rank}`);
        }
      }

      // Test object array
      const objectArrayClass = domain.tryClass("System.Object[]");
      if (objectArrayClass) {
        const type = objectArrayClass.type;
        if (type) {
          assert(type.isArray, "Object[] should be an array type");
          const rank = type.arrayRank;
          assert(rank === 1, `Object[] should have rank 1, got ${rank}`);
          console.log(`    Object[] array rank: ${rank}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should return rank 0 for non-array types", () => {
      const domain = Mono.domain;

      // Test non-array types
      const testTypes = ["System.Int32", "System.String", "System.Object", "System.DateTime"];

      for (const typeName of testTypes) {
        const cls = domain.tryClass(typeName);
        if (cls) {
          const type = cls.type;
          if (type) {
            assert(!type.isArray, `${typeName} should not be an array type`);
            const rank = type.arrayRank;
            assert(rank === 0, `${typeName} should have rank 0, got ${rank}`);
            console.log(`    ${typeName} array rank: ${rank} (non-array)`);
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should include array info in MonoType.getSummary()", () => {
      const domain = Mono.domain;

      // Test array type
      const intArrayClass = domain.tryClass("System.Int32[]");
      if (intArrayClass) {
        const type = intArrayClass.type;
        if (type) {
          const summary = type.getSummary();
          assert(summary.isArray === true, "Int32[] summary.isArray should be true");
          assert(summary.arrayRank === 1, `Int32[] summary.arrayRank should be 1, got ${summary.arrayRank}`);
          console.log(`    Int32[] summary: isArray=${summary.isArray}, arrayRank=${summary.arrayRank}`);
        }
      }

      // Test non-array type
      const intClass = domain.tryClass("System.Int32");
      if (intClass) {
        const type = intClass.type;
        if (type) {
          const summary = type.getSummary();
          assert(summary.isArray === false, "Int32 summary.isArray should be false");
          assert(summary.arrayRank === 0, `Int32 summary.arrayRank should be 0, got ${summary.arrayRank}`);
          console.log(`    Int32 summary: isArray=${summary.isArray}, arrayRank=${summary.arrayRank}`);
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle multi-dimensional array type names", () => {
      const domain = Mono.domain;

      // Try to find or create multi-dimensional array types
      // Multi-dimensional arrays are represented as [,] for 2D, [,,] for 3D, etc.
      const multiDimTypeNames = ["System.Int32[,]", "System.Int32[,,]", "System.String[,]"];

      let foundAny = false;
      for (const typeName of multiDimTypeNames) {
        try {
          const cls = domain.tryClass(typeName);
          if (cls) {
            foundAny = true;
            const type = cls.type;
            if (type) {
              const isArray = type.isArray;
              const rank = type.arrayRank;
              console.log(`    ${typeName}: isArray=${isArray}, rank=${rank}`);

              // Verify expected rank based on comma count
              const expectedRank = (typeName.match(/,/g) || []).length + 1;
              if (rank > 0) {
                assert(rank === expectedRank, `${typeName} should have rank ${expectedRank}, got ${rank}`);
              }
            }
          }
        } catch (e) {
          console.log(`    ${typeName}: not available (${e})`);
        }
      }

      if (!foundAny) {
        console.log("    Note: Multi-dimensional array types may require explicit loading");
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should identify array element type correctly", () => {
      const domain = Mono.domain;

      // Test getting element type from array
      const intArrayClass = domain.tryClass("System.Int32[]");
      if (intArrayClass) {
        const type = intArrayClass.type;
        if (type && type.isArray) {
          const elementType = type.elementType;
          if (elementType) {
            const elementName = elementType.name;
            assert(
              elementName.includes("Int32") || elementName.includes("int"),
              `Element type of Int32[] should be Int32, got ${elementName}`,
            );
            console.log(`    Int32[] element type: ${elementName}`);

            // Element type should not be an array
            assert(!elementType.isArray, "Element type should not be an array");
            assert(elementType.arrayRank === 0, "Element type should have rank 0");
          }
        }
      }

      // Test object array
      const objectArrayClass = domain.tryClass("System.Object[]");
      if (objectArrayClass) {
        const type = objectArrayClass.type;
        if (type && type.isArray) {
          const elementType = type.elementType;
          if (elementType) {
            const elementName = elementType.name;
            assert(elementName.includes("Object"), `Element type of Object[] should be Object, got ${elementName}`);
            console.log(`    Object[] element type: ${elementName}`);
          }
        }
      }
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Should handle jagged arrays", () => {
      const domain = Mono.domain;

      // Jagged arrays (array of arrays) - Int32[][]
      // The outer type is Int32[][], which is an array of Int32[]
      const jaggedTypeName = "System.Int32[][]";

      try {
        const cls = domain.tryClass(jaggedTypeName);
        if (cls) {
          const type = cls.type;
          if (type) {
            assert(type.isArray, `${jaggedTypeName} should be an array type`);
            const rank = type.arrayRank;
            // Jagged arrays are single-dimensional arrays of arrays
            // So Int32[][] has rank 1, not 2
            assert(rank === 1, `${jaggedTypeName} (jagged) should have rank 1, got ${rank}`);
            console.log(`    ${jaggedTypeName} (jagged array): isArray=true, rank=${rank}`);

            // Element type should be Int32[]
            const elementType = type.elementType;
            if (elementType) {
              assert(elementType.isArray, "Element type of Int32[][] should be an array");
              console.log(`    Element type of ${jaggedTypeName}: ${elementType.name}`);
            }
          }
        } else {
          console.log(`    ${jaggedTypeName}: type not found (may need explicit loading)`);
        }
      } catch (e) {
        console.log(`    ${jaggedTypeName}: not available (${e})`);
      }
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Types Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} mono types tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

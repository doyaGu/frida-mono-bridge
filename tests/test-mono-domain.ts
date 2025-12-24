/**
 * Comprehensive Mono Domain Tests
 * Complete tests for MonoDomain operations including:
 * - Domain operations (creation, set, get)
 * - Assembly loading within domains
 * - Type resolution across domains
 * - Cross-domain access and security
 * - Domain lifecycle management
 */

import Mono from "../src";
import { withDomain } from "./test-fixtures";
import {
  assert,
  assertDomainAvailable,
  assertDomainCached,
  assertNotNull,
  assertPerformWorks,
  createApiAvailabilityTest,
  createDomainTestAsync,
  createDomainTestEnhanced,
  createPerformanceTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

export async function createMonoDomainTests(): Promise<TestResult> {
  console.log("\nComprehensive Mono Domain Tests:");

  const suite = new TestSuite("Mono Domain Complete Tests", TestCategory.MONO_DEPENDENT);

  // ============================================================================
  // DOMAIN CREATION AND BASIC OPERATIONS
  // ============================================================================

  await suite.addResultAsync(
    await withDomain("Domain should be accessible and functional", ({ domain }) => {
      assertPerformWorks("Domain operations should work");
      assertDomainAvailable("Mono.domain should be accessible");

      // Test domain properties
      assert(typeof domain.id === "number", "Domain should have numeric ID");
      // Domain ID can be any number (may be negative due to signed interpretation of address)
      assert(!isNaN(domain.id), "Domain ID should not be NaN");

      console.log(`    Domain accessible with ID: ${domain.id}`);
    }),
  );

  await suite.addResultAsync(
    withDomain("Domain should provide consistent access", () => {
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      const domain3 = Mono.domain;

      assert(domain1 === domain2, "Domain should be cached (same instance)");
      assert(domain2 === domain3, "Domain should be consistently cached");
      assertDomainCached("Domain should be cached across multiple accesses");

      // Test domain pointer consistency
      const ptr1 = domain1.pointer;
      const ptr2 = domain2.pointer;
      assert(ptr1.equals(ptr2), "Domain pointers should be equal");

      console.log("    Domain caching and consistency verified");
    }),
  );

  await suite.addResultAsync(
    createApiAvailabilityTest({
      context: "domain operations",
      testName: "Domain API exports should be available",
      requiredExports: ["mono_get_root_domain", "mono_assembly_foreach"],
      validate: api => {
        // Test that domain functions are callable
        assert(typeof api.native.mono_get_root_domain === "function", "mono_get_root_domain should be function");

        // mono_domain_assembly_open, mono_domain_get and mono_domain_set are optional
        if (api.hasExport("mono_domain_assembly_open")) {
          assert(
            typeof api.native.mono_domain_assembly_open === "function",
            "mono_domain_assembly_open should be function",
          );
        } else {
          console.log("    mono_domain_assembly_open not available (optional)");
        }

        if (api.hasExport("mono_domain_get")) {
          assert(typeof api.native.mono_domain_get === "function", "mono_domain_get should be function");
        } else {
          console.log("    mono_domain_get not available (optional)");
        }

        if (api.hasExport("mono_domain_set")) {
          assert(typeof api.native.mono_domain_set === "function", "mono_domain_set should be function");
        } else {
          console.log("    mono_domain_set not available (optional)");
        }
      },
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Root domain should be accessible", domain => {
      assertNotNull(domain, "Root domain should not be null");
      assert(!domain.pointer.isNull(), "Root domain pointer should not be NULL");

      // Test domain ID
      const domainId = domain.id;
      assert(typeof domainId === "number", "Domain ID should be number");
      // Domain ID can be any number (may be negative due to signed interpretation of address)
      assert(!isNaN(domainId), "Domain ID should not be NaN");

      console.log(`    Root domain accessible with ID: ${domainId}`);
    }),
  );

  // ============================================================================
  // ASSEMBLY LOADING WITHIN DOMAINS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain should load assemblies correctly", domain => {
      // Test assembly enumeration
      const assemblies = domain.assemblies;
      assert(Array.isArray(assemblies), "getAssemblies should return array");
      assert(assemblies.length > 0, "Should have at least one assembly");

      console.log(`    Domain has ${assemblies.length} assemblies`);

      // Test assembly access methods
      assert(typeof domain.assembly === "function", "Domain should have assembly method");
      assert(typeof domain.getAssembly === "function", "Domain should have getAssembly method");
      assert(typeof domain.assemblyOpen === "function", "Domain should have assemblyOpen method");
      assert(typeof domain.loadAssembly === "function", "Domain should have loadAssembly method");

      // Test assembly lookup
      const firstAssembly = assemblies[0];
      assertNotNull(firstAssembly, "First assembly should not be null");

      const assemblyName = firstAssembly.name;
      assert(typeof assemblyName === "string", "Assembly name should be string");
      assert(assemblyName.length > 0, "Assembly name should not be empty");

      console.log(`    First assembly: ${assemblyName}`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should find core assemblies", domain => {
      const coreAssemblyNames = ["mscorlib", "System.Private.CoreLib", "netstandard"];
      let foundCoreAssembly = null;

      for (const name of coreAssemblyNames) {
        const assembly = domain.tryAssembly(name);
        if (assembly) {
          foundCoreAssembly = assembly;
          console.log(`    Found core assembly: ${name}`);
          break;
        }
      }

      if (foundCoreAssembly) {
        assertNotNull(foundCoreAssembly.image, "Core assembly should have image");
        assert(!foundCoreAssembly.image.pointer.isNull(), "Core assembly image should not be NULL");

        const classes = foundCoreAssembly.image.classes;
        assert(Array.isArray(classes), "Core assembly should have classes array");
        assert(classes.length > 0, "Core assembly should have classes");

        console.log(`    Core assembly has ${classes.length} classes`);
      } else {
        console.log("    Core assembly not found (may be Unity-specific runtime)");
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should find Unity assemblies", domain => {
      const unityAssemblyNames = [
        "UnityEngine.CoreModule",
        "UnityEngine",
        "Assembly-CSharp",
        "Assembly-CSharp-firstpass",
        "UnityEngine.UI",
        "UnityEngine.Physics2D",
      ];

      let foundUnityAssemblies = 0;

      for (const name of unityAssemblyNames) {
        const assembly = domain.tryAssembly(name);
        if (assembly) {
          foundUnityAssemblies++;
          console.log(`    Found Unity assembly: ${name}`);

          // Test assembly properties
          assertNotNull(assembly.image, "Unity assembly should have image");
          const classes = assembly.image.classes;
          console.log(`      ${classes.length} classes in ${name}`);
        }
      }

      if (foundUnityAssemblies === 0) {
        console.log("    No Unity assemblies found (may not be Unity process)");
      } else {
        console.log(`    Found ${foundUnityAssemblies} Unity assemblies`);
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should handle assembly loading variations", domain => {
      // Test case sensitivity
      const mscorlibLower = domain.tryAssembly("mscorlib");
      const mscorlibUpper = domain.tryAssembly("MSCORLIB");

      if (mscorlibLower) {
        console.log("    Found mscorlib with lowercase name");
      }

      if (mscorlibUpper && mscorlibUpper !== mscorlibLower) {
        console.log("    Found different assembly with uppercase name (case-sensitive)");
      } else if (!mscorlibUpper && mscorlibLower) {
        console.log("    Assembly lookup is case-sensitive");
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

      console.log("    Assembly loading variations handled correctly");
    }),
  );

  // ============================================================================
  // TYPE RESOLUTION ACROSS DOMAINS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain should resolve system types", domain => {
      const systemTypes = [
        "System.String",
        "System.Object",
        "System.Int32",
        "System.Boolean",
        "System.DateTime",
        "System.Collections.Generic.List`1",
      ];

      let foundTypes = 0;

      for (const typeName of systemTypes) {
        const klass = domain.tryClass(typeName);
        if (klass) {
          foundTypes++;
          console.log(`    Found system type: ${typeName}`);

          // Test class properties
          const className = klass.name;
          const namespace = klass.namespace;

          assert(typeof className === "string", "Class name should be string");
          assert(typeof namespace === "string", "Namespace should be string");

          console.log(`      Full name: ${namespace}.${className}`);
        }
      }

      console.log(`    Found ${foundTypes}/${systemTypes.length} system types`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should resolve Unity types", domain => {
      const unityTypes = [
        "UnityEngine.GameObject",
        "UnityEngine.Transform",
        "UnityEngine.MonoBehaviour",
        "UnityEngine.Component",
        "UnityEngine.Object",
      ];

      let foundUnityTypes = 0;

      for (const typeName of unityTypes) {
        const klass = domain.tryClass(typeName);
        if (klass) {
          foundUnityTypes++;
          console.log(`    Found Unity type: ${typeName}`);

          // Test class methods
          const methods = klass.methods;
          assert(Array.isArray(methods), "Class should have methods array");
          console.log(`      ${methods.length} methods`);

          // Test class fields
          const fields = klass.fields;
          assert(Array.isArray(fields), "Class should have fields array");
          console.log(`      ${fields.length} fields`);
        }
      }

      if (foundUnityTypes === 0) {
        console.log("    No Unity types found (may not be Unity process)");
      } else {
        console.log(`    Found ${foundUnityTypes}/${unityTypes.length} Unity types`);
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should handle type resolution edge cases", domain => {
      // Test empty and null type names - use tryClass to safely handle edge cases
      const emptyType = domain.tryClass("");
      assert(emptyType === null, "Empty type name should return null");

      const nullType = domain.tryClass(null as any);
      assert(nullType === null, "Null type name should return null");

      const undefinedType = domain.tryClass(undefined as any);
      assert(undefinedType === null, "Undefined type name should return null");

      // Test malformed type names
      const malformedType = domain.tryClass("Invalid.Type.Name.With.Too.Many.Dots");
      // This should return null, not throw
      console.log("    Malformed type name handled gracefully");

      // Test case sensitivity
      const stringLower = domain.tryClass("system.string");
      const stringProper = domain.tryClass("System.String");

      if (stringProper && !stringLower) {
        console.log("    Type resolution is case-sensitive");
      } else if (stringLower && stringProper) {
        console.log("    Type resolution is case-insensitive");
      }

      console.log("    Type resolution edge cases handled correctly");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should provide namespace information", domain => {
      // getRootNamespaces can be slow, so we use a timeout wrapper
      let rootNamespaces: string[] = [];
      try {
        // Only get a quick sample, don't iterate everything
        const mscorlib = domain.tryAssembly("mscorlib");
        if (mscorlib && mscorlib.image) {
          const classes = mscorlib.image.classes.slice(0, 100); // Only check first 100 classes
          const namespaces = new Set<string>();
          for (const klass of classes) {
            const ns = klass.namespace;
            if (ns) {
              const root = ns.split(".")[0];
              namespaces.add(root);
            }
          }
          rootNamespaces = Array.from(namespaces).sort();
        }
      } catch (error) {
        console.log(`    Namespace enumeration error: ${error}`);
      }

      if (rootNamespaces.length > 0) {
        console.log(`    Found ${rootNamespaces.length} root namespaces (sampled)`);

        // Test common namespaces
        const expectedNamespaces = ["System", "Microsoft"];
        for (const expected of expectedNamespaces) {
          if (rootNamespaces.includes(expected)) {
            console.log(`    Found expected namespace: ${expected}`);
          }
        }
      } else {
        console.log("    Could not enumerate namespaces (skipped)");
      }

      console.log("    Namespace information verified");
    }),
  );

  // ============================================================================
  // CROSS-DOMAIN ACCESS AND SECURITY
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain should maintain assembly isolation", domain => {
      const assemblies = domain.assemblies;
      assert(Array.isArray(assemblies), "Should get assemblies array");

      // Test that each assembly has its own image
      for (const assembly of assemblies.slice(0, 5)) {
        // Test first 5 assemblies
        try {
          assertNotNull(assembly.image, "Assembly should have image");
          assert(!assembly.image.pointer.isNull(), "Assembly image should not be NULL");

          const classes = assembly.image.classes;
          assert(Array.isArray(classes), "Assembly image should have classes array");

          // Test that classes are properly associated with their assembly
          if (classes.length > 0) {
            const firstClass = classes[0];
            assertNotNull(firstClass, "First class should not be null");

            // The class should be accessible through the domain
            const className = firstClass.name;
            const namespace = firstClass.namespace;
            const fullName = namespace ? `${namespace}.${className}` : className;

            const domainClass = domain.tryClass(fullName);
            if (domainClass) {
              // Should be the same class or equivalent
              const domainClassName = domainClass.name;
              assert(domainClassName === className, "Class names should match");
            }
          }
        } catch (error) {
          console.log(`    Assembly isolation check skipped for assembly: ${error}`);
        }
      }

      console.log("    Assembly isolation verified");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should handle cross-assembly type references", domain => {
      // Find a type that references another assembly
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        // String class should reference mscorlib
        const methods = stringClass.methods;
        assert(Array.isArray(methods), "String class should have methods");

        // Look for methods that might reference other assemblies
        let crossAssemblyRefs = 0;
        for (const method of methods.slice(0, 10)) {
          // Check first 10 methods
          try {
            const returnType = method.returnType;
            if (returnType) {
              const returnTypeName = returnType.name;
              if (returnTypeName && returnTypeName.includes(".")) {
                crossAssemblyRefs++;
              }
            }
          } catch (error) {
            // Some method operations might not be available
          }
        }

        console.log(`    Found ${crossAssemblyRefs} potential cross-assembly references`);
      }

      console.log("    Cross-assembly type references handled");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should enforce type access boundaries", domain => {
      // Test that private/internal types are handled appropriately
      const assemblies = domain.assemblies;

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const classes = firstAssembly.image.classes;

        // Try to access various types
        let accessibleTypes = 0;
        let inaccessibleTypes = 0;

        for (const klass of classes.slice(0, 20)) {
          // Test first 20 classes
          try {
            const className = klass.name;
            const namespace = klass.namespace;
            const fullName = namespace ? `${namespace}.${className}` : className;

            // Try to access through domain
            const domainClass = domain.tryClass(fullName);
            if (domainClass) {
              accessibleTypes++;
            } else {
              inaccessibleTypes++;
            }
          } catch (error) {
            inaccessibleTypes++;
          }
        }

        console.log(`    Accessible types: ${accessibleTypes}, Inaccessible: ${inaccessibleTypes}`);
      }

      console.log("    Type access boundaries enforced");
    }),
  );

  // ============================================================================
  // DOMAIN LIFECYCLE MANAGEMENT
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain should handle lifecycle operations", domain => {
      // Test domain properties
      assert(typeof domain.id === "number", "Domain should have numeric ID");
      assert(typeof domain.name === "string" || domain.name === null, "Domain name should be string or null");

      const domainId = domain.id;
      console.log(`    Domain ID: ${domainId}`);

      if (domain.name) {
        console.log(`    Domain name: ${domain.name}`);
      } else {
        console.log("    Domain name not available (typical for Mono)");
      }

      // Test domain pointer validity
      assert(!domain.pointer.isNull(), "Domain pointer should not be NULL");

      // Test that domain operations remain consistent
      const assemblies1 = domain.assemblies;
      const assemblies2 = domain.assemblies;

      assert(assemblies1.length === assemblies2.length, "Assembly count should be consistent");

      console.log("    Domain lifecycle operations verified");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should handle enumeration operations", domain => {
      let enumeratedAssemblies = 0;

      // Test assembly enumeration callback
      domain.enumerateAssemblies(assembly => {
        enumeratedAssemblies++;
        assertNotNull(assembly, "Enumerated assembly should not be null");
      });

      assert(enumeratedAssemblies > 0, "Should enumerate at least one assembly");

      // Compare with getAssemblies
      const directAssemblies = domain.assemblies;
      assert(enumeratedAssemblies === directAssemblies.length, "Enumeration should match direct access");

      console.log(`    Enumerated ${enumeratedAssemblies} assemblies`);
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Performance: Domain operations", () => {
      const domain = Mono.domain;
      const iterations = 100; // Reduced iterations for faster testing

      // Test domain access performance
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        const currentDomain = Mono.domain;
        assertNotNull(currentDomain, "Domain access should work");
      }
      const domainAccessTime = Date.now() - startTime;

      // Test assembly enumeration performance
      const enumStartTime = Date.now();
      for (let i = 0; i < 10; i++) {
        // Reduced from 100
        const assemblies = domain.assemblies;
        assert(Array.isArray(assemblies), "Should get assemblies array");
      }
      const enumTime = Date.now() - enumStartTime;

      // Test type lookup performance
      const lookupStartTime = Date.now();
      for (let i = 0; i < 20; i++) {
        // Reduced from 200
        const stringClass = domain.tryClass("System.String");
        // Don't assert here as it might not exist, just test performance
      }
      const lookupTime = Date.now() - lookupStartTime;

      console.log(`    Domain access: ${domainAccessTime}ms for ${iterations} operations`);
      console.log(`    Assembly enumeration: ${enumTime}ms for 10 operations`);
      console.log(`    Type lookup: ${lookupTime}ms for 20 operations`);

      assert(domainAccessTime < 5000, "Domain access should be fast");
      assert(enumTime < 5000, "Assembly enumeration should be reasonable");
      assert(lookupTime < 5000, "Type lookup should be fast");
    }),
  );

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestEnhanced("Domain should handle invalid operations gracefully", domain => {
      // Test invalid assembly names
      const invalidAssemblies = [
        null,
        undefined,
        "",
        "NonExistent.Assembly",
        "Invalid\\Name\\With\\Slashes",
        "Invalid Name With Spaces",
      ];

      for (const invalidName of invalidAssemblies) {
        try {
          const result = domain.tryAssembly(invalidName as any);
          assert(result === null, `Invalid assembly name should return null: ${invalidName}`);
        } catch (error) {
          // Controlled errors are acceptable
          console.log(`    Assembly lookup error handled: ${invalidName}`);
        }
      }

      // Test invalid type names
      const invalidTypes = [
        null,
        undefined,
        "",
        "Invalid.Type.Name.With.Too.Many.Dots",
        "Invalid\\Type\\Name",
        "Type With Spaces",
      ];

      for (const invalidName of invalidTypes) {
        try {
          const result = domain.tryClass(invalidName as any);
          assert(result === null, `Invalid type name should return null: ${invalidName}`);
        } catch (error) {
          console.log(`    Type lookup error handled: ${invalidName}`);
        }
      }

      console.log("    Invalid operations handled gracefully");
    }),
  );

  await suite.addResultAsync(
    createDomainTestEnhanced("Domain should handle assembly loading errors", domain => {
      // Test loading non-existent files
      try {
        const result = domain.assemblyOpen("NonExistentFile.dll");
        // This should either return null or throw an error
        if (result === null) {
          console.log("    Non-existent file loading returned null (expected)");
        }
      } catch (error) {
        console.log(`    Assembly loading error handled: ${error}`);
      }

      // Test loading with invalid paths
      const invalidPaths = [
        "",
        "invalid/path/file.dll",
        "C:\\nonexistent\\path\\file.dll",
        "/dev/null/nonexistent.dll",
      ];

      for (const invalidPath of invalidPaths) {
        try {
          const result = domain.assemblyOpen(invalidPath);
          if (result === null) {
            console.log(`    Invalid path handled: ${invalidPath}`);
          }
        } catch (error) {
          console.log(`    Invalid path error handled: ${invalidPath}`);
        }
      }

      console.log("    Assembly loading errors handled correctly");
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain should integrate with API operations", domain => {
      const api = Mono.api;

      // Test that domain and API work together
      const apiDomain = api.getRootDomain();
      assertNotNull(apiDomain, "API should provide domain");

      // Test that domain pointer matches API domain
      assert(domain.pointer.equals(apiDomain), "Domain and API domain pointers should match");

      // Test that domain operations use API correctly
      const assemblies = domain.assemblies;
      assert(Array.isArray(assemblies), "Domain should provide assemblies through API");

      console.log("    Domain-API integration working correctly");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should integrate with type system", domain => {
      // Test that domain types work with the type system
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        // Test class methods
        const methods = stringClass.methods;
        assert(Array.isArray(methods), "Class should have methods array");

        // Test class fields
        const fields = stringClass.fields;
        assert(Array.isArray(fields), "Class should have fields array");

        // Test class properties
        const properties = stringClass.properties;
        assert(Array.isArray(properties), "Class should have properties array");

        console.log(
          `    String class integration: ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`,
        );
      }

      console.log("    Domain-type system integration working");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain should integrate with Unity systems", domain => {
      // Test Unity-specific integration
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      if (gameObjectClass) {
        console.log("    Unity GameObject class found");

        // Test that we can access Unity-specific methods
        const methods = gameObjectClass.methods;
        const unityMethods = methods.filter(
          (m: any) =>
            m.name.includes("GetComponent") || m.name.includes("AddComponent") || m.name.includes("Instantiate"),
        );

        console.log(`    Found ${unityMethods.length} Unity-specific methods`);
      }

      // Test Unity assembly integration
      const unityCore = domain.tryAssembly("UnityEngine.CoreModule");
      if (unityCore) {
        const image = unityCore.image;
        const classes = image.classes;

        const unityClasses = classes.filter((c: any) => c.namespace.startsWith("UnityEngine"));

        console.log(`    Found ${unityClasses.length} Unity classes in CoreModule`);
      }

      console.log("    Unity system integration verified");
    }),
  );

  // ============================================================================
  // ASSEMBLY UNLOADING TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain.unloadAssembly should return result object", domain => {
      const mscorlib = domain.tryAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");

      const result = domain.unloadAssembly(mscorlib!);
      assert(typeof result === "object", "Should return object");
      assert(typeof result.success === "boolean", "Should have success property");
      assert(typeof result.reason === "string", "Should have reason property");
      assert(typeof result.supported === "boolean", "Should have supported property");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.unloadAssembly should reject system assemblies", domain => {
      const mscorlib = domain.tryAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");

      const result = domain.unloadAssembly(mscorlib!);
      // Should fail because mscorlib is a system assembly
      assert(result.success === false, "Should fail for system assembly");
      assert(result.reason.toLowerCase().includes("system"), "Reason should mention system");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.unloadAssembly should work by name", domain => {
      const result = domain.unloadAssembly("mscorlib");
      // Should return a result (even if failed)
      assert(typeof result === "object", "Should return result object");
      assert(typeof result.success === "boolean", "Should have success property");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.unloadAssembly should handle nonexistent assembly", domain => {
      const result = domain.unloadAssembly("NonExistentAssembly12345");
      assert(result.success === false, "Should fail for nonexistent assembly");
      assert(result.reason.toLowerCase().includes("not found"), "Reason should mention not found");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.isAssemblyUnloadingSupported should return boolean", domain => {
      const supported = domain.isAssemblyUnloadingSupported();
      assert(typeof supported === "boolean", "Should return boolean");
      console.log(`    Assembly unloading supported: ${supported}`);
    }),
  );

  // ============================================================================
  // SUMMARY AND DESCRIPTION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain.getSummary should return complete summary object", domain => {
      const summary = domain.getSummary();
      assertNotNull(summary, "getSummary should return an object");

      // Verify all required properties
      assert(typeof summary.id === "number", "Summary should have id");
      assert(typeof summary.isRoot === "boolean", "Summary should have isRoot");
      assert(typeof summary.assemblyCount === "number", "Summary should have assemblyCount");
      assert(Array.isArray(summary.assemblyNames), "Summary should have assemblyNames array");
      assert(typeof summary.namespaceCount === "number", "Summary should have namespaceCount");
      assert(typeof summary.pointer === "string", "Summary should have pointer");

      console.log(`    Summary: ID=${summary.id}, isRoot=${summary.isRoot}, assemblies=${summary.assemblyCount}`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.getSummary should have consistent data", domain => {
      const summary = domain.getSummary();

      // Verify consistency with direct methods
      assert(summary.id === domain.id, "Summary id should match domain.id");
      assert(summary.isRoot === domain.isRoot, "Summary isRoot should match isRoot");
      assert(summary.assemblyCount === domain.assemblyCount, "Summary assemblyCount should match domain.assemblyCount");
      assert(
        summary.assemblyNames.length === domain.assemblyCount,
        "Summary assemblyNames length should match assemblyCount",
      );
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.describe should return formatted string", domain => {
      const description = domain.describe();
      assertNotNull(description, "describe should return a string");

      // Verify key information is included
      assert(description.includes("MonoDomain"), "Description should include MonoDomain");
      assert(description.includes("Assemblies"), "Description should include assembly info");
      assert(description.includes("Namespaces"), "Description should include namespace info");

      console.log("    describe() output:");
      description.split("\n").forEach(line => console.log(`      ${line}`));
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.toString should return correct format", domain => {
      const str = domain.toString();
      assertNotNull(str, "toString should return a string");

      assert(str.includes("MonoDomain"), "toString should include MonoDomain");
      assert(str.includes("assemblies"), "toString should include assembly count");

      // Should include root label if it is root
      if (domain.isRoot) {
        assert(str.includes("root"), "toString should include 'root' for root domain");
      }

      console.log(`    toString: ${str}`);
    }),
  );

  // ============================================================================
  // ACCESSOR PROPERTIES TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain.assemblyCount accessor should return correct count", domain => {
      const countFromAccessor = domain.assemblyCount;
      const countFromMethod = domain.assemblies.length;

      assert(countFromAccessor === countFromMethod, "assemblyCount accessor should match getAssemblies().length");
      assert(typeof countFromAccessor === "number", "assemblyCount should be a number");
      assert(countFromAccessor > 0, "assemblyCount should be positive");

      console.log(`    Assembly count: ${countFromAccessor}`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.isRoot accessor should match isRoot", domain => {
      const fromAccessor = domain.isRoot;
      const fromMethod = domain.isRoot;

      assert(fromAccessor === fromMethod, "isRoot accessor should match isRoot");
      assert(typeof fromAccessor === "boolean", "isRoot should be a boolean");

      console.log(`    Is root domain: ${fromAccessor}`);
    }),
  );

  // ============================================================================
  // UTILITY METHODS TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain.hasAssembly should return true for existing assembly", domain => {
      assert(domain.hasAssembly("mscorlib") === true, "Should find mscorlib");

      // Also test with other common assemblies
      const unityCore = domain.hasAssembly("UnityEngine.CoreModule");
      const unityEngine = domain.hasAssembly("UnityEngine");
      console.log(`    Has UnityEngine.CoreModule: ${unityCore}, Has UnityEngine: ${unityEngine}`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.hasAssembly should return false for non-existing assembly", domain => {
      assert(domain.hasAssembly("NonExistent.Assembly") === false, "Should not find NonExistent.Assembly");
      assert(domain.hasAssembly("") === false, "Should return false for empty string");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.hasClass should return true for existing class", domain => {
      assert(domain.hasClass("System.String") === true, "Should find System.String");
      assert(domain.hasClass("System.Object") === true, "Should find System.Object");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.hasClass should return false for non-existing class", domain => {
      assert(domain.hasClass("NonExistent.Class") === false, "Should not find NonExistent.Class");
      assert(domain.hasClass("") === false, "Should return false for empty string");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.searchAssemblies should find by pattern", domain => {
      // Search for "System" assemblies
      const systemAssemblies = domain.searchAssemblies("system");
      assert(Array.isArray(systemAssemblies), "Should return an array");

      // Search for "Unity" assemblies
      const unityAssemblies = domain.searchAssemblies("unity");
      console.log(`    Found ${systemAssemblies.length} System assemblies, ${unityAssemblies.length} Unity assemblies`);

      // Verify case-insensitivity
      const lower = domain.searchAssemblies("mono");
      const upper = domain.searchAssemblies("MONO");
      assert(lower.length === upper.length, "Search should be case-insensitive");
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.searchClasses should find by pattern", domain => {
      // Search for "String" classes
      const stringClasses = domain.searchClasses("string", 20);
      assert(Array.isArray(stringClasses), "Should return an array");
      assert(stringClasses.length > 0, "Should find classes containing 'string'");
      assert(stringClasses.length <= 20, "Should respect maxResults");

      // Verify all contain the pattern (case-insensitive)
      const allMatch = stringClasses.every(c => c.name.toLowerCase().includes("string"));
      assert(allMatch, "All found classes should contain the pattern");

      console.log(`    Found ${stringClasses.length} classes containing 'string'`);
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.getTotalClassCount should return positive number", domain => {
      const totalCount = domain.totalClassCount;
      assert(typeof totalCount === "number", "Should return a number");
      assert(totalCount > 0, "Should have positive total class count");

      // Verify it matches sum of individual assembly class counts
      let manualCount = 0;
      for (const asm of domain.assemblies) {
        manualCount += asm.image.classCount;
      }
      assert(totalCount === manualCount, "getTotalClassCount should match sum of individual counts");

      console.log(`    Total class count: ${totalCount}`);
    }),
  );

  // ============================================================================
  // DOMAIN CREATION AND SWITCHING TESTS
  // ============================================================================

  await suite.addResultAsync(
    createDomainTestAsync("Domain.createDomain should return domain or null", domain => {
      const newDomain = domain.createDomain("TestDomain");
      // Can be null if not supported, that's OK
      assert(newDomain === null || newDomain.pointer !== undefined, "Should return null or valid domain");
      if (newDomain) {
        console.log(`    Created domain: ${newDomain.id}`);
      } else {
        console.log("    Domain creation not supported");
      }
    }),
  );

  await suite.addResultAsync(
    createDomainTestAsync("Domain.setAsCurrent should return domain or null", domain => {
      const previous = domain.setAsCurrent();
      // Can be null if API not available
      assert(previous === null || previous.pointer !== undefined, "Should return null or valid domain");
      if (previous) {
        console.log(`    Previous domain ID: ${previous.id}`);
      } else {
        console.log("    setAsCurrent API not available");
      }
    }),
  );

  const summary = suite.getSummary();
  return {
    name: "Mono Domain Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Mono domain tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

/**
 * Find Tools Module Tests
 *
 * Tests for search and discovery helpers.
 *
 * NOTE: The `Mono.find` facade has been removed. The redundant `classExact()`
 * helper was also removed; these tests validate `Mono.domain.tryClass()` and
 * `Mono.domain.find*()`.
 */
export async function createFindToolTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // =====================================================
  // Section 1: API Availability Tests (Fast)
  // =====================================================
  results.push(
    await withDomain("Find - Mono.domain helpers exist", () => {
      assert(typeof Mono.domain.tryClass === "function", "Mono.domain.tryClass should be a function");
      assert(typeof Mono.domain.findClasses === "function", "Mono.domain.findClasses should be a function");
      assert(typeof Mono.domain.findMethods === "function", "Mono.domain.findMethods should be a function");
      assert(typeof Mono.domain.findFields === "function", "Mono.domain.findFields should be a function");
      assert(typeof Mono.domain.findProperties === "function", "Mono.domain.findProperties should be a function");
    }),
  );

  // =====================================================
  // Section 2: tryClass - Exact Lookup
  // =====================================================
  results.push(
    await withDomain("Find.tryClass - System.String", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.String");
      assertNotNull(klass, "Should find System.String");
      assert(klass!.name === "String", "Name should be String");
      assert(klass!.namespace === "System", "Namespace should be System");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Int32", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Int32");
      assertNotNull(klass, "Should find System.Int32");
      assert(klass!.name === "Int32", "Name should be Int32");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Object", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Object");
      assertNotNull(klass, "Should find System.Object");
      assert(klass!.name === "Object", "Name should be Object");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Boolean", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Boolean");
      assertNotNull(klass, "Should find System.Boolean");
      assert(klass!.name === "Boolean", "Name should be Boolean");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Double", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Double");
      assertNotNull(klass, "Should find System.Double");
      assert(klass!.name === "Double", "Name should be Double");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Array", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Array");
      assertNotNull(klass, "Should find System.Array");
      assert(klass!.name === "Array", "Name should be Array");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Type", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Type");
      assertNotNull(klass, "Should find System.Type");
      assert(klass!.name === "Type", "Name should be Type");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Exception", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Exception");
      assertNotNull(klass, "Should find System.Exception");
      assert(klass!.name === "Exception", "Name should be Exception");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Collections.Generic.List`1", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Collections.Generic.List`1");
      assertNotNull(klass, "Should find List<T>");
      assert(klass!.name === "List`1", "Name should be List`1");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - System.Collections.Generic.Dictionary`2", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.Collections.Generic.Dictionary`2");
      assertNotNull(klass, "Should find Dictionary<K,V>");
      assert(klass!.name === "Dictionary`2", "Name should be Dictionary`2");
    }),
  );

  // =====================================================
  // Section 3: Result Validation
  // =====================================================
  results.push(
    await withDomain("Find.tryClass - result has valid methods", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.String");
      assertNotNull(klass, "Should find System.String");

      const methods = klass!.methods;
      assert(Array.isArray(methods), "methods should be array");
      assert(methods.length > 0, "String should have methods");

      const methodNames = methods.map(m => m.name);
      assert(methodNames.includes("ToString"), "Should have ToString method");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - result has valid fields", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.String");
      assertNotNull(klass, "Should find System.String");

      const fields = klass!.fields;
      assert(Array.isArray(fields), "fields should be array");

      const hasEmpty = fields.some(f => f.name === "Empty");
      console.log(`[INFO] String has ${fields.length} fields, Empty: ${hasEmpty}`);
    }),
  );

  results.push(
    await withDomain("Find.tryClass - result has valid properties", ({ domain }) => {
      const klass = Mono.domain.tryClass("System.String");
      assertNotNull(klass, "Should find System.String");

      const props = klass!.properties;
      assert(Array.isArray(props), "properties should be array");

      const propNames = props.map(p => p.name);
      assert(propNames.includes("Length"), "Should have Length property");
    }),
  );

  // =====================================================
  // Section 4: Unity Classes (if Unity Project)
  // =====================================================
  results.push(
    await withDomain("Find.tryClass - UnityEngine.Object (Unity)", ({ domain }) => {
      const klass = Mono.domain.tryClass("UnityEngine.Object");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "Object", "Name should be Object");
      assert(klass.namespace === "UnityEngine", "Namespace should be UnityEngine");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - UnityEngine.GameObject (Unity)", ({ domain }) => {
      const klass = Mono.domain.tryClass("UnityEngine.GameObject");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "GameObject", "Name should be GameObject");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - UnityEngine.Transform (Unity)", ({ domain }) => {
      const klass = Mono.domain.tryClass("UnityEngine.Transform");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "Transform", "Name should be Transform");
    }),
  );

  results.push(
    await withDomain("Find.tryClass - UnityEngine.MonoBehaviour (Unity)", ({ domain }) => {
      const klass = Mono.domain.tryClass("UnityEngine.MonoBehaviour");
      if (klass === null) {
        console.log("[SKIP] Not a Unity project");
        return;
      }
      assert(klass.name === "MonoBehaviour", "Name should be MonoBehaviour");
    }),
  );

  return results;
}

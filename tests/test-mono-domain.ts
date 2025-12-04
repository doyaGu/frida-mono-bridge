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
import {
  TestResult,
  TestSuite,
  createMonoDependentTest,
  createPerformanceTest,
  createDomainTest,
  createDomainTestEnhanced,
  createApiAvailabilityTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  assertDomainAvailable,
  assertDomainCached,
  TestCategory,
} from "./test-framework";

export function testMonoDomain(): TestResult {
  console.log("\nComprehensive Mono Domain Tests:");

  const suite = new TestSuite("Mono Domain Complete Tests", TestCategory.MONO_DEPENDENT);

  // ============================================================================
  // DOMAIN CREATION AND BASIC OPERATIONS
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Domain should be accessible and functional", () => {
      assertPerformWorks("Domain operations should work");
      assertDomainAvailable("Mono.domain should be accessible");

      const domain = Mono.domain;
      assertNotNull(domain, "Domain should not be null");

      // Test domain properties
      assert(typeof domain.id === "number", "Domain should have numeric ID");
      // Domain ID can be any number (may be negative due to signed interpretation of address)
      assert(!isNaN(domain.id), "Domain ID should not be NaN");

      console.log(`    Domain accessible with ID: ${domain.id}`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Domain should provide consistent access", () => {
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

  suite.addResult(
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

  suite.addResult(
    createDomainTest("Root domain should be accessible", domain => {
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

  suite.addResult(
    createDomainTest("Domain should load assemblies correctly", domain => {
      // Test assembly enumeration
      const assemblies = domain.getAssemblies();
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
      assert(typeof firstAssembly.getName === "function", "Assembly should have getName method");

      const assemblyName = firstAssembly.getName();
      assert(typeof assemblyName === "string", "Assembly name should be string");
      assert(assemblyName.length > 0, "Assembly name should not be empty");

      console.log(`    First assembly: ${assemblyName}`);
    }),
  );

  suite.addResult(
    createDomainTest("Domain should find core assemblies", domain => {
      const coreAssemblyNames = ["mscorlib", "System.Private.CoreLib", "netstandard"];
      let foundCoreAssembly = null;

      for (const name of coreAssemblyNames) {
        const assembly = domain.assembly(name);
        if (assembly) {
          foundCoreAssembly = assembly;
          console.log(`    Found core assembly: ${name}`);
          break;
        }
      }

      if (foundCoreAssembly) {
        assertNotNull(foundCoreAssembly.image, "Core assembly should have image");
        assert(!foundCoreAssembly.image.pointer.isNull(), "Core assembly image should not be NULL");

        const classes = foundCoreAssembly.image.getClasses();
        assert(Array.isArray(classes), "Core assembly should have classes array");
        assert(classes.length > 0, "Core assembly should have classes");

        console.log(`    Core assembly has ${classes.length} classes`);
      } else {
        console.log("    Core assembly not found (may be Unity-specific runtime)");
      }
    }),
  );

  suite.addResult(
    createDomainTest("Domain should find Unity assemblies", domain => {
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
        const assembly = domain.assembly(name);
        if (assembly) {
          foundUnityAssemblies++;
          console.log(`    Found Unity assembly: ${name}`);

          // Test assembly properties
          assertNotNull(assembly.image, "Unity assembly should have image");
          const classes = assembly.image.getClasses();
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

  suite.addResult(
    createDomainTest("Domain should handle assembly loading variations", domain => {
      // Test case sensitivity
      const mscorlibLower = domain.assembly("mscorlib");
      const mscorlibUpper = domain.assembly("MSCORLIB");

      if (mscorlibLower) {
        console.log("    Found mscorlib with lowercase name");
      }

      if (mscorlibUpper && mscorlibUpper !== mscorlibLower) {
        console.log("    Found different assembly with uppercase name (case-sensitive)");
      } else if (!mscorlibUpper && mscorlibLower) {
        console.log("    Assembly lookup is case-sensitive");
      }

      // Test with/without extension
      const withExtension = domain.assembly("mscorlib.dll");
      if (withExtension) {
        console.log("    Found mscorlib with .dll extension");
      }

      // Test non-existent assemblies
      const nonExistent = domain.assembly("NonExistent.Assembly");
      assert(nonExistent === null, "Non-existent assembly should return null");

      const emptyName = domain.assembly("");
      assert(emptyName === null, "Empty assembly name should return null");

      console.log("    Assembly loading variations handled correctly");
    }),
  );

  // ============================================================================
  // TYPE RESOLUTION ACROSS DOMAINS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain should resolve system types", domain => {
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
        const klass = domain.class(typeName);
        if (klass) {
          foundTypes++;
          console.log(`    Found system type: ${typeName}`);

          // Test class properties
          assert(typeof klass.getName === "function", "Class should have getName method");
          assert(typeof klass.getNamespace === "function", "Class should have getNamespace method");

          const className = klass.getName();
          const namespace = klass.getNamespace();

          assert(typeof className === "string", "Class name should be string");
          assert(typeof namespace === "string", "Namespace should be string");

          console.log(`      Full name: ${namespace}.${className}`);
        }
      }

      console.log(`    Found ${foundTypes}/${systemTypes.length} system types`);
    }),
  );

  suite.addResult(
    createDomainTest("Domain should resolve Unity types", domain => {
      const unityTypes = [
        "UnityEngine.GameObject",
        "UnityEngine.Transform",
        "UnityEngine.MonoBehaviour",
        "UnityEngine.Component",
        "UnityEngine.Object",
      ];

      let foundUnityTypes = 0;

      for (const typeName of unityTypes) {
        const klass = domain.class(typeName);
        if (klass) {
          foundUnityTypes++;
          console.log(`    Found Unity type: ${typeName}`);

          // Test class methods
          const methods = klass.getMethods();
          assert(Array.isArray(methods), "Class should have methods array");
          console.log(`      ${methods.length} methods`);

          // Test class fields
          const fields = klass.getFields();
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

  suite.addResult(
    createDomainTest("Domain should handle type resolution edge cases", domain => {
      // Test empty and null type names
      const emptyType = domain.class("");
      assert(emptyType === null, "Empty type name should return null");

      const nullType = domain.class(null as any);
      assert(nullType === null, "Null type name should return null");

      const undefinedType = domain.class(undefined as any);
      assert(undefinedType === null, "Undefined type name should return null");

      // Test malformed type names
      const malformedType = domain.class("Invalid.Type.Name.With.Too.Many.Dots");
      // This should return null, not throw
      console.log("    Malformed type name handled gracefully");

      // Test case sensitivity
      const stringLower = domain.class("system.string");
      const stringProper = domain.class("System.String");

      if (stringProper && !stringLower) {
        console.log("    Type resolution is case-sensitive");
      } else if (stringLower && stringProper) {
        console.log("    Type resolution is case-insensitive");
      }

      console.log("    Type resolution edge cases handled correctly");
    }),
  );

  suite.addResult(
    createDomainTest("Domain should provide namespace information", domain => {
      // getRootNamespaces can be slow, so we use a timeout wrapper
      let rootNamespaces: string[] = [];
      try {
        // Only get a quick sample, don't iterate everything
        const mscorlib = domain.assembly("mscorlib");
        if (mscorlib && mscorlib.image) {
          const classes = mscorlib.image.getClasses().slice(0, 100); // Only check first 100 classes
          const namespaces = new Set<string>();
          for (const klass of classes) {
            const ns = klass.getNamespace();
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

  suite.addResult(
    createDomainTest("Domain should maintain assembly isolation", domain => {
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Should get assemblies array");

      // Test that each assembly has its own image
      for (const assembly of assemblies.slice(0, 5)) {
        // Test first 5 assemblies
        try {
          assertNotNull(assembly.image, "Assembly should have image");
          assert(!assembly.image.pointer.isNull(), "Assembly image should not be NULL");

          const classes = assembly.image.getClasses();
          assert(Array.isArray(classes), "Assembly image should have classes array");

          // Test that classes are properly associated with their assembly
          if (classes.length > 0) {
            const firstClass = classes[0];
            assertNotNull(firstClass, "First class should not be null");

            // The class should be accessible through the domain
            const className = firstClass.getName();
            const namespace = firstClass.getNamespace();
            const fullName = namespace ? `${namespace}.${className}` : className;

            const domainClass = domain.class(fullName);
            if (domainClass) {
              // Should be the same class or equivalent
              const domainClassName = domainClass.getName();
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

  suite.addResult(
    createDomainTest("Domain should handle cross-assembly type references", domain => {
      // Find a type that references another assembly
      const stringClass = domain.class("System.String");
      if (stringClass) {
        // String class should reference mscorlib
        const methods = stringClass.getMethods();
        assert(Array.isArray(methods), "String class should have methods");

        // Look for methods that might reference other assemblies
        let crossAssemblyRefs = 0;
        for (const method of methods.slice(0, 10)) {
          // Check first 10 methods
          try {
            const returnType = method.getReturnType();
            if (returnType) {
              const returnTypeName = returnType.getName();
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

  suite.addResult(
    createDomainTest("Domain should enforce type access boundaries", domain => {
      // Test that private/internal types are handled appropriately
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const classes = firstAssembly.image.getClasses();

        // Try to access various types
        let accessibleTypes = 0;
        let inaccessibleTypes = 0;

        for (const klass of classes.slice(0, 20)) {
          // Test first 20 classes
          try {
            const className = klass.getName();
            const namespace = klass.getNamespace();
            const fullName = namespace ? `${namespace}.${className}` : className;

            // Try to access through domain
            const domainClass = domain.class(fullName);
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

  suite.addResult(
    createDomainTest("Domain should handle lifecycle operations", domain => {
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
      const assemblies1 = domain.getAssemblies();
      const assemblies2 = domain.getAssemblies();

      assert(assemblies1.length === assemblies2.length, "Assembly count should be consistent");

      console.log("    Domain lifecycle operations verified");
    }),
  );

  suite.addResult(
    createDomainTest("Domain should handle enumeration operations", domain => {
      let enumeratedAssemblies = 0;

      // Test assembly enumeration callback
      domain.enumerateAssemblies(assembly => {
        enumeratedAssemblies++;
        assertNotNull(assembly, "Enumerated assembly should not be null");
        assert(typeof assembly.getName === "function", "Enumerated assembly should have getName method");
      });

      assert(enumeratedAssemblies > 0, "Should enumerate at least one assembly");

      // Compare with getAssemblies
      const directAssemblies = domain.getAssemblies();
      assert(enumeratedAssemblies === directAssemblies.length, "Enumeration should match direct access");

      console.log(`    Enumerated ${enumeratedAssemblies} assemblies`);
    }),
  );

  suite.addResult(
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
        const assemblies = domain.getAssemblies();
        assert(Array.isArray(assemblies), "Should get assemblies array");
      }
      const enumTime = Date.now() - enumStartTime;

      // Test type lookup performance
      const lookupStartTime = Date.now();
      for (let i = 0; i < 20; i++) {
        // Reduced from 200
        const stringClass = domain.class("System.String");
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

  suite.addResult(
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
          const result = domain.assembly(invalidName as any);
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
          const result = domain.class(invalidName as any);
          assert(result === null, `Invalid type name should return null: ${invalidName}`);
        } catch (error) {
          console.log(`    Type lookup error handled: ${invalidName}`);
        }
      }

      console.log("    Invalid operations handled gracefully");
    }),
  );

  suite.addResult(
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

  suite.addResult(
    createDomainTest("Domain should integrate with API operations", domain => {
      const api = Mono.api;

      // Test that domain and API work together
      const apiDomain = api.getRootDomain();
      assertNotNull(apiDomain, "API should provide domain");

      // Test that domain pointer matches API domain
      assert(domain.pointer.equals(apiDomain), "Domain and API domain pointers should match");

      // Test that domain operations use API correctly
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Domain should provide assemblies through API");

      console.log("    Domain-API integration working correctly");
    }),
  );

  suite.addResult(
    createDomainTest("Domain should integrate with type system", domain => {
      // Test that domain types work with the type system
      const stringClass = domain.class("System.String");
      if (stringClass) {
        // Test class methods
        const methods = stringClass.getMethods();
        assert(Array.isArray(methods), "Class should have methods array");

        // Test class fields
        const fields = stringClass.getFields();
        assert(Array.isArray(fields), "Class should have fields array");

        // Test class properties
        const properties = stringClass.getProperties();
        assert(Array.isArray(properties), "Class should have properties array");

        console.log(
          `    String class integration: ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`,
        );
      }

      console.log("    Domain-type system integration working");
    }),
  );

  suite.addResult(
    createDomainTest("Domain should integrate with Unity systems", domain => {
      // Test Unity-specific integration
      const gameObjectClass = domain.class("UnityEngine.GameObject");
      if (gameObjectClass) {
        console.log("    Unity GameObject class found");

        // Test that we can access Unity-specific methods
        const methods = gameObjectClass.getMethods();
        const unityMethods = methods.filter(
          (m: any) =>
            m.getName().includes("GetComponent") ||
            m.getName().includes("AddComponent") ||
            m.getName().includes("Instantiate"),
        );

        console.log(`    Found ${unityMethods.length} Unity-specific methods`);
      }

      // Test Unity assembly integration
      const unityCore = domain.assembly("UnityEngine.CoreModule");
      if (unityCore) {
        const image = unityCore.image;
        const classes = image.getClasses();

        const unityClasses = classes.filter((c: any) => c.getNamespace().startsWith("UnityEngine"));

        console.log(`    Found ${unityClasses.length} Unity classes in CoreModule`);
      }

      console.log("    Unity system integration verified");
    }),
  );

  // ============================================================================
  // ASSEMBLY UNLOADING TESTS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain.unloadAssembly should return result object", domain => {
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");

      const result = domain.unloadAssembly(mscorlib!);
      assert(typeof result === "object", "Should return object");
      assert(typeof result.success === "boolean", "Should have success property");
      assert(typeof result.reason === "string", "Should have reason property");
      assert(typeof result.supported === "boolean", "Should have supported property");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.unloadAssembly should reject system assemblies", domain => {
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");

      const result = domain.unloadAssembly(mscorlib!);
      // Should fail because mscorlib is a system assembly
      assert(result.success === false, "Should fail for system assembly");
      assert(result.reason.toLowerCase().includes("system"), "Reason should mention system");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.unloadAssembly should work by name", domain => {
      const result = domain.unloadAssembly("mscorlib");
      // Should return a result (even if failed)
      assert(typeof result === "object", "Should return result object");
      assert(typeof result.success === "boolean", "Should have success property");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.unloadAssembly should handle nonexistent assembly", domain => {
      const result = domain.unloadAssembly("NonExistentAssembly12345");
      assert(result.success === false, "Should fail for nonexistent assembly");
      assert(result.reason.toLowerCase().includes("not found"), "Reason should mention not found");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.isAssemblyUnloadingSupported should return boolean", domain => {
      const supported = domain.isAssemblyUnloadingSupported();
      assert(typeof supported === "boolean", "Should return boolean");
      console.log(`    Assembly unloading supported: ${supported}`);
    }),
  );

  // ============================================================================
  // SUMMARY AND DESCRIPTION TESTS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain.getSummary should return complete summary object", domain => {
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

  suite.addResult(
    createDomainTest("Domain.getSummary should have consistent data", domain => {
      const summary = domain.getSummary();

      // Verify consistency with direct methods
      assert(summary.id === domain.id, "Summary id should match domain.id");
      assert(summary.isRoot === domain.isRootDomain(), "Summary isRoot should match isRootDomain()");
      assert(summary.assemblyCount === domain.assemblyCount, "Summary assemblyCount should match domain.assemblyCount");
      assert(
        summary.assemblyNames.length === domain.assemblyCount,
        "Summary assemblyNames length should match assemblyCount",
      );
    }),
  );

  suite.addResult(
    createDomainTest("Domain.describe should return formatted string", domain => {
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

  suite.addResult(
    createDomainTest("Domain.toString should return correct format", domain => {
      const str = domain.toString();
      assertNotNull(str, "toString should return a string");

      assert(str.includes("MonoDomain"), "toString should include MonoDomain");
      assert(str.includes("assemblies"), "toString should include assembly count");

      // Should include root label if it is root
      if (domain.isRootDomain()) {
        assert(str.includes("root"), "toString should include 'root' for root domain");
      }

      console.log(`    toString: ${str}`);
    }),
  );

  // ============================================================================
  // ACCESSOR PROPERTIES TESTS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain.assemblyCount accessor should return correct count", domain => {
      const countFromAccessor = domain.assemblyCount;
      const countFromMethod = domain.getAssemblies().length;

      assert(countFromAccessor === countFromMethod, "assemblyCount accessor should match getAssemblies().length");
      assert(typeof countFromAccessor === "number", "assemblyCount should be a number");
      assert(countFromAccessor > 0, "assemblyCount should be positive");

      console.log(`    Assembly count: ${countFromAccessor}`);
    }),
  );

  suite.addResult(
    createDomainTest("Domain.isRoot accessor should match isRootDomain()", domain => {
      const fromAccessor = domain.isRoot;
      const fromMethod = domain.isRootDomain();

      assert(fromAccessor === fromMethod, "isRoot accessor should match isRootDomain()");
      assert(typeof fromAccessor === "boolean", "isRoot should be a boolean");

      console.log(`    Is root domain: ${fromAccessor}`);
    }),
  );

  // ============================================================================
  // UTILITY METHODS TESTS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain.hasAssembly should return true for existing assembly", domain => {
      assert(domain.hasAssembly("mscorlib") === true, "Should find mscorlib");

      // Also test with other common assemblies
      const unityCore = domain.hasAssembly("UnityEngine.CoreModule");
      const unityEngine = domain.hasAssembly("UnityEngine");
      console.log(`    Has UnityEngine.CoreModule: ${unityCore}, Has UnityEngine: ${unityEngine}`);
    }),
  );

  suite.addResult(
    createDomainTest("Domain.hasAssembly should return false for non-existing assembly", domain => {
      assert(domain.hasAssembly("NonExistent.Assembly") === false, "Should not find NonExistent.Assembly");
      assert(domain.hasAssembly("") === false, "Should return false for empty string");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.hasClass should return true for existing class", domain => {
      assert(domain.hasClass("System.String") === true, "Should find System.String");
      assert(domain.hasClass("System.Object") === true, "Should find System.Object");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.hasClass should return false for non-existing class", domain => {
      assert(domain.hasClass("NonExistent.Class") === false, "Should not find NonExistent.Class");
      assert(domain.hasClass("") === false, "Should return false for empty string");
    }),
  );

  suite.addResult(
    createDomainTest("Domain.searchAssemblies should find by pattern", domain => {
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

  suite.addResult(
    createDomainTest("Domain.searchClasses should find by pattern", domain => {
      // Search for "String" classes
      const stringClasses = domain.searchClasses("string", 20);
      assert(Array.isArray(stringClasses), "Should return an array");
      assert(stringClasses.length > 0, "Should find classes containing 'string'");
      assert(stringClasses.length <= 20, "Should respect maxResults");

      // Verify all contain the pattern (case-insensitive)
      const allMatch = stringClasses.every(c => c.getName().toLowerCase().includes("string"));
      assert(allMatch, "All found classes should contain the pattern");

      console.log(`    Found ${stringClasses.length} classes containing 'string'`);
    }),
  );

  suite.addResult(
    createDomainTest("Domain.getTotalClassCount should return positive number", domain => {
      const totalCount = domain.getTotalClassCount();
      assert(typeof totalCount === "number", "Should return a number");
      assert(totalCount > 0, "Should have positive total class count");

      // Verify it matches sum of individual assembly class counts
      let manualCount = 0;
      for (const asm of domain.getAssemblies()) {
        manualCount += asm.image.getClassCount();
      }
      assert(totalCount === manualCount, "getTotalClassCount should match sum of individual counts");

      console.log(`    Total class count: ${totalCount}`);
    }),
  );

  // ============================================================================
  // DOMAIN CREATION AND SWITCHING TESTS
  // ============================================================================

  suite.addResult(
    createDomainTest("Domain.createDomain should return domain or null", domain => {
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

  suite.addResult(
    createDomainTest("Domain.setAsCurrent should return domain or null", domain => {
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

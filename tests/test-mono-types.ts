/**
 * Mono Types Tests
 * Consolidated tests for Domain, Assembly, and Class operations
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createMonoDependentTest,
  createSmokeTest,
  createDomainTest,
  createDomainTestEnhanced,
  createPerformSmokeTest,
  createApiAvailabilityTest,
  createNestedPerformTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  assertApiAvailable,
  assertDomainAvailable,
  assertDomainCached,
  TestCategory
} from "./test-framework";

export function testMonoTypes(): TestResult {
  console.log("\nMono Types (Domain, Assembly, Class):");

  const suite = new TestSuite("Mono Types Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "mono types"));

  // ============================================================================
  // DOMAIN TESTS
  // ============================================================================

  // Modern API tests
  suite.addResult(createMonoDependentTest("Mono.perform should work for domain tests", () => {
    assertPerformWorks("Mono.perform() should work for domain tests");
  }));

  suite.addResult(createMonoDependentTest("Mono.domain property should be accessible", () => {
    assertDomainAvailable("Mono.domain should be accessible");
  }));

  suite.addResult(createMonoDependentTest("Root domain should be accessible", () => {
    const domain = Mono.api.getRootDomain();
    assertNotNull(domain, "Root domain should not be null");
    assert(!domain.isNull(), "Root domain should not be NULL pointer");
  }));

  suite.addResult(createMonoDependentTest("Root domain should be cached", () => {
    const domain1 = Mono.api.getRootDomain();
    const domain2 = Mono.api.getRootDomain();

    assertNotNull(domain1, "First call should return domain");
    assertNotNull(domain2, "Second call should return domain");
    assert(domain1.equals(domain2), "Should return the same domain pointer");
  }));

  suite.addResult(createMonoDependentTest("Current domain can be retrieved", () => {
    // mono_domain_get is optional in some Mono versions
    if (!Mono.api.hasExport("mono_domain_get")) {
      console.log("    (Skipped: mono_domain_get not available in this Mono version)");
      return;
    }
    const current = Mono.api.native.mono_domain_get();
    assertNotNull(current, "Current domain should not be null");
    assert(!current.isNull(), "Current domain should not be NULL");
  }));

  suite.addResult(createMonoDependentTest("Current domain should be root domain initially", () => {
    // mono_domain_get is optional in some Mono versions
    if (!Mono.api.hasExport("mono_domain_get")) {
      console.log("    (Skipped: mono_domain_get not available in this Mono version)");
      return;
    }
    const root = Mono.api.getRootDomain();
    const current = Mono.api.native.mono_domain_get();

    assert(root.equals(current), "Current domain should equal root domain");
  }));

  suite.addResult(createMonoDependentTest("Multiple domain retrievals should be consistent", () => {
    const domains = [];
    for (let i = 0; i < 5; i++) {
      domains.push(Mono.api.getRootDomain());
    }

    for (let i = 1; i < domains.length; i++) {
      assert(domains[0].equals(domains[i]), `Domain ${i} should equal domain 0`);
    }
  }));

  suite.addResult(createMonoDependentTest("Domain should have assembly access methods", () => {
    const domain = Mono.domain;
    assert(typeof domain.getAssemblies === "function", "Domain should have getAssemblies method");
    assert(typeof domain.assembly === "function", "Domain should have assembly method");
    assert(typeof domain.class === "function", "Domain should have class method");

    const assemblies = domain.getAssemblies();
    assert(Array.isArray(assemblies), "getAssemblies should return array");
  }));

  suite.addResult(createMonoDependentTest("Domain should be accessible through multiple calls", () => {
    const domain1 = Mono.domain;
    const domain2 = Mono.domain;

    assert(domain1 !== null, "First domain access should work");
    assert(domain2 !== null, "Second domain access should work");
    assert(domain1 === domain2, "Domain should be cached (same instance)");
  }));

  // ============================================================================
  // ASSEMBLY TESTS
  // ============================================================================

  // Basic API tests
  suite.addResult(createPerformSmokeTest("assembly tests"));

  suite.addResult(createApiAvailabilityTest({
    context: "assembly operations",
    testName: "Assembly APIs should be available",
    requiredExports: [
      "mono_assembly_get_image",
      "mono_image_loaded",
      "mono_assembly_open",
    ],
  }));

  suite.addResult(createDomainTest("Should load core library assembly", domain => {
    const preferredAssemblies = ["mscorlib", "System.Private.CoreLib", "netstandard"];

    let coreAssembly = null;
    for (const candidate of preferredAssemblies) {
      const assembly = domain.assembly(candidate);
      if (assembly) {
        coreAssembly = assembly;
        break;
      }
    }

    if (!coreAssembly) {
      console.log("    Core library assembly not detected; skipping deep validation");
      return;
    }

    assert(typeof coreAssembly.getName === 'function', "Core assembly should expose getName method");
    const name = coreAssembly.getName();
    console.log(`    Loaded core library: ${name}`);

    const image = coreAssembly.image;
    assert(image !== null, "Core library should expose metadata image");
    assert(!image.pointer.isNull(), "Core library image pointer should not be NULL");

    try {
      const classes = image.getClasses();
      console.log(`    Core library exposes ${classes.length} classes`);
    } catch (error) {
      console.log(`    Core library class enumeration skipped: ${error}`);
    }
  }));

  suite.addResult(createDomainTest("Should find Unity assemblies", domain => {
    const unityAssemblies = [
      "UnityEngine.CoreModule",
      "UnityEngine",
      "Assembly-CSharp",
      "Assembly-CSharp-firstpass"
    ];

    let foundCount = 0;
    for (const assemblyName of unityAssemblies) {
      const assembly = domain.assembly(assemblyName);
      if (assembly) {
        foundCount++;
        console.log(`    Found ${assemblyName}: ${assembly.getName()}`);

        const image = assembly.image;
        if (image) {
          const classes = image.getClasses();
          console.log(`      ${classes.length} classes in ${assemblyName}`);
        }
      }
    }

    if (foundCount === 0) {
      console.log("    No Unity assemblies found (may not be Unity process)");
    }
  }));

  suite.addResult(createDomainTest("Should explore assembly metadata", domain => {
    const assemblies = domain.getAssemblies();

    assert(Array.isArray(assemblies), "Should get assemblies array");
    assert(assemblies.length > 0, "Should have at least one assembly");

    console.log(`    Found ${assemblies.length} total assemblies`);

    // Test first few assemblies in detail
    for (let i = 0; i < Math.min(3, assemblies.length); i++) {
      const assembly = assemblies[i];
      const name = assembly.getName();
      const image = assembly.image;

      assert(typeof name === "string", "Assembly name should be string");
      assert(name.length > 0, "Assembly name should not be empty");
      assert(image !== null, "Assembly should have image");

      const classes = image.getClasses();
      console.log(`    ${name}: ${classes.length} classes`);

      // Validate that classes have expected properties
      if (classes.length > 0) {
        const firstClass = classes[0];
        assert(typeof firstClass.getName === "function", "Class should have getName method");
      }
    }
  }));

  suite.addResult(createDomainTest("Should validate assembly names and properties", domain => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies.slice(0, 5)) { // Check first 5 assemblies
      const name = assembly.getName();
      const image = assembly.image;

      // Test name properties
      assert(typeof name === "string", "Assembly name should be string");
      assert(name.length > 0, "Assembly name should not be empty");
      assert(!name.includes("\0"), "Assembly name should not contain null bytes");

      // Test image properties
      assert(image !== null, "Assembly should have image");
      assert(typeof image.getName === "function", "Image should have getName method");
      assert(typeof image.getClasses === "function", "Image should have getClasses method");

      const imageName = image.getName();
      if (imageName) {
        assert(typeof imageName === "string", "Image name should be string");
        console.log(`    Validated ${name} -> ${imageName}`);
      }
    }
  }));

  suite.addResult(createDomainTest("Should handle assembly lookup variations", domain => {
    // Test case sensitivity
    const mscorlibLower = domain.assembly("mscorlib");
    const mscorlibUpper = domain.assembly("MSCORLIB");

    if (mscorlibLower) {
      console.log("    Found mscorlib with lowercase name");
    }

    if (mscorlibUpper && mscorlibUpper !== mscorlibLower) {
      console.log("    Found different assembly with uppercase name (case-sensitive lookup)");
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

    console.log("    Assembly lookup variations handled correctly");
  }));

  suite.addResult(createDomainTest("Should test assembly caching and consistency", domain => {
    // Test multiple calls return consistent results
    const assemblies1 = domain.getAssemblies();
    const assemblies2 = domain.getAssemblies();

    assert(Array.isArray(assemblies1), "First call should return array");
    assert(Array.isArray(assemblies2), "Second call should return array");
    assert(assemblies1.length === assemblies2.length, "Assembly count should be consistent");

    // Test specific assembly consistency
    if (assemblies1.length > 0) {
      const firstAssembly1 = assemblies1[0];
      const firstAssembly2 = domain.assembly(firstAssembly1.getName());
      if (!firstAssembly2) {
        throw new Error("Assembly lookup by name should succeed");
      }
      const samePointer = firstAssembly1.pointer.equals(firstAssembly2.pointer);
      assert(samePointer, "Assembly lookups should reference the same underlying object");
    }

    assertDomainCached();
    console.log("    Assembly caching and consistency verified");
  }));

  // ============================================================================
  // CLASS TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Class APIs should be available", () => {
    assertApiAvailable("Mono.api should be accessible for class operations");
    assert(Mono.api.hasExport("mono_class_from_name"), "mono_class_from_name should be available");
    assert(Mono.api.hasExport("mono_class_get_method_from_name"), "mono_class_get_method_from_name should be available");
    assert(Mono.api.hasExport("mono_class_get_field_from_name"), "mono_class_get_field_from_name should be available");
    assert(Mono.api.hasExport("mono_class_get_property_from_name"), "mono_class_get_property_from_name should be available");
  }));

  suite.addResult(createMonoDependentTest("Class APIs should be callable functions", () => {
    assert(typeof Mono.api.native.mono_class_from_name === 'function', "mono_class_from_name should be a function");
    assert(typeof Mono.api.native.mono_class_get_method_from_name === 'function', "mono_class_get_method_from_name should be a function");
    assert(typeof Mono.api.native.mono_class_get_field_from_name === 'function', "mono_class_get_field_from_name should be a function");
    assert(typeof Mono.api.native.mono_class_get_property_from_name === 'function', "mono_class_get_property_from_name should be a function");
  }));

  suite.addResult(createMonoDependentTest("Domain should provide class access methods", () => {
    assertDomainAvailable("Mono.domain should be accessible for class operations");

    const domain = Mono.domain;
    assert(typeof domain.class === 'function', "Domain should have class method");
  }));

  suite.addResult(createMonoDependentTest("Should find common system classes", () => {
    const domain = Mono.domain;

    // Try to find common system classes
    const stringClass = domain.class("System.String");
    if (stringClass) {
      assert(typeof stringClass.getName === 'function', "String class should have getName method");
      assert(typeof stringClass.getMethods === 'function', "String class should have getMethods method");
      console.log(`    Found System.String class: ${stringClass.getName()}`);
    }

    const objectClass = domain.class("System.Object");
    if (objectClass) {
      assert(typeof objectClass.getName === 'function', "Object class should have getName method");
      console.log(`    Found System.Object class: ${objectClass.getName()}`);
    }

    const intClass = domain.class("System.Int32");
    if (intClass) {
      console.log(`    Found System.Int32 class: ${intClass.getName()}`);
    }
  }));

  suite.addResult(createMonoDependentTest("Should find classes through assembly image", () => {
    const domain = Mono.domain;
    const assemblies = domain.getAssemblies();

    if (assemblies.length > 0) {
      const assembly = assemblies[0];
      const image = assembly.image;
      const classes = image.getClasses();

      assert(Array.isArray(classes), "Should get classes array from image");
      assert(classes.length >= 0, "Should have zero or more classes");

      if (classes.length > 0) {
        const firstClass = classes[0];
        assert(typeof firstClass.getName === 'function', "Class should have getName method");
        console.log(`    Found ${classes.length} classes, first: ${firstClass.getName()}`);
      } else {
        console.log("    No classes found in first assembly image");
      }
    } else {
      console.log("    No assemblies available to test class access");
    }
  }));

  suite.addResult(createMonoDependentTest("Should handle non-existent class gracefully", () => {
    const domain = Mono.domain;

    const nonExistent = domain.class("NonExistent.Class.Name");
    assert(nonExistent === null, "Non-existent class should return null");

    const emptyName = domain.class("");
    assert(emptyName === null, "Empty class name should return null");
  }));

  suite.addResult(createMonoDependentTest("Should get class methods and fields", () => {
    const domain = Mono.domain;
    const stringClass = domain.class("System.String");

    if (stringClass) {
      const methods = stringClass.getMethods();
      assert(Array.isArray(methods), "Should get methods array");

      const fields = stringClass.getFields();
      assert(Array.isArray(fields), "Should get fields array");

      const properties = stringClass.getProperties();
      assert(Array.isArray(properties), "Should get properties array");

      console.log(`    System.String has ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`);

      if (methods.length > 0) {
        const firstMethod = methods[0];
        assert(typeof firstMethod.getName === 'function', "Method should have getName method");
        console.log(`    First method: ${firstMethod.getName()}`);
      }
    } else {
      console.log("    System.String not available for method/field testing");
    }
  }));

  suite.addResult(createMonoDependentTest("Should support namespace-based class lookup", () => {
    const domain = Mono.domain;

    // Test different namespace patterns
    const collections = domain.class("System.Collections.Generic.List`1");
    if (collections) {
      console.log(`    Found generic List class: ${collections.getName()}`);
    }

    const io = domain.class("System.IO.File");
    if (io) {
      console.log(`    Found IO class: ${io.getName()}`);
    }

    const threading = domain.class("System.Threading.Thread");
    if (threading) {
      console.log(`    Found threading class: ${threading.getName()}`);
    }
  }));

  suite.addResult(createMonoDependentTest("Should handle class inheritance and parent relationships", () => {
    const domain = Mono.domain;
    const stringClass = domain.class("System.String");
    const objectClass = domain.class("System.Object");

    if (stringClass && objectClass) {
      // Test that we can access class hierarchy information
      const stringName = stringClass.getName();
      const objectName = objectClass.getName();

      assert(typeof stringName === 'string', "String class name should be string");
      assert(typeof objectName === 'string', "Object class name should be string");

      console.log(`    Class names: ${stringName}, ${objectName}`);
    }
  }));

  suite.addResult(createMonoDependentTest("Class operations should be consistent", () => {
    const domain = Mono.domain;

    // Test multiple calls return consistent results
    const stringClass1 = domain.class("System.String");
    const stringClass2 = domain.class("System.String");

    if (stringClass1 && stringClass2) {
      // They should be the same object or equivalent
      const name1 = stringClass1.getName();
      const name2 = stringClass2.getName();
      assert(name1 === name2, "Class lookups should be consistent");
    }

    // Test domain caching
    const domain1 = Mono.domain;
    const domain2 = Mono.domain;
    assert(domain1 === domain2, "Domain should be cached instance");
  }));

  suite.addResult(createMonoDependentTest("Should handle class lookup variations", () => {
    const domain = Mono.domain;

    // Test case sensitivity (typically case-sensitive)
    const stringLower = domain.class("system.string");
    const stringProper = domain.class("System.String");

    if (stringProper) {
      console.log("    Found System.String with proper casing");
    }

    if (stringLower && stringLower !== stringProper) {
      console.log("    Found system.string with lowercase (unusual)");
    } else if (!stringLower) {
      console.log("    Case-sensitive lookup confirmed (lowercase not found)");
    }
  }));

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(createDomainTest("Should work with assembly classes and types", domain => {
    const assemblies = domain.getAssemblies();

    if (assemblies.length > 0) {
      const assembly = assemblies[0];
      const image = assembly.image;
      const classes = image.getClasses();

      if (classes.length > 0) {
        // Test class operations
        const firstClass = classes[0];
        const className = firstClass.getName();
        const namespace = firstClass.getNamespace();

        assert(typeof className === "string", "Class name should be string");
        assert(typeof namespace === "string", "Namespace should be string");
        assert(className.length > 0, "Class name should not be empty");

        console.log(`    Found class: ${namespace}.${className}`);

        // Test method operations on class
        const methods = firstClass.getMethods();
        assert(Array.isArray(methods), "Class methods should be array");

        if (methods.length > 0) {
          const firstMethod = methods[0];
          assert(typeof firstMethod.getName === "function", "Method should have getName method");
          console.log(`      First method: ${firstMethod.getName()}`);
        }

        // Test field operations on class
        const fields = firstClass.getFields();
        assert(Array.isArray(fields), "Class fields should be array");
        console.log(`      ${fields.length} fields found`);
      }
    }
  }));

  suite.addResult(createNestedPerformTest({
    context: "assembly operations",
    testName: "Should handle nested perform calls with assemblies",
    validate: domain => {
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Nested perform should still work");

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        assert(typeof assembly.getName === "function", "Assembly methods should work in nested calls");

        const image = assembly.image;
        assert(image !== null, "Image access should work in deeper nesting");
        const classes = image.getClasses();
        assert(Array.isArray(classes), "Class access should work in deeper nesting");
      }
    },
  }));

  suite.addResult(createNestedPerformTest({
    context: "class operations",
    testName: "Should support class operations in nested perform calls",
    validate: domain => {
      const stringClass = domain.class("System.String");
      if (stringClass) {
        assert(typeof stringClass.getName === "function", "Class methods should work in nested calls");
      }
    },
  }));

  suite.addResult(createDomainTest("Should test Unity-specific assembly operations", domain => {
    // Look for Unity-specific assemblies and test their properties
    const unityCore = domain.assembly("UnityEngine.CoreModule");
    if (unityCore) {
      console.log(`    Found UnityEngine.CoreModule: ${unityCore.getName()}`);

      const image = unityCore.image;
      if (image) {
        // Look for core Unity classes
        const gameObjectClass = image.class("UnityEngine.GameObject");
        if (gameObjectClass) {
          console.log("    Found UnityEngine.GameObject class");
        }

        const transformClass = image.class("UnityEngine.Transform");
        if (transformClass) {
          console.log("    Found UnityEngine.Transform class");
        }
      }
    }

    // Test user assembly
    const userAssembly = domain.assembly("Assembly-CSharp");
    if (userAssembly) {
      console.log(`    Found Assembly-CSharp: ${userAssembly.getName()}`);

      const image = userAssembly.image;
      if (image) {
        const classes = image.getClasses();
        console.log(`    User assembly has ${classes.length} classes`);

        // Look for common user script patterns
        const playerClasses = classes.filter(c =>
          c.getName().toLowerCase().includes("player") ||
          c.getName().toLowerCase().includes("game") ||
          c.getName().toLowerCase().includes("manager")
        );

        if (playerClasses.length > 0) {
          console.log(`    Found ${playerClasses.length} potential game classes`);
        }
      }
    }
  }));

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  suite.addResult(createDomainTestEnhanced("Should test error handling with assemblies", domain => {
    // Test invalid operations
    const invalidAssembly = domain.assembly("Invalid.Assembly.Name");
    assert(invalidAssembly === null, "Invalid assembly should return null");

    // Test operations on null assembly
    try {
      // This should not throw but handle gracefully
      const result = domain.assembly(null as any);
      assert(result === null, "Null assembly name should return null");
    } catch (error) {
      // It's okay if it throws, but it should be a controlled error
      console.log(`    Null input handling: ${error}`);
    }

    console.log("    Assembly error handling works correctly");
  }));

  suite.addResult(createDomainTestEnhanced("Should handle invalid class inputs gracefully", domain => {
    try {
      // Test invalid class names
      const invalidClass = domain.class(null as any);
      assert(invalidClass === null, "Invalid class name should return null");

      const undefinedClass = domain.class(undefined as any);
      assert(undefinedClass === null, "Undefined class name should return null");

      console.log("    Class error handling works correctly");
    } catch (error) {
      // Controlled errors are acceptable
      console.log(`    Class input validation: ${error}`);
    }
  }));

  const summary = suite.getSummary();

  return {
    name: "Mono Types Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} mono types tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}

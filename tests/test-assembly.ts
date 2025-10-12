/**
 * Assembly Operations Tests
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable } from "./test-framework";

export function testAssemblyOperations(): TestResult {
  console.log("\nAssembly Operations:");

  const suite = new TestSuite("Assembly Tests");

  // Basic API tests
  suite.addResult(createTest("Mono.perform should work for assembly tests", () => {
    assertPerformWorks("Mono.perform() should work for assembly tests");
  }));

  suite.addResult(createTest("Assembly APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for assembly operations");
      assert(Mono.api.hasExport("mono_assembly_get_image"), "mono_assembly_get_image should be available");
      assert(Mono.api.hasExport("mono_image_loaded"), "mono_image_loaded should be available");
      assert(Mono.api.hasExport("mono_assembly_open"), "mono_assembly_open should be available");
    });
  }));

  // Test actual assembly loading and discovery
  suite.addResult(createTest("Should load core library assembly", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
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

      const image = coreAssembly.getImage();
      assert(image !== null, "Core library should expose metadata image");
      assert(!image.pointer.isNull(), "Core library image pointer should not be NULL");

      try {
        const classes = image.getClasses();
        console.log(`    Core library exposes ${classes.length} classes`);
      } catch (error) {
        console.log(`    Core library class enumeration skipped: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Should find Unity assemblies", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
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

          const image = assembly.getImage();
          if (image) {
            const classes = image.getClasses();
            console.log(`      ${classes.length} classes in ${assemblyName}`);
          }
        }
      }

      if (foundCount === 0) {
        console.log("    No Unity assemblies found (may not be Unity process)");
      }
    });
  }));

  suite.addResult(createTest("Should explore assembly metadata", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      assert(Array.isArray(assemblies), "Should get assemblies array");
      assert(assemblies.length > 0, "Should have at least one assembly");

      console.log(`    Found ${assemblies.length} total assemblies`);

      // Test first few assemblies in detail
      for (let i = 0; i < Math.min(3, assemblies.length); i++) {
        const assembly = assemblies[i];
        const name = assembly.getName();
        const image = assembly.getImage();

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
    });
  }));

  suite.addResult(createTest("Should validate assembly names and properties", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      for (const assembly of assemblies.slice(0, 5)) { // Check first 5 assemblies
        const name = assembly.getName();
        const image = assembly.getImage();

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
    });
  }));

  suite.addResult(createTest("Should handle assembly lookup variations", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

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
    });
  }));

  suite.addResult(createTest("Should test assembly caching and consistency", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

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

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");

      console.log("    Assembly caching and consistency verified");
    });
  }));

  suite.addResult(createTest("Should work with assembly classes and types", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.getImage();
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
    });
  }));

  suite.addResult(createTest("Should handle nested perform calls with assemblies", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test nested perform calls
      Mono.perform(() => {
        const assemblies = domain.getAssemblies();
        assert(Array.isArray(assemblies), "Nested perform should still work");

        if (assemblies.length > 0) {
          const assembly = assemblies[0];
          assert(typeof assembly.getName === "function", "Assembly methods should work in nested calls");

          // Test deeper nesting
          Mono.perform(() => {
            const image = assembly.getImage();
            assert(image !== null, "Image access should work in deeper nesting");
            const classes = image.getClasses();
            assert(Array.isArray(classes), "Class access should work in deeper nesting");
          });
        }
      });

      console.log("    Nested perform calls work correctly with assemblies");
    });
  }));

  suite.addResult(createTest("Should test error handling with assemblies", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

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
    });
  }));

  suite.addResult(createTest("Should test Unity-specific assembly operations", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Look for Unity-specific assemblies and test their properties
      const unityCore = domain.assembly("UnityEngine.CoreModule");
      if (unityCore) {
        console.log(`    Found UnityEngine.CoreModule: ${unityCore.getName()}`);

        const image = unityCore.getImage();
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

        const image = userAssembly.getImage();
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
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Assembly Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} assembly tests passed`,
  };
}
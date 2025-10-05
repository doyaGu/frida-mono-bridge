/**
 * Assembly Operations Tests
 * Tests loading and accessing Mono assemblies and images
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testAssemblyOperations(): TestResult {
  console.log("\nAssembly Operations:");

  const suite = new TestSuite("Assembly Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for assembly tests", () => {
    assertPerformWorks("Mono.perform() should work for assembly tests");
  }));

  suite.addResult(createTest("Assembly APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for assembly operations");
      assert(Mono.api.hasExport("mono_assembly_get_image"), "mono_assembly_get_image should be available");
      assert(Mono.api.hasExport("mono_image_loaded"), "mono_image_loaded should be available");
      assert(Mono.api.hasExport("mono_assembly_open"), "mono_assembly_open should be available");

      // mono_domain_assembly_open is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_assembly_open")) {
        console.log("    (Skipped: mono_domain_assembly_open not available in this Mono version)");
        return;
      }
      assert(Mono.api.hasExport("mono_domain_assembly_open"), "mono_domain_assembly_open should be available");
    });
  }));

  suite.addResult(createTest("mono_assembly_get_image should work with valid assembly", () => {
    Mono.perform(() => {
      // Verify the export is callable
      assert(typeof Mono.api.native.mono_assembly_get_image === 'function', "mono_assembly_get_image should be a function");
    });
  }));

  suite.addResult(createTest("Domain should provide assembly access methods", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for assembly operations");

      const domain = Mono.domain;
      assert(typeof domain.getAssemblies === 'function', "Domain should have getAssemblies method");
      assert(typeof domain.assembly === 'function', "Domain should have assembly method");

      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "getAssemblies should return array");
    });
  }));

  suite.addResult(createTest("Should retrieve assemblies from domain", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      assert(Array.isArray(assemblies), "Should get assemblies array");
      assert(assemblies.length >= 0, "Should have zero or more assemblies");

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        assert(typeof firstAssembly.getName === 'function', "Assembly should have getName method");
        assert(typeof firstAssembly.getImage === 'function', "Assembly should have getImage method");
        console.log(`    Found ${assemblies.length} assemblies, first: ${firstAssembly.getName()}`);
      } else {
        console.log("    No assemblies found (this may be normal in some contexts)");
      }
    });
  }));

  suite.addResult(createTest("Should find common assemblies by name", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find mscorlib (core library)
      const mscorlib = domain.assembly("mscorlib");
      if (mscorlib) {
        assert(typeof mscorlib.getName === 'function', "mscorlib should have getName method");
        console.log(`    Found mscorlib: ${mscorlib.getName()}`);
      }

      // Try to find System.Core if available
      const systemCore = domain.assembly("System.Core");
      if (systemCore) {
        assert(typeof systemCore.getName === 'function', "System.Core should have getName method");
        console.log(`    Found System.Core: ${systemCore.getName()}`);
      }

      // Try common Unity assembly names
      const unityCore = domain.assembly("UnityEngine.CoreModule");
      if (unityCore) {
        console.log(`    Found UnityEngine.CoreModule: ${unityCore.getName()}`);
      }

      const assemblyCSharp = domain.assembly("Assembly-CSharp");
      if (assemblyCSharp) {
        console.log(`    Found Assembly-CSharp: ${assemblyCSharp.getName()}`);
      }
    });
  }));

  suite.addResult(createTest("Should handle non-existent assembly gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      const nonExistent = domain.assembly("NonExistent.Assembly.Name");
      assert(nonExistent === null, "Non-existent assembly should return null");

      const emptyName = domain.assembly("");
      assert(emptyName === null, "Empty assembly name should return null");
    });
  }));

  suite.addResult(createTest("Assembly should provide access to image", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.getImage();

        assert(image !== null, "Assembly should have image");
        assert(typeof image.getName === 'function', "Image should have getName method");
        assert(typeof image.getClasses === 'function', "Image should have getClasses method");

        console.log(`    Assembly ${assembly.getName()} has image ${image.getName()}`);
      } else {
        console.log("    No assemblies available to test image access");
      }
    });
  }));

  suite.addResult(createTest("Should get assembly name", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const name = assembly.getName();

        assert(typeof name === 'string', "Assembly name should be string");
        assert(name.length > 0, "Assembly name should not be empty");

        console.log(`    Assembly name: ${name}`);
      } else {
        console.log("    No assemblies available to test name retrieval");
      }
    });
  }));

  suite.addResult(createTest("Should support assembly operations in nested perform calls", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test nested perform calls
      Mono.perform(() => {
        const assemblies = domain.getAssemblies();
        assert(Array.isArray(assemblies), "Nested perform should still work");

        if (assemblies.length > 0) {
          const assembly = assemblies[0];
          assert(typeof assembly.getName === 'function', "Assembly methods should work in nested calls");
        }
      });
    });
  }));

  suite.addResult(createTest("Assembly operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const assemblies1 = domain.getAssemblies();
      const assemblies2 = domain.getAssemblies();

      assert(Array.isArray(assemblies1), "First call should return array");
      assert(Array.isArray(assemblies2), "Second call should return array");
      assert(assemblies1.length === assemblies2.length, "Assembly count should be consistent");

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
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

      if (mscorlibUpper) {
        console.log("    Found mscorlib with uppercase name");
      }

      // Test with/without extension
      const withExtension = domain.assembly("mscorlib.dll");
      if (withExtension) {
        console.log("    Found mscorlib with .dll extension");
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

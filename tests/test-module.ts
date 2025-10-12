/**
 * Module Detection Tests
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertNotNull } from "./test-framework";

export function testModuleDetection(): TestResult {
  console.log("\nModule Detection:");

  const suite = new TestSuite("Module Detection Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for module detection tests", () => {
    assertPerformWorks("Mono.perform() should work for module detection tests");
  }));

  suite.addResult(createTest("Should access API for module operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for module operations");
      console.log("    API is accessible for module detection tests");
    });
  }));

  suite.addResult(createTest("Platformer executable should be loaded", () => {
    Mono.perform(() => {
      const modules = Process.enumerateModules();
      const hasPlatformer = modules.some(moduleInfo => moduleInfo.name.toLowerCase() === "platformer.exe");
      assert(hasPlatformer, "Platformer.exe must be loaded for Mono integration tests");
      console.log("    Platformer.exe detected in module list");
    });
  }));

  suite.addResult(createTest("Mono module should be detected", () => {
    Mono.perform(() => {
      assertNotNull(Mono.module, "Module should not be null");
      assertNotNull(Mono.module.name, "Module name should not be null");
      assertNotNull(Mono.module.base, "Module base should not be null");
      assert(Mono.module.size > 0, "Module size should be greater than 0");
      assertNotNull(Mono.module.path, "Module path should not be null");
      assert(!Mono.module.base.isNull(), "Module base should not be NULL pointer");

      console.log(`    Module detected: ${Mono.module.name}`);
      console.log(`    Base: ${Mono.module.base}`);
      console.log(`    Size: ${Mono.module.size}`);
      console.log(`    Path: ${Mono.module.path}`);
    });
  }));

  suite.addResult(createTest("Should test module name patterns", () => {
    Mono.perform(() => {
      const moduleName = Mono.module.name;
      assert(typeof moduleName === 'string', "Module name should be string");
      assert(moduleName.length > 0, "Module name should not be empty");

      // Common Mono module names
      const commonNames = ['mono', 'libmono', 'mono-2.0', 'monosgen', 'coreclr'];
      const isCommonName = commonNames.some(name => moduleName.toLowerCase().includes(name));

      if (isCommonName) {
        console.log(`    Module name matches common pattern: ${moduleName}`);
      } else {
        console.log(`    Module name (unusual): ${moduleName}`);
      }

      // Test that module name doesn't contain invalid characters
      const hasInvalidChars = /[<>:"|?*]/.test(moduleName);
      assert(!hasInvalidChars, "Module name should not contain invalid characters");
    });
  }));

  suite.addResult(createTest("Should test module base address validity", () => {
    Mono.perform(() => {
      const moduleBase = Mono.module.base;
      assert(typeof moduleBase === 'object', "Module base should be object");
      assert(!moduleBase.isNull(), "Module base should not be null pointer");

      // Test that base address is within a reasonable user-mode range
      const lowerBound = ptr("0x10000");
      assert(moduleBase.compare(lowerBound) > 0, "Module base should be above typical NULL page");

      if (Process.pointerSize === 4) {
        const upperBound = ptr("0x7FFFFFFF");
        assert(moduleBase.compare(upperBound) <= 0, "Module base should be in user space");
      } else {
        const upperBound = ptr("0x00007FFFFFFFFFFF");
        assert(moduleBase.compare(upperBound) <= 0, "Module base should be within canonical user address space");
      }

      console.log(`    Module base address: ${moduleBase}`);
    });
  }));

  suite.addResult(createTest("Should test module size validation", () => {
    Mono.perform(() => {
      const moduleSize = Mono.module.size;
      assert(typeof moduleSize === 'number', "Module size should be number");
      assert(moduleSize > 0, "Module size should be positive");
      assert(moduleSize < 0x10000000, "Module size should be reasonable (not >256MB)");

      console.log(`    Module size: ${moduleSize} bytes (${(moduleSize / 1024 / 1024).toFixed(2)} MB)`);
    });
  }));

  suite.addResult(createTest("Should test module path validity", () => {
    Mono.perform(() => {
      const modulePath = Mono.module.path;
      assert(typeof modulePath === 'string', "Module path should be string");
      assert(modulePath.length > 0, "Module path should not be empty");

      // Test that path looks valid
      const hasValidExtension = modulePath.toLowerCase().endsWith('.dll') ||
                               modulePath.toLowerCase().endsWith('.so') ||
                               modulePath.toLowerCase().endsWith('.dylib');

      if (hasValidExtension) {
        console.log(`    Module path has valid extension: ${modulePath}`);
      } else {
        console.log(`    Module path (no extension): ${modulePath}`);
      }

      // Test for common Mono module patterns
      const isMonoModule = modulePath.toLowerCase().includes('mono') ||
                          modulePath.toLowerCase().includes('coreclr');

      if (isMonoModule) {
        console.log(`    Path matches Mono runtime pattern`);
      }
    });
  }));

  suite.addResult(createTest("Should test module API integration", () => {
    Mono.perform(() => {
      const module = Mono.module;
      const api = Mono.api;

      // Test that module info integrates with API
      assert(module !== null, "Module should be accessible");
      assert(api !== null, "API should be accessible");

      // Test that we can use module information with API operations
      const hasBasicAPI = api.hasExport("mono_string_new");
      console.log(`    Module + API integration: string API available = ${hasBasicAPI}`);

      // Test that module base can be used for address calculations
      const moduleEnd = module.base.add(module.size);
      console.log(`    Module end address: 0x${moduleEnd.toUInt32().toString(16)}`);
    });
  }));

  suite.addResult(createTest("Should test module detection consistency", () => {
    Mono.perform(() => {
      // Test that module detection returns consistent results
      const module1 = Mono.module;
      const module2 = Mono.module;

      assert(module1 === module2, "Module should be cached instance");
      assert(module1.name === module2.name, "Module name should be consistent");
      assert(module1.base.equals(module2.base), "Module base should be consistent");
      assert(module1.size === module2.size, "Module size should be consistent");
      assert(module1.path === module2.path, "Module path should be consistent");

      console.log("    Module detection is consistent across calls");
    });
  }));

  suite.addResult(createTest("Should test module detection in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const module = Mono.module;
        assert(module !== null, "Module should be accessible in nested perform calls");
        assert(module.name.length > 0, "Module name should be accessible in nested context");

        console.log("    Module detection works in nested perform calls");
      });
    });
  }));

  suite.addResult(createTest("Should test module error handling", () => {
    Mono.perform(() => {
      // Test that module detection handles edge cases gracefully
      try {
        const module = Mono.module;

        // Test that module properties don't throw errors
        const name = module.name;
        const base = module.base;
        const size = module.size;
        const path = module.path;

        assert(typeof name === 'string', "Module name should be accessible");
        assert(typeof base === 'object', "Module base should be accessible");
        assert(typeof size === 'number', "Module size should be accessible");
        assert(typeof path === 'string', "Module path should be accessible");

        console.log("    Module error handling works correctly");
      } catch (error) {
        console.log(`    Module detection error: ${error}`);
        throw error;
      }
    });
  }));

  suite.addResult(createTest("Should test module metadata integration", () => {
    Mono.perform(() => {
      const module = Mono.module;
      const domain = Mono.domain;

      // Test that module information can be used with domain operations
      assert(module !== null, "Module should be accessible");
      assert(domain !== null, "Domain should be accessible");

      // Try to get assemblies to test integration
      const assemblies = domain.getAssemblies();
      console.log(`    Module + domain integration: ${assemblies.length} assemblies found`);

      // Test that module size is reasonable for the number of assemblies
      if (assemblies.length > 0) {
        const ratio = module.size / assemblies.length;
        console.log(`    Average module size per assembly: ${ratio.toFixed(0)} bytes`);
      }
    });
  }));

  suite.addResult(createTest("Should test module performance characteristics", () => {
    Mono.perform(() => {
      // Test performance of repeated module access
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const module = Mono.module;
        assert(module !== null, "Module should be accessible repeatedly");
        assert(module.name.length > 0, "Module name should be accessible repeatedly");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    100 module access operations took ${duration}ms`);
      assert(duration < 100, "Module access should be fast (cached)");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Module Detection Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} module detection tests passed`,
  };
}

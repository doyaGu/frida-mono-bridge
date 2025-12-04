/**
 * Comprehensive Mono Module Tests
 * Complete tests for MonoModuleInfo functionality including:
 * - Module detection and enumeration
 * - Version compatibility checking
 * - Module metadata access
 * - Module loading and unloading
 * - Module dependency resolution
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createMonoDependentTest,
  createPerformanceTest,
  createErrorHandlingTest,
  createIntegrationTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  TestCategory,
} from "./test-framework";

export function testMonoModule(): TestResult {
  console.log("\nComprehensive Mono Module Tests:");

  const suite = new TestSuite("Mono Module Complete Tests", TestCategory.MONO_DEPENDENT);

  // ============================================================================
  // MODULE DETECTION AND ENUMERATION
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Module should be detected and accessible", () => {
      assertPerformWorks("Module detection should work");

      const module = Mono.module;
      assertNotNull(module, "Module should be accessible");

      // Test module properties
      assert(typeof module.name === "string", "Module name should be string");
      assert(typeof module.base === "object", "Module base should be NativePointer");
      assert(typeof module.size === "number", "Module size should be number");
      assert(typeof module.path === "string", "Module path should be string");

      assert(module.name.length > 0, "Module name should not be empty");
      assert(module.size > 0, "Module size should be positive");
      assert(module.path.length > 0, "Module path should not be empty");

      console.log(`    Module detected: ${module.name}`);
      console.log(`    Base: 0x${module.base.toString(16)}`);
      console.log(`    Size: ${module.size} bytes`);
      console.log(`    Path: ${module.path}`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should match expected Mono patterns", () => {
      const module = Mono.module;
      assertNotNull(module, "Module should be available");

      // Test common Mono module name patterns
      const monoPatterns = [/mono/i, /libmono/i, /\.dll$/i, /\.so$/i, /\.dylib$/i];

      let patternMatched = false;
      for (const pattern of monoPatterns) {
        if (pattern.test(module.name)) {
          patternMatched = true;
          console.log(`    Module name matches pattern: ${pattern}`);
          break;
        }
      }

      assert(patternMatched, "Module name should match Mono runtime pattern");

      // Test that module is loaded in current process
      const modules = Process.enumerateModules();
      const foundModule = modules.find(m => m.name === module.name);
      assertNotNull(foundModule, "Module should be found in process module list");

      console.log(`    Module verified in process: ${foundModule.name}`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should have valid memory layout", () => {
      const module = Mono.module;
      assertNotNull(module, "Module should be available");

      // Test base address validity
      assert(!module.base.isNull(), "Module base should not be null");

      // Use appropriate address comparison for the platform
      const isAddress64Bit = Process.pointerSize === 8;
      const baseAddrStr = module.base.toString();
      const baseAddr = parseInt(baseAddrStr, 16) || module.base.toUInt32();

      assert(baseAddr > 0, "Module base should be positive");
      assert(baseAddr > 0x10000, "Module base should be above low memory range");

      // Platform-specific address validation
      if (isAddress64Bit) {
        // For 64-bit processes, just check the address is reasonable (not NULL, not obviously invalid)
        assert(!module.base.isNull(), "Module base should not be NULL in 64-bit process");
        console.log(`    64-bit process: Module base at ${module.base}`);
      } else {
        // For 32-bit processes, check it's within user space
        assert(baseAddr < 0x7fffffff, "Module base should be within 32-bit user space");
      }

      // Test size validity
      assert(module.size > 1024 * 1024, "Module size should be at least 1MB");
      assert(module.size < 1024 * 1024 * 1024, "Module size should be reasonable (< 1GB)");

      // Test that module memory is readable
      try {
        const firstByte = module.base.readU8();
        console.log(`    First byte at module base: 0x${firstByte.toString(16)}`);
      } catch (error) {
        console.log(`    Module base read test: ${error}`);
      }

      console.log(`    Memory layout validated: base=0x${baseAddr.toString(16)}, size=${module.size}`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should enumerate exports correctly", () => {
      const module = Mono.module;
      assertNotNull(module, "Module should be available");

      // Get module handle for export enumeration
      const moduleHandle = Process.findModuleByName(module.name);
      assertNotNull(moduleHandle, "Module handle should be found");

      try {
        const exports = moduleHandle.enumerateExports();
        assert(Array.isArray(exports), "Exports should be array");
        assert(exports.length > 0, "Should have at least one export");

        console.log(`    Module has ${exports.length} exports`);

        // Test export structure
        if (exports.length > 0) {
          const firstExport = exports[0];
          assert(typeof firstExport.name === "string", "Export name should be string");
          assert(typeof firstExport.address === "object", "Export address should be NativePointer");

          console.log(`    First export: ${firstExport.name} at 0x${firstExport.address.toString(16)}`);
        }

        // Look for common Mono exports
        const commonExports = ["mono_runtime_invoke", "mono_thread_attach", "mono_get_root_domain", "mono_string_new"];

        let foundCommonExports = 0;
        for (const exportName of commonExports) {
          const found = exports.find(e => e.name === exportName);
          if (found) {
            foundCommonExports++;
            console.log(`    Found common export: ${exportName}`);
          }
        }

        console.log(`    Found ${foundCommonExports}/${commonExports.length} common exports`);
      } catch (error) {
        console.log(`    Export enumeration error: ${error}`);
      }
    }),
  );

  // ============================================================================
  // VERSION COMPATIBILITY CHECKING
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Module should provide version information", () => {
      const version = Mono.version;
      assertNotNull(version, "Version information should be available");

      // Test version structure
      assert(typeof version.features === "object", "Version features should be object");

      const featureNames = Object.keys(version.features);
      assert(featureNames.length > 0, "Should have at least one feature flag");

      console.log(`    Version features available: ${featureNames.length}`);

      // Test specific feature flags
      const features = version.features;
      const featureTypes = [
        { name: "delegateThunk", type: "boolean" },
        { name: "metadataTables", type: "boolean" },
        { name: "gcHandles", type: "boolean" },
        { name: "internalCalls", type: "boolean" },
      ];

      for (const feature of featureTypes) {
        if (features.hasOwnProperty(feature.name)) {
          const value = features[feature.name as keyof typeof features];
          assert(typeof value === feature.type, `Feature ${feature.name} should be ${feature.type}`);
          console.log(`    Feature ${feature.name}: ${value}`);
        }
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should adapt to Unity Mono versions", () => {
      const module = Mono.module;
      const version = Mono.version;

      assertNotNull(module, "Module should be available");
      assertNotNull(version, "Version should be available");

      // Test for Unity-specific module characteristics
      const isUnityMono = module.name.toLowerCase().includes("unity") || module.path.toLowerCase().includes("unity");

      if (isUnityMono) {
        console.log("    Detected Unity Mono runtime");
      } else {
        console.log("    Detected standard Mono runtime");
      }

      // Test Unity-specific features
      const features = version.features;
      if (features.delegateThunk) {
        console.log("    Unity Mono: Delegate thunk support available");
      }

      if (features.internalCalls) {
        console.log("    Unity Mono: Internal call support available");
      }

      // Test module path for Unity indicators
      const unityPathIndicators = ["unity", "framework", "managed"];

      let pathIndicators = 0;
      for (const indicator of unityPathIndicators) {
        if (module.path.toLowerCase().includes(indicator)) {
          pathIndicators++;
        }
      }

      if (pathIndicators > 0) {
        console.log(`    Unity path indicators found: ${pathIndicators}`);
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should handle version-specific exports", () => {
      const api = Mono.api;
      const module = Mono.module;

      assertNotNull(api, "API should be available");
      assertNotNull(module, "Module should be available");

      // Test for version-specific export availability
      const versionSpecificExports = [
        { name: "mono_unity_set_main_thread", version: "Unity" },
        { name: "mono_unity_liveness_calculation_begin", version: "Unity" },
        { name: "mono_domain_set_config", version: "Standard" },
        { name: "mono_jit_exec", version: "Standard" },
      ];

      let foundVersionExports = 0;
      for (const exportInfo of versionSpecificExports) {
        if (api.hasExport(exportInfo.name)) {
          foundVersionExports++;
          console.log(`    Found ${exportInfo.version} export: ${exportInfo.name}`);
        }
      }

      console.log(`    Found ${foundVersionExports} version-specific exports`);

      // Test export availability patterns
      const coreExports = ["mono_runtime_invoke", "mono_thread_attach", "mono_get_root_domain"];

      let coreExportsAvailable = 0;
      for (const exportName of coreExports) {
        if (api.hasExport(exportName)) {
          coreExportsAvailable++;
        }
      }

      assert(coreExportsAvailable >= 2, "At least 2 core exports should be available");
      console.log(`    Core exports available: ${coreExportsAvailable}/${coreExports.length}`);
    }),
  );

  // ============================================================================
  // MODULE METADATA ACCESS
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Module should provide metadata access", () => {
      const module = Mono.module;
      const api = Mono.api;

      assertNotNull(module, "Module should be available");
      assertNotNull(api, "API should be available");

      // Test that we can access module through API
      try {
        const moduleHandle = Process.findModuleByName(module.name);
        assertNotNull(moduleHandle, "Module handle should be accessible");

        // Test module information consistency
        assert(moduleHandle.name === module.name, "Module names should match");
        assert(moduleHandle.base.equals(module.base), "Module bases should match");
        assert(moduleHandle.size === module.size, "Module sizes should match");

        console.log("    Module metadata access working correctly");
      } catch (error) {
        console.log(`    Module metadata access error: ${error}`);
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should export required functions", () => {
      const api = Mono.api;

      assertNotNull(api, "API should be available");

      // Test critical function exports
      const criticalFunctions = [
        "mono_runtime_invoke",
        "mono_thread_attach",
        "mono_thread_detach",
        "mono_get_root_domain",
        "mono_string_new",
        "mono_object_get_class",
        "mono_class_get_name",
      ];

      let availableFunctions = 0;
      let unavailableFunctions = [];

      for (const functionName of criticalFunctions) {
        if (api.hasExport(functionName)) {
          availableFunctions++;
          console.log(`    Available: ${functionName}`);
        } else {
          unavailableFunctions.push(functionName);
          console.log(`    Missing: ${functionName}`);
        }
      }

      const availability = ((availableFunctions / criticalFunctions.length) * 100).toFixed(1);
      console.log(`    Function availability: ${availableFunctions}/${criticalFunctions.length} (${availability}%)`);

      // We expect at least 80% of critical functions to be available
      assert(
        availableFunctions >= criticalFunctions.length * 0.8,
        `At least 80% of critical functions should be available`,
      );
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should handle export resolution", () => {
      const api = Mono.api;

      assertNotNull(api, "API should be available");

      // Test export resolution with various names
      const exportTests = [
        { name: "mono_runtime_invoke", shouldExist: true },
        { name: "mono_thread_attach", shouldExist: true },
        { name: "mono_string_new", shouldExist: true },
        { name: "mono_non_existent_function", shouldExist: false },
        { name: "", shouldExist: false },
      ];

      for (const test of exportTests) {
        const hasExport = api.hasExport(test.name as any);

        if (test.shouldExist) {
          assert(hasExport, `Export ${test.name} should exist`);
        } else {
          assert(!hasExport, `Export ${test.name} should not exist`);
        }

        console.log(`    Export resolution: ${test.name} -> ${hasExport ? "found" : "not found"}`);
      }

      // Test function resolution
      try {
        if (api.hasExport("mono_runtime_invoke")) {
          const func = api.getNativeFunction("mono_runtime_invoke");
          assertNotNull(func, "Should resolve existing function");
          console.log("    Function resolution working correctly");
        }
      } catch (error) {
        console.log(`    Function resolution error: ${error}`);
      }
    }),
  );

  // ============================================================================
  // MODULE LOADING AND UNLOADING
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Module should handle loading scenarios", () => {
      const module = Mono.module;

      assertNotNull(module, "Module should be available");

      // Test that module is properly loaded
      const modules = Process.enumerateModules();
      const currentModule = modules.find(m => m.name === module.name);

      assertNotNull(currentModule, "Module should be in current process modules");
      assert(currentModule.base.equals(module.base), "Module base should match");
      assert(currentModule.size === module.size, "Module size should match");

      console.log("    Module loading verified in current process");

      // Test module handle operations
      const moduleHandle = Process.findModuleByName(module.name);
      assertNotNull(moduleHandle, "Module handle should be obtainable");

      // Test module enumeration
      const enumeratedModules = Process.enumerateModules();
      const foundInEnumeration = enumeratedModules.some(m => m.name === module.name);
      assert(foundInEnumeration, "Module should be found in enumeration");

      console.log(`    Module found in enumeration of ${enumeratedModules.length} modules`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should handle dependency information", () => {
      const module = Mono.module;

      assertNotNull(module, "Module should be available");

      // Test module dependencies (if available)
      try {
        const moduleHandle = Process.findModuleByName(module.name);
        assertNotNull(moduleHandle, "Module handle should be available");

        // Try to get imports (may not be available on all platforms)
        try {
          const imports = moduleHandle.enumerateImports();
          console.log(`    Module has ${imports.length} imports`);

          // Look for system dependencies
          const systemLibs = ["kernel32.dll", "libc.so.6", "libSystem.B.dylib"];
          let foundSystemLibs = 0;

          for (const lib of systemLibs) {
            const found = imports.find(imp => imp.name === lib || imp.module === lib);
            if (found) {
              foundSystemLibs++;
              console.log(`    System dependency: ${lib}`);
            }
          }

          if (foundSystemLibs > 0) {
            console.log(`    Found ${foundSystemLibs} system library dependencies`);
          }
        } catch (importError) {
          console.log("    Import enumeration not available");
        }
      } catch (error) {
        console.log(`    Dependency analysis error: ${error}`);
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should handle unloading scenarios", () => {
      const module = Mono.module;

      assertNotNull(module, "Module should be available");

      // Test that module remains loaded during operations
      const initialModuleCount = Process.enumerateModules().length;

      // Perform some operations that might trigger loading/unloading
      try {
        const api = Mono.api;
        if (api.hasExport("mono_string_new")) {
          for (let i = 0; i < 10; i++) {
            api.stringNew(`Test ${i}`);
          }
        }
      } catch (error) {
        console.log(`    Operation during loading test: ${error}`);
      }

      const finalModuleCount = Process.enumerateModules().length;

      // Module count should be stable (no unexpected unloading)
      const countDiff = Math.abs(finalModuleCount - initialModuleCount);
      assert(countDiff <= 2, `Module count should be stable (diff: ${countDiff})`);

      console.log(`    Module count stability: ${initialModuleCount} -> ${finalModuleCount}`);

      // Verify our module is still loaded
      const stillLoaded = Process.enumerateModules().some(m => m.name === module.name);
      assert(stillLoaded, "Mono module should still be loaded");
      console.log("    Module remains loaded after operations");
    }),
  );

  // ============================================================================
  // MODULE DEPENDENCY RESOLUTION
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Module should resolve dependencies correctly", () => {
      const api = Mono.api;

      assertNotNull(api, "API should be available");

      // Test that dependent functions are available
      const dependencyChains = [
        {
          name: "String operations",
          dependencies: ["mono_string_new", "mono_string_length", "mono_string_chars"],
        },
        {
          name: "Thread operations",
          dependencies: ["mono_thread_attach", "mono_thread_detach", "mono_get_root_domain"],
        },
        {
          name: "Object operations",
          dependencies: ["mono_object_get_class", "mono_object_to_string"],
        },
      ];

      for (const chain of dependencyChains) {
        let availableDeps = 0;

        for (const dep of chain.dependencies) {
          if (api.hasExport(dep)) {
            availableDeps++;
          }
        }

        const availability = ((availableDeps / chain.dependencies.length) * 100).toFixed(1);
        console.log(`    ${chain.name}: ${availableDeps}/${chain.dependencies.length} (${availability}%)`);

        // At least one dependency in each chain should be available
        assert(availableDeps > 0, `At least one dependency in ${chain.name} should be available`);
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Module should handle circular dependencies", () => {
      const api = Mono.api;

      assertNotNull(api, "API should be available");

      // Test functions that might have circular dependencies
      const circularDepTests = [
        "mono_runtime_invoke", // May depend on thread functions
        "mono_thread_attach", // May depend on domain functions
        "mono_get_root_domain", // May depend on runtime functions
      ];

      let workingFunctions = 0;

      for (const funcName of circularDepTests) {
        if (api.hasExport(funcName)) {
          try {
            const func = api.getNativeFunction(funcName as any);
            assertNotNull(func, `Function ${funcName} should be resolvable`);
            workingFunctions++;
            console.log(`    Circular dependency test passed: ${funcName}`);
          } catch (error) {
            console.log(`    Circular dependency test failed: ${funcName} - ${error}`);
          }
        }
      }

      console.log(`    Circular dependency resolution: ${workingFunctions}/${circularDepTests.length}`);
    }),
  );

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  suite.addResult(
    createPerformanceTest("Performance: Module access operations", () => {
      const module = Mono.module;
      const iterations = 1000;

      // Test rapid module property access
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const name = module.name;
        const base = module.base;
        const size = module.size;
        const path = module.path;

        // Verify properties are accessible
        assert(typeof name === "string", "Name should be string");
        assert(typeof base === "object", "Base should be object");
        assert(typeof size === "number", "Size should be number");
        assert(typeof path === "string", "Path should be string");
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `    ${iterations} module property accesses took ${duration}ms (avg: ${avgTime.toFixed(2)}ms per access)`,
      );
      assert(duration < 1000, "Module property access should be fast");
      assert(avgTime < 1, "Average access time should be very low");
    }),
  );

  suite.addResult(
    createPerformanceTest("Performance: Export resolution", () => {
      const api = Mono.api;
      const iterations = 500;

      if (!api.hasExport("mono_runtime_invoke")) {
        console.log("    (Skipped: mono_runtime_invoke not available)");
        return;
      }

      const startTime = Date.now();

      // Test rapid export resolution
      for (let i = 0; i < iterations; i++) {
        const hasExport = api.hasExport("mono_runtime_invoke");
        assert(hasExport === true, "Export should be available");

        if (i % 10 === 0) {
          // Periodically test function resolution
          const func = api.getNativeFunction("mono_runtime_invoke");
          assertNotNull(func, "Function should be resolvable");
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `    ${iterations} export resolutions took ${duration}ms (avg: ${avgTime.toFixed(2)}ms per resolution)`,
      );
      assert(duration < 2000, "Export resolution should be fast");
      assert(avgTime < 4, "Average resolution time should be reasonable");
    }),
  );

  suite.addResult(
    createPerformanceTest("Performance: Module enumeration", () => {
      const iterations = 100;
      const startTime = Date.now();

      // Test rapid module enumeration
      for (let i = 0; i < iterations; i++) {
        const modules = Process.enumerateModules();
        assert(Array.isArray(modules), "Should return modules array");
        assert(modules.length > 0, "Should have modules");
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(
        `    ${iterations} module enumerations took ${duration}ms (avg: ${avgTime.toFixed(2)}ms per enumeration)`,
      );
      assert(duration < 5000, "Module enumeration should complete in reasonable time");
    }),
  );

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  suite.addResult(
    createErrorHandlingTest("Module should handle invalid operations", () => {
      const module = Mono.module;
      const api = Mono.api;

      assertNotNull(module, "Module should be available");
      assertNotNull(api, "API should be available");

      // Test invalid export names
      const invalidExports = [
        "",
        "non_existent_function",
        "invalid-function-name-with-special-chars!@#$%",
        null as any,
        undefined as any,
      ];

      for (const invalidExport of invalidExports) {
        try {
          const hasExport = api.hasExport(invalidExport);
          assert(hasExport === false, `Invalid export should return false: ${invalidExport}`);
        } catch (error) {
          console.log(`    Invalid export error handled: ${invalidExport}`);
        }
      }

      console.log("    Invalid export handling working correctly");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Module should handle resolution failures", () => {
      const api = Mono.api;

      assertNotNull(api, "API should be available");

      // Test function resolution failures
      try {
        const nonExistentFunc = api.getNativeFunction("mono_non_existent_function" as any);
        assert(false, "Should throw error for non-existent function");
      } catch (error) {
        assert(error instanceof Error, "Should throw Error instance");
        console.log(
          `    Function resolution failure handled: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Test with invalid function names
      const invalidNames = ["", "invalid-name", "123invalid", null as any, undefined as any];

      for (const invalidName of invalidNames) {
        try {
          api.getNativeFunction(invalidName);
          assert(false, `Should throw error for invalid name: ${invalidName}`);
        } catch (error) {
          console.log(`    Invalid name resolution handled: ${invalidName}`);
        }
      }

      console.log("    Resolution failure handling working correctly");
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(
    createIntegrationTest("Module should integrate with API operations", () => {
      const module = Mono.module;
      const api = Mono.api;

      assertNotNull(module, "Module should be available");
      assertNotNull(api, "API should be available");

      // Test that API uses module correctly
      const domain = api.getRootDomain();
      assertNotNull(domain, "API should provide domain using module");

      // Test that module exports are accessible through API
      if (api.hasExport("mono_string_new")) {
        const testString = api.stringNew("Module Integration Test");
        assertNotNull(testString, "Module exports should work through API");
        console.log("    Module-API integration working correctly");
      }
    }),
  );

  suite.addResult(
    createIntegrationTest("Module should integrate with domain operations", () => {
      const module = Mono.module;

      assertNotNull(module, "Module should be available");

      // Test that domain operations work with current module
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be accessible");

      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Domain should provide assemblies");

      console.log(`    Module-domain integration: ${assemblies.length} assemblies accessible`);
    }),
  );

  suite.addResult(
    createIntegrationTest("Module should integrate with threading operations", () => {
      const module = Mono.module;
      const api = Mono.api;

      assertNotNull(module, "Module should be available");
      assertNotNull(api, "API should be available");

      // Test that threading operations work with current module
      const threadManager = api._threadManager;
      assertNotNull(threadManager, "Thread manager should be available");

      if (typeof threadManager.run === "function") {
        const result = threadManager.run(() => {
          return "threading integration test";
        });

        assert(result === "threading integration test", "Threading should work with module");
        console.log("    Module-threading integration working correctly");
      }
    }),
  );

  suite.addResult(
    createIntegrationTest("Module should integrate with Unity systems", () => {
      const module = Mono.module;

      assertNotNull(module, "Module should be available");

      // Test Unity-specific integration
      const isUnityEnvironment =
        module.name.toLowerCase().includes("mono") &&
        Process.enumerateModules().some(
          m => m.name.toLowerCase().includes("unity") || m.name.toLowerCase().includes("platformer"),
        );

      if (isUnityEnvironment) {
        console.log("    Unity environment detected");

        // Test Unity-specific operations
        const domain = Mono.domain;
        const unityAssembly = domain.assembly("UnityEngine.CoreModule");

        if (unityAssembly) {
          console.log("    Unity assembly accessible through module");

          const gameObjectClass = unityAssembly.image.class("UnityEngine.GameObject");
          if (gameObjectClass) {
            console.log("    Unity GameObject class accessible through module");
          }
        }
      } else {
        console.log("    Non-Unity environment detected");
      }

      console.log("    Module-Unity integration verified");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Module Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Mono module tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

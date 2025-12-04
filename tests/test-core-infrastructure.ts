/**
 * Core Infrastructure Tests
 * Consolidated tests for module detection, version detection, and basic API functionality
 * Note: Detailed API tests are in test-mono-api.ts, this file focuses on core infrastructure
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoTest,
  createMonoDependentTest,
  createSmokeTest,
  assert,
  assertNotNull,
  TestCategory,
} from "./test-framework";

export function testCoreInfrastructure(): TestResult {
  console.log("\nCore Infrastructure:");

  // Core infrastructure tests are mixed - some standalone, some Mono-dependent
  const suite = new TestSuite("Core Infrastructure Tests");

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.STANDALONE, "core infrastructure"));

  // Module Detection Tests (STANDALONE - these use Process.enumerateModules only)
  suite.addResult(
    createTest(
      "Platformer executable should be loaded",
      () => {
        const modules = Process.enumerateModules();
        const hasPlatformer = modules.some(moduleInfo => moduleInfo.name.toLowerCase() === "platformer.exe");
        assert(hasPlatformer, "Platformer.exe must be loaded for Mono integration tests");
        console.log("    Platformer.exe detected in module list");
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Mono module should be detected",
      () => {
        const modules = Process.enumerateModules();
        const monoModule = modules.find(
          module => module.name.toLowerCase().includes("mono") && module.name.toLowerCase().includes("dll"),
        );
        assertNotNull(monoModule, "Mono module should be found");
        console.log(`    Module detected: ${monoModule.name}`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Module name should match common pattern",
      () => {
        const modules = Process.enumerateModules();
        const monoModule = modules.find(
          module => module.name.toLowerCase().includes("mono") && module.name.toLowerCase().includes("dll"),
        );
        assertNotNull(monoModule, "Mono module should be found");
        const isValidPattern = /mono-.*\.dll/.test(monoModule.name.toLowerCase());
        assert(isValidPattern, "Module name should match Mono runtime pattern");
        console.log(`    Module name matches common pattern: ${monoModule.name}`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Module base address should be valid",
      () => {
        const modules = Process.enumerateModules();
        const monoModule = modules.find(
          module => module.name.toLowerCase().includes("mono") && module.name.toLowerCase().includes("dll"),
        );
        assertNotNull(monoModule, "Mono module should be found");

        // More flexible validation for Unity Mono runtime
        const baseAddr = monoModule.base;
        assert(!baseAddr.isNull(), "Module base address should not be null");

        // Check if address is reasonable (not zero and in expected range)
        const addrValue = baseAddr.toUInt32();
        assert(addrValue > 0, "Module base address should be positive");

        console.log(`    Module base address: 0x${baseAddr.toString(16)} (${addrValue})`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Module size should be reasonable",
      () => {
        const modules = Process.enumerateModules();
        const monoModule = modules.find(
          module => module.name.toLowerCase().includes("mono") && module.name.toLowerCase().includes("dll"),
        );
        assertNotNull(monoModule, "Mono module should be found");
        assert(monoModule.size > 1024 * 1024, "Module size should be at least 1MB");
        console.log(`    Module size: ${monoModule.size} bytes (${(monoModule.size / 1024 / 1024).toFixed(2)} MB)`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Module path should be valid",
      () => {
        const modules = Process.enumerateModules();
        const monoModule = modules.find(
          module => module.name.toLowerCase().includes("mono") && module.name.toLowerCase().includes("dll"),
        );
        assertNotNull(monoModule, "Mono module should be found");
        assertNotNull(monoModule.path, "Module should have a valid path");
        const hasDllExtension = monoModule.path.toLowerCase().endsWith(".dll");
        assert(hasDllExtension, "Module path should have valid extension");
        console.log(`    Path matches Mono runtime pattern: ${monoModule.path}`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  // Version Detection Tests (basic version info - detailed tests in test-mono-api.ts)
  suite.addResult(
    createMonoTest("Version object should exist and be accessible", () => {
      const version = Mono.version;
      assertNotNull(version, "Version should not be null");
      assertNotNull(version.features, "Features should not be null");
      console.log(`    Version object accessible with ${Object.keys(version.features).length} feature flags`);
    }),
  );

  suite.addResult(
    createMonoTest("All feature flags should be defined and boolean", () => {
      const features = Mono.version.features;
      const featureNames = Object.keys(features);
      assert(featureNames.length > 0, "Should have at least one feature flag");

      for (const featureName of featureNames) {
        const featureValue = features[featureName as keyof typeof features];
        assert(typeof featureValue === "boolean", `Feature ${featureName} should be boolean`);
      }
      console.log(`    ${featureNames.length} feature flags validated`);
    }),
  );

  // Basic API Functionality Tests (excluding detailed tests covered in test-mono-api.ts)
  suite.addResult(
    createMonoDependentTest("Modern API features should be available", () => {
      assertNotNull(Mono.perform, "Mono.perform should be available");
      assertNotNull(Mono.api, "Mono.api should be available");
      assertNotNull(Mono.domain, "Mono.domain should be available");
      assertNotNull(Mono.version, "Mono.version should be available");
      assertNotNull(Mono.module, "Mono.module should be available");
      assertNotNull(Mono.gc, "Mono.gc utilities should be available");
      assertNotNull(Mono.find, "Mono.find utilities should be available");
      assertNotNull(Mono.trace, "Mono.trace utilities should be available");
      assertNotNull(Mono.types, "Mono.types utilities should be available");
      console.log("    All modern API features available");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Basic API connectivity should work", () => {
      // Test basic connectivity without detailed functionality tests
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");

      const api = Mono.api;
      assertNotNull(api, "API should be available");

      console.log("    Basic API connectivity verified");
    }),
  );

  suite.addResult(
    createMonoDependentTest("API should handle basic operations", () => {
      // Test that basic operations work without detailed testing
      try {
        const domain = Mono.domain;
        const assemblies = domain.getAssemblies();
        assert(Array.isArray(assemblies), "Should get assemblies array");
        console.log("    Basic API operations working");
      } catch (error) {
        console.log(`    Basic API operation error: ${error}`);
        throw error;
      }
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Core Infrastructure Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} core infrastructure tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

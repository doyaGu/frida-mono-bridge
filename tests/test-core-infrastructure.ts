/**
 * Core Infrastructure Tests
 * Consolidated tests for module detection, version detection, and basic API functionality
 * Note: Detailed API tests are in test-mono-api.ts, this file focuses on core infrastructure
 *
 * V2 Migration: All tests now async, using property-based API
 */

import Mono from "../src";
import {
  assert,
  assertNotNull,
  createMonoDependentTest,
  createSmokeTest,
  createTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

export async function createCoreInfrastructureTests(): Promise<TestResult> {
  console.log("\nCore Infrastructure:");

  // Core infrastructure tests are mixed - some standalone, some Mono-dependent
  const suite = new TestSuite("Core Infrastructure Tests");

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.STANDALONE, "core infrastructure"));

  // Helper function to detect Mono module across platforms
  const findMonoModule = () => {
    const modules = Process.enumerateModules();
    return modules.find(module => {
      const name = module.name.toLowerCase();
      // Check for Mono module with platform-appropriate extension
      return name.includes("mono") && (name.endsWith(".dll") || name.endsWith(".dylib") || name.endsWith(".so"));
    });
  };

  suite.addResult(
    createTest(
      "Mono module should be detected",
      () => {
        const monoModule = findMonoModule();
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
        const monoModule = findMonoModule();
        assertNotNull(monoModule, "Mono module should be found");
        // Cross-platform pattern: mono*.dll, libmono*.dylib, libmono*.so
        const isValidPattern =
          /mono.*\.(dll|dylib|so)$/.test(monoModule.name.toLowerCase()) ||
          /libmono.*\.(dll|dylib|so)$/.test(monoModule.name.toLowerCase());
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
        const monoModule = findMonoModule();
        assertNotNull(monoModule, "Mono module should be found");

        // More flexible validation for Unity Mono runtime
        const baseAddr = monoModule.base;
        assert(!baseAddr.isNull(), "Module base address should not be null");

        console.log(`    Module base address: ${baseAddr}`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  suite.addResult(
    createTest(
      "Module size should be reasonable",
      () => {
        const monoModule = findMonoModule();
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
        const monoModule = findMonoModule();
        assertNotNull(monoModule, "Mono module should be found");
        assertNotNull(monoModule.path, "Module should have a valid path");
        const pathLower = monoModule.path.toLowerCase();
        const hasValidExtension =
          pathLower.endsWith(".dll") || pathLower.endsWith(".dylib") || pathLower.endsWith(".so");
        assert(hasValidExtension, "Module path should have valid extension");
        console.log(`    Path matches Mono runtime pattern: ${monoModule.path}`);
      },
      { category: TestCategory.STANDALONE, requiresMono: false },
    ),
  );

  // Version Detection Tests (basic version info - detailed tests in test-mono-api.ts)
  await suite.addResultAsync(
    createMonoDependentTest("Version object should exist and be accessible", () => {
      const version = Mono.version;
      assertNotNull(version, "Version should not be null");
      assertNotNull(version.features, "Features should not be null");
      console.log(`    Version object accessible with ${Object.keys(version.features).length} feature flags`);
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("All feature flags should be defined and boolean", () => {
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
  // V2: Use addResultAsync for async tests
  await suite.addResultAsync(
    createMonoDependentTest("Modern API features should be available", () => {
      assertNotNull(Mono.perform, "Mono.perform should be available");
      assertNotNull(Mono.api, "Mono.api should be available");
      assertNotNull(Mono.domain, "Mono.domain should be available");
      assertNotNull(Mono.version, "Mono.version should be available");
      assertNotNull(Mono.module, "Mono.module should be available");
      assertNotNull(Mono.gc, "Mono.gc utilities should be available");
      assertNotNull(Mono.trace, "Mono.trace utilities should be available");
      console.log("    All modern API features available");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("Basic API connectivity should work", () => {
      // Test basic connectivity without detailed functionality tests
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");

      const api = Mono.api;
      assertNotNull(api, "API should be available");

      console.log("    Basic API connectivity verified");
    }),
  );

  await suite.addResultAsync(
    createMonoDependentTest("API should handle basic operations", () => {
      // Test that basic operations work without detailed testing
      // V2: Use property-based API (assemblies instead of getAssemblies)
      try {
        const domain = Mono.domain;
        const assemblies = domain.assemblies;
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

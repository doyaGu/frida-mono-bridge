/**
 * Test Suite Index
 * Orchestrates all test modules and provides a unified test runner
 * 
 * Test Categories:
 * - Core Infrastructure: Basic module setup and Mono detection
 * - Type System: MonoClass, MonoMethod, MonoField, MonoProperty
 * - Runtime Objects: MonoString, MonoArray, MonoDelegate, MonoObject
 * - Domain & Assembly: MonoDomain, MonoAssembly, MonoImage
 * - Advanced Features: GC Tools, Trace Tools, Find Tools, Generic Types
 * - Unity Integration: GameObject, Components, Engine Modules
 */

// Import test setup files
import "./test-common";
import "./test-utilities";

// ============================================================================
// CATEGORY 1: Core Infrastructure Tests
// ============================================================================
import { testCoreInfrastructure } from "./test-core-infrastructure";
import { testMonoTypes } from "./test-mono-types";
import { testMonoMembers } from "./test-mono-members";
import { testDataOperations } from "./test-data-operations";
import { testIntegration } from "./test-integration";
import { testSupporting } from "./test-supporting";

// ============================================================================
// CATEGORY 2: Utility Tests (STANDALONE - No Mono dependency)
// ============================================================================
import { testMonoUtils } from "./test-mono-utils";
import { testMonoErrorHandling } from "./test-mono-error-handling";

// ============================================================================
// CATEGORY 3: Type System Tests (MONO_DEPENDENT)
// ============================================================================
import { createMonoClassTests } from "./test-mono-class";
import { createMonoMethodTests } from "./test-mono-method";
import { createMonoFieldTests } from "./test-mono-field";
import { createMonoPropertyTests } from "./test-mono-property";
import { createGenericTypeTests } from "./test-generic-types";

// ============================================================================
// CATEGORY 4: Runtime Object Tests (MONO_DEPENDENT)
// ============================================================================
import { createMonoStringTests } from "./test-mono-string";
import { createMonoArrayTests } from "./test-mono-array";
import { createMonoDelegateTests } from "./test-mono-delegate";
import { createMonoObjectTests } from "./test-mono-object";
import { testMonoData } from "./test-mono-data";

// ============================================================================
// CATEGORY 5: Domain & Assembly Tests (MONO_DEPENDENT)
// ============================================================================
import { testMonoApi } from "./test-mono-api";
import { testMonoDomain } from "./test-mono-domain";
import { testMonoThreading } from "./test-mono-threading";
import { testMonoModule } from "./test-mono-module";
import { createMonoAssemblyTests } from "./test-mono-assembly";
import { createMonoImageTests } from "./test-mono-image";
import { createRuntimeApiTests } from "./test-runtime-api";

// ============================================================================
// CATEGORY 6: Advanced Feature Tests (MONO_DEPENDENT)
// ============================================================================
import { createFindToolTests } from "./test-find-tools";
import { createTraceToolsTests } from "./test-trace-tools";
import { createGCToolsTests } from "./test-gc-tools";

// ============================================================================
// CATEGORY 7: Unity Integration Tests (MONO_DEPENDENT)
// ============================================================================
import { testUnityGameObject } from "./test-unity-gameobject";
import { testUnityComponents } from "./test-unity-components";
import { testUnityEngineModules } from "./test-unity-engine-modules";

import { TestSummary, TestSuite } from "./test-framework";

export interface TestSuiteConfig {
  skipSlowTests?: boolean;
  skipAdvancedTests?: boolean;
  skipUnityTests?: boolean;
  skipPerformanceTests?: boolean;
  verbose?: boolean;
  stopOnFirstFailure?: boolean;
  categories?: string[];
}

function logHeader(title: string): void {
  const line = "=".repeat(Math.max(title.length + 8, 48));
  console.log(line);
  const paddedTitle = `== ${title} ==`;
  const padding = Math.max((line.length - paddedTitle.length) / 2, 0);
  console.log(`${" ".repeat(Math.floor(padding))}${paddedTitle}`);
  console.log(line);
}

function logSection(title: string): void {
  const line = "-".repeat(Math.max(title.length + 6, 36));
  console.log("\n" + line);
  console.log(`-- ${title} --`);
  console.log(line);
}

export function runAllTests(config: TestSuiteConfig = {}): TestSummary {
  logHeader("Frida Mono Bridge - Comprehensive Test Suite");

  const startTime = Date.now();
  const suite = new TestSuite("Frida Mono Bridge");

  // ============================================================================
  // PHASE 1: STANDALONE TESTS (No Mono runtime dependency)
  // ============================================================================

  logSection("Phase 1: Standalone Tests (No Mono Dependency)");

  // Core Infrastructure Tests
  logSection("Core Infrastructure Tests");
  suite.addResult(testCoreInfrastructure());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Mono Types Tests
  logSection("Mono Types Tests");
  suite.addResult(testMonoTypes());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Mono Members Tests
  logSection("Mono Members Tests");
  suite.addResult(testMonoMembers());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Data Operations Tests
  logSection("Data Operations Tests");
  suite.addResult(testDataOperations());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Integration Tests
  logSection("Integration Tests");
  suite.addResult(testIntegration());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Supporting Tests
  logSection("Supporting Tests");
  suite.addResult(testSupporting());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Utils Tests (STANDALONE)
  logSection("Comprehensive Utils Tests");
  suite.addResult(testMonoUtils());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Error Handling Tests (STANDALONE)
  logSection("Comprehensive Error Handling Tests");
  suite.addResult(testMonoErrorHandling());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // ============================================================================
  // PHASE 2: MONO_DEPENDENT TESTS (Require Mono runtime)
  // ============================================================================

  logSection("Phase 2: Mono-Dependent Tests");

  // Unity GameObject Tests
  if (!config.skipUnityTests) {
    logSection("Unity GameObject Tests");
    suite.addResult(testUnityGameObject());
    if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
      return suite.getSummary();
    }

    // Unity Components Tests
    logSection("Unity Components Tests");
    suite.addResult(testUnityComponents());
    if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
      return suite.getSummary();
    }

    // Unity Engine Modules Tests
    logSection("Unity Engine Modules Tests");
    suite.addResult(testUnityEngineModules());
    if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
      return suite.getSummary();
    }
  }

  // Comprehensive Mono API Tests
  logSection("Comprehensive Mono API Tests");
  suite.addResult(testMonoApi());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Domain Tests
  logSection("Comprehensive Mono Domain Tests");
  suite.addResult(testMonoDomain());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Threading Tests
  logSection("Comprehensive Mono Threading Tests");
  suite.addResult(testMonoThreading());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Module Tests
  logSection("Comprehensive Mono Module Tests");
  suite.addResult(testMonoModule());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Class Tests
  logSection("Comprehensive Mono Class Tests");
  const classTestResults = createMonoClassTests();
  classTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Method Tests
  logSection("Comprehensive Mono Method Tests");
  const methodTestResults = createMonoMethodTests();
  methodTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Field Tests
  logSection("Comprehensive Mono Field Tests");
  const fieldTestResults = createMonoFieldTests();
  fieldTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Property Tests
  logSection("Comprehensive Mono Property Tests");
  const propertyTestResults = createMonoPropertyTests();
  propertyTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Assembly Tests
  logSection("Comprehensive Mono Assembly Tests");
  const assemblyTestResults = createMonoAssemblyTests();
  assemblyTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Image Tests
  logSection("Comprehensive Mono Image Tests");
  const imageTestResults = createMonoImageTests();
  imageTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Runtime API Tests
  logSection("Comprehensive Runtime API Tests");
  const runtimeApiTestResults = createRuntimeApiTests();
  runtimeApiTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive MonoString Tests
  logSection("Comprehensive MonoString Tests");
  const stringTestResults = createMonoStringTests();
  stringTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive MonoArray Tests
  logSection("Comprehensive MonoArray Tests");
  const arrayTestResults = createMonoArrayTests();
  arrayTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive MonoDelegate Tests
  logSection("Comprehensive MonoDelegate Tests");
  const delegateTestResults = createMonoDelegateTests();
  delegateTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive MonoObject Tests
  logSection("Comprehensive MonoObject Tests");
  const objectTestResults = createMonoObjectTests();
  objectTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // ============================================================================
  // PHASE 3: ENHANCED FEATURE TESTS
  // ============================================================================

  logSection("Phase 3: Enhanced Feature Tests");

  // Find Tools Tests
  logSection("Find Tools Tests");
  const findToolTestResults = createFindToolTests();
  findToolTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Trace Tools Tests
  logSection("Trace Tools Tests");
  const traceToolTestResults = createTraceToolsTests();
  traceToolTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // GC Tools Tests
  logSection("GC Tools Tests");
  const gcToolTestResults = createGCToolsTests();
  gcToolTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Generic Types Tests
  logSection("Generic Types Tests");
  const genericTypeTestResults = createGenericTypeTests();
  genericTypeTestResults.forEach(result => suite.addResult(result));
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Comprehensive Mono Data Tests
  if (!config.skipPerformanceTests) {
    logSection("Comprehensive Mono Data Tests");
    const dataTestResults = testMonoData();
    dataTestResults.forEach(result => suite.addResult(result));
    if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
      return suite.getSummary();
    }
  }

  // Print Summary
  const endTime = Date.now();
  const duration = endTime - startTime;

  logHeader("Test Summary");

  const summary = suite.getSummary();
  
  const pct = (value: number) => (summary.total === 0 ? "0.0" : ((value / summary.total) * 100).toFixed(1));
  
  console.log(`Total Tests: ${summary.total}`);
  console.log(`  Passed:  ${summary.passed} (${pct(summary.passed)}%)`);
  console.log(`  Failed:  ${summary.failed} (${pct(summary.failed)}%)`);
  console.log(`  Skipped: ${summary.skipped} (${pct(summary.skipped)}%)`);
  console.log(`  Duration: ${duration}ms`);

  if (summary.failed > 0) {
    console.log("\nSome tests failed. See details above.");
  } else if (summary.skipped > 0) {
    console.log("\nAll tests passed, but some were skipped.");
  } else {
    console.log("\nAll tests passed!");
  }

  console.log("\n");

  return summary;
}

// Export consolidated test modules for selective testing
export {
  // Core Infrastructure Tests
  testCoreInfrastructure,
  testMonoTypes,
  testMonoMembers,
  testDataOperations,
  testIntegration,
  testSupporting,
  
  // Utility Tests (STANDALONE)
  testMonoUtils,
  testMonoErrorHandling,
  
  // Type System Tests
  createMonoClassTests,
  createMonoMethodTests,
  createMonoFieldTests,
  createMonoPropertyTests,
  createGenericTypeTests,
  
  // Runtime Object Tests
  createMonoStringTests,
  createMonoArrayTests,
  createMonoDelegateTests,
  createMonoObjectTests,
  testMonoData,
  
  // Domain & Assembly Tests
  testMonoApi,
  testMonoDomain,
  testMonoThreading,
  testMonoModule,
  createMonoAssemblyTests,
  createMonoImageTests,
  createRuntimeApiTests,
  
  // Advanced Feature Tests
  createFindToolTests,
  createTraceToolsTests,
  createGCToolsTests,
  
  // Unity Integration Tests
  testUnityGameObject,
  testUnityComponents,
  testUnityEngineModules,
};

const globalScope = globalThis as any;
const autoRunConfig = globalScope.__monoTestConfig ?? {};
const shouldAutoRun = globalScope.__monoTestAutoRun !== false;

if (shouldAutoRun) {
  setTimeout(() => {
    try {
      runAllTests(autoRunConfig);
    } catch (error) {
      console.error("[MonoTests] Unhandled error during test run:", error);
    }
  });
}

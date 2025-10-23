/**
 * Test Suite Index
 * Orchestrates all test modules and provides a unified test runner
 */

// Import consolidated test files
import { testCoreInfrastructure } from "./test-core-infrastructure";
import { testMonoTypes } from "./test-mono-types";
import { testMonoMembers } from "./test-mono-members";
import { testDataOperations } from "./test-data-operations";
import { testAdvancedFeatures } from "./test-advanced-features";
import { testIntegration } from "./test-integration";
import { testSupporting } from "./test-supporting";

// Import Unity-specific test files
import { testUnityGameObject } from "./test-unity-gameobject";
import { testUnityComponents } from "./test-unity-components";
import { testUnityEngineModules } from "./test-unity-engine-modules";

import { TestSummary, TestSuite } from "./test-framework";

export interface TestSuiteConfig {
  skipSlowTests?: boolean;
  skipAdvancedTests?: boolean;
  verbose?: boolean;
  stopOnFirstFailure?: boolean;
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

  // Advanced Features Tests
  logSection("Advanced Features Tests");
  suite.addResult(testAdvancedFeatures());
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

  // Unity GameObject Tests
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
  testCoreInfrastructure,
  testMonoTypes,
  testMonoMembers,
  testDataOperations,
  testAdvancedFeatures,
  testIntegration,
  testSupporting,
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




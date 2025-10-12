/**
 * Test Suite Index
 * Orchestrates all test modules and provides a unified test runner
 */

import { testModuleDetection } from "./test-module";
import { testVersionDetection } from "./test-version";
import { testApiAvailability } from "./test-api";
import { testThreadManagement } from "./test-thread";
import { testThreadModel } from "./test-thread-model";
import { testDomainAccess } from "./test-domain";
import { testAssemblyOperations } from "./test-assembly";
import { testClassOperations } from "./test-class";
import { testMethodOperations } from "./test-method";
import { testObjectOperations } from "./test-object";
import { testStringOperations } from "./test-string";
import { testArrayOperations } from "./test-array";
import { testFieldOperations } from "./test-field";
import { testPropertyOperations } from "./test-property";
import { testGCHandles } from "./test-gchandle";
import { testDelegates } from "./test-delegate";
import { testInternalCalls } from "./test-icall";
import { testLogger } from "./test-logger";
import { testRealUsage } from "./test-real-usage";
import { testMetadataCollections } from "./test-metadata";
import { testDefinitions } from "./test-definitions";
import { testLruCache } from "./test-cache";
import { testFluentApi } from "./test-fluent-api";
import { testUtilities } from "./test-utils";
import { TestResult, TestSummary, TestSuite } from "./test-framework";

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

  suite.addResult(testModuleDetection());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testVersionDetection());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testApiAvailability());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testLogger());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Runtime Management Tests
  logSection("Runtime Management Tests");

  suite.addResult(testThreadManagement());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testThreadModel());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testDomainAccess());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testGCHandles());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Model Tests (Basic Operations)
  logSection("Basic Model Operations Tests");

  suite.addResult(testAssemblyOperations());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testClassOperations());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testMethodOperations());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testStringOperations());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Advanced Model Tests
  if (!config.skipAdvancedTests) {
    logSection("Advanced Model Operations Tests");

    suite.addResult(testObjectOperations());
    suite.addResult(testArrayOperations());
    suite.addResult(testFieldOperations());
    suite.addResult(testPropertyOperations());
    suite.addResult(testMetadataCollections());
    suite.addResult(testDefinitions());
  }

  // Feature Tests
  logSection("Feature-Specific Tests");

  suite.addResult(testDelegates());
  suite.addResult(testInternalCalls());

  // Real Usage Integration Tests
  logSection("Real Usage Integration Tests");

  suite.addResult(testRealUsage());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  // Utility and Infrastructure Tests
  logSection("Utility and Cache Tests");

  suite.addResult(testLruCache());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testFluentApi());
  if (config.stopOnFirstFailure && !suite.results[suite.results.length - 1].passed) {
    return suite.getSummary();
  }

  suite.addResult(testUtilities());
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

// Export individual test modules for selective testing
export {
  testModuleDetection,
  testVersionDetection,
  testApiAvailability,
  testThreadManagement,
  testThreadModel,
  testDomainAccess,
  testAssemblyOperations,
  testClassOperations,
  testMethodOperations,
  testObjectOperations,
  testStringOperations,
  testArrayOperations,
  testFieldOperations,
  testPropertyOperations,
  testMetadataCollections,
  testDefinitions,
  testGCHandles,
  testDelegates,
  testInternalCalls,
  testLogger,
  testRealUsage,
  testLruCache,
  testFluentApi,
  testUtilities,
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




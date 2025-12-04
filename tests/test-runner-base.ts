/**
 * Base Test Runner
 * Shared utilities for running individual test categories
 */

import { TestResult } from "./test-framework";

// Re-export TestResult for use in individual runners
export { TestResult };

export interface TestRunnerConfig {
  verbose?: boolean;
  stopOnFirstFailure?: boolean;
}

export function runTestCategory(
  categoryName: string,
  testFunction: () => TestResult,
  config: TestRunnerConfig = {},
): void {
  console.log("=".repeat(Math.max(categoryName.length + 8, 48)));
  console.log(`== ${categoryName} ==`);
  console.log("=".repeat(Math.max(categoryName.length + 8, 48)));

  const startTime = Date.now();

  try {
    const result = testFunction();
    const duration = Date.now() - startTime;

    // Print individual test results if verbose
    if (config.verbose && result.message) {
      console.log(`\nResult: ${result.message}`);
    }

    // Print summary
    console.log("\n" + "-".repeat(48));
    console.log("TEST SUMMARY");
    console.log("-".repeat(48));
    console.log(`Category: ${categoryName}`);
    console.log(`Status: ${result.passed ? "PASSED" : "FAILED"}`);
    console.log(`Duration: ${duration}ms`);

    if (result.failed) {
      console.log(`Error: ${result.error?.message || "Unknown error"}`);
    }

    if (result.skipped) {
      console.log(`Skipped: ${result.message || "No reason provided"}`);
    }

    console.log("-".repeat(48));

    if (result.passed) {
      console.log("ALL TESTS PASSED!");
    } else {
      console.log("TESTS FAILED!");
      if (config.stopOnFirstFailure) {
        throw new Error(`Test category "${categoryName}" failed`);
      }
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log("\n" + "-".repeat(48));
    console.log("TEST SUMMARY");
    console.log("-".repeat(48));
    console.log(`Category: ${categoryName}`);
    console.log(`Status: ERROR`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log("-".repeat(48));

    if (config.stopOnFirstFailure) {
      throw error;
    }
  }
}

export function runMultipleTestCategories(
  categories: Array<{ name: string; testFunction: () => TestResult }>,
  config: TestRunnerConfig = {},
): void {
  console.log("=".repeat(60));
  console.log("== FRIDA MONO BRIDGE - INDIVIDUAL TEST RUNNER ==");
  console.log("=".repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const results: Array<{ name: string; result: TestResult }> = [];

  for (const category of categories) {
    try {
      const result = category.testFunction();
      results.push({ name: category.name, result });

      if (result.passed) {
        totalPassed++;
      } else if (result.failed) {
        totalFailed++;
      } else if (result.skipped) {
        totalSkipped++;
      }

      if (config.stopOnFirstFailure && result.failed) {
        break;
      }
    } catch (error) {
      console.error(`Error running test category "${category.name}":`, error);
      totalFailed++;

      if (config.stopOnFirstFailure) {
        break;
      }
    }
  }

  // Print final summary
  console.log("\n" + "=".repeat(60));
  console.log("FINAL SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Categories: ${categories.length}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Skipped: ${totalSkipped}`);

  if (totalFailed > 0) {
    console.log("\nFAILED CATEGORIES:");
    results
      .filter(r => r.result.failed)
      .forEach(r => console.log(`  - ${r.name}: ${r.result.error?.message || "Unknown error"}`));
  }

  console.log("=".repeat(60));
}

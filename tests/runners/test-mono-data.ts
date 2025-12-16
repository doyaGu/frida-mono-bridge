/**
 * Mono Data Test Runner
 * Runs Mono Data tests independently
 */

import { createMonoDataTests } from "../test-mono-data";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
async function runMonoDataTests(): Promise<TestResult> {
  const results = await createMonoDataTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Mono Data Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Data tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Data Tests", runMonoDataTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

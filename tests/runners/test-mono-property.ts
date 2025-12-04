/**
 * Mono Property Test Runner
 * Runs Mono Property tests independently
 */

import { createMonoPropertyTests } from "../test-mono-property";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
function runMonoPropertyTests(): TestResult {
  const results = createMonoPropertyTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Mono Property Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Property tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Property Tests", runMonoPropertyTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

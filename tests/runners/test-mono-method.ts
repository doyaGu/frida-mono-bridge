/**
 * Mono Method Test Runner
 * Runs Mono Method tests independently
 */

import { createMonoMethodTests } from "../test-mono-method";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
async function runMonoMethodTests(): Promise<TestResult> {
  const results = await createMonoMethodTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Mono Method Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Method tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Method Tests", runMonoMethodTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

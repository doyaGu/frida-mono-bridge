/**
 * Mono Field Test Runner
 * Runs Mono Field tests independently
 */

import { createMonoFieldTests } from "../test-mono-field";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
async function runMonoFieldTests(): Promise<TestResult> {
  const results = await createMonoFieldTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Mono Field Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Field tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Field Tests", runMonoFieldTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

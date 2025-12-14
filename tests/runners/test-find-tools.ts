/**
 * Find Tools Test Runner
 *
 * Standalone runner for Find utility tests
 */

import { createFindToolTests } from "../test-find-tools";
import { runTestCategory, TestResult } from "../test-runner-base";

async function runFindToolTests(): Promise<TestResult> {
  const results = await createFindToolTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Find Tools Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Find Tools tests passed`,
  };
}

// Auto-run test category
runTestCategory("Find Tools Tests", runFindToolTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

export { createFindToolTests };

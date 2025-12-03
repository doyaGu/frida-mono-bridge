/**
 * Runtime API Test Runner
 * Runs Runtime API tests independently
 */

import { createRuntimeApiTests } from "../test-runtime-api";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
function runRuntimeApiTests(): TestResult {
  const results = createRuntimeApiTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;
  
  return {
    name: "Runtime API Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Runtime API tests passed`,
  };
}

// Auto-run test category
runTestCategory("Runtime API Tests", runRuntimeApiTests, {
  verbose: true,
  stopOnFirstFailure: false
});

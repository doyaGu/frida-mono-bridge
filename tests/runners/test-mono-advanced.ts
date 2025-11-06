/**
 * Mono Advanced Test Runner
 * Runs Mono Advanced tests independently
 */

import { testMonoAdvanced } from "../test-mono-advanced";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
function runMonoAdvancedTests(): TestResult {
  const results = testMonoAdvanced();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;
  
  return {
    name: "Mono Advanced Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Advanced tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Advanced Tests", runMonoAdvancedTests, {
  verbose: true,
  stopOnFirstFailure: false
});
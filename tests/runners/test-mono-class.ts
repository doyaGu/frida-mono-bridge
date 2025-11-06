/**
 * Mono Class Test Runner
 * Runs Mono Class tests independently
 */

import { createMonoClassTests } from "../test-mono-class";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
function runMonoClassTests(): TestResult {
  const results = createMonoClassTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;
  
  return {
    name: "Mono Class Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Class tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Class Tests", runMonoClassTests, {
  verbose: true,
  stopOnFirstFailure: false
});
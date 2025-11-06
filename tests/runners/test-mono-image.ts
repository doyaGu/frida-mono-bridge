/**
 * Mono Image Test Runner
 * Runs Mono Image tests independently
 */

import { createMonoImageTests } from "../test-mono-image";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
function runMonoImageTests(): TestResult {
  const results = createMonoImageTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;
  
  return {
    name: "Mono Image Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Image tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Image Tests", runMonoImageTests, {
  verbose: true,
  stopOnFirstFailure: false
});
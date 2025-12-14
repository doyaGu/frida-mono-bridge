/**
 * Mono Assembly Test Runner
 * Runs Mono Assembly tests independently
 */

import { createMonoAssemblyTests } from "../test-mono-assembly";
import { runTestCategory, TestResult } from "../test-runner-base";

// Wrapper function to convert array of results to single result
async function runMonoAssemblyTests(): Promise<TestResult> {
  const results = await createMonoAssemblyTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Mono Assembly Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Mono Assembly tests passed`,
  };
}

// Auto-run test category
runTestCategory("Mono Assembly Tests", runMonoAssemblyTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

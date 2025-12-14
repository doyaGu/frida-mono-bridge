/**
 * Mono Error Handling Test Runner
 * Runs Mono Error Handling tests independently
 */

import runMonoErrorHandlingTests from "../test-mono-error-handling";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Error Handling Tests", runMonoErrorHandlingTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

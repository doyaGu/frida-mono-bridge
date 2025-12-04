/**
 * Mono Error Handling Test Runner
 * Runs Mono Error Handling tests independently
 */

import { testMonoErrorHandling } from "../test-mono-error-handling";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Error Handling Tests", testMonoErrorHandling, {
  verbose: true,
  stopOnFirstFailure: false,
});

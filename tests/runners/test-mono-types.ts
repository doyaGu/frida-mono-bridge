/**
 * Mono Types Test Runner
 * Runs Mono Types tests independently
 */

import { testMonoTypes } from "../test-mono-types";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Types Tests", testMonoTypes, {
  verbose: true,
  stopOnFirstFailure: false
});
/**
 * Mono Types Test Runner
 * Runs Mono Types tests independently
 */

import { createMonoTypesTests } from "../test-mono-types";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Types Tests", createMonoTypesTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

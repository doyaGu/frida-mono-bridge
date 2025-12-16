/**
 * Mono Utils Test Runner
 * Runs Mono Utils tests independently
 */

import { createMonoUtilsTests } from "../test-mono-utils";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Utils Tests", createMonoUtilsTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

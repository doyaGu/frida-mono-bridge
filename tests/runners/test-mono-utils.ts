/**
 * Mono Utils Test Runner
 * Runs Mono Utils tests independently
 */

import { testMonoUtils } from "../test-mono-utils";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Utils Tests", testMonoUtils, {
  verbose: true,
  stopOnFirstFailure: false
});
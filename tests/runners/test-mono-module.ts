/**
 * Mono Module Test Runner
 * Runs Mono Module tests independently
 */

import { testMonoModule } from "../test-mono-module";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Module Tests", testMonoModule, {
  verbose: true,
  stopOnFirstFailure: false,
});

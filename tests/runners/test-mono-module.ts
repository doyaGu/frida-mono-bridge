/**
 * Mono Module Test Runner
 * Runs Mono Module tests independently
 */

import { createMonoModuleTests } from "../test-mono-module";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Module Tests", createMonoModuleTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

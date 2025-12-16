/**
 * Mono Threading Test Runner
 * Runs Mono Threading tests independently
 */

import { createMonoThreadingTests } from "../test-mono-threading";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Threading Tests", createMonoThreadingTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

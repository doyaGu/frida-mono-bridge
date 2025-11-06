/**
 * Mono Threading Test Runner
 * Runs Mono Threading tests independently
 */

import { testMonoThreading } from "../test-mono-threading";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Threading Tests", testMonoThreading, {
  verbose: true,
  stopOnFirstFailure: false
});
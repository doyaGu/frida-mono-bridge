/**
 * Mono Domain Test Runner
 * Runs Mono Domain tests independently
 */

import { testMonoDomain } from "../test-mono-domain";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Domain Tests", testMonoDomain, {
  verbose: true,
  stopOnFirstFailure: false
});
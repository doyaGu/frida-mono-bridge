/**
 * Mono Domain Test Runner
 * Runs Mono Domain tests independently
 */

import { createMonoDomainTests } from "../test-mono-domain";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Mono Domain Tests", createMonoDomainTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

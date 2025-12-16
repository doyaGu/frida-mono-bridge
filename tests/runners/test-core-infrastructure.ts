/**
 * Core Infrastructure Test Runner
 * Runs core infrastructure tests independently
 */

import { createCoreInfrastructureTests } from "../test-core-infrastructure";
import { runTestCategory } from "../test-runner-base";

// Auto-run the test category
runTestCategory("Core Infrastructure Tests", createCoreInfrastructureTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

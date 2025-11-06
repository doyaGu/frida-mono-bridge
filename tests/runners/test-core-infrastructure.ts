/**
 * Core Infrastructure Test Runner
 * Runs core infrastructure tests independently
 */

import { testCoreInfrastructure } from "../test-core-infrastructure";
import { runTestCategory } from "../test-runner-base";

// Auto-run the test category
runTestCategory("Core Infrastructure Tests", testCoreInfrastructure, {
  verbose: true,
  stopOnFirstFailure: false
});
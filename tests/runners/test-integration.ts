/**
 * Integration Test Runner
 * Runs Integration tests independently
 */

import { createIntegrationTests } from "../test-integration";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Integration Tests", createIntegrationTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

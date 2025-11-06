/**
 * Integration Test Runner
 * Runs Integration tests independently
 */

import { testIntegration } from "../test-integration";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Integration Tests", testIntegration, {
  verbose: true,
  stopOnFirstFailure: false
});
/**
 * Advanced Features Test Runner
 * Runs Advanced Features tests independently
 */

import { testAdvancedFeatures } from "../test-advanced-features";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Advanced Features Tests", testAdvancedFeatures, {
  verbose: true,
  stopOnFirstFailure: false
});
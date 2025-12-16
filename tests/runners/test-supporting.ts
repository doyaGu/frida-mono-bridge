/**
 * Supporting Test Runner
 * Runs Supporting tests independently
 */

import { runTestCategory } from "../test-runner-base";
import { createSupportingTests } from "../test-supporting";

// Auto-run test category
runTestCategory("Supporting Tests", createSupportingTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

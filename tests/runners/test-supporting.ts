/**
 * Supporting Test Runner
 * Runs Supporting tests independently
 */

import { testSupporting } from "../test-supporting";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Supporting Tests", testSupporting, {
  verbose: true,
  stopOnFirstFailure: false
});
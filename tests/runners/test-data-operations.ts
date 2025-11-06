/**
 * Data Operations Test Runner
 * Runs Data Operations tests independently
 */

import { testDataOperations } from "../test-data-operations";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Data Operations Tests", testDataOperations, {
  verbose: true,
  stopOnFirstFailure: false
});
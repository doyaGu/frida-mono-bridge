/**
 * Data Operations Test Runner
 * Runs Data Operations tests independently
 */

import { createDataOperationsTests } from "../test-data-operations";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Data Operations Tests", createDataOperationsTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

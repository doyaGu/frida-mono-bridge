/**
 * Unity Components Test Runner
 * Runs Unity Components tests independently
 */

import { runTestCategory } from "../test-runner-base";
import { createUnityComponentsTests } from "../test-unity-components";

// Auto-run test category
runTestCategory("Unity Components Tests", createUnityComponentsTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

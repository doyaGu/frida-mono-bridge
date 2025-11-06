/**
 * Unity Components Test Runner
 * Runs Unity Components tests independently
 */

import { testUnityComponents } from "../test-unity-components";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Unity Components Tests", testUnityComponents, {
  verbose: true,
  stopOnFirstFailure: false
});
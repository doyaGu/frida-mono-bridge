/**
 * Unity GameObject Test Runner
 * Runs Unity GameObject tests independently
 */

import { runTestCategory } from "../test-runner-base";
import { createUnityGameObjectTests } from "../test-unity-gameobject";

// Auto-run test category
runTestCategory("Unity GameObject Tests", createUnityGameObjectTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

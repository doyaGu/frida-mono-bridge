/**
 * Unity GameObject Test Runner
 * Runs Unity GameObject tests independently
 */

import { testUnityGameObject } from "../test-unity-gameobject";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Unity GameObject Tests", testUnityGameObject, {
  verbose: true,
  stopOnFirstFailure: false
});
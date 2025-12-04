/**
 * Unity Engine Modules Test Runner
 * Runs Unity Engine Modules tests independently
 */

import { testUnityEngineModules } from "../test-unity-engine-modules";
import { runTestCategory } from "../test-runner-base";

// Auto-run test category
runTestCategory("Unity Engine Modules Tests", testUnityEngineModules, {
  verbose: true,
  stopOnFirstFailure: false,
});

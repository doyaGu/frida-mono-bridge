/**
 * Unity Engine Modules Test Runner
 * Runs Unity Engine Modules tests independently
 */

import { runTestCategory } from "../test-runner-base";
import { createUnityEngineModulesTests } from "../test-unity-engine-modules";

// Auto-run test category
runTestCategory("Unity Engine Modules Tests", createUnityEngineModulesTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

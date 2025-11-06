/**
 * Mono API Test Runner
 * Runs Mono API tests independently
 */

import { testMonoApi } from "../test-mono-api";
import { runTestCategory } from "../test-runner-base";

// Auto-run the test category with proper delay
const globalScope = globalThis as any;
const autoRunConfig = globalScope.__monoTestConfig ?? {};
const shouldAutoRun = globalScope.__monoTestAutoRun !== false;

if (shouldAutoRun) {
  setTimeout(() => {
    try {
      console.log("=".repeat(48));
      console.log("== FRIDA MONO BRIDGE - MONO API TESTS ==");
      console.log("=".repeat(48));

      runTestCategory("Mono API Tests", testMonoApi, {
        verbose: true,
        stopOnFirstFailure: false,
        ...autoRunConfig
      });
    } catch (error) {
      console.error("[Mono API Tests] Unhandled error during test run:", error);
    }
  });
} else {
  console.log("[Mono API Tests] Test runner loaded. Auto-run disabled.");
}
/**
 * Test runner for Custom Attributes API
 *
 * Compile and run:
 * npx frida-compile tests/runners/test-custom-attributes.ts -o dist/test-custom-attributes.js
 * frida -p <PID> -l dist/test-custom-attributes.js
 */

import { createCustomAttributeTests } from "../test-custom-attributes";
import { runTestCategory, TestResult } from "../test-runner-base";

async function runCustomAttributesTests(): Promise<TestResult> {
  const results = await createCustomAttributeTests();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const skipped = results.filter(r => r.skipped).length;

  return {
    name: "Custom Attributes Tests",
    passed: failed === 0,
    failed: failed > 0,
    skipped: skipped > 0,
    message: `${passed}/${results.length} Custom Attributes tests passed`,
  };
}

// Auto-run test category
runTestCategory("Custom Attributes Tests", runCustomAttributesTests, {
  verbose: true,
  stopOnFirstFailure: false,
});

export { createCustomAttributeTests };

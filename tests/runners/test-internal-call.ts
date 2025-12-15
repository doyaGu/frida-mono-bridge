/**
 * Internal Call Test Runner
 *
 * Standalone runner for internal call (ICall) tests
 */

import { createInternalCallTests } from "../test-internal-call";

const results = await createInternalCallTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => r.failed).length;
const total = results.length;

console.log(`\n=== Internal Call Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

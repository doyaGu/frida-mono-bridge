/**
 * GC Tools Test Runner
 *
 * Runs GC tools tests independently
 */

import { createGCToolsTests } from "../test-gc-tools";

const results = createGCToolsTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\n=== GC Tools Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

export { createGCToolsTests };

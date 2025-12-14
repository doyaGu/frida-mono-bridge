/**
 * MonoArray Test Runner
 *
 * Standalone runner for MonoArray tests
 */

import { createMonoArrayTests } from "../test-mono-array";

const results = await createMonoArrayTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => r.failed).length;
const total = results.length;

console.log(`\n=== MonoArray Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

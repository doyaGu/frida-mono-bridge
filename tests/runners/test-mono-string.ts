/**
 * MonoString Test Runner
 *
 * Standalone runner for MonoString tests
 */

import { createMonoStringTests } from "../test-mono-string";

const results = await createMonoStringTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => r.failed).length;
const total = results.length;

console.log(`\n=== MonoString Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

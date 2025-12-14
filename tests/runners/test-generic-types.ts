/**
 * Generic Types Test Runner
 *
 * Runs MonoClass generic type tests independently
 */

import { createGenericTypeTests } from "../test-generic-types";

const results = await createGenericTypeTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\n=== Generic Types Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

export { createGenericTypeTests };

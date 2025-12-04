/**
 * MonoDelegate Test Runner
 *
 * Standalone runner for MonoDelegate tests
 */

import { createMonoDelegateTests } from "../test-mono-delegate";

const results = createMonoDelegateTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\n=== MonoDelegate Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

export { createMonoDelegateTests };

/**
 * Find Tools Test Runner
 * 
 * Standalone runner for Find utility tests
 */

import { createFindToolTests } from '../test-find-tools';

const results = createFindToolTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\n=== Find Tools Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

export { createFindToolTests };

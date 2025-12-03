/**
 * Trace Tools Test Runner
 * 
 * Standalone runner for Trace utility tests
 */

import { createTraceToolsTests } from '../test-trace-tools';

const results = createTraceToolsTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\n=== Trace Tools Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

export { createTraceToolsTests };

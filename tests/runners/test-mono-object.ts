/**
 * MonoObject Test Runner
 * 
 * Standalone runner for MonoObject tests
 */

import { createMonoObjectTests } from '../test-mono-object';

const results = createMonoObjectTests();

// Print summary
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => r.failed).length;
const total = results.length;

console.log(`\n=== MonoObject Tests: ${passed}/${total} passed ===`);
if (failed > 0) {
  console.log(`${failed} tests failed`);
}

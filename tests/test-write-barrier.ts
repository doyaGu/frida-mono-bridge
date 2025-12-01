/**
 * Write Barrier Tests
 * 
 * These tests verify that write barriers are correctly applied when
 * modifying managed object references, especially for SGen GC.
 */

import Mono from '../src';
import {
  TestResult,
  TestSuite,
  createMonoDependentTest,
  createSmokeTest,
  assert,
  assertNotNull,
  assertApiAvailable,
  TestCategory
} from './test-framework';
import { 
  isSGenGC, 
  getGCInfo, 
  setArrayReferenceWithBarrier
} from '../src/utils/write-barrier';

export function testWriteBarrier(): TestResult[] {
  console.log('\nWrite Barrier Tests:');

  const suite = new TestSuite('Write Barrier', TestCategory.MONO_DEPENDENT);
  const results: TestResult[] = [];

  // ============================================================================
  // SMOKE TESTS
  // ============================================================================

  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, 'write barrier operations'));

  // ============================================================================
  // GC DETECTION TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest('should detect GC type', () => {
    assertApiAvailable('Mono.api should be accessible');
    
    const gcInfo = getGCInfo(Mono.api);
    assertNotNull(gcInfo, 'GC info should not be null');
    assert(['sgen', 'boehm', 'unknown'].includes(gcInfo.type), `GC type should be recognized: ${gcInfo.type}`);
    assert(typeof gcInfo.supportsWriteBarriers === 'boolean', 'supportsWriteBarriers should be boolean');
    assert(typeof gcInfo.supportsAtomicBarriers === 'boolean', 'supportsAtomicBarriers should be boolean');
    
    console.log(`  [GC Info] Type: ${gcInfo.type}, Write Barriers: ${gcInfo.supportsWriteBarriers}, Atomic: ${gcInfo.supportsAtomicBarriers}`);
  }));

  suite.addResult(createMonoDependentTest('should check if using SGen', () => {
    const usingSGen = isSGenGC(Mono.api);
    assert(typeof usingSGen === 'boolean', 'isSGenGC should return boolean');
    
    // Correlate with hasExport
    const hasBarrierExport = Mono.api.hasExport('mono_gc_wbarrier_set_field');
    assert(usingSGen === hasBarrierExport, 'isSGenGC should match hasExport check');
    
    console.log(`  [SGen Check] Using SGen: ${usingSGen}`);
  }));

  // ============================================================================
  // ARRAY REFERENCE WRITE BARRIER TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest('should use write barrier for reference array assignment', () => {
    const domain = Mono.domain;
    const mscorlib = domain.assembly('mscorlib');
    assertNotNull(mscorlib, 'mscorlib assembly should be available');
    
    const stringClass = mscorlib.image.class('System.String');
    assertNotNull(stringClass, 'System.String class should be found');
    
    const array = stringClass.arrayNew(5);
    assertNotNull(array, 'Array should be created');
    
    // Set a string element (uses write barrier internally via setReference)
    const testString = domain.newString('Hello Write Barrier');
    array.setReference(0, testString.pointer);
    
    // Verify the value was set correctly
    const retrieved = array.getObject(0);
    assertNotNull(retrieved, 'Retrieved value should not be null');
    
    const retrievedStr = retrieved.toString();
    assert(retrievedStr === 'Hello Write Barrier', `Expected 'Hello Write Barrier', got '${retrievedStr}'`);
  }));

  suite.addResult(createMonoDependentTest('should handle NULL assignments in arrays', () => {
    const domain = Mono.domain;
    const stringClass = domain.assembly('mscorlib')!.image.class('System.String')!;
    const array = stringClass.arrayNew(3);
    
    // Set non-null first
    const testString = domain.newString('Test');
    array.setReference(0, testString.pointer);
    
    // Then set to NULL (should work without errors)
    array.setReference(0, NULL);
    
    const retrieved = array.getReference(0);
    assert(retrieved.isNull(), 'Should be able to set NULL');
  }));

  suite.addResult(createMonoDependentTest('should handle multiple array assignments', () => {
    const domain = Mono.domain;
    const stringClass = domain.assembly('mscorlib')!.image.class('System.String')!;
    const array = stringClass.arrayNew(10);
    
    // Fill array with different strings
    for (let i = 0; i < 10; i++) {
      const str = domain.newString(`Item ${i}`);
      array.setReference(i, str.pointer);
    }
    
    // Verify all values
    for (let i = 0; i < 10; i++) {
      const obj = array.getObject(i);
      assertNotNull(obj, `Item ${i} should not be null`);
      const str = obj.toString();
      assert(str === `Item ${i}`, `Expected 'Item ${i}', got '${str}'`);
    }
  }));

  // ============================================================================
  // FIELD WRITE OPERATIONS (Verify internal barrier handling)
  // ============================================================================

  suite.addResult(createMonoDependentTest('mono_field_set_value should handle barriers internally', () => {
    const domain = Mono.domain;
    const mscorlib = domain.assembly('mscorlib')!;
    
    // Create a simple class with reference field
    const objectClass = mscorlib.image.class('System.Object')!;
    const stringClass = mscorlib.image.class('System.String')!;
    
    // Test with a class that has reference fields
    const exceptionClass = mscorlib.image.class('System.Exception')!;
    const exception = exceptionClass.new();
    
    // Get _message field and set it (this uses mono_field_set_value internally)
    const messageField = exceptionClass.field('_message');
    if (messageField) {
      const testMessage = domain.newString('Write barrier test message');
      messageField.setValue(exception, testMessage.pointer);
      
      const retrieved = messageField.getValue(exception);
      assertNotNull(retrieved, 'Field value should be set');
    } else {
      console.log('  [Warning] _message field not found, skipping field test');
    }
  }));

  // ============================================================================
  // WRITE BARRIER UTILITY FUNCTIONS
  // ============================================================================

  suite.addResult(createMonoDependentTest('should use barrier utility functions correctly', () => {
    const domain = Mono.domain;
    const stringClass = domain.assembly('mscorlib')!.image.class('System.String')!;
    const array = stringClass.arrayNew(3);
    const testString = domain.newString('Barrier Utility Test');
    
    // Use the utility function directly
    const address = array.getElementAddress(1);
    setArrayReferenceWithBarrier(Mono.api, array.pointer, address, testString.pointer);
    
    // Verify it worked
    const retrieved = array.getObject(1);
    assertNotNull(retrieved, 'Should retrieve set value');
    assert(retrieved.toString() === 'Barrier Utility Test', 'Value should match');
  }));

  suite.addResult(createMonoDependentTest('should handle write barriers gracefully on older Mono', () => {
    // Even if write barriers are not available, operations should still work
    const domain = Mono.domain;
    const stringClass = domain.assembly('mscorlib')!.image.class('System.String')!;
    const array = stringClass.arrayNew(2);
    
    const str1 = domain.newString('Fallback 1');
    const str2 = domain.newString('Fallback 2');
    
    array.setReference(0, str1.pointer);
    array.setReference(1, str2.pointer);
    
    assert(array.getObject(0).toString() === 'Fallback 1', 'First element should be set');
    assert(array.getObject(1).toString() === 'Fallback 2', 'Second element should be set');
  }));

  results.push(...suite.getResults());
  return results;
}

// Run if executed directly
if (typeof Mono !== 'undefined') {
  const results = testWriteBarrier();
  console.log(`\nWrite Barrier Tests: ${results.filter(r => r.passed).length}/${results.length} passed`);
}

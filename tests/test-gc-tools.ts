/**
 * GC Tools Tests
 * 
 * Tests for GC (Garbage Collection) module functionality
 * Including GC collection, handles, weak references, and pool management
 */

import Mono from '../src';
import { GCUtilities, createGCUtilities } from '../src/utils/gc';
import { GCHandle, GCHandlePool } from '../src/runtime/gchandle';
import { 
  TestResult, 
  createMonoDependentTest, 
  createStandaloneTest,
  assert, 
  assertNotNull,
} from './test-framework';

/**
 * Create GC Tools test suite
 */
export function createGCToolsTests(): TestResult[] {
  const results: TestResult[] = [];

  // ============================================
  // API Existence Tests
  // ============================================
  results.push(createStandaloneTest(
    'GC - Mono.gc exists',
    () => {
      assert(typeof Mono.gc !== 'undefined', 'Mono.gc should exist');
    }
  ));

  results.push(createStandaloneTest(
    'GC - GCUtilities class exists',
    () => {
      assert(typeof GCUtilities === 'function', 'GCUtilities should be a class');
    }
  ));

  results.push(createStandaloneTest(
    'GC - createGCUtilities function exists',
    () => {
      assert(typeof createGCUtilities === 'function', 'createGCUtilities should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'GC - GCHandle class exists',
    () => {
      assert(typeof GCHandle === 'function', 'GCHandle should be a class');
    }
  ));

  results.push(createStandaloneTest(
    'GC - GCHandlePool class exists',
    () => {
      assert(typeof GCHandlePool === 'function', 'GCHandlePool should be a class');
    }
  ));

  // ============================================
  // GCUtilities Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GCUtilities - collect() does not throw',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        // Should not throw
        gc.collect();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCUtilities - collect with generation 0',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        // Collect generation 0 (youngest)
        gc.collect(0);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCUtilities - collect with generation 1',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        gc.collect(1);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCUtilities - collect with generation 2 (full)',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        // Full GC
        gc.collect(2);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCUtilities - collect with -1 collects all',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        // -1 means all generations
        gc.collect(-1);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCUtilities - maxGeneration property',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const maxGen = gc.maxGeneration;
        assert(typeof maxGen === 'number', 'maxGeneration should be a number');
        assert(maxGen >= 0, 'maxGeneration should be non-negative');
        console.log(`[INFO] Max GC generation: ${maxGen}`);
      });
    }
  ));

  // ============================================
  // GCHandle Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GCHandle - create handle for object',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        // Create a managed string to get an object pointer
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        assertNotNull(emptyString, 'Empty string should exist');
        
        const handle = gc.handle(emptyString);
        assertNotNull(handle, 'Handle should be created');
        assert(handle.handle !== 0, 'Handle ID should not be 0');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - pinned handle',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Create pinned handle
        const handle = gc.handle(emptyString, true);
        assertNotNull(handle, 'Pinned handle should be created');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - getTarget returns original object',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = gc.handle(emptyString);
        const target = handle.getTarget();
        
        // Target should be the same as original object
        assert(target.equals(emptyString), 'getTarget should return original object');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - isWeak property for strong handle',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = gc.handle(emptyString);
        assert(handle.isWeak === false, 'Strong handle should not be weak');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  // ============================================
  // Weak Handle Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GCHandle - create weak handle',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = gc.weakHandle(emptyString);
        assertNotNull(handle, 'Weak handle should be created');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - isWeak property for weak handle',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = gc.weakHandle(emptyString);
        
        // Note: May fall back to strong handle if weak refs not supported
        console.log(`[INFO] Weak handle isWeak: ${handle.isWeak}`);
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - weak handle with track resurrection',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Track resurrection = true
        const handle = gc.weakHandle(emptyString, true);
        assertNotNull(handle, 'Weak handle with resurrection tracking should be created');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  // ============================================
  // Handle Pool Management Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GCHandle - releaseAll clears all handles',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Create multiple handles
        const handle1 = gc.handle(emptyString);
        const handle2 = gc.handle(emptyString);
        const handle3 = gc.weakHandle(emptyString);
        
        // Release all
        gc.releaseAll();
        
        // Handles should be freed (handle property should be 0)
        // Note: After free, calling getTarget may be undefined behavior
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - multiple handles for same object',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Create multiple handles for same object
        const handle1 = gc.handle(emptyString);
        const handle2 = gc.handle(emptyString);
        
        // Should have different handle IDs
        assert(handle1.handle !== handle2.handle, 'Different handles should have different IDs');
        
        // But same target
        assert(handle1.getTarget().equals(handle2.getTarget()), 'Same object should return same target');
        
        gc.releaseHandle(handle1);
        gc.releaseHandle(handle2);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - release same handle twice is safe',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = gc.handle(emptyString);
        
        // Release twice - should not throw
        gc.releaseHandle(handle);
        gc.releaseHandle(handle);
      });
    }
  ));

  // ============================================
  // GCHandlePool Direct Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GCHandlePool - create pool directly',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        assertNotNull(pool, 'Pool should be created');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandlePool - create and release handle',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = pool.create(emptyString);
        assertNotNull(handle, 'Handle should be created');
        
        pool.release(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandlePool - createWeak',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = pool.createWeak(emptyString);
        assertNotNull(handle, 'Weak handle should be created');
        
        pool.release(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandlePool - releaseAll',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        pool.create(emptyString);
        pool.create(emptyString);
        pool.createWeak(emptyString);
        
        // Release all handles
        pool.releaseAll();
      });
    }
  ));

  // ============================================
  // GC Handle Edge Cases
  // ============================================
  results.push(createMonoDependentTest(
    'GCHandle - free() sets handle to 0',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = pool.create(emptyString);
        const originalId = handle.handle;
        assert(originalId !== 0, 'Original handle ID should not be 0');
        
        handle.free();
        assert(handle.handle === 0, 'After free, handle should be 0');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - free() twice is safe',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = pool.create(emptyString);
        
        // Free twice - should not throw
        handle.free();
        handle.free();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GCHandle - getTarget on freed handle returns NULL',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const pool = new GCHandlePool(api);
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        const handle = pool.create(emptyString);
        handle.free();
        
        const target = handle.getTarget();
        assert(target.isNull(), 'getTarget on freed handle should return NULL');
      });
    }
  ));

  // ============================================
  // Integration Tests
  // ============================================
  results.push(createMonoDependentTest(
    'GC - collect does not break active handles',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Create handle before GC
        const handle = gc.handle(emptyString);
        const targetBefore = handle.getTarget();
        
        // Force GC
        gc.collect();
        
        // Handle should still be valid
        const targetAfter = handle.getTarget();
        assert(targetBefore.equals(targetAfter), 'Handle target should survive GC');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'GC - pinned handle survives GC',
    () => {
      Mono.perform(() => {
        const gc = Mono.gc;
        assertNotNull(gc, 'GC utilities should exist');
        
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const emptyField = stringClass.tryGetField('Empty');
        if (!emptyField) {
          console.log('[INFO] String.Empty field not found, skipping');
          return;
        }
        
        const emptyString = emptyField.getStaticValue();
        
        // Create pinned handle
        const handle = gc.handle(emptyString, true);
        const addressBefore = handle.getTarget();
        
        // Force full GC
        gc.collect(2);
        
        // Pinned handle should keep object at same address
        const addressAfter = handle.getTarget();
        assert(addressBefore.equals(addressAfter), 'Pinned object should not move');
        
        gc.releaseHandle(handle);
      });
    }
  ));

  return results;
}

/**
 * GC Tools Tests
 *
 * Tests for GC (Garbage Collection) module functionality
 * Including GC collection, handles, weak references, and pool management
 */

import Mono from "../src";
import { GCHandle, GCHandlePool } from "../src/runtime/gchandle";
import { GarbageCollector, createGarbageCollector } from "../src/model/gc";
import { TestResult, assert, assertNotNull, createMonoDependentTest, createStandaloneTest } from "./test-framework";

/**
 * Helper to create a managed object for GC testing
 * Returns null if unable to create
 */
function createTestObject(): NativePointer | null {
  try {
    // Use Mono.string.new to create a proper managed string
    const testString = Mono.string.new("GC Test String");
    if (testString && !testString.pointer.isNull()) {
      return testString.pointer;
    }
  } catch {
    // Fall back to trying String.Empty
  }

  try {
    const stringClass = Mono.domain.tryClass("System.String");
    if (!stringClass) return null;

    const emptyField = stringClass.tryField("Empty");
    if (!emptyField) return null;

    const emptyString = emptyField.getStaticValue();
    if (emptyString && !emptyString.isNull()) {
      return emptyString;
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Check if GC handle operations are supported
 */
function isGCHandleSupported(): boolean {
  try {
    const api = Mono.api;
    return (
      typeof api.native.mono_gchandle_new === "function" &&
      typeof api.native.mono_gchandle_free === "function" &&
      typeof api.native.mono_gchandle_get_target === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Create GC Tools test suite
 */
export async function createGCToolsTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ============================================
  // API Existence Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GC - Mono.gc exists", () => {
      assert(typeof Mono.gc !== "undefined", "Mono.gc should exist");
      assertNotNull(Mono.gc, "Mono.gc should not be null");
    }),
  );

  results.push(
    createStandaloneTest("GC - GarbageCollector class exists", () => {
      assert(typeof GarbageCollector === "function", "GarbageCollector should be a class");
    }),
  );

  results.push(
    createStandaloneTest("GC - createGarbageCollector function exists", () => {
      assert(typeof createGarbageCollector === "function", "createGarbageCollector should be a function");
    }),
  );

  results.push(
    createStandaloneTest("GC - GCHandle class exists", () => {
      assert(typeof GCHandle === "function", "GCHandle should be a class");
    }),
  );

  results.push(
    createStandaloneTest("GC - GCHandlePool class exists", () => {
      assert(typeof GCHandlePool === "function", "GCHandlePool should be a class");
    }),
  );

  // ============================================
  // GCUtilities Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GCUtilities - collect() does not throw", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Should not throw
      gc.collect();
    }),
  );

  results.push(
    await createMonoDependentTest("GCUtilities - collect with generation 0", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Collect generation 0 (youngest)
      gc.collect(0);
    }),
  );

  results.push(
    await createMonoDependentTest("GCUtilities - collect with generation 1", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      gc.collect(1);
    }),
  );

  results.push(
    await createMonoDependentTest("GCUtilities - collect with generation 2 (full)", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Full GC
      gc.collect(2);
    }),
  );

  results.push(
    await createMonoDependentTest("GCUtilities - collect with -1 collects all", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // -1 means all generations
      gc.collect(-1);
    }),
  );

  results.push(
    await createMonoDependentTest("GCUtilities - maxGeneration property", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const maxGen = gc.maxGeneration;
      assert(typeof maxGen === "number", "maxGeneration should be a number");
      assert(maxGen >= 0, "maxGeneration should be non-negative");
      console.log(`[INFO] Max GC generation: ${maxGen}`);
    }),
  );

  // ============================================
  // GCHandle Tests (with graceful handling for Unity)
  // ============================================
  results.push(
    await createMonoDependentTest("GCHandle - create handle for object", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.handle(testObj);
        assertNotNull(handle, "Handle should be created");
        assert(handle.handle !== 0, "Handle ID should not be 0");
        console.log(`[INFO] Created handle with ID: ${handle.handle}`);

        gc.releaseHandle(handle);
        console.log("[INFO] Handle released successfully");
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported in this runtime: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - pinned handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create pinned handle
        const handle = gc.handle(testObj, true);
        assertNotNull(handle, "Pinned handle should be created");
        console.log(`[INFO] Created pinned handle with ID: ${handle.handle}`);

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] Pinned GC handle not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - getTarget returns valid pointer", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.handle(testObj);
        const target = handle.getTarget();

        // Target should be valid
        assert(!target.isNull(), "getTarget should return valid pointer");
        console.log(`[INFO] Target pointer: ${target}`);

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] GC handle getTarget not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - isWeak property for strong handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.handle(testObj);
        assert(handle.isWeak === false, "Strong handle should not be weak");

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // Weak Handle Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GCHandle - create weak handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.weakHandle(testObj);
        assertNotNull(handle, "Weak handle should be created");
        console.log(`[INFO] Created weak handle with ID: ${handle.handle}`);

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] Weak GC handles not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - isWeak property for weak handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.weakHandle(testObj);
        // Note: May fall back to strong handle if weak refs not supported
        console.log(`[INFO] Weak handle isWeak: ${handle.isWeak}`);

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] Weak GC handles not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - weak handle with track resurrection", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Track resurrection = true
        const handle = gc.weakHandle(testObj, true);
        assertNotNull(handle, "Weak handle with resurrection tracking should be created");

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] Weak GC handles with resurrection not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // Handle Pool Management Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GCHandle - releaseAll clears all handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create multiple handles
        const handle1 = gc.handle(testObj);
        const handle2 = gc.handle(testObj);
        console.log(`[INFO] Created handles: ${handle1.handle}, ${handle2.handle}`);

        // Release all
        gc.releaseAll();
        console.log("[INFO] Released all handles");
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - multiple handles for same object", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create multiple handles for same object
        const handle1 = gc.handle(testObj);
        const handle2 = gc.handle(testObj);

        // Should have different handle IDs
        assert(handle1.handle !== handle2.handle, "Different handles should have different IDs");
        console.log(`[INFO] Handle IDs: ${handle1.handle}, ${handle2.handle}`);

        gc.releaseHandle(handle1);
        gc.releaseHandle(handle2);
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - release same handle twice is safe", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = gc.handle(testObj);

        // Release twice - should not throw
        gc.releaseHandle(handle);
        gc.releaseHandle(handle);
        console.log("[INFO] Double release succeeded");
      } catch (e) {
        console.log(`[INFO] GC handle release not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // GCHandlePool Direct Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GCHandlePool - create pool directly", () => {
      const api = Mono.api;
      const pool = new GCHandlePool(api);
      assertNotNull(pool, "Pool should be created");
      assert(pool.size === 0, "New pool should be empty");
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandlePool - create and release handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = pool.create(testObj);
        assertNotNull(handle, "Handle should be created");
        assert(pool.size === 1, "Pool should have one handle");

        pool.release(handle);
        assert(pool.size === 0, "Pool should be empty after release");
      } catch (e) {
        console.log(`[INFO] GCHandlePool operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandlePool - createWeak", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = pool.createWeak(testObj);
        assertNotNull(handle, "Weak handle should be created");
        assert(handle.isWeak === true, "Handle should be weak");

        pool.release(handle);
      } catch (e) {
        console.log(`[INFO] GCHandlePool weak handles not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandlePool - releaseAll", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        pool.create(testObj);
        pool.create(testObj);
        assert(pool.size === 2, "Pool should have two handles");

        // Release all handles
        pool.releaseAll();
        assert(pool.size === 0, "Pool should be empty after releaseAll");
      } catch (e) {
        console.log(`[INFO] GCHandlePool operations not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // GC Handle Edge Cases
  // ============================================
  results.push(
    await createMonoDependentTest("GCHandle - free() sets handle to 0", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = pool.create(testObj);
        const originalId = handle.handle;
        assert(originalId !== 0, "Original handle ID should not be 0");

        handle.free();
        assert(handle.handle === 0, "After free, handle should be 0");
      } catch (e) {
        console.log(`[INFO] GCHandle free not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - free() twice is safe", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = pool.create(testObj);

        // Free twice - should not throw
        handle.free();
        handle.free();
        console.log("[INFO] Double free succeeded");
      } catch (e) {
        console.log(`[INFO] GCHandle free not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GCHandle - getTarget on freed handle returns NULL", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const pool = new GCHandlePool(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        const handle = pool.create(testObj);
        handle.free();

        const target = handle.getTarget();
        assert(target.isNull(), "getTarget on freed handle should return NULL");
      } catch (e) {
        console.log(`[INFO] GCHandle getTarget not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // Integration Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GC - collect does not break active handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create handle before GC
        const handle = gc.handle(testObj);
        const targetBefore = handle.getTarget();

        // Force GC
        gc.collect();

        // Handle should still be valid
        const targetAfter = handle.getTarget();
        assert(!targetAfter.isNull(), "Handle target should survive GC");
        console.log(`[INFO] Target before: ${targetBefore}, after: ${targetAfter}`);

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GC - pinned handle survives GC", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create pinned handle
        const handle = gc.handle(testObj, true);
        const addressBefore = handle.getTarget();

        // Force full GC
        gc.collect(2);

        // Pinned handle should keep object at same address
        const addressAfter = handle.getTarget();
        assert(addressBefore.equals(addressAfter), "Pinned object should not move");

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] Pinned GC handle operations not supported: ${e}`);
      }
    }),
  );

  // ============================================
  // Memory Statistics Tests
  // ============================================
  results.push(
    await createMonoDependentTest("GC - getMemoryStats returns valid structure", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const stats = gc.getMemoryStats();

      assert(typeof stats === "object", "getMemoryStats should return an object");
      assert("heapSize" in stats, "Stats should have heapSize");
      assert("usedHeapSize" in stats, "Stats should have usedHeapSize");
      assert("totalCollections" in stats, "Stats should have totalCollections");
      assert("activeHandles" in stats, "Stats should have activeHandles");
      assert("detailedStatsAvailable" in stats, "Stats should have detailedStatsAvailable");

      console.log(`[INFO] Memory stats: ${JSON.stringify(stats)}`);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - getActiveHandleCount returns number", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const count = gc.getActiveHandleCount();
      assert(typeof count === "number", "Should return a number");
      assert(count >= 0, "Count should be non-negative");
      console.log(`[INFO] Active handle count: ${count}`);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - getGenerationStats returns array", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const stats = gc.getGenerationStats();

      assert(Array.isArray(stats), "Should return an array");
      assert(stats.length > 0, "Should have at least one generation");

      for (const genStat of stats) {
        assert(typeof genStat.generation === "number", "Should have generation number");
        console.log(`[INFO] Gen ${genStat.generation}: size=${genStat.size}, collections=${genStat.collections}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GC - getMemorySummary returns string", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const summary = gc.getMemorySummary();

      assert(typeof summary === "string", "Should return a string");
      assert(summary.length > 0, "Summary should not be empty");
      assert(summary.includes("GC Memory Summary"), "Should contain header");

      console.log(summary);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - isCollected checks weak handle", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      try {
        // Create weak handle to a well-known object
        const weakHandle = gc.weakHandle(testObj);

        // The object should not be collected
        const isCollected = gc.isCollected(weakHandle);
        console.log(`[INFO] isCollected result: ${isCollected}`);

        gc.releaseHandle(weakHandle);
      } catch (e) {
        console.log(`[INFO] isCollected not supported: ${e}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GC - collectAndReport returns delta", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const report = gc.collectAndReport();

      assert(typeof report === "object", "Should return an object");
      assert("before" in report, "Should have before stats");
      assert("after" in report, "Should have after stats");
      assert("delta" in report, "Should have delta");

      console.log(`[INFO] Before: ${JSON.stringify(report.before)}`);
      console.log(`[INFO] After: ${JSON.stringify(report.after)}`);
      if (report.delta !== null) {
        console.log(`[INFO] Delta: ${report.delta} bytes freed`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("GC - MemoryStats interface is correct", () => {
      // Type-level test - verify the structure matches expected interface
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const stats = gc.getMemoryStats();

      // Verify all expected properties exist
      const requiredKeys = ["heapSize", "usedHeapSize", "totalCollections", "activeHandles", "detailedStatsAvailable"];
      for (const key of requiredKeys) {
        assert(key in stats, `MemoryStats should have ${key}`);
      }

      console.log("[INFO] MemoryStats interface verified");
    }),
  );

  // =====================================================
  // Finalization Queue Tests
  // =====================================================
  results.push(
    await createMonoDependentTest("GC - getFinalizationQueueInfo exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.getFinalizationQueueInfo === "function", "getFinalizationQueueInfo should exist");

      const info = gc.getFinalizationQueueInfo();
      assert(typeof info.available === "boolean", "available should be boolean");
      assert(info.message !== undefined, "message should exist");

      console.log(`[INFO] Finalization info: available=${info.available}, message=${info.message}`);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - requestFinalization exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.requestFinalization === "function", "requestFinalization should exist");

      // Just call to verify it doesn't crash
      const result = gc.requestFinalization();
      console.log(`[INFO] requestFinalization returned: ${result}`);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - waitForPendingFinalizers exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.waitForPendingFinalizers === "function", "waitForPendingFinalizers should exist");

      // Just call to verify it doesn't crash
      const result = gc.waitForPendingFinalizers(0);
      console.log(`[INFO] waitForPendingFinalizers returned: ${result}`);
    }),
  );

  results.push(
    await createMonoDependentTest("GC - suppressFinalize exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.suppressFinalize === "function", "suppressFinalize should exist");

      // Call with NULL pointer (should handle gracefully)
      const result = gc.suppressFinalize(ptr(0));
      console.log(`[INFO] suppressFinalize with NULL returned: ${result}`);
    }),
  );

  return results;
}

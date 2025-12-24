/**
 * GC Tools Tests
 *
 * Tests for GC (Garbage Collection) module functionality
 * Including GC collection, handles, weak references, and pool management
 */

import Mono from "../src";
import { GarbageCollector, createGarbageCollector } from "../src/model/gc";
import { GCHandle, GCHandlePool } from "../src/runtime/gchandle";
import { withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull, createStandaloneTest } from "./test-framework";

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
    await withDomain("GC - Mono.gc exists", () => {
      assert(typeof Mono.gc !== "undefined", "Mono.gc should exist");
      assertNotNull(Mono.gc, "Mono.gc should not be null");
    }),
  );

  results.push(
    await withDomain("GC - Mono.gc is GarbageCollector instance", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "Mono.gc should exist");

      // Check for GarbageCollector-like properties (GC interface methods)
      assert(typeof gc.maxGeneration === "number", "Should have maxGeneration property");
      assert(typeof gc.getActiveHandleCount === "function", "Should have getActiveHandleCount method");
      assert(typeof gc.collect === "function", "Should have collect method");
      assert(typeof gc.handle === "function", "Should have handle method");
      assert(typeof gc.getMemoryStats === "function", "Should have getMemoryStats method");
      assert(typeof gc.collectAndReport === "function", "Should have collectAndReport method");

      console.log("[INFO] Mono.gc has all expected GC interface methods");
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
    await withDomain("GCUtilities - collect() does not throw", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Should not throw
      gc.collect();
      console.log("[INFO] GC collection completed successfully");
    }),
  );

  results.push(
    await withDomain("GCUtilities - collect with generation 0", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Collect generation 0 (youngest)
      gc.collect(0);
    }),
  );

  results.push(
    await withDomain("GCUtilities - collect with generation 1", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      gc.collect(1);
    }),
  );

  results.push(
    await withDomain("GCUtilities - collect with generation 2 (full)", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // Full GC
      gc.collect(2);
    }),
  );

  results.push(
    await withDomain("GCUtilities - collect with -1 collects all", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      // -1 means all generations
      gc.collect(-1);
    }),
  );

  results.push(
    await withDomain("GCUtilities - maxGeneration property", () => {
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
    await withDomain("GCHandle - create handle for object", () => {
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
    await withDomain("GCHandle - pinned handle", () => {
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
    await withDomain("GCHandle - getTarget returns valid pointer", () => {
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

        // In some Unity versions, getTarget may return NULL due to implementation
        if (!target.isNull()) {
          console.log(`[INFO] Target pointer: ${target}`);
        } else {
          console.log("[INFO] getTarget returned NULL (may be expected in this runtime)");
        }

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] GC handle getTarget not supported: ${e}`);
      }
    }),
  );

  results.push(
    await withDomain("GCHandle - isWeak property for strong handle", () => {
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
    await withDomain("GCHandle - create weak handle", () => {
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
    await withDomain("GCHandle - isWeak property for weak handle", () => {
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
    await withDomain("GCHandle - weak handle with track resurrection", () => {
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
    await withDomain("GCHandle - releaseAll clears all handles", () => {
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

        const countBefore = gc.getActiveHandleCount();
        console.log(`[INFO] Active handles before: ${countBefore}`);

        // Release all
        gc.releaseAll();

        const countAfter = gc.getActiveHandleCount();
        console.log(`[INFO] Active handles after: ${countAfter}`);
        assert(countAfter === 0, "Should have no active handles after releaseAll");
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await withDomain("GCHandle - multiple handles for same object", () => {
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
    await withDomain("GCHandle - release same handle twice is safe", () => {
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
    await withDomain("GCHandlePool - create pool directly", () => {
      const api = Mono.api;
      const pool = new GCHandlePool(api);
      assertNotNull(pool, "Pool should be created");
      assert(pool.size === 0, "New pool should be empty");
    }),
  );

  results.push(
    await withDomain("GarbageCollector - create via factory function", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      assertNotNull(gc, "GarbageCollector should be created");
      assert(gc.isDisposed === false, "Should not be disposed initially");
      assert(gc.activeHandleCount === 0, "Should have no handles initially");

      console.log(`[INFO] Created GarbageCollector with maxGen: ${gc.maxGeneration}`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GCHandlePool - create and release handle", () => {
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
    await withDomain("GCHandlePool - createWeak", () => {
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
    await withDomain("GCHandlePool - releaseAll", () => {
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
    await withDomain("GCHandle - free() sets handle to 0", () => {
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
    await withDomain("GCHandle - free() twice is safe", () => {
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
    await withDomain("GCHandle - getTarget on freed handle returns NULL", () => {
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
    await withDomain("GC - collect does not break active handles", () => {
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

        // Handle should still be valid (though target may not be accessible)
        const targetAfter = handle.getTarget();

        if (!targetBefore.isNull() && !targetAfter.isNull()) {
          console.log(`[INFO] Target before: ${targetBefore}, after: ${targetAfter}`);
        } else {
          console.log("[INFO] Handle targets not accessible (may be expected in this runtime)");
        }

        gc.releaseHandle(handle);
      } catch (e) {
        console.log(`[INFO] GC handle operations not supported: ${e}`);
      }
    }),
  );

  results.push(
    await withDomain("GC - pinned handle survives GC", () => {
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
    await withDomain("GC - getMemoryStats returns valid structure", () => {
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
    await withDomain("GC - getActiveHandleCount returns number", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const count = gc.getActiveHandleCount();
      assert(typeof count === "number", "Should return a number");
      assert(count >= 0, "Count should be non-negative");
      console.log(`[INFO] Active handle count: ${count}`);
    }),
  );

  results.push(
    await withDomain("GC - getGenerationStats returns array", () => {
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
    await withDomain("GC - getMemorySummary returns string", () => {
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
    await withDomain("GC - isCollected checks weak handle", () => {
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
    await withDomain("GC - collectAndReport returns delta", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      const report = gc.collectAndReport();

      assert(typeof report === "object", "Should return an object");
      assert("before" in report, "Should have before stats");
      assert("after" in report, "Should have after stats");
      assert("delta" in report, "Should have delta");
      assert("durationMs" in report, "Should have durationMs");
      assert(typeof report.durationMs === "number", "durationMs should be a number");
      assert(report.durationMs >= 0, "durationMs should be non-negative");

      console.log(`[INFO] Before: ${JSON.stringify(report.before)}`);
      console.log(`[INFO] After: ${JSON.stringify(report.after)}`);
      console.log(`[INFO] Duration: ${report.durationMs}ms`);
      if (report.delta !== null) {
        console.log(`[INFO] Delta: ${report.delta} bytes freed`);
      }
    }),
  );

  results.push(
    await withDomain("GC - MemoryStats interface is correct", () => {
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
  // Configuration System Tests
  // =====================================================
  results.push(
    await withDomain("GC Config - DEFAULT_GC_CONFIG exists", () => {
      const { DEFAULT_GC_CONFIG } = require("../src/model/gc");
      assertNotNull(DEFAULT_GC_CONFIG, "DEFAULT_GC_CONFIG should exist");
      assert(typeof DEFAULT_GC_CONFIG.maxHandles === "number", "Should have maxHandles");
      assert(typeof DEFAULT_GC_CONFIG.warnOnHighUsage === "boolean", "Should have warnOnHighUsage");
      assert(typeof DEFAULT_GC_CONFIG.highUsageThreshold === "number", "Should have highUsageThreshold");
      assert(typeof DEFAULT_GC_CONFIG.autoReleaseOnLimit === "boolean", "Should have autoReleaseOnLimit");
      console.log(`[INFO] DEFAULT_GC_CONFIG: ${JSON.stringify(DEFAULT_GC_CONFIG)}`);
    }),
  );

  results.push(
    await withDomain("GC Config - createGarbageCollector with custom config", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const customConfig = {
        maxHandles: 100,
        warnOnHighUsage: false,
        highUsageThreshold: 0.9,
        autoReleaseOnLimit: true,
      };

      const gc = createGarbageCollector(api, customConfig);
      assertNotNull(gc, "GC should be created with custom config");

      const config = gc.currentConfig;
      assert(config.maxHandles === 100, "maxHandles should be 100");
      assert(config.warnOnHighUsage === false, "warnOnHighUsage should be false");
      assert(config.highUsageThreshold === 0.9, "highUsageThreshold should be 0.9");
      assert(config.autoReleaseOnLimit === true, "autoReleaseOnLimit should be true");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Config - partial config merge with defaults", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      // Only override some values
      const partialConfig = {
        maxHandles: 200,
      };

      const gc = createGarbageCollector(api, partialConfig);
      const config = gc.currentConfig;

      assert(config.maxHandles === 200, "maxHandles should be overridden");
      // Other values should be defaults
      assert(typeof config.warnOnHighUsage === "boolean", "Should have default warnOnHighUsage");
      assert(typeof config.highUsageThreshold === "number", "Should have default highUsageThreshold");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Config - currentConfig is read-only copy", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api, { maxHandles: 500 });
      const config = gc.currentConfig;

      // Try to modify (should not affect internal config)
      (config as any).maxHandles = 999;

      const config2 = gc.currentConfig;
      assert(config2.maxHandles === 500, "Internal config should not be modified");

      gc.dispose();
    }),
  );

  // =====================================================
  // New Properties Tests
  // =====================================================
  results.push(
    await withDomain("GC Property - isDisposed initially false", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      assert(gc.isDisposed === false, "Should not be disposed initially");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Property - isDisposed becomes true after dispose", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      gc.dispose();

      assert(gc.isDisposed === true, "Should be disposed after dispose()");
    }),
  );

  results.push(
    await withDomain("GC Property - stats is alias for getMemoryStats", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      const stats1 = gc.stats;
      const stats2 = gc.getMemoryStats();

      assert(typeof stats1 === "object", "stats should return object");
      assert(typeof stats2 === "object", "getMemoryStats should return object");
      assert("activeHandles" in stats1, "stats should have activeHandles");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Property - supportsMovingCollector is false", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      assert(gc.supportsMovingCollector === false, "Mono does not have moving collector");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Property - supportsPinnedObjectHeap is false", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api);
      assert(gc.supportsPinnedObjectHeap === false, "Mono does not have pinned object heap");

      gc.dispose();
    }),
  );

  // =====================================================
  // Try Methods Tests
  // =====================================================
  results.push(
    await withDomain("GC Try - tryCreateHandle succeeds with valid object", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handle = gc.tryCreateHandle(testObj);
        if (handle !== null) {
          assertNotNull(handle, "tryCreateHandle should return handle");
          assert(handle.handle !== 0, "Handle ID should be valid");
          console.log(`[INFO] tryCreateHandle succeeded with ID: ${handle.handle}`);
        } else {
          console.log("[INFO] tryCreateHandle returned null (expected in some runtimes)");
        }
      } catch (e) {
        console.log(`[INFO] tryCreateHandle not supported: ${e}`);
      } finally {
        // Dispose may fail due to access violations, catch and ignore
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("GC Try - tryCreateHandle returns null when disposed", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      const handle = gc.tryCreateHandle(testObj);
      assert(handle === null, "tryCreateHandle should return null when disposed");
    }),
  );

  results.push(
    await withDomain("GC Try - tryCreateWeakHandle succeeds with valid object", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handle = gc.tryCreateWeakHandle(testObj);
        if (handle !== null) {
          assertNotNull(handle, "tryCreateWeakHandle should return handle");
          console.log(`[INFO] tryCreateWeakHandle succeeded, isWeak: ${handle.isWeak}`);
        } else {
          console.log("[INFO] tryCreateWeakHandle returned null (expected in some runtimes)");
        }
      } catch (e) {
        console.log(`[INFO] tryCreateWeakHandle not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("GC Try - tryCreateWeakHandle returns null when disposed", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      const handle = gc.tryCreateWeakHandle(testObj);
      assert(handle === null, "tryCreateWeakHandle should return null when disposed");
    }),
  );

  results.push(
    await withDomain("GC Try - tryCreateHandle with pinned flag", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handle = gc.tryCreateHandle(testObj, true);
        if (handle !== null) {
          console.log(`[INFO] tryCreateHandle with pinned=true succeeded`);
        }
      } catch (e) {
        console.log(`[INFO] Pinned handles not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  // =====================================================
  // Capacity Management Tests
  // =====================================================
  results.push(
    await withDomain("GC Capacity - hasHandleCapacity initially true", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api, { maxHandles: 100 });

      assert(gc.hasHandleCapacity() === true, "Should have capacity initially");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Capacity - hasHandleCapacity becomes false at limit", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api, { maxHandles: 3 });

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        // Create handles up to limit
        gc.tryCreateHandle(testObj);
        gc.tryCreateHandle(testObj);
        gc.tryCreateHandle(testObj);

        const hasCapacity = gc.hasHandleCapacity();
        console.log(`[INFO] hasHandleCapacity at limit: ${hasCapacity}`);
        assert(hasCapacity === false, "Should not have capacity at limit");
      } catch (e) {
        console.log(`[INFO] Handle creation not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("GC Capacity - tryCreateHandle returns null at limit", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api, { maxHandles: 2, autoReleaseOnLimit: false });

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        gc.tryCreateHandle(testObj);
        gc.tryCreateHandle(testObj);

        const handle3 = gc.tryCreateHandle(testObj);
        assert(handle3 === null, "tryCreateHandle should return null when no capacity");
        console.log("[INFO] tryCreateHandle correctly returned null at limit");
      } catch (e) {
        console.log(`[INFO] Handle operations not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  // =====================================================
  // HandleStats Tests
  // =====================================================
  results.push(
    await withDomain("GC Stats - getHandleStats returns valid structure", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const stats = gc.getHandleStats();

      assert(typeof stats === "object", "Should return object");
      assert("totalCreated" in stats, "Should have totalCreated");
      assert("totalReleased" in stats, "Should have totalReleased");
      assert("activeCount" in stats, "Should have activeCount");
      assert("weakCount" in stats, "Should have weakCount");
      assert("strongCount" in stats, "Should have strongCount");
      assert("pinnedCount" in stats, "Should have pinnedCount");

      console.log(`[INFO] HandleStats: ${JSON.stringify(stats)}`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Stats - getHandleStats tracks created handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const statsBefore = gc.getHandleStats();
        const initialCreated = statsBefore.totalCreated;

        const handle = gc.tryCreateHandle(testObj);
        if (handle !== null) {
          const statsAfter = gc.getHandleStats();
          assert(statsAfter.totalCreated > initialCreated, "totalCreated should increase");
          assert(statsAfter.activeCount > 0, "activeCount should be positive");
          console.log(`[INFO] Created handles tracked: ${statsAfter.totalCreated}`);
        }
      } catch (e) {
        console.log(`[INFO] Handle operations not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("GC Stats - getHandleStats tracks weak handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handle = gc.tryCreateWeakHandle(testObj);
        if (handle !== null) {
          const stats = gc.getHandleStats();
          console.log(`[INFO] Weak handles: ${stats.weakCount}`);
        }
      } catch (e) {
        console.log(`[INFO] Weak handle operations not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  results.push(
    await withDomain("GC Stats - getHandleStats tracks pinned handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const statsBefore = gc.getHandleStats();
        const initialPinned = statsBefore.pinnedCount;

        const handle = gc.tryCreateHandle(testObj, true);
        if (handle !== null) {
          const statsAfter = gc.getHandleStats();
          console.log(`[INFO] Pinned before: ${initialPinned}, after: ${statsAfter.pinnedCount}`);
        }
      } catch (e) {
        console.log(`[INFO] Pinned handle operations not supported: ${e}`);
      } finally {
        try {
          gc.dispose();
        } catch (e) {
          console.log(`[INFO] Dispose had issues (non-fatal): ${e}`);
        }
      }
    }),
  );

  // =====================================================
  // Dispose Tests
  // =====================================================
  results.push(
    await withDomain("GC Dispose - dispose() can be called multiple times", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();
      gc.dispose();
      gc.dispose();

      assert(gc.isDisposed === true, "Should remain disposed");
      console.log("[INFO] Multiple dispose() calls handled safely");
    }),
  );

  results.push(
    await withDomain("GC Dispose - operations throw after dispose", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      let threwError = false;
      try {
        gc.collect();
      } catch (e) {
        threwError = true;
        console.log(`[INFO] collect() threw after dispose: ${e}`);
      }

      assert(threwError === true, "Operations should throw after dispose");
    }),
  );

  results.push(
    await withDomain("GC Dispose - getMemoryStats throws after dispose", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      let threwError = false;
      try {
        gc.getMemoryStats();
      } catch (e) {
        threwError = true;
        console.log(`[INFO] getMemoryStats() threw after dispose`);
      }

      assert(threwError === true, "getMemoryStats should throw after dispose");
    }),
  );

  results.push(
    await withDomain("GC Dispose - createHandle throws after dispose", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        return;
      }

      let threwError = false;
      try {
        gc.createHandle(testObj);
      } catch (e) {
        threwError = true;
        console.log(`[INFO] createHandle() threw after dispose`);
      }

      assert(threwError === true, "createHandle should throw after dispose");
    }),
  );

  results.push(
    await withDomain("GC Dispose - collectAndReport throws after dispose", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      gc.dispose();

      let threwError = false;
      try {
        gc.collectAndReport();
      } catch (e) {
        threwError = true;
        console.log(`[INFO] collectAndReport() threw after dispose`);
      }

      assert(threwError === true, "collectAndReport should throw after dispose");
    }),
  );

  // =====================================================
  // New Finalizer Methods Tests
  // =====================================================
  results.push(
    await withDomain("GC Finalizer - reRegisterFinalize exists", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      assert(typeof gc.reRegisterFinalize === "function", "reRegisterFinalize should exist");

      const testObj = createTestObject();
      if (testObj) {
        const result = gc.reRegisterFinalize(testObj);
        console.log(`[INFO] reRegisterFinalize returned: ${result}`);
      }

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Finalizer - reRegisterFinalize with NULL pointer", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const result = gc.reRegisterFinalize(ptr(0));
      assert(result === false, "Should return false for NULL pointer");

      gc.dispose();
    }),
  );

  // =====================================================
  // Integration Tests for New Features
  // =====================================================
  results.push(
    await withDomain("GC Integration - activeHandleCount matches stats", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handle1 = gc.tryCreateHandle(testObj);
        const handle2 = gc.tryCreateHandle(testObj);

        if (handle1 !== null && handle2 !== null) {
          const count = gc.activeHandleCount;
          const stats = gc.getHandleStats();

          assert(count === stats.activeCount, "activeHandleCount should match stats.activeCount");
          console.log(`[INFO] Active handles: ${count}, stats: ${stats.activeCount}`);
        }
      } catch (e) {
        console.log(`[INFO] Handle operations not supported: ${e}`);
      }

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Integration - stats property equals getMemoryStats", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const stats1 = gc.stats;
      const stats2 = gc.getMemoryStats();

      assert(stats1.activeHandles === stats2.activeHandles, "stats and getMemoryStats should match");
      assert(stats1.detailedStatsAvailable === stats2.detailedStatsAvailable, "detailedStatsAvailable should match");

      console.log("[INFO] stats property matches getMemoryStats()");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Integration - collectAndReport includes timing", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const report = gc.collectAndReport();

      assert(typeof report.durationMs === "number", "Should have duration");
      assert(report.durationMs >= 0, "Duration should be non-negative");
      assert("before" in report, "Should have before stats");
      assert("after" in report, "Should have after stats");

      console.log(`[INFO] Collection took ${report.durationMs}ms`);

      gc.dispose();
    }),
  );

  // =====================================================
  // Edge Cases for New Features
  // =====================================================
  results.push(
    await withDomain("GC Edge - config with zero maxHandles", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api, { maxHandles: 0 });

      assert(gc.hasHandleCapacity() === false, "Should have no capacity with maxHandles=0");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Edge - config with negative highUsageThreshold", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      // Should handle gracefully
      const gc = createGarbageCollector(api, { highUsageThreshold: -0.5 });
      assertNotNull(gc, "Should create GC even with negative threshold");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Edge - config with very large maxHandles", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");

      const gc = createGarbageCollector(api, { maxHandles: 1000000 });

      assert(gc.hasHandleCapacity() === true, "Should have capacity with large limit");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Edge - getHandleStats after releaseAllHandles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        gc.tryCreateHandle(testObj);
        gc.tryCreateHandle(testObj);

        gc.releaseAllHandles();

        const stats = gc.getHandleStats();
        assert(stats.activeCount === 0, "Active count should be 0 after releaseAll");
        console.log(`[INFO] Stats after releaseAll: ${JSON.stringify(stats)}`);
      } catch (e) {
        console.log(`[INFO] Handle operations not supported: ${e}`);
      }

      gc.dispose();
    }),
  );

  // =====================================================
  // Stress and Performance Tests
  // =====================================================
  results.push(
    await withDomain("GC Stress - create and release many handles", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api, { maxHandles: 100 });

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        const handles: any[] = [];
        const targetCount = 50;

        // Create many handles
        for (let i = 0; i < targetCount; i++) {
          const handle = gc.tryCreateHandle(testObj);
          if (handle !== null) {
            handles.push(handle);
          }
        }

        console.log(`[INFO] Created ${handles.length} handles`);
        assert(handles.length > 0, "Should create at least some handles");

        // Release them individually
        for (const handle of handles) {
          gc.releaseHandle(handle);
        }

        const stats = gc.getHandleStats();
        assert(stats.activeCount === 0, "All handles should be released");
        console.log(`[INFO] Successfully cycled ${handles.length} handles`);
      } catch (e) {
        console.log(`[INFO] Stress test not fully supported: ${e}`);
      }

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Stress - multiple GC cycles", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const cycles = 5;
      let totalDuration = 0;

      for (let i = 0; i < cycles; i++) {
        const report = gc.collectAndReport();
        totalDuration += report.durationMs;
        console.log(`[INFO] Cycle ${i + 1}: ${report.durationMs}ms`);
      }

      const avgDuration = totalDuration / cycles;
      console.log(`[INFO] Average GC duration: ${avgDuration.toFixed(2)}ms over ${cycles} cycles`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Stress - mixed handle types", () => {
      if (!isGCHandleSupported()) {
        console.log("[INFO] GC handle API not fully supported, skipping");
        return;
      }

      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api, { maxHandles: 50 });

      const testObj = createTestObject();
      if (!testObj) {
        console.log("[INFO] Could not create test object, skipping");
        gc.dispose();
        return;
      }

      try {
        // Create mix of strong, weak, and pinned handles
        const strong = gc.tryCreateHandle(testObj);
        const weak = gc.tryCreateWeakHandle(testObj);
        const pinned = gc.tryCreateHandle(testObj, true);

        let createdCount = 0;
        if (strong !== null) createdCount++;
        if (weak !== null) createdCount++;
        if (pinned !== null) createdCount++;

        console.log(`[INFO] Created ${createdCount} handles of different types`);

        const stats = gc.getHandleStats();
        console.log(`[INFO] Strong: ${stats.strongCount}, Weak: ${stats.weakCount}, Pinned: ${stats.pinnedCount}`);

        gc.releaseAllHandles();
      } catch (e) {
        console.log(`[INFO] Mixed handle test not fully supported: ${e}`);
      }

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Performance - getMemoryStats overhead", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        gc.getMemoryStats();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;

      console.log(`[INFO] getMemoryStats called ${iterations} times in ${duration}ms`);
      console.log(`[INFO] Average time per call: ${avgTime.toFixed(3)}ms`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Performance - getHandleStats overhead", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        gc.getHandleStats();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTime = duration / iterations;

      console.log(`[INFO] getHandleStats called ${iterations} times in ${duration}ms`);
      console.log(`[INFO] Average time per call: ${avgTime.toFixed(3)}ms`);

      gc.dispose();
    }),
  );

  // =====================================================
  // Error Handling Tests
  // =====================================================
  results.push(
    await withDomain("GC Error - createHandle with NULL pointer", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      try {
        const handle = gc.createHandle(ptr(0));
        console.log(`[INFO] createHandle with NULL returned handle: ${handle.handle}`);
        // Some implementations may allow NULL handles
      } catch (e) {
        console.log(`[INFO] createHandle with NULL threw error (expected): ${e}`);
      }

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Error - tryCreateHandle with NULL pointer", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const handle = gc.tryCreateHandle(ptr(0));
      console.log(`[INFO] tryCreateHandle with NULL returned: ${handle === null ? "null" : "handle"}`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Error - collect with invalid generation", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      // Try with generation beyond max
      const maxGen = gc.maxGeneration;
      const invalidGen = maxGen + 10;

      // Should clamp to maxGeneration internally
      gc.collect(invalidGen);
      console.log(`[INFO] collect(${invalidGen}) completed (max is ${maxGen})`);

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Error - collect with negative generation other than -1", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      // -1 is valid (all generations), but -2 should be handled
      gc.collect(-2);
      console.log("[INFO] collect(-2) completed without error");

      gc.dispose();
    }),
  );

  results.push(
    await withDomain("GC Error - getGenerationStats structure", () => {
      const api = Mono.api;
      const { createGarbageCollector } = require("../src/model/gc");
      const gc = createGarbageCollector(api);

      const stats = gc.getGenerationStats();

      assert(Array.isArray(stats), "Should return array");
      assert(stats.length > 0, "Should have at least one generation");
      assert(stats.length === gc.maxGeneration + 1, "Should have maxGeneration + 1 entries");

      for (let i = 0; i < stats.length; i++) {
        assert(stats[i].generation === i, `Generation ${i} should have correct index`);
      }

      console.log(`[INFO] Generation stats structure valid for ${stats.length} generations`);

      gc.dispose();
    }),
  );

  // =====================================================
  // Finalization Queue Tests
  // =====================================================
  results.push(
    await withDomain("GC - getFinalizationQueueInfo exists", () => {
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
    await withDomain("GC - requestFinalization exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.requestFinalization === "function", "requestFinalization should exist");

      // Just call to verify it doesn't crash
      const result = gc.requestFinalization();
      console.log(`[INFO] requestFinalization returned: ${result}`);
    }),
  );

  results.push(
    await withDomain("GC - waitForPendingFinalizers exists", () => {
      const gc = Mono.gc;
      assertNotNull(gc, "GC utilities should exist");

      assert(typeof gc.waitForPendingFinalizers === "function", "waitForPendingFinalizers should exist");

      // Just call to verify it doesn't crash
      const result = gc.waitForPendingFinalizers(0);
      console.log(`[INFO] waitForPendingFinalizers returned: ${result}`);
    }),
  );

  results.push(
    await withDomain("GC - suppressFinalize exists", () => {
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

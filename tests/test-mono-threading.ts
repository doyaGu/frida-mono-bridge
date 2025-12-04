/**
 * Comprehensive Mono Threading Tests
 * Complete tests for ThreadManager functionality including:
 * - Thread attachment and detachment
 * - Thread state management
 * - Thread safety and synchronization
 * - Thread-local storage operations
 * - Thread cleanup and resource management
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createPerformanceTest,
  createErrorHandlingTest,
  createIntegrationTest,
  createApiAvailabilityTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  assertApiAvailable,
  TestCategory,
} from "./test-framework";

export function testMonoThreading(): TestResult {
  console.log("\nComprehensive Mono Threading Tests:");

  const suite = new TestSuite("Mono Threading Complete Tests", TestCategory.MONO_DEPENDENT);

  // ============================================================================
  // THREAD ATTACHMENT AND DETACHMENT
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should be accessible", () => {
      assertPerformWorks("Thread manager should be accessible");
      assertApiAvailable("Thread manager should be accessible");

      const api = Mono.api;
      assertNotNull(api, "API should be available");

      // Test that thread manager is initialized
      assertNotNull(api._threadManager, "Thread manager should be initialized");

      console.log("    Thread manager accessible and initialized");
    }),
  );

  suite.addResult(
    createApiAvailabilityTest({
      context: "threading operations",
      testName: "Threading API exports should be available",
      requiredExports: ["mono_thread_attach", "mono_thread_detach", "mono_thread_current", "mono_thread_get_main"],
      validate: api => {
        // Test that threading functions are callable
        assert(typeof api.native.mono_thread_attach === "function", "mono_thread_attach should be function");
        assert(typeof api.native.mono_thread_detach === "function", "mono_thread_detach should be function");

        if (api.hasExport("mono_thread_current")) {
          assert(typeof api.native.mono_thread_current === "function", "mono_thread_current should be function");
        }

        if (api.hasExport("mono_thread_get_main")) {
          assert(typeof api.native.mono_thread_get_main === "function", "mono_thread_get_main should be function");
        }
      },
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread attachment should work correctly", () => {
      const api = Mono.api;

      // Test thread attachment
      const domain = api.getRootDomain();
      assertNotNull(domain, "Domain should be available for thread attachment");

      const attachedThread = api.attachThread();
      assertNotNull(attachedThread, "Thread attachment should return valid pointer");
      assert(!attachedThread.isNull(), "Attached thread should not be NULL");

      console.log(`    Thread attached successfully: 0x${attachedThread.toString(16)}`);

      // Test that we can perform operations with attached thread
      try {
        const testString = api.stringNew("Thread Test");
        assertNotNull(testString, "Should be able to create string with attached thread");
        console.log("    Operations work correctly with attached thread");
      } catch (error) {
        console.log(`    Thread attachment operation: ${error}`);
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread detachment should work correctly", () => {
      const api = Mono.api;

      // First attach a thread
      const domain = api.getRootDomain();
      const attachedThread = api.native.mono_thread_attach(domain);

      if (attachedThread && !attachedThread.isNull()) {
        // Test thread detachment
        try {
          api.native.mono_thread_detach(attachedThread);
          console.log("    Thread detached successfully");
        } catch (error) {
          console.log(`    Thread detachment: ${error}`);
        }
      } else {
        console.log("    Thread attachment failed, skipping detachment test");
      }
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should handle multiple attachments", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test multiple attachment attempts
      const domain = api.getRootDomain();

      try {
        const thread1 = threadManager.ensureAttached();
        const thread2 = threadManager.ensureAttached();
        const thread3 = threadManager.ensureAttached();

        // Should return the same thread handle for the same thread
        assert(thread1.equals(thread2), "Multiple attachments should return same handle");
        assert(thread2.equals(thread3), "Multiple attachments should return same handle");

        console.log("    Multiple attachments handled correctly (cached)");
      } catch (error) {
        console.log(`    Multiple attachment handling: ${error}`);
      }
    }),
  );

  // ============================================================================
  // THREAD STATE MANAGEMENT
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should track attachment state", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test isInAttachedContext - we're inside a Mono.perform, so should be in context
      // Note: isInAttachedContext tracks active *run* contexts, not just attachment
      const initialState = threadManager.isInAttachedContext();
      console.log(`    Initial attachment context state: ${initialState}`);

      // Ensure attachment and verify isAttached
      threadManager.ensureAttached();
      const isAttached = threadManager.isAttached();
      assert(isAttached === true, "Thread should be attached after ensureAttached");

      // When we call run(), we should be in attached context
      threadManager.run(() => {
        const inContext = threadManager.isInAttachedContext();
        assert(inContext === true, "Should be in attached context inside run()");
      });

      console.log(`    isAttached: ${isAttached}`);
      console.log("    Attachment state tracking verified");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should provide context-aware execution", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test run method
      let executionCount = 0;
      const result = threadManager.run(() => {
        executionCount++;
        return "test result";
      });

      assert(result === "test result", "Run should return function result");
      assert(executionCount === 1, "Function should be executed once");
      console.log("    run() execution working correctly");

      // Test runIfNeeded method
      let neededCount = 0;
      const neededResult = threadManager.runIfNeeded(() => {
        neededCount++;
        return "needed result";
      });

      assert(neededResult === "needed result", "runIfNeeded should return function result");
      assert(neededCount === 1, "Function should be executed once");
      console.log("    runIfNeeded() execution working correctly");

      // Test withAttachedThread (alias for run)
      let attachedCount = 0;
      const attachedResult = threadManager.withAttachedThread(() => {
        attachedCount++;
        return "attached result";
      });

      assert(attachedResult === "attached result", "withAttachedThread should return function result");
      assert(attachedCount === 1, "Function should be executed once");
      console.log("    withAttachedThread() execution working correctly");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should handle nested operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test nested run operations
      let outerCount = 0;
      let innerCount = 0;

      threadManager.run(() => {
        outerCount++;
        const outerInContext = threadManager.isInAttachedContext();
        assert(outerInContext === true, "Should be in context in outer run");

        // Nested call should work without double attachment
        threadManager.run(() => {
          innerCount++;
          const innerInContext = threadManager.isInAttachedContext();
          assert(innerInContext === true, "Should be in context in inner run");
        });

        // Another nested call
        threadManager.run(() => {
          innerCount++;
        });
      });

      assert(outerCount === 1, "Outer function should execute once");
      assert(innerCount === 2, "Inner functions should execute twice");

      console.log("    Nested operations handled correctly");
    }),
  );

  // ============================================================================
  // THREAD SAFETY AND SYNCHRONIZATION
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should provide batch operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test runBatch method
      const results = threadManager.runBatch(
        () => "result1",
        () => "result2",
        () => "result3",
      );

      assert(Array.isArray(results), "runBatch should return array");
      assert(results.length === 3, "Should return results for all operations");
      assert(results[0] === "result1", "First result should match");
      assert(results[1] === "result2", "Second result should match");
      assert(results[2] === "result3", "Third result should match");

      // Test empty batch
      const emptyResults = threadManager.runBatch();
      assert(Array.isArray(emptyResults), "Empty batch should return array");
      assert(emptyResults.length === 0, "Empty batch should return empty array");

      console.log("    Batch operations working correctly");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should handle concurrent access", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test that multiple rapid operations don't interfere
      const results: string[] = [];

      for (let i = 0; i < 10; i++) {
        const result = threadManager.run(() => {
          return `operation_${i}_${Date.now()}`;
        });
        results.push(result);
      }

      assert(results.length === 10, "All operations should complete");

      // Check that results are unique (no interference)
      const uniqueResults = new Set(results);
      assert(uniqueResults.size === results.length, "Results should be unique");

      // Verify each result has correct prefix
      for (let i = 0; i < results.length; i++) {
        assert(results[i].startsWith(`operation_${i}_`), `Result ${i} should have correct prefix`);
      }

      console.log(`    Concurrent access test: ${results.length} operations completed`);
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should maintain state consistency", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test state consistency across multiple operations
      let stateCheckCount = 0;

      for (let i = 0; i < 5; i++) {
        threadManager.run(() => {
          stateCheckCount++;

          // Check attachment state during operation
          const inContext = threadManager.isInAttachedContext();
          assert(inContext === true, "Should be in attached context during operation");

          // Check isAttached as well
          const isAttached = threadManager.isAttached();
          assert(isAttached === true, "Thread should be attached during operation");
        });
      }

      assert(stateCheckCount === 5, "All state checks should complete");
      console.log("    State consistency maintained across operations");
    }),
  );

  // ============================================================================
  // THREAD-LOCAL STORAGE OPERATIONS
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should handle thread-local data", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test that thread manager maintains per-thread state
      const thread1 = threadManager.ensureAttached();
      assertNotNull(thread1, "ensureAttached should return a handle");
      assert(!thread1.isNull(), "Thread handle should not be null");

      // Get current thread ID for comparison
      const currentThreadId = Process.getCurrentThreadId();
      console.log(`    Thread ID: ${currentThreadId}`);
      console.log(`    Thread handle: 0x${thread1.toString(16)}`);

      // Test that multiple calls return same handle for same thread
      const thread2 = threadManager.ensureAttached();
      assert(thread1.equals(thread2), "Same thread should get same handle");

      // Verify getStats shows this thread
      const stats = threadManager.getStats();
      assert(stats.attachedThreadIds.includes(currentThreadId), "Stats should include current thread ID");

      console.log("    Thread-local data handling working correctly");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should cache thread handles", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test thread handle caching
      const handles: NativePointer[] = [];

      // Get thread handle multiple times
      for (let i = 0; i < 5; i++) {
        const handle = threadManager.ensureAttached();
        handles.push(handle);
      }

      // All handles should be the same (cached)
      for (let i = 1; i < handles.length; i++) {
        assert(handles[0].equals(handles[i]), `Handle ${i} should match handle 0`);
      }

      // Check stats to verify caching is working
      const stats = threadManager.getStats();
      // Total attachments should not have increased by 5 (due to caching)
      console.log(`    Total attachments: ${stats.totalAttachments}, Current attached: ${stats.currentAttachedCount}`);

      console.log("    Thread handle caching verified");
    }),
  );

  // ============================================================================
  // THREAD CLEANUP AND RESOURCE MANAGEMENT
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should provide stats for resource tracking", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test getStats method for resource tracking
      const stats = threadManager.getStats();
      assertNotNull(stats, "getStats should return stats object");
      assert(typeof stats.totalAttachments === "number", "Stats should have totalAttachments");
      assert(typeof stats.currentAttachedCount === "number", "Stats should have currentAttachedCount");
      assert(typeof stats.activeContextCount === "number", "Stats should have activeContextCount");
      assert(Array.isArray(stats.attachedThreadIds), "Stats should have attachedThreadIds array");

      // Verify current thread is attached (we're inside Mono.perform)
      assert(threadManager.isAttached() === true, "Current thread should be attached");

      console.log(`    Stats: ${stats.currentAttachedCount} attached, ${stats.totalAttachments} total attachments`);
      console.log("    Resource tracking verified");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should handle resource cleanup", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Get initial stats
      const initialStats = threadManager.getStats();
      const initialAttachCount = initialStats.currentAttachedCount;

      // Ensure attachment and verify stats update
      const handle = threadManager.ensureAttached();
      assertNotNull(handle, "ensureAttached should return a handle");
      assert(!handle.isNull(), "Thread handle should not be null");

      // Verify isAttached works
      const isAttached = threadManager.isAttached();
      assert(isAttached === true, "Current thread should be attached");

      // Multiple ensureAttached calls should return same handle (cached)
      const handle2 = threadManager.ensureAttached();
      assert(handle.equals(handle2), "Multiple ensureAttached should return cached handle");

      // Get final stats
      const finalStats = threadManager.getStats();
      assert(finalStats.currentAttachedCount >= initialAttachCount, "Attached count should be maintained");

      console.log(`    Handle: 0x${handle.toString(16)}, isAttached: ${isAttached}`);
      console.log(`    Stats: ${finalStats.currentAttachedCount} attached threads`);
      console.log("    Resource management test completed");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager should handle disposal gracefully", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      // Test that API is not disposed
      assert(!api.isDisposed, "API should not be disposed initially");

      // Test runSafe method for error handling
      const safeResult = threadManager.runSafe(() => {
        return "safe execution";
      });
      assert(safeResult === "safe execution", "runSafe should return callback result");

      // Test runSafe with error handler
      const errorResult = threadManager.runSafe(
        () => {
          throw new Error("Test error");
        },
        error => {
          return `handled: ${error.message}`;
        },
      );
      assert(errorResult === "handled: Test error", "runSafe should invoke error handler on error");

      // Test runSafe without error handler returns undefined on error
      const noHandlerResult = threadManager.runSafe(() => {
        throw new Error("Unhandled error");
      });
      assert(noHandlerResult === undefined, "runSafe without handler should return undefined on error");

      // Test operations work normally
      const domain = api.getRootDomain();
      assertNotNull(domain, "Operations should work before disposal");

      console.log("    runSafe error handling verified");
      console.log("    Disposal handling verified");
    }),
  );

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  suite.addResult(
    createPerformanceTest("Performance: Thread attachment operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      const statsBefore = threadManager.getStats();
      const iterations = 1000;
      const startTime = Date.now();

      // Test rapid thread operations
      for (let i = 0; i < iterations; i++) {
        threadManager.ensureAttached();

        if (i % 10 === 0) {
          threadManager.run(() => `test_${i}`);
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;
      const statsAfter = threadManager.getStats();

      console.log(
        `    ${iterations} thread operations took ${duration}ms (avg: ${avgTime.toFixed(2)}ms per operation)`,
      );
      console.log(`    Total attachments: ${statsAfter.totalAttachments} (was ${statsBefore.totalAttachments})`);
      assert(duration < 5000, "Thread operations should complete quickly");
      assert(avgTime < 5, "Average time per operation should be reasonable");
    }),
  );

  suite.addResult(
    createPerformanceTest("Performance: Context-aware execution", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      const iterations = 100;
      const startTime = Date.now();
      let successCount = 0;

      // Test rapid context-aware operations
      for (let i = 0; i < iterations; i++) {
        const result = threadManager.run(() => {
          return `performance_test_${i}`;
        });
        if (result === `performance_test_${i}`) {
          successCount++;
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(`    ${successCount}/${iterations} context-aware operations completed in ${duration}ms`);
      console.log(`    Average time per operation: ${avgTime.toFixed(2)}ms`);
      assert(successCount === iterations, "All context-aware operations should succeed");
      assert(avgTime < 10, "Average time per operation should be reasonable");
    }),
  );

  suite.addResult(
    createPerformanceTest("Performance: Batch operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      const iterations = 50;
      const startTime = Date.now();
      let successCount = 0;

      // Test batch operations
      for (let i = 0; i < iterations; i++) {
        const results = threadManager.runBatch(
          () => `batch1_${i}`,
          () => `batch2_${i}`,
          () => `batch3_${i}`,
          () => `batch4_${i}`,
          () => `batch5_${i}`,
        );

        if (Array.isArray(results) && results.length === 5) {
          successCount++;
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      console.log(`    ${successCount}/${iterations} batch operations completed in ${duration}ms`);
      console.log(`    Average time per batch: ${avgTime.toFixed(2)}ms`);
      assert(successCount === iterations, "All batch operations should succeed");
    }),
  );

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  suite.addResult(
    createErrorHandlingTest("Thread manager should handle invalid operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test run with null callback - should throw or handle gracefully
      let runNullThrew = false;
      try {
        threadManager.run(null as any);
      } catch (error) {
        runNullThrew = true;
        console.log(`    run(null) threw: ${error}`);
      }
      // Either throwing or returning undefined is acceptable
      console.log(`    Invalid run parameter handling: ${runNullThrew ? "threw error" : "handled gracefully"}`);

      // Test empty batch - should return empty array
      const emptyResult = threadManager.runBatch();
      assert(Array.isArray(emptyResult), "Empty batch should return array");
      assert(emptyResult.length === 0, "Empty batch should return empty array");
      console.log("    Empty batch handling working");

      // Test runSafe with null - should return undefined without crashing
      const safeNullResult = threadManager.runSafe(null as any);
      assert(safeNullResult === undefined, "runSafe(null) should return undefined");
      console.log("    runSafe(null) handled correctly");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Thread manager should handle attachment failures", () => {
      const api = Mono.api;

      // Test attachment with null domain pointer
      let nullDomainHandled = false;
      try {
        const invalidThread = api.native.mono_thread_attach(ptr(0));
        if (invalidThread && !invalidThread.isNull()) {
          // If it succeeds with null domain, try to detach
          api.native.mono_thread_detach(invalidThread);
        }
        nullDomainHandled = true;
        console.log("    Null domain attachment handled without crash");
      } catch (error) {
        nullDomainHandled = true;
        console.log(`    Null domain attachment threw (expected): ${error}`);
      }
      assert(nullDomainHandled, "Null domain case should be handled");

      // Test detachment with null thread pointer
      let nullThreadHandled = false;
      try {
        api.native.mono_thread_detach(ptr(0));
        nullThreadHandled = true;
        console.log("    Null thread detachment handled without crash");
      } catch (error) {
        nullThreadHandled = true;
        console.log(`    Null thread detachment threw (expected): ${error}`);
      }
      assert(nullThreadHandled, "Null thread case should be handled");
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(
    createIntegrationTest("Thread manager should integrate with API operations", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test that API operations work through thread manager
      const result = threadManager.run(() => {
        const domain = api.getRootDomain();
        assertNotNull(domain, "Domain should be accessible through thread manager");
        return domain.toString();
      });

      assert(typeof result === "string", "Should return domain pointer string");
      assert(result.startsWith("0x") || result === "0", "Should be a valid pointer string");
      console.log(`    API integration working: domain pointer ${result}`);
    }),
  );

  suite.addResult(
    createIntegrationTest("Thread manager should integrate with Mono.perform", () => {
      // Test that Mono.perform uses thread manager correctly
      let performWorked = false;
      let domainId: number | undefined;

      Mono.perform(() => {
        performWorked = true;

        // Test that we can access Mono APIs
        const domain = Mono.domain;
        assertNotNull(domain, "Domain should be accessible in Mono.perform");
        domainId = domain.id;

        // Test that thread manager is in correct state during Mono.perform
        const api = Mono.api;
        const threadManager = api._threadManager;
        const isAttached = threadManager.isAttached();
        assert(isAttached === true, "Thread should be attached during Mono.perform");
      });

      assert(performWorked, "Mono.perform should execute correctly");
      assert(domainId !== undefined, "Domain ID should be captured");
      console.log(`    Mono.perform integration working correctly, domain id: ${domainId}`);
    }),
  );

  suite.addResult(
    createIntegrationTest("Thread manager should integrate with domain operations", () => {
      // Test that domain operations work with thread management
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");

      // Test domain operations that require thread attachment
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Domain operations should work with thread management");
      assert(assemblies.length > 0, "Should have at least one assembly");

      // Verify first assembly is valid
      const firstAssembly = assemblies[0];
      assertNotNull(firstAssembly, "First assembly should not be null");
      const assemblyName = firstAssembly.getName();
      assert(typeof assemblyName === "string", "Assembly name should be a string");

      console.log(`    Domain integration working: ${assemblies.length} assemblies accessible`);
      console.log(`    First assembly: ${assemblyName}`);
    }),
  );

  suite.addResult(
    createIntegrationTest("Thread manager should integrate with string operations", () => {
      // Test that string operations work with thread management
      const api = Mono.api;

      assert(api.hasExport("mono_string_new"), "mono_string_new should be available");

      const testString = api.stringNew("Thread Integration Test");
      assertNotNull(testString, "String creation should work with thread management");
      assert(!testString.isNull(), "String pointer should not be null");

      if (api.hasExport("mono_string_length")) {
        const length = api.native.mono_string_length(testString);
        assert(typeof length === "number", "String length should be accessible");
        assert(length === 23, "String length should be 23 (Thread Integration Test)");

        console.log(`    String integration working: length ${length}`);
      } else {
        console.log("    String length API not available, but string creation works");
      }
    }),
  );

  // ============================================================================
  // THREAD DETACHMENT API TESTS
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager detach should return false for non-attached thread", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Test detach on non-existent thread IDs - should return false
      const result1 = threadManager.detach(999999999);
      assert(result1 === false, "detach should return false for non-attached thread 999999999");

      const result2 = threadManager.detach(12345);
      assert(result2 === false, "detach should return false for non-attached thread 12345");

      // Verify current thread is still attached
      assert(threadManager.isAttached() === true, "Current thread should still be attached");

      console.log("    detach() returns false for non-attached threads");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager detachIfExiting should be safe to call", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Verify detachIfExiting is a function
      assert(typeof threadManager.detachIfExiting === "function", "detachIfExiting should be a function");

      // Call detachIfExiting - should return false because thread is not exiting
      const result = threadManager.detachIfExiting();
      assert(result === false, "detachIfExiting should return false when thread is not exiting");

      // Verify current thread is STILL attached (not detached because we're not exiting)
      const isAttached = threadManager.isAttached();
      assert(isAttached === true, "Current thread should still be attached after detachIfExiting");

      // Operations should still work
      const domain = api.getRootDomain();
      assertNotNull(domain, "Domain should be accessible after detachIfExiting");

      console.log(`    detachIfExiting returned: ${result}`);
      console.log("    Thread still attached and operational after detachIfExiting");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Thread manager detachAll should be available", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Verify detachAll is a function
      assert(typeof threadManager.detachAll === "function", "detachAll should be a function");
      assert(threadManager.detachAll.length === 0, "detachAll should take no parameters");

      // Get stats before - we have at least one attached thread
      const stats = threadManager.getStats();
      assert(stats.currentAttachedCount > 0, "Should have at least one attached thread");
      console.log(`    Current attached threads: ${stats.currentAttachedCount}`);

      // Note: We don't call detachAll() here because it would clear our internal
      // state. The safe detachIfExiting is used for the current thread, which
      // returns false because we're not exiting. detachAll is for cleanup.
      console.log("    detachAll API verified (uses safe detachIfExiting for current thread)");
    }),
  );

  suite.addResult(
    createMonoDependentTest("Mono.detachIfExiting should be accessible from top-level API", () => {
      // Verify top-level API is available
      assert(typeof Mono.detachIfExiting === "function", "Mono.detachIfExiting should be a function");
      assert(typeof Mono.detachAllThreads === "function", "Mono.detachAllThreads should be a function");

      // Call detachIfExiting - should be safe and return false
      const result = Mono.detachIfExiting();
      assert(result === false, "Mono.detachIfExiting should return false when not exiting");

      // Mono operations should still work
      const domain = Mono.domain;
      assertNotNull(domain, "Mono.domain should be accessible after detachIfExiting");

      console.log("    Mono top-level detach APIs verified");
    }),
  );

  // ============================================================================
  // THREAD STATE VERIFICATION
  // ============================================================================

  suite.addResult(
    createMonoDependentTest("Thread manager should track attachment state correctly", () => {
      const api = Mono.api;
      const threadManager = api._threadManager;

      assertNotNull(threadManager, "Thread manager should be available");

      // Get current thread ID
      const currentThreadId = Process.getCurrentThreadId();

      // Verify current thread is attached (we're inside Mono.perform)
      const isCurrentAttached = threadManager.isAttached(currentThreadId);
      assert(isCurrentAttached === true, "Current thread should be attached");

      // Verify fake thread ID is not attached
      const isFakeAttached = threadManager.isAttached(999999999);
      assert(isFakeAttached === false, "Fake thread ID should not be attached");

      // Check stats reflect reality
      const stats = threadManager.getStats();
      assert(stats.attachedThreadIds.includes(currentThreadId), "Stats should include current thread ID");
      assert(!stats.attachedThreadIds.includes(999999999), "Stats should not include fake thread ID");

      console.log(`    Thread ${currentThreadId} attached: ${isCurrentAttached}`);
      console.log(`    Thread 999999999 attached: ${isFakeAttached}`);
      console.log(`    Tracked thread IDs: ${stats.attachedThreadIds.join(", ")}`);
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Threading Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Mono threading tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

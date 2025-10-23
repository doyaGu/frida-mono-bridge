/**
 * Thread Management Tests
 * Consolidated tests for thread operations and MonoThread model
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createPerformanceTest,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createMonoThread,
  createDomainTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  assertApiAvailable,
  assertPerformReturns,
  assertThrowsInPerform,
  TestCategory
} from "./test-framework";
import { MonoThread } from "../src/model";

export function testThreadManagement(): TestResult {
  console.log("\nThread Management:");

  const suite = new TestSuite("Thread Management Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "thread management"));

  // Basic Thread Tests
  suite.addResult(createMonoDependentTest("Mono.perform should be available and functional", () => {
    assertPerformWorks("Mono.perform() should work for thread management");
  }));

  suite.addResult(createMonoDependentTest("Mono.perform should return callback results", () => {
    assertPerformReturns(() => {
      return "thread-test-result";
    }, "thread-test-result", "Mono.perform should return results");
  }));

  suite.addResult(createMonoDependentTest("Mono.perform should propagate exceptions", () => {
    assertThrowsInPerform(() => {
      throw new Error("Thread test error");
    }, "Thread test error", "Mono.perform should propagate exceptions");
  }));

  // Thread Attachment Tests
  suite.addResult(createMonoDependentTest("Thread attachment should work via Mono.perform", () => {
    // The thread should already be attached inside Mono.perform
    const domain = Mono.domain;
    assertNotNull(domain, "Domain should be available (indicates thread is attached)");
    assert(!Mono.api.getRootDomain().isNull(), "Root domain should be accessible");
  }));

  suite.addResult(createMonoDependentTest("Multiple Mono.perform calls should work", () => {
    let counter = 0;

    for (let i = 0; i < 3; i++) {
      Mono.perform(() => {
        counter++;
        const domain = Mono.domain;
        assertNotNull(domain, `Domain should be available in call ${i + 1}`);
      });
    }

    assert(counter === 3, "All nested perform calls should execute");
  }));

  suite.addResult(createMonoDependentTest("Nested Mono.perform calls should work correctly", () => {
    let outerValue = 0;
    let innerValue = 0;

    Mono.perform(() => {
      outerValue++;
      Mono.perform(() => {
        innerValue++;
      });
      assert(innerValue === 1, "Inner perform should execute");
    });

    assert(outerValue === 1, "Outer perform should execute");
    assert(innerValue === 1, "Values should be preserved across nested calls");
  }));

  suite.addResult(createMonoDependentTest("Error handling in nested operations", () => {
    let caughtError = false;

    try {
      Mono.perform(() => {
        Mono.perform(() => {
          throw new Error("Nested error");
        });
      });
    } catch (error) {
      caughtError = true;
      assert(error instanceof Error && error.message === "Nested error", "Should preserve error message");
    }

    assert(caughtError, "Should catch error from nested Mono.perform");
  }));

  // MonoThread Model Tests
  suite.addResult(createMonoDependentTest("MonoThread.current() returns valid thread", () => {
    const thread = MonoThread.current(Mono.api);
    assertNotNull(thread, "Thread should not be null");
    assertNotNull(thread.handle, "Thread handle should not be null");
    assert(MonoThread.isValid(thread.handle), "Thread handle should be valid");

    console.log(`    Current thread handle: ${thread.handle}`);
    console.log(`    Thread ID: ${MonoThread.getCurrentId()}`);
  }));

  suite.addResult(createMonoDependentTest("MonoThread.attach() returns valid thread", () => {
    const thread = MonoThread.attach(Mono.api);
    assertNotNull(thread, "Thread should not be null");
    assertNotNull(thread.handle, "Thread handle should not be null");
    assert(MonoThread.isValid(thread.handle), "Thread handle should be valid");
    console.log(`    Attached thread handle: ${thread.handle}`);
  }));

  suite.addResult(createMonoDependentTest("MonoThread.withAttached() executes callback", () => {
    let executed = false;
    MonoThread.withAttached(Mono.api, () => {
      executed = true;
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");
    });
    assert(executed, "Callback should execute");
  }));

  suite.addResult(createMonoDependentTest("MonoThread.getCurrentId() returns number", () => {
    const threadId = MonoThread.getCurrentId();
    assert(typeof threadId === 'number', "Thread ID should be a number");
    assert(threadId >= 0, "Thread ID should be non-negative");
    console.log(`    Thread ID: ${threadId}`);
  }));

  suite.addResult(createMonoDependentTest("MonoThread.ensureAttached() returns valid handle", () => {
    const handle = MonoThread.ensureAttached(Mono.api);
    assertNotNull(handle, "Handle should not be null");
    assert(MonoThread.isValid(handle), "Handle should be valid");
    console.log(`    Ensured attached handle: ${handle}`);
  }));

  suite.addResult(createMonoThread("MonoThread.isValid() correctly validates handles", () => {
    const validHandle = Mono.api.getRootDomain();
    const nullHandle = ptr(0);

    // Validate that we have a proper handle to test with
    if (!validHandle || validHandle.isNull()) {
      console.log("    (Skipped: Could not get valid root domain handle for validation test)");
      return;
    }

    assert(MonoThread.isValid(validHandle), "Should validate valid root domain handle");
    assert(!MonoThread.isValid(nullHandle), "Should not validate null handle");
    assert(!MonoThread.isValid(undefined as any), "Should not validate undefined handle");

    // Test with some clearly invalid but safe addresses
    const lowAddress = ptr(0x1000);  // Low memory, unlikely to be valid
    const highAddress = ptr(0x7FFF0000);  // High user memory area

    // These should be invalid but won't cause access violations
    assert(!MonoThread.isValid(lowAddress), "Should not validate low memory address");
    assert(!MonoThread.isValid(highAddress), "Should not validate high memory address");

    console.log("    Thread handle validation working correctly");
  }));

  suite.addResult(createMonoDependentTest("MonoThread.toString() returns string representation", () => {
    const thread = MonoThread.current(Mono.api);
    const str = thread.toString();
    assert(typeof str === 'string', "Should return string");
    assert(str.includes('MonoThread'), "Should include class name in string");
    console.log(`    String representation: ${str}`);
  }));

  suite.addResult(createMonoDependentTest("MonoThread.toPointer() returns handle", () => {
    const thread = MonoThread.current(Mono.api);
    const pointer = thread.toPointer();
    assertNotNull(pointer, "Pointer should not be null");
    assert(pointer.equals(thread.handle), "Pointer should equal handle");
  }));

  // Thread Operations with Domain
  suite.addResult(createMonoDependentTest("Thread model works with domain operations", () => {
    const thread = MonoThread.current(Mono.api);
    assertNotNull(thread, "Thread should be available");

    const domain = Mono.domain;
    assertNotNull(domain, "Domain should be accessible");

    const assemblies = domain.getAssemblies();
    assert(Array.isArray(assemblies), "Should get assemblies array");
    assert(assemblies.length > 0, "Should have at least one assembly");
    console.log(`    Thread model integration: ${assemblies.length} assemblies found`);
  }));

  suite.addResult(createMonoDependentTest("Multiple thread attachments are safe", () => {
    const handles = [];

    // Create multiple thread handles
    for (let i = 0; i < 3; i++) {
      const handle = MonoThread.ensureAttached(Mono.api);
      handles.push(handle);
    }

    // All handles should be valid
    for (const handle of handles) {
      assert(MonoThread.isValid(handle), "All handles should be valid");
    }

    console.log(`    Created ${handles.length} valid thread handles`);
  }));

  suite.addResult(createMonoDependentTest("Nested withAttached calls work correctly", () => {
    let outerResult = "";
    let innerResult = "";

    MonoThread.withAttached(Mono.api, () => {
      outerResult = "outer";
      MonoThread.withAttached(Mono.api, () => {
        innerResult = "inner";
      });
      assert(innerResult === "inner", "Inner result should be set");
    });

    assert(outerResult === "outer", "Outer result should be preserved");
    console.log("    Nested withAttached calls working correctly");
  }));

  // Thread Error Handling
  suite.addResult(createErrorHandlingTest("Thread operations should handle invalid inputs gracefully", () => {
    try {
      // Try to create thread with invalid handle
      const invalidThread = new MonoThread(Mono.api, ptr(-1));
      // Should handle gracefully in constructor
    } catch (error) {
      // Expected
    }
  }));

  suite.addResult(createErrorHandlingTest("Thread detach is safe to call", () => {
    const thread = MonoThread.current(Mono.api);
    assertNotNull(thread, "Should get current thread");

    // Detach should not throw
    thread.detach();
    console.log("    Thread detach completed successfully");
  }));

  // Performance Tests
  suite.addResult(createPerformanceTest("Thread performance characteristics", () => {
    const iterations = 1000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      MonoThread.current(Mono.api);
    }

    const duration = Date.now() - startTime;
    console.log(`    ${iterations} thread current() calls took ${duration}ms`);
    assert(duration < 1000, "Thread operations should be fast");
  }));

  // Integration Tests
  suite.addResult(createDomainTest("Thread model integration with domain operations", domain => {
    const thread = MonoThread.current(Mono.api);
    const assembly = domain.getAssembly("mscorlib");

    if (assembly) {
      const stringClass = assembly.image.class("System.String");
      if (stringClass) {
        const testString = Mono.api.stringNew("Thread Test");
        assertNotNull(testString, "Should create string in thread context");
        console.log("    Thread model integration working correctly");
      }
    }
  }));

  suite.addResult(createDomainTest("Thread model consistency across Mono.perform calls", domain => {
    const thread1 = MonoThread.current(Mono.api);
    const domain1 = domain;

    Mono.perform(() => {
      const thread2 = MonoThread.current(Mono.api);
      const domain2 = Mono.domain;

      // Should be the same thread and domain
      assert(thread1.handle.equals(thread2.handle), "Thread handle should be consistent");
      assert(domain1 === domain2, "Domain should be consistent");
    });

    const thread3 = MonoThread.current(Mono.api);
    const domain3 = Mono.domain;

    // Should still be consistent
    assert(thread1.handle.equals(thread3.handle), "Thread handle should remain consistent");
    assert(domain1 === domain3, "Domain should remain consistent");
  }));

  // Edge Cases
  suite.addResult(createMonoDependentTest("Should handle thread edge cases in utilities", () => {
    // Test thread utilities with various input types
    assert(typeof MonoThread.getCurrentId() === 'number', "Thread ID should always be number");

    const thread = MonoThread.current(Mono.api);
    assert(MonoThread.isValid(thread.handle), "Current thread should be valid");

    // Test string operations on thread handles
    const threadStr = thread.toString();
    assert(typeof threadStr === 'string', "Thread toString should return string");
    assert(threadStr.length > 0, "Thread toString should not be empty");
  }));

  const summary = suite.getSummary();

  return {
    name: "Thread Management Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} thread management tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}
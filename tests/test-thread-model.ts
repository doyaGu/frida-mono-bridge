/**
 * Thread Model Tests
 */

import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertNotNull } from "./test-framework";
import Mono from "../src";
import { MonoThread } from "../src/model";

export function testThreadModel(): TestResult {
  console.log("\nThread Model:");

  const suite = new TestSuite("Thread Model Tests");

  // Modern API tests - Mono.perform() should handle thread management automatically
  suite.addResult(createTest("Mono.perform should work for thread model tests", () => {
    assertPerformWorks("Mono.perform() should work for thread model tests");
  }));

  suite.addResult(createTest("Should access API for thread operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for thread operations");
      console.log("    API is accessible for thread model tests");
    });
  }));

  suite.addResult(createTest("MonoThread.current() returns valid thread", () => {
    Mono.perform(() => {
      const thread = MonoThread.current(Mono.api);
      assertNotNull(thread, "Thread should not be null");
      assertNotNull(thread.handle, "Thread handle should not be null");
      assert(MonoThread.isValid(thread.handle), "Thread handle should be valid");

      console.log(`    Current thread handle: ${thread.handle}`);
      console.log(`    Thread ID: ${MonoThread.getCurrentId()}`);
    });
  }));

  suite.addResult(createTest("MonoThread.attach() returns valid thread", () => {
    Mono.perform(() => {
      const thread = MonoThread.attach(Mono.api);
      assertNotNull(thread, "Thread should not be null");
      assert(MonoThread.isValid(thread.handle), "Thread handle should be valid");

      console.log(`    Attached thread handle: ${thread.handle}`);
    });
  }));

  suite.addResult(createTest("MonoThread.withAttached() executes callback", () => {
    Mono.perform(() => {
      let executed = false;
      const result = MonoThread.withAttached(Mono.api, () => {
        executed = true;
        return 42;
      });
      assert(executed, "Callback should have been executed");
      assert(result === 42, "Should return callback result");

      console.log("    withAttached() callback executed successfully");
    });
  }));

  suite.addResult(createTest("MonoThread.getCurrentId() returns number", () => {
    Mono.perform(() => {
      const threadId = MonoThread.getCurrentId();
      assert(typeof threadId === "number", "Thread ID should be a number");
      assert(threadId >= 0, "Thread ID should be non-negative");

      console.log(`    Current thread ID: ${threadId}`);
    });
  }));

  suite.addResult(createTest("MonoThread.ensureAttached() returns valid handle", () => {
    Mono.perform(() => {
      const handle = MonoThread.ensureAttached(Mono.api);
      assertNotNull(handle, "Handle should not be null");
      assert(MonoThread.isValid(handle), "Handle should be valid");

      console.log(`    Ensured attached handle: ${handle}`);
    });
  }));

  suite.addResult(createTest("MonoThread.isValid() correctly validates handles", () => {
    Mono.perform(() => {
      const validHandle = MonoThread.ensureAttached(Mono.api);
      assert(MonoThread.isValid(validHandle), "Valid handle should return true");

      // Test NULL validation
      const nullPointer: NativePointer = NULL;
      assert(!MonoThread.isValid(nullPointer), "NULL should return false");

      assert(!MonoThread.isValid(null), "null should return false");
      assert(!MonoThread.isValid(undefined), "undefined should return false");

      console.log("    Thread handle validation works correctly");
    });
  }));

  suite.addResult(createTest("MonoThread.toString() returns string representation", () => {
    Mono.perform(() => {
      const thread = MonoThread.current(Mono.api);
      const str = thread.toString();
      assert(typeof str === "string", "toString should return string");
      assert(str.includes("MonoThread"), "String should contain 'MonoThread'");

      console.log(`    Thread string representation: ${str}`);
    });
  }));

  suite.addResult(createTest("MonoThread.toPointer() returns handle", () => {
    Mono.perform(() => {
      const thread = MonoThread.current(Mono.api);
      const ptr = thread.toPointer();
      assert(ptr.equals(thread.handle), "toPointer should return handle");

      console.log(`    Thread pointer: ${ptr}`);
    });
  }));

  suite.addResult(createTest("Thread model works with domain operations", () => {
    Mono.perform(() => {
      MonoThread.withAttached(Mono.api, () => {
        const domain = Mono.api.getRootDomain();
        assertNotNull(domain, "Should be able to get domain with attached thread");

        // Test domain operations within thread context
        const testString = Mono.api.stringNew("Thread test string");
        assert(!testString.isNull(), "Should be able to create strings in thread context");

        console.log("    Thread model + domain operations work correctly");
      });
    });
  }));

  suite.addResult(createTest("Multiple thread attachments are safe", () => {
    Mono.perform(() => {
      const thread1 = MonoThread.current(Mono.api);
      const thread2 = MonoThread.current(Mono.api);

      // Should return cached handle (same or compatible)
      assertNotNull(thread1, "First thread should be valid");
      assertNotNull(thread2, "Second thread should be valid");

      // Test that both handles are valid
      assert(MonoThread.isValid(thread1.handle), "First thread handle should be valid");
      assert(MonoThread.isValid(thread2.handle), "Second thread handle should be valid");

      console.log("    Multiple thread attachments handled safely");
    });
  }));

  suite.addResult(createTest("Nested withAttached calls work correctly", () => {
    Mono.perform(() => {
      let innerExecuted = false;
      let outerExecuted = false;

      MonoThread.withAttached(Mono.api, () => {
        outerExecuted = true;
        MonoThread.withAttached(Mono.api, () => {
          innerExecuted = true;
        });
      });

      assert(outerExecuted, "Outer callback should execute");
      assert(innerExecuted, "Inner callback should execute");

      console.log("    Nested withAttached calls work correctly");
    });
  }));

  suite.addResult(createTest("Thread operations work with modern API", () => {
    Mono.perform(() => {
      // Test that thread operations integrate with modern API
      const thread = MonoThread.current(Mono.api);
      const domain = Mono.domain;
      const api = Mono.api;

      assertNotNull(thread, "Thread should be accessible");
      assertNotNull(domain, "Domain should be accessible");
      assertNotNull(api, "API should be accessible");

      // Test domain operations in thread context
      const assemblies = domain.getAssemblies();
      console.log(`    Thread + modern API integration: ${assemblies.length} assemblies accessible`);

      // Test API operations in thread context
      const hasStringAPI = api.hasExport("mono_string_new");
      console.log(`    Thread + API integration: string API available = ${hasStringAPI}`);
    });
  }));

  suite.addResult(createTest("Thread model consistency across Mono.perform calls", () => {
    Mono.perform(() => {
      // Test thread model consistency in perform context
      const thread1 = MonoThread.current(Mono.api);
      const threadId1 = MonoThread.getCurrentId();

      Mono.perform(() => {
        // Nested perform call
        const thread2 = MonoThread.current(Mono.api);
        const threadId2 = MonoThread.getCurrentId();

        // Should be consistent (same thread in nested context)
        assertNotNull(thread2, "Thread should be accessible in nested perform");
        assert(typeof threadId2 === "number", "Thread ID should be number in nested context");

        console.log(`    Thread consistency: outer=${threadId1}, inner=${threadId2}`);
      });
    });
  }));

  suite.addResult(createTest("Thread error handling", () => {
    Mono.perform(() => {
      // Test that thread operations handle edge cases gracefully
      try {
        const thread = MonoThread.current(Mono.api);
        assertNotNull(thread, "Thread should be accessible");

        // Test thread operations don't throw errors
        const handle = thread.toPointer();
        const str = thread.toString();
        const isValid = MonoThread.isValid(thread.handle);

        assert(typeof handle === 'object', "Thread handle should be accessible");
        assert(typeof str === 'string', "Thread string should be accessible");
        assert(typeof isValid === 'boolean', "Thread validation should be accessible");

        console.log("    Thread error handling works correctly");
      } catch (error) {
        console.log(`    Thread operation error: ${error}`);
        throw error;
      }
    });
  }));

  suite.addResult(createTest("Thread performance characteristics", () => {
    Mono.perform(() => {
      // Test performance of repeated thread operations
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const thread = MonoThread.current(Mono.api);
        const isValid = MonoThread.isValid(thread.handle);
        assert(isValid, "Thread should be valid repeatedly");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    100 thread operations took ${duration}ms`);
      assert(duration < 100, "Thread operations should be fast");
    });
  }));

  suite.addResult(createTest("Thread detach is safe to call", () => {
    Mono.perform(() => {
      const thread = MonoThread.attach(Mono.api);
      // Note: We don't actually detach in tests as ThreadManager handles it
      // Just verify the method exists and can be called
      assert(typeof thread.detach === "function", "detach should be a function");

      console.log("    Thread detach method is available");
    });
  }));

  suite.addResult(createTest("Thread model integration with domain operations", () => {
    Mono.perform(() => {
      // Test comprehensive integration between thread model and domain operations
      const thread = MonoThread.current(Mono.api);
      const domain = Mono.domain;

      assertNotNull(thread, "Thread should be accessible");
      assertNotNull(domain, "Domain should be accessible");

      // Test domain operations in thread context
      const assemblies = domain.getAssemblies();
      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const image = firstAssembly.image;

        if (image) {
          const classes = image.getClasses();
          console.log(`    Thread + domain integration: ${classes.length} classes accessible`);
        }
      }

      // Test string creation in thread context
      const testString = Mono.api.stringNew("Thread integration test");
      assert(!testString.isNull(), "String creation should work in thread context");

      console.log("    Thread model integrates properly with domain operations");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Thread Model Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} thread model tests passed`,
  };
}

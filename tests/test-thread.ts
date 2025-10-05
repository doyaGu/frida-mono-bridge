/**
 * Thread Management Tests
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertNotNull, assertPerformWorks, assertPerformReturns, assertThrowsInPerform } from "./test-framework";

export function testThreadManagement(): TestResult {
  console.log("\nThread Management:");

  const suite = new TestSuite("Thread Management");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for basic operations", () => {
    assertPerformWorks("Mono.perform() should work for thread management");
  }));

  suite.addResult(createTest("Mono.perform should return callback results", () => {
    assertPerformReturns(() => {
      return "thread-test-result";
    }, "thread-test-result", "Mono.perform should return results");
  }));

  suite.addResult(createTest("Mono.perform should propagate exceptions", () => {
    assertThrowsInPerform(() => {
      throw new Error("Thread test error");
    }, "Thread test error", "Mono.perform should propagate exceptions");
  }));

  // Legacy thread attachment tests (updated to use modern patterns)
  suite.addResult(createTest("Thread attachment should work via Mono.perform", () => {
    Mono.perform(() => {
      // The thread should already be attached inside Mono.perform
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available (indicates thread is attached)");
      assert(!Mono.api.getRootDomain().isNull(), "Root domain should be accessible");
    });
  }));

  suite.addResult(createTest("Multiple Mono.perform calls should work", () => {
    let callCount = 0;

    Mono.perform(() => {
      callCount++;
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available in first call");
    });

    Mono.perform(() => {
      callCount++;
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available in second call");
    });

    Mono.perform(() => {
      callCount++;
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available in third call");
    });

    assert(callCount === 3, "All Mono.perform calls should execute");
  }));

  suite.addResult(createTest("Nested Mono.perform calls should work", () => {
    let nestingLevel = 0;
    let innerDomainAvailable = false;

    Mono.perform(() => {
      nestingLevel++;
      const outerDomain = Mono.domain;
      assertNotNull(outerDomain, "Outer domain should be available");

      Mono.perform(() => {
        nestingLevel++;
        const innerDomain = Mono.domain;
        assertNotNull(innerDomain, "Inner domain should be available");
        innerDomainAvailable = true;
      });
    });

    assert(nestingLevel === 2, "Should execute both nesting levels");
    assert(innerDomainAvailable, "Inner domain should be available");
  }));

  suite.addResult(createTest("Mono.perform should handle exception propagation", () => {
    let exceptionCaught = false;
    let errorMessage = "";

    try {
      Mono.perform(() => {
        throw new Error("Test exception from Mono.perform");
      });
    } catch (error: any) {
      exceptionCaught = true;
      errorMessage = error.message;
    }

    assert(exceptionCaught, "Exception should be propagated from Mono.perform");
    assert(errorMessage === "Test exception from Mono.perform", "Error message should be preserved");
  }));

  suite.addResult(createTest("Mono.perform with complex return values", () => {
    const result = Mono.perform(() => {
      const domain = Mono.domain;
      const api = Mono.api;
      const version = Mono.version;

      return {
        domainAvailable: domain !== null,
        apiAvailable: api !== null,
        versionAvailable: version !== null,
        rootDomainValid: !api.getRootDomain().isNull()
      };
    });

    assert(result.domainAvailable, "Domain should be available");
    assert(result.apiAvailable, "API should be available");
    assert(result.versionAvailable, "Version should be available");
    assert(result.rootDomainValid, "Root domain should be valid");
  }));

  // ============================================================================
  // Thread Utility Tests
  // ============================================================================

  suite.addResult(createTest("Mono.thread utilities should be available", () => {
    Mono.perform(() => {
      // Check if Mono has thread-related utilities
      assert(typeof Mono.api === "object", "API should be available for thread operations");

      // Test that we can access thread management through the API
      const rootDomain = Mono.api.getRootDomain();
      assert(!rootDomain.isNull(), "Should be able to get root domain (thread attached)");
    });
  }));

  suite.addResult(createTest("Domain operations should work within Mono.perform", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");

      // Test domain operations
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Should get assemblies array");

      // Test assembly operations
      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const assemblyName = firstAssembly.getName();
        assert(typeof assemblyName === "string", "Assembly name should be a string");
      }
    });
  }));

  suite.addResult(createTest("API operations should work within Mono.perform", () => {
    Mono.perform(() => {
      const api = Mono.api;
      assertNotNull(api, "API should be available");

      // Test basic API operations
      assert(typeof api.hasExport === "function", "API should have hasExport method");
      assert(typeof api.getRootDomain === "function", "API should have getRootDomain method");

      // Test that core exports are available
      const hasRootDomain = api.hasExport("mono_get_root_domain");
      assert(hasRootDomain, "mono_get_root_domain should be available");
    });
  }));

  suite.addResult(createTest("Version information should be accessible", () => {
    Mono.perform(() => {
      const version = Mono.version;
      assertNotNull(version, "Version should be available");

      assert(typeof version.features === "object", "Version features should be available");
      assert(typeof version.features.delegateThunk === "boolean", "Delegate thunk feature should be available");
      assert(typeof version.features.metadataTables === "boolean", "Metadata tables feature should be available");
      assert(typeof version.features.gcHandles === "boolean", "GC handles feature should be available");
      assert(typeof version.features.internalCalls === "boolean", "Internal calls feature should be available");
    });
  }));

  // ============================================================================
  // Advanced Thread Management Tests
  // ============================================================================

  suite.addResult(createTest("Complex nested operations with returns", () => {
    const result = Mono.perform(() => {
      const outerResult = Mono.perform(() => {
        const innerResult = Mono.perform(() => {
          return "deep-nested-result";
        });
        return `outer-${innerResult}`;
      });
      return `final-${outerResult}`;
    });

    assert(result === "final-outer-deep-nested-result", "Complex nesting should work with return values");
  }));

  suite.addResult(createTest("Error handling in nested operations", () => {
    let errorCaughtAtCorrectLevel = false;

    try {
      Mono.perform(() => {
        try {
          Mono.perform(() => {
            throw new Error("Inner error");
          });
        } catch (innerError: any) {
          assert(innerError.message === "Inner error", "Inner error should be caught");
          errorCaughtAtCorrectLevel = true;
          // Don't re-throw, handle the error at this level
        }

        // Should continue execution here
        const domain = Mono.domain;
        assertNotNull(domain, "Should still be able to access domain after handling error");
      });
    } catch (outerError) {
      // Should not reach here
      assert(false, "Should not have uncaught exception at outer level");
    }

    assert(errorCaughtAtCorrectLevel, "Error should be caught at correct level");
  }));

  suite.addResult(createTest("Performance: Many rapid Mono.perform calls", () => {
    const startTime = Date.now();
    const iterations = 100;
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        Mono.perform(() => {
          const domain = Mono.domain;
          if (domain) successCount++;
        });
      } catch (error) {
        // Count failures
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    assert(successCount === iterations, `All ${iterations} calls should succeed`);
    assert(duration < 1000, `100 calls should complete in under 1 second (took ${duration}ms)`);
  }));

  const summary = suite.getSummary();

  return {
    name: "Thread Management Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} thread tests passed`,
  };
}
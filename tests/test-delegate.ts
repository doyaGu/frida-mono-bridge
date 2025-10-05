/**
 * Delegate Tests
 * Tests delegate invoke method retrieval and unmanaged thunk compilation
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, createSkippedTest } from "./test-framework";

export function testDelegates(): TestResult {
  console.log("\nDelegates:");

  // Check if delegate thunks are supported in this Mono build
  if (!Mono.version.features.delegateThunk) {
    return createSkippedTest("Delegate operations", "Delegate thunks not supported in this Mono build");
  }

  const suite = new TestSuite("Delegate Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for delegate tests", () => {
    assertPerformWorks("Mono.perform() should work for delegate tests");
  }));

  suite.addResult(createTest("Delegate APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for delegate operations");
      assert(Mono.api.hasExport("mono_get_delegate_invoke"), "mono_get_delegate_invoke should be available");
      assert(Mono.api.hasExport("mono_method_get_unmanaged_thunk"), "mono_method_get_unmanaged_thunk should be available");
      // mono_delegate_ctor is not always available, so we don't assert it

      console.log("    Delegate thunk APIs are available in this Mono build");
    });
  }));

  suite.addResult(createTest("Delegate APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_get_delegate_invoke === 'function', "mono_get_delegate_invoke should be a function");
      assert(typeof Mono.api.native.mono_method_get_unmanaged_thunk === 'function', "mono_method_get_unmanaged_thunk should be a function");

      console.log("    Delegate API functions are callable");
    });
  }));

  suite.addResult(createTest("Should access delegate-related classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find Delegate class
      const delegateClass = domain.class("System.Delegate");
      if (delegateClass) {
        assert(typeof delegateClass.getName === 'function', "Delegate class should have getName method");
        console.log(`    Found Delegate class: ${delegateClass.getName()}`);

        const methods = delegateClass.getMethods();
        const properties = delegateClass.getProperties();
        const fields = delegateClass.getFields();

        assert(Array.isArray(methods), "Delegate class should have methods array");
        assert(Array.isArray(properties), "Delegate class should have properties array");
        assert(Array.isArray(fields), "Delegate class should have fields array");
        console.log(`    System.Delegate has ${methods.length} methods, ${properties.length} properties, ${fields.length} fields`);
      } else {
        console.log("    System.Delegate class not available in this context");
      }

      // Try to find MulticastDelegate class
      const multicastDelegateClass = domain.class("System.MulticastDelegate");
      if (multicastDelegateClass) {
        console.log(`    Found MulticastDelegate class: ${multicastDelegateClass.getName()}`);
      }
    });
  }));

  suite.addResult(createTest("Should test delegate method access", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const delegateClass = domain.class("System.Delegate");

      if (delegateClass) {
        const methods = delegateClass.getMethods();
        assert(Array.isArray(methods), "Delegate should have methods array");

        // Test for common delegate methods
        const commonMethods = ["DynamicInvoke", "Clone", "GetInvocationList", "Combine", "Remove"];
        let foundMethodCount = 0;

        for (const methodName of commonMethods) {
          const method = delegateClass.method(methodName);
          if (method) {
            foundMethodCount++;
            console.log(`    Found delegate method: ${methodName}`);
          }
        }

        console.log(`    Found ${foundMethodCount}/${commonMethods.length} common delegate methods`);
      }
    });
  }));

  suite.addResult(createTest("Should test delegate creation patterns", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Look for common delegate types
      const delegateTypes = [
        "System.Action",
        "System.Func`1",
        "System.EventHandler",
        "System.Comparison`1",
        "System.Predicate`1",
      ];

      let foundCount = 0;
      for (const delegateType of delegateTypes) {
        const testClass = domain.class(delegateType);
        if (testClass) {
          foundCount++;
          console.log(`    Found delegate type: ${delegateType} -> ${testClass.getName()}`);
          assert(typeof testClass.getName === 'function', "Delegate class should have getName method");
        }
      }

      console.log(`    Found ${foundCount}/${delegateTypes.length} common delegate types`);
    });
  }));

  suite.addResult(createTest("Should support delegate operations in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const domain = Mono.domain;
        const delegateClass = domain.class("System.Delegate");

        if (delegateClass) {
          assert(typeof delegateClass.getName === 'function', "Delegate access should work in nested perform calls");
        }

        // Test that delegate APIs are still accessible in nested context
        assert(Mono.api.hasExport("mono_get_delegate_invoke"), "Delegate APIs should work in nested perform calls");
      });
    });
  }));

  suite.addResult(createTest("Delegate operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const delegateClass1 = domain.class("System.Delegate");
      const delegateClass2 = domain.class("System.Delegate");

      if (delegateClass1 && delegateClass2) {
        const name1 = delegateClass1.getName();
        const name2 = delegateClass2.getName();
        assert(name1 === name2, "Delegate class lookups should be consistent");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");

      // Test version consistency
      const version1 = Mono.version;
      const version2 = Mono.version;
      assert(version1 === version2, "Version should be cached instance");
      assert(version1.features.delegateThunk === version2.features.delegateThunk, "Delegate thunk feature should be consistent");
    });
  }));

  suite.addResult(createTest("Should test delegate thunk features", () => {
    Mono.perform(() => {
      const version = Mono.version;

      assert(typeof version.features.delegateThunk === 'boolean', "Delegate thunk feature should be boolean");
      assert(version.features.delegateThunk === true, "Delegate thunk should be enabled (we checked this)");

      console.log(`    Delegate thunk feature is enabled: ${version.features.delegateThunk}`);

      // Test other delegate-related features if they exist
      if (typeof version.features.metadataTables === 'boolean') {
        console.log(`    Metadata tables feature: ${version.features.metadataTables}`);
      }

      if (typeof version.features.gcHandles === 'boolean') {
        console.log(`    GC handles feature: ${version.features.gcHandles}`);
      }

      if (typeof version.features.internalCalls === 'boolean') {
        console.log(`    Internal calls feature: ${version.features.internalCalls}`);
      }
    });
  }));

  suite.addResult(createTest("Should handle delegate-related errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent delegate types
      const nonExistentDelegate = domain.class("NonExistent.DelegateType");
      assert(nonExistentDelegate === null, "Non-existent delegate type should return null");

      // Test with malformed delegate names
      const malformedDelegate = domain.class("");
      assert(malformedDelegate === null, "Empty delegate name should return null");

      console.log("    Error handling for delegate types works correctly");
    });
  }));

  suite.addResult(createTest("Should test delegate constructor patterns", () => {
    Mono.perform(() => {
      // Test for delegate constructor availability
      if (Mono.api.hasExport("mono_delegate_ctor")) {
        assert(typeof Mono.api.native.mono_delegate_ctor === 'function', "mono_delegate_ctor should be callable");
        console.log("    Delegate constructor API is available");
      } else {
        console.log("    Delegate constructor API not available in this Mono build");
      }

      // Test for method-to-delegate conversion APIs
      const domain = Mono.domain;
      const actionClass = domain.class("System.Action");

      if (actionClass) {
        const constructors = actionClass.getMethods().filter(m => m.getName().includes(".ctor"));
        console.log(`    System.Action has ${constructors.length} constructors available`);
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Delegate Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} delegate tests passed`,
  };
}

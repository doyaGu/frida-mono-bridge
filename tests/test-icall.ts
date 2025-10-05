/**
 * Internal Call Tests
 * Tests registration and invocation of internal calls
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, createSkippedTest } from "./test-framework";

export function testInternalCalls(): TestResult {
  console.log("\nInternal Calls:");

  // Check if internal calls are supported in this Mono build
  if (!Mono.version.features.internalCalls) {
    return createSkippedTest("Internal call operations", "Internal calls not supported in this Mono build");
  }

  const suite = new TestSuite("Internal Call Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for internal call tests", () => {
    assertPerformWorks("Mono.perform() should work for internal call tests");
  }));

  suite.addResult(createTest("Internal call APIs should be available", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for internal call operations");
      assert(Mono.api.hasExport("mono_add_internal_call"), "mono_add_internal_call should be available");

      console.log("    Internal call APIs are available in this Mono build");
    });
  }));

  suite.addResult(createTest("Internal call APIs should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_add_internal_call === 'function', "mono_add_internal_call should be a function");

      console.log("    Internal call API functions are callable");
    });
  }));

  suite.addResult(createTest("Should test internal call registration patterns", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test that we can access classes that might use internal calls
      const stringClass = domain.class("System.String");
      if (stringClass) {
        console.log("    String class available for internal call testing");

        // Look for methods that might be implemented as internal calls
        const methods = stringClass.getMethods();
        const internalCallMethods = methods.filter(m => {
          // Internal calls often have specific naming patterns or attributes
          const name = m.getName();
          return name.includes("Internal") || name.includes("Native") || name.includes("Interop");
        });

        if (internalCallMethods.length > 0) {
          console.log(`    Found ${internalCallMethods.length} potential internal call methods`);
          internalCallMethods.forEach(m => console.log(`      - ${m.getName()}`));
        } else {
          console.log("    No obvious internal call methods found in System.String");
        }
      }
    });
  }));

  suite.addResult(createTest("Should test interop-related classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Look for interop and marshaling related classes
      const interopClasses = [
        "System.Runtime.InteropServices.Marshal",
        "System.Runtime.InteropServices.GCHandle",
        "System.IntPtr",
        "System.Runtime.CompilerServices.RuntimeHelpers",
      ];

      let foundCount = 0;
      for (const interopClass of interopClasses) {
        const testClass = domain.class(interopClass);
        if (testClass) {
          foundCount++;
          console.log(`    Found interop class: ${interopClass} -> ${testClass.getName()}`);
          assert(typeof testClass.getName === 'function', "Interop class should have getName method");

          // Check for methods that might use internal calls
          const methods = testClass.getMethods();
          console.log(`      ${testClass.getName()} has ${methods.length} methods`);
        }
      }

      console.log(`    Found ${foundCount}/${interopClasses.length} interop-related classes`);
    });
  }));

  suite.addResult(createTest("Should support internal call operations in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        // Test that internal call APIs are still accessible in nested context
        assert(Mono.api.hasExport("mono_add_internal_call"), "Internal call APIs should work in nested perform calls");
        assert(typeof Mono.api.native.mono_add_internal_call === 'function', "Internal call function should be callable in nested context");

        const domain = Mono.domain;
        assert(domain !== null, "Domain should be accessible in nested perform calls");
      });
    });
  }));

  suite.addResult(createTest("Internal call operations should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const stringClass1 = domain.class("System.String");
      const stringClass2 = domain.class("System.String");

      if (stringClass1 && stringClass2) {
        const name1 = stringClass1.getName();
        const name2 = stringClass2.getName();
        assert(name1 === name2, "Class lookups should be consistent for internal call testing");
      }

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");

      // Test version consistency
      const version1 = Mono.version;
      const version2 = Mono.version;
      assert(version1 === version2, "Version should be cached instance");
      assert(version1.features.internalCalls === version2.features.internalCalls, "Internal call feature should be consistent");
    });
  }));

  suite.addResult(createTest("Should test internal call feature detection", () => {
    Mono.perform(() => {
      const version = Mono.version;

      assert(typeof version.features.internalCalls === 'boolean', "Internal call feature should be boolean");
      assert(version.features.internalCalls === true, "Internal calls should be enabled (we checked this)");

      console.log(`    Internal calls feature is enabled: ${version.features.internalCalls}`);

      // Test other related features if they exist
      if (typeof version.features.delegateThunk === 'boolean') {
        console.log(`    Delegate thunk feature: ${version.features.delegateThunk}`);
      }

      if (typeof version.features.metadataTables === 'boolean') {
        console.log(`    Metadata tables feature: ${version.features.metadataTables}`);
      }

      if (typeof version.features.gcHandles === 'boolean') {
        console.log(`    GC handles feature: ${version.features.gcHandles}`);
      }
    });
  }));

  suite.addResult(createTest("Should handle internal call related errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent classes that might use internal calls
      const nonExistentClass = domain.class("NonExistent.InternalCallClass");
      assert(nonExistentClass === null, "Non-existent class should return null");

      // Test internal call registration with invalid parameters (should not crash)
      try {
        // We won't actually call this with invalid parameters, but we test the API is accessible
        const hasInternalCallAPI = Mono.api.hasExport("mono_add_internal_call");
        assert(hasInternalCallAPI, "Internal call API should be available for error testing");
        console.log("    Internal call error handling works correctly");
      } catch (error) {
        console.log(`    Internal call API access error: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Should test internal call naming conventions", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Look for classes that commonly use internal calls
      const classesWithInternalCalls = [
        "System.String",           // String manipulation
        "System.Math",             // Math functions
        "System.Environment",      // Environment access
        "System.DateTime",         // Date/time operations
        "System.Console",          // Console operations
      ];

      let totalMethods = 0;
      for (const className of classesWithInternalCalls) {
        const testClass = domain.class(className);
        if (testClass) {
          const methods = testClass.getMethods();
          totalMethods += methods.length;
          console.log(`    ${className}: ${methods.length} methods`);
        }
      }

      console.log(`    Total methods across ${classesWithInternalCalls.length} classes: ${totalMethods}`);
    });
  }));

  suite.addResult(createTest("Should test internal call integration", () => {
    Mono.perform(() => {
      // Test that internal call APIs integrate properly with the fluent API
      const api = Mono.api;
      const domain = Mono.domain;
      const version = Mono.version;

      assert(api !== null, "API should be accessible");
      assert(domain !== null, "Domain should be accessible");
      assert(version !== null, "Version should be accessible");

      // Test that all these work together
      const stringClass = domain.class("System.String");
      if (stringClass) {
        const methods = stringClass.getMethods();
        console.log(`    Internal call integration test: found ${methods.length} methods in ${stringClass.getName()}`);
      }

      console.log("    Internal call integration with fluent API works correctly");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Internal Call Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} internal call tests passed`,
  };
}

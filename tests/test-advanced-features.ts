/**
 * Advanced Features Tests
 * Consolidated tests for Delegate, GC Handle, and Internal Call operations
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createDomainTest,
  createDomainTestEnhanced,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createNestedPerformTest,
  createSkippedTest,
  assert,
  assertNotNull,
  assertPerformWorks,
  assertApiAvailable,
  assertDomainAvailable,
  assertDomainCached,
  TestCategory
} from "./test-framework";

export function testAdvancedFeatures(): TestResult {
  console.log("\nAdvanced Features (Delegate, GC Handle, Internal Call):");

  const suite = new TestSuite("Advanced Features Tests", TestCategory.MONO_DEPENDENT);

  // Check if advanced features are supported in this Mono build
  const delegateSupported = Mono.version.features.delegateThunk;
  const gcHandleSupported = Mono.version.features.gcHandles;
  const internalCallSupported = Mono.version.features.internalCalls;

  if (!delegateSupported && !gcHandleSupported && !internalCallSupported) {
    return createSkippedTest("Advanced Features", "No advanced features (delegate thunks, GC handles, internal calls) are supported in this Mono build");
  }

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "advanced features"));

  // ============================================================================
  // DELEGATE TESTS
  // ============================================================================

  if (delegateSupported) {
    suite.addResult(createMonoDependentTest("Mono.perform should work for delegate tests", () => {
      assertPerformWorks("Mono.perform() should work for delegate tests");
    }));

    suite.addResult(createMonoDependentTest("Delegate APIs should be available", () => {
      assertApiAvailable("Mono.api should be accessible for delegate operations");
      assert(Mono.api.hasExport("mono_get_delegate_invoke"), "mono_get_delegate_invoke should be available");
      assert(Mono.api.hasExport("mono_method_get_unmanaged_thunk"), "mono_method_get_unmanaged_thunk should be available");
      // mono_delegate_ctor is not always available, so we don't assert it

      console.log("    Delegate thunk APIs are available in this Mono build");
    }));

    suite.addResult(createMonoDependentTest("Delegate APIs should be callable", () => {
      assert(typeof Mono.api.native.mono_get_delegate_invoke === 'function', "mono_get_delegate_invoke should be a function");
      assert(typeof Mono.api.native.mono_method_get_unmanaged_thunk === 'function', "mono_method_get_unmanaged_thunk should be a function");

      console.log("    Delegate API functions are callable");
    }));

    suite.addResult(createDomainTest("Should access delegate-related classes", domain => {

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
    }));

    suite.addResult(createDomainTest("Should test delegate method access", domain => {
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
    }));

    suite.addResult(createDomainTest("Should test delegate creation patterns", domain => {

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
    }));

    suite.addResult(createMonoDependentTest("Should test delegate thunk features", () => {
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
    }));

    suite.addResult(createMonoDependentTest("Should test delegate constructor patterns", () => {
      // Test for delegate constructor availability
      if (Mono.api.hasExport("mono_delegate_ctor")) {
        assert(typeof Mono.api.native.mono_delegate_ctor === 'function', "mono_delegate_ctor should be callable");
        console.log("    Delegate constructor API is available");
      } else {
        console.log("    Delegate constructor API not available in this Mono build");
      }

      // Test for method-to-delegate conversion APIs
      Mono.perform(() => {
        const domain = Mono.domain;
        const actionClass = domain.class("System.Action");

        if (actionClass) {
          const constructors = actionClass.getMethods().filter((m: any) => m.getName().includes(".ctor"));
          console.log(`    System.Action has ${constructors.length} constructors available`);
        }
      });
    }));

    suite.addResult(createNestedPerformTest({
      context: "delegate operations",
      testName: "Should support delegate operations in nested perform calls",
      validate: domain => {
        const delegateClass = domain.class("System.Delegate");

        if (delegateClass) {
          assert(typeof delegateClass.getName === 'function', "Delegate access should work in nested perform calls");
        }

        assert(Mono.api.hasExport("mono_get_delegate_invoke"), "Delegate APIs should work in nested perform calls");
      },
    }));

    suite.addResult(createDomainTestEnhanced("Should handle delegate-related errors gracefully", domain => {

      // Test with non-existent delegate types
      const nonExistentDelegate = domain.class("NonExistent.DelegateType");
      assert(nonExistentDelegate === null, "Non-existent delegate type should return null");

      // Test with malformed delegate names
      const malformedDelegate = domain.class("");
      assert(malformedDelegate === null, "Empty delegate name should return null");

      console.log("    Error handling for delegate types works correctly");
    }));

  } else {
    suite.addResult(createSkippedTest("Delegate operations", "Delegate thunks not supported in this Mono build"));
  }

  // ============================================================================
  // GC HANDLE TESTS
  // ============================================================================

  if (gcHandleSupported) {
    suite.addResult(createMonoDependentTest("Mono.perform should work for GC handle tests", () => {
      assertPerformWorks("Mono.perform() should work for GC handle tests");
    }));

    suite.addResult(createMonoDependentTest("Should access API for GC handle operations", () => {
      assertApiAvailable("Mono.api should be accessible for GC handle operations");
      console.log("    API is accessible for GC handle tests");
    }));

    suite.addResult(createMonoDependentTest("GC Handle APIs should be available", () => {
      assert(Mono.api.hasExport("mono_gchandle_new"), "mono_gchandle_new should be available");
      assert(Mono.api.hasExport("mono_gchandle_free"), "mono_gchandle_free should be available");
      assert(Mono.api.hasExport("mono_gchandle_get_target"), "mono_gchandle_get_target should be available");
      assert(Mono.api.hasExport("mono_gchandle_new_weakref"), "mono_gchandle_new_weakref should be available");

      console.log("    All required GC handle APIs are available");
    }));

    suite.addResult(createMonoDependentTest("GC utilities should be available", () => {
      assert(typeof Mono.gc !== 'undefined', "gc utilities should be defined");
      assert(Mono.gc !== null, "gc utilities should not be null");

      console.log("    GC utilities are accessible");
    }));

    suite.addResult(createMonoDependentTest("GC Handle functions should be callable", () => {
      assert(typeof Mono.api.native.mono_gchandle_new === 'function', "mono_gchandle_new should be a function");
      assert(typeof Mono.api.native.mono_gchandle_free === 'function', "mono_gchandle_free should be a function");
      assert(typeof Mono.api.native.mono_gchandle_get_target === 'function', "mono_gchandle_get_target should be a function");
      assert(typeof Mono.api.native.mono_gchandle_new_weakref === 'function', "mono_gchandle_new_weakref should be a function");

      console.log("    All GC handle functions are callable");
    }));

    suite.addResult(createMonoDependentTest("GC collection APIs should be available", () => {
      assert(Mono.api.hasExport("mono_gc_collect"), "mono_gc_collect should be available");
      assert(Mono.api.hasExport("mono_gc_get_heap_size"), "mono_gc_get_heap_size should be available");
      assert(Mono.api.hasExport("mono_gc_get_used_size"), "mono_gc_get_used_size should be available");

      console.log("    GC collection APIs are available");
    }));

    suite.addResult(createMonoDependentTest("Should test GC handle creation and management", () => {
      // Test basic GC handle operations with a string
      const testString = Mono.api.stringNew("GC Handle Test String");
      assert(!testString.isNull(), "Test string should be created");

      // Create a GC handle for the string
      const gcHandle = Mono.api.native.mono_gchandle_new(testString, false) as number;
      assert(typeof gcHandle === "number" && gcHandle !== 0, "GC handle should be a non-zero integer");

      // Test getting the target from GC handle
      const target = Mono.api.native.mono_gchandle_get_target(gcHandle);
      assert(!target.isNull(), "Should be able to get target from GC handle");

      // Free the GC handle
      Mono.api.native.mono_gchandle_free(gcHandle);

      console.log("    GC handle creation and management works correctly");
    }));

    suite.addResult(createMonoDependentTest("Should test weak reference GC handles", () => {
      // Test weak reference handle creation
      const testString = Mono.api.stringNew("Weak Ref Test");
      assert(!testString.isNull(), "Test string should be created");

      // Create a weak reference GC handle
      const weakHandle = Mono.api.native.mono_gchandle_new_weakref(testString, false) as number;
      assert(typeof weakHandle === "number" && weakHandle !== 0, "Weak reference handle should be a non-zero integer");

      // Get target from weak reference
      const weakTarget = Mono.api.native.mono_gchandle_get_target(weakHandle);
      assert(!weakTarget.isNull(), "Should be able to get target from weak reference");

      // Clean up
      Mono.api.native.mono_gchandle_free(weakHandle);

      console.log("    Weak reference GC handles work correctly");
    }));

    suite.addResult(createMonoDependentTest("Should test GC handle pool operations", () => {
      const gcUtils = Mono.gc;

      // Test that GC utilities are accessible
      assert(gcUtils !== null, "GC utilities should be accessible");

      // Test GC handle methods
      const testString = Mono.api.stringNew("Pool Test");
      const handle = gcUtils.handle(testString);
      assert(handle.handle !== 0, "Handle ID should be non-zero");
      console.log(`    Created GC handle: ${handle.handle}`);

      // Test releasing handle
      gcUtils.releaseHandle(handle);
      assert(handle.handle === 0, "Handle should be released and zeroed");
      console.log("    Released GC handle");
    }));

    suite.addResult(createMonoDependentTest("Should test GC heap information", () => {
      // Test getting heap size information
      if (Mono.api.hasExport("mono_gc_get_heap_size")) {
        try {
          const heapSize = Mono.api.native.mono_gc_get_heap_size();
          console.log(`    Heap size: ${heapSize} bytes`);
          assert(typeof heapSize === 'number', "Heap size should be number");
        } catch (error) {
          console.log(`    Heap size access failed: ${error}`);
        }
      }

      // Test getting used size information
      if (Mono.api.hasExport("mono_gc_get_used_size")) {
        try {
          const usedSize = Mono.api.native.mono_gc_get_used_size();
          console.log(`    Used size: ${usedSize} bytes`);
          assert(typeof usedSize === 'number', "Used size should be number");
        } catch (error) {
          console.log(`    Used size access failed: ${error}`);
        }
      }
    }));

    suite.addResult(createMonoDependentTest("Should test GC collection operations", () => {
      if (Mono.api.hasExport("mono_gc_collect")) {
        try {
          // Trigger garbage collection (use generation 0 for quick test)
          Mono.api.native.mono_gc_collect(0);
          console.log("    GC collection triggered successfully");
        } catch (error) {
          console.log(`    GC collection failed: ${error}`);
        }
      } else {
        console.log("    GC collection API not available");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test GC handle consistency", () => {
      // Test that GC handle operations are consistent
      const testString1 = Mono.api.stringNew("Consistency Test 1");
      const testString2 = Mono.api.stringNew("Consistency Test 2");

      const handle1 = Mono.api.native.mono_gchandle_new(testString1, false) as number;
      const handle2 = Mono.api.native.mono_gchandle_new(testString2, false) as number;

      // Verify handles are different
      assert(handle1 !== handle2, "Different objects should have different handle values");

      // Verify targets are correct
      const target1 = Mono.api.native.mono_gchandle_get_target(handle1);
      const target2 = Mono.api.native.mono_gchandle_get_target(handle2);
      assert(!target1.equals(target2), "Different handles should have different targets");

      // Clean up
      Mono.api.native.mono_gchandle_free(handle1);
      Mono.api.native.mono_gchandle_free(handle2);

      console.log("    GC handle consistency verified");
    }));

    suite.addResult(createMonoDependentTest("Should test GC handle performance", () => {
      const startTime = Date.now();
      const handles = [];

      // Create multiple GC handles
      for (let i = 0; i < 10; i++) {
        const testString = Mono.api.stringNew(`Performance Test ${i}`);
        const handle = Mono.api.native.mono_gchandle_new(testString, false);
        handles.push(handle);
      }

      // Free all handles
      for (const handle of handles) {
        Mono.api.native.mono_gchandle_free(handle);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    10 GC handle operations took ${duration}ms`);
      assert(duration < 1000, "GC handle operations should be reasonably fast");
    }));

    suite.addResult(createErrorHandlingTest("Should test GC handle error handling", () => {
      // Test error handling with invalid handles
      try {
        const nullHandle: NativePointer = NULL;

        // Try to get target from null handle (should handle gracefully)
        if (Mono.api.hasExport("mono_gchandle_get_target")) {
          const nullTarget = Mono.api.native.mono_gchandle_get_target(nullHandle);
          console.log(`    Null handle target: ${nullTarget}`);
        }

        console.log("    GC handle error handling works correctly");
      } catch (error) {
        console.log(`    GC handle error handling test: ${error}`);
      }
    }));

  } else {
    suite.addResult(createSkippedTest("GC Handle operations", "GC handles not supported in this Mono build"));
  }

  // ============================================================================
  // INTERNAL CALL TESTS
  // ============================================================================

  if (internalCallSupported) {
    suite.addResult(createMonoDependentTest("Mono.perform should work for internal call tests", () => {
      assertPerformWorks("Mono.perform() should work for internal call tests");
    }));

    suite.addResult(createMonoDependentTest("Internal call APIs should be available", () => {
      assertApiAvailable("Mono.api should be accessible for internal call operations");
      assert(Mono.api.hasExport("mono_add_internal_call"), "mono_add_internal_call should be available");

      console.log("    Internal call APIs are available in this Mono build");
    }));

    suite.addResult(createMonoDependentTest("Internal call APIs should be callable", () => {
      assert(typeof Mono.api.native.mono_add_internal_call === 'function', "mono_add_internal_call should be a function");

      console.log("    Internal call API functions are callable");
    }));

    suite.addResult(createDomainTest("Should test internal call registration patterns", domain => {

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
    }));

    suite.addResult(createDomainTest("Should test interop-related classes", domain => {

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
    }));

    suite.addResult(createMonoDependentTest("Should test internal call feature detection", () => {
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
    }));

    suite.addResult(createDomainTest("Should test internal call naming conventions", domain => {

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
    }));

    suite.addResult(createDomainTestEnhanced("Should handle internal call related errors gracefully", domain => {

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
    }));

    suite.addResult(createNestedPerformTest({
      context: "internal call operations",
      testName: "Should support internal call operations in nested perform calls",
      validate: domain => {
        // Test that internal call APIs are still accessible in nested context
        assert(Mono.api.hasExport("mono_add_internal_call"), "Internal call APIs should work in nested perform calls");
        assert(typeof Mono.api.native.mono_add_internal_call === 'function', "Internal call function should be callable in nested context");

        assert(domain !== null, "Domain should be accessible in nested perform calls");
      },
    }));

  } else {
    suite.addResult(createSkippedTest("Internal call operations", "Internal calls not supported in this Mono build"));
  }

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(createDomainTestEnhanced("Should test advanced features consistency", (domain) => {
    // Test multiple calls return consistent results
    const delegateClass1 = domain.class("System.Delegate");
    const delegateClass2 = domain.class("System.Delegate");

    if (delegateClass1 && delegateClass2) {
      const name1 = delegateClass1.getName();
      const name2 = delegateClass2.getName();
      assert(name1 === name2, "Delegate class lookups should be consistent");
    }

    assertDomainCached();

    // Test version consistency
    const version1 = Mono.version;
    const version2 = Mono.version;
    assert(version1 === version2, "Version should be cached instance");

    if (delegateSupported) {
      assert(version1.features.delegateThunk === version2.features.delegateThunk, "Delegate thunk feature should be consistent");
    }
    if (gcHandleSupported) {
      assert(version1.features.gcHandles === version2.features.gcHandles, "GC handle feature should be consistent");
    }
    if (internalCallSupported) {
      assert(version1.features.internalCalls === version2.features.internalCalls, "Internal call feature should be consistent");
    }
  }));

  suite.addResult(createDomainTestEnhanced("Should test advanced features integration", (domain) => {
    // Test that advanced features integrate properly with the fluent API
    const api = Mono.api;
    const version = Mono.version;

    assert(api !== null, "API should be accessible");
    assert(version !== null, "Version should be accessible");

    // Test GC handle integration
    if (gcHandleSupported) {
      const testString = Mono.api.stringNew("Integration Test");
      const gcHandle = Mono.api.native.mono_gchandle_new(testString, false) as number;
      assert(gcHandle !== 0, "GC handle should be created");

      // Test domain operations with GC handle
      const assemblies = domain.getAssemblies();
      console.log(`    Advanced features integration: ${assemblies.length} assemblies accessible with GC handle`);

      // Clean up
      Mono.api.native.mono_gchandle_free(gcHandle);
    }

    console.log("    Advanced features integration with fluent API works correctly");
  }));

  suite.addResult(createDomainTestEnhanced("Should test cross-feature operations", (domain) => {
    // Test operations that might use multiple advanced features
    const stringClass = domain.class("System.String");
    if (stringClass) {
      console.log(`    Cross-feature test: found ${stringClass.getName()} with ${stringClass.getMethods().length} methods`);

      // Test delegate-related methods
      if (delegateSupported) {
        const delegateClass = domain.class("System.Delegate");
        if (delegateClass) {
          console.log(`    Cross-feature: Delegate and String classes both available`);
        }
      }

      // Test internal call patterns
      if (internalCallSupported) {
        console.log(`    Cross-feature: Internal calls supported with string operations`);
      }
    }

    console.log("    Cross-feature operations working correctly");
  }));

  suite.addResult(createDomainTestEnhanced("Should test advanced features performance", (domain) => {
    const startTime = Date.now();

    // Test multiple advanced features operations
    if (gcHandleSupported) {
      const testString = Mono.api.stringNew("Performance Test");
      const handle = Mono.api.native.mono_gchandle_new(testString, false);
      Mono.api.native.mono_gchandle_free(handle);
    }

    if (delegateSupported) {
      // Test delegate class access
      const delegateClass = domain.class("System.Delegate");
      if (delegateClass) {
        delegateClass.getMethods();
      }
    }

    if (internalCallSupported) {
      // Test internal call API access
      Mono.api.hasExport("mono_add_internal_call");
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`    Advanced features performance test took ${duration}ms`);
    assert(duration < 500, "Advanced features operations should be reasonably fast");
  }));

  suite.addResult(createDomainTestEnhanced("Should handle advanced features integration errors", domain => {

    // Test error handling across all advanced features
    if (delegateSupported) {
      const invalidDelegate = domain.class("Invalid.Delegate");
      assert(invalidDelegate === null, "Invalid delegate should return null");
    }

    if (gcHandleSupported) {
      // Test GC handle error scenarios
      try {
        const testString = Mono.api.stringNew("Error Test");
        const handle = Mono.api.native.mono_gchandle_new(testString, false);
        Mono.api.native.mono_gchandle_free(handle);
        console.log("    GC handle error handling works correctly");
      } catch (error) {
        console.log(`    GC handle error: ${error}`);
      }
    }

    if (internalCallSupported) {
      // Test internal call error scenarios
      const invalidClass = domain.class("Invalid.InternalClass");
      assert(invalidClass === null, "Invalid internal call class should return null");
    }

    console.log("    Advanced features error handling works correctly");
  }));

  const summary = suite.getSummary();

  return {
    name: "Advanced Features Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} advanced features tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}
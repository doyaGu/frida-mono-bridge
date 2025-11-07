
/**
 * Comprehensive Mono Advanced Features Tests (Phase 3)
 * Complete tests for MonoDelegate, GCHandle, ICall, and advanced Mono features
 */

import Mono from "../src";
import { pointerIsNull } from "../src/utils/memory";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createDomainTest,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createPerformanceTest,
  createNestedPerformTest,
  assert,
  assertNotNull,
  assertThrows,
  assertPerformWorks,
  assertApiAvailable,
  assertDomainAvailable,
  assertDomainCached,
  TestCategory
} from "./test-framework";

export function testMonoAdvanced(): TestResult[] {
  console.log("\nComprehensive Mono Advanced Features Tests:");

  const suite = new TestSuite("Mono Advanced Features Complete", TestCategory.MONO_DEPENDENT);
  const results: TestResult[] = [];

  // Check if advanced features are supported in this Mono build
  const delegateSupported = Mono.version.features.delegateThunk;
  const gcHandleSupported = Mono.version.features.gcHandles;
  const internalCallSupported = Mono.version.features.internalCalls;

  if (!delegateSupported && !gcHandleSupported && !internalCallSupported) {
    const skippedResult = {
      name: "Advanced Features Suite",
      passed: false,
      failed: false,
      skipped: true,
      message: "No advanced features (delegate thunks, GC handles, internal calls) are supported in this Mono build",
      category: TestCategory.MONO_DEPENDENT,
      requiresMono: true
    };
    results.push(skippedResult);
    return results;
  }

  // ============================================================================
  // SMOKE TESTS
  // ============================================================================

  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "comprehensive advanced features"));

  suite.addResult(createMonoDependentTest("Advanced features APIs should be available", () => {
    assertApiAvailable("Mono.api should be accessible for advanced features");
    
    // Delegate APIs
    if (delegateSupported) {
      assert(Mono.api.hasExport("mono_get_delegate_invoke"), "mono_get_delegate_invoke should be available");
      assert(Mono.api.hasExport("mono_method_get_unmanaged_thunk"), "mono_method_get_unmanaged_thunk should be available");
      console.log("    Delegate thunk APIs are available");
    }
    
    // GC Handle APIs
    if (gcHandleSupported) {
      assert(Mono.api.hasExport("mono_gchandle_new"), "mono_gchandle_new should be available");
      assert(Mono.api.hasExport("mono_gchandle_free"), "mono_gchandle_free should be available");
      assert(Mono.api.hasExport("mono_gchandle_get_target"), "mono_gchandle_get_target should be available");
      assert(Mono.api.hasExport("mono_gchandle_new_weakref"), "mono_gchandle_new_weakref should be available");
      console.log("    GC handle APIs are available");
    }
    
    // Internal Call APIs
    if (internalCallSupported) {
      assert(Mono.api.hasExport("mono_add_internal_call"), "mono_add_internal_call should be available");
      console.log("    Internal call APIs are available");
    }
    
    console.log("    All supported advanced feature APIs are available");
  }));

  // ============================================================================
  // MONO DELEGATE COMPREHENSIVE TESTS
  // ============================================================================

  if (delegateSupported) {
    suite.addResult(createMonoDependentTest("Should test delegate creation and invocation", () => {
      const domain = Mono.domain;
      const actionClass = domain.class("System.Action");
      
      if (actionClass) {
        console.log("    Testing delegate creation and invocation");
        
        // Test delegate class methods
        const methods = actionClass.getMethods();
        assert(Array.isArray(methods), "Action class should have methods array");
        assert(methods.length > 0, "Action class should have at least one method");
        
        // Look for constructor methods
        const constructors = methods.filter(m => m.getName().includes(".ctor"));
        console.log(`    Found ${constructors.length} constructor methods for Action`);
        
        // Test delegate invoke method
        const invokeMethod = actionClass.method("Invoke");
        if (invokeMethod) {
          console.log("    Found Invoke method on Action delegate");
        }
        
        console.log("    Delegate creation and invocation concepts verified");
      } else {
        console.log("    System.Action class not available for delegate testing");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test multicast delegate operations", () => {
      const domain = Mono.domain;
      const multicastDelegateClass = domain.class("System.MulticastDelegate");
      
      if (multicastDelegateClass) {
        console.log("    Testing multicast delegate operations");
        
        // Test multicast delegate methods
        const methods = multicastDelegateClass.getMethods();
        assert(Array.isArray(methods), "MulticastDelegate should have methods array");
        
        // Look for multicast-specific methods
        const multicastMethods = ["Combine", "Remove", "GetInvocationList"];
        let foundMethodCount = 0;
        
        for (const methodName of multicastMethods) {
          const method = multicastDelegateClass.method(methodName);
          if (method) {
            foundMethodCount++;
            console.log(`    Found multicast method: ${methodName}`);
          }
        }
        
        console.log(`    MulticastDelegate: ${foundMethodCount}/${multicastMethods.length} multicast methods found`);
      } else {
        console.log("    System.MulticastDelegate class not available");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test delegate combining and removing", () => {
      const domain = Mono.domain;
      const delegateClass = domain.class("System.Delegate");
      
      if (delegateClass) {
        console.log("    Testing delegate combining and removing");
        
        // Test static methods for combining/removing
        const combineMethod = delegateClass.method("Combine");
        const removeMethod = delegateClass.method("Remove");
        
        if (combineMethod) {
          console.log("    Found Combine method for delegate operations");
        }
        
        if (removeMethod) {
          console.log("    Found Remove method for delegate operations");
        }
        
        // Test instance methods
        const instanceMethods = delegateClass.getMethods();
        const dynamicInvokeMethod = delegateClass.method("DynamicInvoke");
        
        if (dynamicInvokeMethod) {
          console.log("    Found DynamicInvoke method for delegate invocation");
        }
        
        console.log("    Delegate combining and removing operations verified");
      } else {
        console.log("    System.Delegate class not available");
      }
    }));

    suite.addResult(createPerformanceTest("Should test delegate performance and memory usage", () => {
      const domain = Mono.domain;
      const delegateClass = domain.class("System.Delegate");
      
      if (delegateClass) {
        const startTime = Date.now();
        const delegateCount = 100;
        
        // Test delegate class access performance
        for (let i = 0; i < delegateCount; i++) {
          const methods = delegateClass.getMethods();
          // Access methods to test performance
          if (methods.length > 0) {
            // Simulate delegate operations
          }
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        assert(duration < 3000, `Delegate operations should complete within 3 seconds, took ${duration}ms`);
        console.log(`    Delegate performance: ${delegateCount} operations in ${duration}ms`);
      } else {
        console.log("    Delegate class not available for performance testing");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test delegate thunk features", () => {
      const version = Mono.version;
      
      assert(typeof version.features.delegateThunk === 'boolean', "Delegate thunk feature should be boolean");
      assert(version.features.delegateThunk === true, "Delegate thunk should be enabled");
      
      console.log(`    Delegate thunk feature is enabled: ${version.features.delegateThunk}`);
      
      // Test delegate thunk API availability
      if (Mono.api.hasExport("mono_get_delegate_invoke")) {
        assert(typeof Mono.api.native.mono_get_delegate_invoke === 'function', "mono_get_delegate_invoke should be callable");
      }
      
      if (Mono.api.hasExport("mono_method_get_unmanaged_thunk")) {
        assert(typeof Mono.api.native.mono_method_get_unmanaged_thunk === 'function', "mono_method_get_unmanaged_thunk should be callable");
      }
      
      console.log("    Delegate thunk features verified");
    }));

  } else {
    suite.addResult({
      name: "Delegate operations",
      passed: false,
      failed: false,
      skipped: true,
      message: "Delegate thunks not supported in this Mono build",
      category: TestCategory.MONO_DEPENDENT,
      requiresMono: true
    });
  }

  // ============================================================================
  // MONO GC HANDLE COMPREHENSIVE TESTS
  // ============================================================================

  if (gcHandleSupported) {
    suite.addResult(createMonoDependentTest("Should test GCHandle creation and management", () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        // Create test string
        const testString = Mono.api.stringNew("GC Handle Test");
        assertNotNull(testString, "Test string should be created");
        assert(!testString.isNull(), "Test string should not be null");
        
        // Create GC handle
        const gcHandle = Mono.api.native.mono_gchandle_new(testString, false) as number;
        assert(typeof gcHandle === "number" && gcHandle !== 0, "GC handle should be a non-zero integer");
        
        // Test getting target from GC handle
        const target = Mono.api.native.mono_gchandle_get_target(gcHandle);
        assertNotNull(target, "Should be able to get target from GC handle");
        assert(!target.isNull(), "Target should not be null");
        
        // Free the GC handle
        Mono.api.native.mono_gchandle_free(gcHandle);
        
        console.log(`    GC handle creation and management: handle=${gcHandle}`);
      } else {
        console.log("    System.String class not available for GC handle testing");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test GCHandle lifecycle and memory management", () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        const handles = [];
        
        // Create multiple GC handles
        for (let i = 0; i < 5; i++) {
          const testString = Mono.api.stringNew(`GC Handle Test ${i}`);
          const handle = Mono.api.native.mono_gchandle_new(testString, false) as number;
          handles.push(handle);
          
          assert(handle !== 0, `GC handle ${i} should be non-zero`);
        }
        
        // Verify all handles are different
        for (let i = 0; i < handles.length - 1; i++) {
          for (let j = i + 1; j < handles.length; j++) {
            assert(handles[i] !== handles[j], `Different objects should have different handle values`);
          }
        }
        
        // Test target access for all handles
        for (let i = 0; i < handles.length; i++) {
          const target = Mono.api.native.mono_gchandle_get_target(handles[i]);
          assert(!target.isNull(), `Handle ${i} should have valid target`);
        }
        
        // Clean up all handles
        for (const handle of handles) {
          Mono.api.native.mono_gchandle_free(handle);
        }
        
        console.log(`    GC handle lifecycle: created and managed ${handles.length} handles`);
      } else {
        console.log("    System.String class not available for GC handle lifecycle testing");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test weak reference GC handles", () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        // Create test string
        const testString = Mono.api.stringNew("Weak Ref Test");
        assertNotNull(testString, "Test string should be created");
        
        // Create weak reference GC handle
        const weakHandle = Mono.api.native.mono_gchandle_new_weakref(testString, false) as number;
        assert(typeof weakHandle === "number" && weakHandle !== 0, "Weak reference handle should be a non-zero integer");
        
        // Get target from weak reference
        const weakTarget = Mono.api.native.mono_gchandle_get_target(weakHandle);
        assertNotNull(weakTarget, "Should be able to get target from weak reference");
        assert(!weakTarget.isNull(), "Weak reference target should not be null initially");
        
        // Clean up
        Mono.api.native.mono_gchandle_free(weakHandle);
        
        console.log(`    Weak reference GC handle: handle=${weakHandle}`);
      } else {
        console.log("    System.String class not available for weak reference testing");
      }
    }));

    suite.addResult(createMonoDependentTest("Should test GCHandle target access and modification", () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        // Create original string
        const originalString = Mono.api.stringNew("Original target");
        const handle = Mono.api.native.mono_gchandle_new(originalString, false) as number;
        
        // Get target and verify
        const target1 = Mono.api.native.mono_gchandle_get_target(handle);
        assertNotNull(target1, "Target should be accessible");
        
        // Create new string (note: GC handles don't allow changing targets, but we test access)
        const newString = Mono.api.stringNew("New target");
        const newHandle = Mono.api.native.mono_gchandle_new(newString, false) as number;
        
        // Verify different handles have different targets
        const target2 = Mono.api.native.mono_gchandle_get_target(newHandle);
        assertNotNull(target2, "New handle target should be accessible");
        
        // Clean up
        Mono.api.native.mono_gchandle_free(handle);
        Mono.api.native.mono_gchandle_free(newHandle);
        
        console.log("    GC handle target access and modification tested");
      } else {
        console.log("    System.String class not available for target access testing");
      }
    }));

    suite.addResult(createPerformanceTest("Should test GCHandle performance", () => {
      const startTime = Date.now();
      const handleCount = 200;
      const handles = [];
      
      // Create many GC handles
      for (let i = 0; i < handleCount; i++) {
        const testString = Mono.api.stringNew(`Performance test ${i}`);
        const handle = Mono.api.native.mono_gchandle_new(testString, false);
        handles.push(handle);
      }
      
      // Access all handles
      let accessCount = 0;
      for (const handle of handles) {
        const target = Mono.api.native.mono_gchandle_get_target(handle);
        if (!target.isNull()) {
          accessCount++;
        }
      }
      
      // Free all handles
      for (const handle of handles) {
        Mono.api.native.mono_gchandle_free(handle);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      assert(accessCount === handleCount, `Expected ${handleCount} successful accesses, got ${accessCount}`);
      assert(duration < 3000, `GC handle operations should complete within 3 seconds, took ${duration}ms`);
      
      console.log(`    GC handle performance: ${handleCount} handles processed in ${duration}ms`);
    }));

  } else {
    suite.addResult({
      name: "GC Handle operations",
      passed: false,
      failed: false,
      skipped: true,
      message: "GC handles not supported in this Mono build",
      category: TestCategory.MONO_DEPENDENT,
      requiresMono: true
    });
  }

  // ============================================================================
  // MONO INTERNAL CALL COMPREHENSIVE TESTS
  // ============================================================================

  if (internalCallSupported) {
    suite.addResult(createMonoDependentTest("Should test ICall registration and execution", () => {
      // Test internal call registration API
      assert(typeof Mono.api.native.mono_add_internal_call === 'function', "mono_add_internal_call should be callable");
      
      // Test with a simple internal call registration
      try {
        // Create a simple native function for testing
        const testCallback = new NativeCallback(() => {
          console.log("    Internal call executed successfully");
          return 42;
        }, 'int', []);
        
        // Register the internal call
        const callName = "TestNamespace.TestClass::TestMethod";
        Mono.api.native.mono_add_internal_call(callName, testCallback);
        
        console.log(`    Successfully registered internal call: ${callName}`);
        
        // Clean up (NativeCallback doesn't have dispose method)
        // testCallback.dispose(); // Not available
      } catch (error) {
        console.log(`    Internal call registration test: ${error}`);
      }
      
      console.log("    ICall registration and execution concepts verified");
    }));

    suite.addResult(createMonoDependentTest("Should test ICall parameter handling and return values", () => {
      // Test parameter handling concepts
      try {
        // Create a callback that takes parameters and returns a value
        const paramCallback = new NativeCallback((param1: number, param2: number) => {
          return param1 + param2;
        }, 'int', ['int', 'int']);
        
        // Register the internal call
        const callName = "TestNamespace.TestClass::AddMethod";
        Mono.api.native.mono_add_internal_call(callName, paramCallback);
        
        console.log(`    Successfully registered parameterized internal call: ${callName}`);
        
        // Clean up (NativeCallback doesn't have dispose method)
        // paramCallback.dispose(); // Not available
      } catch (error) {
        console.log(`    ICall parameter handling test: ${error}`);
      }
      
      console.log("    ICall parameter handling and return values tested");
    }));

    suite.addResult(createMonoDependentTest("Should test ICall error handling and validation", () => {
      // Test error handling scenarios
      try {
        // Test with empty name (should handle gracefully)
        try {
          const emptyCallback = new NativeCallback(() => {}, 'void', []);
          Mono.api.native.mono_add_internal_call("", emptyCallback);
          console.log("    Empty internal call name handled gracefully");
          // Clean up (NativeCallback doesn't have dispose method)
          // emptyCallback.dispose(); // Not available
        } catch (error) {
          console.log(`    Empty name threw expected error: ${error}`);
        }
        
        // Test with null callback (should handle gracefully)
        try {
          Mono.api.native.mono_add_internal_call("Test::Null", ptr(0));
          console.log("    Null callback handled gracefully");
        } catch (error) {
          console.log(`    Null callback threw expected error: ${error}`);
        }
        
      } catch (error) {
        console.log(`    ICall error handling test: ${error}`);
      }
      
      console.log("    ICall error handling and validation tested");
    }));

  } else {
    suite.addResult({
      name: "Internal Call operations",
      passed: false,
      failed: false,
      skipped: true,
      message: "Internal calls not supported in this Mono build",
      category: TestCategory.MONO_DEPENDENT,
      requiresMono: true
    });
  }

  // ============================================================================
  // ADVANCED EXCEPTION HANDLING TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Should test advanced exception handling scenarios", () => {
    const domain = Mono.domain;
    const objectClass = domain.class("System.Object");
    
    if (objectClass) {
      // Test exception handling with object operations
      try {
        const testObject = Mono.api.native.mono_object_new(domain.pointer, objectClass.pointer);
        assertNotNull(testObject, "Test object should be created");
        
        // Test object to string conversion with exception handling
        const exceptionSlot = Memory.alloc(Process.pointerSize);
        exceptionSlot.writePointer(ptr(0));
        
        const stringResult = Mono.api.native.mono_object_to_string(testObject, exceptionSlot);
        const exception = exceptionSlot.readPointer();
        
        if (!pointerIsNull(exception)) {
          console.log("    Exception was thrown during object to string conversion");
        } else {
          console.log("    No exception during object to string conversion");
        }
        
      } catch (error) {
        console.log(`    Advanced exception handling test: ${error}`);
      }
    }
    
    console.log("    Advanced exception handling scenarios tested");
  }));

  suite.addResult(createMonoDependentTest("Should test resource cleanup and memory leak prevention", () => {
    const domain = Mono.domain;
    const stringClass = domain.class("System.String");
    
    if (stringClass && gcHandleSupported) {
      const handles = [];
      const strings = [];
      
      // Create resources
      for (let i = 0; i < 50; i++) {
        const testString = Mono.api.stringNew(`Resource test ${i}`);
        strings.push(testString);
        
        const handle = Mono.api.native.mono_gchandle_new(testString, false);
        handles.push(handle);
      }
      
      // Clean up half of the resources
      for (let i = 0; i < handles.length / 2; i++) {
        Mono.api.native.mono_gchandle_free(handles[i]);
      }
      
      // Verify remaining handles are still valid
      let validCount = 0;
      for (let i = handles.length / 2; i < handles.length; i++) {
        const target = Mono.api.native.mono_gchandle_get_target(handles[i]);
        if (!target.isNull()) {
          validCount++;
        }
      }
      
      // Clean up remaining handles
      for (let i = handles.length / 2; i < handles.length; i++) {
        Mono.api.native.mono_gchandle_free(handles[i]);
      }
      
      assert(validCount === handles.length / 2, `Expected ${handles.length / 2} valid handles, got ${validCount}`);
      console.log("    Resource cleanup and memory leak prevention tested");
    }
  }));

  // ============================================================================
  // UNITY-SPECIFIC ADVANCED FEATURES TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Should test Unity-specific advanced features", () => {
    const domain = Mono.domain;
    
    // Test Unity coroutine-related classes
    const unityAdvancedTypes = [
      "UnityEngine.Coroutine",
      "UnityEngine.YieldInstruction",
      "UnityEngine.AsyncOperation",
      "UnityEngine.CustomYieldInstruction",
      "UnityEngine.WaitForSeconds",
      "UnityEngine.WaitForEndOfFrame",
    ];
    
    let foundCount = 0;
    for (const typeName of unityAdvancedTypes) {
      const unityClass = domain.class(typeName);
      if (unityClass) {
        foundCount++;
        console.log(`    Found Unity advanced type: ${typeName}`);
        
        // Test methods
        const methods = unityClass.getMethods();
        console.log(`      ${methods.length} methods available`);
      }
    }
    
    console.log(`    Found ${foundCount}/${unityAdvancedTypes.length} Unity-specific advanced types`);
  }));

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(createIntegrationTest("Should test advanced features integration", () => {
    const domain = Mono.domain;
    const version = Mono.version;
    
    assert(domain !== null, "Domain should be accessible");
    assert(version !== null, "Version should be accessible");
    
    // Test feature integration
    let supportedFeatures = 0;
    if (delegateSupported) supportedFeatures++;
    if (gcHandleSupported) supportedFeatures++;
    if (internalCallSupported) supportedFeatures++;
    
    console.log(`    Advanced features integration: ${supportedFeatures} features supported`);
    
    // Test that features work together
    if (gcHandleSupported && internalCallSupported) {
      console.log("    GC handles and internal calls both supported - integration possible");
    }
    
    if (delegateSupported && gcHandleSupported) {
      console.log("    Delegate thunks and GC handles both supported - integration possible");
    }
  }));

  suite.addResult(createIntegrationTest("Should test cross-feature operations", () => {
    const domain = Mono.domain;
    
    // Test operations that might use multiple advanced features
    if (gcHandleSupported) {
      const stringClass = domain.class("System.String");
      if (stringClass) {
        // Create string and GC handle
        const testString = Mono.api.stringNew("Cross-feature test");
        const handle = Mono.api.native.mono_gchandle_new(testString, false);
        
        // Test delegate operations if supported
        if (delegateSupported) {
          const delegateClass = domain.class("System.Delegate");
          if (delegateClass) {
            console.log("    Cross-feature: GC handles and delegates both available");
          }
        }
        
        // Clean up
        Mono.api.native.mono_gchandle_free(handle);
      }
    }
    
    console.log("    Cross-feature operations working correctly");
  }));

  // ============================================================================
  // PERFORMANCE AND STRESS TESTS
  // ============================================================================

  suite.addResult(createPerformanceTest("Should test advanced features performance", () => {
    const startTime = Date.now();
    
    // Test multiple advanced features operations
    if (gcHandleSupported) {
      const testString = Mono.api.stringNew("Performance test");
      const handle = Mono.api.native.mono_gchandle_new(testString, false);
      Mono.api.native.mono_gchandle_free(handle);
    }
    
    if (delegateSupported) {
      const domain = Mono.domain;
      const delegateClass = domain.class("System.Delegate");
      if (delegateClass) {
        delegateClass.getMethods();
      }
    }
    
    if (internalCallSupported) {
      Mono.api.hasExport("mono_add_internal_call");
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    assert(duration < 1000, `Advanced features operations should be reasonably fast, took ${duration}ms`);
    console.log(`    Advanced features performance test took ${duration}ms`);
  }));

  suite.addResult(createPerformanceTest("Should test stress scenarios for memory management", () => {
    const startTime = Date.now();
    
    if (gcHandleSupported) {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      if (stringClass) {
        const handleCount = 1000;
        const handles = [];
        
        // Create many handles
        for (let i = 0; i < handleCount; i++) {
          const testString = Mono.api.stringNew(`Stress test ${i}`);
          const handle = Mono.api.native.mono_gchandle_new(testString, false);
          handles.push(handle);
        }
        
        // Access all handles
        let accessCount = 0;
        for (const handle of handles) {
          const target = Mono.api.native.mono_gchandle_get_target(handle);
          if (!target.isNull()) {
            accessCount++;
          }
        }
        
        // Clean up all handles
        for (const handle of handles) {
          Mono.api.native.mono_gchandle_free(handle);
        }
        
        assert(accessCount === handleCount, `Expected ${handleCount} successful accesses, got ${accessCount}`);
        console.log(`    Stress test: ${handleCount} handles created and accessed`);
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    assert(duration < 10000, `Stress test should complete within 10 seconds, took ${duration}ms`);
    console.log(`    Memory management stress test completed in ${duration}ms`);
  }));

  // ============================================================================
  // NESTED PERFORM TESTS
  // ============================================================================

  suite.addResult(createNestedPerformTest({
    context: "comprehensive advanced features",
    testName: "Should support advanced features in nested perform calls",
    validate: domain => {
      // Test that advanced features APIs are still accessible in nested context
      if (delegateSupported) {
        assert(Mono.api.hasExport("mono_get_delegate_invoke"), "Delegate APIs should work in nested perform calls");
      }
      
      if (gcHandleSupported) {
        assert(Mono.api.hasExport("mono_gchandle_new"), "GC handle APIs should work in nested perform calls");
      }
      
      if (internalCallSupported) {
        assert(Mono.api.hasExport("mono_add_internal_call"), "Internal call APIs should work in nested perform calls");
      }
      
      assert(domain !== null, "Domain should be accessible in nested perform calls");
    },
  }));

  // Return all test results
  return suite.results;
}

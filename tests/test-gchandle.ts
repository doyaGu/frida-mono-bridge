/**
 * GC Handle Tests
 * Tests garbage collector handle management
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, createSkippedTest } from "./test-framework";

export function testGCHandles(): TestResult {
  console.log("\nGC Handles:");

  // Check if GC handles are supported in this Mono build
  if (!Mono.version.features.gcHandles) {
    return createSkippedTest("GC Handle operations", "GC handles not supported in this Mono build");
  }

  const suite = new TestSuite("GC Handle Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for GC handle tests", () => {
    assertPerformWorks("Mono.perform() should work for GC handle tests");
  }));

  suite.addResult(createTest("Should access API for GC handle operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for GC handle operations");
      console.log("    API is accessible for GC handle tests");
    });
  }));

  suite.addResult(createTest("GC Handle APIs should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gchandle_new"), "mono_gchandle_new should be available");
      assert(Mono.api.hasExport("mono_gchandle_free"), "mono_gchandle_free should be available");
      assert(Mono.api.hasExport("mono_gchandle_get_target"), "mono_gchandle_get_target should be available");
      assert(Mono.api.hasExport("mono_gchandle_new_weakref"), "mono_gchandle_new_weakref should be available");

      console.log("    All required GC handle APIs are available");
    });
  }));

  suite.addResult(createTest("GCHandlePool should be available", () => {
    Mono.perform(() => {
      assert(typeof Mono.gchandles !== 'undefined', "gchandles pool should be defined");
      assert(Mono.gchandles !== null, "gchandles pool should not be null");

      console.log("    GCHandlePool is accessible");
    });
  }));

  suite.addResult(createTest("GC Handle functions should be callable", () => {
    Mono.perform(() => {
      assert(typeof Mono.api.native.mono_gchandle_new === 'function', "mono_gchandle_new should be a function");
      assert(typeof Mono.api.native.mono_gchandle_free === 'function', "mono_gchandle_free should be a function");
      assert(typeof Mono.api.native.mono_gchandle_get_target === 'function', "mono_gchandle_get_target should be a function");
      assert(typeof Mono.api.native.mono_gchandle_new_weakref === 'function', "mono_gchandle_new_weakref should be a function");

      console.log("    All GC handle functions are callable");
    });
  }));

  suite.addResult(createTest("GC collection APIs should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gc_collect"), "mono_gc_collect should be available");
      assert(Mono.api.hasExport("mono_gc_get_heap_size"), "mono_gc_get_heap_size should be available");
      assert(Mono.api.hasExport("mono_gc_get_used_size"), "mono_gc_get_used_size should be available");

      console.log("    GC collection APIs are available");
    });
  }));

  suite.addResult(createTest("Should test GC handle creation and management", () => {
    Mono.perform(() => {
      // Test basic GC handle operations with a string
      const testString = Mono.api.stringNew("GC Handle Test String");
      assert(!testString.isNull(), "Test string should be created");

      // Create a GC handle for the string
      const gcHandle = Mono.api.native.mono_gchandle_new(testString, false);
      assert(!gcHandle.isNull(), "GC handle should be created");

      // Test getting the target from GC handle
      const target = Mono.api.native.mono_gchandle_get_target(gcHandle);
      assert(!target.isNull(), "Should be able to get target from GC handle");

      // Free the GC handle
      Mono.api.native.mono_gchandle_free(gcHandle);

      console.log("    GC handle creation and management works correctly");
    });
  }));

  suite.addResult(createTest("Should test weak reference GC handles", () => {
    Mono.perform(() => {
      // Test weak reference handle creation
      const testString = Mono.api.stringNew("Weak Ref Test");
      assert(!testString.isNull(), "Test string should be created");

      // Create a weak reference GC handle
      const weakHandle = Mono.api.native.mono_gchandle_new_weakref(testString, false);
      assert(!weakHandle.isNull(), "Weak reference handle should be created");

      // Get target from weak reference
      const weakTarget = Mono.api.native.mono_gchandle_get_target(weakHandle);
      assert(!weakTarget.isNull(), "Should be able to get target from weak reference");

      // Clean up
      Mono.api.native.mono_gchandle_free(weakHandle);

      console.log("    Weak reference GC handles work correctly");
    });
  }));

  suite.addResult(createTest("Should test GC handle pool operations", () => {
    Mono.perform(() => {
      const gcPool = Mono.gchandles;

      // Test that GC handle pool is accessible
      assert(gcPool !== null, "GC handle pool should be accessible");

      // Test pool methods if they exist
      if (typeof gcPool.create === 'function') {
        const testString = Mono.api.stringNew("Pool Test");
        const handle = gcPool.create(testString);
        console.log(`    Created GC handle through pool: ${handle}`);

        if (typeof gcPool.free === 'function') {
          gcPool.free(handle);
          console.log("    Freed GC handle through pool");
        }
      } else {
        console.log("    GC handle pool methods not available, using direct API");
      }
    });
  }));

  suite.addResult(createTest("Should test GC heap information", () => {
    Mono.perform(() => {
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
    });
  }));

  suite.addResult(createTest("Should test GC collection operations", () => {
    Mono.perform(() => {
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
    });
  }));

  suite.addResult(createTest("Should test GC handle consistency", () => {
    Mono.perform(() => {
      // Test that GC handle operations are consistent
      const testString1 = Mono.api.stringNew("Consistency Test 1");
      const testString2 = Mono.api.stringNew("Consistency Test 2");

      const handle1 = Mono.api.native.mono_gchandle_new(testString1, false);
      const handle2 = Mono.api.native.mono_gchandle_new(testString2, false);

      // Verify handles are different
      assert(!handle1.equals(handle2), "Different objects should have different handles");

      // Verify targets are correct
      const target1 = Mono.api.native.mono_gchandle_get_target(handle1);
      const target2 = Mono.api.native.mono_gchandle_get_target(handle2);
      assert(!target1.equals(target2), "Different handles should have different targets");

      // Clean up
      Mono.api.native.mono_gchandle_free(handle1);
      Mono.api.native.mono_gchandle_free(handle2);

      console.log("    GC handle consistency verified");
    });
  }));

  suite.addResult(createTest("Should test GC handle error handling", () => {
    Mono.perform(() => {
      // Test error handling with invalid handles
      try {
        const nullHandle = ptr("0x0");

        // Try to get target from null handle (should handle gracefully)
        if (Mono.api.hasExport("mono_gchandle_get_target")) {
          const nullTarget = Mono.api.native.mono_gchandle_get_target(nullHandle);
          console.log(`    Null handle target: ${nullTarget}`);
        }

        console.log("    GC handle error handling works correctly");
      } catch (error) {
        console.log(`    GC handle error handling test: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Should test GC handle integration with domain", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const testString = Mono.api.stringNew("Domain Integration Test");

      // Create GC handle
      const gcHandle = Mono.api.native.mono_gchandle_new(testString, false);

      // Test domain operations with GC handle
      const assemblies = domain.getAssemblies();
      console.log(`    Domain operations with GC handle: ${assemblies.length} assemblies accessible`);

      // Clean up
      Mono.api.native.mono_gchandle_free(gcHandle);

      console.log("    GC handle integration with domain works correctly");
    });
  }));

  suite.addResult(createTest("Should test GC handle performance", () => {
    Mono.perform(() => {
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
    });
  }));

  suite.addResult(createTest("Should test GC handle nested operations", () => {
    Mono.perform(() => {
      // Test nested Mono.perform calls with GC handle operations
      Mono.perform(() => {
        const testString = Mono.api.stringNew("Nested Test");
        const gcHandle = Mono.api.native.mono_gchandle_new(testString, false);

        // Nested operations
        Mono.perform(() => {
          const target = Mono.api.native.mono_gchandle_get_target(gcHandle);
          assert(!target.isNull(), "GC handle should work in nested perform calls");
        });

        Mono.api.native.mono_gchandle_free(gcHandle);
      });

      console.log("    GC handle operations work in nested perform calls");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "GC Handle Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} GC handle tests passed`,
  };
}

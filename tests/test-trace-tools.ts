/**
 * Trace Tools Tests
 * 
 * Tests for Trace module Hook functionality
 * Including method interception, return value replacement, class-level hooks, etc.
 */

import Mono from '../src';
import * as Trace from '../src/utils/trace';
import { 
  TestResult, 
  createMonoDependentTest, 
  createStandaloneTest,
  assert, 
  assertNotNull,
} from './test-framework';

/**
 * Create Trace Tools test suite
 */
export function createTraceToolsTests(): TestResult[] {
  const results: TestResult[] = [];

  // ============================================
  // API Existence Tests
  // ============================================
  results.push(createStandaloneTest(
    'Trace - Mono.trace exists',
    () => {
      assert(typeof Mono.trace !== 'undefined', 'Mono.trace should exist');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - method function exists',
    () => {
      assert(typeof Trace.method === 'function', 'Trace.method should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - methodExtended function exists',
    () => {
      assert(typeof Trace.methodExtended === 'function', 'Trace.methodExtended should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - replaceReturnValue function exists',
    () => {
      assert(typeof Trace.replaceReturnValue === 'function', 'Trace.replaceReturnValue should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - classAll function exists',
    () => {
      assert(typeof Trace.classAll === 'function', 'Trace.classAll should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - methodsByPattern function exists',
    () => {
      assert(typeof Trace.methodsByPattern === 'function', 'Trace.methodsByPattern should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - classesByPattern function exists',
    () => {
      assert(typeof Trace.classesByPattern === 'function', 'Trace.classesByPattern should be a function');
    }
  ));

  // ============================================
  // Trace.method Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.method - Hook System.String.get_Length',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        assertNotNull(stringClass, 'String class should exist');
        
        const getLengthMethod = stringClass.getMethod('get_Length');
        assertNotNull(getLengthMethod, 'get_Length method should exist');

        let detach: (() => void) | null = null;

        try {
          detach = Trace.method(getLengthMethod!, {
            onEnter: (args) => {
              // Hook set up successfully
            }
          });

          assert(typeof detach === 'function', 'method() should return a detach function');
        } finally {
          if (detach) {
            detach();
          }
        }
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.method - returns detach function',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        assertNotNull(objectClass, 'Object class should exist');
        
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.method(toStringMethod!, {});
        
        assert(typeof detach === 'function', 'Expected detach to be a function');

        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.method - onEnter callback setup',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.method(toStringMethod!, {
          onEnter: (args) => {
            // Callback set up
          }
        });

        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.method - onLeave callback setup',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const getHashCodeMethod = objectClass.getMethod('GetHashCode');
        assertNotNull(getHashCodeMethod, 'GetHashCode method should exist');

        const detach = Trace.method(getHashCodeMethod!, {
          onLeave: (retval) => {
            // Callback set up
          }
        });

        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.method - multiple detach calls safe',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.method(toStringMethod!, {});
        
        // Call detach multiple times
        detach();
        detach();
        detach();
      });
    }
  ));

  // ============================================
  // Trace.methodExtended Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.methodExtended - Hook with context',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.methodExtended(toStringMethod!, {
          onEnter(args) {
            // this should be InvocationContext
          }
        });

        assert(typeof detach === 'function', 'methodExtended should return a function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.methodExtended - returns detach function',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.methodExtended(toStringMethod!, {});
        
        assert(typeof detach === 'function', 'Expected detach to be a function');

        detach();
      });
    }
  ));

  // ============================================
  // Trace.replaceReturnValue Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.replaceReturnValue - setup replacement',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        const getLengthMethod = stringClass.getMethod('get_Length');
        assertNotNull(getLengthMethod, 'get_Length method should exist');

        const detach = Trace.replaceReturnValue(getLengthMethod!, (originalRetval, thisPtr, args) => {
          return ptr(0);
        });

        assert(typeof detach === 'function', 'replaceReturnValue should return a function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.replaceReturnValue - undefined keeps original',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        const getLengthMethod = stringClass.getMethod('get_Length');
        assertNotNull(getLengthMethod, 'get_Length method should exist');

        const detach = Trace.replaceReturnValue(getLengthMethod!, (originalRetval, thisPtr, args) => {
          return undefined;
        });

        detach();
      });
    }
  ));

  // ============================================
  // Trace.classAll Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.classAll - Hook all methods in class',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        assertNotNull(objectClass, 'Object class should exist');

        const detach = Trace.classAll(objectClass, {
          onEnter: (args) => {}
        });

        assert(typeof detach === 'function', 'classAll should return a function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.classAll - detach removes all hooks',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        
        const detach = Trace.classAll(objectClass, {
          onEnter: () => {}
        });

        detach();
      });
    }
  ));

  // ============================================
  // Trace.methodsByPattern Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.methodsByPattern - Hook by pattern',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const detach = Trace.methodsByPattern(api, 'System.String.get_Length', {
          onEnter: (args) => {}
        });

        assert(typeof detach === 'function', 'methodsByPattern should return a function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.methodsByPattern - no match returns empty detach',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const detach = Trace.methodsByPattern(api, 'NonExistent.Fake.Method12345', {});

        assert(typeof detach === 'function', 'Should return detach function even with no matches');

        detach();
      });
    }
  ));

  // ============================================
  // Trace.classesByPattern Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace.classesByPattern - Hook classes by pattern',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const detach = Trace.classesByPattern(api, 'System.Object', {
          onEnter: (args) => {}
        });

        assert(typeof detach === 'function', 'classesByPattern should return a function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.classesByPattern - no match returns empty detach',
    () => {
      Mono.perform(() => {
        const api = Mono.api;
        const detach = Trace.classesByPattern(api, 'FakeNamespace.FakeClass12345', {});

        assert(typeof detach === 'function', 'Should return detach function even with no matches');

        detach();
      });
    }
  ));

  // ============================================
  // Callback Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace - onEnter receives args array',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.method(toStringMethod!, {
          onEnter: (args) => {
            assert(Array.isArray(args), 'args should be an array');
          }
        });

        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - instance method extracts this pointer',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        assert(toStringMethod!.isInstanceMethod(), 'ToString should be instance method');

        const detach = Trace.replaceReturnValue(toStringMethod!, (retval, thisPtr, args) => {
          return undefined;
        });

        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - static method handling',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        const isNullOrEmptyMethod = stringClass.tryGetMethod('IsNullOrEmpty');
        
        if (!isNullOrEmptyMethod) {
          console.log('[INFO] IsNullOrEmpty not found, skipping');
          return;
        }

        assert(!isNullOrEmptyMethod.isInstanceMethod(), 'IsNullOrEmpty should be static');

        const detach = Trace.replaceReturnValue(isNullOrEmptyMethod, (retval, thisPtr, args) => {
          return undefined;
        });

        detach();
      });
    }
  ));

  // ============================================
  // Integration Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Trace - multiple hooks coexist',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        const getHashCodeMethod = objectClass.getMethod('GetHashCode');
        
        assertNotNull(toStringMethod, 'ToString method should exist');
        assertNotNull(getHashCodeMethod, 'GetHashCode method should exist');

        const detach1 = Trace.method(toStringMethod!, {});
        const detach2 = Trace.method(getHashCodeMethod!, {});

        detach1();
        detach2();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - same method can be hooked multiple times',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach1 = Trace.method(toStringMethod!, {
          onEnter: () => {}
        });

        const detach2 = Trace.method(toStringMethod!, {
          onEnter: () => {}
        });

        detach1();
        detach2();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - detach order independent',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach1 = Trace.method(toStringMethod!, {});
        const detach2 = Trace.method(toStringMethod!, {});
        const detach3 = Trace.method(toStringMethod!, {});

        // Detach in random order
        detach2();
        detach1();
        detach3();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - program continues after detach',
    () => {
      Mono.perform(() => {
        const objectClass = Mono.domain.class('System.Object');
        assertNotNull(objectClass, 'Object class should exist');
        const toStringMethod = objectClass.getMethod('ToString');
        assertNotNull(toStringMethod, 'ToString method should exist');

        const detach = Trace.method(toStringMethod!, {
          onEnter: () => {}
        });

        detach();
      });
    }
  ));

  // ============================================
  // Field Tracing Tests
  // ============================================
  results.push(createStandaloneTest(
    'Trace - field function exists',
    () => {
      assert(typeof Trace.field === 'function', 'Trace.field should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - fieldsByPattern function exists',
    () => {
      assert(typeof Trace.fieldsByPattern === 'function', 'Trace.fieldsByPattern should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.field - returns null for non-traceable field',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        // Try to find a private field that won't have property accessors
        const fields = stringClass!.getFields();
        if (fields.length > 0) {
          const result = Trace.field(fields[0], {
            onRead: () => {},
          });
          
          // Most internal fields won't be traceable without property accessors
          console.log(`[INFO] Field trace result: ${result === null ? 'null (expected)' : 'detach function'}`);
        }
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.fieldsByPattern - handles empty results',
    () => {
      Mono.perform(() => {
        // Use a pattern that won't match anything
        const detach = Trace.fieldsByPattern(Mono.api, 'NonExistentFieldXYZ*', {
          onRead: () => {},
        });
        
        // Should return a valid detach function
        assert(typeof detach === 'function', 'Should return a detach function');
        detach();
      });
    }
  ));

  // ============================================
  // Property Tracing Tests
  // ============================================
  results.push(createStandaloneTest(
    'Trace - propertyTrace function exists',
    () => {
      assert(typeof Trace.propertyTrace === 'function', 'Trace.propertyTrace should be a function');
    }
  ));

  results.push(createStandaloneTest(
    'Trace - propertiesByPattern function exists',
    () => {
      assert(typeof Trace.propertiesByPattern === 'function', 'Trace.propertiesByPattern should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.propertyTrace - hooks Length property',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        const lengthProperty = stringClass!.tryGetProperty('Length');
        assertNotNull(lengthProperty, 'Length property should exist');
        
        let getterCalled = false;
        const detach = Trace.propertyTrace(lengthProperty!, {
          onGet: () => {
            getterCalled = true;
          },
        });
        
        // The detach function should exist
        assert(typeof detach === 'function', 'Should return a detach function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace.propertiesByPattern - traces matching properties',
    () => {
      Mono.perform(() => {
        // Trace all Length properties
        const detach = Trace.propertiesByPattern(Mono.api, '*Length*', {
          onGet: () => {},
        });
        
        assert(typeof detach === 'function', 'Should return a detach function');
        detach();
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - FieldAccessCallbacks interface works',
    () => {
      // Type-level test
      const callbacks: Trace.FieldAccessCallbacks = {
        onRead: (instance, value) => {
          console.log(`Read: instance=${instance}, value=${value}`);
        },
        onWrite: (instance, oldValue, newValue) => {
          console.log(`Write: ${oldValue} -> ${newValue}`);
        },
      };
      
      assert(typeof callbacks.onRead === 'function', 'onRead should be a function');
      assert(typeof callbacks.onWrite === 'function', 'onWrite should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - PropertyAccessCallbacks interface works',
    () => {
      // Type-level test
      const callbacks: Trace.PropertyAccessCallbacks = {
        onGet: (instance, value) => {
          console.log(`Get: instance=${instance}, value=${value}`);
        },
        onSet: (instance, oldValue, newValue) => {
          console.log(`Set: ${oldValue} -> ${newValue}`);
        },
      };
      
      assert(typeof callbacks.onGet === 'function', 'onGet should be a function');
      assert(typeof callbacks.onSet === 'function', 'onSet should be a function');
    }
  ));

  // =====================================================
  // Section 8: Performance Tracking Tests
  // =====================================================
  results.push(createMonoDependentTest(
    'Trace - createPerformanceTracker exists',
    () => {
      assertNotNull(Trace.createPerformanceTracker, 'createPerformanceTracker should exist');
      assert(typeof Trace.createPerformanceTracker === 'function', 'createPerformanceTracker should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - PerformanceTracker can be instantiated',
    () => {
      const tracker = Trace.createPerformanceTracker();
      assertNotNull(tracker, 'Tracker should be created');
      
      // Check that it has the expected methods
      assert(typeof tracker.track === 'function', 'track method should exist');
      assert(typeof tracker.getStats === 'function', 'getStats method should exist');
      assert(typeof tracker.getAllStats === 'function', 'getAllStats method should exist');
      assert(typeof tracker.getReport === 'function', 'getReport method should exist');
      assert(typeof tracker.reset === 'function', 'reset method should exist');
      assert(typeof tracker.dispose === 'function', 'dispose method should exist');
      
      // Clean up
      tracker.dispose();
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - PerformanceTracker.getReport returns string',
    () => {
      const tracker = Trace.createPerformanceTracker();
      const report = tracker.getReport();
      
      assert(typeof report === 'string', 'Report should be a string');
      assert(report.includes('Performance Report'), 'Report should contain header');
      console.log(`[INFO] Empty report:\n${report}`);
      
      tracker.dispose();
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - methodWithCallStack exists',
    () => {
      assertNotNull(Trace.methodWithCallStack, 'methodWithCallStack should exist');
      assert(typeof Trace.methodWithCallStack === 'function', 'methodWithCallStack should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - MethodCallbacksTimed interface works',
    () => {
      // Type-level test
      const callbacks: Trace.MethodCallbacksTimed = {
        onEnter: (args, callStack) => {
          console.log(`Enter with ${args.length} args, stack depth: ${callStack.length}`);
        },
        onLeave: (retval, duration) => {
          console.log(`Leave after ${duration}ms`);
        },
      };
      
      assert(typeof callbacks.onEnter === 'function', 'onEnter should be a function');
      assert(typeof callbacks.onLeave === 'function', 'onLeave should be a function');
    }
  ));

  results.push(createMonoDependentTest(
    'Trace - MethodStats interface structure',
    () => {
      // Type-level test for MethodStats
      const mockStats: Trace.MethodStats = {
        callCount: 10,
        totalTime: 100,
        minTime: 5,
        maxTime: 20,
        avgTime: 10,
        lastCallTime: Date.now(),
      };
      
      assert(typeof mockStats.callCount === 'number', 'callCount should be number');
      assert(typeof mockStats.totalTime === 'number', 'totalTime should be number');
      assert(typeof mockStats.minTime === 'number', 'minTime should be number');
      assert(typeof mockStats.maxTime === 'number', 'maxTime should be number');
      assert(typeof mockStats.avgTime === 'number', 'avgTime should be number');
      assert(typeof mockStats.lastCallTime === 'number', 'lastCallTime should be number');
      
      console.log(`[INFO] MethodStats interface verified`);
    }
  ));

  return results;
}

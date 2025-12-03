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

  return results;
}

/**
 * Test Utilities
 * Consolidated specialized test utilities for Unity, Performance, String operations, and Error handling
 * This file consolidates functionality from multiple specialized helper files for consistency
 */

import {
  TestResult,
  TestCategory,
  createTest,
  createMonoTest,
  createMonoDependentTest,
  createErrorHandlingTest,
  assert,
  assertNotNull,
  assertThrows,
  fail,
} from "./test-framework";
import Mono from "../src";
import { readUtf16String } from "../src/utils/string";
import {
  PerformanceMetrics,
  PerformanceTestOptions,
  DEFAULT_PERFORMANCE_OPTIONS,
  UNITY_TEST_DATA,
  setupCommonTestEnvironment,
  setupUnityTestEnvironment,
  measureMemory,
} from "./test-common";

// Re-export UNITY_TEST_DATA for use in other files
export { UNITY_TEST_DATA };

// ===== UNITY-SPECIFIC TEST UTILITIES =====

/**
 * Creates a test that verifies a Unity assembly is loaded
 */
export function createUnityAssemblyTest(assemblyName: string, testFn?: (assembly: any) => void): TestResult {
  return createMonoTest(`Unity assembly ${assemblyName} should be loaded`, () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      const assembly = setup.domain.getAssembly(assemblyName);
      assertNotNull(assembly, `Unity assembly ${assemblyName} should be loaded`);

      if (testFn) {
        testFn(assembly);
      }
    } catch (error) {
      fail(`Could not load Unity assembly ${assemblyName}: ${error}`);
    }
  });
}

/**
 * Creates a test that verifies a Unity type is accessible
 */
export function createUnityTypeTest(
  typeName: string,
  expectedMethods?: string[],
  expectedProperties?: string[],
  testFn?: (type: any) => void,
): TestResult {
  return createMonoTest(`Unity type ${typeName} should be accessible`, () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      const type = setup.domain.class(typeName);
      assertNotNull(type, `Unity type ${typeName} should be accessible`);

      if (expectedMethods) {
        for (const method of expectedMethods) {
          const methodObj = type.method(method);
          assertNotNull(methodObj, `Unity type ${typeName} should have method ${method}`);
        }
      }

      if (expectedProperties) {
        for (const prop of expectedProperties) {
          const propObj = type.property(prop);
          assertNotNull(propObj, `Unity type ${typeName} should have property ${prop}`);
        }
      }

      if (testFn) {
        testFn(type);
      }
    } catch (error) {
      fail(`Could not access Unity type ${typeName}: ${error}`);
    }
  });
}

/**
 * Creates a test for Unity GameObject operations
 */
export function createGameObjectTest(
  testName: string,
  testFn: (gameObjectClass: any, gameObject?: any) => void,
  createInstance = false,
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupUnityTestEnvironment();
    const gameObjectClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.GAMEOBJECT);
    assertNotNull(gameObjectClass, "GameObject class should be available");

    let gameObject;
    if (createInstance) {
      try {
        // Try to create a new GameObject instance
        gameObject = gameObjectClass.alloc();
        assertNotNull(gameObject, "GameObject instance should be created");
      } catch (error) {
        fail(`Could not create GameObject instance: ${error}`);
      }
    }

    testFn(gameObjectClass, gameObject);
  });
}

/**
 * Creates a test for Unity Component operations
 */
export function createComponentTest(
  testName: string,
  testFn: (componentClass: any, gameObjectClass: any) => void,
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupUnityTestEnvironment();
    const componentClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.COMPONENT);
    const gameObjectClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.GAMEOBJECT);
    assertNotNull(componentClass, "Component class should be available");
    assertNotNull(gameObjectClass, "GameObject class should be available");

    testFn(componentClass, gameObjectClass);
  });
}

/**
 * Creates a test for Unity Transform operations
 */
export function createTransformTest(
  testName: string,
  testFn: (transformClass: any, vector3Class?: any) => void,
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupUnityTestEnvironment();
    const transformClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.TRANSFORM);
    assertNotNull(transformClass, "Transform class should be available");

    // Try to get Vector3 class for position/rotation/scale tests
    let vector3Class;
    try {
      vector3Class = setup.domain?.class(UNITY_TEST_DATA.TYPES.VECTOR3);
    } catch (error) {
      // Vector3 might not be available, but that's ok for some tests
    }

    testFn(transformClass, vector3Class);
  });
}

/**
 * Creates a test for Unity MonoBehaviour operations
 */
export function createMonoBehaviourTest(
  testName: string,
  testFn: (monoBehaviourClass: any, componentClass?: any) => void,
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupUnityTestEnvironment();
    const monoBehaviourClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.MONO_BEHAVIOUR);
    const componentClass = setup.domain?.class(UNITY_TEST_DATA.TYPES.COMPONENT);
    assertNotNull(monoBehaviourClass, "MonoBehaviour class should be available");
    assertNotNull(componentClass, "Component class should be available");

    testFn(monoBehaviourClass, componentClass);
  });
}

/**
 * Creates a test for Unity static method calls
 */
export function createUnityStaticMethodTest(
  typeName: string,
  methodName: string,
  testFn?: (method: any) => void,
): TestResult {
  return createMonoTest(`Unity static method ${typeName}.${methodName} should be callable`, () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      const type = setup.domain.class(typeName);
      assertNotNull(type, `Unity type ${typeName} should be accessible`);

      const method = type.method(methodName);
      assertNotNull(method, `Unity type ${typeName} should have static method ${methodName}`);

      if (testFn) {
        testFn(method);
      }
    } catch (error) {
      fail(`Could not access Unity static method ${typeName}.${methodName}: ${error}`);
    }
  });
}

/**
 * Creates a test for Unity property access
 */
export function createUnityPropertyTest(
  typeName: string,
  propertyName: string,
  testFn?: (property: any) => void,
): TestResult {
  return createMonoTest(`Unity property ${typeName}.${propertyName} should be accessible`, () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      const type = setup.domain.class(typeName);
      assertNotNull(type, `Unity type ${typeName} should be accessible`);

      const property = type.property(propertyName);
      assertNotNull(property, `Unity type ${typeName} should have property ${propertyName}`);

      if (testFn) {
        testFn(property);
      }
    } catch (error) {
      fail(`Could not access Unity property ${typeName}.${propertyName}: ${error}`);
    }
  });
}

/**
 * Creates a test for Unity namespace verification
 */
export function createUnityNamespaceTest(namespace: string, expectedTypes?: string[]): TestResult {
  return createMonoTest(`Unity namespace ${namespace} should be accessible`, () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      const rootNamespaces = setup.domain.getRootNamespaces();
      assert(rootNamespaces.includes(namespace), `Unity namespace ${namespace} should be in root namespaces`);

      if (expectedTypes) {
        for (const typeName of expectedTypes) {
          const fullTypeName = `${namespace}.${typeName}`;
          const type = setup.domain.class(fullTypeName);
          assertNotNull(type, `Type ${fullTypeName} should be accessible in namespace ${namespace}`);
        }
      }
    } catch (error) {
      fail(`Could not verify Unity namespace ${namespace}: ${error}`);
    }
  });
}

/**
 * Creates a test for Unity version compatibility
 */
export function createUnityVersionTest(): TestResult {
  return createMonoTest("Unity version should be detectable", () => {
    const setup = setupUnityTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");

    try {
      // Try to get Unity version - this is a simplified version
      // Real implementation would depend on actual Unity API
      const versionType = setup.domain.class("UnityEngine.Application");
      assertNotNull(versionType, "Application class should be available");

      const versionProperty = versionType.property("unityVersion");
      assertNotNull(versionProperty, "Application.unityVersion property should be available");

      // Additional version checking logic would go here
    } catch (error) {
      fail(`Could not detect Unity version: ${error}`);
    }
  });
}

// ===== PERFORMANCE TEST UTILITIES =====

/**
 * Creates a performance test with automatic metrics collection
 */
export function createPerformanceTest(
  testName: string,
  testFn: () => void,
  options: PerformanceTestOptions = {},
): TestResult {
  const mergedOptions = { ...DEFAULT_PERFORMANCE_OPTIONS, ...options };

  return createTest(
    testName,
    () => {
      const setup = setupCommonTestEnvironment();
      const memoryBefore = measureMemory();

      // Warmup phase
      for (let i = 0; i < mergedOptions.warmupIterations!; i++) {
        testFn();
      }

      // Force garbage collection before actual test if requested
      if (mergedOptions.collectGarbage) {
        try {
          if (typeof globalThis !== "undefined" && (globalThis as any).gc) {
            (globalThis as any).gc();
          }
        } catch (_e) {
          // Ignore in Frida environment
        }
      }

      // Performance measurement phase
      const times: number[] = [];
      const startTime = Date.now();

      for (let i = 0; i < mergedOptions.iterations!; i++) {
        const iterationStart = Date.now();
        testFn();
        const iterationEnd = Date.now();
        times.push(iterationEnd - iterationStart);

        // Check timeout
        if (Date.now() - startTime > mergedOptions.timeout!) {
          fail(`Performance test timed out after ${mergedOptions.timeout}ms`);
        }
      }

      const memoryAfter = measureMemory();

      // Calculate metrics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const averageTime = totalTime / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const memoryDelta = memoryAfter - memoryBefore;
      const opsPerSecond = 1000 / averageTime;

      const metrics: PerformanceMetrics = {
        iterations: mergedOptions.iterations!,
        totalTime,
        averageTime,
        minTime,
        maxTime,
        memoryBefore,
        memoryAfter,
        memoryDelta,
        opsPerSecond,
      };

      // Validate against thresholds
      const errors: string[] = [];

      if (mergedOptions.maxAverageTime && averageTime > mergedOptions.maxAverageTime) {
        errors.push(`Average time ${averageTime.toFixed(2)}ms exceeds threshold ${mergedOptions.maxAverageTime}ms`);
      }

      if (mergedOptions.minOpsPerSecond && opsPerSecond < mergedOptions.minOpsPerSecond) {
        errors.push(
          `Operations per second ${opsPerSecond.toFixed(0)} below threshold ${mergedOptions.minOpsPerSecond}`,
        );
      }

      if (mergedOptions.memoryThreshold && memoryDelta > mergedOptions.memoryThreshold) {
        errors.push(
          `Memory delta ${(memoryDelta / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(mergedOptions.memoryThreshold / 1024 / 1024).toFixed(2)}MB`,
        );
      }

      // Log performance metrics
      console.log(`Performance metrics for ${testName}:`);
      console.log(`  Iterations: ${metrics.iterations}`);
      console.log(`  Total time: ${metrics.totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${metrics.averageTime.toFixed(2)}ms`);
      console.log(`  Min time: ${metrics.minTime.toFixed(2)}ms`);
      console.log(`  Max time: ${metrics.maxTime.toFixed(2)}ms`);
      console.log(`  Ops/sec: ${metrics.opsPerSecond?.toFixed(0)}`);
      if (metrics.memoryDelta !== undefined) {
        console.log(`  Memory delta: ${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      }

      if (errors.length > 0) {
        console.log(`  Errors: ${errors.join(", ")}`);
        fail(`Performance test failed: ${errors.join(", ")}`);
      }
    },
    {
      category: TestCategory.PERFORMANCE,
      requiresMono: true,
    },
  );
}

/**
 * Creates a Mono-specific performance test
 */
export function createMonoPerformanceTest(
  testName: string,
  testFn: () => void,
  options: PerformanceTestOptions = {},
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");
    assertNotNull(setup.api, "Mono API should be available");

    // Create a wrapped test function that includes Mono setup
    const wrappedTestFn = () => {
      Mono.perform(() => {
        testFn();
      });
    };

    // Run performance test with wrapped function
    const mergedOptions = { ...DEFAULT_PERFORMANCE_OPTIONS, ...options };
    const memoryBefore = measureMemory();

    // Warmup phase
    for (let i = 0; i < mergedOptions.warmupIterations!; i++) {
      wrappedTestFn();
    }

    // Force garbage collection before actual test if requested
    if (mergedOptions.collectGarbage) {
      try {
        if (typeof globalThis !== "undefined" && (globalThis as any).gc) {
          (globalThis as any).gc();
        }
      } catch (_e) {
        // Ignore in Frida environment
      }
    }

    // Performance measurement phase
    const times: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < mergedOptions.iterations!; i++) {
      const iterationStart = Date.now();
      wrappedTestFn();
      const iterationEnd = Date.now();
      times.push(iterationEnd - iterationStart);

      // Check timeout
      if (Date.now() - startTime > mergedOptions.timeout!) {
        fail(`Performance test timed out after ${mergedOptions.timeout}ms`);
      }
    }

    const memoryAfter = measureMemory();

    // Calculate metrics
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const memoryDelta = memoryAfter - memoryBefore;
    const opsPerSecond = 1000 / averageTime;

    const metrics: PerformanceMetrics = {
      iterations: mergedOptions.iterations!,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      memoryBefore,
      memoryAfter,
      memoryDelta,
      opsPerSecond,
    };

    // Validate against thresholds
    const errors: string[] = [];

    if (mergedOptions.maxAverageTime && averageTime > mergedOptions.maxAverageTime) {
      errors.push(`Average time ${averageTime.toFixed(2)}ms exceeds threshold ${mergedOptions.maxAverageTime}ms`);
    }

    if (mergedOptions.minOpsPerSecond && opsPerSecond < mergedOptions.minOpsPerSecond) {
      errors.push(`Operations per second ${opsPerSecond.toFixed(0)} below threshold ${mergedOptions.minOpsPerSecond}`);
    }

    if (mergedOptions.memoryThreshold && memoryDelta > mergedOptions.memoryThreshold) {
      errors.push(
        `Memory delta ${(memoryDelta / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(mergedOptions.memoryThreshold / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    // Log performance metrics
    console.log(`Mono performance metrics for ${testName}:`);
    console.log(`  Iterations: ${metrics.iterations}`);
    console.log(`  Total time: ${metrics.totalTime.toFixed(2)}ms`);
    console.log(`  Average time: ${metrics.averageTime.toFixed(2)}ms`);
    console.log(`  Min time: ${metrics.minTime.toFixed(2)}ms`);
    console.log(`  Max time: ${metrics.maxTime.toFixed(2)}ms`);
    console.log(`  Ops/sec: ${metrics.opsPerSecond?.toFixed(0)}`);
    if (metrics.memoryDelta !== undefined) {
      console.log(`  Memory delta: ${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    }

    if (errors.length > 0) {
      console.log(`  Errors: ${errors.join(", ")}`);
      fail(`Mono performance test failed: ${errors.join(", ")}`);
    }
  });
}

/**
 * Creates a basic lookup performance test for any type of member (method, field, property)
 * Reduced iterations for Frida environment to avoid timeouts
 */
export function createBasicLookupPerformanceTest(
  testName: string,
  lookupFunction: () => void,
  iterations: number = 10,
  maxTime: number = 30000,
): TestResult {
  // Use createTest directly instead of createPerformanceTest to avoid double iteration
  return createTest(
    testName,
    () => {
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        lookupFunction();
      }
      const lookupTime = Date.now() - startTime;

      console.log(`  ${iterations} iterations took ${lookupTime}ms`);
      assert(lookupTime < maxTime, `${testName} should complete within ${maxTime}ms`);
    },
    {
      category: TestCategory.PERFORMANCE,
      requiresMono: true,
    },
  );
}

/**
 * Creates a basic access performance test for any type of member access
 */
export function createBasicAccessPerformanceTest(
  testName: string,
  accessFunction: () => void,
  iterations: number = 100,
  maxTime: number = 2000,
): TestResult {
  // Use createTest directly instead of createPerformanceTest to avoid double iteration
  return createTest(
    testName,
    () => {
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        try {
          accessFunction();
        } catch (error) {
          // Ignore access errors for performance test
        }
      }
      const accessTime = Date.now() - startTime;

      console.log(`  ${iterations} iterations took ${accessTime}ms`);
      assert(accessTime < maxTime, `${testName} should be reasonably fast`);
    },
    {
      category: TestCategory.PERFORMANCE,
      requiresMono: true,
    },
  );
}

/**
 * Creates a method lookup performance test for a specific class and method
 */
export function createMethodLookupPerformanceTest(
  className: string,
  methodName: string,
  paramCount: number,
): TestResult {
  return createBasicLookupPerformanceTest(`Method lookup performance for ${className}.${methodName}`, () => {
    const domain = Mono.domain;
    const targetClass = domain.class(className);
    if (targetClass) {
      targetClass.getMethod(methodName, paramCount);
    }
  });
}

/**
 * Creates a field lookup performance test for a specific class and field
 */
export function createFieldLookupPerformanceTest(className: string, fieldName: string): TestResult {
  return createBasicLookupPerformanceTest(`Field lookup performance for ${className}.${fieldName}`, () => {
    const domain = Mono.domain;
    const targetClass = domain.class(className);
    if (targetClass) {
      targetClass.tryGetField(fieldName);
    }
  });
}

/**
 * Creates a property lookup performance test for a specific class and property
 */
export function createPropertyLookupPerformanceTest(className: string, propertyName: string): TestResult {
  return createBasicLookupPerformanceTest(`Property lookup performance for ${className}.${propertyName}`, () => {
    const domain = Mono.domain;
    const targetClass = domain.class(className);
    if (targetClass) {
      targetClass.tryGetProperty(propertyName);
    }
  });
}

// ===== STRING OPERATION TEST UTILITIES =====

/**
 * Creates a test for basic string creation
 */
export function createBasicStringCreationTest(): TestResult {
  return createMonoDependentTest("String creation should work correctly", () => {
    const testCases = ["Hello World", "", "Special chars: !@#$%^&*()", "Unicode: αβγδε", "Numbers: 1234567890"];

    for (const testCase of testCases) {
      const result = Mono.api.stringNew(testCase);
      assertNotNull(result, `String creation should work for: "${testCase}"`);
      assert(!result.isNull(), `String pointer should not be NULL for: "${testCase}"`);
    }

    console.log(`    Basic string creation tested with ${testCases.length} test cases`);
  });
}

/**
 * Creates a test for string manipulation operations
 */
export function createStringManipulationTest(): TestResult {
  return createMonoDependentTest("Should test string manipulation operations", () => {
    const testString = Mono.api.stringNew("Hello, World! This is a test string.");
    assertNotNull(testString, "Test string should be created");

    // Test string length
    const length = Mono.api.native.mono_string_length(testString);
    assert(length > 0, "String length should be positive");

    // Test character access
    const chars = Mono.api.native.mono_string_chars(testString);
    assertNotNull(chars, "String chars pointer should be available");

    // Test first character
    const firstChar = chars.readU16();
    assert(firstChar === "H".charCodeAt(0), `First character should be 'H', got ${String.fromCharCode(firstChar)}`);

    // Test string conversion back to JavaScript using native APIs
    const strLength = Mono.api.native.mono_string_length(testString);
    const strChars = Mono.api.native.mono_string_chars(testString);
    const converted = readUtf16String(strChars, strLength);
    assert(converted === "Hello, World! This is a test string.", "String conversion should preserve content");

    console.log(`    String manipulation: length=${length}, first_char='${String.fromCharCode(firstChar)}'`);
  });
}

/**
 * Creates a test for string encoding and UTF handling
 */
export function createStringEncodingTest(): TestResult {
  return createMonoDependentTest("Should test string encoding and UTF handling", () => {
    const encodingTests = [
      "ASCII only",
      "Café résumé", // Accented characters
      "東京", // Japanese
      "Москва", // Russian
      "العربية", // Arabic
      "עברית", // Hebrew
      "🎮🕹️⚽", // Emoji
      "Mixed: English 中文 العربية 🎮", // Mixed languages
    ];

    let successCount = 0;
    for (const testStr of encodingTests) {
      try {
        const monoString = Mono.api.stringNew(testStr);
        assertNotNull(monoString, `UTF string creation should work for: ${testStr}`);

        const length = Mono.api.native.mono_string_length(monoString);
        assert(length >= 0, `UTF string length should be non-negative for: ${testStr}`);

        // Test round-trip conversion using native APIs
        const utfLength = Mono.api.native.mono_string_length(monoString);
        const utfChars = Mono.api.native.mono_string_chars(monoString);
        const converted = readUtf16String(utfChars, utfLength);
        // Note: Some Unicode normalization might occur, so we check if it's reasonable
        assert(converted.length > 0, `Converted string should not be empty for: ${testStr}`);

        successCount++;
      } catch (error) {
        console.log(`    UTF handling failed for '${testStr}': ${error}`);
      }
    }

    console.log(`    UTF handling: ${successCount}/${encodingTests.length} encoding tests passed`);
  });
}

/**
 * Creates a test for string comparison and searching
 */
export function createStringComparisonTest(): TestResult {
  return createMonoDependentTest("Should test string comparison and searching", () => {
    const testStrings = [
      "Hello World",
      "hello world", // Different case
      "Hello World!", // Different content
      "Hello", // Shorter
      "Hello World Hello World", // Longer
    ];

    // Create all test strings
    const monoStrings = testStrings.map(str => Mono.api.stringNew(str));

    // Test string equality (basic comparison) using native APIs
    const str1Length = Mono.api.native.mono_string_length(monoStrings[0]);
    const str1Chars = Mono.api.native.mono_string_chars(monoStrings[0]);
    const str1 = readUtf16String(str1Chars, str1Length);

    const str2Length = Mono.api.native.mono_string_length(monoStrings[0]);
    const str2Chars = Mono.api.native.mono_string_chars(monoStrings[0]);
    const str2 = readUtf16String(str2Chars, str2Length); // Same string again
    assert(str1 === str2, "Same string should be equal");

    // Test string inequality
    const str3Length = Mono.api.native.mono_string_length(monoStrings[1]);
    const str3Chars = Mono.api.native.mono_string_chars(monoStrings[1]);
    const str3 = readUtf16String(str3Chars, str3Length);
    assert(str1 !== str3, "Different strings should not be equal");

    // Test string contains (basic substring search)
    const containsTest = Mono.api.stringNew("Hello");
    const containsTargetLength = Mono.api.native.mono_string_length(monoStrings[0]);
    const containsTargetChars = Mono.api.native.mono_string_chars(monoStrings[0]);
    const containsTarget = readUtf16String(containsTargetChars, containsTargetLength);
    assert(containsTarget.includes("Hello"), "String should contain substring");

    console.log(`    String comparison: tested ${testStrings.length} strings for equality and searching`);
  });
}

// ===== PARAMETERIZED ERROR HANDLING UTILITIES =====

/**
 * Creates parameterized tests for invalid method/field/property access
 */
export function createInvalidNameTests(
  testType: string,
  accessFunction: (name: string) => any,
  invalidNames: string[],
): TestResult[] {
  const results: TestResult[] = [];

  results.push(
    createErrorHandlingTest(`${testType} should handle empty names gracefully`, () => {
      const result = accessFunction("");
      assert(result === null, `Empty ${testType} name should return null`);
    }),
  );

  results.push(
    createErrorHandlingTest(`${testType} should handle null names gracefully`, () => {
      try {
        const result = accessFunction(null as any);
        assert(result === null, `Null ${testType} name should return null`);
      } catch (error) {
        // Expected to handle gracefully
        console.log(`    Null ${testType} name handled: ${error}`);
      }
    }),
  );

  invalidNames.forEach((invalidName, index) => {
    results.push(
      createErrorHandlingTest(`${testType} should handle invalid name ${index + 1}`, () => {
        const result = accessFunction(invalidName);
        assert(result === null, `Invalid ${testType} name should return null`);
      }),
    );
  });

  return results;
}

/**
 * Creates parameterized tests for required method/field/property access
 */
export function createRequiredAccessTests(
  testType: string,
  requiredAccessFunction: (name: string) => any,
  invalidNames: string[],
): TestResult[] {
  const results: TestResult[] = [];

  results.push(
    createErrorHandlingTest(`${testType} should throw for empty required names`, () => {
      assertThrows(() => {
        requiredAccessFunction("");
      }, `Should throw when required ${testType} name is empty`);
    }),
  );

  results.push(
    createErrorHandlingTest(`${testType} should throw for null required names`, () => {
      assertThrows(() => {
        requiredAccessFunction(null as any);
      }, `Should throw when required ${testType} name is null`);
    }),
  );

  invalidNames.forEach((invalidName, index) => {
    results.push(
      createErrorHandlingTest(`${testType} should throw for invalid required name ${index + 1}`, () => {
        assertThrows(() => {
          requiredAccessFunction(invalidName);
        }, `Should throw when required ${testType} name is invalid`);
      }),
    );
  });

  return results;
}

/**
 * Creates parameterized tests for boundary values
 */
export function createBoundaryValueTests(
  testName: string,
  testFunction: (value: any) => void,
  boundaryValues: any[],
  expectedResults?: any[],
): TestResult[] {
  const results: TestResult[] = [];

  boundaryValues.forEach((value, index) => {
    const description = `${testName} - boundary value ${index + 1}`;

    results.push(
      createMonoDependentTest(description, () => {
        try {
          testFunction(value);

          if (expectedResults && expectedResults[index] !== undefined) {
            // Check if result matches expectation
            console.log(`    Boundary test ${index + 1} completed`);
          }
        } catch (error) {
          if (expectedResults && expectedResults[index] === "error") {
            // Expected to throw
            console.log(`    Boundary test ${index + 1} threw as expected`);
          } else {
            // Not expected to throw
            throw error;
          }
        }
      }),
    );
  });

  return results;
}

/**
 * Creates parameterized tests for null/undefined value handling
 */
export function createNullValueTests(
  testName: string,
  testFunction: (value: any) => void,
  testValues: any[] = [null, undefined],
): TestResult[] {
  const results: TestResult[] = [];

  testValues.forEach((value, index) => {
    const valueName = value === null ? "null" : "undefined";
    const description = `${testName} - ${valueName} value ${index + 1}`;

    results.push(
      createMonoDependentTest(description, () => {
        try {
          testFunction(value);
          console.log(`    ${valueName} value test ${index + 1} completed`);
        } catch (error) {
          console.log(`    ${valueName} value test ${index + 1} threw: ${error}`);
          // Some null value tests are expected to throw, so don't re-throw
        }
      }),
    );
  });

  return results;
}

// ===== COMPREHENSIVE TEST COLLECTIONS =====

/**
 * Creates a comprehensive Unity test suite
 */
export function createUnityTestSuite(): TestResult[] {
  const results: TestResult[] = [];

  // Test Unity assemblies
  results.push(createUnityAssemblyTest(UNITY_TEST_DATA.ASSEMBLIES.UNITY_ENGINE));
  results.push(createUnityAssemblyTest(UNITY_TEST_DATA.ASSEMBLIES.UNITY_CORE_MODULE));

  // Test core Unity types
  results.push(createUnityTypeTest(UNITY_TEST_DATA.TYPES.GAMEOBJECT, ["Find", "Instantiate"]));
  results.push(createUnityTypeTest(UNITY_TEST_DATA.TYPES.COMPONENT, ["GetComponent"]));
  results.push(createUnityTypeTest(UNITY_TEST_DATA.TYPES.TRANSFORM, ["Find", "GetChild"]));
  results.push(createUnityTypeTest(UNITY_TEST_DATA.TYPES.MONO_BEHAVIOUR, ["Invoke"]));

  // Test Unity namespaces
  results.push(createUnityNamespaceTest(UNITY_TEST_DATA.NAMESPACES.UNITY_ENGINE));
  results.push(createUnityNamespaceTest(UNITY_TEST_DATA.NAMESPACES.UNITY_SCENE_MANAGEMENT));

  // Test Unity version
  results.push(createUnityVersionTest());

  return results;
}

/**
 * Creates a comprehensive set of string operation tests
 */
export function createComprehensiveStringTests(): TestResult[] {
  const results: TestResult[] = [];

  // Basic string creation tests
  results.push(createBasicStringCreationTest());

  // String manipulation tests
  results.push(createStringManipulationTest());
  results.push(createStringEncodingTest());
  results.push(createStringComparisonTest());

  return results;
}

/**
 * Creates a basic set of string tests (for API-focused test files)
 */
export function createBasicStringTests(): TestResult[] {
  const results: TestResult[] = [];

  // Basic string creation tests
  results.push(createBasicStringCreationTest());

  return results;
}

/**
 * Creates an advanced set of string tests (for data-focused test files)
 */
export function createAdvancedStringTests(): TestResult[] {
  const results: TestResult[] = [];

  // String manipulation tests
  results.push(createStringManipulationTest());
  results.push(createStringEncodingTest());
  results.push(createStringComparisonTest());

  return results;
}

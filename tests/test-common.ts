/**
 * Test Common Helpers
 * Consolidated common test utilities and setup functions used across all test files
 * This file consolidates functionality from multiple helper files for consistency
 */

import { 
  TestResult, 
  TestCategory, 
  createTest, 
  createMonoTest, 
  createDomainTest,
  assertNotNull,
  assert,
  fail
} from "./test-framework";
import Mono, { MonoDomain } from "../src";

// ===== COMMON INTERFACES AND TYPES =====

/**
 * Common test setup interface
 */
export interface CommonTestSetup {
  domain?: MonoDomain;
  api?: any;
  testAssembly?: any;
  testImage?: any;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  opsPerSecond?: number;
}

/**
 * Performance test options interface
 */
export interface PerformanceTestOptions {
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  memoryThreshold?: number; // in bytes
  minOpsPerSecond?: number;
  maxAverageTime?: number; // in milliseconds
  collectGarbage?: boolean;
}

// ===== COMMON TEST DATA =====

/**
 * Common test data and constants
 */
export const COMMON_TEST_DATA = {
  STRINGS: {
    EMPTY: "",
    SIMPLE: "test",
    UNICODE: "测试🧪",
    LONG: "a".repeat(1000),
    SPECIAL_CHARS: "!@#$%^&*()_+-=[]{}|;':\",./<>?"
  },
  NUMBERS: {
    ZERO: 0,
    POSITIVE: 42,
    NEGATIVE: -42,
    FLOAT: 3.14159,
    LARGE: Number.MAX_SAFE_INTEGER,
    SMALL: Number.MIN_SAFE_INTEGER
  },
  ASSEMBLIES: {
    MSCORLIB: "mscorlib",
    SYSTEM: "System",
    UNITY_ENGINE: "UnityEngine"
  },
  TYPES: {
    OBJECT: "System.Object",
    STRING: "System.String",
    INT32: "System.Int32",
    BOOLEAN: "System.Boolean"
  }
};

/**
 * Unity-specific test data and constants
 */
export const UNITY_TEST_DATA = {
  ASSEMBLIES: {
    UNITY_ENGINE: "UnityEngine",
    UNITY_CORE_MODULE: "UnityEngine.CoreModule",
    UNITY_PHYSICS_MODULE: "UnityEngine.PhysicsModule",
    UNITY_AUDIO_MODULE: "UnityEngine.AudioModule",
    UNITY_UI_MODULE: "UnityEngine.UI",
    UNITY_ANIMATION_MODULE: "UnityEngine.AnimationModule",
    UNITY_PARTICLE_SYSTEM_MODULE: "UnityEngine.ParticleSystemModule",
    UNITY_INPUT_MODULE: "UnityEngine.InputModule",
    UNITY_VIDEO_MODULE: "UnityEngine.VideoModule",
    UNITY_WEBGL_MODULE: "UnityEngine.WebGLModule",
    UNITY_ANDROID_MODULE: "UnityEngine.AndroidJNIModule",
  },
  TYPES: {
    GAMEOBJECT: "UnityEngine.GameObject",
    COMPONENT: "UnityEngine.Component",
    TRANSFORM: "UnityEngine.Transform",
    MONO_BEHAVIOUR: "UnityEngine.MonoBehaviour",
    SCRIPTABLE_OBJECT: "UnityEngine.ScriptableObject",
    VECTOR3: "UnityEngine.Vector3",
    VECTOR2: "UnityEngine.Vector2",
    QUATERNION: "UnityEngine.Quaternion",
    RIGIDBODY: "UnityEngine.Rigidbody",
    CAMERA: "UnityEngine.Camera",
    LIGHT: "UnityEngine.Light",
    MESH_RENDERER: "UnityEngine.MeshRenderer",
    BOX_COLLIDER: "UnityEngine.BoxCollider",
    SPHERE_COLLIDER: "UnityEngine.SphereCollider",
    AUDIO_SOURCE: "UnityEngine.AudioSource",
    ANIMATOR: "UnityEngine.Animator",
    CANVAS: "UnityEngine.Canvas",
    IMAGE: "UnityEngine.UI.Image",
    BUTTON: "UnityEngine.UI.Button",
    TEXT: "UnityEngine.UI.Text",
    PARTICLE_SYSTEM: "UnityEngine.ParticleSystem",
    INPUT: "UnityEngine.Input",
    TIME: "UnityEngine.Time",
    SCENE_MANAGER: "UnityEngine.SceneManagement.SceneManager",
    RESOURCES: "UnityEngine.Resources",
    ASSET_BUNDLE: "UnityEngine.AssetBundle",
    PLAYER_PREFS: "UnityEngine.PlayerPrefs",
  },
  NAMESPACES: {
    UNITY_ENGINE: "UnityEngine",
    UNITY_UI: "UnityEngine.UI",
    UNITY_SCENE_MANAGEMENT: "UnityEngine.SceneManagement",
    UNITY_EVENTS: "UnityEngine.Events",
    UNITY_AUDIO: "UnityEngine.Audio",
    UNITY_PHYSICS: "UnityEngine.Physics",
    UNITY_ANIMATION: "UnityEngine.Animation",
    UNITY_PARTICLE_SYSTEM: "UnityEngine.ParticleSystem",
  },
  METHODS: {
    GAMEOBJECT_FIND: "Find",
    GAMEOBJECT_FIND_GAMEOBJECT_WITH_TAG: "FindGameObjectWithTag",
    GAMEOBJECT_INSTANTIATE: "Instantiate",
    COMPONENT_GET_COMPONENT: "GetComponent",
    COMPONENT_GET_COMPONENT_IN_CHILDREN: "GetComponentInChildren",
    OBJECT_DESTROY: "Destroy",
    OBJECT_DONT_DESTROY_ON_LOAD: "DontDestroyOnLoad",
    TRANSFORM_FIND: "Find",
    TRANSFORM_GET_CHILD: "GetChild",
    INPUT_GET_KEY: "GetKey",
    INPUT_GET_BUTTON: "GetButton",
    TIME_GET_TIME: "get_time",
    TIME_GET_DELTA_TIME: "get_deltaTime",
    TIME_GET_FIXED_DELTA_TIME: "get_fixedDeltaTime",
    TIME_GET_TIME_SCALE: "get_timeScale",
    TIME_SET_TIME_SCALE: "set_timeScale",
  },
  PROPERTIES: {
    GAMEOBJECT_NAME: "name",
    GAMEOBJECT_ACTIVE_SELF: "activeSelf",
    GAMEOBJECT_ACTIVE_IN_HIERARCHY: "activeInHierarchy",
    GAMEOBJECT_TAG: "tag",
    GAMEOBJECT_LAYER: "layer",
    GAMEOBJECT_SCENE: "scene",
    TRANSFORM_POSITION: "position",
    TRANSFORM_ROTATION: "rotation",
    TRANSFORM_SCALE: "localScale",
    TRANSFORM_PARENT: "parent",
    TRANSFORM_ROOT: "root",
    TRANSFORM_CHILD_COUNT: "childCount",
    COMPONENT_GAMEOBJECT: "gameObject",
    COMPONENT_TRANSFORM: "transform",
    COMPONENT_TAG: "tag",
    MONO_BEHAVIOUR_ENABLED: "enabled",
    MONO_BEHAVIOUR_USES_UPDATE: "useGUILayout",
    CAMERA_ORTHOGRAPHIC: "orthographic",
    CAMERA_FIELD_OF_VIEW: "fieldOfView",
    CAMERA_BACKGROUND_COLOR: "backgroundColor",
    LIGHT_TYPE: "type",
    LIGHT_COLOR: "color",
    LIGHT_INTENSITY: "intensity",
    RIGIDBODY_VELOCITY: "velocity",
    RIGIDBODY_ANGULAR_VELOCITY: "angularVelocity",
    RIGIDBODY_USE_GRAVITY: "useGravity",
    RIGIDBODY_IS_KINEMATIC: "isKinematic",
  }
};

/**
 * Default performance test options
 */
export const DEFAULT_PERFORMANCE_OPTIONS: PerformanceTestOptions = {
  iterations: 1000,
  warmupIterations: 100,
  timeout: 30000, // 30 seconds
  memoryThreshold: 50 * 1024 * 1024, // 50MB
  minOpsPerSecond: 1000,
  maxAverageTime: 10, // 10ms
  collectGarbage: true
};

/**
 * Performance test presets
 */
export const PERFORMANCE_PRESETS = {
  LIGHT: { iterations: 100, warmupIterations: 10, maxAverageTime: 1 },
  MEDIUM: { iterations: 1000, warmupIterations: 100, maxAverageTime: 10 },
  HEAVY: { iterations: 10000, warmupIterations: 1000, maxAverageTime: 100 },
  MEMORY_INTENSIVE: { iterations: 100, memoryThreshold: 100 * 1024 * 1024 },
  CPU_INTENSIVE: { iterations: 1000, minOpsPerSecond: 10000 }
};

// ===== COMMON SETUP FUNCTIONS =====

/**
 * Sets up common test environment with domain and API access
 */
export function setupCommonTestEnvironment(): CommonTestSetup {
  const setup: CommonTestSetup = {};
  
  try {
    setup.domain = Mono.perform(() => Mono.domain);
    setup.api = Mono.perform(() => Mono.api);
  } catch (error) {
    // Some tests might not have Mono available
    console.warn(`Warning: Could not setup Mono environment: ${error}`);
  }
  
  return setup;
}

/**
 * Sets up Unity-specific test environment
 */
export function setupUnityTestEnvironment(): CommonTestSetup {
  const setup: CommonTestSetup = {};
  
  try {
    // Get basic Mono environment
    const basicSetup = setupCommonTestEnvironment();
    setup.domain = basicSetup.domain;
    setup.api = basicSetup.api;
    
    // Get Unity-specific assemblies
    if (setup.domain) {
      setup.testAssembly = setup.domain.getAssembly(UNITY_TEST_DATA.ASSEMBLIES.UNITY_ENGINE);
      // Note: Additional Unity setup can be added here as needed
    }
  } catch (error) {
    console.warn(`Warning: Could not setup Unity test environment: ${error}`);
  }
  
  return setup;
}

// ===== COMMON TEST CREATION FUNCTIONS =====

/**
 * Creates a standardized test for basic Mono functionality
 */
export function createBasicMonoTest(testName: string, testFn: (setup: CommonTestSetup) => void): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");
    assertNotNull(setup.api, "Mono API should be available");
    testFn(setup);
  });
}

/**
 * Creates a test that verifies a specific Mono API function exists and is callable
 */
export function createApiFunctionTest(
  functionName: string, 
  expectedSignature?: string,
  testFn?: (api: any, func: any) => void
): TestResult {
  return createMonoTest(`API function ${functionName} should be available`, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.api, "Mono API should be available");
    
    const func = setup.api[functionName];
    assertNotNull(func, `API function ${functionName} should exist`);
    assert(typeof func === 'function', `${functionName} should be a function`);
    
    if (expectedSignature) {
      const funcStr = func.toString();
      assert(funcStr.includes(expectedSignature), 
        `${functionName} should have expected signature containing ${expectedSignature}`);
    }
    
    if (testFn) {
      testFn(setup.api, func);
    }
  });
}

/**
 * Creates a test that verifies a specific Mono type can be accessed
 */
export function createMonoTypeTest(
  typeName: string, 
  expectedProperties?: string[],
  testFn?: (type: any) => void
): TestResult {
  return createMonoTest(`Mono type ${typeName} should be accessible`, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");
    
    // Try to get the type - this is a simplified version
    // Real implementation would depend on the actual Mono API
    try {
      const type = setup.domain.class(typeName);
      assertNotNull(type, `Type ${typeName} should be accessible`);
      
      if (expectedProperties) {
        for (const prop of expectedProperties) {
          assert(prop in type, `Type ${typeName} should have property ${prop}`);
        }
      }
      
      if (testFn) {
        testFn(type);
      }
    } catch (error) {
      fail(`Could not access type ${typeName}: ${error}`);
    }
  });
}

/**
 * Creates a standardized error handling test
 */
export function createErrorHandlingTest(
  testName: string,
  errorCondition: () => void,
  expectedErrorPattern?: string | RegExp
): TestResult {
  return createTest(testName, () => {
    try {
      errorCondition();
      fail("Expected function to throw an error, but it didn't");
    } catch (error) {
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (expectedErrorPattern) {
        const pattern = expectedErrorPattern instanceof RegExp ? 
          expectedErrorPattern : 
          new RegExp(expectedErrorPattern);
        assert(pattern.test(errorStr), 
          `Error message should match pattern ${expectedErrorPattern}, got: ${errorStr}`);
      }
      // If no pattern specified, just verify an error was thrown
    }
  }, {
    category: TestCategory.ERROR_HANDLING,
    requiresMono: true
  });
}

/**
 * Creates a boundary value test with multiple test cases
 */
export function createBoundaryValueTest<T>(
  testName: string,
  testFn: (value: T) => void,
  testValues: T[],
  options?: { shouldPass?: boolean }
): TestResult {
  return createTest(testName, () => {
    for (const value of testValues) {
      try {
        testFn(value);
        if (options?.shouldPass === false) {
          fail(`Expected test to fail for value ${value}, but it passed`);
        }
      } catch (error) {
        if (options?.shouldPass !== false) {
          fail(`Test failed for value ${value}: ${error}`);
        }
        // If we expect failure, this is expected behavior
      }
    }
  }, {
    category: TestCategory.ERROR_HANDLING,
    requiresMono: true
  });
}

/**
 * Creates a null/undefined safety test
 */
export function createNullSafetyTest(
  testName: string,
  testFn: (value: any) => void,
  nullValues: any[] = [null, undefined, false, 0, ""]
): TestResult {
  return createTest(testName, () => {
    for (const nullValue of nullValues) {
      try {
        testFn(nullValue);
        // If we get here, the test passed for this null value
      } catch (error) {
        // Check if the error is expected for this null value
        const errorStr = error instanceof Error ? error.message : String(error);
        if (!errorStr.toLowerCase().includes("null") && 
            !errorStr.toLowerCase().includes("undefined") &&
            !errorStr.toLowerCase().includes("invalid")) {
          fail(`Unexpected error for null value ${nullValue}: ${errorStr}`);
        }
      }
    }
  }, {
    category: TestCategory.ERROR_HANDLING,
    requiresMono: true
  });
}

/**
 * Creates a parameterized test that runs the same test with multiple inputs
 */
export function createParameterizedTest<T>(
  baseTestName: string,
  testFn: (value: T, index: number) => void,
  testValues: T[],
  options?: { category?: TestCategory; requiresMono?: boolean }
): TestResult[] {
  return testValues.map((value, index) => {
    return createTest(`${baseTestName} (case ${index + 1}: ${value})`, () => {
      testFn(value, index);
    }, {
      category: options?.category ?? TestCategory.MONO_DEPENDENT,
      requiresMono: options?.requiresMono ?? true
    });
  });
}

/**
 * Utility to create a test that verifies string operations
 */
export function createStringOperationTest(
  testName: string,
  operation: (input: string) => string | number | boolean,
  testCases: Array<{ input: string; expected: any; description?: string }>
): TestResult {
  return createTest(testName, () => {
    for (const testCase of testCases) {
      const result = operation(testCase.input);
      assert(result === testCase.expected, 
        `String operation failed for input "${testCase.input}": expected ${testCase.expected}, got ${result}`);
    }
  }, {
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  });
}

/**
 * Creates a test for memory management scenarios
 */
export function createMemoryTest(
  testName: string,
  testFn: () => void,
  options?: { expectMemoryLeak?: boolean }
): TestResult {
  return createTest(testName, () => {
    // Measure memory before test
    const initialMemory = process.memoryUsage();
    
    // Run the test
    testFn();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Measure memory after test
    const finalMemory = process.memoryUsage();
    const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // If we expect no memory leak, check that memory usage is reasonable
    if (!options?.expectMemoryLeak && memoryDiff > 10 * 1024 * 1024) { // 10MB threshold
      console.warn(`Warning: High memory usage detected in ${testName}: ${memoryDiff} bytes`);
    }
  }, {
    category: TestCategory.PERFORMANCE,
    requiresMono: true
  });
}

/**
 * Creates a test that verifies threading behavior
 */
export function createThreadingTest(
  testName: string,
  testFn: () => Promise<void> | void,
  options?: { timeout?: number }
): TestResult {
  return createTest(testName, async () => {
    const timeout = options?.timeout ?? 5000; // 5 second default timeout
    
    const result = Promise.race([
      Promise.resolve(testFn()),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
      )
    ]);
    
    await result;
  }, {
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  });
}

/**
 * Utility to create a test that verifies assembly loading
 */
export function createAssemblyTest(
  testName: string,
  assemblyName: string,
  testFn?: (assembly: any) => void
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");
    
    try {
      const assembly = setup.domain.getAssembly(assemblyName);
      assertNotNull(assembly, `Assembly ${assemblyName} should be loadable`);
      
      if (testFn) {
        testFn(assembly);
      }
    } catch (error) {
      fail(`Could not load assembly ${assemblyName}: ${error}`);
    }
  });
}

/**
 * Creates a test for type checking operations
 */
export function createTypeCheckingTest(
  testName: string,
  typeName: string,
  expectedBaseType?: string,
  expectedInterfaces?: string[]
): TestResult {
  return createMonoTest(testName, () => {
    const setup = setupCommonTestEnvironment();
    assertNotNull(setup.domain, "Mono domain should be available");
    
    try {
      const type = setup.domain.class(typeName);
      assertNotNull(type, `Type ${typeName} should be accessible`);
      
      if (expectedBaseType) {
        // Check base type - implementation depends on actual Mono API
        const baseType = type.getParent();
        assertNotNull(baseType, `Type ${typeName} should have a base type`);
        // Additional checks would go here based on actual API
      }
      
      if (expectedInterfaces) {
        // Check interfaces - implementation depends on actual Mono API
        // Additional checks would go here based on actual API
      }
    } catch (error) {
      fail(`Type checking failed for ${typeName}: ${error}`);
    }
  });
}

// ===== COMMON UTILITY FUNCTIONS =====

/**
 * Measures memory usage before and after a test
 */
export function measureMemory(before?: number): number {
  if (global.gc) {
    global.gc();
  }
  const memory = process.memoryUsage();
  return memory.heapUsed;
}

/**
 * Measures performance of a function and returns metrics
 */
export function measurePerformance(testFn: () => void, options: PerformanceTestOptions): PerformanceMetrics {
  const times: number[] = [];
  
  // Warmup phase
  for (let i = 0; i < options.warmupIterations!; i++) {
    testFn();
  }
  
  // Force garbage collection if requested
  if (options.collectGarbage) {
    if (global.gc) {
      global.gc();
    }
  }
  
  // Performance measurement phase
  for (let i = 0; i < options.iterations!; i++) {
    const iterationStart = Date.now();
    testFn();
    const iterationEnd = Date.now();
    times.push(iterationEnd - iterationStart);
  }
  
  // Calculate metrics
  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const opsPerSecond = 1000 / averageTime;
  
  return {
    iterations: options.iterations!,
    totalTime,
    averageTime,
    minTime,
    maxTime,
    opsPerSecond
  };
}
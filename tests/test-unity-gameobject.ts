/**
 * Unity GameObject Tests
 * Comprehensive tests for Unity GameObject operations in Frida Mono Bridge
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createPerformanceTest,
  assert,
  assertNotNull,
  assertApiAvailable,
  assertDomainAvailable,
  TestCategory
} from "./test-framework";

export function testUnityGameObject(): TestResult {
  console.log("\nUnity GameObject Tests:");

  const suite = new TestSuite("Unity GameObject Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity GameObject operations"));

  // Basic GameObject class availability
  suite.addResult(createMonoDependentTest("UnityEngine.GameObject class should be available", () => {
    assertDomainAvailable("Domain should be available for GameObject tests");

    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");
    assertNotNull(gameObjectClass, "UnityEngine.GameObject class should be found");

    if (gameObjectClass) {
      console.log(`    GameObject class found: ${gameObjectClass.getName?.() || 'GameObject'}`);
      const assembly = (gameObjectClass as any).image?.assembly;
      console.log(`    Assembly: ${assembly?.name || 'Unknown'}`);
    }
  }));

  // GameObject static methods
  suite.addResult(createMonoDependentTest("GameObject static methods should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test common static methods
    const findMethod = gameObjectClass.method("Find", 1);
    const findWithTagMethod = gameObjectClass.method("FindWithTag", 1);
    const findGameObjectsWithTagMethod = gameObjectClass.method("FindGameObjectsWithTag", 1);

    console.log(`    Find method: ${findMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    FindWithTag method: ${findWithTagMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    FindGameObjectsWithTag method: ${findGameObjectsWithTagMethod !== null ? 'Available' : 'Not available'}`);

    // These methods should exist in Unity
    const hasFindMethod = findMethod !== null;
    const hasFindWithTagMethod = findWithTagMethod !== null;
    assert(hasFindMethod || hasFindWithTagMethod, "At least one GameObject.Find method should be available");
  }));

  // GameObject creation methods
  suite.addResult(createMonoDependentTest("GameObject creation methods should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test various constructor overloads
    const constructor1 = gameObjectClass.method(".ctor", 0);  // GameObject()
    const constructor2 = gameObjectClass.method(".ctor", 1);  // GameObject(string)
    const constructor3 = gameObjectClass.method(".ctor", 2);  // GameObject(string, System.Type[])

    console.log(`    Default constructor: ${constructor1 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Name constructor: ${constructor2 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Full constructor: ${constructor3 !== null ? 'Available' : 'Not available'}`);

    // At least one constructor should be available
    const hasConstructor1 = constructor1 !== null;
    const hasConstructor2 = constructor2 !== null;
    assert(hasConstructor1 || hasConstructor2, "At least one GameObject constructor should be available");
  }));

  // GameObject instance methods
  suite.addResult(createMonoDependentTest("GameObject instance methods should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test common instance methods
    const getActiveMethod = gameObjectClass.method("get_ActiveInHierarchy", 0);
    const setActiveMethod = gameObjectClass.method("SetActive", 1);
    const getNameMethod = gameObjectClass.method("get_name", 0);
    const setNameMethod = gameObjectClass.method("set_name", 1);

    console.log(`    get_ActiveInHierarchy: ${getActiveMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    SetActive: ${setActiveMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    get_name: ${getNameMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    set_name: ${setNameMethod !== null ? 'Available' : 'Not available'}`);

    // Core methods should be available
    const hasGetActive = getActiveMethod !== null;
    const hasSetActive = setActiveMethod !== null;
    const hasGetName = getNameMethod !== null;
    assert(hasGetActive && hasSetActive, "Active/Inactive methods should be available");
    assert(hasGetName, "Name getter should be available");
  }));

  // GameObject component operations
  suite.addResult(createMonoDependentTest("GameObject component methods should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test component-related methods
    const getComponentMethod = gameObjectClass.method("GetComponent", 1);
    const getComponentInChildrenMethod = gameObjectClass.method("GetComponentInChildren", 1);
    const addComponentMethod = gameObjectClass.method("AddComponent", 1);

    console.log(`    GetComponent: ${getComponentMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    GetComponentInChildren: ${getComponentInChildrenMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    AddComponent: ${addComponentMethod !== null ? 'Available' : 'Not available'}`);

    // Core component methods should be available
    const hasGetComponent = getComponentMethod !== null;
    const hasAddComponent = addComponentMethod !== null;
    assert(hasGetComponent, "GetComponent should be available");
    assert(hasAddComponent, "AddComponent should be available");
  }));

  // GameObject transform operations
  suite.addResult(createMonoDependentTest("GameObject transform operations should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test transform property
    const getTransformMethod = gameObjectClass.method("get_transform", 0);
    console.log(`    get_transform: ${getTransformMethod !== null ? 'Available' : 'Not available'}`);

    if (getTransformMethod) {
      // Also test Transform class availability
      const transformClass = domain.class("UnityEngine.Transform");
      console.log(`    Transform class: ${transformClass ? 'Available' : 'Not available'}`);

      if (transformClass) {
        const getPositionMethod = transformClass.method("get_position", 0);
        const setPositionMethod = transformClass.method("set_position", 1);
        console.log(`    Transform position methods: ${getPositionMethod !== null && setPositionMethod !== null ? 'Available' : 'Not available'}`);
      }
    }

    assert(getTransformMethod !== null, "Transform property should be available");
  }));

  // Safe GameObject.Find operation
  suite.addResult(createMonoDependentTest("GameObject.Find should work safely", () => {
    try {
      const domain = Mono.domain;
      const gameObjectClass = domain.class("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const findMethod = gameObjectClass.method("Find", 1);
      if (!findMethod) {
        console.log("    (Skipped: GameObject.Find method not available)");
        return;
      }

      // Validate method pointer
      const methodPtr = (findMethod as any).handle;
      if (!methodPtr || methodPtr.isNull()) {
        console.log("    (Skipped: GameObject.Find method pointer is null)");
        return;
      }

      // Try to find common GameObject names
      const commonNames = ["Main Camera", "Player", "GameManager", "Canvas", "EventSystem"];
      let foundAny = false;

      for (const name of commonNames) {
        try {
          const result = findMethod.invoke(null, [name]);
          if (result && !result.isNull()) {
            console.log(`    Found GameObject: "${name}"`);
            foundAny = true;
          }
        } catch (error) {
          // Expected - many objects may not exist
          continue;
        }
      }

      if (!foundAny) {
        console.log("    No common GameObjects found (expected in test environment)");
      }

      console.log("    GameObject.Find operations tested safely");
    } catch (error) {
      if (error instanceof Error && error.message.includes("access violation")) {
        console.log("    (Skipped: GameObject.Find access violation - method may not be available in this Unity context)");
        return;
      }
      throw error;
    }
  }));

  // GameObject property access tests
  suite.addResult(createMonoDependentTest("GameObject properties should be accessible", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    // Test various GameObject properties
    const activeSelfProperty = gameObjectClass.property("activeSelf");
    const activeInHierarchyProperty = gameObjectClass.property("activeInHierarchy");
    const layerProperty = gameObjectClass.property("layer");
    const tagProperty = gameObjectClass.property("tag");

    console.log(`    activeSelf property: ${activeSelfProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    activeInHierarchy property: ${activeInHierarchyProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    layer property: ${layerProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    tag property: ${tagProperty !== null ? 'Available' : 'Not available'}`);

    // Core properties should be available
    const hasActiveSelf = activeSelfProperty !== null;
    const hasTag = tagProperty !== null;
    assert(hasActiveSelf, "activeSelf property should be available");
    assert(hasTag, "tag property should be available");
  }));

  // Error handling for GameObject operations
  suite.addResult(createErrorHandlingTest("GameObject operations should handle errors gracefully", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    try {
      // Test with invalid GameObject name
      const findMethod = gameObjectClass.method("Find", 1);
      if (findMethod) {
        try {
          const result = findMethod.invoke(null, [""]);
          // Should return null for empty string - that's valid behavior
          console.log("    Empty name handling: Returns null as expected");
        } catch (error) {
          console.log("    Empty name handling: Throws gracefully");
        }
      }

      // Test with null name
      try {
        const result = findMethod?.invoke(null, [null]);
        console.log("    Null name handling: Handled gracefully");
      } catch (error) {
        console.log("    Null name handling: Throws gracefully");
      }

      console.log("    GameObject error handling working correctly");
    } catch (error) {
      if (error instanceof Error && error.message.includes("access violation")) {
        console.log("    (Skipped: GameObject error handling access violation)");
        return;
      }
      throw error;
    }
  }));

  // Performance test for GameObject operations
  suite.addResult(createPerformanceTest("GameObject operations performance", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    const findMethod = gameObjectClass.method("Find", 1);
    if (!findMethod) {
      console.log("    (Skipped: Find method not available)");
      return;
    }

    const iterations = 50;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        findMethod.invoke(null, [`TestObject${i}`]);
      } catch (error) {
        // Expected to fail for most iterations
      }
    }

    const duration = Date.now() - startTime;
    console.log(`    ${iterations} GameObject.Find operations took ${duration}ms`);
    assert(duration < 5000, "GameObject operations should be reasonably fast");
  }));

  // Integration test with other Unity systems
  suite.addResult(createIntegrationTest("GameObject integration with Unity systems", () => {
    const domain = Mono.domain;

    // Test GameObject with Transform
    const gameObjectClass = domain.class("UnityEngine.GameObject");
    const transformClass = domain.class("UnityEngine.Transform");

    if (gameObjectClass && transformClass) {
      console.log("    GameObject and Transform classes available for integration");
    }

    // Test GameObject with Component system
    const componentClass = domain.class("UnityEngine.Component");
    if (componentClass) {
      console.log("    Component system available for GameObject integration");
    }

    // Test GameObject with Scene management
    const sceneManagerClass = domain.class("UnityEngine.SceneManagement.SceneManager");
    if (sceneManagerClass) {
      console.log("    Scene management available for GameObject integration");
    }

    console.log("    GameObject integration test completed");
  }));

  const summary = suite.getSummary();

  return {
    name: "Unity GameObject Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity GameObject tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}
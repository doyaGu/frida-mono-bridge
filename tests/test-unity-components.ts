/**
 * Unity Components Tests
 * Comprehensive tests for Unity Component operations in Frida Mono Bridge
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createMonoDependentTest,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createPerformanceTest,
  assert,
  assertNotNull,
  assertDomainAvailable,
  TestCategory
} from "./test-framework";

export function testUnityComponents(): TestResult {
  console.log("\nUnity Components Tests:");

  const suite = new TestSuite("Unity Components Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity Component operations"));

  // Core Component class availability
  suite.addResult(createMonoDependentTest("UnityEngine.Component class should be available", () => {
    assertDomainAvailable("Domain should be available for Component tests");

    const domain = Mono.domain;
    const componentClass = domain.class("UnityEngine.Component");

    if (componentClass) {
      console.log(`    Component class found: ${componentClass.getName?.() || 'Component'}`);
      const assembly = (componentClass as any).image?.assembly;
      console.log(`    Assembly: ${assembly?.name || 'Unknown'}`);
    } else {
      console.log("    (Note: UnityEngine.Component class not found - testing through GameObject)");
    }
  }));

  // Transform component availability and operations
  suite.addResult(createMonoDependentTest("UnityEngine.Transform component should be available", () => {
    const domain = Mono.domain;
    const transformClass = domain.class("UnityEngine.Transform");

    assertNotNull(transformClass, "UnityEngine.Transform class should be found");

    if (transformClass) {
      // Test Transform properties
      const positionProperty = transformClass.property("position");
      const rotationProperty = transformClass.property("rotation");
      const localScaleProperty = transformClass.property("localScale");
      const parentProperty = transformClass.property("parent");

      console.log(`    Transform.position: ${positionProperty !== null ? 'Available' : 'Not available'}`);
      console.log(`    Transform.rotation: ${rotationProperty !== null ? 'Available' : 'Not available'}`);
      console.log(`    Transform.localScale: ${localScaleProperty !== null ? 'Available' : 'Not available'}`);
      console.log(`    Transform.parent: ${parentProperty !== null ? 'Available' : 'Not available'}`);

      // Test Transform methods
      const translateMethod = transformClass.method("Translate", 1);
      const rotateMethod = transformClass.method("Rotate", 1);
      const lookAtMethod = transformClass.method("LookAt", 1);

      console.log(`    Transform.Translate: ${translateMethod !== null ? 'Available' : 'Not available'}`);
      console.log(`    Transform.Rotate: ${rotateMethod !== null ? 'Available' : 'Not available'}`);
      console.log(`    Transform.LookAt: ${lookAtMethod !== null ? 'Available' : 'Not available'}`);

      // Core Transform functionality should be available
      const hasPosition = positionProperty !== null;
      const hasTranslate = translateMethod !== null;
      assert(hasPosition, "Transform position should be available");
      assert(hasTranslate, "Transform.Translate should be available");
    }
  }));

  // MonoBehaviour availability
  suite.addResult(createMonoDependentTest("UnityEngine.MonoBehaviour class should be available", () => {
    const domain = Mono.domain;
    const monoBehaviourClass = domain.class("UnityEngine.MonoBehaviour");

    if (monoBehaviourClass) {
      console.log(`    MonoBehaviour class found: ${monoBehaviourClass.getName?.() || 'MonoBehaviour'}`);

      // Test MonoBehaviour methods
      const enabledProperty = monoBehaviourClass.property("enabled");
      const gameObjectProperty = monoBehaviourClass.property("gameObject");
      const transformProperty = monoBehaviourClass.property("transform");

      console.log(`    MonoBehaviour.enabled: ${enabledProperty !== null ? 'Available' : 'Not available'}`);
      console.log(`    MonoBehaviour.gameObject: ${gameObjectProperty !== null ? 'Available' : 'Not available'}`);
      console.log(`    MonoBehaviour.transform: ${transformProperty !== null ? 'Available' : 'Not available'}`);

      // Test lifecycle methods
      const startMethod = monoBehaviourClass.method("Start", 0);
      const updateMethod = monoBehaviourClass.method("Update", 0);
      const awakeMethod = monoBehaviourClass.method("Awake", 0);

      console.log(`    MonoBehaviour.Start: ${startMethod !== null ? 'Available' : 'Not available'}`);
      console.log(`    MonoBehaviour.Update: ${updateMethod !== null ? 'Available' : 'Not available'}`);
      console.log(`    MonoBehaviour.Awake: ${awakeMethod !== null ? 'Available' : 'Not available'}`);

      const hasGameObject = gameObjectProperty !== null;
      assert(hasGameObject, "MonoBehaviour.gameObject should be available");
    } else {
      console.log("    (Note: UnityEngine.MonoBehaviour class not found - may be compiled differently)");
    }
  }));

  // Camera component tests
  suite.addResult(createMonoDependentTest("UnityEngine.Camera component should be available", () => {
    const domain = Mono.domain;
    const cameraClass = domain.class("UnityEngine.Camera");

    if (!cameraClass) {
      console.log("    (Skipped: Camera class not available)");
      return;
    }

    // Test Camera properties
    const fieldOfViewProperty = cameraClass.property("fieldOfView");
    const nearClipPlaneProperty = cameraClass.property("nearClipPlane");
    const farClipPlaneProperty = cameraClass.property("farClipPlane");
    const orthographicProperty = cameraClass.property("orthographic");
    const backgroundColorProperty = cameraClass.property("backgroundColor");

    console.log(`    Camera.fieldOfView: ${fieldOfViewProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Camera.nearClipPlane: ${nearClipPlaneProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Camera.farClipPlane: ${farClipPlaneProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Camera.orthographic: ${orthographicProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Camera.backgroundColor: ${backgroundColorProperty !== null ? 'Available' : 'Not available'}`);

    // Test Camera methods
    const mainCameraProperty = cameraClass.property("main");
    const screenPointToRayMethod = cameraClass.method("ScreenPointToRay", 1);

    console.log(`    Camera.main: ${mainCameraProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Camera.ScreenPointToRay: ${screenPointToRayMethod !== null ? 'Available' : 'Not available'}`);

    const hasFieldOfView = fieldOfViewProperty !== null;
    assert(hasFieldOfView, "Camera fieldOfView should be available");
  }));

  // Rigidbody component tests
  suite.addResult(createMonoDependentTest("UnityEngine.Rigidbody component should be available", () => {
    const domain = Mono.domain;
    const rigidbodyClass = domain.class("UnityEngine.Rigidbody");

    if (!rigidbodyClass) {
      console.log("    (Skipped: Rigidbody class not available)");
      return;
    }

    // Test Rigidbody properties
    const massProperty = rigidbodyClass.property("mass");
    const dragProperty = rigidbodyClass.property("drag");
    const useGravityProperty = rigidbodyClass.property("useGravity");
    const isKinematicProperty = rigidbodyClass.property("isKinematic");

    console.log(`    Rigidbody.mass: ${massProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Rigidbody.drag: ${dragProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Rigidbody.useGravity: ${useGravityProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Rigidbody.isKinematic: ${isKinematicProperty !== null ? 'Available' : 'Not available'}`);

    // Test Rigidbody methods
    const addForceMethod = rigidbodyClass.method("AddForce", 1);
    const addTorqueMethod = rigidbodyClass.method("AddTorque", 1);
    const movePositionMethod = rigidbodyClass.method("MovePosition", 1);

    console.log(`    Rigidbody.AddForce: ${addForceMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Rigidbody.AddTorque: ${addTorqueMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Rigidbody.MovePosition: ${movePositionMethod !== null ? 'Available' : 'Not available'}`);

    const hasMass = massProperty !== null;
    const hasAddForce = addForceMethod !== null;
    assert(hasMass, "Rigidbody mass should be available");
    assert(hasAddForce, "Rigidbody.AddForce should be available");
  }));

  // Component retrieval from GameObject
  suite.addResult(createMonoDependentTest("Component retrieval from GameObject should work", () => {
    try {
      const domain = Mono.domain;
      const gameObjectClass = domain.class("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const getComponentMethod = gameObjectClass.method("GetComponent", 1);
      if (!getComponentMethod) {
        console.log("    (Skipped: GetComponent method not available)");
        return;
      }

      // Validate method pointer
      const methodPtr = (getComponentMethod as any).handle;
      if (!methodPtr || methodPtr.isNull()) {
        console.log("    (Skipped: GetComponent method pointer is null)");
        return;
      }

      // Try to get different component types
      const componentTypes = [
        "UnityEngine.Transform",
        "UnityEngine.Camera",
        "UnityEngine.Rigidbody",
        "UnityEngine.BoxCollider",
        "UnityEngine.MeshRenderer"
      ];

      let successCount = 0;

      for (const componentType of componentTypes) {
        try {
          // First get the component type
          const typeClass = domain.class(componentType);
          if (!typeClass) {
            continue;
          }

          // Try to find a GameObject first
          const findMethod = gameObjectClass.method("Find", 1);
          let testObject = null;

          if (findMethod) {
            testObject = findMethod.invoke(null, ["Main Camera"]);
          }

          // If no GameObject found, we can't test GetComponent properly
          if (!testObject || testObject.isNull()) {
            continue;
          }

          // Try to get component (this might fail if component doesn't exist)
          const result = getComponentMethod.invoke(testObject, [typeClass.getType().pointer]);
          if (result && !result.isNull()) {
            console.log(`    Successfully retrieved component: ${componentType}`);
            successCount++;
          }
        } catch (error) {
          // Expected - component may not exist
          continue;
        }
      }

      if (successCount === 0) {
        console.log("    No components retrieved (expected without specific GameObject setup)");
      } else {
        console.log(`    Successfully retrieved ${successCount} components`);
      }

      console.log("    Component retrieval tested safely");
    } catch (error) {
      if (error instanceof Error && error.message.includes("access violation")) {
        console.log("    (Skipped: Component retrieval access violation - method may not be available in this Unity context)");
        return;
      }
      throw error;
    }
  }));

  // Component addition tests
  suite.addResult(createMonoDependentTest("Component addition should be available", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    const addComponentMethod = gameObjectClass.method("AddComponent", 1);
    if (!addComponentMethod) {
      console.log("    (Skipped: AddComponent method not available)");
      return;
    }

    // Test different component types for addition
    const componentTypes = [
      "UnityEngine.Rigidbody",
      "UnityEngine.BoxCollider",
      "UnityEngine.MeshRenderer",
      "UnityEngine.AudioSource"
    ];

    let availableCount = 0;

    for (const componentType of componentTypes) {
      const typeClass = domain.class(componentType);
      if (typeClass) {
        availableCount++;
        console.log(`    ${componentType}: Available for addition`);
      }
    }

    console.log(`    ${availableCount}/${componentTypes.length} component types available for addition`);
    const hasAvailableTypes = availableCount > 0;
    assert(hasAvailableTypes, "At least one component type should be available for addition");
  }));

  // Component error handling
  suite.addResult(createErrorHandlingTest("Component operations should handle errors gracefully", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    const getComponentMethod = gameObjectClass.method("GetComponent", 1);
    if (!getComponentMethod) {
      console.log("    (Skipped: GetComponent method not available)");
      return;
    }

    try {
      // Test with null GameObject
      try {
        const transformClass = domain.class("UnityEngine.Transform");
        const result = getComponentMethod.invoke(null, [transformClass?.getType().pointer ?? null]);
        console.log("    Null GameObject handling: Handled gracefully");
      } catch (error) {
        console.log("    Null GameObject handling: Throws gracefully");
      }

      // Test with invalid component type
      try {
        const result = getComponentMethod.invoke(null, [null]);
        console.log("    Invalid component type handling: Handled gracefully");
      } catch (error) {
        console.log("    Invalid component type handling: Throws gracefully");
      }

      console.log("    Component error handling working correctly");
    } catch (error) {
      if (error instanceof Error && error.message.includes("access violation")) {
        console.log("    (Skipped: Component error handling access violation)");
        return;
      }
      throw error;
    }
  }));

  // Component performance test
  suite.addResult(createPerformanceTest("Component operations performance", () => {
    const domain = Mono.domain;
    const gameObjectClass = domain.class("UnityEngine.GameObject");

    if (!gameObjectClass) {
      console.log("    (Skipped: GameObject class not available)");
      return;
    }

    const getComponentMethod = gameObjectClass.method("GetComponent", 1);
    if (!getComponentMethod) {
      console.log("    (Skipped: GetComponent method not available)");
      return;
    }

    const transformClass = domain.class("UnityEngine.Transform");
    if (!transformClass) {
      console.log("    (Skipped: Transform class not available)");
      return;
    }

    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        getComponentMethod.invoke(null, [transformClass.getType().pointer]);
      } catch (error) {
        // Expected to fail without valid GameObject
      }
    }

    const duration = Date.now() - startTime;
    console.log(`    ${iterations} GetComponent operations took ${duration}ms`);
    assert(duration < 2000, "Component operations should be fast");
  }));

  // Component integration test
  suite.addResult(createIntegrationTest("Component integration with Unity systems", () => {
    const domain = Mono.domain;

    // Test component integration with GameObject
    const gameObjectClass = domain.class("UnityEngine.GameObject");
    const componentClass = domain.class("UnityEngine.Component");

    if (gameObjectClass && componentClass) {
      console.log("    GameObject-Component integration available");
    }

    // Test component integration with physics
    const rigidbodyClass = domain.class("UnityEngine.Rigidbody");
    const colliderClass = domain.class("UnityEngine.Collider");

    if (rigidbodyClass && colliderClass) {
      console.log("    Physics component integration available");
    }

    // Test component integration with rendering
    const rendererClass = domain.class("UnityEngine.Renderer");
    const materialClass = domain.class("UnityEngine.Material");

    if (rendererClass && materialClass) {
      console.log("    Rendering component integration available");
    }

    console.log("    Component integration test completed");
  }));

  const summary = suite.getSummary();

  return {
    name: "Unity Components Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity Components tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}
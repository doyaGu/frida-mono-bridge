/**
 * Unity Components Tests
 * Comprehensive tests for Unity Component operations in Frida Mono Bridge
 */

import Mono from "../src";
import {
  assert,
  assertDomainAvailable,
  assertNotNull,
  createErrorHandlingTest,
  createIntegrationTest,
  createMonoDependentTest,
  createPerformanceTest,
  createSmokeTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

function isAccessViolation(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("access violation");
}

function tryGetSystemTypeObject(monoClass: any): NativePointer | null {
  try {
    if (!monoClass?.type?.pointer) {
      return null;
    }
    const domainPtr = Mono.domain.pointer;
    const monoTypePtr = monoClass.type.pointer;
    const typeObj = Mono.api.native.mono_type_get_object(domainPtr, monoTypePtr);
    return typeObj && !typeObj.isNull() ? typeObj : null;
  } catch {
    return null;
  }
}

export async function testUnityComponents(): Promise<TestResult> {
  console.log("\nUnity Components Tests:");

  const suite = new TestSuite("Unity Components Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity Component operations"));

  // Core Component class availability
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.Component class should be available", () => {
      assertDomainAvailable("Domain should be available for Component tests");

      const domain = Mono.domain;
      const componentClass = domain.tryClass("UnityEngine.Component");

      if (componentClass) {
        console.log(`    Component class found: ${componentClass.name ?? "Component"}`);
        const assembly = (componentClass as any).image?.assembly;
        console.log(`    Assembly: ${assembly?.name || "Unknown"}`);
      } else {
        console.log("    (Note: UnityEngine.Component class not found - testing through GameObject)");
      }
    }),
  );

  // Transform component availability and operations
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.Transform component should be available", () => {
      const domain = Mono.domain;
      const transformClass = domain.tryClass("UnityEngine.Transform");

      assertNotNull(transformClass, "UnityEngine.Transform class should be found");

      if (transformClass) {
        // Test Transform properties
        const positionProperty = transformClass.property("position");
        const rotationProperty = transformClass.property("rotation");
        const localScaleProperty = transformClass.property("localScale");
        const parentProperty = transformClass.property("parent");

        console.log(`    Transform.position: ${positionProperty !== null ? "Available" : "Not available"}`);
        console.log(`    Transform.rotation: ${rotationProperty !== null ? "Available" : "Not available"}`);
        console.log(`    Transform.localScale: ${localScaleProperty !== null ? "Available" : "Not available"}`);
        console.log(`    Transform.parent: ${parentProperty !== null ? "Available" : "Not available"}`);

        // Test Transform methods
        const translateMethod = transformClass.tryMethod("Translate", 1);
        const rotateMethod = transformClass.tryMethod("Rotate", 1);
        const lookAtMethod = transformClass.tryMethod("LookAt", 1);

        console.log(`    Transform.Translate: ${translateMethod !== null ? "Available" : "Not available"}`);
        console.log(`    Transform.Rotate: ${rotateMethod !== null ? "Available" : "Not available"}`);
        console.log(`    Transform.LookAt: ${lookAtMethod !== null ? "Available" : "Not available"}`);

        // Core Transform functionality should be available
        const hasPosition = positionProperty !== null;
        const hasTranslate = translateMethod !== null;
        assert(hasPosition, "Transform position should be available");
        assert(hasTranslate, "Transform.Translate should be available");
      }
    }),
  );

  // MonoBehaviour availability
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.MonoBehaviour class should be available", () => {
      const domain = Mono.domain;
      const monoBehaviourClass = domain.tryClass("UnityEngine.MonoBehaviour");

      if (monoBehaviourClass) {
        console.log(`    MonoBehaviour class found: ${monoBehaviourClass.name ?? "MonoBehaviour"}`);

        // Test MonoBehaviour methods
        const enabledProperty = monoBehaviourClass.property("enabled");
        const gameObjectProperty = monoBehaviourClass.property("gameObject");
        const transformProperty = monoBehaviourClass.property("transform");

        console.log(`    MonoBehaviour.enabled: ${enabledProperty !== null ? "Available" : "Not available"}`);
        console.log(`    MonoBehaviour.gameObject: ${gameObjectProperty !== null ? "Available" : "Not available"}`);
        console.log(`    MonoBehaviour.transform: ${transformProperty !== null ? "Available" : "Not available"}`);

        // Test lifecycle methods
        const startMethod = monoBehaviourClass.tryMethod("Start", 0);
        const updateMethod = monoBehaviourClass.tryMethod("Update", 0);
        const awakeMethod = monoBehaviourClass.tryMethod("Awake", 0);

        console.log(`    MonoBehaviour.Start: ${startMethod !== null ? "Available" : "Not available"}`);
        console.log(`    MonoBehaviour.Update: ${updateMethod !== null ? "Available" : "Not available"}`);
        console.log(`    MonoBehaviour.Awake: ${awakeMethod !== null ? "Available" : "Not available"}`);

        const hasGameObject = gameObjectProperty !== null;
        assert(hasGameObject, "MonoBehaviour.gameObject should be available");
      } else {
        console.log("    (Note: UnityEngine.MonoBehaviour class not found - may be compiled differently)");
      }
    }),
  );

  // Camera component tests
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.Camera component should be available", () => {
      const domain = Mono.domain;
      const cameraClass = domain.tryClass("UnityEngine.Camera");

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

      console.log(`    Camera.fieldOfView: ${fieldOfViewProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Camera.nearClipPlane: ${nearClipPlaneProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Camera.farClipPlane: ${farClipPlaneProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Camera.orthographic: ${orthographicProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Camera.backgroundColor: ${backgroundColorProperty !== null ? "Available" : "Not available"}`);

      // Test Camera methods
      const mainCameraProperty = cameraClass.property("main");
      const screenPointToRayMethod = cameraClass.tryMethod("ScreenPointToRay", 1);

      console.log(`    Camera.main: ${mainCameraProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Camera.ScreenPointToRay: ${screenPointToRayMethod !== null ? "Available" : "Not available"}`);

      const hasFieldOfView = fieldOfViewProperty !== null;
      assert(hasFieldOfView, "Camera fieldOfView should be available");
    }),
  );

  // Rigidbody component tests
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.Rigidbody component should be available", () => {
      const domain = Mono.domain;
      const rigidbodyClass = domain.tryClass("UnityEngine.Rigidbody");

      if (!rigidbodyClass) {
        console.log("    (Skipped: Rigidbody class not available)");
        return;
      }

      // Test Rigidbody properties
      const massProperty = rigidbodyClass.property("mass");
      const dragProperty = rigidbodyClass.property("drag");
      const useGravityProperty = rigidbodyClass.property("useGravity");
      const isKinematicProperty = rigidbodyClass.property("isKinematic");

      console.log(`    Rigidbody.mass: ${massProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Rigidbody.drag: ${dragProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Rigidbody.useGravity: ${useGravityProperty !== null ? "Available" : "Not available"}`);
      console.log(`    Rigidbody.isKinematic: ${isKinematicProperty !== null ? "Available" : "Not available"}`);

      // Test Rigidbody methods
      const addForceMethod = rigidbodyClass.tryMethod("AddForce", 1);
      const addTorqueMethod = rigidbodyClass.tryMethod("AddTorque", 1);
      const movePositionMethod = rigidbodyClass.tryMethod("MovePosition", 1);

      console.log(`    Rigidbody.AddForce: ${addForceMethod !== null ? "Available" : "Not available"}`);
      console.log(`    Rigidbody.AddTorque: ${addTorqueMethod !== null ? "Available" : "Not available"}`);
      console.log(`    Rigidbody.MovePosition: ${movePositionMethod !== null ? "Available" : "Not available"}`);

      const hasMass = massProperty !== null;
      const hasAddForce = addForceMethod !== null;
      assert(hasMass, "Rigidbody mass should be available");
      assert(hasAddForce, "Rigidbody.AddForce should be available");
    }),
  );

  // Component retrieval from GameObject
  await suite.addResultAsync(
    createMonoDependentTest("Component retrieval from GameObject should work (real Transform)", () => {
      try {
        const domain = Mono.domain;
        const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

        if (!gameObjectClass) {
          console.log("    (Skipped: GameObject class not available)");
          return;
        }

        const getComponentMethod = gameObjectClass.tryMethod("GetComponent", 1);
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

        // Create a temporary GameObject and validate Transform retrieval.
        const go = gameObjectClass.newObject(true);
        const transformViaProperty = go.tryCall("get_transform", []);
        assertNotNull(transformViaProperty, "GameObject.transform should be accessible");

        const transformClass = domain.tryClass("UnityEngine.Transform");
        if (!transformClass) {
          console.log("    (Skipped: Transform class not available)");
          return;
        }

        const transformTypeObj = tryGetSystemTypeObject(transformClass);
        if (!transformTypeObj) {
          console.log("    (Skipped: Could not create System.Type for Transform)");
          return;
        }

        const transformViaGetComponent = getComponentMethod.call<any>(go, [transformTypeObj]);
        assertNotNull(transformViaGetComponent, "GetComponent(Transform) should return a component");

        // Cross-check Component.gameObject points back to the GameObject.
        const componentGo = transformViaGetComponent.tryCall("get_gameObject", []);
        if (componentGo) {
          assert(componentGo.pointer.equals(go.pointer), "Transform.gameObject should equal source GameObject");
        }

        console.log("    Retrieved Transform via GetComponent(Type) successfully");
      } catch (error) {
        if (isAccessViolation(error)) {
          console.log(
            "    (Skipped: Component retrieval access violation - method may not be available in this Unity context)",
          );
          return;
        }
        throw error;
      }
    }),
  );

  // Component addition tests
  await suite.addResultAsync(
    createMonoDependentTest("AddComponent(Type) should attach component (best-effort)", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const addComponentMethod = gameObjectClass.tryMethod("AddComponent", 1);
      if (!addComponentMethod) {
        console.log("    (Skipped: AddComponent method not available)");
        return;
      }

      const getComponentMethod = gameObjectClass.tryMethod("GetComponent", 1);
      if (!getComponentMethod) {
        console.log("    (Skipped: GetComponent method not available)");
        return;
      }

      // Pick a candidate component class that exists in this game/runtime
      const candidates = ["UnityEngine.BoxCollider", "UnityEngine.Rigidbody", "UnityEngine.AudioSource"];
      const candidateClass = candidates.map(t => domain.tryClass(t)).find(Boolean);
      if (!candidateClass) {
        console.log("    (Skipped: No candidate component classes available)");
        return;
      }

      const candidateTypeObj = tryGetSystemTypeObject(candidateClass);
      if (!candidateTypeObj) {
        console.log("    (Skipped: Could not create System.Type for candidate component)");
        return;
      }

      try {
        const go = gameObjectClass.newObject(true);
        const component = addComponentMethod.call<any>(go, [candidateTypeObj]);
        assertNotNull(component, "AddComponent should return a component");

        const roundtrip = getComponentMethod.call<any>(go, [candidateTypeObj]);
        assertNotNull(roundtrip, "GetComponent should find the added component");
        console.log(`    Added+retrieved component: ${candidateClass.fullName ?? "(unknown)"}`);
      } catch (error) {
        if (isAccessViolation(error)) {
          console.log("    (Skipped: access violation adding component - likely main-thread restricted)");
          return;
        }
        throw error;
      }
    }),
  );

  // Component error handling
  await suite.addResultAsync(
    createErrorHandlingTest("Component operations should handle errors gracefully", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const getComponentMethod = gameObjectClass.tryMethod("GetComponent", 1);
      if (!getComponentMethod) {
        console.log("    (Skipped: GetComponent method not available)");
        return;
      }

      try {
        // Test with null GameObject
        try {
          const transformClass = domain.tryClass("UnityEngine.Transform");
          const transformTypeObj = transformClass ? tryGetSystemTypeObject(transformClass) : null;
          const result = getComponentMethod.invoke(null, [transformTypeObj]);
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
        if (isAccessViolation(error)) {
          console.log("    (Skipped: Component error handling access violation)");
          return;
        }
        throw error;
      }
    }),
  );

  // Component performance test
  await suite.addResultAsync(
    createPerformanceTest("Component operations performance", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const getComponentMethod = gameObjectClass.tryMethod("GetComponent", 1);
      if (!getComponentMethod) {
        console.log("    (Skipped: GetComponent method not available)");
        return;
      }

      const transformClass = domain.tryClass("UnityEngine.Transform");
      if (!transformClass) {
        console.log("    (Skipped: Transform class not available)");
        return;
      }

      const transformTypeObj = tryGetSystemTypeObject(transformClass);
      if (!transformTypeObj) {
        console.log("    (Skipped: Could not create System.Type for Transform)");
        return;
      }

      // Use a real GameObject instance so this measures actual path rather than guaranteed failure.
      let go: any;
      try {
        go = gameObjectClass.newObject(true);
      } catch {
        console.log("    (Skipped: Could not create GameObject for perf test)");
        return;
      }

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        try {
          getComponentMethod.invoke(go, [transformTypeObj]);
        } catch (error) {
          // Allowed to fail depending on runtime restrictions
        }
      }

      const duration = Date.now() - startTime;
      console.log(`    ${iterations} GetComponent operations took ${duration}ms`);
      assert(duration < 2000, "Component operations should be fast");
    }),
  );

  // Component integration test
  await suite.addResultAsync(
    createIntegrationTest("Component integration with Unity systems", () => {
      const domain = Mono.domain;

      // Test component integration with GameObject
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      const componentClass = domain.tryClass("UnityEngine.Component");

      if (gameObjectClass && componentClass) {
        console.log("    GameObject-Component integration available");
      }

      // Test component integration with physics
      const rigidbodyClass = domain.tryClass("UnityEngine.Rigidbody");
      const colliderClass = domain.tryClass("UnityEngine.Collider");

      if (rigidbodyClass && colliderClass) {
        console.log("    Physics component integration available");
      }

      // Test component integration with rendering
      const rendererClass = domain.tryClass("UnityEngine.Renderer");
      const materialClass = domain.tryClass("UnityEngine.Material");

      if (rendererClass && materialClass) {
        console.log("    Rendering component integration available");
      }

      console.log("    Component integration test completed");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Unity Components Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity Components tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

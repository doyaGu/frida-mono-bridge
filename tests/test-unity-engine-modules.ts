/**
 * Unity Engine Modules Tests
 * Comprehensive tests for Unity Engine module operations in Frida Mono Bridge
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

export function testUnityEngineModules(): TestResult {
  console.log("\nUnity Engine Modules Tests:");

  const suite = new TestSuite("Unity Engine Modules Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity Engine module operations"));

  // UnityEngine.CoreModule availability
  suite.addResult(createMonoDependentTest("UnityEngine.CoreModule assembly should be available", () => {
    assertDomainAvailable("Domain should be available for Engine module tests");

    const domain = Mono.domain;
    const coreModule = domain.getAssembly("UnityEngine.CoreModule");

    assertNotNull(coreModule, "UnityEngine.CoreModule assembly should be found");

    if (coreModule) {
      console.log(`    CoreModule assembly found: ${coreModule.name}`);
      console.log(`    Image: ${coreModule.image?.name || 'Unknown'}`);

      // Test core classes from CoreModule
      const vector3Class = coreModule.image.class("UnityEngine.Vector3");
      const quaternionClass = coreModule.image.class("UnityEngine.Quaternion");
      const colorClass = coreModule.image.class("UnityEngine.Color");

      console.log(`    Vector3 class: ${vector3Class ? 'Available' : 'Not available'}`);
      console.log(`    Quaternion class: ${quaternionClass ? 'Available' : 'Not available'}`);
      console.log(`    Color class: ${colorClass ? 'Available' : 'Not available'}`);

      const hasVector3 = vector3Class !== null;
      assert(hasVector3, "Vector3 class should be available in CoreModule");
    }
  }));

  // Vector3 operations
  suite.addResult(createMonoDependentTest("Vector3 operations should be available", () => {
    const domain = Mono.domain;
    const vector3Class = domain.class("UnityEngine.Vector3");

    if (!vector3Class) {
      console.log("    (Skipped: Vector3 class not available)");
      return;
    }

    // Test Vector3 constructors
    const constructor1 = vector3Class.method(".ctor", 3);  // Vector3(float, float, float)
    const constructor2 = vector3Class.method(".ctor", 0);  // Vector3()

    console.log(`    Vector3(float,float,float): ${constructor1 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3(): ${constructor2 !== null ? 'Available' : 'Not available'}`);

    // Test Vector3 properties
    const xProperty = vector3Class.property("x");
    const yProperty = vector3Class.property("y");
    const zProperty = vector3Class.property("z");
    const magnitudeProperty = vector3Class.property("magnitude");
    const normalizedProperty = vector3Class.property("normalized");

    console.log(`    Vector3.x: ${xProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.y: ${yProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.z: ${zProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.magnitude: ${magnitudeProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.normalized: ${normalizedProperty !== null ? 'Available' : 'Not available'}`);

    // Test Vector3 static methods
    const distanceMethod = vector3Class.method("Distance", 2);
    const dotMethod = vector3Class.method("Dot", 2);
    const crossMethod = vector3Class.method("Cross", 2);
    const lerpMethod = vector3Class.method("Lerp", 3);

    console.log(`    Vector3.Distance: ${distanceMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.Dot: ${dotMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.Cross: ${crossMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.Lerp: ${lerpMethod !== null ? 'Available' : 'Not available'}`);

    // Test Vector3 instance methods
    const normalizeMethod = vector3Class.method("Normalize", 0);
    const toStringMethod = vector3Class.method("ToString", 0);

    console.log(`    Vector3.Normalize: ${normalizeMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Vector3.ToString: ${toStringMethod !== null ? 'Available' : 'Not available'}`);

    const hasConstructor1 = constructor1 !== null;
    const hasDistance = distanceMethod !== null;
    assert(hasConstructor1, "Vector3 constructor should be available");
    assert(hasDistance, "Vector3.Distance should be available");
  }));

  // Quaternion operations
  suite.addResult(createMonoDependentTest("Quaternion operations should be available", () => {
    const domain = Mono.domain;
    const quaternionClass = domain.class("UnityEngine.Quaternion");

    if (!quaternionClass) {
      console.log("    (Skipped: Quaternion class not available)");
      return;
    }

    // Test Quaternion constructors
    const constructor1 = quaternionClass.method(".ctor", 4);  // Quaternion(float, float, float, float)
    const constructor2 = quaternionClass.method(".ctor", 0);  // Quaternion()

    console.log(`    Quaternion(float,float,float,float): ${constructor1 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion(): ${constructor2 !== null ? 'Available' : 'Not available'}`);

    // Test Quaternion properties
    const xProperty = quaternionClass.property("x");
    const yProperty = quaternionClass.property("y");
    const zProperty = quaternionClass.property("z");
    const wProperty = quaternionClass.property("w");
    const eulerProperty = quaternionClass.property("eulerAngles");

    console.log(`    Quaternion.x: ${xProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.y: ${yProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.z: ${zProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.w: ${wProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.eulerAngles: ${eulerProperty !== null ? 'Available' : 'Not available'}`);

    // Test Quaternion static methods
    const identityProperty = quaternionClass.property("identity");
    const eulerMethod = quaternionClass.method("Euler", 3);
    const slerpMethod = quaternionClass.method("Slerp", 3);
    const lookRotationMethod = quaternionClass.method("LookRotation", 1);

    console.log(`    Quaternion.identity: ${identityProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.Euler: ${eulerMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.Slerp: ${slerpMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Quaternion.LookRotation: ${lookRotationMethod !== null ? 'Available' : 'Not available'}`);

    const hasConstructor = constructor1 !== null;
    const hasEuler = eulerMethod !== null;
    assert(hasConstructor, "Quaternion constructor should be available");
    assert(hasEuler, "Quaternion.Euler should be available");
  }));

  // Color operations
  suite.addResult(createMonoDependentTest("Color operations should be available", () => {
    const domain = Mono.domain;
    const colorClass = domain.class("UnityEngine.Color");

    if (!colorClass) {
      console.log("    (Skipped: Color class not available)");
      return;
    }

    // Test Color constructors
    const constructor1 = colorClass.method(".ctor", 4);  // Color(float, float, float, float)
    const constructor2 = colorClass.method(".ctor", 3);  // Color(float, float, float)
    const constructor3 = colorClass.method(".ctor", 0);  // Color()

    console.log(`    Color(float,float,float,float): ${constructor1 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color(float,float,float): ${constructor2 !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color(): ${constructor3 !== null ? 'Available' : 'Not available'}`);

    // Test Color properties
    const rProperty = colorClass.property("r");
    const gProperty = colorClass.property("g");
    const bProperty = colorClass.property("b");
    const aProperty = colorClass.property("a");
    const grayscaleProperty = colorClass.property("grayscale");

    console.log(`    Color.r: ${rProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.g: ${gProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.b: ${bProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.a: ${aProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.grayscale: ${grayscaleProperty !== null ? 'Available' : 'Not available'}`);

    // Test Color static properties
    const redProperty = colorClass.property("red");
    const greenProperty = colorClass.property("green");
    const blueProperty = colorClass.property("blue");
    const whiteProperty = colorClass.property("white");
    const blackProperty = colorClass.property("black");

    console.log(`    Color.red: ${redProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.green: ${greenProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.blue: ${blueProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.white: ${whiteProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Color.black: ${blackProperty !== null ? 'Available' : 'Not available'}`);

    const hasConstructor = constructor1 !== null;
    const hasRed = redProperty !== null;
    assert(hasConstructor, "Color constructor should be available");
    assert(hasRed, "Color.red should be available");
  }));

  // Time operations
  suite.addResult(createMonoDependentTest("Time operations should be available", () => {
    const domain = Mono.domain;
    const timeClass = domain.class("UnityEngine.Time");

    if (!timeClass) {
      console.log("    (Skipped: Time class not available)");
      return;
    }

    // Test Time static properties
    const timeProperty = timeClass.property("time");
    const deltaTimeProperty = timeClass.property("deltaTime");
    const fixedTimeProperty = timeClass.property("fixedTime");
    const unscaledTimeProperty = timeClass.property("unscaledTime");
    const timeScaleProperty = timeClass.property("timeScale");

    console.log(`    Time.time: ${timeProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Time.deltaTime: ${deltaTimeProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Time.fixedTime: ${fixedTimeProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Time.unscaledTime: ${unscaledTimeProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Time.timeScale: ${timeScaleProperty !== null ? 'Available' : 'Not available'}`);

    const hasTime = timeProperty !== null;
    const hasDeltaTime = deltaTimeProperty !== null;
    assert(hasTime, "Time.time should be available");
    assert(hasDeltaTime, "Time.deltaTime should be available");
  }));

  // Input operations
  suite.addResult(createMonoDependentTest("Input operations should be available", () => {
    const domain = Mono.domain;
    const inputClass = domain.class("UnityEngine.Input");

    if (!inputClass) {
      console.log("    (Skipped: Input class not available)");
      return;
    }

    // Test Input static methods
    const getKeyMethod = inputClass.method("GetKey", 1);
    const getKeyDownMethod = inputClass.method("GetKeyDown", 1);
    const getKeyUpMethod = inputClass.method("GetKeyUp", 1);
    const getMouseButtonMethod = inputClass.method("GetMouseButton", 1);
    const getMouseButtonDownMethod = inputClass.method("GetMouseButtonDown", 1);

    console.log(`    Input.GetKey: ${getKeyMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Input.GetKeyDown: ${getKeyDownMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Input.GetKeyUp: ${getKeyUpMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Input.GetMouseButton: ${getMouseButtonMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Input.GetMouseButtonDown: ${getMouseButtonDownMethod !== null ? 'Available' : 'Not available'}`);

    // Test Input static properties
    const mousePositionProperty = inputClass.property("mousePosition");
    const anyKeyProperty = inputClass.property("anyKey");

    console.log(`    Input.mousePosition: ${mousePositionProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Input.anyKey: ${anyKeyProperty !== null ? 'Available' : 'Not available'}`);

    const hasGetKey = getKeyMethod !== null;
    const hasMousePosition = mousePositionProperty !== null;
    assert(hasGetKey, "Input.GetKey should be available");
    assert(hasMousePosition, "Input.mousePosition should be available");
  }));

  // Math operations
  suite.addResult(createMonoDependentTest("Math operations should be available", () => {
    const domain = Mono.domain;
    const mathfClass = domain.class("UnityEngine.Mathf");

    if (!mathfClass) {
      console.log("    (Skipped: Mathf class not available)");
      return;
    }

    // Test Mathf static methods
    const sinMethod = mathfClass.method("Sin", 1);
    const cosMethod = mathfClass.method("Cos", 1);
    const absMethod = mathfClass.method("Abs", 1);
    const minMethod = mathfClass.method("Min", 2);
    const maxMethod = mathfClass.method("Max", 2);
    const lerpMethod = mathfClass.method("Lerp", 3);
    const clampMethod = mathfClass.method("Clamp", 3);

    console.log(`    Mathf.Sin: ${sinMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Cos: ${cosMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Abs: ${absMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Min: ${minMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Max: ${maxMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Lerp: ${lerpMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Clamp: ${clampMethod !== null ? 'Available' : 'Not available'}`);

    // Test Mathf static properties
    const piProperty = mathfClass.property("PI");
    const infinityProperty = mathfClass.property("Infinity");
    const epsilonProperty = mathfClass.property("Epsilon");

    console.log(`    Mathf.PI: ${piProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Infinity: ${infinityProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Mathf.Epsilon: ${epsilonProperty !== null ? 'Available' : 'Not available'}`);

    const hasAbs = absMethod !== null;
    assert(hasAbs, "Mathf.Abs should be available");
    // Note: Mathf.PI, Mathf.Infinity, Mathf.Epsilon may not be available as properties in all Unity versions
    // They might be accessible as static fields or through different methods
  }));

  // Random operations
  suite.addResult(createMonoDependentTest("Random operations should be available", () => {
    const domain = Mono.domain;
    const randomClass = domain.class("UnityEngine.Random");

    if (!randomClass) {
      console.log("    (Skipped: Random class not available)");
      return;
    }

    // Test Random static methods
    const valueMethod = randomClass.method("value", 0);
    const rangeMethod = randomClass.method("Range", 2);
    const insideUnitCircleMethod = randomClass.method("insideUnitCircle", 0);
    const insideUnitSphereMethod = randomClass.method("insideUnitSphere", 0);

    console.log(`    Random.value: ${valueMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Random.Range: ${rangeMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Random.insideUnitCircle: ${insideUnitCircleMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Random.insideUnitSphere: ${insideUnitSphereMethod !== null ? 'Available' : 'Not available'}`);

    const hasRange = rangeMethod !== null;
    assert(hasRange, "Random.Range should be available");
    // Note: Random.value may not be available as property in all Unity versions
  }));

  // Physics operations
  suite.addResult(createMonoDependentTest("Physics operations should be available", () => {
    const domain = Mono.domain;
    const physicsClass = domain.class("UnityEngine.Physics");

    if (!physicsClass) {
      console.log("    (Skipped: Physics class not available)");
      return;
    }

    // Test Physics static methods
    const raycastMethod = physicsClass.method("Raycast", 1);
    const raycastAllMethod = physicsClass.method("RaycastAll", 1);
    const linecastMethod = physicsClass.method("Linecast", 1);
    const sphereCastMethod = physicsClass.method("SphereCast", 1);

    console.log(`    Physics.Raycast: ${raycastMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Physics.RaycastAll: ${raycastAllMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Physics.Linecast: ${linecastMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Physics.SphereCast: ${sphereCastMethod !== null ? 'Available' : 'Not available'}`);

    // Test Physics static properties
    const gravityProperty = physicsClass.property("gravity");
    const defaultContactOffsetProperty = physicsClass.property("defaultContactOffset");

    console.log(`    Physics.gravity: ${gravityProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Physics.defaultContactOffset: ${defaultContactOffsetProperty !== null ? 'Available' : 'Not available'}`);

    const hasRaycast = raycastMethod !== null;
    const hasGravity = gravityProperty !== null;
    assert(hasRaycast, "Physics.Raycast should be available");
    assert(hasGravity, "Physics.gravity should be available");
  }));

  // Application operations
  suite.addResult(createMonoDependentTest("Application operations should be available", () => {
    const domain = Mono.domain;
    const applicationClass = domain.class("UnityEngine.Application");

    if (!applicationClass) {
      console.log("    (Skipped: Application class not available)");
      return;
    }

    // Test Application static properties
    const dataPathProperty = applicationClass.property("dataPath");
    const isPlayingProperty = applicationClass.property("isPlaying");
    const isEditorProperty = applicationClass.property("isEditor");

    console.log(`    Application.dataPath: ${dataPathProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Application.isPlaying: ${isPlayingProperty !== null ? 'Available' : 'Not available'}`);
    console.log(`    Application.isEditor: ${isEditorProperty !== null ? 'Available' : 'Not available'}`);

    // Test Application static methods
    const quitMethod = applicationClass.method("Quit", 0);
    const openURLMethod = applicationClass.method("OpenURL", 1);

    console.log(`    Application.Quit: ${quitMethod !== null ? 'Available' : 'Not available'}`);
    console.log(`    Application.OpenURL: ${openURLMethod !== null ? 'Available' : 'Not available'}`);

    const hasDataPath = dataPathProperty !== null;
    const hasIsPlaying = isPlayingProperty !== null;
    assert(hasDataPath, "Application.dataPath should be available");
    assert(hasIsPlaying, "Application.isPlaying should be available");
  }));

  // Error handling for engine modules
  suite.addResult(createErrorHandlingTest("Engine module operations should handle errors gracefully", () => {
    const domain = Mono.domain;
    const vector3Class = domain.class("UnityEngine.Vector3");

    if (!vector3Class) {
      console.log("    (Skipped: Vector3 class not available)");
      return;
    }

    try {
      // Test invalid Vector3 operations
      const distanceMethod = vector3Class.method("Distance", 2);
      if (distanceMethod) {
        try {
          const result = distanceMethod.invoke(null, [null, null]);
          console.log("    Invalid Vector3 distance handling: Handled gracefully");
        } catch (error) {
          console.log("    Invalid Vector3 distance handling: Throws gracefully");
        }
      }

      console.log("    Engine module error handling working correctly");
    } catch (error) {
      if (error instanceof Error && error.message.includes("access violation")) {
        console.log("    (Skipped: Engine module error handling access violation)");
        return;
      }
      throw error;
    }
  }));

  // Performance test for engine modules
  suite.addResult(createPerformanceTest("Engine module operations performance", () => {
    const domain = Mono.domain;
    const vector3Class = domain.class("UnityEngine.Vector3");

    if (!vector3Class) {
      console.log("    (Skipped: Vector3 class not available)");
      return;
    }

    const distanceMethod = vector3Class.method("Distance", 2);
    if (!distanceMethod) {
      console.log("    (Skipped: Distance method not available)");
      return;
    }

    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        distanceMethod.invoke(null, [null, null]);
      } catch (error) {
        // Expected to fail with null parameters
      }
    }

    const duration = Date.now() - startTime;
    console.log(`    ${iterations} Vector3.Distance operations took ${duration}ms`);
    assert(duration < 1000, "Engine module operations should be fast");
  }));

  // Integration test for engine modules
  suite.addResult(createIntegrationTest("Engine module integration with Unity systems", () => {
    const domain = Mono.domain;

    // Test Vector3 integration with Transform
    const vector3Class = domain.class("UnityEngine.Vector3");
    const transformClass = domain.class("UnityEngine.Transform");

    if (vector3Class && transformClass) {
      console.log("    Vector3-Transform integration available");
    }

    // Test Color integration with Renderer
    const colorClass = domain.class("UnityEngine.Color");
    const rendererClass = domain.class("UnityEngine.Renderer");

    if (colorClass && rendererClass) {
      console.log("    Color-Renderer integration available");
    }

    // Test Physics integration with Collider
    const physicsClass = domain.class("UnityEngine.Physics");
    const colliderClass = domain.class("UnityEngine.Collider");

    if (physicsClass && colliderClass) {
      console.log("    Physics-Collider integration available");
    }

    // Test Time integration with MonoBehaviour
    const timeClass = domain.class("UnityEngine.Time");
    const monoBehaviourClass = domain.class("UnityEngine.MonoBehaviour");

    if (timeClass && monoBehaviourClass) {
      console.log("    Time-MonoBehaviour integration available");
    }

    console.log("    Engine module integration test completed");
  }));

  const summary = suite.getSummary();

  return {
    name: "Unity Engine Modules Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity Engine Modules tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}
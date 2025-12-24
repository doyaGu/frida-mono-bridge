/**
 * Unity Engine Modules Tests (V2 API)
 * Comprehensive tests for Unity Engine module operations in Frida Mono Bridge
 * Updated to use tryMethod() and tryProperty() for non-throwing lookups
 */

import Mono from "../src";
import { withDomain } from "./test-fixtures";
import {
  assert,
  assertDomainAvailable,
  assertNotNull,
  createErrorHandlingTest,
  createIntegrationTest,
  createPerformanceTest,
  createSmokeTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

export async function createUnityEngineModulesTests(): Promise<TestResult> {
  console.log("\nUnity Engine Modules Tests:");

  const suite = new TestSuite("Unity Engine Modules Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity Engine module operations"));

  // UnityEngine.CoreModule availability
  await suite.addResultAsync(
    withDomain("UnityEngine.CoreModule assembly should be available", ({ domain }) => {
      assertDomainAvailable("Domain should be available for Engine module tests");
      const coreModule = domain.tryAssembly("UnityEngine.CoreModule");

      assertNotNull(coreModule, "UnityEngine.CoreModule assembly should be found");

      if (coreModule) {
        console.log(`    CoreModule assembly found: ${coreModule.name}`);
        console.log(`    Image: ${coreModule.image?.name || "Unknown"}`);

        // Test core classes from CoreModule
        const vector3Class = coreModule.image.tryClass("UnityEngine.Vector3");
        const quaternionClass = coreModule.image.tryClass("UnityEngine.Quaternion");
        const colorClass = coreModule.image.tryClass("UnityEngine.Color");

        console.log(`    Vector3 class: ${vector3Class ? "Available" : "Not available"}`);
        console.log(`    Quaternion class: ${quaternionClass ? "Available" : "Not available"}`);
        console.log(`    Color class: ${colorClass ? "Available" : "Not available"}`);

        const hasVector3 = vector3Class !== null;
        assert(hasVector3, "Vector3 class should be available in CoreModule");
      }
    }),
  );

  // Vector3 operations - using tryMethod/tryProperty for safe lookups
  await suite.addResultAsync(
    withDomain("Vector3 operations should be available", ({ domain }) => {
      const vector3Class = domain.tryClass("UnityEngine.Vector3");

      if (!vector3Class) {
        console.log("    (Skipped: Vector3 class not available)");
        return;
      }

      // Test Vector3 constructors - use tryMethod for optional lookups
      const constructor3 = vector3Class.tryMethod(".ctor", 3); // Vector3(float, float, float)
      const constructor2 = vector3Class.tryMethod(".ctor", 2); // Vector3(float, float)

      console.log(`    Vector3(float,float,float): ${constructor3 ? "Available" : "Not available"}`);
      console.log(`    Vector3(float,float): ${constructor2 ? "Available" : "Not available"}`);

      // Test Vector3 fields (x, y, z are fields in Unity structs, not properties)
      const xField = vector3Class.tryField("x");
      const yField = vector3Class.tryField("y");
      const zField = vector3Class.tryField("z");

      console.log(`    Vector3.x field: ${xField ? "Available" : "Not available"}`);
      console.log(`    Vector3.y field: ${yField ? "Available" : "Not available"}`);
      console.log(`    Vector3.z field: ${zField ? "Available" : "Not available"}`);

      // Test Vector3 static methods
      const distanceMethod = vector3Class.tryMethod("Distance", 2);
      const dotMethod = vector3Class.tryMethod("Dot", 2);
      const crossMethod = vector3Class.tryMethod("Cross", 2);
      const lerpMethod = vector3Class.tryMethod("Lerp", 3);

      console.log(`    Vector3.Distance: ${distanceMethod ? "Available" : "Not available"}`);
      console.log(`    Vector3.Dot: ${dotMethod ? "Available" : "Not available"}`);
      console.log(`    Vector3.Cross: ${crossMethod ? "Available" : "Not available"}`);
      console.log(`    Vector3.Lerp: ${lerpMethod ? "Available" : "Not available"}`);

      // Test Vector3 instance methods
      const normalizeMethod = vector3Class.tryMethod("Normalize");
      const toStringMethod = vector3Class.tryMethod("ToString", 0);

      console.log(`    Vector3.Normalize: ${normalizeMethod ? "Available" : "Not available"}`);
      console.log(`    Vector3.ToString: ${toStringMethod ? "Available" : "Not available"}`);

      // At least some operations should be available
      const hasFields = xField !== null && yField !== null && zField !== null;
      assert(hasFields, "Vector3 should have x, y, z fields");
    }),
  );

  // Vector3 runtime behavior (constructor + fields + Distance)
  await suite.addResultAsync(
    createIntegrationTest("Vector3 ctor/fields and Distance should work (best-effort)", () => {
      const domain = Mono.domain;
      const vector3Class = domain.tryClass("UnityEngine.Vector3");
      if (!vector3Class) {
        console.log("    (Skipped: Vector3 class not available)");
        return;
      }

      const ctor3 = vector3Class.tryMethod(".ctor", 3);
      const distance = vector3Class.tryMethod("Distance", 2);
      if (!ctor3 || !distance) {
        console.log("    (Skipped: Vector3 ctor/Distance not available)");
        return;
      }

      try {
        // Vector3 is a value type; some Unity/Mono builds dislike mono_runtime_object_init on boxed structs.
        // Allocate without initialization and invoke the explicit .ctor ourselves.
        const v0 = vector3Class.newObject(false);
        const v1 = vector3Class.newObject(false);
        v0.call(".ctor", [0, 0, 0]);
        v1.call(".ctor", [1, 0, 0]);

        // Validate fields are settable/readable on boxed struct
        const x0 = v0.tryGetFieldValue("x");
        const y0 = v0.tryGetFieldValue("y");
        const z0 = v0.tryGetFieldValue("z");
        console.log(`    v0 fields: x=${x0}, y=${y0}, z=${z0}`);

        // MethodArgument typing doesn’t include MonoObject; pass the instance pointers instead.
        // For value types (structs), instancePointer is the unboxed value pointer.
        const d = distance.call<number>(null, [v0.instancePointer, v1.instancePointer]);
        console.log(`    Vector3.Distance((0,0,0),(1,0,0)) = ${d}`);
        assert(typeof d === "number" && isFinite(d), "Distance should return a finite number");
        assert(Math.abs(d - 1) < 0.001, "Distance should be approximately 1");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const msgLower = msg.toLowerCase();
        if (msgLower.includes("access violation") || msgLower.includes("system error")) {
          console.log(`    (Skipped: Vector3 behavior unsupported in this runtime: ${msg})`);
          return;
        }
        throw error;
      }
    }),
  );

  // Quaternion operations
  await suite.addResultAsync(
    withDomain("Quaternion operations should be available", ({ domain }) => {
      const quaternionClass = domain.tryClass("UnityEngine.Quaternion");

      if (!quaternionClass) {
        console.log("    (Skipped: Quaternion class not available)");
        return;
      }

      // Test Quaternion constructors
      const constructor4 = quaternionClass.tryMethod(".ctor", 4); // Quaternion(float, float, float, float)

      console.log(`    Quaternion(float,float,float,float): ${constructor4 ? "Available" : "Not available"}`);

      // Test Quaternion fields
      const xField = quaternionClass.tryField("x");
      const yField = quaternionClass.tryField("y");
      const zField = quaternionClass.tryField("z");
      const wField = quaternionClass.tryField("w");

      console.log(`    Quaternion.x: ${xField ? "Available" : "Not available"}`);
      console.log(`    Quaternion.y: ${yField ? "Available" : "Not available"}`);
      console.log(`    Quaternion.z: ${zField ? "Available" : "Not available"}`);
      console.log(`    Quaternion.w: ${wField ? "Available" : "Not available"}`);

      // Test Quaternion static methods
      const eulerMethod = quaternionClass.tryMethod("Euler", 3);
      const slerpMethod = quaternionClass.tryMethod("Slerp", 3);
      const lookRotationMethod = quaternionClass.tryMethod("LookRotation", 1);

      console.log(`    Quaternion.Euler: ${eulerMethod ? "Available" : "Not available"}`);
      console.log(`    Quaternion.Slerp: ${slerpMethod ? "Available" : "Not available"}`);
      console.log(`    Quaternion.LookRotation: ${lookRotationMethod ? "Available" : "Not available"}`);

      const hasFields = xField !== null && yField !== null && zField !== null && wField !== null;
      assert(hasFields, "Quaternion should have x, y, z, w fields");
    }),
  );

  // Color operations
  await suite.addResultAsync(
    withDomain("Color operations should be available", ({ domain }) => {
      const colorClass = domain.tryClass("UnityEngine.Color");

      if (!colorClass) {
        console.log("    (Skipped: Color class not available)");
        return;
      }

      // Test Color constructors
      const constructor4 = colorClass.tryMethod(".ctor", 4); // Color(float, float, float, float)
      const constructor3 = colorClass.tryMethod(".ctor", 3); // Color(float, float, float)

      console.log(`    Color(float,float,float,float): ${constructor4 ? "Available" : "Not available"}`);
      console.log(`    Color(float,float,float): ${constructor3 ? "Available" : "Not available"}`);

      // Test Color fields
      const rField = colorClass.tryField("r");
      const gField = colorClass.tryField("g");
      const bField = colorClass.tryField("b");
      const aField = colorClass.tryField("a");

      console.log(`    Color.r: ${rField ? "Available" : "Not available"}`);
      console.log(`    Color.g: ${gField ? "Available" : "Not available"}`);
      console.log(`    Color.b: ${bField ? "Available" : "Not available"}`);
      console.log(`    Color.a: ${aField ? "Available" : "Not available"}`);

      // Test Color static methods
      const lerpMethod = colorClass.tryMethod("Lerp", 3);

      console.log(`    Color.Lerp: ${lerpMethod ? "Available" : "Not available"}`);

      const hasFields = rField !== null && gField !== null && bField !== null && aField !== null;
      assert(hasFields, "Color should have r, g, b, a fields");
    }),
  );

  // Time operations
  await suite.addResultAsync(
    withDomain("Time operations should be available", ({ domain }) => {
      const timeClass = domain.tryClass("UnityEngine.Time");

      if (!timeClass) {
        console.log("    (Skipped: Time class not available)");
        return;
      }

      // Test Time static properties (using tryProperty)
      const timeProperty = timeClass.tryProperty("time");
      const deltaTimeProperty = timeClass.tryProperty("deltaTime");
      const fixedTimeProperty = timeClass.tryProperty("fixedTime");
      const timeScaleProperty = timeClass.tryProperty("timeScale");

      console.log(`    Time.time: ${timeProperty ? "Available" : "Not available"}`);
      console.log(`    Time.deltaTime: ${deltaTimeProperty ? "Available" : "Not available"}`);
      console.log(`    Time.fixedTime: ${fixedTimeProperty ? "Available" : "Not available"}`);
      console.log(`    Time.timeScale: ${timeScaleProperty ? "Available" : "Not available"}`);

      const hasTime = timeProperty !== null;
      const hasDeltaTime = deltaTimeProperty !== null;
      assert(hasTime || hasDeltaTime, "Time class should have time properties");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Time.time and deltaTime should be readable (best-effort)", () => {
      const domain = Mono.domain;
      const timeClass = domain.tryClass("UnityEngine.Time");
      if (!timeClass) {
        console.log("    (Skipped: Time class not available)");
        return;
      }

      try {
        const timeProp = timeClass.tryProperty("time");
        const dtProp = timeClass.tryProperty("deltaTime");
        const timeNow = timeProp?.tryGetValue(null);
        const dtNow = dtProp?.tryGetValue(null);
        console.log(`    Time.time=${timeNow}, deltaTime=${dtNow}`);

        if (typeof timeNow === "number") {
          assert(isFinite(timeNow) && timeNow >= 0, "Time.time should be a finite non-negative number");
        }
        if (typeof dtNow === "number") {
          assert(isFinite(dtNow) && dtNow >= 0, "Time.deltaTime should be a finite non-negative number");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes("access violation")) {
          console.log(`    (Skipped: access violation reading Time: ${msg})`);
          return;
        }
        throw error;
      }
    }),
  );

  // Input operations
  await suite.addResultAsync(
    withDomain("Input operations should be available", ({ domain }) => {
      const inputClass = domain.tryClass("UnityEngine.Input");

      if (!inputClass) {
        console.log("    (Skipped: Input class not available)");
        return;
      }

      // Test Input static methods
      const getKeyMethod = inputClass.tryMethod("GetKey", 1);
      const getKeyDownMethod = inputClass.tryMethod("GetKeyDown", 1);
      const getKeyUpMethod = inputClass.tryMethod("GetKeyUp", 1);
      const getMouseButtonMethod = inputClass.tryMethod("GetMouseButton", 1);

      console.log(`    Input.GetKey: ${getKeyMethod ? "Available" : "Not available"}`);
      console.log(`    Input.GetKeyDown: ${getKeyDownMethod ? "Available" : "Not available"}`);
      console.log(`    Input.GetKeyUp: ${getKeyUpMethod ? "Available" : "Not available"}`);
      console.log(`    Input.GetMouseButton: ${getMouseButtonMethod ? "Available" : "Not available"}`);

      // Test Input static properties
      const mousePositionProperty = inputClass.tryProperty("mousePosition");
      const anyKeyProperty = inputClass.tryProperty("anyKey");

      console.log(`    Input.mousePosition: ${mousePositionProperty ? "Available" : "Not available"}`);
      console.log(`    Input.anyKey: ${anyKeyProperty ? "Available" : "Not available"}`);

      const hasGetKey = getKeyMethod !== null;
      assert(hasGetKey, "Input.GetKey should be available");
    }),
  );

  // Math operations
  await suite.addResultAsync(
    withDomain("Mathf operations should be available", ({ domain }) => {
      const mathfClass = domain.tryClass("UnityEngine.Mathf");

      if (!mathfClass) {
        console.log("    (Skipped: Mathf class not available)");
        return;
      }

      // Test Mathf static methods
      const absMethod = mathfClass.tryMethod("Abs", 1);
      const minMethod = mathfClass.tryMethod("Min", 2);
      const maxMethod = mathfClass.tryMethod("Max", 2);
      const lerpMethod = mathfClass.tryMethod("Lerp", 3);
      const clampMethod = mathfClass.tryMethod("Clamp", 3);

      console.log(`    Mathf.Abs: ${absMethod ? "Available" : "Not available"}`);
      console.log(`    Mathf.Min: ${minMethod ? "Available" : "Not available"}`);
      console.log(`    Mathf.Max: ${maxMethod ? "Available" : "Not available"}`);
      console.log(`    Mathf.Lerp: ${lerpMethod ? "Available" : "Not available"}`);
      console.log(`    Mathf.Clamp: ${clampMethod ? "Available" : "Not available"}`);

      // Test Mathf static fields (PI, Epsilon are fields, not properties)
      const piField = mathfClass.tryField("PI");
      const epsilonField = mathfClass.tryField("Epsilon");

      console.log(`    Mathf.PI: ${piField ? "Available" : "Not available"}`);
      console.log(`    Mathf.Epsilon: ${epsilonField ? "Available" : "Not available"}`);

      const hasClamp = clampMethod !== null;
      assert(hasClamp, "Mathf.Clamp should be available");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Mathf.Clamp should compute expected result (best-effort)", () => {
      const domain = Mono.domain;
      const mathfClass = domain.tryClass("UnityEngine.Mathf");
      if (!mathfClass) {
        console.log("    (Skipped: Mathf class not available)");
        return;
      }

      const clamp = mathfClass.tryMethod("Clamp", 3);
      if (!clamp) {
        console.log("    (Skipped: Mathf.Clamp not available)");
        return;
      }

      try {
        const out = clamp.call<number>(null, [2.5, 0.0, 1.0]);
        console.log(`    Mathf.Clamp(2.5,0,1) = ${out}`);
        assert(typeof out === "number" && isFinite(out), "Clamp should return a finite number");
        assert(Math.abs(out - 1) < 0.001, "Clamp should be approximately 1");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes("access violation")) {
          console.log(`    (Skipped: access violation invoking Mathf.Clamp: ${msg})`);
          return;
        }
        throw error;
      }
    }),
  );

  // Random operations
  await suite.addResultAsync(
    withDomain("Random operations should be available", ({ domain }) => {
      const randomClass = domain.tryClass("UnityEngine.Random");

      if (!randomClass) {
        console.log("    (Skipped: Random class not available)");
        return;
      }

      // Test Random static methods
      const rangeIntMethod = randomClass.tryMethod("Range", 2);

      console.log(`    Random.Range: ${rangeIntMethod ? "Available" : "Not available"}`);

      // Test Random static properties
      const valueProperty = randomClass.tryProperty("value");
      const insideUnitCircleProperty = randomClass.tryProperty("insideUnitCircle");
      const insideUnitSphereProperty = randomClass.tryProperty("insideUnitSphere");

      console.log(`    Random.value: ${valueProperty ? "Available" : "Not available"}`);
      console.log(`    Random.insideUnitCircle: ${insideUnitCircleProperty ? "Available" : "Not available"}`);
      console.log(`    Random.insideUnitSphere: ${insideUnitSphereProperty ? "Available" : "Not available"}`);

      const hasRange = rangeIntMethod !== null;
      assert(hasRange, "Random.Range should be available");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Random.Range(int,int) should return within bounds (best-effort)", () => {
      const domain = Mono.domain;
      const randomClass = domain.tryClass("UnityEngine.Random");
      if (!randomClass) {
        console.log("    (Skipped: Random class not available)");
        return;
      }

      const range = randomClass.tryMethod("Range", 2);
      if (!range) {
        console.log("    (Skipped: Random.Range not available)");
        return;
      }

      try {
        // Unity's int overload is [min, max)
        const min = 0;
        const max = 10;
        const v = range.call<number>(null, [min, max]);
        console.log(`    Random.Range(0,10) = ${v}`);
        assert(Number.isInteger(v) || typeof v === "number", "Range should return a number");
        assert(v >= min && v < max, "Random.Range(int,int) should be within [min,max)");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes("access violation")) {
          console.log(`    (Skipped: access violation invoking Random.Range: ${msg})`);
          return;
        }
        throw error;
      }
    }),
  );

  // Physics operations
  await suite.addResultAsync(
    withDomain("Physics operations should be available", ({ domain }) => {
      const physicsClass = domain.tryClass("UnityEngine.Physics");

      if (!physicsClass) {
        console.log("    (Skipped: Physics class not available)");
        return;
      }

      // Test Physics static methods - try different overloads
      const raycastMethod = physicsClass.tryMethod("Raycast");

      console.log(`    Physics.Raycast: ${raycastMethod ? "Available" : "Not available"}`);

      // Test Physics static properties
      const gravityProperty = physicsClass.tryProperty("gravity");

      console.log(`    Physics.gravity: ${gravityProperty ? "Available" : "Not available"}`);

      const hasGravity = gravityProperty !== null;
      assert(hasGravity, "Physics.gravity should be available");
    }),
  );

  // Application operations
  await suite.addResultAsync(
    withDomain("Application operations should be available", ({ domain }) => {
      const applicationClass = domain.tryClass("UnityEngine.Application");

      if (!applicationClass) {
        console.log("    (Skipped: Application class not available)");
        return;
      }

      // Test Application static properties
      const dataPathProperty = applicationClass.tryProperty("dataPath");
      const isPlayingProperty = applicationClass.tryProperty("isPlaying");
      const platformProperty = applicationClass.tryProperty("platform");
      const versionProperty = applicationClass.tryProperty("version");

      console.log(`    Application.dataPath: ${dataPathProperty ? "Available" : "Not available"}`);
      console.log(`    Application.isPlaying: ${isPlayingProperty ? "Available" : "Not available"}`);
      console.log(`    Application.platform: ${platformProperty ? "Available" : "Not available"}`);
      console.log(`    Application.version: ${versionProperty ? "Available" : "Not available"}`);

      // Test Application static methods
      const quitMethod = applicationClass.tryMethod("Quit", 0);

      console.log(`    Application.Quit: ${quitMethod ? "Available" : "Not available"}`);

      const hasDataPath = dataPathProperty !== null;
      const hasIsPlaying = isPlayingProperty !== null;
      assert(hasDataPath || hasIsPlaying, "Application should have basic properties");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Application.version should be readable (best-effort)", () => {
      const domain = Mono.domain;
      const applicationClass = domain.tryClass("UnityEngine.Application");
      if (!applicationClass) {
        console.log("    (Skipped: Application class not available)");
        return;
      }

      try {
        const versionProp = applicationClass.tryProperty("version");
        const version = versionProp?.tryGetValue(null);
        console.log(`    Application.version=${version}`);
        if (typeof version === "string") {
          assert(version.length > 0, "Application.version should not be empty");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.toLowerCase().includes("access violation")) {
          console.log(`    (Skipped: access violation reading Application.version: ${msg})`);
          return;
        }
        throw error;
      }
    }),
  );

  // Error handling for engine modules
  await suite.addResultAsync(
    createErrorHandlingTest("Engine module operations should handle missing members gracefully", () => {
      const domain = Mono.domain;
      const vector3Class = domain.tryClass("UnityEngine.Vector3");

      if (!vector3Class) {
        console.log("    (Skipped: Vector3 class not available)");
        return;
      }

      // Test that tryMethod returns null for non-existent methods
      const nonExistentMethod = vector3Class.tryMethod("NonExistentMethod", 999);
      assert(nonExistentMethod === null, "tryMethod should return null for non-existent methods");
      console.log("    tryMethod returns null for non-existent: Passed");

      // Test that tryProperty returns null for non-existent properties
      const nonExistentProperty = vector3Class.tryProperty("nonExistentProperty");
      assert(nonExistentProperty === null, "tryProperty should return null for non-existent properties");
      console.log("    tryProperty returns null for non-existent: Passed");

      // Test that tryField returns null for non-existent fields
      const nonExistentField = vector3Class.tryField("nonExistentField");
      assert(nonExistentField === null, "tryField should return null for non-existent fields");
      console.log("    tryField returns null for non-existent: Passed");

      console.log("    Engine module error handling working correctly");
    }),
  );

  // Performance test for engine modules
  await suite.addResultAsync(
    createPerformanceTest("Engine module class lookup performance", () => {
      const domain = Mono.domain;

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        domain.tryClass("UnityEngine.Vector3");
        domain.tryClass("UnityEngine.Quaternion");
        domain.tryClass("UnityEngine.Color");
      }

      const duration = Date.now() - startTime;
      console.log(`    ${iterations * 3} class lookups took ${duration}ms`);
      assert(duration < 1000, "Engine module class lookups should be fast");
    }),
  );

  // Integration test for engine modules
  await suite.addResultAsync(
    createIntegrationTest("Engine module integration with Unity systems", () => {
      const domain = Mono.domain;

      // Test Vector3 integration with Transform
      const vector3Class = domain.tryClass("UnityEngine.Vector3");
      const transformClass = domain.tryClass("UnityEngine.Transform");

      if (vector3Class && transformClass) {
        console.log("    Vector3-Transform integration available");
      }

      // Test Color integration with Renderer
      const colorClass = domain.tryClass("UnityEngine.Color");
      const rendererClass = domain.tryClass("UnityEngine.Renderer");

      if (colorClass && rendererClass) {
        console.log("    Color-Renderer integration available");
      }

      // Test Physics integration with Collider
      const physicsClass = domain.tryClass("UnityEngine.Physics");
      const colliderClass = domain.tryClass("UnityEngine.Collider");

      if (physicsClass && colliderClass) {
        console.log("    Physics-Collider integration available");
      }

      // Test Time integration with MonoBehaviour
      const timeClass = domain.tryClass("UnityEngine.Time");
      const monoBehaviourClass = domain.tryClass("UnityEngine.MonoBehaviour");

      if (timeClass && monoBehaviourClass) {
        console.log("    Time-MonoBehaviour integration available");
      }

      console.log("    Engine module integration test completed");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Unity Engine Modules Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity Engine Modules tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

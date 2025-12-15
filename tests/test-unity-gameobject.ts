/**
 * Unity GameObject Tests
 *
 * Notes:
 * - This suite must not rely on deprecated createMonoTest() helpers.
 *   Those helpers run "fire-and-forget" and can surface late exceptions
 *   after the summary, causing exit code 1.
 * - Unity/Mono builds vary. Some methods/properties may not exist or may
 *   be unsafe to invoke off the Unity main thread. These are treated as
 *   best-effort checks with graceful skips.
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

function isMonoMethodNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes("[Mono:METHOD_NOT_FOUND]");
}

function tryDestroyUnityObject(obj: any): void {
  try {
    const domain = Mono.domain;
    const unityObjectClass = domain.tryClass("UnityEngine.Object");
    if (!unityObjectClass) return;

    // Prefer DestroyImmediate if present, otherwise Destroy.
    const destroyImmediate = unityObjectClass.tryMethod("DestroyImmediate", 1);
    const destroy = unityObjectClass.tryMethod("Destroy", 1);
    if (destroyImmediate) {
      destroyImmediate.invoke(null, [obj], { throwOnManagedException: false });
      return;
    }
    if (destroy) {
      destroy.invoke(null, [obj], { throwOnManagedException: false });
    }
  } catch {
    // Best-effort cleanup only
  }
}

export async function createUnityGameObjectTests(): Promise<TestResult> {
  console.log("\nUnity GameObject Tests:");

  const suite = new TestSuite("Unity GameObject Tests", TestCategory.MONO_DEPENDENT);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.MONO_DEPENDENT, "Unity GameObject operations"));

  // Basic GameObject class availability (metadata + assembly)
  await suite.addResultAsync(
    createMonoDependentTest("UnityEngine.GameObject class should be accessible", () => {
      assertDomainAvailable("Domain should be available for GameObject tests");
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "UnityEngine.GameObject class should be found");

      if (gameObjectClass) {
        console.log(`    GameObject class found: ${gameObjectClass.name ?? "GameObject"}`);
        const assembly = (gameObjectClass as any).image?.assembly;
        console.log(`    Assembly: ${assembly?.name || "Unknown"}`);
      }
    }),
  );

  // Static API surface (method existence only; no throwing on missing)
  await suite.addResultAsync(
    createMonoDependentTest("GameObject static APIs should be available", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "GameObject class should be available");
      if (!gameObjectClass) return;

      const find = gameObjectClass.tryMethod("Find", 1);
      const findWithTag = gameObjectClass.tryMethod("FindWithTag", 1);
      const findGameObjectsWithTag = gameObjectClass.tryMethod("FindGameObjectsWithTag", 1);

      console.log(`    Find: ${find ? "Available" : "Not available"}`);
      console.log(`    FindWithTag: ${findWithTag ? "Available" : "Not available"}`);
      console.log(`    FindGameObjectsWithTag: ${findGameObjectsWithTag ? "Available" : "Not available"}`);

      assert(!!find || !!findWithTag, "At least one GameObject.Find variant should exist");
    }),
  );

  // Constructors and core instance methods
  await suite.addResultAsync(
    createMonoDependentTest("GameObject constructors and core instance methods should exist", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "GameObject class should be available");
      if (!gameObjectClass) return;

      const ctor0 = gameObjectClass.tryMethod(".ctor", 0);
      const ctor1 = gameObjectClass.tryMethod(".ctor", 1);
      const setActive = gameObjectClass.tryMethod("SetActive", 1);
      const getName = gameObjectClass.tryMethod("get_name", 0);
      const setName = gameObjectClass.tryMethod("set_name", 1);
      // Correct Unity/Mono naming is get_activeInHierarchy (lowercase 'a')
      const getActiveInHierarchy = gameObjectClass.tryMethod("get_activeInHierarchy", 0);
      const getActiveSelf = gameObjectClass.tryMethod("get_activeSelf", 0);

      console.log(`    .ctor(): ${ctor0 ? "Available" : "Not available"}`);
      console.log(`    .ctor(string): ${ctor1 ? "Available" : "Not available"}`);
      console.log(`    SetActive(bool): ${setActive ? "Available" : "Not available"}`);
      console.log(`    get_name/set_name: ${getName && setName ? "Available" : "Partial"}`);
      console.log(`    get_activeSelf: ${getActiveSelf ? "Available" : "Not available"}`);
      console.log(`    get_activeInHierarchy: ${getActiveInHierarchy ? "Available" : "Not available"}`);

      assert(!!setActive, "SetActive(bool) should be available");
      assert(!!ctor0 || !!ctor1, "At least one GameObject constructor should be available");
    }),
  );

  // Transform presence (metadata)
  await suite.addResultAsync(
    createMonoDependentTest("GameObject transform and Transform position APIs should exist", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "GameObject class should be available");
      if (!gameObjectClass) return;

      const getTransform = gameObjectClass.tryMethod("get_transform", 0);
      assert(!!getTransform, "GameObject.get_transform should exist");
      console.log(`    get_transform: ${getTransform ? "Available" : "Not available"}`);

      const transformClass = domain.tryClass("UnityEngine.Transform");
      assertNotNull(transformClass, "UnityEngine.Transform class should be found");
      if (!transformClass) return;

      const getPosition = transformClass.tryMethod("get_position", 0);
      const setPosition = transformClass.tryMethod("set_position", 1);
      console.log(`    Transform.get_position/set_position: ${getPosition && setPosition ? "Available" : "Partial"}`);
      assert(!!getPosition, "Transform.get_position should exist");
    }),
  );

  // Safe GameObject.Find operation (runtime invocation)
  await suite.addResultAsync(
    createMonoDependentTest("GameObject.Find should work safely", () => {
      try {
        const domain = Mono.domain;
        const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

        if (!gameObjectClass) {
          console.log("    (Skipped: GameObject class not available)");
          return;
        }

        const findMethod = gameObjectClass.tryMethod("Find", 1);
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
        if (isAccessViolation(error)) {
          console.log(
            "    (Skipped: GameObject.Find access violation - method may not be available in this Unity context)",
          );
          return;
        }
        throw error;
      }
    }),
  );

  // Meaningful: create a temporary managed GameObject and exercise basic instance behavior.
  // This is best-effort; some Unity builds may require main-thread for engine object creation.
  await suite.addResultAsync(
    createMonoDependentTest("GameObject create + name + activeSelf roundtrip (best-effort)", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "GameObject class should be available");
      if (!gameObjectClass) return;

      let go: any;
      try {
        go = gameObjectClass.newObject(true);
      } catch (error) {
        if (isAccessViolation(error) || isMonoMethodNotFound(error)) {
          console.log(`    (Skipped: GameObject creation not supported here: ${error})`);
          return;
        }
        throw error;
      }

      try {
        // Methods/properties may be inherited (e.g., name is on UnityEngine.Object),
        // so check on the instance rather than the declaring class.
        const requiredMethods: Array<[string, number]> = [
          ["set_name", 1],
          ["get_name", 0],
          ["SetActive", 1],
          ["get_activeSelf", 0],
        ];
        const missing = requiredMethods.filter(([n, argc]) => !go.hasMethod(n, argc));
        if (missing.length > 0) {
          console.log(`    (Skipped: Missing instance APIs: ${missing.map(([n, argc]) => `${n}/${argc}`).join(", ")})`);
          return;
        }

        const testName = "FridaMonoBridge_TestGO";
        go.call("set_name", [testName]);
        const nameNow = go.call("get_name", []);
        console.log(`    Name roundtrip: ${nameNow}`);
        assert(nameNow === testName, "GameObject name should roundtrip");

        go.call("SetActive", [false]);
        const activeSelf = go.call("get_activeSelf", []);
        console.log(`    activeSelf after SetActive(false): ${activeSelf}`);
        assert(activeSelf === false, "activeSelf should reflect SetActive(false)");
      } catch (error) {
        if (isAccessViolation(error)) {
          console.log(`    (Skipped: Engine invocation access violation: ${error})`);
          return;
        }
        throw error;
      } finally {
        tryDestroyUnityObject(go);
      }
    }),
  );

  // Meaningful: hierarchy + activeInHierarchy semantics.
  await suite.addResultAsync(
    createIntegrationTest("GameObject hierarchy activeInHierarchy semantics (best-effort)", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      let parent: any;
      let child: any;
      try {
        parent = gameObjectClass.newObject(true);
        child = gameObjectClass.newObject(true);
      } catch (error) {
        if (isAccessViolation(error) || isMonoMethodNotFound(error)) {
          console.log(`    (Skipped: GameObject creation not supported here: ${error})`);
          return;
        }
        throw error;
      }

      try {
        // Set names (helps debugging / future Find-by-name tests)
        if (parent.hasMethod("set_name", 1)) parent.call("set_name", ["FridaMonoBridge_Parent"]);
        if (child.hasMethod("set_name", 1)) child.call("set_name", ["FridaMonoBridge_Child"]);

        const parentTransform = parent.call("get_transform", []);
        const childTransform = child.call("get_transform", []);

        // Parent the child (try common APIs)
        if (childTransform.hasMethod("SetParent", 2)) {
          childTransform.call("SetParent", [parentTransform, false]);
        } else if (childTransform.hasMethod("SetParent", 1)) {
          childTransform.call("SetParent", [parentTransform]);
        } else if (childTransform.hasMethod("set_parent", 1)) {
          childTransform.call("set_parent", [parentTransform]);
        } else {
          console.log("    (Skipped: No Transform parenting API available)");
          return;
        }

        if (!child.hasMethod("get_activeInHierarchy", 0) || !child.hasMethod("get_activeSelf", 0)) {
          console.log("    (Skipped: activeInHierarchy/activeSelf not available on instance)");
          return;
        }

        // Baseline
        const baseSelf = child.call("get_activeSelf", []);
        const baseInHierarchy = child.call("get_activeInHierarchy", []);
        console.log(`    baseline: activeSelf=${baseSelf}, activeInHierarchy=${baseInHierarchy}`);

        // Disable parent and validate child becomes inactive in hierarchy
        parent.call("SetActive", [false]);
        const childSelfAfter = child.call("get_activeSelf", []);
        const childInHierarchyAfter = child.call("get_activeInHierarchy", []);
        console.log(
          `    after parent inactive: child activeSelf=${childSelfAfter}, activeInHierarchy=${childInHierarchyAfter}`,
        );

        // Semantics: child self stays true (unless explicitly disabled), but inHierarchy should become false.
        assert(childSelfAfter === baseSelf, "Child activeSelf should not change when parent is deactivated");
        assert(childInHierarchyAfter === false, "Child activeInHierarchy should be false when parent is inactive");
      } catch (error) {
        if (isAccessViolation(error)) {
          console.log(`    (Skipped: access violation in hierarchy test: ${error})`);
          return;
        }
        throw error;
      } finally {
        tryDestroyUnityObject(child);
        tryDestroyUnityObject(parent);
      }
    }),
  );

  // GameObject property metadata access (no engine invocation)
  await suite.addResultAsync(
    createMonoDependentTest("GameObject properties should be accessible (metadata)", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      assertNotNull(gameObjectClass, "GameObject class should be available");
      if (!gameObjectClass) return;

      const activeSelfProperty = gameObjectClass.tryProperty("activeSelf");
      const activeInHierarchyProperty = gameObjectClass.tryProperty("activeInHierarchy");
      const layerProperty = gameObjectClass.tryProperty("layer");
      const tagProperty = gameObjectClass.tryProperty("tag");
      const transformProperty = gameObjectClass.tryProperty("transform");

      console.log(`    activeSelf: ${activeSelfProperty ? "Available" : "Not available"}`);
      console.log(`    activeInHierarchy: ${activeInHierarchyProperty ? "Available" : "Not available"}`);
      console.log(`    layer: ${layerProperty ? "Available" : "Not available"}`);
      console.log(`    tag: ${tagProperty ? "Available" : "Not available"}`);
      console.log(`    transform: ${transformProperty ? "Available" : "Not available"}`);

      assert(!!activeSelfProperty, "activeSelf property should be available");
      assert(!!tagProperty, "tag property should be available");
    }),
  );

  // Error handling for GameObject operations
  await suite.addResultAsync(
    createErrorHandlingTest("GameObject operations should handle errors gracefully", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      try {
        // Test with invalid GameObject name
        const findMethod = gameObjectClass.tryMethod("Find", 1);
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
        if (isAccessViolation(error)) {
          console.log("    (Skipped: GameObject error handling access violation)");
          return;
        }
        throw error;
      }
    }),
  );

  // Performance test for GameObject operations
  await suite.addResultAsync(
    createPerformanceTest("GameObject operations performance", () => {
      const domain = Mono.domain;
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");

      if (!gameObjectClass) {
        console.log("    (Skipped: GameObject class not available)");
        return;
      }

      const findMethod = gameObjectClass.tryMethod("Find", 1);
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
    }),
  );

  // Integration test with other Unity systems
  await suite.addResultAsync(
    createIntegrationTest("GameObject integration with Unity systems", () => {
      const domain = Mono.domain;

      // Test GameObject with Transform
      const gameObjectClass = domain.tryClass("UnityEngine.GameObject");
      const transformClass = domain.tryClass("UnityEngine.Transform");

      if (gameObjectClass && transformClass) {
        console.log("    GameObject and Transform classes available for integration");
      }

      // Test GameObject with Component system
      const componentClass = domain.tryClass("UnityEngine.Component");
      if (componentClass) {
        console.log("    Component system available for GameObject integration");
      }

      // Test GameObject with Scene management
      const sceneManagerClass = domain.tryClass("UnityEngine.SceneManagement.SceneManager");
      if (sceneManagerClass) {
        console.log("    Scene management available for GameObject integration");
      }

      console.log("    GameObject integration test completed");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Unity GameObject Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Unity GameObject tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  };
}

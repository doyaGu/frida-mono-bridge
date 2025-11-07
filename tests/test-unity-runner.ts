// Simple Unity test runner

// Import Unity test suites
import { testUnityGameObject } from "./test-unity-gameobject";
import { testUnityComponents } from "./test-unity-components";
import { testUnityEngineModules } from "./test-unity-engine-modules";

console.log("====================================================");
console.log(" == Unity-Specific Test Runner ==");
console.log("====================================================");

function runUnityTests() {
  try {
    // Test if we can attach to Platformer
    console.log("Testing Unity runtime access...");

    // Run Unity GameObject tests
    console.log("\n------------------------------------");
    console.log("-- Unity GameObject Tests --");
    console.log("------------------------------------");

    testUnityGameObject();

    console.log("\n------------------------------------");
    console.log("-- Unity Component Tests --");
    console.log("------------------------------------");

    testUnityComponents();

    console.log("\n------------------------------------");
    console.log("-- Unity Engine Module Tests --");
    console.log("------------------------------------");

    testUnityEngineModules();

    console.log("\nUnity tests completed successfully!");

  } catch (error) {
    console.error("Error running Unity tests:", error);
  }
}

// Run the tests
runUnityTests();
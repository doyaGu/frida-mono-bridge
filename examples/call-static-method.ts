/**
 * Static Method Invocation Example
 *
 * This example demonstrates typical static method calling patterns in Unity games.
 * Shows how to find and invoke static methods for common game operations.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Static Method Invocation Example ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Try to find common Unity assemblies
      const unityAssembly = domain.assembly("UnityEngine.CoreModule");
      const gameAssembly = domain.assembly("Assembly-CSharp");
      const assemblyCSharpFirstpass = domain.assembly("Assembly-CSharp-firstpass");

      // Example 1: Common Unity static methods
      console.log("\n--- Example 1: Unity Engine Static Methods ---");
      if (unityAssembly) {
        const timeClass = unityAssembly.image.class("UnityEngine.Time");
        if (timeClass) {
          const getTimeMethod = timeClass.method("get_time", 0);
          if (getTimeMethod) {
            const currentTime = getTimeMethod.invoke(null, []);
            console.log(`[OK] Current Unity time: ${currentTime}`);
          }

          const getDeltaTimeMethod = timeClass.method("get_deltaTime", 0);
          if (getDeltaTimeMethod) {
            const deltaTime = getDeltaTimeMethod.invoke(null, []);
            console.log(`[OK] Delta time: ${deltaTime}`);
          }
        }

        const debugClass = unityAssembly.image.class("UnityEngine.Debug");
        if (debugClass) {
          const logMethod = debugClass.method("Log", 1);
          if (logMethod) {
            console.log("[OK] Calling Debug.Log with custom message");
            logMethod.invoke(null, ["Hello from Frida Mono Bridge!"]);
          }
        }
      } else {
        console.log("[WARN] UnityEngine.CoreModule not found");
      }

      // Example 2: Game-specific static methods
      console.log("\n--- Example 2: Game-Specific Static Methods ---");
      if (gameAssembly) {
        // Try to find common game manager or utility classes
        const gameManagerClass = gameAssembly.image.class("GameManager");
        if (gameManagerClass) {
          const getInstanceMethod = gameManagerClass.method("GetInstance", 0);
          if (getInstanceMethod) {
            console.log("[OK] Found GameManager.GetInstance method");
          }
        }

        // Look for common game systems
        const playerPrefsClass = gameAssembly.image.class("UnityEngine.PlayerPrefs");
        if (playerPrefsClass) {
          const getStringMethod = playerPrefsClass.method("GetString", 1);
          if (getStringMethod) {
            const testValue = getStringMethod.invoke(null, ["TestKey"]);
            console.log(`[OK] PlayerPrefs.GetString('TestKey'): ${testValue}`);
          }

          const setStringMethod = playerPrefsClass.method("SetString", 2);
          if (setStringMethod) {
            setStringMethod.invoke(null, ["FridaTest", "HelloFromFrida"]);
            console.log("[OK] Set PlayerPrefs key 'FridaTest'");
          }
        }

        // Try to find and invoke common math/utility methods
        const mathfClass = unityAssembly?.image.class("UnityEngine.Mathf");
        if (mathfClass) {
          const sinMethod = mathfClass.method("Sin", 1);
          if (sinMethod) {
            const result = sinMethod.invoke(null, [Math.PI / 4]);
            console.log(`[OK] Mathf.Sin(π/4): ${result}`);
          }
        }
      } else {
        console.log("[WARN] Assembly-CSharp not found");
      }

      // Example 3: Enumerate and call static methods dynamically
      console.log("\n--- Example 3: Dynamic Static Method Discovery ---");
      if (gameAssembly) {
        const classes = gameAssembly.image.classes;
        console.log(`[OK] Found ${classes.length} classes in Assembly-CSharp`);

        let staticMethodCount = 0;
        for (const cls of classes.slice(0, 10)) { // Limit to first 10 for demo
          const methods = cls.methods;
          for (const method of methods) {
            if (method.isStatic()) {
              staticMethodCount++;
              // Only log a few to avoid spam
              if (staticMethodCount <= 5) {
                console.log(`  Found static method: ${method.getFullName()}`);
              }
            }
          }
        }
        console.log(`[OK] Total static methods found in first 10 classes: ${staticMethodCount}`);
      }

      // Example 4: Safe static method invocation with error handling
      console.log("\n--- Example 4: Safe Invocation with Error Handling ---");
      try {
        // Try to invoke a method that might not exist
        const randomClass = unityAssembly?.image.class("UnityEngine.Random");
        if (randomClass) {
          const rangeMethod = randomClass.method("Range", 2);
          if (rangeMethod) {
            const randomValue = rangeMethod.invoke(null, [1, 100]);
            console.log(`[OK] Random.Range(1, 100): ${randomValue}`);
          } else {
            console.log("[WARN] Random.Range method not found");
          }
        }
      } catch (error) {
        console.error("[ERROR] Failed to invoke Random.Range:", error);
      }

    } catch (error) {
      console.error("[ERROR] Static method example failed:", error);
    }
  });

  console.log("\n=== Static Method Invocation Example Complete ===");
}

main();

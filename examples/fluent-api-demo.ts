/**
 * Fluent API Demonstration
 *
 * This example showcases the modern fluent API patterns for common Unity/Mono
 * operations including game state manipulation, player management, and system
 * monitoring. Demonstrates real-world usage patterns.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Fluent API Demonstration ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Example 1: Game state discovery and manipulation
      console.log("\n--- Example 1: Game State Management ---");

      // Find common game assemblies
      const gameAssembly = domain.assembly("Assembly-CSharp");
      const unityAssembly = domain.assembly("UnityEngine.CoreModule");

      if (gameAssembly) {
        console.log(`[OK] Found game assembly: ${gameAssembly.name}`);

        // Look for common game manager classes
        const gameManagerClass = gameAssembly.image.class("GameManager");
        const playerManagerClass = gameAssembly.image.class("PlayerManager");
        const uiManagerClass = gameAssembly.image.class("UIManager");

        // Try to find and interact with game managers
        if (gameManagerClass) {
          console.log("[OK] Found GameManager class");

          // Look for singleton instance methods
          const getInstanceMethod = gameManagerClass.method("GetInstance", 0);
          if (getInstanceMethod) {
            try {
              const gameManagerInstance = getInstanceMethod.invoke(null, []);
              console.log(`[OK] GameManager instance: ${gameManagerInstance}`);

              // Look for game state methods
              const pauseMethod = gameManagerClass.method("PauseGame", 0);
              const resumeMethod = gameManagerClass.method("ResumeGame", 0);
              const getLevelMethod = gameManagerClass.method("GetCurrentLevel", 0);

              if (pauseMethod && resumeMethod) {
                console.log("[INFO] Found pause/resume methods");
                // In a real scenario, you might call: pauseMethod.invoke(gameManagerInstance, []);
              }

              if (getLevelMethod) {
                const currentLevel = getLevelMethod.invoke(gameManagerInstance, []);
                console.log(`[INFO] Current level: ${currentLevel}`);
              }
            } catch (error) {
              console.log(`[WARN] Could not interact with GameManager: ${error}`);
            }
          }
        }

        // Player management example
        const playerClass = gameAssembly.image.class("Player") ||
                           gameAssembly.image.class("PlayerController") ||
                           gameAssembly.image.class("Game.Player");

        if (playerClass) {
          console.log(`[OK] Found player class: ${playerClass.fullName}`);

          // Look for common player properties and methods
          const healthProperty = playerClass.property("Health") || playerClass.property("health");
          const scoreProperty = playerClass.property("Score") || playerClass.property("score");
          const positionProperty = playerClass.property("Position") || playerClass.property("position");

          if (healthProperty) {
            console.log("[OK] Found health property");
            // Example: Read current health
            // const health = healthProperty.getValue(playerInstance);
          }

          // Look for player actions
          const takeDamageMethod = playerClass.method("TakeDamage", 1);
          const healMethod = playerClass.method("Heal", 1);
          const moveMethod = playerClass.method("Move", 1);

          if (takeDamageMethod && healMethod) {
            console.log("[INFO] Player combat methods available");
          }
        }
      }

      // Example 2: Unity system integration
      console.log("\n--- Example 2: Unity System Integration ---");

      if (unityAssembly) {
        // Time system manipulation
        const timeClass = unityAssembly.image.class("UnityEngine.Time");
        if (timeClass) {
          const timeScaleProperty = timeClass.property("timeScale");
          const deltaTimeProperty = timeClass.property("deltaTime");

          if (timeScaleProperty) {
            console.log("[OK] Found Time.timeScale property");
            try {
              const currentTimeScale = timeScaleProperty.getValue(null);
              console.log(`[INFO] Current time scale: ${currentTimeScale}`);

              // Example of time manipulation (be careful with this!)
              console.log("[INFO] Time manipulation patterns:");
              console.log("  - Slow motion: timeScale = 0.5");
              console.log("  - Pause: timeScale = 0.0");
              console.log("  - Fast forward: timeScale = 2.0");
            } catch (error) {
              console.log(`[WARN] Could not read time scale: ${error}`);
            }
          }
        }

        // Camera system
        const cameraClass = unityAssembly.image.class("UnityEngine.Camera");
        if (cameraClass) {
          const mainCameraMethod = cameraClass.method("get_main", 0);
          if (mainCameraMethod) {
            try {
              const mainCamera = mainCameraMethod.invoke(null, []);
              console.log(`[OK] Main camera: ${mainCamera}`);
            } catch (error) {
              console.log("[WARN] Could not get main camera");
            }
          }
        }

        // Input system
        const inputClass = unityAssembly.image.class("UnityEngine.Input");
        if (inputClass) {
          const getKeyMethod = inputClass.method("GetKey", 1);
          const getKeyDownMethod = inputClass.method("GetKeyDown", 1);

          if (getKeyMethod) {
            console.log("[OK] Input system methods available");
          }
        }
      }

      // Example 3: Resource management and inventory systems
      console.log("\n--- Example 3: Resource and Inventory Systems ---");

      if (gameAssembly) {
        // Look for inventory-related classes
        const inventoryClasses = gameAssembly.image.classes.filter(cls =>
          cls.name.includes("Inventory") ||
          cls.name.includes("Backpack") ||
          cls.name.includes("Item") ||
          cls.name.includes("Resource")
        );

        console.log(`[OK] Found ${inventoryClasses.length} inventory-related classes`);

        for (const invClass of inventoryClasses.slice(0, 3)) {
          console.log(`  - ${invClass.fullName}`);

          // Look for common inventory methods
          const addMethod = invClass.method("AddItem", 1) || invClass.method("Add", 1);
          const removeMethod = invClass.method("RemoveItem", 1) || invClass.method("Remove", 1);
          const hasMethod = invClass.method("HasItem", 1) || invClass.method("Contains", 1);

          if (addMethod || removeMethod || hasMethod) {
            console.log(`    Methods: ${addMethod ? 'Add' : ''}${removeMethod ? ' Remove' : ''}${hasMethod ? ' Contains' : ''}`);
          }
        }

        // Currency/economy systems
        const currencyClass = gameAssembly.image.class("Currency") ||
                            gameAssembly.image.class("Wallet") ||
                            gameAssembly.image.class("EconomyManager");

        if (currencyClass) {
          console.log(`[OK] Found currency system: ${currencyClass.name}`);

          const balanceProperty = currencyClass.property("Balance") || currencyClass.property("balance");
          const addCurrencyMethod = currencyClass.method("AddCurrency", 1) || currencyClass.method("Add", 1);

          if (balanceProperty && addCurrencyMethod) {
            console.log("[INFO] Currency manipulation available");
          }
        }
      }

      // Example 4: Performance monitoring and debugging
      console.log("\n--- Example 4: Performance and Debugging ---");

      // Unity debugging
      if (unityAssembly) {
        const debugClass = unityAssembly.image.class("UnityEngine.Debug");
        if (debugClass) {
          const logMethod = debugClass.method("Log", 1);
          const warningMethod = debugClass.method("LogWarning", 1);
          const errorMethod = debugClass.method("LogError", 1);

          if (logMethod) {
            console.log("[OK] Unity debug methods available");

            // Example of sending custom debug messages
            try {
              logMethod.invoke(null, ["[FRIDA] Fluent API demo started"]);
              console.log("[INFO] Sent debug message to Unity console");
            } catch (error) {
              console.log("[WARN] Could not send debug message");
            }
          }
        }

        // Performance monitoring
        const profilerClass = unityAssembly.image.class("UnityEngine.Profiler");
        if (profilerClass) {
          const enabledProperty = profilerClass.property("enabled");
          const getRuntimeMemorySizeMethod = profilerClass.method("GetRuntimeMemorySize", 1);

          if (enabledProperty) {
            console.log("[OK] Profiler available");
          }
        }
      }

      // Example 5: Advanced search patterns
      console.log("\n--- Example 5: Advanced Search Patterns ---");

      // Find all classes with "Manager" in their name
      const managerClasses = Mono.find.classes(Mono.api, "*Manager*");
      console.log(`[OK] Found ${managerClasses.length} manager classes:`);

      for (const mgr of managerClasses.slice(0, 5)) {
        console.log(`  - ${mgr.fullName}`);

        // Count methods in each manager
        const methodCount = mgr.methods.length;
        const staticMethodCount = mgr.methods.filter((m: any) => m.isStatic()).length;
        console.log(`    Methods: ${methodCount} (${staticMethodCount} static)`);
      }

      // Find all methods that take string parameters (simple pattern)
      const stringMethods = Mono.find.methods(Mono.api, "*");
      console.log(`[OK] Found ${stringMethods.length} methods total`);

      // Find all methods returning bool (simple pattern)
      const boolMethods = Mono.find.methods(Mono.api, "*");
      console.log(`[OK] Found ${boolMethods.length} methods (searching for specific patterns would require filtering)`);

      // Example 6: Memory management and garbage collection
      console.log("\n--- Example 6: Memory Management ---");

      try {
        const gc = Mono.gc;
        console.log(`[OK] GC max generation: ${gc.maxGeneration}`);

        // Get memory info if available
        console.log("[INFO] Memory management operations:");
        console.log("  - GC.Collect(): Force garbage collection");
        console.log("  - GC.GetTotalMemory(): Get allocated memory");
        console.log("  - GC.RegisterForFullGCNotification(): GC notifications");

        // Example of safe memory usage pattern
        console.log("[INFO] Safe memory usage patterns:");
        console.log("  1. Always dispose MonoObject instances");
        console.log("  2. Use try-finally blocks for cleanup");
        console.log("  3. Monitor memory usage during operations");
        console.log("  4. Avoid creating large numbers of temporary objects");
      } catch (error) {
        console.log(`[WARN] GC operations not available: ${error}`);
      }

      // Example 7: Error handling and robustness
      console.log("\n--- Example 7: Error Handling Best Practices ---");

      console.log("[INFO] Fluent API error handling patterns:");
      console.log("1. Always wrap operations in try-catch blocks");
      console.log("2. Check for null returns from class/method lookups");
      console.log("3. Validate method parameters before invocation");
      console.log("4. Use optional chaining for deep property access");
      console.log("5. Implement fallback behavior for missing game components");

      // Demonstrate robust pattern
      try {
        const someClass = domain.assembly("Assembly-CSharp")?.image.class("SomeClass");
        const someMethod = someClass?.method("SomeMethod", 1);

        if (someMethod) {
          console.log("[OK] Safe method lookup pattern successful");
        } else {
          console.log("[INFO] Method not found - this is normal for demo");
        }
      } catch (error) {
        console.log(`[INFO] Expected error in demo: ${error}`);
      }

      console.log("\n[OK] Fluent API demonstration completed successfully");
      console.log("[INFO] This demo showed real-world patterns for Unity game interaction");

    } catch (error) {
      console.error("[ERROR] Fluent API demo failed:", error);
    }
  });

  console.log("\n=== Fluent API Demonstration Complete ===");
}

main();

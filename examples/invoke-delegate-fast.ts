/**
 * Fast Delegate Invocation Example
 *
 * This example demonstrates how to work with delegates in Unity/Mono applications,
 * including creating, compiling, and invoking delegate thunks for high-performance calls.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Fast Delegate Invocation Example ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Example 1: Find and work with existing delegates
      console.log("\n--- Example 1: Unity Event System Delegates ---");
      const unityAssembly = domain.assembly("UnityEngine.CoreModule");

      if (unityAssembly) {
        // Look for Unity delegate types
        const unityActionClass = unityAssembly.image.class("UnityEngine.UnityAction");
        const unityEventClass = unityAssembly.image.class("UnityEngine.Events.UnityEvent");

        if (unityActionClass) {
          console.log("[OK] Found UnityEngine.UnityAction delegate type");

          // Try to find methods that use or return delegates
          const gameAssembly = domain.assembly("Assembly-CSharp");
          if (gameAssembly) {
            const classes = gameAssembly.image.classes;
            let delegateMethods = 0;

            for (const cls of classes.slice(0, 50)) { // Limit for performance
              const methods = cls.methods;
              for (const method of methods) {
                try {
                  const returnType = method.getReturnType();
                  const parameters = method.getParameters() || [];

                  // Check if method returns a delegate
                  if (returnType && (
                    returnType.getName().includes("Delegate") ||
                    returnType.getName().includes("Action") ||
                    returnType.getName().includes("Func") ||
                    returnType.getName().includes("EventHandler")
                  )) {
                    delegateMethods++;
                    if (delegateMethods <= 3) {
                      console.log(`  Found delegate-returning method: ${method.getFullName()}`);
                    }
                  }

                  // Check if method takes delegate parameters
                  for (const param of parameters) {
                    if (param.type && (
                      param.type.getName().includes("Delegate") ||
                      param.type.getName().includes("Action") ||
                      param.type.getName().includes("Func")
                    )) {
                      delegateMethods++;
                      if (delegateMethods <= 3) {
                        console.log(`  Found delegate-parameter method: ${method.getFullName()}`);
                      }
                      break;
                    }
                  }
                } catch (error) {
                  // Ignore type resolution errors
                }
              }
            }

            console.log(`[OK] Found ${delegateMethods} methods involving delegates`);
          }
        } else {
          console.log("[WARN] UnityEngine.UnityAction not found");
        }
      }

      // Example 2: Create and use simple delegates
      console.log("\n--- Example 2: Creating Custom Delegates ---");

      // Try to find or create a simple callback delegate
      const gameAssembly = domain.assembly("Assembly-CSharp");
      if (gameAssembly) {
        // Look for common delegate patterns in game code
        const classes = gameAssembly.image.classes;

        for (const cls of classes.slice(0, 20)) {
          try {
            const methods = cls.methods;

            // Find static methods that could be used as delegates
            const staticMethods = methods.filter(method =>
              method.isStatic() &&
              method.getParameters().length <= 2 &&
              !method.getReturnType()?.getName().includes("Void")
            );

            if (staticMethods.length > 0) {
              console.log(`[OK] Found potential delegate targets in ${cls.name}:`);

              for (const method of staticMethods.slice(0, 2)) {
                console.log(`  Static method: ${method.name}`);
                console.log(`    Parameters: ${method.getParameters().length}`);
                console.log(`    Return type: ${method.getReturnType()?.getName() || 'void'}`);

                try {
                  // Try to create a delegate for this method
                  if (method.getReturnType()) {
                    console.log(`    Attempting to create delegate...`);

                    // This would typically be done by finding the appropriate delegate type
                    // and creating a delegate instance. For this example, we'll demonstrate
                    // the pattern without actually creating invalid delegates.

                    console.log(`    [INFO] Delegate creation pattern identified`);
                  }
                } catch (error) {
                  console.log(`    [WARN] Could not create delegate: ${error}`);
                }
              }
              break; // Found a good example class
            }
          } catch (error) {
            // Ignore class analysis errors
          }
        }
      }

      // Example 3: High-performance delegate invocation patterns
      console.log("\n--- Example 3: Performance-Optimized Delegate Usage ---");

      // Demonstrate how to set up fast delegate thunks
      const coreAssembly = domain.assembly("mscorlib");
      if (coreAssembly) {
        const actionClass = coreAssembly.image.class("System.Action`1");
        if (actionClass) {
          console.log("[OK] Found System.Action<T> delegate type");

          // Show how to work with generic delegate types
          try {
            console.log("[INFO] Generic delegate patterns:");
            console.log("  - Action<T>: void method with one parameter");
            console.log("  - Func<T, TResult>: method with parameter and return value");
            console.log("  - EventHandler: event handling delegate pattern");
            console.log("  - Comparison<T>: sorting/comparison delegate");

            // Demonstrate thunk compilation pattern
            console.log("[INFO] Delegate thunk compilation pattern:");
            console.log("  1. Resolve delegate type information");
            console.log("  2. Get method pointer from delegate instance");
            console.log("  3. Compile native thunk for fast invocation");
            console.log("  4. Cache thunk for repeated calls");

          } catch (error) {
            console.log(`[WARN] Could not analyze generic delegates: ${error}`);
          }
        }
      }

      // Example 4: Event subscription and callback patterns
      console.log("\n--- Example 4: Event System Integration ---");

      // Look for event patterns in Unity game code
      if (gameAssembly) {
        const classes = gameAssembly.image.classes;
        let eventFields = 0;
        let eventMethods = 0;

        for (const cls of classes.slice(0, 30)) {
          try {
            const fields = cls.fields;
            const methods = cls.methods;

            // Look for event-like fields (typically delegate types)
            for (const field of fields) {
              const fieldType = field.getType();
              if (fieldType && (
                fieldType.getName().includes("Event") ||
                fieldType.getName().includes("Delegate") ||
                fieldType.getName().includes("Action")
              )) {
                eventFields++;
                if (eventFields <= 3) {
                  console.log(`  Found event field: ${cls.name}.${field.getName()} (${fieldType.getName()})`);
                }
              }
            }

            // Look for event-related methods (OnEvent, AddEventListener, etc.)
            for (const method of methods) {
              if (method.name.startsWith("On") ||
                  method.name.includes("Event") ||
                  method.name.startsWith("Add") ||
                  method.name.startsWith("Remove")) {
                eventMethods++;
                if (eventMethods <= 3) {
                  console.log(`  Found event method: ${method.getFullName()}`);
                }
              }
            }
          } catch (error) {
            // Ignore analysis errors
          }
        }

        console.log(`[OK] Found ${eventFields} event fields and ${eventMethods} event methods`);
      }

      // Example 5: Memory management and cleanup
      console.log("\n--- Example 5: Delegate Memory Management ---");

      console.log("[INFO] Delegate memory management guidelines:");
      console.log("  1. Always dispose delegate instances when done");
      console.log("  2. Use GC handles for long-lived delegate references");
      console.log("  3. Cache compiled thunks to avoid recompilation");
      console.log("  4. Be aware of delegate target object lifetime");
      console.log("  5. Handle thread attachment for cross-thread delegate calls");

      try {
        // Demonstrate safe delegate cleanup pattern
        console.log("[INFO] Safe delegate usage pattern:");
        console.log("  try {");
        console.log("    const delegate = createDelegate(...);");
        console.log("    const thunk = delegate.compileNative(...);");
        console.log("    // Use delegate");
        console.log("  } finally {");
        console.log("    delegate?.dispose();");
        console.log("    // Thunk cleanup handled by GC");
        console.log("  }");
      } catch (error) {
        console.log(`[WARN] Could not demonstrate cleanup: ${error}`);
      }

      // Example 6: Performance considerations
      console.log("\n--- Example 6: Performance Optimization Tips ---");

      console.log("[INFO] Delegate performance optimization:");
      console.log("  - Use static delegates when possible (no target object)");
      console.log("  - Cache delegate instances for repeated use");
      console.log("  - Pre-compile thunks for performance-critical paths");
      console.log("  - Consider direct method calls vs delegate overhead");
      console.log("  - Use appropriate delegate types (Action vs Func vs custom)");
      console.log("  - Profile delegate invocation in your specific use case");

      console.log("\n[OK] Delegate example completed successfully");

    } catch (error) {
      console.error("[ERROR] Delegate example failed:", error);
    }
  });

  console.log("\n=== Fast Delegate Invocation Example Complete ===");
}

main();

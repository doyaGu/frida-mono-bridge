/**
 * Assembly Discovery and Analysis Example
 *
 * This example demonstrates how to discover, analyze, and dump information about
 * loaded assemblies in a Unity game or Mono application.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Assembly Discovery and Analysis Example ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Get all loaded assemblies
      const assemblies = domain.assemblies;
      console.log(`\n[OK] Found ${assemblies.length} loaded assemblies:`);

      // Example 1: Basic assembly information
      console.log("\n--- Example 1: Assembly Overview ---");
      const assemblyInfo: Array<{name: string, version: string, classes: number}> = [];

      for (const assembly of assemblies) {
        try {
          const name = assembly.name;
          const image = assembly.image;
          const classCount = image.classes.length;

          assemblyInfo.push({
            name,
            version: assembly.getVersion().toString(),
            classes: classCount
          });

          console.log(`  ${name}: ${classCount} classes`);
        } catch (error) {
          console.log(`  [ERROR] Failed to analyze assembly: ${error}`);
        }
      }

      // Example 2: Find and analyze Unity assemblies
      console.log("\n--- Example 2: Unity Assemblies Analysis ---");
      const unityAssemblies = assemblies.filter(asm =>
        asm.name.startsWith("UnityEngine.") ||
        asm.name.startsWith("Unity.") ||
        asm.name.includes("Assembly-CSharp")
      );

      console.log(`[OK] Found ${unityAssemblies.length} Unity-related assemblies:`);

      for (const assembly of unityAssemblies) {
        console.log(`\n  Assembly: ${assembly.name}`);
        try {
          const image = assembly.image;
          const classes = image.classes;

          // Find interesting classes
          const managerClasses = classes.filter(cls =>
            cls.name.includes("Manager") ||
            cls.name.includes("Controller") ||
            cls.name.includes("System")
          );

          const monoBehaviourClasses = classes.filter(cls => {
            try {
              const baseClass = cls.parent;
              return baseClass?.name === "MonoBehaviour";
            } catch {
              return false;
            }
          });

          console.log(`    Total classes: ${classes.length}`);
          console.log(`    Manager/Controller classes: ${managerClasses.length}`);
          console.log(`    MonoBehaviour classes: ${monoBehaviourClasses.length}`);

          // Show some interesting class names
          if (managerClasses.length > 0) {
            console.log("    Sample manager classes:");
            for (const cls of managerClasses.slice(0, 3)) {
              console.log(`      - ${cls.namespace}.${cls.name}`);
            }
            if (managerClasses.length > 3) {
              console.log(`      ... and ${managerClasses.length - 3} more`);
            }
          }

        } catch (error) {
          console.log(`    [ERROR] Failed to analyze ${assembly.name}: ${error}`);
        }
      }

      // Example 3: Deep dive into main game assembly
      console.log("\n--- Example 3: Main Game Assembly Analysis ---");
      const gameAssembly = assemblies.find(asm => asm.name === "Assembly-CSharp");

      if (gameAssembly) {
        console.log(`[OK] Found main game assembly: ${gameAssembly.name}`);
        try {
          const image = gameAssembly.image;
          const classes = image.classes;

          // Group classes by namespace
          const namespaceMap = new Map<string, Array<any>>();

          for (const cls of classes) {
            const ns = cls.namespace || "<global>";
            if (!namespaceMap.has(ns)) {
              namespaceMap.set(ns, []);
            }
            namespaceMap.get(ns)!.push(cls);
          }

          // Sort namespaces by class count
          const sortedNamespaces = Array.from(namespaceMap.entries())
            .sort((a, b) => b[1].length - a[1].length);

          console.log(`[OK] Found ${sortedNamespaces.length} namespaces:`);

          for (const [namespace, classList] of sortedNamespaces.slice(0, 10)) {
            console.log(`  ${namespace}: ${classList.length} classes`);

            // Find interesting patterns in this namespace
            const staticClasses = classList.filter(cls =>
              cls.methods.some((method: any) => method.isStatic())
            );

            const singletonClasses = classList.filter(cls =>
              cls.name.includes("Instance") ||
              cls.methods.some((method: any) =>
                method.name === "GetInstance" ||
                method.name === "instance" ||
                method.name === "Instance"
              )
            );

            if (staticClasses.length > 0) {
              console.log(`    ${staticClasses.length} classes with static methods`);
            }
            if (singletonClasses.length > 0) {
              console.log(`    ${singletonClasses.length} potential singleton classes`);
            }
          }

          // Example 4: Find classes with specific characteristics
          console.log("\n--- Example 4: Special Class Discovery ---");

          // Find classes with many methods (likely complex systems)
          const complexClasses = classes
            .map(cls => ({ cls, methodCount: cls.methods.length }))
            .filter(item => item.methodCount > 20)
            .sort((a, b) => b.methodCount - a.methodCount);

          if (complexClasses.length > 0) {
            console.log(`[OK] Found ${complexClasses.length} complex classes (>20 methods):`);
            for (const { cls, methodCount } of complexClasses.slice(0, 5)) {
              console.log(`  ${cls.namespace}.${cls.name}: ${methodCount} methods`);
            }
          }

          // Find classes that inherit from specific Unity types
          const componentClasses = classes.filter(cls => {
            try {
              let current = cls.parent;
              while (current) {
                if (current.name === "MonoBehaviour" ||
                    current.name === "ScriptableObject" ||
                    current.name === "Component") {
                  return true;
                }
                current = current.parent;
              }
            } catch {
              return false;
            }
            return false;
          });

          console.log(`[OK] Found ${componentClasses.length} Unity component classes`);

          // Example 5: Method analysis
          console.log("\n--- Example 5: Method Analysis ---");

          let totalMethods = 0;
          let staticMethods = 0;
          let publicMethods = 0;

          const methodTypeMap = new Map<string, number>();

          for (const cls of classes.slice(0, 20)) { // Limit for performance
            const methods = cls.methods;
            totalMethods += methods.length;

            for (const method of methods) {
              if (method.isStatic()) staticMethods++;
              if (method.getAccessibility() === "public") publicMethods++;

              const returnType = method.getReturnType()?.getName() || "void";
              methodTypeMap.set(returnType, (methodTypeMap.get(returnType) || 0) + 1);
            }
          }

          console.log(`[OK] Method analysis (first 20 classes):`);
          console.log(`  Total methods: ${totalMethods}`);
          console.log(`  Static methods: ${staticMethods} (${((staticMethods/totalMethods)*100).toFixed(1)}%)`);
          console.log(`  Public methods: ${publicMethods} (${((publicMethods/totalMethods)*100).toFixed(1)}%)`);

          console.log("  Common return types:");
          const sortedReturnTypes = Array.from(methodTypeMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          for (const [type, count] of sortedReturnTypes) {
            console.log(`    ${type}: ${count} methods`);
          }

        } catch (error) {
          console.error(`[ERROR] Failed to analyze game assembly: ${error}`);
        }
      } else {
        console.log("[WARN] Assembly-CSharp not found - this might not be a Unity game");
      }

      // Example 6: Assembly memory information
      console.log("\n--- Example 6: Assembly Memory Information ---");

      for (const assembly of assemblies.slice(0, 5)) {
        try {
          const image = assembly.image;
          console.log(`\n  ${assembly.name}:`);
          console.log(`    Image pointer: ${image.pointer}`);
          console.log(`    Classes: ${image.classes.length}`);

          // Try to get assembly location if available
          try {
            const location = assembly.getLocation();
            if (location) {
              console.log(`    Location: ${location}`);
            }
          } catch {
            console.log(`    Location: Not available`);
          }
        } catch (error) {
          console.log(`    [ERROR] Failed to get memory info: ${error}`);
        }
      }

    } catch (error) {
      console.error("[ERROR] Assembly analysis failed:", error);
    }
  });

  console.log("\n=== Assembly Discovery and Analysis Example Complete ===");
}

main();

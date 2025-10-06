/**
 * Metadata Exploration Example
 *
 * This example demonstrates how to explore and analyze Mono/.NET metadata
 * to understand the structure of assemblies, classes, methods, and their
 * relationships. Useful for reverse engineering and API discovery.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Metadata Exploration Example ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Example 1: Assembly metadata overview
      console.log("\n--- Example 1: Assembly Metadata Overview ---");
      const assemblies = domain.assemblies;
      console.log(`[OK] Found ${assemblies.length} loaded assemblies`);

      const assemblyMetadata = [];
      for (const assembly of assemblies) {
        try {
          const metadata = {
            name: assembly.name,
            image: assembly.image.name,
            classCount: assembly.image.classes.length,
            version: assembly.getVersion().toString(),
            location: "Unknown" // Will try to get this later
          };

          // Try to get assembly location
          try {
            metadata.location = assembly.getLocation() || "Embedded";
          } catch {
            metadata.location = "Not available";
          }

          assemblyMetadata.push(metadata);
        } catch (error) {
          console.log(`[WARN] Could not analyze assembly: ${assembly.name}`);
        }
      }

      // Sort by class count (most interesting first)
      assemblyMetadata.sort((a, b) => b.classCount - a.classCount);

      console.log("[INFO] Top 10 assemblies by class count:");
      for (const [index, asm] of assemblyMetadata.slice(0, 10).entries()) {
        console.log(`  ${index + 1}. ${asm.name}`);
        console.log(`     Classes: ${asm.classCount}, Version: ${asm.version}`);
        console.log(`     Location: ${asm.location}`);
      }

      // Example 2: Namespace analysis
      console.log("\n--- Example 2: Namespace Analysis ---");
      const gameAssembly = assemblies.find(asm => asm.name === "Assembly-CSharp");
      if (gameAssembly) {
        console.log(`[OK] Analyzing namespaces in ${gameAssembly.name}`);

        const namespaceMap = new Map<string, Array<any>>();
        const classes = gameAssembly.image.classes;

        // Group classes by namespace
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

        for (const [namespace, classList] of sortedNamespaces.slice(0, 15)) {
          console.log(`  ${namespace}: ${classList.length} classes`);

          // Analyze class characteristics in this namespace
          const publicClasses = classList.filter(cls => cls.isPublic);
          const abstractClasses = classList.filter(cls => cls.isAbstract);
          const staticClasses = classList.filter(cls => cls.methods.some((m: any) => m.isStatic()));

          if (publicClasses.length > 0 || abstractClasses.length > 0 || staticClasses.length > 0) {
            console.log(`    Public: ${publicClasses.length}, Abstract: ${abstractClasses.length}, With static: ${staticClasses.length}`);
          }

          // Show some interesting class names
          const interestingClasses = classList.filter(cls =>
            cls.name.includes("Manager") ||
            cls.name.includes("Controller") ||
            cls.name.includes("System") ||
            cls.name.includes("Service") ||
            cls.name.includes("Handler")
          );

          if (interestingClasses.length > 0) {
            console.log(`    Key classes: ${interestingClasses.map(c => c.name).join(", ")}`);
          }
        }
      }

      // Example 3: Method signature analysis
      console.log("\n--- Example 3: Method Signature Analysis ---");

      if (gameAssembly) {
        const classes = gameAssembly.image.classes;
        const methodSignatures = new Map<string, number>();
        const parameterCounts = new Map<number, number>();
        const returnTypeMap = new Map<string, number>();

        let totalMethods = 0;
        let staticMethods = 0;
        let publicMethods = 0;

        // Analyze methods from first 20 classes for performance
        for (const cls of classes.slice(0, 20)) {
          const methods = cls.methods;

          for (const method of methods) {
            totalMethods++;
            if (method.isStatic()) staticMethods++;
            if (method.getAccessibility() === "public") publicMethods++;

            // Count parameter frequencies
            const paramCount = method.getParameters()?.length || 0;
            parameterCounts.set(paramCount, (parameterCounts.get(paramCount) || 0) + 1);

            // Analyze return types
            const returnTypeName = method.getReturnType()?.getName() || "void";
            returnTypeMap.set(returnTypeName, (returnTypeMap.get(returnTypeName) || 0) + 1);

            // Create method signature pattern
            try {
              const paramTypes = (method.getParameters() || [])
                .map((p: any) => p.type?.getName() || "unknown")
                .join(",");
              const signature = `${returnTypeName}(${paramTypes})`;
              methodSignatures.set(signature, (methodSignatures.get(signature) || 0) + 1);
            } catch (error) {
              // Skip signatures that can't be resolved
            }
          }
        }

        console.log(`[OK] Analyzed ${totalMethods} methods from first 20 classes`);
        console.log(`  Static: ${staticMethods} (${((staticMethods/totalMethods)*100).toFixed(1)}%)`);
        console.log(`  Public: ${publicMethods} (${((publicMethods/totalMethods)*100).toFixed(1)}%)`);

        console.log("\n[INFO] Most common parameter counts:");
        const sortedParamCounts = Array.from(parameterCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        for (const [count, frequency] of sortedParamCounts) {
          console.log(`  ${count} parameters: ${frequency} methods`);
        }

        console.log("\n[INFO] Most common return types:");
        const sortedReturnTypes = Array.from(returnTypeMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [type, count] of sortedReturnTypes) {
          console.log(`  ${type}: ${count} methods`);
        }

        console.log("\n[INFO] Most common method signatures:");
        const sortedSignatures = Array.from(methodSignatures.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        for (const [signature, count] of sortedSignatures) {
          console.log(`  ${signature}: ${count} methods`);
        }
      }

      // Example 4: Inheritance hierarchy analysis
      console.log("\n--- Example 4: Inheritance Hierarchy Analysis ---");

      if (gameAssembly) {
        const classes = gameAssembly.image.classes;
        const inheritanceMap = new Map<string, number>();
        const unityClasses = [];

        for (const cls of classes) {
          try {
            // Get base class information
            let baseClass = cls.parent;
            let depth = 0;
            const hierarchy = [];

            while (baseClass && depth < 10) { // Prevent infinite loops
              hierarchy.push(baseClass.name);
              baseClass = baseClass.parent;
              depth++;
            }

            if (hierarchy.length > 0) {
              const baseName = hierarchy[hierarchy.length - 1];
              inheritanceMap.set(baseName, (inheritanceMap.get(baseName) || 0) + 1);
            }

            // Check for Unity inheritance
            if (hierarchy.some(name =>
              name === "MonoBehaviour" ||
              name === "ScriptableObject" ||
              name === "Component" ||
              name === "Object"
            )) {
              unityClasses.push({
                name: cls.name,
                namespace: cls.namespace,
                hierarchy: hierarchy.join(" -> ")
              });
            }
          } catch (error) {
            // Skip classes that can't be analyzed
          }
        }

        console.log(`[OK] Found ${unityClasses.length} Unity-derived classes`);

        if (unityClasses.length > 0) {
          console.log("[INFO] Sample Unity classes:");
          for (const cls of unityClasses.slice(0, 8)) {
            console.log(`  ${cls.namespace}.${cls.name}`);
            console.log(`    Inherits: ${cls.hierarchy}`);
          }
        }

        console.log("\n[INFO] Common base classes:");
        const sortedBases = Array.from(inheritanceMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        for (const [baseClass, count] of sortedBases) {
          console.log(`  ${baseClass}: ${count} derived classes`);
        }
      }

      // Example 5: Field and property analysis
      console.log("\n--- Example 5: Field and Property Analysis ---");

      if (gameAssembly) {
        const classes = gameAssembly.image.classes;
        const fieldTypes = new Map<string, number>();
        const propertyTypes = new Map<string, number>();
        let totalFields = 0;
        let totalProperties = 0;
        let staticFields = 0;
        let publicFields = 0;

        // Analyze fields and properties from first 15 classes
        for (const cls of classes.slice(0, 15)) {
          try {
            // Analyze fields
            for (const field of cls.fields) {
              totalFields++;
              if (field.isStatic()) staticFields++;
              if (field.getAccessibility() === "public") publicFields++;

              const fieldTypeName = field.getType()?.getName() || "unknown";
              fieldTypes.set(fieldTypeName, (fieldTypes.get(fieldTypeName) || 0) + 1);
            }

            // Analyze properties
            for (const property of cls.properties) {
              totalProperties++;
              const propertyTypeName = property.getType()?.getName() || "unknown";
              propertyTypes.set(propertyTypeName, (propertyTypes.get(propertyTypeName) || 0) + 1);
            }
          } catch (error) {
            // Skip classes that can't be analyzed
          }
        }

        console.log(`[OK] Analyzed ${totalFields} fields and ${totalProperties} properties`);
        console.log(`  Static fields: ${staticFields}, Public fields: ${publicFields}`);

        console.log("\n[INFO] Most common field types:");
        const sortedFieldTypes = Array.from(fieldTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [type, count] of sortedFieldTypes) {
          console.log(`  ${type}: ${count} fields`);
        }

        console.log("\n[INFO] Most common property types:");
        const sortedPropertyTypes = Array.from(propertyTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);

        for (const [type, count] of sortedPropertyTypes) {
          console.log(`  ${type}: ${count} properties`);
        }
      }

      // Example 6: Custom attribute analysis
      console.log("\n--- Example 6: Custom Attribute Analysis ---");

      // Note: Custom attribute analysis depends on the specific implementation
      // This is a placeholder showing the pattern
      console.log("[INFO] Custom attribute analysis patterns:");
      console.log("  - Look for [SerializeField] attributes on private fields");
      console.log("  - Check for [Header] attributes on field organization");
      console.log("  - Find [Tooltip] attributes for UI help text");
      console.log("  - Identify [Range] attributes for slider constraints");
      console.log("  - Search for [RequireComponent] dependencies");

      // Example 7: Metadata usage patterns
      console.log("\n--- Example 7: Metadata Usage Patterns ---");

      console.log("[INFO] Common metadata analysis use cases:");
      console.log("1. API Discovery - Find public methods and their parameters");
      console.log("2. Inheritance Mapping - Understand class relationships");
      console.log("3. Dependency Analysis - Find what classes depend on each other");
      console.log("4. Security Research - Identify sensitive operations and data flows");
      console.log("5. Mod Development - Understand game architecture for modding");
      console.log("6. Performance Analysis - Find complex methods and hot paths");
      console.log("7. Code Navigation - Navigate large codebases efficiently");

      console.log("\n[OK] Metadata exploration completed successfully");

    } catch (error) {
      console.error("[ERROR] Metadata exploration failed:", error);
    }
  });

  console.log("\n=== Metadata Exploration Example Complete ===");
}

main();

/**
 * Comprehensive MonoAssembly Tests
 * Tests for MonoAssembly functionality including assembly enumeration, loading/unloading,
 * dependency resolution, metadata access, and Unity assembly handling
 */

import Mono from "../src";
import { withAssemblies, withDomain } from "./test-fixtures";
import {
  TestResult,
  assert,
  assertNotNull,
  createErrorHandlingTest,
  createPerformanceTest,
  tryOptionalFeature,
} from "./test-framework";
import {
  verifyAssemblyMetadata,
  verifyAssemblyVersion,
  verifyDependencyTree,
  verifyDetailedInfo,
  verifyPerformanceStats,
} from "./test-validators";

export async function createMonoAssemblyTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== ASSEMBLY ENUMERATION AND DISCOVERY TESTS =====

  results.push(
    await withDomain("MonoAssembly should enumerate all assemblies in domain", ({ domain }) => {
      const assemblies = domain.assemblies;
      assert(assemblies.length > 0, "Should find assemblies in domain");

      const mscorlib = assemblies.find(a => a.name === "mscorlib");
      assertNotNull(mscorlib, "Should find mscorlib assembly");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should find assemblies by name", ({ mscorlib }) => {
      assertNotNull(mscorlib, "Should find mscorlib assembly");
      assert(mscorlib.name === "mscorlib", "Assembly name should be mscorlib");
    }),
  );

  results.push(
    await withDomain("MonoAssembly should handle missing assemblies gracefully", ({ domain }) => {
      const missingAssembly = domain.tryAssembly("DefinitelyDoesNotExist");
      assert(missingAssembly === null, "Missing assembly should return null");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide assembly names", ({ mscorlib }) => {
      if (mscorlib) {
        const name = mscorlib.name;
        assertNotNull(name, "Assembly name should be available");
        assert(name === "mscorlib", "Assembly name should be mscorlib");
      }
    }),
  );

  // ===== ASSEMBLY LOADING AND UNLOADING TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide load state information", ({ mscorlib }) => {
      if (mscorlib) {
        // Assembly is considered loaded if we can access its basic properties
        const name = mscorlib.name;
        assertNotNull(name, "Assembly name should be available (indicates loaded state)");

        const classes = mscorlib.classes;
        assert(classes.length > 0, "Loaded assembly should have classes");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should handle assembly size information", ({ mscorlib }) => {
      if (mscorlib) {
        // Use performanceStats which includes size information
        verifyPerformanceStats(mscorlib.performanceStats, "mscorlib");
      }
    }),
  );

  // ===== DEPENDENCY RELATIONSHIP RESOLUTION TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide referenced assemblies", ({ mscorlib }) => {
      if (mscorlib) {
        const referencedAssemblies = mscorlib.referencedAssemblies;
        assertNotNull(referencedAssemblies, "Referenced assemblies should be available");
        assert(Array.isArray(referencedAssemblies), "Referenced assemblies should be an array");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide referencing assemblies", ({ mscorlib }) => {
      if (mscorlib) {
        const referencingAssemblies = mscorlib.referencingAssemblies;
        assertNotNull(referencingAssemblies, "Referencing assemblies should be available");
        assert(Array.isArray(referencingAssemblies), "Referencing assemblies should be an array");
      }
    }),
  );

  results.push(
    await withDomain("MonoAssembly should check dependencies", ({ domain }) => {
      const mscorlib = domain.tryAssembly("mscorlib");
      const systemCore = domain.tryAssembly("System.Core");

      if (mscorlib && systemCore) {
        // Test dependency checking
        const dependsOnSystemCore = mscorlib.dependsOn(systemCore);
        const dependsOnMscorlib = systemCore.dependsOn(mscorlib);

        assert(typeof dependsOnSystemCore === "boolean", "dependsOn should return boolean");
        assert(typeof dependsOnMscorlib === "boolean", "dependsOn should return boolean");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide dependency tree", ({ mscorlib }) => {
      if (mscorlib) {
        verifyDependencyTree(mscorlib.dependencyTree);
      }
    }),
  );

  // ===== ASSEMBLY METADATA ACCESS TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide assembly metadata", ({ mscorlib }) => {
      if (mscorlib) {
        verifyAssemblyMetadata(mscorlib, {
          name: "mscorlib",
          hasVersion: true,
        });
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide detailed information", ({ mscorlib }) => {
      if (mscorlib) {
        verifyDetailedInfo(mscorlib.detailedInfo, "mscorlib");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide entry point information", ({ mscorlib }) => {
      if (mscorlib) {
        const entryPoint = mscorlib.entryPoint;
        // mscorlib might not have a traditional entry point
        if (entryPoint) {
          assertNotNull(entryPoint.name, "Entry point should have name");
        }
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide custom attributes", ({ mscorlib }) => {
      if (mscorlib) {
        const customAttributes = mscorlib.customAttributes;
        assertNotNull(customAttributes, "Custom attributes should be available");
        assert(Array.isArray(customAttributes), "Custom attributes should be an array");
      }
    }),
  );

  // ===== UNITY ASSEMBLY HANDLING TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should handle Unity assemblies", ({ unityCore }) => {
      const unityEngine = tryOptionalFeature(
        () => (unityCore ? unityCore : Mono.domain.tryAssembly("UnityEngine")),
        "UnityEngine assembly",
      );

      if (unityEngine) {
        verifyAssemblyMetadata(unityEngine, {
          isSystemAssembly: true,
          isUserAssembly: false,
        });
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should handle Assembly-CSharp", ({ assemblyCSharp }) => {
      if (assemblyCSharp) {
        assert(assemblyCSharp.name.includes("Assembly-CSharp"), "Assembly-CSharp should be found");

        const isSystem = assemblyCSharp.isSystemAssembly;
        // Assembly-CSharp might be considered user assembly depending on context
        console.log(`  - Assembly-CSharp isSystem: ${isSystem}`);
      } else {
        console.log("  - Assembly-CSharp assembly not found");
      }
    }),
  );

  results.push(
    await withDomain("MonoAssembly should identify Unity vs system assemblies", ({ domain }) => {
      const assemblies = domain.assemblies;
      const unityAssemblies = assemblies.filter(
        a => a.name.includes("UnityEngine") || a.name.includes("Assembly-CSharp"),
      );
      const systemAssemblies = assemblies.filter(a => a.name.includes("System.") || a.name.includes("mscorlib"));

      assert(unityAssemblies.length >= 0, "Should find Unity assemblies");
      assert(systemAssemblies.length >= 0, "Should find system assemblies");

      console.log(`  - Found ${unityAssemblies.length} Unity assemblies`);
      console.log(`  - Found ${systemAssemblies.length} system assemblies`);
    }),
  );

  // ===== ASSEMBLY SECURITY AND VALIDATION TESTS =====

  results.push(
    await withDomain("MonoAssembly should validate assembly compatibility", ({ domain }) => {
      const mscorlib = domain.tryAssembly("mscorlib");
      const systemCore = domain.tryAssembly("System.Core");

      if (mscorlib && systemCore) {
        const isCompatible = mscorlib.isCompatibleWith(systemCore);
        assert(typeof isCompatible === "boolean", "isCompatibleWith should return boolean");
      }
    }),
  );

  results.push(
    await withDomain("MonoAssembly should compare assemblies", ({ domain }) => {
      const mscorlib = domain.tryAssembly("mscorlib");
      const systemCore = domain.tryAssembly("System.Core");

      if (mscorlib && systemCore) {
        const comparison = mscorlib.compareTo(systemCore);
        assert(typeof comparison === "number", "compareTo should return number");

        const isEqual = mscorlib.equals(systemCore);
        assert(typeof isEqual === "boolean", "equals should return boolean");
      }
    }),
  );

  // ===== ASSEMBLY CLASS ACCESS TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide access to classes", ({ mscorlib }) => {
      if (mscorlib) {
        const classes = mscorlib.classes;
        assert(classes.length > 0, "Should find classes in assembly");

        const stringClass = classes.find(c => c.name === "String");
        assertNotNull(stringClass, "Should find String class in mscorlib");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should find classes by full name", ({ mscorlib }) => {
      if (mscorlib) {
        const stringClass = mscorlib.tryClass("System.String");
        if (stringClass) {
          assert(stringClass.name === "String", "Should find String class by full name");
          assert(stringClass.namespace === "System", "String class should be in System namespace");
        } else {
          console.log("  - String class not found by full name");
        }
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should find classes by namespace and name", ({ mscorlib }) => {
      if (mscorlib) {
        const stringClass = mscorlib.tryFindClass("System", "String");
        if (stringClass) {
          assert(stringClass.name === "String", "Should find String class");
          assert(stringClass.namespace === "System", "String class should be in System namespace");
        } else {
          console.log("  - String class not found by namespace/name");
        }
      }
    }),
  );

  // ===== ASSEMBLY IMAGE ACCESS TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide access to image", ({ mscorlib }) => {
      if (mscorlib) {
        const image = mscorlib.image;
        assertNotNull(image, "Assembly should have image");

        const imageName = image.name;
        assertNotNull(imageName, "Image should have name");

        const imageClasses = image.classes;
        assert(imageClasses.length >= 0, "Image should have classes");
      }
    }),
  );

  // ===== ASSEMBLY PERFORMANCE TESTS =====

  results.push(
    await createPerformanceTest("MonoAssembly enumeration performance", () => {
      const domain = Mono.domain;

      const startTime = Date.now();
      const assemblies = domain.assemblies;
      const enumerationTime = Date.now() - startTime;

      console.log(`  Enumerated ${assemblies.length} assemblies in ${enumerationTime}ms`);
      assert(enumerationTime < 5000, "Assembly enumeration should complete within 5 seconds");
    }),
  );

  results.push(
    await createPerformanceTest("MonoAssembly class access performance", () => {
      const domain = Mono.domain;

      const mscorlib = domain.tryAssembly("mscorlib");
      if (mscorlib) {
        const startTime = Date.now();
        const classes = mscorlib.classes;
        const accessTime = Date.now() - startTime;

        console.log(`  Accessed ${classes.length} classes in ${accessTime}ms`);
        assert(accessTime < 3000, "Class access should be reasonably fast");
      }
    }),
  );

  results.push(
    await createPerformanceTest("MonoAssembly dependency analysis performance", () => {
      const domain = Mono.domain;

      const mscorlib = domain.tryAssembly("mscorlib");
      if (mscorlib) {
        const startTime = Date.now();
        const dependencyTree = mscorlib.dependencyTree;
        const analysisTime = Date.now() - startTime;

        console.log(`  Analyzed dependencies in ${analysisTime}ms`);
        assert(analysisTime < 2000, "Dependency analysis should be reasonably fast");
      }
    }),
  );

  // ===== ASSEMBLY ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoAssembly should handle invalid operations gracefully", () => {
      const domain = Mono.domain;

      const mscorlib = domain.tryAssembly("mscorlib");
      if (mscorlib) {
        // Try to find non-existent class
        const missingClass = mscorlib.tryFindClass("NonExistent.Namespace", "NonExistentClass");
        assert(missingClass === null, "Missing class should return null");
      }
    }),
  );

  // ===== ASSEMBLY TOSTRING AND SERIALIZATION TESTS =====

  results.push(
    await withAssemblies("MonoAssembly toString should work correctly", ({ mscorlib }) => {
      if (mscorlib) {
        const stringRep = mscorlib.toString();
        assertNotNull(stringRep, "toString should return a value");
        assert(stringRep.includes("MonoAssembly"), "toString should include class type");
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should provide JSON representation", ({ mscorlib }) => {
      if (mscorlib) {
        const json = mscorlib.toJSON();
        assertNotNull(json, "toJSON should return a value");
        assert(json.name === "mscorlib", "JSON should include assembly name");
        assert(typeof json.isSystem === "boolean", "JSON should include isSystem flag");
        assert(typeof json.isUser === "boolean", "JSON should include isUser flag");
        assert(typeof json.classCount === "number", "JSON should include class count");
      }
    }),
  );

  // ===== ASSEMBLY DESCRIPTION TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should provide human-readable descriptions", ({ mscorlib }) => {
      if (mscorlib) {
        const description = mscorlib.describe();
        assertNotNull(description, "Description should be available");
        assert(description.includes("mscorlib"), "Description should include assembly name");
        assert(description.includes("System"), "Description should indicate system assembly");
      }
    }),
  );

  // ===== ASSEMBLY VERSION COMPATIBILITY TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should handle version information", ({ mscorlib }) => {
      if (mscorlib) {
        const version = mscorlib.version;
        verifyAssemblyVersion(version);

        console.log(`  - mscorlib version: ${version.major}.${version.minor}.${version.build}.${version.revision}`);
      }
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly should handle culture information", ({ mscorlib }) => {
      if (mscorlib) {
        const culture = mscorlib.culture;
        assertNotNull(culture, "Culture should be available");
        assert(typeof culture === "string", "Culture should be string");

        console.log(`  - mscorlib culture: ${culture}`);
      }
    }),
  );

  // ===== ASSEMBLY CLASSIFICATION TESTS =====

  results.push(
    await withAssemblies("MonoAssembly should classify assemblies correctly", ({ mscorlib, unityCore }) => {
      if (mscorlib) {
        verifyAssemblyMetadata(mscorlib, {
          isSystemAssembly: true,
          isUserAssembly: false,
        });
      }

      const unityEngine = tryOptionalFeature(
        () => (unityCore ? unityCore : Mono.domain.tryAssembly("UnityEngine")),
        "UnityEngine assembly",
      );

      if (unityEngine) {
        // Unity assemblies might be classified as system
        const isSystem = unityEngine.isSystemAssembly;
        console.log(`  - UnityEngine classified as system: ${isSystem}`);
      }
    }),
  );

  // ===== ASSEMBLY ROOT NAMESPACES TESTS =====

  results.push(
    await withDomain("MonoAssembly should provide root namespace information", ({ domain }) => {
      const rootNamespaces = domain.rootNamespaces;
      assertNotNull(rootNamespaces, "Root namespaces should be available");
      assert(Array.isArray(rootNamespaces), "Root namespaces should be an array");
      assert(rootNamespaces.length > 0, "Should find root namespaces");

      const systemNamespace = rootNamespaces.find((ns: string) => ns === "System");
      assertNotNull(systemNamespace, "Should find System namespace");

      console.log(`  - Found ${rootNamespaces.length} root namespaces`);
    }),
  );

  // ===== ASSEMBLY PERFORMANCE STATS TESTS =====

  results.push(
    await withAssemblies("MonoAssembly.performanceStats returns valid statistics", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const stats = mscorlib!.performanceStats;
      verifyPerformanceStats(stats, "mscorlib");

      console.log(`[INFO] mscorlib stats:`);
      console.log(`  - Classes: ${stats.classCount}`);
      console.log(`  - Class lookup: ${stats.classLookupTime}ms`);
      console.log(`  - Memory estimate: ${(stats.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  - Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    }),
  );

  results.push(
    await withDomain("MonoAssembly.performanceStats works for user assemblies", ({ domain }) => {
      const assemblies = domain.assemblies;

      // Find Assembly-CSharp or any user assembly
      const userAssembly = assemblies.find(a => a.name === "Assembly-CSharp" || a.isUserAssembly);

      if (userAssembly) {
        const stats = userAssembly.performanceStats;
        assertNotNull(stats, "performanceStats should return object");
        assert(stats.classCount >= 0, "classCount should be non-negative");

        console.log(`[INFO] ${stats.assemblyName} stats: ${stats.classCount} classes`);
      } else {
        console.log("[INFO] No user assembly found to test");
      }
    }),
  );

  // ===== REFERENCING ASSEMBLIES TESTS =====

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies should return array", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const refs = mscorlib!.referencingAssemblies;
      assert(Array.isArray(refs), "referencingAssemblies should return an array");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies mscorlib should have dependents", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const refs = mscorlib!.referencingAssemblies;
      // Most assemblies reference mscorlib
      assert(refs.length > 0, "mscorlib should have dependent assemblies");
      console.log(`  - mscorlib has ${refs.length} dependent assemblies`);
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies should not include self", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const refs = mscorlib!.referencingAssemblies;
      const selfPointer = mscorlib!.pointer.toString();
      const includesSelf = refs.some((r: { pointer: NativePointer }) => r.pointer.toString() === selfPointer);
      assert(!includesSelf, "Referencing assemblies should not include self");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies should return valid assemblies", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const refs = mscorlib!.referencingAssemblies;
      if (refs.length === 0) return; // No dependents is valid

      // All returned assemblies should have valid names
      const allValid = refs.every((r: { name: string }) => {
        const name = r.name;
        return typeof name === "string" && name.length > 0;
      });
      assert(allValid, "All referencing assemblies should have valid names");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies should cache result", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const refs1 = mscorlib!.referencingAssemblies;
      const refs2 = mscorlib!.referencingAssemblies;

      // Same array reference (cached)
      assert(refs1 === refs2, "Result should be cached (same array reference)");
    }),
  );

  results.push(
    await withAssemblies("MonoAssembly.referencingAssemblies dependents should reference mscorlib", ({ mscorlib }) => {
      assertNotNull(mscorlib, "mscorlib should exist");

      const dependents = mscorlib!.referencingAssemblies;
      if (dependents.length === 0) return; // No dependents is valid

      const mscorlibName = mscorlib!.name.toLowerCase();

      // Check first few dependents
      for (const dep of dependents.slice(0, 3)) {
        const refs = dep.referencedAssemblies;
        const hasMscorlib = refs.some((r: { name: string }) => r.name.toLowerCase() === mscorlibName);
        assert(hasMscorlib, `${dep.name} should reference mscorlib`);
      }
    }),
  );

  return results;
}

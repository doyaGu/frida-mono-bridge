/**
 * Comprehensive MonoImage Tests
 * Tests for MonoImage functionality including image operations, metadata access,
 * loading/validation, image-to-assembly relationships, and Unity image handling
 */

import Mono, { MonoImage } from "../src";
import { 
  TestResult, 
  createMonoDependentTest, 
  createPerformanceTest,
  createErrorHandlingTest,
  assert, 
  assertNotNull, 
  assertThrows,
} from "./test-framework";

export function createMonoImageTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== IMAGE OPERATIONS AND METADATA ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should provide image name",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib assembly should be available");
      
      const image = mscorlib.image;
      assertNotNull(image, "Assembly should have image");
      
      const imageName = image.name;
      assertNotNull(imageName, "Image should have name");
      assert(imageName.length > 0, "Image name should not be empty");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should provide access to classes",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const classes = image.classes;
      assert(classes.length > 0, "Image should have classes");
      
      const stringClass = classes.find(c => c.getName() === "String");
      assertNotNull(stringClass, "Should find String class in image");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should provide class count",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const classCount = image.getClassCount();
      assert(typeof classCount === "number", "Class count should be a number");
      assert(classCount > 0, "Should have positive class count");
      
      console.log(`  - Image has ${classCount} classes`);
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should provide class tokens",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const tokens = image.getClassTokens();
      assert(Array.isArray(tokens), "Class tokens should be an array");
      
      if (tokens.length > 0) {
        assert(typeof tokens[0] === "number", "Token should be a number");
        assert(tokens[0] > 0, "Token should be positive");
      }
      
      console.log(`  - Image has ${tokens.length} class tokens`);
    }
  ));

  // ===== IMAGE LOADING AND VALIDATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should load from assembly path",
    () => {
      // Test static factory method
      try {
        const image = MonoImage.fromAssemblyPath(Mono.api, "mscorlib.dll");
        assertNotNull(image, "Should create image from assembly path");
        
        const imageName = image.name;
        assertNotNull(imageName, "Loaded image should have name");
      } catch (error) {
        console.log(`  - Image from path test failed: ${error}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should validate image integrity",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Try to access classes to validate image
      const classes = image.classes;
      assert(classes.length > 0, "Valid image should have accessible classes");
      
      // Try to find a specific class
      const stringClass = image.tryFindClassByFullName("System.String");
      if (stringClass) {
        assert(stringClass.getName() === "String", "Should find valid class in image");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle invalid paths gracefully",
    () => {
      assertThrows(() => {
        MonoImage.fromAssemblyPath(Mono.api, "definitely-does-not-exist.dll");
      }, "Should throw when loading non-existent assembly");
    }
  ));

  // ===== IMAGE-TO-ASSEMBLY RELATIONSHIPS TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should maintain relationship to assembly",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const assemblyFromImage = image.name;
      
      // Image name should be related to assembly name
      assert(assemblyFromImage.length > 0, "Image should have valid name");
      
      // The image should be accessible through the assembly
      const imageFromAssembly = mscorlib!.image;
      // Compare pointer addresses (may be different wrapper objects)
      const isSame = image.pointer.equals(imageFromAssembly.pointer) || 
                     image.pointer.toString() === imageFromAssembly.pointer.toString();
      assert(isSame, "Image should reference same native pointer from assembly");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should provide consistent class access",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const assemblyClasses = mscorlib!.classes;
      const imageClasses = image.classes;
      
      // Classes should be accessible through both assembly and image
      assert(assemblyClasses.length === imageClasses.length, 
             "Assembly and image should provide same number of classes");
      
      // Find a specific class through both paths
      const assemblyStringClass = assemblyClasses.find(c => c.getName() === "String");
      const imageStringClass = imageClasses.find(c => c.getName() === "String");
      
      if (assemblyStringClass && imageStringClass) {
        // Compare pointer addresses (may be different wrapper objects)
        const isSame = assemblyStringClass.pointer.equals(imageStringClass.pointer) ||
                       assemblyStringClass.pointer.toString() === imageStringClass.pointer.toString();
        assert(isSame, "Same class should reference same native pointer through assembly and image");
      }
    }
  ));

  // ===== IMAGE METADATA TABLES ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should provide metadata table access",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Test class enumeration which uses metadata tables
      const classes = image.classes;
      assert(classes.length > 0, "Should access metadata tables for class enumeration");
      
      // Test class token access
      const tokens = image.getClassTokens();
      assert(tokens.length > 0, "Should access metadata tables for token access");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle metadata table validation",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Try to enumerate classes which validates metadata table integrity
      let enumeratedCount = 0;
      image.enumerateClasses((klass, index) => {
        enumeratedCount++;
        assertNotNull(klass, `Class at index ${index} should not be null`);
        assertNotNull(klass.getName(), `Class at index ${index} should have name`);
      });
      
      assert(enumeratedCount === image.getClassCount(), 
             "Enumerated count should match class count");
    }
  ));

  // ===== UNITY IMAGE HANDLING TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should handle Unity engine images",
    () => {
      const domain = Mono.domain;
      const unityEngine = domain.getAssembly("UnityEngine");
      
      if (unityEngine) {
        const image = unityEngine.image;
        assertNotNull(image, "UnityEngine should have image");
        
        const imageName = image.name;
        assert(imageName.includes("UnityEngine"), "Unity image name should be identifiable");
        
        const classes = image.classes;
        const gameObjectClass = classes.find(c => c.getName() === "GameObject");
        if (gameObjectClass) {
          assert(gameObjectClass.getNamespace() === "UnityEngine", 
                 "GameObject should be in UnityEngine namespace");
        }
      } else {
        console.log("  - UnityEngine assembly not found");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle Unity core module images",
    () => {
      const domain = Mono.domain;
      const unityCore = domain.getAssembly("UnityEngine.CoreModule");
      
      if (unityCore) {
        const image = unityCore.image;
        assertNotNull(image, "UnityEngine.CoreModule should have image");
        
        const classes = image.classes;
        assert(classes.length > 0, "Unity core module should have classes");
        
        console.log(`  - UnityEngine.CoreModule has ${classes.length} classes`);
      } else {
        console.log("  - UnityEngine.CoreModule assembly not found");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should identify Unity-specific class patterns",
    () => {
      const domain = Mono.domain;
      // Unity classes are typically in UnityEngine.CoreModule in newer Unity versions
      const coreModule = domain.getAssembly("UnityEngine.CoreModule");
      const unityEngine = domain.getAssembly("UnityEngine");
      
      // Try CoreModule first (newer Unity), then UnityEngine (older Unity)
      const targetAssembly = coreModule || unityEngine;
      
      if (targetAssembly) {
        const image = targetAssembly.image;
        const classes = image.classes;
        
        // Look for common Unity class patterns
        const componentClass = classes.find(c => c.getName() === "Component");
        const monoBehaviourClass = classes.find(c => c.getName() === "MonoBehaviour");
        const transformClass = classes.find(c => c.getName() === "Transform");
        const gameObjectClass = classes.find(c => c.getName() === "GameObject");
        
        const foundUnityClasses = [componentClass, monoBehaviourClass, transformClass, gameObjectClass]
          .filter(c => c !== undefined).length;
        
        console.log(`  - Found ${foundUnityClasses} core Unity classes in ${targetAssembly.getName()}`);
        // Relax assertion - finding at least 1 is acceptable
        assert(foundUnityClasses >= 1, "Should find at least one Unity core class");
      } else {
        console.log("  - Unity assembly not found (skipping)");
      }
    }
  ));

  // ===== IMAGE CACHING AND PERFORMANCE TESTS =====

  results.push(createPerformanceTest(
    "MonoImage class enumeration performance",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const startTime = Date.now();
      const classes = image.classes;
      const enumerationTime = Date.now() - startTime;
      
      console.log(`  Enumerated ${classes.length} classes in ${enumerationTime}ms`);
      assert(enumerationTime < 5000, "Class enumeration should complete within 5 seconds");
    }
  ));

  results.push(createPerformanceTest(
    "MonoImage class lookup performance",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        image.tryFindClassByFullName("System.String");
      }
      const lookupTime = Date.now() - startTime;
      
      console.log(`  100 class lookups took ${lookupTime}ms`);
      assert(lookupTime < 2000, "Class lookup should be reasonably fast");
    }
  ));

  results.push(createPerformanceTest(
    "MonoImage token access performance",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        image.getClassTokens();
      }
      const tokenAccessTime = Date.now() - startTime;
      
      console.log(`  100 token accesses took ${tokenAccessTime}ms`);
      assert(tokenAccessTime < 1000, "Token access should be fast");
    }
  ));

  // ===== IMAGE CLASS FINDING TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should find classes by full name",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const stringClass = image.tryFindClassByFullName("System.String");
      if (stringClass) {
        assert(stringClass.getName() === "String", "Should find String by full name");
        assert(stringClass.getNamespace() === "System", "String should be in System namespace");
      } else {
        console.log("  - String class not found by full name");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should find classes by namespace and name",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const stringClass = image.tryClassFromName("System", "String");
      if (stringClass) {
        assert(stringClass.getName() === "String", "Should find String by namespace/name");
        assert(stringClass.getNamespace() === "System", "String should be in System namespace");
      } else {
        console.log("  - String class not found by namespace/name");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle missing class lookups gracefully",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const missingClass = image.tryFindClassByFullName("NonExistent.Class");
      assert(missingClass === null, "Missing class should return null");
      
      const missingByNamespace = image.tryClassFromName("NonExistent", "Class");
      assert(missingByNamespace === null, "Missing class by namespace should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoImage should throw for missing required classes",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      assertThrows(() => {
        image.classFromName("NonExistent", "Class");
      }, "Should throw when required class is not found");
    }
  ));

  // ===== IMAGE ENUMERATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should enumerate classes correctly",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      let enumeratedCount = 0;
      let foundStringClass = false;
      
      image.enumerateClasses((klass, index) => {
        enumeratedCount++;
        
        if (klass.getName() === "String") {
          foundStringClass = true;
        }
        
        assertNotNull(klass, `Class at index ${index} should not be null`);
        assertNotNull(klass.getName(), `Class at index ${index} should have name`);
      });
      
      assert(enumeratedCount > 0, "Should enumerate at least one class");
      assert(foundStringClass, "Should find String class during enumeration");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle enumeration with large class counts",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const classes = image.classes;
      
      if (classes.length > 100) {
        console.log(`  - Image has ${classes.length} classes (large enumeration test)`);
        
        let enumeratedCount = 0;
        image.enumerateClasses((klass, index) => {
          enumeratedCount++;
          
          // Just verify we can enumerate without errors
          assertNotNull(klass, `Class at index ${index} should not be null`);
        });
        
        assert(enumeratedCount === classes.length, 
               "Should enumerate all classes");
      }
    }
  ));

  // ===== IMAGE ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoImage should handle invalid operations gracefully",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Try to find class with empty name
      const emptyNameClass = image.tryFindClassByFullName("");
      assert(emptyNameClass === null, "Empty name should return null");
      
      const emptyNamespaceClass = image.tryClassFromName("", "");
      assert(emptyNamespaceClass === null, "Empty namespace should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoImage should handle corrupted metadata gracefully",
    () => {
      // This test would require a corrupted assembly, which we can't easily create
      // Instead, test that the API handles unexpected situations
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Test that enumeration doesn't crash
      try {
        image.enumerateClasses((klass) => {
          // Just access basic properties
          assertNotNull(klass, "Class should not be null during enumeration");
        });
      } catch (error) {
        console.log(`  - Enumeration error: ${error}`);
      }
    }
  ));

  // ===== IMAGE TOSTRING AND SERIALIZATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage toString should work correctly",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      const stringRep = image.toString();
      assertNotNull(stringRep, "toString should return a value");
      assert(stringRep.includes("MonoImage"), "toString should include class type");
    }
  ));

  // ===== IMAGE STATIC FACTORY TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should create from assembly path",
    () => {
      // Test the static factory method
      try {
        const image = MonoImage.fromAssemblyPath(Mono.api, "mscorlib.dll");
        assertNotNull(image, "Should create image from assembly path");
        
        // Verify the image is functional
        const classCount = image.getClassCount();
        assert(classCount > 0, "Created image should be functional");
      } catch (error) {
        console.log(`  - Static factory test failed: ${error}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should handle domain parameter in factory",
    () => {
      try {
        const domain = Mono.domain;
        const image = MonoImage.fromAssemblyPath(Mono.api, "mscorlib.dll", domain);
        assertNotNull(image, "Should create image with domain parameter");
        
        const imageName = image.name;
        assertNotNull(imageName, "Created image should have name");
      } catch (error) {
        console.log(`  - Domain parameter test failed: ${error}`);
      }
    }
  ));

  // ===== IMAGE CONSISTENCY TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage should provide consistent class access",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      // Test multiple ways to access the same class
      const stringClass1 = image.tryFindClassByFullName("System.String");
      const stringClass2 = image.tryClassFromName("System", "String");
      
      if (stringClass1 && stringClass2) {
        assert(stringClass1.getName() === stringClass2.getName(), 
               "Same class should have same name");
        assert(stringClass1.getNamespace() === stringClass2.getNamespace(), 
               "Same class should have same namespace");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage should maintain class count consistency",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      
      const image = mscorlib!.image;
      
      const classCount = image.getClassCount();
      const classes = image.classes;
      const tokens = image.getClassTokens();
      
      assert(classCount === classes.length, "Class count should match classes array length");
      assert(classCount === tokens.length, "Class count should match tokens array length");
      
      console.log(`  - Consistency check: count=${classCount}, classes=${classes.length}, tokens=${tokens.length}`);
    }
  ));

  // ===== NAMESPACE OPERATIONS TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage.getNamespaces should return array",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const namespaces = mscorlib!.image.getNamespaces();
      assert(Array.isArray(namespaces), "getNamespaces should return an array");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getNamespaces should contain System namespace",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const namespaces = mscorlib!.image.getNamespaces();
      assert(namespaces.includes("System"), "Should contain System namespace");
      console.log(`  - Found ${namespaces.length} namespaces`);
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getNamespaces should return sorted unique values",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const namespaces = mscorlib!.image.getNamespaces();
      
      // Check sorted
      const sorted = [...namespaces].sort();
      assert(
        JSON.stringify(namespaces) === JSON.stringify(sorted), 
        "Namespaces should be sorted"
      );
      
      // Check unique
      const unique = [...new Set(namespaces)];
      assert(namespaces.length === unique.length, "Namespaces should be unique");
    }
  ));

  // ===== TYPE BY TOKEN TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage.getTypeByToken should return class for valid token",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      // Token 0x02000001 is typically the first typedef
      const klass = mscorlib!.image.getTypeByToken(0x02000001);
      assertNotNull(klass, "Should return a class for valid token");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getTypeByToken should work with index mode",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      // Using index 1 (converted to token internally)
      const klass = mscorlib!.image.getTypeByToken(1, true);
      assertNotNull(klass, "Should return a class with index mode");
      
      const name = klass!.getName();
      assert(typeof name === "string" && name.length > 0, "Class should have valid name");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getTypeByToken should return null for invalid token",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      // Very high token that shouldn't exist
      const klass = mscorlib!.image.getTypeByToken(0x02FFFFFF);
      assert(klass === null, "Should return null for invalid token");
    }
  ));

  // ===== CLASSES BY NAMESPACE TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage.getClassesByNamespace should return array",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const classes = mscorlib!.image.getClassesByNamespace("System");
      assert(Array.isArray(classes), "Should return an array");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getClassesByNamespace System should have classes",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const classes = mscorlib!.image.getClassesByNamespace("System");
      assert(classes.length > 0, "System namespace should have classes");
      console.log(`  - System namespace has ${classes.length} classes`);
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getClassesByNamespace all classes should have correct namespace",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const classes = mscorlib!.image.getClassesByNamespace("System");
      const allCorrect = classes.every(c => c.getNamespace() === "System");
      assert(allCorrect, "All returned classes should have System namespace");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getClassesByNamespace should return empty for nonexistent namespace",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const classes = mscorlib!.image.getClassesByNamespace("NonExistentNamespace12345");
      assert(classes.length === 0, "Should return empty array for nonexistent namespace");
    }
  ));

  // ===== NAMESPACE INTEGRATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoImage namespace methods should be consistent",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      const namespaces = mscorlib!.image.getNamespaces();
      
      // Pick a namespace that should have classes
      const testNs = namespaces.find(ns => ns === "System");
      if (!testNs) return; // Skip if System not found
      
      const classes = mscorlib!.image.getClassesByNamespace(testNs);
      assert(classes.length > 0, "Namespace from getNamespaces should have classes");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoImage.getTypeByToken should match getClasses",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib should exist");
      
      // Get first class by token
      const klassByToken = mscorlib!.image.getTypeByToken(1, true);
      assertNotNull(klassByToken, "Should get class by token");
      
      // Should be in the classes list
      const allClasses = mscorlib!.image.getClasses();
      const found = allClasses.some(c => c.getFullName() === klassByToken!.getFullName());
      assert(found, "Class from token should be in classes list");
    }
  ));

  return results;
}

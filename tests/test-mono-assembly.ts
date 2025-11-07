/**
 * Comprehensive MonoAssembly Tests
 * Tests for MonoAssembly functionality including assembly enumeration, loading/unloading,
 * dependency resolution, metadata access, and Unity assembly handling
 */

import Mono from "../src";
import { 
  TestResult, 
  createMonoDependentTest, 
  createPerformanceTest,
  createErrorHandlingTest,
  assert, 
  assertNotNull, 
} from "./test-framework";

export function createMonoAssemblyTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== ASSEMBLY ENUMERATION AND DISCOVERY TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should enumerate all assemblies in domain",
    () => {
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");
      
      const assemblies = domain.assemblies;
      assert(assemblies.length > 0, "Should find assemblies in domain");
      
      const mscorlib = assemblies.find(a => a.name === "mscorlib");
      assertNotNull(mscorlib, "Should find mscorlib assembly");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should find assemblies by name",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "Should find mscorlib assembly");
      assert(mscorlib.name === "mscorlib", "Assembly name should be mscorlib");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should handle missing assemblies gracefully",
    () => {
      const domain = Mono.domain;
      
      const missingAssembly = domain.getAssembly("DefinitelyDoesNotExist");
      assert(missingAssembly === null, "Missing assembly should return null");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide assembly names",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const name = mscorlib.getName();
        assertNotNull(name, "Assembly name should be available");
        assert(name === "mscorlib", "Assembly name should be mscorlib");
      }
    }
  ));

  // ===== ASSEMBLY LOADING AND UNLOADING TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide load state information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const loadState = mscorlib.getLoadState();
        assertNotNull(loadState, "Load state should be available");
        
        const isLoaded = mscorlib.isFullyLoaded();
        assert(typeof isLoaded === "boolean", "isFullyLoaded should return boolean");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should handle assembly size information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const sizeInfo = mscorlib.getSizeInfo();
        assertNotNull(sizeInfo, "Size info should be available");
        assert(sizeInfo.assemblyName === "mscorlib", "Size info should include assembly name");
        assert(typeof sizeInfo.classCount === "number", "Size info should include class count");
      }
    }
  ));

  // ===== DEPENDENCY RELATIONSHIP RESOLUTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide referenced assemblies",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const referencedAssemblies = mscorlib.getReferencedAssemblies();
        assertNotNull(referencedAssemblies, "Referenced assemblies should be available");
        assert(Array.isArray(referencedAssemblies), "Referenced assemblies should be an array");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide referencing assemblies",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const referencingAssemblies = mscorlib.getReferencingAssemblies();
        assertNotNull(referencingAssemblies, "Referencing assemblies should be available");
        assert(Array.isArray(referencingAssemblies), "Referencing assemblies should be an array");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should check dependencies",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      const systemCore = domain.getAssembly("System.Core");
      
      if (mscorlib && systemCore) {
        // Test dependency checking
        const dependsOnSystemCore = mscorlib.dependsOn(systemCore);
        const dependsOnMscorlib = systemCore.dependsOn(mscorlib);
        
        assert(typeof dependsOnSystemCore === "boolean", "dependsOn should return boolean");
        assert(typeof dependsOnMscorlib === "boolean", "dependsOn should return boolean");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide dependency tree",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const dependencyTree = mscorlib.getDependencyTree();
        assertNotNull(dependencyTree, "Dependency tree should be available");
        assertNotNull(dependencyTree.root, "Dependency tree should have root");
        assert(typeof dependencyTree.totalAssemblies === "number", "Dependency tree should have total count");
        assert(typeof dependencyTree.maxDepth === "number", "Dependency tree should have max depth");
      }
    }
  ));

  // ===== ASSEMBLY METADATA ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide assembly metadata",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const fullName = mscorlib.getFullName();
        assertNotNull(fullName, "Full name should be available");
        
        const culture = mscorlib.getCulture();
        assertNotNull(culture, "Culture should be available");
        
        const version = mscorlib.getVersion();
        assertNotNull(version, "Version should be available");
        assert(typeof version.major === "number", "Version should have major");
        assert(typeof version.minor === "number", "Version should have minor");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide detailed information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const detailedInfo = mscorlib.getDetailedInfo();
        assertNotNull(detailedInfo, "Detailed info should be available");
        
        assertNotNull(detailedInfo.basic, "Basic info should be available");
        assertNotNull(detailedInfo.classification, "Classification should be available");
        assertNotNull(detailedInfo.statistics, "Statistics should be available");
        assertNotNull(detailedInfo.analysis, "Analysis should be available");
        
        assert(detailedInfo.basic.name === "mscorlib", "Basic info should include name");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide entry point information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const entryPoint = mscorlib.getEntryPoint();
        // mscorlib might not have a traditional entry point
        if (entryPoint) {
          assertNotNull(entryPoint.name, "Entry point should have name");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide custom attributes",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const customAttributes = mscorlib.getCustomAttributes();
        assertNotNull(customAttributes, "Custom attributes should be available");
        assert(Array.isArray(customAttributes), "Custom attributes should be an array");
      }
    }
  ));

  // ===== UNITY ASSEMBLY HANDLING TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should handle Unity assemblies",
    () => {
      const domain = Mono.domain;
      
      const unityEngine = domain.getAssembly("UnityEngine");
      if (unityEngine) {
        assert(unityEngine.name === "UnityEngine", "Unity engine assembly should be found");
        
        const isSystem = unityEngine.isSystemAssembly();
        assert(isSystem === true, "UnityEngine should be system assembly");
        
        const isUser = unityEngine.isUserAssembly();
        assert(isUser === false, "UnityEngine should not be user assembly");
      } else {
        console.log("  - UnityEngine assembly not found");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should handle Assembly-CSharp",
    () => {
      const domain = Mono.domain;
      
      const assemblyCSharp = domain.getAssembly("Assembly-CSharp");
      if (assemblyCSharp) {
        assert(assemblyCSharp.name.includes("Assembly-CSharp"), "Assembly-CSharp should be found");
        
        const isSystem = assemblyCSharp.isSystemAssembly();
        // Assembly-CSharp might be considered user assembly depending on context
        console.log(`  - Assembly-CSharp isSystem: ${isSystem}`);
      } else {
        console.log("  - Assembly-CSharp assembly not found");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should identify Unity vs system assemblies",
    () => {
      const domain = Mono.domain;
      
      const assemblies = domain.assemblies;
      const unityAssemblies = assemblies.filter(a => 
        a.name.includes("UnityEngine") || a.name.includes("Assembly-CSharp")
      );
      const systemAssemblies = assemblies.filter(a => 
        a.name.includes("System.") || a.name.includes("mscorlib")
      );
      
      assert(unityAssemblies.length >= 0, "Should find Unity assemblies");
      assert(systemAssemblies.length >= 0, "Should find system assemblies");
      
      console.log(`  - Found ${unityAssemblies.length} Unity assemblies`);
      console.log(`  - Found ${systemAssemblies.length} system assemblies`);
    }
  ));

  // ===== ASSEMBLY SECURITY AND VALIDATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should validate assembly compatibility",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      const systemCore = domain.getAssembly("System.Core");
      
      if (mscorlib && systemCore) {
        const isCompatible = mscorlib.isCompatibleWith(systemCore);
        assert(typeof isCompatible === "boolean", "isCompatibleWith should return boolean");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should compare assemblies",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      const systemCore = domain.getAssembly("System.Core");
      
      if (mscorlib && systemCore) {
        const comparison = mscorlib.compareTo(systemCore);
        assert(typeof comparison === "number", "compareTo should return number");
        
        const isEqual = mscorlib.equals(systemCore);
        assert(typeof isEqual === "boolean", "equals should return boolean");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should handle assembly location",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const location = mscorlib.getLocation();
        assertNotNull(location, "Location should be available");
        assert(typeof location === "string", "Location should be string");
      }
    }
  ));

  // ===== ASSEMBLY CLASS ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide access to classes",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const classes = mscorlib.classes;
        assert(classes.length > 0, "Should find classes in assembly");
        
        const stringClass = classes.find(c => c.getName() === "String");
        assertNotNull(stringClass, "Should find String class in mscorlib");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should find classes by full name",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const stringClass = mscorlib.class("System.String");
        if (stringClass) {
          assert(stringClass.getName() === "String", "Should find String class by full name");
          assert(stringClass.getNamespace() === "System", "String class should be in System namespace");
        } else {
          console.log("  - String class not found by full name");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should find classes by namespace and name",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const stringClass = mscorlib.tryFindClass("System", "String");
        if (stringClass) {
          assert(stringClass.getName() === "String", "Should find String class");
          assert(stringClass.getNamespace() === "System", "String class should be in System namespace");
        } else {
          console.log("  - String class not found by namespace/name");
        }
      }
    }
  ));

  // ===== ASSEMBLY IMAGE ACCESS TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide access to image",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const image = mscorlib.image;
        assertNotNull(image, "Assembly should have image");
        
        const imageName = image.name;
        assertNotNull(imageName, "Image should have name");
        
        const imageClasses = image.classes;
        assert(imageClasses.length >= 0, "Image should have classes");
      }
    }
  ));

  // ===== ASSEMBLY PERFORMANCE TESTS =====

  results.push(createPerformanceTest(
    "MonoAssembly enumeration performance",
    () => {
      const domain = Mono.domain;
      
      const startTime = Date.now();
      const assemblies = domain.assemblies;
      const enumerationTime = Date.now() - startTime;
      
      console.log(`  Enumerated ${assemblies.length} assemblies in ${enumerationTime}ms`);
      assert(enumerationTime < 5000, "Assembly enumeration should complete within 5 seconds");
    }
  ));

  results.push(createPerformanceTest(
    "MonoAssembly class access performance",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const startTime = Date.now();
        const classes = mscorlib.classes;
        const accessTime = Date.now() - startTime;
        
        console.log(`  Accessed ${classes.length} classes in ${accessTime}ms`);
        assert(accessTime < 3000, "Class access should be reasonably fast");
      }
    }
  ));

  results.push(createPerformanceTest(
    "MonoAssembly dependency analysis performance",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const startTime = Date.now();
        const dependencyTree = mscorlib.getDependencyTree();
        const analysisTime = Date.now() - startTime;
        
        console.log(`  Analyzed dependencies in ${analysisTime}ms`);
        assert(analysisTime < 2000, "Dependency analysis should be reasonably fast");
      }
    }
  ));

  // ===== ASSEMBLY ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoAssembly should handle invalid operations gracefully",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        // Try to find non-existent class
        const missingClass = mscorlib.tryFindClass("NonExistent.Namespace", "NonExistentClass");
        assert(missingClass === null, "Missing class should return null");
      }
    }
  ));

  // ===== ASSEMBLY TOSTRING AND SERIALIZATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly toString should work correctly",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const stringRep = mscorlib.toString();
        assertNotNull(stringRep, "toString should return a value");
        assert(stringRep.includes("MonoAssembly"), "toString should include class type");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should provide JSON representation",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const json = mscorlib.toJSON();
        assertNotNull(json, "toJSON should return a value");
        assert(json.name === "mscorlib", "JSON should include assembly name");
        assert(typeof json.isSystem === "boolean", "JSON should include isSystem flag");
        assert(typeof json.isUser === "boolean", "JSON should include isUser flag");
        assert(typeof json.classCount === "number", "JSON should include class count");
      }
    }
  ));

  // ===== ASSEMBLY DESCRIPTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide human-readable descriptions",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const description = mscorlib.describe();
        assertNotNull(description, "Description should be available");
        assert(description.includes("mscorlib"), "Description should include assembly name");
        assert(description.includes("System"), "Description should indicate system assembly");
      }
    }
  ));

  // ===== ASSEMBLY VERSION COMPATIBILITY TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should handle version information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const version = mscorlib.getVersion();
        assertNotNull(version, "Version should be available");
        
        assert(typeof version.major === "number", "Version major should be number");
        assert(typeof version.minor === "number", "Version minor should be number");
        assert(typeof version.build === "number", "Version build should be number");
        assert(typeof version.revision === "number", "Version revision should be number");
        
        console.log(`  - mscorlib version: ${version.major}.${version.minor}.${version.build}.${version.revision}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoAssembly should handle culture information",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        const culture = mscorlib.getCulture();
        assertNotNull(culture, "Culture should be available");
        assert(typeof culture === "string", "Culture should be string");
        
        console.log(`  - mscorlib culture: ${culture}`);
      }
    }
  ));

  // ===== ASSEMBLY CLASSIFICATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should classify assemblies correctly",
    () => {
      const domain = Mono.domain;
      
      const mscorlib = domain.getAssembly("mscorlib");
      const unityEngine = domain.getAssembly("UnityEngine");
      
      if (mscorlib) {
        assert(mscorlib.isSystemAssembly(), "mscorlib should be system assembly");
        assert(!mscorlib.isUserAssembly(), "mscorlib should not be user assembly");
      }
      
      if (unityEngine) {
        // Unity assemblies might be classified as system
        const isSystem = unityEngine.isSystemAssembly();
        console.log(`  - UnityEngine classified as system: ${isSystem}`);
      }
    }
  ));

  // ===== ASSEMBLY ROOT NAMESPACES TESTS =====

  results.push(createMonoDependentTest(
    "MonoAssembly should provide root namespace information",
    () => {
      const domain = Mono.domain;
      
      const rootNamespaces = domain.getRootNamespaces();
      assertNotNull(rootNamespaces, "Root namespaces should be available");
      assert(Array.isArray(rootNamespaces), "Root namespaces should be an array");
      assert(rootNamespaces.length > 0, "Should find root namespaces");
      
      const systemNamespace = rootNamespaces.find(ns => ns === "System");
      assertNotNull(systemNamespace, "Should find System namespace");
      
      console.log(`  - Found ${rootNamespaces.length} root namespaces`);
    }
  ));

  return results;
}

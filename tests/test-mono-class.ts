/**
 * Comprehensive MonoClass Tests
 * Tests for MonoClass functionality including class discovery, method lookup, 
 * property access, inheritance, and Unity-specific features
 */

import Mono from "../src";
import { 
  TestResult, 
  createMonoDependentTest, 
  createIntegrationTest,
  createErrorHandlingTest,
  assert, 
  assertNotNull, 
  assertThrows,
} from "./test-framework";
import {
  createBasicLookupPerformanceTest,
  createMethodLookupPerformanceTest
} from "./test-utilities";

export function createMonoClassTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== CLASS DISCOVERY AND ENUMERATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should discover system classes",
    () => {
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");
      
      const stringClass = domain.class("System.String");
      assertNotNull(stringClass, "String class should be found");
      assert(stringClass.getName() === "String", "Class name should be String");
      assert(stringClass.getNamespace() === "System", "Namespace should be System");
      assert(stringClass.getFullName() === "System.String", "Full name should be System.String");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should enumerate all classes in assembly",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib assembly should be available");
      
      const classes = mscorlib.getClasses();
      assert(classes.length > 0, "Should find classes in mscorlib");
      
      const stringClass = classes.find(c => c.getName() === "String");
      assertNotNull(stringClass, "Should find String class in enumeration");
    }
  ));

  // Optimized performance test using shared helper
  results.push(createBasicLookupPerformanceTest(
    "MonoClass enumeration performance test",
    () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        return mscorlib.getClasses();
      }
      return [];
    }
  ));

  // ===== METHOD LOOKUP AND RESOLUTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should find methods by name",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      assertNotNull(concatMethod, "Should find Concat method with 2 parameters");
      assert(concatMethod.getName() === "Concat", "Method name should be Concat");
      assert(concatMethod.getParameterCount() === 2, "Should have 2 parameters");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should handle method overloads",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concat2Params = stringClass!.tryGetMethod("Concat", 2);
      const concat3Params = stringClass!.tryGetMethod("Concat", 3);
      
      assertNotNull(concat2Params, "Should find Concat with 2 parameters");
      assertNotNull(concat3Params, "Should find Concat with 3 parameters");
      
      assert(concat2Params !== concat3Params, "Different overloads should be different methods");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should return null for non-existent methods",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const nonExistentMethod = stringClass!.tryGetMethod("NonExistentMethod");
      assert(nonExistentMethod === null, "Should return null for non-existent method");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoClass should throw for missing required methods",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      assertThrows(() => {
        stringClass!.getMethod("NonExistentMethod");
      }, "Should throw when required method is not found");
    }
  ));

  // ===== PROPERTY ACCESS AND VALIDATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should find properties by name",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const lengthProperty = stringClass!.tryGetProperty("Length");
      assertNotNull(lengthProperty, "Should find Length property");
      assert(lengthProperty.getName() === "Length", "Property name should be Length");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should enumerate all properties",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const properties = stringClass!.getProperties();
      assert(properties.length > 0, "Should find properties");
      
      const lengthProperty = properties.find((p: any) => p.getName() === "Length");
      assertNotNull(lengthProperty, "Should find Length property in enumeration");
    }
  ));

  // ===== INHERITANCE RELATIONSHIPS TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should handle inheritance relationships",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      const objectClass = domain.class("System.Object");
      
      assert(stringClass!.isSubclassOf(objectClass!), "String should be subclass of Object");
      assert(objectClass!.isAssignableFrom(stringClass!), "Object should be assignable from String");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should handle interface implementation",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      // Try to find a common interface that String implements
      const comparableInterface = domain.class("System.IComparable");
      if (comparableInterface) {
        assert(stringClass!.implementsInterface(comparableInterface!),
               "String should implement IComparable");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should get parent class",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const parentClass = stringClass!.getParent();
      assertNotNull(parentClass, "String should have a parent class");
      assert(parentClass.getName() === "Object", "String's parent should be Object");
    }
  ));

  // ===== ABSTRACT CLASS AND INTERFACE HANDLING TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should identify abstract classes",
    () => {
      const domain = Mono.domain;
      
      // Try to find an abstract class
      const streamClass = domain.class("System.IO.Stream");
      if (streamClass) {
        assert(streamClass.isAbstract(), "Stream should be abstract");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should identify interfaces",
    () => {
      const domain = Mono.domain;
      
      // Try to find an interface
      const disposableInterface = domain.class("System.IDisposable");
      if (disposableInterface) {
        assert(disposableInterface.isInterface(), "IDisposable should be an interface");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should identify sealed classes",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      assert(stringClass!.isSealed(), "String should be sealed");
    }
  ));

  // ===== CLASS METADATA AND ATTRIBUTES TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should provide class metadata",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const summary = stringClass!.describe();
      assertNotNull(summary, "Class summary should be available");
      assert(summary.name === "String", "Summary name should be String");
      assert(summary.namespace === "System", "Summary namespace should be System");
      assert(typeof summary.flags === "number", "Summary flags should be a number");
      assert(Array.isArray(summary.flagNames), "Summary flagNames should be an array");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should provide type information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const type = stringClass!.getType();
      assertNotNull(type, "Class type should be available");
      assert(type.getName() === "String", "Type name should be String");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should provide type token",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const typeToken = stringClass!.getTypeToken();
      assert(typeof typeToken === "number", "Type token should be a number");
      assert(typeToken > 0, "Type token should be positive");
    }
  ));

  // ===== CLASS INSTANCE CREATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should create object instances",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      // String is special - let's try with a simpler class
      const objectClass = domain.class("System.Object");
      const obj = objectClass!.alloc();
      
      assertNotNull(obj, "Should create object instance");
      assert(obj.getClass().getName() === "Object", "Created object should be Object");
    }
  ));

  results.push(createIntegrationTest(
    "MonoClass should validate instance compatibility",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      const objectClass = domain.class("System.Object");
      
      const obj = objectClass!.alloc();
      const validation = stringClass!.validateInstance(obj);
      
      // String should not be assignable from Object (the other way around)
      assert(!validation.isValid, "Object should not be valid String instance");
      assert(validation.errors.length > 0, "Should have validation errors");
    }
  ));

  // ===== CLASS DESCRIPTION AND TOSTRING TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should provide human-readable descriptions",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const description = stringClass!.getDescription();
      assertNotNull(description, "Description should be available");
      assert(description.includes("String"), "Description should include class name");
      assert(description.includes("sealed"), "Description should include sealed modifier");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass toString should work correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const stringRep = stringClass!.toString();
      assertNotNull(stringRep, "toString should return a value");
      assert(stringRep.includes("MonoClass"), "toString should include class type");
    }
  ));

  // ===== EDGE CASES AND ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoClass should handle invalid class names gracefully",
    () => {
      const domain = Mono.domain;
      
      const invalidClass = domain.class("");
      assert(invalidClass === null, "Should return null for empty class name");
      
      const nonExistentClass = domain.class("NonExistent.Namespace.NonExistentClass");
      assert(nonExistentClass === null, "Should return null for non-existent class");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoClass should throw for missing required classes",
    () => {
      const domain = Mono.domain;
      
      assertThrows(() => {
        domain.class("NonExistent.Namespace.NonExistentClass");
      }, "Should throw when required class is not found");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoClass should handle circular inheritance gracefully",
    () => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");
      
      // Object should not have a parent (or should be null)
      const parent = objectClass!.getParent();
      if (parent) {
        // If Object has a parent, it shouldn't be itself
        assert(parent.pointer !== objectClass!.pointer, "Object should not be its own parent");
      }
    }
  ));

  // ===== PERFORMANCE AND CACHING TESTS =====

  results.push(createMethodLookupPerformanceTest("System.String", "Concat", 2));

  results.push(createBasicLookupPerformanceTest(
    "MonoClass property enumeration performance",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      if (stringClass) {
        return stringClass.getProperties();
      }
      return [];
    }
  ));

  // ===== CACHE REFRESH TESTS =====

  results.push(createMonoDependentTest(
    "MonoClass should support cache refresh",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const methods1 = stringClass!.getMethods();
      const methods2 = stringClass!.getMethods(); // Should use cache
      
      assert(methods1.length === methods2.length, "Cached methods should have same count");
      
      const methods3 = stringClass!.getMethods(true); // Force refresh
      assert(methods3.length === methods1.length, "Refreshed methods should have same count");
    }
  ));

  return results;
}

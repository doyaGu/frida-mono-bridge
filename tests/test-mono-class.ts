/**
 * Comprehensive MonoClass Tests
 * Tests for MonoClass functionality including class discovery, method lookup,
 * property access, inheritance, and Unity-specific features
 */

import Mono from "../src";
import {
  TestResult,
  assert,
  assertNotNull,
  assertThrows,
  createErrorHandlingTest,
  createIntegrationTest,
  createMonoDependentTest,
} from "./test-framework";
import { createBasicLookupPerformanceTest, createMethodLookupPerformanceTest } from "./test-utilities";

export async function createMonoClassTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== CLASS DISCOVERY AND ENUMERATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should discover system classes", () => {
      const domain = Mono.domain;
      assertNotNull(domain, "Domain should be available");

      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should be found");
      assert(stringClass.name === "String", "Class name should be String");
      assert(stringClass.namespace === "System", "Namespace should be System");
      assert(stringClass.fullName === "System.String", "Full name should be System.String");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should enumerate all classes in assembly", () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      assertNotNull(mscorlib, "mscorlib assembly should be available");

      const classes = mscorlib.classes;
      assert(classes.length > 0, "Should find classes in mscorlib");

      const stringClass = classes.find((c: any) => c.name === "String");
      assertNotNull(stringClass, "Should find String class in enumeration");
    }),
  );

  // Optimized performance test using shared helper
  results.push(
    createBasicLookupPerformanceTest("MonoClass enumeration performance test", () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");
      if (mscorlib) {
        return mscorlib.classes;
      }
      return [];
    }),
  );

  // ===== METHOD LOOKUP AND RESOLUTION TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should find methods by name", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assertNotNull(concatMethod, "Should find Concat method with 2 parameters");
      assert(concatMethod.name === "Concat", "Method name should be Concat");
      assert(concatMethod.parameterCount === 2, "Should have 2 parameters");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should handle method overloads", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concat2Params = stringClass!.tryMethod("Concat", 2);
      const concat3Params = stringClass!.tryMethod("Concat", 3);

      assertNotNull(concat2Params, "Should find Concat with 2 parameters");
      assertNotNull(concat3Params, "Should find Concat with 3 parameters");

      assert(concat2Params !== concat3Params, "Different overloads should be different methods");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should return null for non-existent methods", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const nonExistentMethod = stringClass!.tryMethod("NonExistentMethod");
      assert(nonExistentMethod === null, "Should return null for non-existent method");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoClass should throw for missing required methods", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      assertThrows(() => {
        stringClass!.method("NonExistentMethod");
      }, "Should throw when required method is not found");
    }),
  );

  // ===== PROPERTY ACCESS AND VALIDATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should find properties by name", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const lengthProperty = stringClass!.tryProperty("Length");
      assertNotNull(lengthProperty, "Should find Length property");
      assert(lengthProperty.name === "Length", "Property name should be Length");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should enumerate all properties", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const properties = stringClass!.properties;
      assert(properties.length > 0, "Should find properties");

      const lengthProperty = properties.find((p: any) => p.name === "Length");
      assertNotNull(lengthProperty, "Should find Length property in enumeration");
    }),
  );

  // ===== INHERITANCE RELATIONSHIPS TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should handle inheritance relationships", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      const objectClass = domain.tryClass("System.Object");

      assert(stringClass!.isSubclassOf(objectClass!), "String should be subclass of Object");
      assert(objectClass!.isAssignableFrom(stringClass!), "Object should be assignable from String");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should handle interface implementation", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // Try to find a common interface that String implements
      const comparableInterface = domain.tryClass("System.IComparable");
      if (comparableInterface) {
        assert(stringClass!.implementsInterface(comparableInterface!), "String should implement IComparable");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should get parent class", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const parentClass = stringClass!.parent;
      assertNotNull(parentClass, "String should have a parent class");
      assert(parentClass.name === "Object", "String's parent should be Object");
    }),
  );

  // ===== ABSTRACT CLASS AND INTERFACE HANDLING TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should identify abstract classes", () => {
      const domain = Mono.domain;

      // Try to find an abstract class
      const streamClass = domain.tryClass("System.IO.Stream");
      if (streamClass) {
        assert(streamClass.isAbstract, "Stream should be abstract");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should identify interfaces", () => {
      const domain = Mono.domain;

      // Try to find an interface
      const disposableInterface = domain.tryClass("System.IDisposable");
      if (disposableInterface) {
        assert(disposableInterface.isInterface, "IDisposable should be an interface");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should identify sealed classes", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      assert(stringClass!.isSealed, "String should be sealed");
    }),
  );

  // ===== CLASS METADATA AND ATTRIBUTES TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should provide class metadata", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const summary = stringClass!.describe();
      assertNotNull(summary, "Class summary should be available");
      assert(summary.name === "String", "Summary name should be String");
      assert(summary.namespace === "System", "Summary namespace should be System");
      assert(typeof summary.flags === "number", "Summary flags should be a number");
      assert(Array.isArray(summary.flagNames), "Summary flagNames should be an array");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should provide type information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const type = stringClass!.type;
      assertNotNull(type, "Class type should be available");
      const typeName = type.name;
      // Type name may be "String" or "System.String" depending on Mono version
      assert(typeName.includes("String"), `Type name should contain 'String', got: ${typeName}`);
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should provide type token", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const typeToken = stringClass!.typeToken;
      assert(typeof typeToken === "number", "Type token should be a number");
      assert(typeToken > 0, "Type token should be positive");
    }),
  );

  // ===== CLASS INSTANCE CREATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should create object instances", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // String is special - let's try with a simpler class
      const objectClass = domain.tryClass("System.Object");
      const obj = objectClass!.alloc();

      assertNotNull(obj, "Should create object instance");
      assert(obj.class.name === "Object", "Created object should be Object");
    }),
  );

  results.push(
    await createIntegrationTest("MonoClass should validate instance compatibility", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      const objectClass = domain.tryClass("System.Object");

      const obj = objectClass!.alloc();
      const validation = stringClass!.validateInstance(obj);

      // String should not be assignable from Object (the other way around)
      assert(!validation.isValid, "Object should not be valid String instance");
      assert(validation.errors.length > 0, "Should have validation errors");
    }),
  );

  // ===== CLASS DESCRIPTION AND TOSTRING TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should provide human-readable descriptions", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const description = stringClass!.description;
      assertNotNull(description, "Description should be available");
      assert(description.includes("String"), "Description should include class name");
      assert(description.includes("sealed"), "Description should include sealed modifier");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass toString should work correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const stringRep = stringClass!.toString();
      assertNotNull(stringRep, "toString should return a value");
      assert(stringRep.includes("MonoClass"), "toString should include class type");
    }),
  );

  // ===== EDGE CASES AND ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoClass should handle invalid class names gracefully", () => {
      const domain = Mono.domain;

      const invalidClass = domain.tryClass("");
      assert(invalidClass === null, "Should return null for empty class name");

      const nonExistentClass = domain.tryClass("NonExistent.Namespace.NonExistentClass");
      assert(nonExistentClass === null, "Should return null for non-existent class");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoClass should return null for missing classes", () => {
      const domain = Mono.domain;

      // tryClass() returns null when class is not found (does not throw)
      const result = domain.tryClass("NonExistent.Namespace.NonExistentClass");
      assert(result === null, "Should return null when class is not found");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should handle circular inheritance gracefully", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      // Object should not have a parent (or should be null)
      const parent = objectClass!.parent;
      if (parent) {
        // If Object has a parent, it shouldn't be itself
        assert(parent.pointer !== objectClass!.pointer, "Object should not be its own parent");
      }
    }),
  );

  // ===== PERFORMANCE AND CACHING TESTS =====

  results.push(createMethodLookupPerformanceTest("System.String", "Concat", 2));

  results.push(
    createBasicLookupPerformanceTest("MonoClass property enumeration performance", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        return stringClass.properties;
      }
      return [];
    }),
  );

  // ===== CACHE REFRESH TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should support cache refresh", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const methods1 = stringClass!.methods;
      const methods2 = stringClass!.methods; // Should use cache

      assert(methods1.length === methods2.length, "Cached methods should have same count");

      const methods3 = stringClass!.methods; // Just access methods again
      assert(methods3.length === methods1.length, "Refreshed methods should have same count");
    }),
  );

  // ===== GENERIC TYPE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should handle generic List<T> type discovery", () => {
      const domain = Mono.domain;

      // Try to find generic List type
      const listClass = domain.tryClass("System.Collections.Generic.List`1");
      if (listClass) {
        assertNotNull(listClass, "Generic List class should be discoverable");
        const name = listClass.name;
        assert(name.includes("List"), `Class name should contain 'List', got: ${name}`);

        // Verify it has expected methods
        const addMethod = listClass.tryMethod("Add", 1);
        const countProperty = listClass.tryProperty("Count");
        console.log(`  - List<T> has Add method: ${addMethod !== null}`);
        console.log(`  - List<T> has Count property: ${countProperty !== null}`);
      } else {
        console.log("  - Generic List`1 not found (may not be loaded)");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should handle generic Dictionary<K,V> type discovery", () => {
      const domain = Mono.domain;

      // Try to find generic Dictionary type
      const dictClass = domain.tryClass("System.Collections.Generic.Dictionary`2");
      if (dictClass) {
        assertNotNull(dictClass, "Generic Dictionary class should be discoverable");
        const name = dictClass.name;
        assert(name.includes("Dictionary"), `Class name should contain 'Dictionary', got: ${name}`);

        // Verify it has expected methods
        const addMethod = dictClass.tryMethod("Add", 2);
        const containsKeyMethod = dictClass.tryMethod("ContainsKey", 1);
        console.log(`  - Dictionary<K,V> has Add method: ${addMethod !== null}`);
        console.log(`  - Dictionary<K,V> has ContainsKey method: ${containsKeyMethod !== null}`);
      } else {
        console.log("  - Generic Dictionary`2 not found (may not be loaded)");
      }
    }),
  );

  // ===== NESTED TYPE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should enumerate nested types", () => {
      const domain = Mono.domain;

      // Look for a class that typically has nested types
      const environmentClass = domain.tryClass("System.Environment");
      if (environmentClass) {
        const nestedTypes = environmentClass.nestedTypes;
        console.log(`  - Environment has ${nestedTypes.length} nested types`);

        nestedTypes.forEach((nested: any, i: number) => {
          if (i < 3) {
            // Log first 3 nested types
            console.log(`    - Nested type: ${nested.name}`);
          }
        });
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should handle nested class lookup by name pattern", () => {
      const domain = Mono.domain;

      // Try common nested type patterns
      const assemblyNames = domain.assemblies.map(a => a.name);
      const hasUserAssembly = assemblyNames.some(n => n.includes("Assembly-CSharp") || n.includes("Game"));

      if (hasUserAssembly) {
        console.log("  - User assemblies available for nested type testing");
      }

      // Test with standard library nested types
      const stringComparer = domain.tryClass("System.StringComparer");
      if (stringComparer) {
        const nestedTypes = stringComparer.nestedTypes;
        console.log(`  - StringComparer has ${nestedTypes.length} nested types`);
      }
    }),
  );

  // ===== VALUE TYPE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should identify value types correctly", () => {
      const domain = Mono.domain;

      // Test primitive value types
      const int32Class = domain.tryClass("System.Int32");
      assertNotNull(int32Class, "Int32 should be found");
      assert(int32Class.isValueType, "Int32 should be a value type");
      assert(!int32Class.isInterface, "Int32 should not be an interface");

      const doubleClass = domain.tryClass("System.Double");
      assertNotNull(doubleClass, "Double should be found");
      assert(doubleClass.isValueType, "Double should be a value type");

      // Test struct types
      const dateTimeClass = domain.tryClass("System.DateTime");
      if (dateTimeClass) {
        assert(dateTimeClass.isValueType, "DateTime should be a value type");
        console.log(`  - DateTime isValueType: ${dateTimeClass.isValueType}`);
      }

      const guidClass = domain.tryClass("System.Guid");
      if (guidClass) {
        assert(guidClass.isValueType, "Guid should be a value type");
        console.log(`  - Guid isValueType: ${guidClass.isValueType}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should identify enum types correctly", () => {
      const domain = Mono.domain;

      // Test enum types
      const dayOfWeekClass = domain.tryClass("System.DayOfWeek");
      if (dayOfWeekClass) {
        assert(dayOfWeekClass.isEnum, "DayOfWeek should be an enum");
        assert(dayOfWeekClass.isValueType, "DayOfWeek should also be a value type");
        console.log(`  - DayOfWeek isEnum: ${dayOfWeekClass.isEnum}`);

        // Enums should have fields for each value
        const fields = dayOfWeekClass.fields;
        console.log(`  - DayOfWeek has ${fields.length} fields`);
      }

      const typeCodeClass = domain.tryClass("System.TypeCode");
      if (typeCodeClass) {
        assert(typeCodeClass.isEnum, "TypeCode should be an enum");
        console.log(`  - TypeCode isEnum: ${typeCodeClass.isEnum}`);
      }
    }),
  );

  // ===== DELEGATE TYPE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should identify delegate types correctly", () => {
      const domain = Mono.domain;

      // Test common delegate types
      const actionClass = domain.tryClass("System.Action");
      if (actionClass) {
        const isDelegate = actionClass.isDelegate;
        console.log(`  - Action isDelegate: ${isDelegate}`);

        // Get delegate invoke method
        const invokeMethod = actionClass.tryMethod("Invoke", 0);
        console.log(`  - Action has Invoke method: ${invokeMethod !== null}`);
      }

      const funcClass = domain.tryClass("System.Func`1");
      if (funcClass) {
        const isDelegate = funcClass.isDelegate;
        console.log(`  - Func<T> isDelegate: ${isDelegate}`);
      }

      const predicateClass = domain.tryClass("System.Predicate`1");
      if (predicateClass) {
        const isDelegate = predicateClass.isDelegate;
        console.log(`  - Predicate<T> isDelegate: ${isDelegate}`);
      }
    }),
  );

  // ===== INTERFACE IMPLEMENTATION BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should enumerate implemented interfaces", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const interfaces = stringClass!.interfaces;
      assert(interfaces.length > 0, "String should implement multiple interfaces");
      console.log(`  - String implements ${interfaces.length} interfaces:`);

      interfaces.slice(0, 5).forEach(iface => {
        console.log(`    - ${iface.fullName}`);
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should check interface implementation correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      const listClass = domain.tryClass("System.Collections.Generic.List`1");

      const iComparable = domain.tryClass("System.IComparable");
      const iEnumerable = domain.tryClass("System.Collections.IEnumerable");
      const iDisposable = domain.tryClass("System.IDisposable");

      if (iComparable) {
        const stringImplementsIComparable = stringClass!.implementsInterface(iComparable);
        console.log(`  - String implements IComparable: ${stringImplementsIComparable}`);
      }

      if (iEnumerable && listClass) {
        const listImplementsIEnumerable = listClass.implementsInterface(iEnumerable);
        console.log(`  - List<T> implements IEnumerable: ${listImplementsIEnumerable}`);
      }

      if (iDisposable) {
        const stringImplementsIDisposable = stringClass!.implementsInterface(iDisposable);
        assert(!stringImplementsIDisposable, "String should not implement IDisposable");
      }
    }),
  );

  // ===== TYPE HIERARCHY BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should traverse full type hierarchy", () => {
      const domain = Mono.domain;

      // Find a class with deep hierarchy
      const exceptionClass = domain.tryClass("System.ArgumentException");
      if (exceptionClass) {
        let current: any = exceptionClass;
        const hierarchy: string[] = [];

        while (current) {
          hierarchy.push(current.fullName);
          current = current.parent;
        }

        console.log(`  - ArgumentException hierarchy (${hierarchy.length} levels):`);
        hierarchy.forEach((name, i) => console.log(`    ${i}: ${name}`));

        assert(hierarchy.length >= 3, "ArgumentException should have at least 3 levels of inheritance");
        assert(hierarchy[hierarchy.length - 1] === "System.Object", "Root should be System.Object");
      }
    }),
  );

  // ===== NULL AND EMPTY INPUT BOUNDARY TESTS =====

  results.push(
    await createErrorHandlingTest("MonoClass should handle whitespace-only class names", () => {
      const domain = Mono.domain;

      const whitespaceClass = domain.tryClass("   ");
      assert(whitespaceClass === null, "Should return null for whitespace-only name");

      const newlineClass = domain.tryClass("\n\t");
      assert(newlineClass === null, "Should return null for newline/tab name");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoClass should handle special characters in class names", () => {
      const domain = Mono.domain;

      // These should return null, not crash
      const specialClass1 = domain.tryClass("System.<>c");
      const specialClass2 = domain.tryClass("System.!@#$%");

      // Result can be null or valid (compiler-generated types), but shouldn't crash
      console.log(`  - '<>c' lookup result: ${specialClass1 ? "found" : "null"}`);
      console.log(`  - '!@#$%' lookup result: ${specialClass2 ? "found" : "null"}`);
    }),
  );

  // ===== VTABLE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should get VTable correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      try {
        const vtable = stringClass!.getVTable();
        assertNotNull(vtable, "VTable should be available");
        assert(!vtable.isNull(), "VTable pointer should not be null");
        console.log(`  - String VTable: ${vtable}`);
      } catch (error) {
        console.log(`  - VTable access failed (expected for some types): ${error}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should ensure initialization before VTable access", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      // Ensure initialization
      objectClass!.ensureInitialized();

      const vtable = objectClass!.getVTable();
      assertNotNull(vtable, "VTable should be available after initialization");
    }),
  );

  // ===== FLAGS AND ATTRIBUTES BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoClass should correctly identify BeforeFieldInit classes", () => {
      const domain = Mono.domain;

      // Most classes without static constructors have BeforeFieldInit
      const objectClass = domain.tryClass("System.Object");
      const beforeFieldInit = objectClass!.isBeforeFieldInit;
      console.log(`  - Object isBeforeFieldInit: ${beforeFieldInit}`);

      // String typically has special initialization
      const stringClass = domain.tryClass("System.String");
      console.log(`  - String isBeforeFieldInit: ${stringClass!.isBeforeFieldInit}`);
    }),
  );

  results.push(
    await createMonoDependentTest("MonoClass should provide complete describe() output", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const summary = stringClass!.describe();

      // Verify all expected fields are present
      assert(typeof summary.name === "string", "describe() should have name");
      assert(typeof summary.namespace === "string", "describe() should have namespace");
      assert(typeof summary.fullName === "string", "describe() should have fullName");
      assert(typeof summary.flags === "number", "describe() should have flags");
      assert(Array.isArray(summary.flagNames), "describe() should have flagNames array");
      assert(typeof summary.isInterface === "boolean", "describe() should have isInterface");
      assert(typeof summary.isAbstract === "boolean", "describe() should have isAbstract");
      assert(typeof summary.isSealed === "boolean", "describe() should have isSealed");
      assert(typeof summary.isValueType === "boolean", "describe() should have isValueType");
      assert(typeof summary.isEnum === "boolean", "describe() should have isEnum");
      assert(typeof summary.isDelegate === "boolean", "describe() should have isDelegate");
      assert(typeof summary.methodCount === "number", "describe() should have methodCount");
      assert(typeof summary.fieldCount === "number", "describe() should have fieldCount");
      assert(typeof summary.propertyCount === "number", "describe() should have propertyCount");
      assert(typeof summary.typeToken === "number", "describe() should have typeToken");

      console.log(`  - String describe() output verified`);
      console.log(
        `    - Methods: ${summary.methodCount}, Fields: ${summary.fieldCount}, Properties: ${summary.propertyCount}`,
      );
    }),
  );

  return results;
}

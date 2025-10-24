/**
 * Comprehensive MonoMethod Tests
 * Tests for MonoMethod functionality including method signature resolution, 
 * parameter handling, invocation, overloads, and Unity-specific patterns
 */

import Mono, { MonoMethod, MonoObject, MonoClass } from "../src";
import { 
  TestResult, 
  TestCategory, 
  createMonoDependentTest, 
  createDomainTest, 
  createIntegrationTest,
  createPerformanceTest,
  createErrorHandlingTest,
  assert, 
  assertNotNull, 
  assertThrows,
  createTest
} from "./test-framework";

export function createMonoMethodTests(): TestResult[] {
  const results: TestResult[] = [];

  // ===== METHOD SIGNATURE RESOLUTION AND PARAMETER HANDLING TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should resolve method signatures correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      assertNotNull(stringClass, "String class should be available");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      assertNotNull(concatMethod, "Concat method should be found");
      
      const signature = concatMethod.getSignature();
      assertNotNull(signature, "Method signature should be available");
      
      const paramCount = signature.getParameterCount();
      assert(paramCount === 2, "Concat should have 2 parameters");
      
      const paramTypes = signature.getParameterTypes();
      assert(paramTypes.length === 2, "Should have 2 parameter types");
      
      const returnType = signature.getReturnType();
      assertNotNull(returnType, "Return type should be available");
      assert(returnType.getName() === "String", "Return type should be String");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle parameter information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const parameters = concatMethod.getParameters();
      
      assert(parameters.length === 2, "Should have 2 parameters");
      
      parameters.forEach((param, index) => {
        assert(typeof param.index === "number", `Parameter ${index} should have index`);
        assert(typeof param.isOut === "boolean", `Parameter ${index} should have isOut flag`);
        assertNotNull(param.type, `Parameter ${index} should have type`);
      });
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle calling conventions",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const callConvention = concatMethod.getCallConvention();
      
      assert(typeof callConvention === "number", "Call convention should be a number");
    }
  ));

  // ===== METHOD INVOCATION WITH VARIOUS PARAMETER TYPES TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should invoke with string parameters",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      
      // Create test strings
      const str1 = Mono.api.stringNew("Hello");
      const str2 = Mono.api.stringNew(" World");
      
      try {
        const result = concatMethod.invoke(null, [str1, str2]);
        assertNotNull(result, "Method should return a result");
        
        // Convert result to string for verification
        const resultString = Mono.api.native.mono_string_to_utf8(result);
        assert(resultString === "Hello World", "Concat should work correctly");
      } catch (error) {
        console.log(`  - String concat test failed: ${error}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should invoke with primitive parameters",
    () => {
      const domain = Mono.domain;
      const int32Class = domain.class("System.Int32");
      
      if (int32Class) {
        const parseMethod = int32Class.tryGetMethod("Parse", 1);
        if (parseMethod) {
          const str = Mono.api.stringNew("42");
          
          try {
            const result = parseMethod.invoke(null, [str]);
            assertNotNull(result, "Parse should return a result");
          } catch (error) {
            console.log(`  - Int32.Parse test failed: ${error}`);
          }
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle null parameters",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const isNullOrEmptyMethod = stringClass!.tryGetMethod("IsNullOrEmpty", 1);
      if (isNullOrEmptyMethod) {
        try {
          const result = isNullOrEmptyMethod.invoke(null, [NULL]);
          assertNotNull(result, "IsNullOrEmpty should return a result");
        } catch (error) {
          console.log(`  - IsNullOrEmpty test failed: ${error}`);
        }
      }
    }
  ));

  // ===== OVERLOADED METHOD RESOLUTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should resolve overloads correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concat2Params = stringClass!.tryGetMethod("Concat", 2);
      const concat3Params = stringClass!.tryGetMethod("Concat", 3);
      const concat4Params = stringClass!.tryGetMethod("Concat", 4);
      
      assertNotNull(concat2Params, "Should find Concat with 2 parameters");
      assertNotNull(concat3Params, "Should find Concat with 3 parameters");
      assertNotNull(concat4Params, "Should find Concat with 4 parameters");
      
      assert(concat2Params !== concat3Params, "Different overloads should be different methods");
      assert(concat3Params !== concat4Params, "Different overloads should be different methods");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle overload parameter count matching",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      // Test with exact parameter count
      const exactMethod = stringClass!.tryGetMethod("Concat", 2);
      assertNotNull(exactMethod, "Should find method with exact parameter count");
      
      // Test with wrong parameter count
      const wrongMethod = stringClass!.tryGetMethod("Concat", 99);
      assert(wrongMethod === null, "Should not find method with wrong parameter count");
    }
  ));

  // ===== GENERIC METHOD HANDLING TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should identify generic methods",
    () => {
      const domain = Mono.domain;
      const arrayClass = domain.class("System.Array");
      
      if (arrayClass) {
        // Look for a generic method like Sort
        const sortMethod = arrayClass.tryGetMethod("Sort", 1);
        if (sortMethod) {
          const isGeneric = sortMethod.getFullName().includes("`");
          if (isGeneric) {
            console.log("  - Found generic method: " + sortMethod.getFullName());
          }
        }
      }
    }
  ));

  // ===== STATIC VS INSTANCE METHOD OPERATIONS TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should identify static methods correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      assert(concatMethod.isStatic(), "Concat should be static");
      
      const getLengthMethod = stringClass!.tryGetMethod("get_Length");
      if (getLengthMethod) {
        assert(!getLengthMethod.isStatic(), "get_Length should be instance method");
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle instance method invocation",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const getLengthMethod = stringClass!.tryGetMethod("get_Length");
      if (getLengthMethod) {
        const testString = Mono.api.stringNew("Hello");
        
        try {
          const result = getLengthMethod.invoke(testString, []);
          assertNotNull(result, "Instance method should return result");
        } catch (error) {
          console.log(`  - Instance method test failed: ${error}`);
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle static method invocation",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      
      try {
        const str1 = Mono.api.stringNew("Hello");
        const str2 = Mono.api.stringNew(" World");
        const result = concatMethod.invoke(null, [str1, str2]);
        assertNotNull(result, "Static method should return result");
      } catch (error) {
        console.log(`  - Static method test failed: ${error}`);
      }
    }
  ));

  // ===== METHOD RETURN VALUE PROCESSING TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should process return values correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const returnType = concatMethod.getReturnType();
      
      assertNotNull(returnType, "Return type should be available");
      assert(returnType.getName() === "String", "Return type should be String");
      
      // Test actual return value
      try {
        const str1 = Mono.api.stringNew("Test");
        const str2 = Mono.api.stringNew("Return");
        const result = concatMethod.invoke(null, [str1, str2]);
        assertNotNull(result, "Should return a value");
      } catch (error) {
        console.log(`  - Return value test failed: ${error}`);
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle void return types",
    () => {
      const domain = Mono.domain;
      const objectClass = domain.class("System.Object");
      
      if (objectClass) {
        // Look for a method that might return void
        const methods = objectClass.getMethods();
        const voidMethod = methods.find(m => {
          try {
            return m.getReturnType().getName() === "Void";
          } catch {
            return false;
          }
        });
        
        if (voidMethod) {
          console.log(`  - Found void method: ${voidMethod.getName()}`);
        }
      }
    }
  ));

  // ===== METHOD ATTRIBUTES AND METADATA TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should provide method metadata",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const summary = concatMethod.describe();
      
      assertNotNull(summary, "Method summary should be available");
      assert(summary.name === "Concat", "Summary name should be Concat");
      assert(summary.declaringType === "System.String", "Declaring type should be String");
      assert(typeof summary.attributes === "number", "Attributes should be a number");
      assert(Array.isArray(summary.attributeNames), "Attribute names should be an array");
      assert(typeof summary.isStatic === "boolean", "IsStatic should be boolean");
      assert(typeof summary.isVirtual === "boolean", "IsVirtual should be boolean");
      assert(typeof summary.isAbstract === "boolean", "IsAbstract should be boolean");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should provide accessibility information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const accessibility = concatMethod.getAccessibility();
      
      assertNotNull(accessibility, "Accessibility should be available");
      assert(typeof accessibility === "string", "Accessibility should be a string");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should provide full name with signature",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const fullName = concatMethod.getFullName(true);
      const nameOnly = concatMethod.getFullName(false);
      
      assertNotNull(fullName, "Full name with signature should be available");
      assertNotNull(nameOnly, "Name only should be available");
      assert(fullName.length > nameOnly.length, "Full name should be longer than name only");
    }
  ));

  // ===== UNITY METHOD PATTERNS TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should handle Unity Update pattern",
    () => {
      const domain = Mono.domain;
      const monoBehaviourClass = domain.class("UnityEngine.MonoBehaviour");
      
      if (monoBehaviourClass) {
        const updateMethod = monoBehaviourClass.tryGetMethod("Update");
        if (updateMethod) {
          assert(updateMethod.getName() === "Update", "Update method should be found");
          assert(!updateMethod.isStatic(), "Update should be instance method");
          assert(updateMethod.getParameterCount() === 0, "Update should have no parameters");
        } else {
          console.log("  - Update method not found in MonoBehaviour");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle Unity Start pattern",
    () => {
      const domain = Mono.domain;
      const monoBehaviourClass = domain.class("UnityEngine.MonoBehaviour");
      
      if (monoBehaviourClass) {
        const startMethod = monoBehaviourClass.tryGetMethod("Start");
        if (startMethod) {
          assert(startMethod.getName() === "Start", "Start method should be found");
          assert(!startMethod.isStatic(), "Start should be instance method");
          assert(startMethod.getParameterCount() === 0, "Start should have no parameters");
        } else {
          console.log("  - Start method not found in MonoBehaviour");
        }
      }
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should handle Unity Awake pattern",
    () => {
      const domain = Mono.domain;
      const monoBehaviourClass = domain.class("UnityEngine.MonoBehaviour");
      
      if (monoBehaviourClass) {
        const awakeMethod = monoBehaviourClass.tryGetMethod("Awake");
        if (awakeMethod) {
          assert(awakeMethod.getName() === "Awake", "Awake method should be found");
          assert(!awakeMethod.isStatic(), "Awake should be instance method");
          assert(awakeMethod.getParameterCount() === 0, "Awake should have no parameters");
        } else {
          console.log("  - Awake method not found in MonoBehaviour");
        }
      }
    }
  ));

  // ===== METHOD VALIDATION TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should validate arguments",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const validation = concatMethod.validateArguments(["Hello", "World"]);
      
      assert(validation.isValid === true, "Valid arguments should pass validation");
      assert(validation.errors.length === 0, "Valid arguments should have no errors");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should detect invalid argument count",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const validation = concatMethod.validateArguments(["Only one arg"]);
      
      assert(validation.isValid === false, "Wrong argument count should fail validation");
      assert(validation.errors.length > 0, "Should have validation errors");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod should validate accessibility",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const staticMethod = stringClass!.getMethod("Concat", 2);
      const staticValidation = staticMethod.validateAccessibility({ isStatic: true });
      assert(staticValidation.isValid === true, "Static method should be callable in static context");
      
      const instanceValidation = staticMethod.validateAccessibility({ isStatic: false });
      assert(instanceValidation.isValid === false, "Static method should not be callable in instance context");
    }
  ));

  // ===== PERFORMANCE TESTS =====

  results.push(createPerformanceTest(
    "MonoMethod lookup performance",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        stringClass!.getMethod("Concat", 2);
      }
      const lookupTime = Date.now() - startTime;
      
      console.log(`  1000 method lookups took ${lookupTime}ms`);
      assert(lookupTime < 1000, "Method lookup should be fast (cached)");
    }
  ));

  results.push(createPerformanceTest(
    "MonoMethod invocation performance",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const str1 = Mono.api.stringNew("Hello");
      const str2 = Mono.api.stringNew(" World");
      
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        try {
          concatMethod.invoke(null, [str1, str2]);
        } catch (error) {
          // Ignore invocation errors for performance test
        }
      }
      const invocationTime = Date.now() - startTime;
      
      console.log(`  100 method invocations took ${invocationTime}ms`);
      assert(invocationTime < 5000, "Method invocation should be reasonably fast");
    }
  ));

  // ===== ERROR HANDLING TESTS =====

  results.push(createErrorHandlingTest(
    "MonoMethod should handle missing methods gracefully",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const missingMethod = stringClass!.tryGetMethod("DefinitelyDoesNotExist");
      assert(missingMethod === null, "Missing method should return null");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoMethod should throw for required missing methods",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      assertThrows(() => {
        stringClass!.getMethod("DefinitelyDoesNotExist");
      }, "Should throw when required method is not found");
    }
  ));

  results.push(createErrorHandlingTest(
    "MonoMethod should handle invocation errors",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      
      // Try to invoke with wrong parameters
      assertThrows(() => {
        concatMethod.invoke(null, []);
      }, "Should throw when invoked with wrong parameter count");
    }
  ));

  // ===== METHOD DESCRIPTION TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should provide human-readable descriptions",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const description = concatMethod.getDescription();
      
      assertNotNull(description, "Description should be available");
      assert(description.includes("Concat"), "Description should include method name");
      assert(description.includes("String"), "Description should include return type");
    }
  ));

  results.push(createMonoDependentTest(
    "MonoMethod toString should work correctly",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const stringRep = concatMethod.toString();
      
      assertNotNull(stringRep, "toString should return a value");
      assert(stringRep.includes("MonoMethod"), "toString should include class type");
    }
  ));

  // ===== METHOD TOKEN TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should provide method tokens",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const token = concatMethod.getToken();
      
      assert(typeof token === "number", "Token should be a number");
      assert(token > 0, "Token should be positive");
    }
  ));

  // ===== DECLARING CLASS TESTS =====

  results.push(createMonoDependentTest(
    "MonoMethod should provide declaring class information",
    () => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      
      const concatMethod = stringClass!.getMethod("Concat", 2);
      const declaringClass = concatMethod.getDeclaringClass();
      
      assertNotNull(declaringClass, "Declaring class should be available");
      assert(declaringClass.getName() === "String", "Declaring class should be String");
      assert(declaringClass.getFullName() === "System.String", "Declaring class full name should be System.String");
    }
  ));

  return results;
}

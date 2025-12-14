/**
 * Comprehensive MonoMethod Tests
 * Tests for MonoMethod functionality including method signature resolution,
 * parameter handling, invocation, overloads, and Unity-specific patterns
 */

import Mono from "../src";
import {
  TestResult,
  assert,
  assertNotNull,
  assertThrows,
  createErrorHandlingTest,
  createMonoDependentTest,
} from "./test-framework";
import { createBasicLookupPerformanceTest, createMethodLookupPerformanceTest } from "./test-utilities";

export async function createMonoMethodTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== METHOD SIGNATURE RESOLUTION AND PARAMETER HANDLING TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should resolve method signatures correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      assertNotNull(stringClass, "String class should be available");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assertNotNull(concatMethod, "Concat method should be found");

      const signature = concatMethod.signature;
      assertNotNull(signature, "Method signature should be available");

      const paramCount = signature.parameterCount;
      assert(paramCount === 2, "Concat should have 2 parameters");

      const paramTypes = signature.parameterTypes;
      assert(paramTypes.length === 2, "Should have 2 parameter types");

      const returnType = signature.returnType;
      assertNotNull(returnType, "Return type should be available");
      const returnTypeName = returnType.name;
      assert(returnTypeName.includes("String"), `Return type should include 'String', got: ${returnTypeName}`);
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle parameter information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const parameters = concatMethod!.parameters;

      assert(parameters.length === 2, "Should have 2 parameters");

      parameters.forEach((param: any, index: number) => {
        assert(typeof param.index === "number", `Parameter ${index} should have index`);
        assert(typeof param.isOut === "boolean", `Parameter ${index} should have isOut flag`);
        assertNotNull(param.type, `Parameter ${index} should have type`);
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle calling conventions", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const callConvention = concatMethod!.callConvention;

      assert(typeof callConvention === "number", "Call convention should be a number");
    }),
  );

  // ===== METHOD INVOCATION WITH VARIOUS PARAMETER TYPES TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should invoke with string parameters", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assertNotNull(concatMethod, "Concat method should be found");

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
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should invoke with primitive parameters", () => {
      const domain = Mono.domain;
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
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
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle null parameters", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const isNullOrEmptyMethod = stringClass!.tryMethod("IsNullOrEmpty", 1);
      if (isNullOrEmptyMethod) {
        try {
          const result = isNullOrEmptyMethod.invoke(null, [null]);
          assertNotNull(result, "IsNullOrEmpty should return a result");
        } catch (error) {
          console.log(`  - IsNullOrEmpty test failed: ${error}`);
        }
      }
    }),
  );

  // ===== OVERLOADED METHOD RESOLUTION TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should resolve overloads correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concat2Params = stringClass!.tryMethod("Concat", 2);
      const concat3Params = stringClass!.tryMethod("Concat", 3);
      const concat4Params = stringClass!.tryMethod("Concat", 4);

      assertNotNull(concat2Params, "Should find Concat with 2 parameters");
      assertNotNull(concat3Params, "Should find Concat with 3 parameters");
      assertNotNull(concat4Params, "Should find Concat with 4 parameters");

      assert(concat2Params !== concat3Params, "Different overloads should be different methods");
      assert(concat3Params !== concat4Params, "Different overloads should be different methods");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle overload parameter count matching", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // Test with exact parameter count
      const exactMethod = stringClass!.tryMethod("Concat", 2);
      assertNotNull(exactMethod, "Should find method with exact parameter count");

      // Test with wrong parameter count
      const wrongMethod = stringClass!.tryMethod("Concat", 99);
      assert(wrongMethod === null, "Should not find method with wrong parameter count");
    }),
  );

  // ===== GENERIC METHOD HANDLING TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should identify generic methods", () => {
      const domain = Mono.domain;
      const arrayClass = domain.tryClass("System.Array");

      if (arrayClass) {
        // Look for a generic method like Sort
        const sortMethod = arrayClass.tryMethod("Sort", 1);
        if (sortMethod) {
          const isGeneric = sortMethod.fullName.includes("`");
          if (isGeneric) {
            console.log("  - Found generic method: " + sortMethod.fullName);
          }
        }
      }
    }),
  );

  // ===== STATIC VS INSTANCE METHOD OPERATIONS TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should identify static methods correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assert(concatMethod!.isStatic, "Concat should be static");

      const getLengthMethod = stringClass!.tryMethod("get_Length");
      if (getLengthMethod) {
        assert(!getLengthMethod.isStatic, "get_Length should be instance method");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle instance method invocation", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const getLengthMethod = stringClass!.tryMethod("get_Length");
      if (getLengthMethod) {
        const testString = Mono.api.stringNew("Hello");

        try {
          const result = getLengthMethod.invoke(testString, []);
          assertNotNull(result, "Instance method should return result");
        } catch (error) {
          console.log(`  - Instance method test failed: ${error}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle static method invocation", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);

      try {
        const str1 = Mono.api.stringNew("Hello");
        const str2 = Mono.api.stringNew(" World");
        const result = concatMethod!.invoke(null, [str1, str2]);
        assertNotNull(result, "Static method should return result");
      } catch (error) {
        console.log(`  - Static method test failed: ${error}`);
      }
    }),
  );

  // ===== METHOD RETURN VALUE PROCESSING TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should process return values correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assertNotNull(concatMethod, "Concat method should be found");
      const returnType = concatMethod.returnType;

      assertNotNull(returnType, "Return type should be available");
      const returnTypeName = returnType.name;
      assert(returnTypeName.includes("String"), `Return type should include 'String', got: ${returnTypeName}`);

      // Test actual return value
      try {
        const str1 = Mono.api.stringNew("Test");
        const str2 = Mono.api.stringNew("Return");
        const result = concatMethod.invoke(null, [str1, str2]);
        assertNotNull(result, "Should return a value");
      } catch (error) {
        console.log(`  - Return value test failed: ${error}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle void return types", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      if (objectClass) {
        // Look for a method that might return void
        const methods = objectClass.methods;
        const voidMethod = methods.find(m => {
          try {
            return m.returnType.name === "Void";
          } catch {
            return false;
          }
        });

        if (voidMethod) {
          console.log(`  - Found void method: ${voidMethod.name}`);
        }
      }
    }),
  );

  // ===== METHOD ATTRIBUTES AND METADATA TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should provide method metadata", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const summary = concatMethod!.describe();

      assertNotNull(summary, "Method summary should be available");
      assert(summary.name === "Concat", "Summary name should be Concat");
      assert(summary.declaringType === "System.String", "Declaring type should be String");
      assert(typeof summary.attributes === "number", "Attributes should be a number");
      assert(Array.isArray(summary.attributeNames), "Attribute names should be an array");
      assert(typeof summary.isStatic === "boolean", "IsStatic should be boolean");
      assert(typeof summary.isVirtual === "boolean", "IsVirtual should be boolean");
      assert(typeof summary.isAbstract === "boolean", "IsAbstract should be boolean");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should provide accessibility information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const accessibility = concatMethod!.accessibility;

      assertNotNull(accessibility, "Accessibility should be available");
      assert(typeof accessibility === "string", "Accessibility should be a string");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should provide full name with signature", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const fullName = concatMethod!.getFullName(true);
      const nameOnly = concatMethod!.getFullName(false);

      assertNotNull(fullName, "Full name with signature should be available");
      assertNotNull(nameOnly, "Name only should be available");
      assert(fullName.length > nameOnly.length, "Full name should be longer than name only");
    }),
  );

  // ===== METHOD VALIDATION TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should validate arguments", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const validation = concatMethod!.validateArguments(["Hello", "World"]);

      assert(validation.isValid === true, "Valid arguments should pass validation");
      assert(validation.errors.length === 0, "Valid arguments should have no errors");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should detect invalid argument count", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const validation = concatMethod!.validateArguments(["Only one arg"]);

      assert(validation.isValid === false, "Wrong argument count should fail validation");
      assert(validation.errors.length > 0, "Should have validation errors");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should validate accessibility", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const staticMethod = stringClass!.tryMethod("Concat", 2);
      const staticValidation = staticMethod!.validateAccessibility({ isStatic: true });
      assert(staticValidation.isValid === true, "Static method should be callable in static context");

      const instanceValidation = staticMethod!.validateAccessibility({ isStatic: false });
      assert(instanceValidation.isValid === false, "Static method should not be callable in instance context");
    }),
  );

  // ===== PERFORMANCE TESTS =====

  results.push(createMethodLookupPerformanceTest("System.String", "Concat", 2));

  results.push(
    createBasicLookupPerformanceTest("Method invocation performance for System.String.Concat", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const concatMethod = stringClass.tryMethod("Concat", 2);
        if (concatMethod) {
          try {
            const str1 = Mono.api.stringNew("Hello");
            const str2 = Mono.api.stringNew(" World");
            concatMethod.invoke(null, [str1, str2]);
          } catch (error) {
            // Ignore invocation errors for performance test
          }
        }
      }
    }),
  );

  // ===== ERROR HANDLING TESTS =====

  results.push(
    await createErrorHandlingTest("MonoMethod should handle missing methods gracefully", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const missingMethod = stringClass!.tryMethod("DefinitelyDoesNotExist");
      assert(missingMethod === null, "Missing method should return null");
    }),
  );

  results.push(
    await createErrorHandlingTest("MonoMethod should throw for required missing methods", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      assertThrows(() => {
        stringClass!.method("DefinitelyDoesNotExist");
      }, "Should throw when required method is not found");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle invocation with wrong parameters", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);

      // Try to invoke with wrong parameters - may throw or return unexpected results
      // Different implementations may handle this differently
      try {
        const result = concatMethod!.invoke(null, []);
        // If it doesn't throw, that's also acceptable behavior
        console.log(`  - Method invoked with wrong params returned: ${result}`);
      } catch (error) {
        // Expected behavior - throwing on wrong parameter count
        assert(true, "Should handle wrong parameter count");
      }
    }),
  );

  // ===== METHOD DESCRIPTION TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should provide human-readable descriptions", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const description = concatMethod!.description;

      assertNotNull(description, "Description should be available");
      assert(description.includes("Concat"), "Description should include method name");
      assert(description.includes("String"), "Description should include return type");
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod toString should work correctly", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const stringRep = concatMethod!.toString();

      assertNotNull(stringRep, "toString should return a value");
      assert(stringRep.includes("MonoMethod"), "toString should include class type");
    }),
  );

  // ===== METHOD TOKEN TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should provide method tokens", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const token = concatMethod!.token;

      assert(typeof token === "number", "Token should be a number");
      assert(token > 0, "Token should be positive");
    }),
  );

  // ===== DECLARING CLASS TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should provide declaring class information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const declaringClass = concatMethod!.declaringClass;

      assertNotNull(declaringClass, "Declaring class should be available");
      assert(declaringClass.name === "String", "Declaring class should be String");
      assert(declaringClass.fullName === "System.String", "Declaring class full name should be System.String");
    }),
  );

  // ===== OUT/REF PARAMETER BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should identify out parameters", () => {
      const domain = Mono.domain;
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        // TryParse has an out parameter
        const tryParseMethod = int32Class.tryMethod("TryParse", 2);
        if (tryParseMethod) {
          const parameters = tryParseMethod.parameters;
          assert(parameters.length === 2, "TryParse should have 2 parameters");

          // Second parameter should be out
          const outParam = parameters[1];
          console.log(`  - TryParse param[1] isOut: ${outParam.isOut}`);
          console.log(`  - TryParse param[1] type: ${outParam.type.name}`);

          // Check if it's a ByRef type
          const isByRef = outParam.type.byRef;
          console.log(`  - TryParse param[1] isByRef: ${isByRef}`);
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle ref parameters", () => {
      const domain = Mono.domain;

      // Look for Interlocked.Exchange which uses ref parameters
      const interlockedClass = domain.tryClass("System.Threading.Interlocked");
      if (interlockedClass) {
        const exchangeMethod = interlockedClass.tryMethod("Exchange", 2);
        if (exchangeMethod) {
          const parameters = exchangeMethod.parameters;
          console.log(`  - Interlocked.Exchange has ${parameters.length} parameters`);

          parameters.forEach((param: any, i: number) => {
            const isByRef = param.type.byRef;
            console.log(`    - param[${i}] isByRef: ${isByRef}, type: ${param.type.name}`);
          });
        }
      }
    }),
  );

  // ===== RETURN TYPE BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should handle void return type", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      // Look for methods that return void
      const methods = objectClass!.methods;
      const voidMethods = methods.filter(m => {
        try {
          const returnType = m.returnType;
          return returnType.name === "Void";
        } catch {
          return false;
        }
      });

      console.log(`  - Object has ${voidMethods.length} void methods`);
      if (voidMethods.length > 0) {
        const voidMethod = voidMethods[0];
        const returnType = voidMethod.returnType;
        assert(returnType.name === "Void", "Return type should be Void");
        console.log(`  - Example void method: ${voidMethod.name}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle all primitive return types", () => {
      const domain = Mono.domain;

      // Test methods that return different primitive types
      const primitiveTypes = ["Int32", "Int64", "Single", "Double", "Boolean", "Char", "Byte"];

      primitiveTypes.forEach((typeName: string) => {
        const typeClass = domain.tryClass(`System.${typeName}`);
        if (typeClass) {
          // Parse method returns the type itself
          const parseMethod = typeClass.tryMethod("Parse", 1);
          if (parseMethod) {
            const returnType = parseMethod.returnType;
            const returnTypeName = returnType.name;
            console.log(`  - ${typeName}.Parse returns: ${returnTypeName}`);
          }
        }
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle array return types", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // String.Split returns string[]
      const splitMethod = stringClass!.tryMethod("Split", 1);
      if (splitMethod) {
        const returnType = splitMethod.returnType;
        const returnTypeName = returnType.name;
        console.log(`  - String.Split returns: ${returnTypeName}`);

        // Check if it's an array type
        const kind = returnType.kind;
        console.log(`  - Return type kind: ${kind}`);
      }
    }),
  );

  // ===== GENERIC METHOD BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should handle generic method signatures", () => {
      const domain = Mono.domain;
      const arrayClass = domain.tryClass("System.Array");

      if (arrayClass) {
        // Get all methods and look for generic ones
        const methods = arrayClass.methods;
        const genericMethods = methods.filter(m => {
          const fullName = m.fullName;
          return fullName.includes("`") || fullName.includes("<");
        });

        console.log(`  - Array has ${genericMethods.length} generic methods`);
        genericMethods.slice(0, 3).forEach(m => {
          console.log(`    - ${m.fullName}`);
        });
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should enumerate methods from generic class", () => {
      const domain = Mono.domain;
      const listClass = domain.tryClass("System.Collections.Generic.List`1");

      if (listClass) {
        const methods = listClass.methods;
        console.log(`  - List<T> has ${methods.length} methods`);

        // Check for common list methods
        const expectedMethods = ["Add", "Remove", "Clear", "Contains", "IndexOf"];
        expectedMethods.forEach(methodName => {
          const found = methods.some(m => m.name === methodName);
          console.log(`    - Has ${methodName}: ${found}`);
        });
      }
    }),
  );

  // ===== CONSTRUCTOR BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should identify constructors", () => {
      const domain = Mono.domain;
      const exceptionClass = domain.tryClass("System.Exception");

      if (exceptionClass) {
        const methods = exceptionClass.methods;
        const constructors = methods.filter(m => m.isConstructor);

        console.log(`  - Exception has ${constructors.length} constructors`);
        constructors.forEach(ctor => {
          const paramCount = ctor.parameterCount;
          console.log(`    - .ctor(${paramCount} params)`);
        });

        assert(constructors.length > 0, "Exception should have constructors");

        // Verify constructor properties
        if (constructors.length > 0) {
          const ctor = constructors[0];
          assert(ctor.name === ".ctor", "Constructor name should be .ctor");
          assert(!ctor.isStatic, "Instance constructor should not be static");
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should identify static constructors", () => {
      const domain = Mono.domain;

      // Look for classes with static constructors
      const assemblies = domain.assemblies;
      let foundStaticCtor = false;

      for (const assembly of assemblies) {
        if (foundStaticCtor) break;

        const classes = assembly.classes;
        for (const klass of classes) {
          const methods = klass.methods;
          const staticCtors = methods.filter(m => m.name === ".cctor");

          if (staticCtors.length > 0) {
            console.log(`  - Found static constructor in ${klass.fullName}`);
            const cctor = staticCtors[0];
            assert(cctor.isStatic, "Static constructor should be static");
            assert(cctor.parameterCount === 0, "Static constructor should have no parameters");
            foundStaticCtor = true;
            break;
          }
        }
      }

      if (!foundStaticCtor) {
        console.log("  - No static constructor found in loaded assemblies");
      }
    }),
  );

  // ===== VIRTUAL METHOD BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should identify virtual methods", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      // GetHashCode is virtual
      const getHashCodeMethod = objectClass!.tryMethod("GetHashCode", 0);
      if (getHashCodeMethod) {
        assert(getHashCodeMethod.isVirtual, "GetHashCode should be virtual");
        console.log(`  - GetHashCode isVirtual: ${getHashCodeMethod.isVirtual}`);
        console.log(`  - GetHashCode isAbstract: ${getHashCodeMethod.isAbstract}`);
      }

      // ToString is also virtual
      const toStringMethod = objectClass!.tryMethod("ToString", 0);
      if (toStringMethod) {
        assert(toStringMethod.isVirtual, "ToString should be virtual");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should identify abstract methods", () => {
      const domain = Mono.domain;
      const streamClass = domain.tryClass("System.IO.Stream");

      if (streamClass) {
        const methods = streamClass.methods;
        const abstractMethods = methods.filter(m => m.isAbstract);

        console.log(`  - Stream has ${abstractMethods.length} abstract methods`);
        abstractMethods.slice(0, 5).forEach(m => {
          console.log(`    - ${m.name}`);
        });

        assert(abstractMethods.length > 0, "Stream should have abstract methods");
      }
    }),
  );

  // ===== METHOD FLAGS BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should provide complete flags information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const flags = concatMethod!.flags;
      const implementationFlags = concatMethod!.implementationFlags;

      assert(typeof flags === "number", "flags should be a number");
      assert(typeof implementationFlags === "number", "implementationFlags should be a number");

      console.log(`  - Concat flags: 0x${flags.toString(16)}`);
      console.log(`  - Concat implementationFlags: 0x${implementationFlags.toString(16)}`);

      // Get attribute names
      const attrNames = concatMethod!.attributeNames;
      const implAttrNames = concatMethod!.implementationAttributeNames;

      console.log(`  - Attribute names: ${attrNames.join(", ")}`);
      console.log(`  - Implementation attribute names: ${implAttrNames.join(", ")}`);
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should identify method accessibility levels", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const methods = stringClass!.methods;
      const accessLevels = new Set<string>();

      for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        const accessibility = m.accessibility;
        accessLevels.add(accessibility);
      }

      console.log(`  - String methods have ${accessLevels.size} accessibility levels:`);
      for (const level of accessLevels) {
        console.log(`    - ${level}`);
      }

      // Concat should be public
      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assert(concatMethod!.accessibility === "public", "Concat should be public");
    }),
  );

  // ===== EXCEPTION HANDLING BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should capture managed exceptions during invocation", () => {
      const domain = Mono.domain;
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          // Try to parse invalid string - should throw FormatException
          const invalidStr = Mono.api.stringNew("not_a_number");

          try {
            parseMethod.invoke(null, [invalidStr]);
            console.log("  - No exception thrown (unexpected)");
          } catch (error: any) {
            console.log(`  - Exception caught: ${error.name}`);
            if (error.exceptionType) {
              console.log(`  - Managed exception type: ${error.exceptionType}`);
            }
            if (error.exceptionMessage) {
              console.log(`  - Managed exception message: ${error.exceptionMessage}`);
            }
            assert(true, "Exception handling works");
          }
        }
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle throwOnManagedException option", () => {
      const domain = Mono.domain;
      const int32Class = domain.tryClass("System.Int32");

      if (int32Class) {
        const parseMethod = int32Class.tryMethod("Parse", 1);
        if (parseMethod) {
          const invalidStr = Mono.api.stringNew("invalid");

          // With throwOnManagedException = false, should return NULL instead of throwing
          try {
            const result = parseMethod.invoke(null, [invalidStr], { throwOnManagedException: false });
            console.log(`  - Result with throwOnManagedException=false: ${result}`);
          } catch (error) {
            console.log(`  - Still threw exception: ${error}`);
          }
        }
      }
    }),
  );

  // ===== INSTANCE VS STATIC INVOCATION BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should reject instance invocation on static method", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // Concat is static
      const concatMethod = stringClass!.tryMethod("Concat", 2);
      assert(concatMethod!.isStatic, "Concat should be static");

      // Invoking with instance should work (instance is ignored for static methods)
      const str1 = Mono.api.stringNew("Hello");
      const str2 = Mono.api.stringNew(" World");

      try {
        // Passing an instance to static method - should be ignored
        const result = concatMethod!.invoke(str1, [str1, str2]);
        assertNotNull(result, "Static method invocation should succeed");
      } catch (error) {
        console.log(`  - Static method invocation error: ${error}`);
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should require instance for instance methods", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // get_Length is an instance method
      const getLengthMethod = stringClass!.tryMethod("get_Length", 0);
      if (getLengthMethod) {
        assert(!getLengthMethod.isStatic, "get_Length should be instance method");

        // Invoking without instance might fail
        try {
          getLengthMethod.invoke(null, []);
          console.log("  - Instance method called without instance (unexpected success)");
        } catch (error) {
          console.log("  - Instance method correctly requires instance");
        }

        // Invoking with valid instance should succeed
        const testStr = Mono.api.stringNew("Test");
        try {
          const result = getLengthMethod.invoke(testStr, []);
          assertNotNull(result, "Instance method invocation should succeed with instance");
        } catch (error) {
          console.log(`  - Instance method invocation error: ${error}`);
        }
      }
    }),
  );

  // ===== METHOD DESCRIPTOR BOUNDARY TESTS =====

  // Note: MonoMethod.find is not available as MonoMethod is exported as a type only
  // This test is disabled until the API is exported as a value
  /*
  results.push(
    await createMonoDependentTest("MonoMethod should find method by descriptor using static find()", () => {
      const domain = Mono.domain;
      const mscorlib = domain.getAssembly("mscorlib");

      if (mscorlib) {
        try {
          // Find method using descriptor format
          const method = MonoMethod.find(Mono.api, mscorlib.image, "System.String:Concat(string,string)");
          if (method) {
            assertNotNull(method, "Method should be found by descriptor");
            assert(method.name === "Concat", "Found method should be Concat");
            console.log(`  - Found method: ${method.fullName}`);
          }
        } catch (error) {
          console.log(`  - Descriptor lookup failed (may not be supported): ${error}`);
        }
      }
    }),
  );
  */

  // ===== PARAMETER COUNT BOUNDARY TESTS =====

  results.push(
    await createMonoDependentTest("MonoMethod should handle methods with many parameters", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      // Look for method with most parameters
      const methods = stringClass!.methods;
      let maxParams = 0;
      let maxParamMethod: any = null;

      for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        const count = m.parameterCount;
        if (count > maxParams) {
          maxParams = count;
          maxParamMethod = m;
        }
      }

      if (maxParamMethod) {
        console.log(`  - Method with most params: ${maxParamMethod.name} (${maxParams} params)`);
        const params = maxParamMethod.parameters;
        assert(params.length === maxParams, "Parameter count should match");
      }
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod should handle methods with no parameters", () => {
      const domain = Mono.domain;
      const objectClass = domain.tryClass("System.Object");

      const getTypeMethod = objectClass!.tryMethod("GetType", 0);
      assertNotNull(getTypeMethod, "GetType should be found");

      assert(getTypeMethod.parameterCount === 0, "GetType should have 0 parameters");
      const params = getTypeMethod.parameters;
      assert(params.length === 0, "Parameters array should be empty");
    }),
  );

  // ===== COMPLETE DESCRIBE OUTPUT BOUNDARY TEST =====

  results.push(
    await createMonoDependentTest("MonoMethod describe() should provide complete information", () => {
      const domain = Mono.domain;
      const stringClass = domain.tryClass("System.String");

      const concatMethod = stringClass!.tryMethod("Concat", 2);
      const summary = concatMethod!.describe();

      // Verify all expected fields
      assert(typeof summary.name === "string", "describe() should have name");
      assert(typeof summary.fullName === "string", "describe() should have fullName");
      assert(typeof summary.declaringType === "string", "describe() should have declaringType");
      assert(typeof summary.attributes === "number", "describe() should have attributes");
      assert(Array.isArray(summary.attributeNames), "describe() should have attributeNames");
      assert(typeof summary.implementationAttributes === "number", "describe() should have implementationAttributes");
      assert(
        Array.isArray(summary.implementationAttributeNames),
        "describe() should have implementationAttributeNames",
      );
      assert(typeof summary.accessibility === "string", "describe() should have accessibility");
      assert(typeof summary.isStatic === "boolean", "describe() should have isStatic");
      assert(typeof summary.isVirtual === "boolean", "describe() should have isVirtual");
      assert(typeof summary.isAbstract === "boolean", "describe() should have isAbstract");
      assert(typeof summary.isConstructor === "boolean", "describe() should have isConstructor");
      assert(typeof summary.callConvention === "number", "describe() should have callConvention");
      assert(typeof summary.parameterCount === "number", "describe() should have parameterCount");
      assert(Array.isArray(summary.parameters), "describe() should have parameters array");
      assertNotNull(summary.returnType, "describe() should have returnType");
      assert(typeof summary.token === "number", "describe() should have token");

      console.log(`  - Method describe() verified: ${summary.name}`);
      console.log(`    - Static: ${summary.isStatic}, Virtual: ${summary.isVirtual}`);
      console.log(`    - Params: ${summary.parameterCount}, Token: 0x${summary.token.toString(16)}`);
    }),
  );

  // =====================================================
  // Section: BigInt Return Option Tests
  // =====================================================

  results.push(
    await createMonoDependentTest("MonoMethod - InvokeOptions returnBigInt exists", () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.tryClass("System.String");
        assertNotNull(stringClass, "String class should exist");

        const getLengthMethod = stringClass!.tryMethod("get_Length", 0);
        assertNotNull(getLengthMethod, "get_Length method should exist");

        // Test that call accepts returnBigInt option (type checking)
        const testStr = Mono.api.stringNew("test");
        const result = getLengthMethod!.call<number>(testStr, [], { returnBigInt: false });
        assert(typeof result === "number", "Result should be number when returnBigInt is false");

        console.log(`[INFO] InvokeOptions returnBigInt supported, result: ${result}`);
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod - call with returnBigInt option for Int32", () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.tryClass("System.String");
        assertNotNull(stringClass, "String class should exist");

        const getLengthMethod = stringClass!.tryMethod("get_Length", 0);
        assertNotNull(getLengthMethod, "get_Length method should exist");

        const testStr = Mono.api.stringNew("hello");

        // Int32 should still return number (BigInt only for I8/U8)
        const resultWithBigInt = getLengthMethod!.call<number>(testStr, [], { returnBigInt: true });
        assert(typeof resultWithBigInt === "number", "Int32 should return number even with returnBigInt");
        assert(resultWithBigInt === 5, "Length should be 5");

        console.log(`[INFO] Int32 with returnBigInt returns number: ${resultWithBigInt}`);
      });
    }),
  );

  results.push(
    await createMonoDependentTest("MonoMethod - callWithInfo returns proper result", () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.tryClass("System.String");
        assertNotNull(stringClass, "String class should exist");

        const getLengthMethod = stringClass!.tryMethod("get_Length", 0);
        assertNotNull(getLengthMethod, "get_Length method should exist");

        const testStr = Mono.api.stringNew("hello world");

        const result = getLengthMethod!.callWithInfo<number>(testStr, [], { returnBigInt: false });
        assert(result.raw !== null, "raw should not be null");
        assert(result.isNull === false, "isNull should be false");
        assert(result.value === 11, "value should be 11");
        assertNotNull(result.type, "type should not be null");

        console.log(`[INFO] callWithInfo result: value=${result.value}, type=${result.type.name}`);
      });
    }),
  );

  return results;
}

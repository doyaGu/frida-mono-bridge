/**
 * Method Operations Tests
 */

import Mono from "../src";
import { MonoMethod } from "../src/model/method";
import { MonoImage } from "../src/model/image";
import { createMonoString } from "../src/model/string";
import { MonoManagedExceptionError } from "../src/runtime/api";
import { TestResult, TestSuite, assert, createTest, assertPerformWorks } from "./test-framework";

const CORELIB_CANDIDATES = ["mscorlib", "System.Private.CoreLib", "netstandard"];

let cachedCorlibImage: MonoImage | null = null;
let cachedStringToUtf8: ((input: NativePointer) => NativePointer) | null = null;

function getCorlibImage(): MonoImage {
  if (cachedCorlibImage) {
    return cachedCorlibImage;
  }

  return Mono.perform(() => {
    for (const name of CORELIB_CANDIDATES) {
      const namePtr = Memory.allocUtf8String(name);
      const imagePtr = Mono.api.native.mono_image_loaded(namePtr);
      if (!imagePtr.isNull()) {
        cachedCorlibImage = new MonoImage(Mono.api, imagePtr);
        return cachedCorlibImage;
      }
    }

    throw new Error(`Unable to locate core library image (tried: ${CORELIB_CANDIDATES.join(", ")})`);
  });
}

function getStringToUtf8(): (input: NativePointer) => NativePointer {
  if (cachedStringToUtf8) {
    return cachedStringToUtf8;
  }
  
  // Use the Mono API directly instead of Module.findExportByName
  if (Mono.api.hasExport("mono_string_to_utf8")) {
    cachedStringToUtf8 = Mono.api.native.mono_string_to_utf8 as (input: NativePointer) => NativePointer;
    return cachedStringToUtf8;
  }
  
  throw new Error("mono_string_to_utf8 export not available on this Mono runtime");
}

function readManagedString(pointer: NativePointer): string {
  if (pointer.isNull()) {
    return "";
  }
  return Mono.perform(() => {
    const toUtf8 = getStringToUtf8();
    const utf8Ptr = toUtf8(pointer);
    if (utf8Ptr.isNull()) {
      return "";
    }
    try {
      return utf8Ptr.readUtf8String() ?? "";
    } finally {
      Mono.api.native.mono_free(utf8Ptr);
    }
  });
}

function readManagedBool(pointer: NativePointer): boolean {
  if (pointer.isNull()) {
    throw new Error("Expected boxed boolean value but received NULL pointer");
  }
  return Mono.perform(() => {
    const unboxed = Mono.api.native.mono_object_unbox(pointer);
    return unboxed.readU8() !== 0;
  });
}

export function testMethodOperations(): TestResult {
  console.log("\nMethod Operations:");

  const suite = new TestSuite("Method Operations");

  // Basic API availability tests
  suite.addResult(createTest("Mono.perform should work for method tests", () => {
    assertPerformWorks("Mono.perform() should work for method tests");
  }));

  suite.addResult(createTest("Method-related exports should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_get_name"), "mono_method_get_name should be available");
      assert(Mono.api.hasExport("mono_method_desc_new"), "mono_method_desc_new should be available");
      assert(Mono.api.hasExport("mono_method_desc_search_in_image"), "mono_method_desc_search_in_image should be available");
      assert(Mono.api.hasExport("mono_runtime_invoke"), "mono_runtime_invoke should be available");
    });
  }));

  // Test method discovery and basic operations
  suite.addResult(createTest("Should find and validate System.String methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");
      if (!stringClass) {
        console.log("    System.String class not found");
        return;
      }

      const methods = stringClass.getMethods();
      assert(methods.length > 0, "System.String should have methods");

      // Find specific methods
      const concatMethod = stringClass.method("Concat", 2);
      if (concatMethod) {
        assert(concatMethod.getName() === "Concat", "Method name should match");
        assert(concatMethod.getParamCount() === 2, "Parameter count should match");
        console.log(`    Found Concat method with ${concatMethod.getParamCount()} parameters`);
      }

      const lengthMethod = stringClass.method("get_Length", 0);
      if (lengthMethod) {
        assert(lengthMethod.getName() === "get_Length", "Property getter should be found");
        console.log(`    Found Length property getter`);
      }
    });
  }));

  // Test method invocation with actual Mono runtime
  suite.addResult(createTest("Should invoke static string methods", () => {
    try {
      const corlib = getCorlibImage();
      const isNullOrEmpty = MonoMethod.find(Mono.api, corlib, "System.String:IsNullOrEmpty(string)");

      // Test with empty string
      const emptyResult = isNullOrEmpty.invoke(null, [""]);
      assert(readManagedBool(emptyResult), "Empty string should return true");

      // Test with non-empty string
      const nonEmptyResult = isNullOrEmpty.invoke(null, ["test"]);
      assert(!readManagedBool(nonEmptyResult), "Non-empty string should return false");

      // Test with null
      const nullResult = isNullOrEmpty.invoke(null, [null]);
      assert(readManagedBool(nullResult), "Null string should return true");

      console.log("    String.IsNullOrEmpty method works correctly");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unable to locate core library")) {
        console.log("    (Skipped: Core library not available)");
        return;
      }
      throw error;
    }
  }));

  suite.addResult(createTest("Should invoke string concatenation", () => {
    try {
      const corlib = getCorlibImage();
      const concat = MonoMethod.find(Mono.api, corlib, "System.String:Concat(string,string)");

      const resultPtr = concat.invoke(null, ["Hello ", "World"]);
      const resultText = readManagedString(resultPtr);
      assert(resultText === "Hello World", "String concatenation should work");

      console.log(`    Concat result: "${resultText}"`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unable to locate core library")) {
        console.log("    (Skipped: Core library not available)");
        return;
      }
      throw error;
    }
  }));

  suite.addResult(createTest("Should invoke instance methods", () => {
    try {
      const corlib = getCorlibImage();
      const toUpper = MonoMethod.find(Mono.api, corlib, "System.String:ToUpperInvariant()");

      const instance = createMonoString(Mono.api, "Frida Test");
      const resultPtr = toUpper.invoke(instance, []);
      const resultText = readManagedString(resultPtr);
      assert(resultText === "FRIDA TEST", "Instance method should work");

      console.log(`    ToUpperInvariant result: "${resultText}"`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unable to locate core library")) {
        console.log("    (Skipped: Core library not available)");
        return;
      }
      throw error;
    }
  }));

  suite.addResult(createTest("Should handle method exceptions", () => {
    try {
      const corlib = getCorlibImage();
      const parseInt = MonoMethod.find(Mono.api, corlib, "System.Int32:Parse(string)");

      // This should throw a managed exception
      try {
        parseInt.invoke(null, ["not-a-number"]);
        assert(false, "Should have thrown exception");
      } catch (error) {
        assert(error instanceof MonoManagedExceptionError, "Should throw MonoManagedExceptionError");
        console.log("    Managed exception correctly propagated");
      }

      // Test with exception suppression
      const suppressedResult = parseInt.invoke(null, ["still-not-a-number"], { throwOnManagedException: false });
      assert(suppressedResult.isNull(), "Suppressed exception should return NULL");
      console.log("    Exception suppression works");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unable to locate core library")) {
        console.log("    (Skipped: Core library not available)");
        return;
      }
      throw error;
    }
  }));

  suite.addResult(createTest("Should find Unity-specific methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find common Unity classes
      const gameObjectClass = domain.class("UnityEngine.GameObject");
      if (gameObjectClass) {
        const methods = gameObjectClass.getMethods();
        console.log(`    UnityEngine.GameObject found with ${methods.length} methods`);

        // Look for common GameObject methods
        const getNameMethod = gameObjectClass.method("get_Name", 0);
        const setActiveMethod = gameObjectClass.method("SetActive", 1);

        if (getNameMethod) console.log("    Found GameObject.GetName method");
        if (setActiveMethod) console.log("    Found GameObject.SetActive method");
      }

      const transformClass = domain.class("UnityEngine.Transform");
      if (transformClass) {
        const methods = transformClass.getMethods();
        console.log(`    UnityEngine.Transform found with ${methods.length} methods`);
      }
    });
  }));

  suite.addResult(createTest("Should invoke Unity component methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to work with actual Unity objects if available
      const gameObjectClass = domain.class("UnityEngine.GameObject");
      if (gameObjectClass) {
        const findMethod = gameObjectClass.method("Find", 1);
        if (findMethod) {
          try {
            // Try to find a GameObject (might return null if not found)
            const result = findMethod.invoke(null, ["Player"]);
            console.log(`    GameObject.Find returned: ${result}`);
          } catch (error) {
            console.log(`    GameObject.Find failed: ${error}`);
          }
        }
      }
    });
  }));

  suite.addResult(createTest("Should work with method overloads", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        // Test finding overloaded methods
        const concat2Args = stringClass.method("Concat", 2);
        const concat3Args = stringClass.method("Concat", 3);

        if (concat2Args) console.log("    Found Concat with 2 arguments");
        if (concat3Args) console.log("    Found Concat with 3 arguments");

        // Test that different overloads have different parameter counts
        if (concat2Args && concat3Args) {
          assert(concat2Args.getParamCount() !== concat3Args.getParamCount(), "Overloads should have different parameter counts");
        }
      }
    });
  }));

  suite.addResult(createTest("Should handle generic methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find common generic methods
      const listClass = domain.class("System.Collections.Generic.List`1");
      if (listClass) {
        console.log("    Found generic List`1 class");

        const addMethod = listClass.method("Add", 1);
        if (addMethod) {
          console.log("    Found List.Add method");
        }
      }
    });
  }));

  suite.addResult(createTest("Should validate method signatures", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const methods = stringClass.getMethods();

        // Find methods and validate their signatures
        for (const method of methods.slice(0, 5)) { // Check first 5 methods
          const name = method.getName();
          const paramCount = method.getParamCount();

          assert(typeof name === "string", "Method name should be string");
          assert(typeof paramCount === "number", "Parameter count should be number");
          assert(paramCount >= 0, "Parameter count should be non-negative");
        }

        console.log(`    Validated ${Math.min(5, methods.length)} method signatures`);
      }
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Method Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} method tests passed`,
  };
}
/**
 * Generic Types Debug Test
 *
 * Tests makeGenericType and makeGenericMethod results in detail
 */

import Mono from "../../src";

console.log("=== Generic Type Debug Test ===");

Mono.perform(() => {
  // Test 1: Create List<String>
  console.log("\n--- Test 1: List<String> ---");
  const listDef = Mono.domain.class("System.Collections.Generic.List`1");
  const stringClass = Mono.domain.class("System.String");

  console.log("listDef:", listDef?.getFullName());
  console.log("isGenericTypeDefinition:", listDef?.isGenericTypeDefinition());
  console.log("getGenericParameterCount:", listDef?.getGenericParameterCount());

  const listOfString = listDef?.makeGenericType([stringClass!]);
  console.log("\nResult:", listOfString?.getFullName());
  console.log("isConstructedGenericType:", listOfString?.isConstructedGenericType());
  console.log("isGenericTypeDefinition result:", listOfString?.isGenericTypeDefinition());
  console.log("isGenericType:", listOfString?.isGenericType());

  // 尝试获取泛型参数
  const argCount = listOfString?.getGenericArgumentCount();
  console.log("Generic argument count:", argCount);

  const args = listOfString?.getGenericArguments();
  console.log(
    "Generic arguments:",
    args?.map(a => a.getFullName()),
  );

  // 检查 MonoType
  const monoType = listOfString?.getType();
  console.log("MonoType kind:", monoType?.getKind());

  // Test 2: Create instance
  console.log("\n--- Test 2: Create Instance ---");
  if (listOfString) {
    try {
      const instance = listOfString.newObject();
      console.log("Instance created:", instance ? "yes" : "no");
      console.log("Instance class:", instance?.getClass().getFullName());

      // Try to call Add method
      const addMethod = listOfString.tryGetMethod("Add", 1);
      console.log("Add method:", addMethod?.getFullName());
    } catch (e) {
      console.log("Error creating instance:", e);
    }
  }

  // Test 3: Dictionary<String, Int32>
  console.log("\n--- Test 3: Dictionary<String, Int32> ---");
  const dictDef = Mono.domain.class("System.Collections.Generic.Dictionary`2");
  const intClass = Mono.domain.class("System.Int32");

  if (dictDef && stringClass && intClass) {
    const dictOfStringInt = dictDef.makeGenericType([stringClass, intClass]);
    console.log("Result:", dictOfStringInt?.getFullName());
    console.log("isConstructedGenericType:", dictOfStringInt?.isConstructedGenericType());
    console.log("Generic argument count:", dictOfStringInt?.getGenericArgumentCount());
    console.log(
      "Generic arguments:",
      dictOfStringInt?.getGenericArguments().map(a => a.getFullName()),
    );
  }

  // Test 4: makeGenericMethod - Array.Empty<T>
  console.log("\n--- Test 4: makeGenericMethod - Array.Empty<T> ---");
  const arrayClass = Mono.domain.class("System.Array");
  if (arrayClass) {
    const methods = arrayClass.methods;
    const emptyMethod = methods.find(m => m.getName() === "Empty" && m.isGenericMethodDefinition());

    if (emptyMethod) {
      console.log("Found Empty<T>:", emptyMethod.getFullName());
      console.log("isGenericMethodDefinition:", emptyMethod.isGenericMethodDefinition());
      console.log("getGenericArgumentCount:", emptyMethod.getGenericArgumentCount());

      // Check available APIs
      console.log("\nAvailable APIs:");
      console.log("  mono_class_inflate_generic_method:", Mono.api.hasExport("mono_class_inflate_generic_method"));
      console.log("  mono_get_inflated_method:", Mono.api.hasExport("mono_get_inflated_method"));
      console.log("  mono_method_get_object:", Mono.api.hasExport("mono_method_get_object"));
      console.log("  mono_unity_method_make_generic:", Mono.api.hasExport("mono_unity_method_make_generic"));
      console.log("  mono_reflection_get_method:", Mono.api.hasExport("mono_reflection_get_method"));

      const emptyString = emptyMethod.makeGenericMethod([stringClass!]);
      if (emptyString) {
        console.log("\nResult:", emptyString.getFullName());
        console.log("isGenericMethodDefinition result:", emptyString.isGenericMethodDefinition());
      } else {
        console.log("\nmakeGenericMethod returned null");
      }
    } else {
      console.log("Array.Empty<T> not found");
    }
  }

  // Test 5: Enumerable.Where<T>
  console.log("\n--- Test 5: makeGenericMethod - Enumerable.Where<T> ---");
  const enumerable = Mono.domain.class("System.Linq.Enumerable");
  if (enumerable) {
    const methods = enumerable.methods;
    const whereMethod = methods.find(
      m => m.getName() === "Where" && m.isGenericMethodDefinition() && m.getGenericArgumentCount() === 1,
    );

    if (whereMethod) {
      console.log("Found Where<T>:", whereMethod.getFullName());
      console.log("isGenericMethodDefinition:", whereMethod.isGenericMethodDefinition());

      const whereInt = whereMethod.makeGenericMethod([intClass!]);
      if (whereInt) {
        console.log("Result:", whereInt.getFullName());
      } else {
        console.log("makeGenericMethod returned null");
      }
    } else {
      console.log("Where<T> not found");
    }
  } else {
    console.log("System.Linq.Enumerable not found");
  }
});

console.log("\n=== Test Complete ===");

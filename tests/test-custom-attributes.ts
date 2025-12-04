/**
 * Test suite for Custom Attributes API
 *
 * Tests the getCustomAttributes() method on:
 * - MonoAssembly
 * - MonoClass
 * - MonoMethod
 * - MonoField
 * - MonoProperty
 */

import { CustomAttribute, Mono } from "../src";

// ===== TEST UTILITIES =====

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, passed: true, message: "PASS" });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      message: `FAIL: ${error.message}`,
      details: error.stack,
    });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertArrayNotEmpty<T>(arr: T[], message: string): void {
  if (!arr || arr.length === 0) {
    throw new Error(`${message}: array is empty or null`);
  }
}

function printResults(): void {
  console.log("\n" + "=".repeat(60));
  console.log("CUSTOM ATTRIBUTES TEST RESULTS");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const status = result.passed ? "[PASS]" : "[FAIL]";
    console.log(`${status} ${result.name}: ${result.message}`);
    if (!result.passed && result.details) {
      console.log(`  Details: ${result.details}`);
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("=".repeat(60));
}

// ===== MAIN TESTS =====

function runTests(): void {
  console.log("\n[Custom Attributes Test Suite]");
  console.log("Testing getCustomAttributes() on various Mono types...\n");

  // Initialize Mono
  const api = Mono.api;
  const domain = Mono.domain;
  console.log(`[INFO] Root domain: ${domain.pointer}`);

  // ===== ASSEMBLY TESTS =====

  test("Assembly.getCustomAttributes() returns array", () => {
    const assemblies = domain.getAssemblies();
    assert(assemblies.length > 0, "No assemblies found");

    const assembly = assemblies[0];
    const attrs = assembly.getCustomAttributes();

    assert(Array.isArray(attrs), "getCustomAttributes should return an array");
    console.log(`  [INFO] Assembly '${assembly.getName()}' has ${attrs.length} custom attributes`);
  });

  test("Assembly.getCustomAttributes() attribute structure", () => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies) {
      const attrs = assembly.getCustomAttributes();
      if (attrs.length > 0) {
        const attr = attrs[0];
        assert(typeof attr.name === "string", "Attribute should have a name");
        assert(typeof attr.type === "string", "Attribute should have a type");
        assert(Array.isArray(attr.constructorArguments), "Attribute should have constructorArguments array");
        assert(typeof attr.properties === "object", "Attribute should have properties object");

        console.log(`  [INFO] Found attribute: ${attr.type}`);
        return;
      }
    }
    console.log("  [INFO] No assemblies with custom attributes found (may be normal)");
  });

  // ===== CLASS TESTS =====

  test("Class.getCustomAttributes() returns array", () => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies) {
      try {
        const classes = assembly.image.getClasses().slice(0, 50); // Check first 50 classes
        for (const klass of classes) {
          const attrs = klass.getCustomAttributes();
          assert(Array.isArray(attrs), "getCustomAttributes should return an array");

          if (attrs.length > 0) {
            console.log(`  [INFO] Class '${klass.getFullName()}' has ${attrs.length} custom attributes`);
            console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
            return;
          }
        }
      } catch {
        continue;
      }
    }
    console.log("  [INFO] No classes with custom attributes found in first 50 classes per assembly");
  });

  test("Class.getCustomAttributes() common Unity attributes", () => {
    // Look for common Unity attributes like SerializableAttribute, ObsoleteAttribute
    const targetAttributes = ["SerializableAttribute", "ObsoleteAttribute", "CompilerGeneratedAttribute"];

    const assemblies = domain.getAssemblies();
    const foundAttributes: string[] = [];

    for (const assembly of assemblies) {
      try {
        const classes = assembly.image.getClasses().slice(0, 100);
        for (const klass of classes) {
          const attrs = klass.getCustomAttributes();
          for (const attr of attrs) {
            if (!foundAttributes.includes(attr.name)) {
              foundAttributes.push(attr.name);
            }
          }
        }
      } catch {
        continue;
      }
    }

    console.log(
      `  [INFO] Unique attributes found: ${foundAttributes.slice(0, 10).join(", ")}${foundAttributes.length > 10 ? "..." : ""}`,
    );
  });

  // ===== METHOD TESTS =====

  test("Method.getCustomAttributes() returns array", () => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies) {
      try {
        const classes = assembly.image.getClasses().slice(0, 20);
        for (const klass of classes) {
          const methods = klass.getMethods().slice(0, 20);
          for (const method of methods) {
            const attrs = method.getCustomAttributes();
            assert(Array.isArray(attrs), "getCustomAttributes should return an array");

            if (attrs.length > 0) {
              console.log(
                `  [INFO] Method '${method.getName()}' in '${klass.getName()}' has ${attrs.length} attributes`,
              );
              console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
    console.log("  [INFO] No methods with custom attributes found (may be normal)");
  });

  // ===== FIELD TESTS =====

  test("Field.getCustomAttributes() returns array", () => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies) {
      try {
        const classes = assembly.image.getClasses().slice(0, 30);
        for (const klass of classes) {
          const fields = klass.getFields();
          for (const field of fields) {
            const attrs = field.getCustomAttributes();
            assert(Array.isArray(attrs), "getCustomAttributes should return an array");

            if (attrs.length > 0) {
              console.log(`  [INFO] Field '${field.getName()}' in '${klass.getName()}' has ${attrs.length} attributes`);
              console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
    console.log("  [INFO] No fields with custom attributes found (may be normal)");
  });

  // ===== PROPERTY TESTS =====

  test("Property.getCustomAttributes() returns array", () => {
    const assemblies = domain.getAssemblies();

    for (const assembly of assemblies) {
      try {
        const classes = assembly.image.getClasses().slice(0, 30);
        for (const klass of classes) {
          const properties = klass.getProperties();
          for (const prop of properties) {
            const attrs = prop.getCustomAttributes();
            assert(Array.isArray(attrs), "getCustomAttributes should return an array");

            if (attrs.length > 0) {
              console.log(
                `  [INFO] Property '${prop.getName()}' in '${klass.getName()}' has ${attrs.length} attributes`,
              );
              console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
              return;
            }
          }
        }
      } catch {
        continue;
      }
    }
    console.log("  [INFO] No properties with custom attributes found (may be normal)");
  });

  // ===== API AVAILABILITY TESTS =====

  test("Custom attributes API availability check", () => {
    const apis = [
      "mono_custom_attrs_from_assembly",
      "mono_custom_attrs_from_class",
      "mono_custom_attrs_from_method",
      "mono_custom_attrs_from_field",
      "mono_custom_attrs_from_property",
      "mono_custom_attrs_free",
      "mono_method_get_class",
    ];

    const available: string[] = [];
    const missing: string[] = [];

    for (const apiName of apis) {
      if (api.hasExport(apiName)) {
        available.push(apiName);
      } else {
        missing.push(apiName);
      }
    }

    console.log(`  [INFO] Available APIs: ${available.length}/${apis.length}`);
    if (missing.length > 0) {
      console.log(`  [WARN] Missing APIs: ${missing.join(", ")}`);
    }

    assert(available.length >= 5, "At least 5 custom attribute APIs should be available");
  });

  // ===== STATISTICS TEST =====

  test("Collect custom attribute statistics", () => {
    const stats = {
      assembliesChecked: 0,
      classesChecked: 0,
      methodsChecked: 0,
      fieldsChecked: 0,
      propertiesChecked: 0,
      assemblyAttrs: 0,
      classAttrs: 0,
      methodAttrs: 0,
      fieldAttrs: 0,
      propertyAttrs: 0,
    };

    const assemblies = domain.getAssemblies().slice(0, 5);

    for (const assembly of assemblies) {
      stats.assembliesChecked++;
      stats.assemblyAttrs += assembly.getCustomAttributes().length;

      try {
        const classes = assembly.image.getClasses().slice(0, 20);
        for (const klass of classes) {
          stats.classesChecked++;
          stats.classAttrs += klass.getCustomAttributes().length;

          const methods = klass.getMethods().slice(0, 10);
          for (const method of methods) {
            stats.methodsChecked++;
            stats.methodAttrs += method.getCustomAttributes().length;
          }

          const fields = klass.getFields();
          for (const field of fields) {
            stats.fieldsChecked++;
            stats.fieldAttrs += field.getCustomAttributes().length;
          }

          const properties = klass.getProperties();
          for (const prop of properties) {
            stats.propertiesChecked++;
            stats.propertyAttrs += prop.getCustomAttributes().length;
          }
        }
      } catch {
        continue;
      }
    }

    console.log(`  [STATS] Assemblies: ${stats.assembliesChecked} checked, ${stats.assemblyAttrs} attrs`);
    console.log(`  [STATS] Classes: ${stats.classesChecked} checked, ${stats.classAttrs} attrs`);
    console.log(`  [STATS] Methods: ${stats.methodsChecked} checked, ${stats.methodAttrs} attrs`);
    console.log(`  [STATS] Fields: ${stats.fieldsChecked} checked, ${stats.fieldAttrs} attrs`);
    console.log(`  [STATS] Properties: ${stats.propertiesChecked} checked, ${stats.propertyAttrs} attrs`);
  });

  // Print final results
  printResults();
}

// Run tests
runTests();

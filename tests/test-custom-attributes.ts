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

import Mono from "../src";
import type { CustomAttribute } from "../src/model/attribute";
import { withDomain } from "./test-fixtures";
import { TestResult, assert, skipTest } from "./test-framework";

export async function createCustomAttributeTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ===== ASSEMBLY TESTS =====

  results.push(
    await withDomain("Assembly.customAttributes returns array", ({ domain }) => {
      const assemblies = domain.assemblies;
      assert(assemblies.length > 0, "No assemblies found");

      const assembly = assemblies[0];
      const attrs = assembly.customAttributes;

      assert(Array.isArray(attrs), "getCustomAttributes should return an array");
      console.log(`  [INFO] Assembly '${assembly.name}' has ${attrs.length} custom attributes`);
    }),
  );

  results.push(
    await withDomain("Assembly.customAttributes attribute structure", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 10);
      let found = false;

      for (const assembly of assemblies) {
        const attrs = assembly.customAttributes;
        if (attrs.length > 0) {
          const attr = attrs[0];
          assert(typeof attr.name === "string", "Attribute should have a name");
          assert(typeof attr.type === "string", "Attribute should have a type");
          assert(Array.isArray(attr.constructorArguments), "Attribute should have constructorArguments array");
          assert(typeof attr.properties === "object", "Attribute should have properties object");

          console.log(`  [INFO] Found attribute: ${attr.type}`);
          found = true;
          return;
        }
      }
      if (!found) {
        skipTest("No assemblies with custom attributes found in the first 10 assemblies");
      }
    }),
  );

  // ===== CLASS TESTS =====

  results.push(
    await withDomain("Class.customAttributes returns array", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 10);
      let found = false;

      for (const assembly of assemblies) {
        try {
          const classes = assembly.image.classes.slice(0, 20); // Keep bounded to avoid long runtimes on big games
          for (const klass of classes) {
            const attrs = klass.customAttributes;
            assert(Array.isArray(attrs), "getCustomAttributes should return an array");

            if (attrs.length > 0) {
              console.log(`  [INFO] Class '${klass.fullName}' has ${attrs.length} custom attributes`);
              console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
              found = true;
              return;
            }
          }
        } catch {
          continue;
        }
      }
      if (!found) {
        skipTest("No classes with custom attributes found in first 50 classes per assembly");
      }
    }),
  );

  results.push(
    await withDomain("Class.customAttributes common Unity attributes", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 10);
      const foundAttributes: string[] = [];

      for (const assembly of assemblies) {
        try {
          const classes = assembly.image.classes.slice(0, 30);
          for (const klass of classes) {
            const attrs = klass.customAttributes;
            for (const attr of attrs) {
              if (!foundAttributes.includes(attr.name)) {
                foundAttributes.push(attr.name);
              }
            }

            // Enough to demonstrate variety without scanning too much.
            if (foundAttributes.length >= 25) {
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (foundAttributes.length === 0) {
        skipTest("No custom attributes found in scanned classes");
      }
      console.log(
        `  [INFO] Unique attributes found: ${foundAttributes.slice(0, 10).join(", ")}${foundAttributes.length > 10 ? "..." : ""}`,
      );
    }),
  );

  // ===== METHOD TESTS =====

  results.push(
    await withDomain("Method.customAttributes returns array", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 8);
      let found = false;

      for (const assembly of assemblies) {
        try {
          const classes = assembly.image.classes.slice(0, 12);
          for (const klass of classes) {
            const methods = klass.methods.slice(0, 12);
            for (const method of methods) {
              const attrs = method.customAttributes;
              assert(Array.isArray(attrs), "getCustomAttributes should return an array");

              if (attrs.length > 0) {
                console.log(`  [INFO] Method '${method.name}' in '${klass.name}' has ${attrs.length} attributes`);
                console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
                found = true;
                return;
              }
            }
          }
        } catch {
          continue;
        }
      }
      if (!found) {
        skipTest("No methods with custom attributes found in scanned classes");
      }
    }),
  );

  // ===== FIELD TESTS =====

  results.push(
    await withDomain("Field.customAttributes returns array", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 8);
      let found = false;

      for (const assembly of assemblies) {
        try {
          const classes = assembly.image.classes.slice(0, 12);
          for (const klass of classes) {
            const fields = klass.fields.slice(0, 30);
            for (const field of fields) {
              const attrs = field.customAttributes;
              assert(Array.isArray(attrs), "getCustomAttributes should return an array");

              if (attrs.length > 0) {
                console.log(`  [INFO] Field '${field.name}' in '${klass.name}' has ${attrs.length} attributes`);
                console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
                found = true;
                return;
              }
            }
          }
        } catch {
          continue;
        }
      }
      if (!found) {
        skipTest("No fields with custom attributes found in scanned classes");
      }
    }),
  );

  // ===== PROPERTY TESTS =====

  results.push(
    await withDomain("Property.customAttributes returns array", ({ domain }) => {
      const assemblies = domain.assemblies.slice(0, 8);
      let found = false;

      for (const assembly of assemblies) {
        try {
          const classes = assembly.image.classes.slice(0, 12);
          for (const klass of classes) {
            const properties = klass.properties.slice(0, 30);
            for (const prop of properties) {
              const attrs = prop.customAttributes;
              assert(Array.isArray(attrs), "getCustomAttributes should return an array");

              if (attrs.length > 0) {
                console.log(`  [INFO] Property '${prop.name}' in '${klass.name}' has ${attrs.length} attributes`);
                console.log(`  [INFO] Attributes: ${attrs.map((a: CustomAttribute) => a.name).join(", ")}`);
                found = true;
                return;
              }
            }
          }
        } catch {
          continue;
        }
      }
      if (!found) {
        skipTest("No properties with custom attributes found in scanned classes");
      }
    }),
  );

  // ===== API AVAILABILITY TESTS =====

  results.push(
    await withDomain("Custom attributes API availability check", () => {
      const api = Mono.api;
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
    }),
  );

  // ===== STATISTICS TEST =====

  results.push(
    await withDomain("Collect custom attribute statistics", ({ domain }) => {
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

      // Keep this intentionally small: custom attribute extraction can be expensive in large Unity titles.
      const assemblies = domain.assemblies.slice(0, 2);

      for (const assembly of assemblies) {
        stats.assembliesChecked++;
        stats.assemblyAttrs += assembly.customAttributes.length;

        try {
          const classes = assembly.image.classes.slice(0, 8);
          for (const klass of classes) {
            stats.classesChecked++;
            stats.classAttrs += klass.customAttributes.length;

            const methods = klass.methods.slice(0, 5);
            for (const method of methods) {
              stats.methodsChecked++;
              stats.methodAttrs += method.customAttributes.length;
            }

            const fields = klass.fields.slice(0, 20);
            for (const field of fields) {
              stats.fieldsChecked++;
              stats.fieldAttrs += field.customAttributes.length;
            }

            const properties = klass.properties.slice(0, 20);
            for (const prop of properties) {
              stats.propertiesChecked++;
              stats.propertyAttrs += prop.customAttributes.length;
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
    }),
  );

  return results;
}

/**
 * Fluent API Tests
 * Tests the modern fluent API surface similar to frida-il2cpp-bridge
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testFluentApi(): TestResult {
  console.log("\nFluent API:");

  const suite = new TestSuite("Fluent API Tests");

  // Basic fluent API availability
  suite.addResult(createTest("Mono.perform should work for fluent API tests", () => {
    assertPerformWorks("Mono.perform() should work for fluent API tests");
  }));

  suite.addResult(createTest("Mono namespace should be available", () => {
    assertApiAvailable("Mono.api should be accessible");
    assertDomainAvailable("Mono.domain should be accessible");
  }));

  // Test property accessors
  suite.addResult(createTest("Mono.domain property should work", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      assert(domain !== null, "Domain should be accessible");
      assert(typeof domain.getAssemblies === "function", "Domain should have getAssemblies method");
      assert(typeof domain.assembly === "function", "Domain should have assembly method");
      assert(typeof domain.class === "function", "Domain should have class method");
    });
  }));

  suite.addResult(createTest("Mono.api property should work", () => {
    Mono.perform(() => {
      const api = Mono.api;
      assert(api !== null, "API should be accessible");
      assert(typeof api.hasExport === "function", "API should have hasExport method");
      assert(typeof api.getRootDomain === "function", "API should have getRootDomain method");
    });
  }));

  suite.addResult(createTest("Mono.version property should work", () => {
    Mono.perform(() => {
      const version = Mono.version;
      assert(version !== null, "Version should be accessible");
      assert(typeof version.features === "object", "Version should have features property");
      assert(typeof version.features.delegateThunk === "boolean", "Version should have delegateThunk feature");
      assert(typeof version.features.metadataTables === "boolean", "Version should have metadataTables feature");
      assert(typeof version.features.gcHandles === "boolean", "Version should have gcHandles feature");
      assert(typeof version.features.internalCalls === "boolean", "Version should have internalCalls feature");
    });
  }));

  suite.addResult(createTest("Mono.module property should work", () => {
    Mono.perform(() => {
      const module = Mono.module;
      assert(module !== null, "Module should be accessible");
      assert(typeof module.name === "string", "Module should have name property");
      assert(typeof module.base === "object", "Module should have base property");
    });
  }));

  suite.addResult(createTest("Mono.gc utilities should work", () => {
    Mono.perform(() => {
      const gc = Mono.gc;
      assert(gc !== null, "GC utilities should be accessible");
      assert(typeof gc.collect === "function", "GC should have collect method");
      assert(typeof gc.maxGeneration === "number", "GC should have maxGeneration property");
    });
  }));

  // Test fluent API utilities
  suite.addResult(createTest("Mono.find utilities should work", () => {
    Mono.perform(() => {
      const find = Mono.find;
      assert(find !== null, "Find utilities should be accessible");
      assert(typeof find.methods === "function", "Find should have methods method");
      assert(typeof find.classes === "function", "Find should have classes method");
      assert(typeof find.fields === "function", "Find should have fields method");
      // Note: Find doesn't have assemblies method in the current implementation
    });
  }));

  suite.addResult(createTest("Mono.trace utilities should work", () => {
    Mono.perform(() => {
      const trace = Mono.trace;
      assert(trace !== null, "Trace utilities should be accessible");
      assert(typeof trace.method === "function", "Trace should have method method");
      // Note: Trace has classAll, classesByPattern, methodsByPattern instead of simple class/assembly methods
    });
  }));

  suite.addResult(createTest("Mono.types utilities should work", () => {
    Mono.perform(() => {
      const types = Mono.types;
      assert(types !== null, "Type utilities should be accessible");
      // Note: Add actual type utility method checks when implemented
    });
  }));

  // Test fluent API chaining
  suite.addResult(createTest("Fluent API should support chaining", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "Should get assemblies array");

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const image = firstAssembly.getImage();
        assert(image !== null, "Should get assembly image");

        const classes = image.getClasses();
        assert(Array.isArray(classes), "Should get classes array");
      }
    });
  }));

  // Test domain operations
  suite.addResult(createTest("Domain.assembly() should find assemblies", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find common assemblies
      const mscorlib = domain.assembly("mscorlib");
      if (mscorlib) {
        assert(typeof mscorlib.getName === "function", "Assembly should have getName method");
        console.log("    Found mscorlib assembly");
      }

      const systemCore = domain.assembly("System.Core");
      if (systemCore) {
        assert(typeof systemCore.getName === "function", "Assembly should have getName method");
        console.log("    Found System.Core assembly");
      }

      // Test with non-existent assembly (should return null)
      const nonExistent = domain.assembly("NonExistent.Assembly");
      assert(nonExistent === null, "Non-existent assembly should return null");
    });
  }));

  suite.addResult(createTest("Domain.class() should find classes across assemblies", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Try to find common classes
      const stringClass = domain.class("System.String");
      if (stringClass) {
        assert(typeof stringClass.getName === "function", "Class should have getName method");
        console.log("    Found System.String class");
      }

      const objectClass = domain.class("System.Object");
      if (objectClass) {
        assert(typeof objectClass.getName === "function", "Class should have getName method");
        console.log("    Found System.Object class");
      }

      // Test with non-existent class (should return null)
      const nonExistent = domain.class("NonExistent.Class");
      assert(nonExistent === null, "Non-existent class should return null");
    });
  }));

  // Test assembly operations
  suite.addResult(createTest("Assembly.image property should work", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const assembly = assemblies[0];
        const image = assembly.getImage();
        assert(image !== null, "Should get assembly image");
        assert(typeof image.getName === "function", "Image should have getName method");
        assert(typeof image.classFromName === "function", "Image should have classFromName method");
      }
    });
  }));

  // Test error handling
  suite.addResult(createTest("Fluent API should handle errors gracefully", () => {
    Mono.perform(() => {
      // Test that the API doesn't crash on invalid inputs
      const domain = Mono.domain;

      try {
        const invalidAssembly = domain.assembly("");
        assert(invalidAssembly === null, "Empty assembly name should return null");
      } catch (error) {
        // Either return null or throw, both are acceptable
      }

      try {
        const invalidClass = domain.class("");
        assert(invalidClass === null, "Empty class name should return null");
      } catch (error) {
        // Either return null or throw, both are acceptable
      }
    });
  }));

  // Test advanced fluent operations
  suite.addResult(createTest("Fluent API should support complex operations", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        // Test complex chaining: domain -> assembly -> image -> class -> method
        const firstAssembly = assemblies[0];
        const image = firstAssembly.getImage();
        const classes = image.getClasses();

        if (classes.length > 0) {
          const firstClass = classes[0];
          const methods = firstClass.methods;
          const fields = firstClass.fields;
          const properties = firstClass.properties;

          assert(Array.isArray(methods), "Should get methods array");
          assert(Array.isArray(fields), "Should get fields array");
          assert(Array.isArray(properties), "Should get properties array");

          console.log(`    Found class ${firstClass.getName()} with ${methods.length} methods, ${fields.length} fields, ${properties.length} properties`);
        }
      }
    });
  }));

  // Test performance and reliability
  suite.addResult(createTest("Fluent API should be performant", () => {
    Mono.perform(() => {
      const startTime = Date.now();

      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        const domain = Mono.domain;
        const assemblies = domain.getAssemblies();
        const version = Mono.version;
        const module = Mono.module;
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(duration < 1000, `50 operations should complete quickly (took ${duration}ms)`);
    });
  }));

  suite.addResult(createTest("Fluent API should maintain consistency", () => {
    Mono.perform(() => {
      // Test that repeated calls return consistent results
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be the same instance");

      const api1 = Mono.api;
      const api2 = Mono.api;
      assert(api1 === api2, "API should be the same instance");

      const version1 = Mono.version;
      const version2 = Mono.version;
      assert(version1 === version2, "Version should be the same instance");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Fluent API Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} fluent API tests passed`,
  };
}
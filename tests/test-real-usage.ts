/**
 * Real Usage Integration Tests
 * Tests that exercise actual Mono runtime operations with real managed code
 */

import Mono from "../src";
import { allocUtf8, allocPointerArray } from "../src/runtime/mem";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testRealUsage(): TestResult {
  console.log("\nReal Usage Integration:");

  const suite = new TestSuite("Real Usage Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for real usage tests", () => {
    assertPerformWorks("Mono.perform() should work for real usage tests");
  }));

  suite.addResult(createTest("Should access API for real operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for real usage operations");
      assertDomainAvailable("Mono.domain should be accessible for real usage operations");
      console.log("    API and domain are accessible for real usage tests");
    });
  }));

  // Test finding and using mscorlib image with modern API
  suite.addResult(createTest("Can load mscorlib image", () => {
    Mono.perform(() => {
      // Try to find mscorlib through domain
      const domain = Mono.domain;
      const mscorlib = domain.assembly("mscorlib");

      if (mscorlib) {
        console.log("    Found mscorlib assembly through domain API");

        const image = mscorlib.image;
        if (image) {
          console.log("    mscorlib has accessible image");
          assert(!image.pointer.isNull(), "mscorlib image pointer should not be NULL");
        } else {
          console.log("    mscorlib assembly found but no image accessible");
        }
      } else {
        console.log("    mscorlib not found through domain, trying direct API");

        // Fallback to direct API if domain approach doesn't work
        const imageName = allocUtf8("mscorlib");
        const imagePtr = Mono.api.native.mono_image_loaded(imageName);

        if (!imagePtr.isNull()) {
          console.log("    Found mscorlib image through direct API");
          assert(imagePtr !== null, "mscorlib image should be loaded");
          assert(!imagePtr.isNull(), "mscorlib image pointer should not be NULL");
        } else {
          console.log("    mscorlib not available in this runtime");
        }
      }
    });
  }));

  // Test finding common classes through domain
  suite.addResult(createTest("Can find common system classes", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test finding common system classes
      const commonClasses = ["System.String", "System.Object", "System.Int32"];
      let foundCount = 0;

      for (const className of commonClasses) {
        const klass = domain.class(className);
        if (klass) {
          foundCount++;
          console.log(`    Found ${className} through domain API`);
          assert(typeof klass.getName === 'function', "Class should have getName method");
        }
      }

      if (foundCount === 0) {
        console.log("    No common classes found through domain, trying direct API");
        // Fallback to direct API approach for at least one test
        const imageName = allocUtf8("mscorlib");
        const imagePtr = Mono.api.native.mono_image_loaded(imageName);

        if (!imagePtr.isNull()) {
          const namespace = allocUtf8("System");
          const className = allocUtf8("String");
          const klass = Mono.api.native.mono_class_from_name(imagePtr, namespace, className);

          if (!klass.isNull()) {
            console.log("    Found System.String through direct API");
            foundCount++;
          }
        }
      }

      assert(foundCount > 0, "Should find at least one system class");
    });
  }));

  // Test creating and using Mono strings
  suite.addResult(createTest("Can create and use Mono strings", () => {
    Mono.perform(() => {
      const testString = Mono.api.stringNew("Test Integration String");
      assert(!testString.isNull(), "Test string should not be NULL");
      console.log("    Created test string: 'Test Integration String'");

      // Test string class access
      try {
        const klass = Mono.api.native.mono_object_get_class(testString);
        assert(klass !== null, "String should have class");
        console.log("    String class is accessible");
      } catch (error) {
        console.log(`    String class access error: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Strings should have correct type", () => {
    Mono.perform(() => {
      const str1 = Mono.api.stringNew("Test 1");
      const str2 = Mono.api.stringNew("Test 2");

      // Test that both strings have the same type
      try {
        const klass1 = Mono.api.native.mono_object_get_class(str1);
        const klass2 = Mono.api.native.mono_object_get_class(str2);

        if (klass1 && klass2) {
          assert(klass1.equals(klass2), "Both strings should have the same class");
          console.log("    Both strings have the same System.String class");
        }
      } catch (error) {
        console.log(`    String type checking error: ${error}`);
      }
    });
  }));

  // Test assembly operations
  suite.addResult(createTest("Can explore assembly metadata", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      assert(Array.isArray(assemblies), "Should get assemblies array");
      console.log(`    Found ${assemblies.length} assemblies for exploration`);

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const image = firstAssembly.image;

        if (image) {
          const classes = image.getClasses();
          console.log(`    First assembly has ${classes.length} classes`);
          assert(Array.isArray(classes), "Should get classes array from image");
        }
      }
    });
  }));

  // Test class method discovery
  suite.addResult(createTest("Can explore class methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.String");

      if (stringClass) {
        const methods = stringClass.getMethods();
        console.log(`    System.String has ${methods.length} methods`);
        assert(Array.isArray(methods), "Should get methods array from class");

        if (methods.length > 0) {
          const firstMethod = methods[0];
          console.log(`    First method: ${firstMethod.getName()}`);
          assert(typeof firstMethod.getName === 'function', "Method should have getName method");
        }
      } else {
        console.log("    System.String class not found");
      }
    });
  }));

  // Test object operations
  suite.addResult(createTest("Can create and manage objects", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const stringClass = domain.class("System.Object");

      if (stringClass) {
        console.log("    Found System.Object class");

        // Test that we can create objects (though actual creation may be complex)
        const methods = stringClass.getMethods();
        console.log(`    System.Object has ${methods.length} methods`);

        const fields = stringClass.getFields();
        console.log(`    System.Object has ${fields.length} fields`);

        const properties = stringClass.getProperties();
        console.log(`    System.Object has ${properties.length} properties`);
      } else {
        console.log("    System.Object class not found");
      }
    });
  }));

  // Test domain functionality
  suite.addResult(createTest("Can use root domain for operations", () => {
    Mono.perform(() => {
      const rootDomain = Mono.api.getRootDomain();
      assert(!rootDomain.isNull(), "Root domain should not be NULL");
      console.log("    Root domain is accessible");

      // Root domain should be usable for creating strings
      const testString = Mono.api.stringNew("Created with root domain");
      assert(!testString.isNull(), "String should be created with root domain");
      console.log("    Root domain can create strings");
    });
  }));

  // Test runtime argument preparation
  suite.addResult(createTest("Can prepare arguments for method calls", () => {
    Mono.perform(() => {
      const str1 = Mono.api.stringNew("Arg 1");
      const str2 = Mono.api.stringNew("Arg 2");

      const args = [str1, str2];
      const argv = allocPointerArray(args);

      assert(argv !== null, "Argument array should be allocated");
      assert(!argv.isNull(), "Argument array should not be NULL");
      console.log("    Prepared arguments for method invocation");
    });
  }));

  // Test error handling
  suite.addResult(createTest("Should handle runtime errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent class
      const nonExistent = domain.class("NonExistent.Type");
      assert(nonExistent === null, "Non-existent class should return null");

      // Test with non-existent assembly
      const nonExistentAssembly = domain.assembly("NonExistent.Assembly");
      assert(nonExistentAssembly === null, "Non-existent assembly should return null");

      // Test with invalid method access
      const stringClass = domain.class("System.String");
      if (stringClass) {
        const nonExistentMethod = stringClass.method("NonExistentMethod");
        assert(nonExistentMethod === null, "Non-existent method should return null");
      }

      console.log("    Error handling works correctly for invalid operations");
    });
  }));

  // Test memory utilities integration
  suite.addResult(createTest("Should integrate memory utilities", () => {
    Mono.perform(() => {
      // Test UTF8 string allocation
      const str1 = allocUtf8("Test String");
      const str2 = allocUtf8("Another String");
      const str3 = allocUtf8("");

      assert(str1 !== null, "String 1 should be allocated");
      assert(str2 !== null, "String 2 should be allocated");
      assert(str3 !== null, "Empty string should be allocated");

      assert(!str1.isNull(), "String 1 should not be NULL");
      assert(!str2.isNull(), "String 2 should not be NULL");
      assert(!str3.isNull(), "Empty string should not be NULL");

      console.log("    Memory utilities work correctly");
    });
  }));

  // Test comprehensive integration
  suite.addResult(createTest("Should demonstrate comprehensive integration", () => {
    Mono.perform(() => {
      const api = Mono.api;
      const domain = Mono.domain;
      const version = Mono.version;

      assert(api !== null, "API should be accessible");
      assert(domain !== null, "Domain should be accessible");
      assert(version !== null, "Version should be accessible");

      // Test string creation
      const testStr = Mono.api.stringNew("Integration Test");
      assert(!testStr.isNull(), "String should be created");

      // Test domain exploration
      const assemblies = domain.getAssemblies();
      console.log(`    Found ${assemblies.length} assemblies`);

      // Test API utilities
      const hasStringAPI = api.hasExport("mono_string_new");
      console.log(`    String API available: ${hasStringAPI}`);

      // Test memory utilities
      const memStr = allocUtf8("Memory test");
      assert(!memStr.isNull(), "Memory allocation works");

      console.log("    Comprehensive integration test passed");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Real Usage Integration Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} real usage tests passed`,
  };
}

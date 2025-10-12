/**
 * Metadata Collection Tests
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testMetadataCollections(): TestResult {
  console.log("\nMetadata Collections:");

  const suite = new TestSuite("Metadata Collections");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for metadata collection tests", () => {
    assertPerformWorks("Mono.perform() should work for metadata collection tests");
  }));

  suite.addResult(createTest("Should access domain for metadata collection", () => {
    Mono.perform(() => {
      assertDomainAvailable("Mono.domain should be accessible for metadata operations");
      assertApiAvailable("Mono.api should be accessible for metadata operations");

      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      assert(Array.isArray(assemblies), "Should get assemblies array from domain");
      console.log(`    Found ${assemblies.length} assemblies for metadata collection`);
    });
  }));

  suite.addResult(createTest("Should collect assembly metadata through domain", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        // Collect assembly metadata manually using modern API
        const assemblySummaries = assemblies.map(assembly => ({
          name: assembly.getName(),
          assembly: assembly,
          hasImage: !!assembly.image
        }));

        assert(Array.isArray(assemblySummaries), "Should create assembly summaries array");
        assert(assemblySummaries.length === assemblies.length, "Should summarize all assemblies");

        const first = assemblySummaries[0];
        assert(typeof first.name === 'string', "Summary should have string name");
        assert(typeof first.assembly.getName === 'function', "Summary should expose MonoAssembly");

        console.log(`    Created ${assemblySummaries.length} assembly summaries`);
      } else {
        console.log("    No assemblies available for metadata collection");
      }
    });
  }));

  suite.addResult(createTest("Should collect class metadata through images", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        let totalClasses = 0;
        const classSummaries = [];

        for (const assembly of assemblies) {
          const image = assembly.image;
          if (image) {
            const classes = image.getClasses();
            totalClasses += classes.length;

            for (const klass of classes) {
              classSummaries.push({
                name: klass.getName(),
                namespace: klass.getNamespace ? klass.getNamespace() : 'Unknown',
                klass: klass,
                methodCount: klass.getMethods ? klass.getMethods().length : 0,
                fieldCount: klass.getFields ? klass.getFields().length : 0,
                propertyCount: klass.getProperties ? klass.getProperties().length : 0
              });
            }
          }
        }

        assert(Array.isArray(classSummaries), "Should create class summaries array");
        console.log(`    Collected metadata for ${totalClasses} classes across ${assemblies.length} assemblies`);

        if (classSummaries.length > 0) {
          const first = classSummaries[0];
          assert(typeof first.name === 'string', "Class summary should have name");
          assert(typeof first.klass.getName === 'function', "Summary should expose MonoClass");
        }
      } else {
        console.log("    No assemblies available for class metadata collection");
      }
    });
  }));

  suite.addResult(createTest("Should group classes by namespace", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const classes = [];

        // Collect all classes from all assemblies
        for (const assembly of assemblies) {
          const image = assembly.image;
          if (image) {
            const assemblyClasses = image.getClasses();
            classes.push(...assemblyClasses);
          }
        }

        // Group classes by namespace manually
        const namespaceIndex = new Map();
        for (const klass of classes) {
          const namespace = klass.getNamespace ? klass.getNamespace() : 'Unknown';
          if (!namespaceIndex.has(namespace)) {
            namespaceIndex.set(namespace, []);
          }
          namespaceIndex.get(namespace).push(klass);
        }

        assert(namespaceIndex instanceof Map, "Should create Map index for namespaces");
        assert(namespaceIndex.size > 0, "Should have at least one namespace");

        console.log(`    Grouped ${classes.length} classes into ${namespaceIndex.size} namespaces`);

        // Show some examples
        let exampleCount = 0;
        for (const [namespace, classList] of namespaceIndex) {
          if (exampleCount < 3) {
            console.log(`    ${namespace}: ${classList.length} classes`);
            exampleCount++;
          }
        }
      } else {
        console.log("    No assemblies available for namespace grouping");
      }
    });
  }));

  suite.addResult(createTest("Should support metadata collection in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const domain = Mono.domain;
        const assemblies = domain.getAssemblies();

        assert(Array.isArray(assemblies), "Nested perform should allow assembly access");

        if (assemblies.length > 0) {
          const firstAssembly = assemblies[0];
          const image = firstAssembly.image;
          if (image) {
            const classes = image.getClasses();
            assert(Array.isArray(classes), "Nested perform should allow class access");
          }
        }
      });
    });
  }));

  suite.addResult(createTest("Metadata collection should be consistent", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test multiple calls return consistent results
      const assemblies1 = domain.getAssemblies();
      const assemblies2 = domain.getAssemblies();

      assert(Array.isArray(assemblies1), "First call should return array");
      assert(Array.isArray(assemblies2), "Second call should return array");
      assert(assemblies1.length === assemblies2.length, "Assembly count should be consistent");

      // Test domain caching
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached instance");
    });
  }));

  suite.addResult(createTest("Should handle metadata collection errors gracefully", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test with non-existent assemblies
      const nonExistentAssembly = domain.assembly("NonExistent.Metadata.Assembly");
      assert(nonExistentAssembly === null, "Non-existent assembly should return null");

      // Test metadata collection with empty results
      try {
        const assemblies = domain.getAssemblies();
        if (assemblies.length === 0) {
          console.log("    No assemblies available - empty metadata collection handled gracefully");
        }

        // Should not throw even with no assemblies
        assert(Array.isArray(assemblies), "Empty assembly list should still be array");
      } catch (error) {
        console.log(`    Metadata collection error: ${error}`);
      }
    });
  }));

  suite.addResult(createTest("Should test different metadata collection patterns", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        // Test different collection strategies
        const strategies = [
          {
            name: "Assembly only",
            collect: () => assemblies.map(a => ({ name: a.getName(), assembly: a }))
          },
          {
            name: "Assembly + image",
            collect: () => assemblies.map(a => ({
              name: a.getName(),
              assembly: a,
              image: a.image,
              hasImage: !!a.image
            }))
          },
          {
            name: "Assembly + image + classes",
            collect: () => assemblies.map(a => {
              const image = a.image;
              return {
                name: a.getName(),
                assembly: a,
                image: image,
                classCount: image ? image.getClasses().length : 0
              };
            })
          }
        ];

        for (const strategy of strategies) {
          try {
            const result = strategy.collect();
            assert(Array.isArray(result), `Strategy "${strategy.name}" should return array`);
            console.log(`    Strategy "${strategy.name}": ${result.length} results`);
          } catch (error) {
            console.log(`    Strategy "${strategy.name}" failed: ${error}`);
          }
        }
      } else {
        console.log("    No assemblies available for strategy testing");
      }
    });
  }));

  suite.addResult(createTest("Should test metadata filtering and sorting", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        // Test filtering by name patterns
        const systemAssemblies = assemblies.filter(a => a.getName().includes("System"));
        const unityAssemblies = assemblies.filter(a => a.getName().includes("Unity"));

        console.log(`    System assemblies: ${systemAssemblies.length}`);
        console.log(`    Unity assemblies: ${unityAssemblies.length}`);

        // Test sorting by name
        const sortedAssemblies = [...assemblies].sort((a, b) => a.getName().localeCompare(b.getName()));
        assert(sortedAssemblies.length === assemblies.length, "Sorted assemblies should have same count");

        if (sortedAssemblies.length > 1) {
          const first = sortedAssemblies[0].getName();
          const second = sortedAssemblies[1].getName();
          const isSorted = first.localeCompare(second) <= 0;
          console.log(`    Assemblies sorted: ${isSorted ? 'Yes' : 'No'} (${first}, ${second})`);
        }
      } else {
        console.log("    No assemblies available for filtering/sorting tests");
      }
    });
  }));

  suite.addResult(createTest("Should test metadata performance and caching", () => {
    Mono.perform(() => {
      const domain = Mono.domain;

      // Test performance of repeated metadata access
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const assemblies = domain.getAssemblies();
        assert(Array.isArray(assemblies), "Repeated access should return arrays");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    10 metadata access iterations took ${duration}ms`);
      assert(duration < 1000, "Metadata access should be reasonably fast");

      // Test caching behavior
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;
      assert(domain1 === domain2, "Domain should be cached for performance");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Metadata Collections Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} metadata collection tests passed`,
  };
}

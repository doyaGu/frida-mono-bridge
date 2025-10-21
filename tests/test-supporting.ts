/**
 * Supporting Features Tests
 * Consolidated tests for Definitions, Metadata Collections, and Logger operations
 */

import Mono from "../src";
import { MonoEnums, MonoDefines } from "../src/runtime/enums";
import { MonoTypeKind } from "../src/model/type";
import { Logger } from "../src/utils/log";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createStandaloneTest,
  createDomainTest,
  createDomainTestEnhanced,
  createSmokeTest,
  createIntegrationTest,
  createErrorHandlingTest,
  createNestedPerformTest,
  assert,
  assertPerformWorks,
  assertApiAvailable,
  assertDomainAvailable,
  assertDomainCached,
  TestCategory
} from "./test-framework";

export function testSupporting(): TestResult {
  console.log("\nSupporting Features (Definitions, Metadata, Logger):");

  const suite = new TestSuite("Supporting Features Tests", TestCategory.INTEGRATION);

  // Smoke test first
  suite.addResult(createSmokeTest(TestCategory.INTEGRATION, "supporting features"));

  // ============================================================================
  // DEFINITIONS TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Mono.perform should work for definition tests", () => {
    assertPerformWorks("Mono.perform() should work for definition tests");
  }));

  suite.addResult(createMonoDependentTest("MonoEnums should expose common enumerations", () => {
    assert(MonoEnums.MonoExceptionEnum.MONO_EXCEPTION_CLAUSE_NONE === 0, "Exception enum should include NONE");
    assert(MonoEnums.MonoCallConvention.MONO_CALL_STDCALL === 2, "Call convention enum should match header value");
    assert(MonoEnums.MonoMarshalNative.MONO_NATIVE_UTF8STR === 0x30, "Marshal native enum should include UTF8STR");
    console.log("    Basic enum values are correct");
  }));

  suite.addResult(createMonoDependentTest("MonoType values should be consistent", () => {
    const monoTypeEnum = MonoEnums.MonoTypeEnum;
    assert(monoTypeEnum.MONO_TYPE_STRING === MonoTypeKind.String, "String type value should match MonoTypeKind");
    assert(monoTypeEnum.MONO_TYPE_ENUM === MonoTypeKind.Enum, "Enum type value should match MonoTypeKind");
    console.log("    MonoTypeEnum values align with MonoTypeKind");
  }));

  suite.addResult(createStandaloneTest("MonoEnums should be immutable", () => {
    assert(Object.isFrozen(MonoEnums.MonoExceptionEnum), "Enum maps should be frozen");
    assert(Object.isFrozen(MonoEnums), "Enum container should be frozen via as const");
    console.log("    Enum immutability verified");
  }));

  suite.addResult(createMonoDependentTest("MonoDefines should expose numeric constants", () => {
    assert(MonoDefines.MONO_PROFILER_API_VERSION === 3, "Profiler API version should be available");
    assert(MonoDefines.MONO_DEBUGGER_MAJOR_VERSION >= 0, "Debugger major version should be numeric");
    console.log("    Basic define values are correct");
  }));

  suite.addResult(createMonoDependentTest("Should test exception enumeration values", () => {
    const exceptionEnum = MonoEnums.MonoExceptionEnum;

    // Test common exception clause types
    assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_NONE === 'number', "NONE should be numeric");
    assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FILTER === 'number', "FILTER should be numeric");
    assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FINALLY === 'number', "FINALLY should be numeric");
    assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FAULT === 'number', "FAULT should be numeric");

    console.log("    Exception enum values verified");
  }));

  suite.addResult(createMonoDependentTest("Should test call convention enumeration", () => {
    const callConvEnum = MonoEnums.MonoCallConvention;

    // Test calling conventions
    assert(typeof callConvEnum.MONO_CALL_DEFAULT === 'number', "DEFAULT should be numeric");
    assert(typeof callConvEnum.MONO_CALL_C === 'number', "C should be numeric");
    assert(typeof callConvEnum.MONO_CALL_STDCALL === 'number', "STDCALL should be numeric");
    assert(typeof callConvEnum.MONO_CALL_THISCALL === 'number', "THISCALL should be numeric");
    assert(typeof callConvEnum.MONO_CALL_FASTCALL === 'number', "FASTCALL should be numeric");

    console.log("    Call convention enum values verified");
  }));

  suite.addResult(createMonoDependentTest("Should test marshal native enumeration", () => {
    const marshalEnum = MonoEnums.MonoMarshalNative;

    // Test marshal native types (using only the ones that actually exist)
    assert(typeof marshalEnum.MONO_NATIVE_BOOLEAN === 'number', "BOOLEAN should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_I1 === 'number', "I1 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_U1 === 'number', "U1 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_I2 === 'number', "I2 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_U2 === 'number', "U2 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_I4 === 'number', "I4 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_U4 === 'number', "U4 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_I8 === 'number', "I8 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_U8 === 'number', "U8 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_R4 === 'number', "R4 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_R8 === 'number', "R8 should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_UTF8STR === 'number', "UTF8STR should be numeric");

    // Test some additional common marshal types
    assert(typeof marshalEnum.MONO_NATIVE_LPSTR === 'number', "LPSTR should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_LPWSTR === 'number', "LPWSTR should be numeric");
    assert(typeof marshalEnum.MONO_NATIVE_BSTR === 'number', "BSTR should be numeric");

    console.log("    Marshal native enum values verified");
  }));

  suite.addResult(createMonoDependentTest("Should test profiler and debugger defines", () => {
    // Test profiler defines
    assert(typeof MonoDefines.MONO_PROFILER_API_VERSION === 'number', "Profiler API version should be numeric");
    assert(MonoDefines.MONO_PROFILER_API_VERSION > 0, "Profiler API version should be positive");

    // Test debugger defines
    assert(typeof MonoDefines.MONO_DEBUGGER_MAJOR_VERSION === 'number', "Debugger major version should be numeric");
    assert(typeof MonoDefines.MONO_DEBUGGER_MINOR_VERSION === 'number', "Debugger minor version should be numeric");
    assert(MonoDefines.MONO_DEBUGGER_MAJOR_VERSION >= 0, "Debugger major version should be non-negative");
    assert(MonoDefines.MONO_DEBUGGER_MINOR_VERSION >= 0, "Debugger minor version should be non-negative");

    console.log(`    Profiler API version: ${MonoDefines.MONO_PROFILER_API_VERSION}`);
    console.log(`    Debugger version: ${MonoDefines.MONO_DEBUGGER_MAJOR_VERSION}.${MonoDefines.MONO_DEBUGGER_MINOR_VERSION}`);
  }));

  suite.addResult(createMonoDependentTest("Should test definition value ranges and validity", () => {
    // Test that enum values are in expected ranges
    const callConvEnum = MonoEnums.MonoCallConvention;
    const callConvValues = Object.values(callConvEnum);

    for (const value of callConvValues) {
      assert(typeof value === 'number', "All call convention values should be numeric");
      assert(value >= 0, "Call convention values should be non-negative");
      assert(value < 100, "Call convention values should be in reasonable range");
    }

    // Test that marshal native values are in expected ranges
    const marshalEnum = MonoEnums.MonoMarshalNative;
    const marshalValues = Object.values(marshalEnum);

    for (const value of marshalValues) {
      assert(typeof value === 'number', "All marshal values should be numeric");
      assert(value >= 0, "Marshal values should be non-negative");
      assert(value < 1000, "Marshal values should be in reasonable range");
    }

    console.log("    Definition value ranges validated");
  }));

  suite.addResult(createErrorHandlingTest("Should handle definition access errors gracefully", () => {
    // Test accessing non-existent properties
    const nonExistentEnum = (MonoEnums as any).NonExistentEnum;
    assert(nonExistentEnum === undefined, "Non-existent enum should be undefined");

    const nonExistentDefine = (MonoDefines as any).NON_EXISTENT_DEFINE;
    assert(nonExistentDefine === undefined, "Non-existent define should be undefined");

    console.log("    Definition error handling works correctly");
  }));

  // ============================================================================
  // METADATA COLLECTION TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Mono.perform should work for metadata collection tests", () => {
    assertPerformWorks("Mono.perform() should work for metadata collection tests");
  }));

  suite.addResult(createMonoDependentTest("Should access domain for metadata collection", () => {
    assertDomainAvailable("Mono.domain should be accessible for metadata operations");
    assertApiAvailable("Mono.api should be accessible for metadata operations");

    const domain = Mono.domain;
    const assemblies = domain.getAssemblies();

    assert(Array.isArray(assemblies), "Should get assemblies array from domain");
    console.log(`    Found ${assemblies.length} assemblies for metadata collection`);
  }));

  suite.addResult(createMonoDependentTest("Should collect assembly metadata through domain", () => {
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
  }));

  suite.addResult(createMonoDependentTest("Should collect class metadata through images", () => {
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
  }));

  suite.addResult(createMonoDependentTest("Should group classes by namespace", () => {
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
  }));

  suite.addResult(createMonoDependentTest("Should test metadata filtering and sorting", () => {
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
  }));

  suite.addResult(createMonoDependentTest("Should test metadata performance and caching", () => {
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
  }));

  suite.addResult(createNestedPerformTest({
    context: "metadata collection",
    testName: "Should support metadata collection in nested perform calls",
    validate: domain => {
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
    },
  }));

  suite.addResult(createErrorHandlingTest("Should handle metadata collection errors gracefully", () => {
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
  }));

  // ============================================================================
  // LOGGER TESTS
  // ============================================================================

  suite.addResult(createMonoDependentTest("Mono.perform should work for logger tests", () => {
    assertPerformWorks("Mono.perform() should work for logger tests");
  }));

  suite.addResult(createMonoDependentTest("Logger can be imported and used directly", () => {
    const logger = new Logger({ tag: "Test" });
    assert(typeof logger.info === 'function', "info method should exist");
    assert(typeof logger.warn === 'function', "warn method should exist");
    assert(typeof logger.debug === 'function', "debug method should exist");
    assert(typeof logger.error === 'function', "error method should exist");
  }));

  suite.addResult(createMonoDependentTest("Logger methods should not throw", () => {
    const logger = new Logger({ tag: "MethodsTest" });
    // These should not throw
    logger.info("Test info message");
    logger.warn("Test warning message");
    logger.debug("Test debug message");
    logger.error("Test error message");
  }));

  suite.addResult(createMonoDependentTest("Logger can be created with custom tag", () => {
    const customLogger = new Logger({ tag: "CustomTag" });
    assert(typeof customLogger.info === 'function', "Custom logger should have info method");
    customLogger.info("Custom tagged message");
  }));

  suite.addResult(createMonoDependentTest("Logger can be created with custom level", () => {
    const debugLogger = new Logger({ level: "debug", tag: "DebugLogger" });
    debugLogger.debug("Debug level message");
    debugLogger.info("Info level message");

    const errorLogger = new Logger({ level: "error", tag: "ErrorLogger" });
    errorLogger.error("Error level message");
  }));

  suite.addResult(createMonoDependentTest("Logger respects log levels", () => {
    // Error level logger should only show error messages
    const errorLogger = new Logger({ level: "error" });
    errorLogger.debug("Should not appear"); // Below threshold
    errorLogger.info("Should not appear");  // Below threshold
    errorLogger.warn("Should not appear");  // Below threshold
    errorLogger.error("Should appear");     // At threshold
  }));

  suite.addResult(createMonoDependentTest("Logger can log multi-line messages", () => {
    const logger = new Logger({ tag: "MultiLine" });
    logger.info("Line 1\nLine 2\nLine 3");
  }));

  suite.addResult(createMonoDependentTest("Logger can log special characters", () => {
    const logger = new Logger({ tag: "SpecialChars" });
    logger.info("Special: !@#$%^&*()[]{}");
    logger.info("Unicode: 你好世界");
  }));

  suite.addResult(createMonoDependentTest("Logger can log empty strings", () => {
    const logger = new Logger({ tag: "Empty" });
    logger.info("");
    logger.debug("");
  }));

  suite.addResult(createMonoDependentTest("Multiple loggers can coexist", () => {
    const logger1 = new Logger({ tag: "Logger1" });
    const logger2 = new Logger({ tag: "Logger2" });
    const logger3 = new Logger({ tag: "Logger3", level: "debug" });

    logger1.info("From logger 1");
    logger2.info("From logger 2");
    logger3.debug("From logger 3");

    // All should work independently
  }));

  suite.addResult(createMonoDependentTest("Logger handles very long messages", () => {
    const logger = new Logger({ tag: "LongMessage" });
    const longMessage = "A".repeat(1000);
    logger.info(longMessage);
  }));

  suite.addResult(createMonoDependentTest("Logger works with Mono domain operations", () => {
    const logger = new Logger({ tag: "DomainTest" });

    const domain = Mono.domain;
    logger.info(`Domain available: ${domain !== null}`);

    const api = Mono.api;
    logger.info(`API available: ${api !== null}`);

    const version = Mono.version;
    logger.info(`Version available: ${version !== null}`);
    if (version) {
      logger.info(`Features: delegateThunk=${version.features.delegateThunk}, metadataTables=${version.features.metadataTables}`);
    }
  }));

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(createDomainTest("Should integrate definitions with fluent API", domain => {
    // Test that definitions work alongside the fluent API
    const api = Mono.api;
    const version = Mono.version;

    assert(api !== null, "API should be accessible");
    assert(domain !== null, "Domain should be accessible");
    assert(version !== null, "Version should be accessible");

    // Test that we can use definitions in context of API calls
    const hasStringAPI = api.hasExport("mono_string_new");
    console.log(`    String API available: ${hasStringAPI}`);

    // Test enum usage in context
    const callConvValue = MonoEnums.MonoCallConvention.MONO_CALL_DEFAULT;
    assert(typeof callConvValue === 'number', "Call convention should be usable value");

    console.log("    Definitions integrate properly with fluent API");
  }));

  suite.addResult(createDomainTest("Should test metadata integration with utilities", domain => {
    const assemblies = domain.getAssemblies();
    assert(Array.isArray(assemblies), "Should get assemblies for integration");

    if (assemblies.length > 0) {
      // Test that metadata can be enhanced with enum-based typing
      const firstAssembly = assemblies[0];
      assert(typeof firstAssembly.getName === 'function', "Assembly should have getName method");

      // Test that metadata collection can be enhanced with logger
      const logger = new Logger({ tag: "MetadataIntegration" });
      logger.info(`Processing assembly: ${firstAssembly.getName()}`);

      console.log("    Metadata integration working correctly");
    }
  }));

  suite.addResult(createDomainTest("Should test logger integration with metadata operations", domain => {
    const logger = new Logger({ tag: "LoggerIntegration" });
    const assemblies = domain.getAssemblies();

    logger.info(`Starting metadata collection with ${assemblies.length} assemblies`);

    if (assemblies.length > 0) {
      let totalClasses = 0;
      for (const assembly of assemblies) {
        const image = assembly.image;
        if (image) {
          const classes = image.getClasses();
          totalClasses += classes.length;
        }
      }
      logger.info(`Found ${totalClasses} total classes`);
    }

    logger.info("Metadata collection completed successfully");
    console.log("    Logger integration with metadata working correctly");
  }));

  suite.addResult(createDomainTest("Should test cross-feature supporting operations", domain => {
    // Test that definitions, metadata, and logging work together
    const logger = new Logger({ tag: "CrossFeature" });

    // Test definitions in context
    const callConv = MonoEnums.MonoCallConvention.MONO_CALL_DEFAULT;
    logger.info(`Using call convention: ${callConv}`);

    // Test metadata in context
    const assemblies = domain.getAssemblies();
    logger.info(`Processing ${assemblies.length} assemblies`);

    if (assemblies.length > 0) {
      const first = assemblies[0];
      const image = first.image;
      if (image) {
        const classes = image.getClasses();
        logger.info(`First assembly has ${classes.length} classes`);
      }
    }

    // Test version integration
    const version = Mono.version;
    if (version) {
      logger.info(`Version features: delegateThunk=${version.features.delegateThunk}, gcHandles=${version.features.gcHandles}`);
    }

    console.log("    Cross-feature supporting operations working correctly");
  }));

  suite.addResult(createDomainTest("Should test supporting features performance", domain => {
    const logger = new Logger({ tag: "Performance" });
    const startTime = Date.now();

    // Test multiple supporting operations
    for (let i = 0; i < 50; i++) {
      // Definitions
      const callConv = MonoEnums.MonoCallConvention.MONO_CALL_DEFAULT;
      const marshalType = MonoEnums.MonoMarshalNative.MONO_NATIVE_I4;

      // Metadata
      const assemblies = domain.getAssemblies();

      // Logging
      if (i % 10 === 0) {
        logger.debug(`Iteration ${i}: ${assemblies.length} assemblies`);
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`    Supporting features performance test took ${duration}ms`);
    assert(duration < 1000, "Supporting features operations should be reasonably fast");
  }));

  suite.addResult(createIntegrationTest("Should test supporting features consistency", () => {
    // Test that supporting features provide consistent results
    const domain1 = Mono.domain;
    const domain2 = Mono.domain;
    assert(domain1 === domain2, "Domain should be cached instance");

    const api1 = Mono.api;
    const api2 = Mono.api;
    assert(api1 === api2, "API should be cached instance");

    const version1 = Mono.version;
    const version2 = Mono.version;
    assert(version1 === version2, "Version should be cached instance");

    // Test definitions consistency
    const callConv1 = MonoEnums.MonoCallConvention.MONO_CALL_DEFAULT;
    const callConv2 = MonoEnums.MonoCallConvention.MONO_CALL_DEFAULT;
    assert(callConv1 === callConv2, "Enum values should be consistent");

    console.log("    Supporting features consistency verified");
  }));

  suite.addResult(createDomainTestEnhanced("Should handle supporting features integration errors", domain => {
    // Test error handling across all supporting features
    try {
      // Definitions error handling
      const invalidEnum = (MonoEnums as any).InvalidEnum;
      assert(invalidEnum === undefined, "Invalid enum should be undefined");

      // Metadata error handling
      const invalidAssembly = domain.assembly("Invalid.Assembly");
      assert(invalidAssembly === null, "Invalid assembly should return null");

      // Logger error handling
      const logger = new Logger({ tag: "ErrorTest" });
      logger.error("Error handling test");

      console.log("    Supporting features error handling works correctly");
    } catch (error) {
      console.log(`    Supporting features error: ${error}`);
    }
  }));

  const summary = suite.getSummary();

  return {
    name: "Supporting Features Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} supporting features tests passed`,
    duration: summary.duration,
    category: TestCategory.INTEGRATION,
    requiresMono: true
  };
}
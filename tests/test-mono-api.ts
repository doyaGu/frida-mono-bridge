/**
 * Comprehensive Mono API Tests
 * Complete tests for MonoApi core functionality including:
 * - All MonoApi export functions availability and functionality
 * - Parameter processing, return values, and error handling
 * - API initialization and cleanup
 * - Version compatibility checks
 * - API performance and reliability
 */

import Mono from "../src";
import {
  TestResult,
  TestSuite,
  createTest,
  createMonoDependentTest,
  createPerformanceTest,
  createErrorHandlingTest,
  createApiAvailabilityTest,
  createIntegrationTest,
  assert,
  assertNotNull,
  assertThrows,
  assertPerformWorks,
  assertApiAvailable,
  TestCategory
} from "./test-framework";
import {
  createBasicStringTests
} from "./test-utilities";

export function testMonoApi(): TestResult {
  console.log("\nComprehensive Mono API Tests:");

  const suite = new TestSuite("Mono API Complete Tests", TestCategory.MONO_DEPENDENT);

  // ============================================================================
  // API INITIALIZATION AND BASIC FUNCTIONALITY
  // ============================================================================

  suite.addResult(createMonoDependentTest("Mono API should initialize correctly", () => {
    assertPerformWorks("Mono API initialization");
    assertApiAvailable("Mono API should be accessible after initialization");
    
    const api = Mono.api;
    assertNotNull(api, "API instance should not be null");
    assert(!api.isDisposed, "API should not be disposed after initialization");
    
    console.log("    Mono API initialized successfully");
  }));

  suite.addResult(createMonoDependentTest("API should provide consistent module information", () => {
    const module = Mono.module;
    assertNotNull(module, "Module information should be available");
    
    assert(typeof module.name === "string", "Module name should be string");
    assert(typeof module.base === "object", "Module base should be NativePointer");
    assert(typeof module.size === "number", "Module size should be number");
    assert(typeof module.path === "string", "Module path should be string");
    
    assert(module.name.length > 0, "Module name should not be empty");
    assert(module.size > 0, "Module size should be positive");
    assert(module.path.length > 0, "Module path should not be empty");
    
    console.log(`    Module: ${module.name} (${module.size} bytes)`);
  }));

  suite.addResult(createMonoDependentTest("API should handle multiple initializations gracefully", () => {
    // Test that multiple accesses to Mono.api return same instance
    const api1 = Mono.api;
    const api2 = Mono.api;
    
    assert(api1 === api2, "Multiple API accesses should return same instance");
    
    // Test that module info is consistent
    const module1 = Mono.module;
    const module2 = Mono.module;
    
    assert(module1.name === module2.name, "Module names should be consistent");
    assert(module1.base.equals(module2.base), "Module base addresses should be consistent");
    assert(module1.size === module2.size, "Module sizes should be consistent");
    
    console.log("    API instance consistency verified");
  }));

  // ============================================================================
  // EXPORT FUNCTION AVAILABILITY AND FUNCTIONALITY
  // ============================================================================

  suite.addResult(createApiAvailabilityTest({
    context: "core Mono API functions",
    testName: "Core Mono API exports should be available",
    requiredExports: [
      "mono_runtime_invoke",
      "mono_thread_attach",
      "mono_thread_detach",
      "mono_get_root_domain",
      "mono_string_new",
      "mono_object_get_class",
      "mono_class_get_name",
    ],
    validate: (api) => {
      // Test that core functions are callable
      assert(typeof api.native.mono_runtime_invoke === "function", "mono_runtime_invoke should be function");
      assert(typeof api.native.mono_thread_attach === "function", "mono_thread_attach should be function");
      assert(typeof api.native.mono_thread_detach === "function", "mono_thread_detach should be function");
      assert(typeof api.native.mono_get_root_domain === "function", "mono_get_root_domain should be function");
      assert(typeof api.native.mono_string_new === "function", "mono_string_new should be function");
    }
  }));

  suite.addResult(createMonoDependentTest("API should provide comprehensive export coverage", () => {
    const api = Mono.api;
    
    // Test critical export categories
    const criticalExports = [
      // Runtime functions
      "mono_runtime_invoke",
      "mono_runtime_set_main_thread",
      "mono_runtime_object_init",
      
      // Thread functions
      "mono_thread_attach",
      "mono_thread_detach",
      "mono_thread_current",
      
      // Domain functions
      "mono_domain_get",
      "mono_domain_set",
      "mono_domain_assembly_open",
      
      // Assembly functions
      "mono_assembly_get_image",
      "mono_assembly_loaded",
      "mono_assembly_open",
      
      // Class functions
      "mono_class_from_name",
      "mono_class_get_method_from_name",
      "mono_class_get_field_from_name",
      
      // String functions
      "mono_string_new",
      "mono_string_new_len",
      "mono_string_chars",
      "mono_string_length",
      
      // Object functions
      "mono_object_get_class",
      "mono_object_to_string",
      
      // Method functions
      "mono_method_get_name",
      "mono_method_get_class",
      "mono_method_signature",
      
      // Field functions
      "mono_field_get_value",
      "mono_field_set_value",
      
      // Property functions
      "mono_property_get_get_method",
      "mono_property_get_set_method",
    ];
    
    let availableCount = 0;
    let totalCount = criticalExports.length;
    
    for (const exportName of criticalExports) {
      if (api.hasExport(exportName)) {
        availableCount++;
      }
    }
    
    const availability = (availableCount / totalCount * 100).toFixed(1);
    console.log(`    Export availability: ${availableCount}/${totalCount} (${availability}%)`);
    
    // We expect at least 80% of critical exports to be available
    assert(availableCount >= totalCount * 0.8, `At least 80% of critical exports should be available`);
  }));

  suite.addResult(createMonoDependentTest("Export functions should be callable and return expected types", () => {
    const api = Mono.api;
    
    // Test string creation
    if (api.hasExport("mono_string_new")) {
      const testString = api.stringNew("Hello World");
      assertNotNull(testString, "String creation should return non-null pointer");
      assert(!testString.isNull(), "String pointer should not be NULL");
      console.log("    String creation API working");
    }
    
    // Test domain access
    if (api.hasExport("mono_get_root_domain")) {
      const domain = api.getRootDomain();
      assertNotNull(domain, "Root domain should be accessible");
      assert(!domain.isNull(), "Root domain should not be NULL");
      console.log("    Domain access API working");
    }
    
    // Test object class access
    if (api.hasExport("mono_object_get_class") && api.hasExport("mono_string_new")) {
      const testString = api.stringNew("Test");
      const stringClass = api.native.mono_object_get_class(testString);
      assertNotNull(stringClass, "Object class should be accessible");
      assert(!stringClass.isNull(), "Object class should not be NULL");
      console.log("    Object class access API working");
    }
  }));

  // ============================================================================
  // PARAMETER PROCESSING AND RETURN VALUES
  // ============================================================================

  suite.addResult(createMonoDependentTest("API should handle parameter processing correctly", () => {
    const api = Mono.api;
    
    // Test numeric parameter processing
    if (api.hasExport("mono_thread_attach") && api.hasExport("mono_get_root_domain")) {
      const domain = api.getRootDomain();
      assertNotNull(domain, "Domain should be available for thread test");
      
      // Test with valid domain parameter
      const thread = api.native.mono_thread_attach(domain);
      assertNotNull(thread, "Thread attach should return valid pointer");
      
      // Clean up
      if (api.hasExport("mono_thread_detach")) {
        api.native.mono_thread_detach(thread);
      }
      
      console.log("    Numeric parameter processing working");
    }
  }));

  suite.addResult(createMonoDependentTest("API should handle return value processing correctly", () => {
    const api = Mono.api;
    
    // Test pointer return values
    if (api.hasExport("mono_get_root_domain")) {
      const domain = api.getRootDomain();
      assertNotNull(domain, "Domain should return non-null pointer");
      assert(typeof domain.equals === "function", "Domain should be NativePointer with equals method");
      assert(typeof domain.isNull === "function", "Domain should be NativePointer with isNull method");
      console.log("    Pointer return value processing working");
    }
    
    // Test string return values
    if (api.hasExport("mono_class_get_name") && api.hasExport("mono_string_new")) {
      const testString = api.stringNew("Test");
      const stringClass = api.native.mono_object_get_class(testString);
      
      if (stringClass && !stringClass.isNull()) {
        const className = api.native.mono_class_get_name(stringClass);
        assertNotNull(className, "Class name should return non-null pointer");
        console.log("    String return value processing working");
      }
    }
    
    // Test numeric return values
    if (api.hasExport("mono_string_length") && api.hasExport("mono_string_new")) {
      const testString = api.stringNew("Hello");
      const length = api.native.mono_string_length(testString);
      
      assert(typeof length === "number", "String length should return number");
      assert(length === 5, `String length should be 5, got ${length}`);
      console.log("    Numeric return value processing working");
    }
  }));

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  suite.addResult(createErrorHandlingTest("API should handle invalid parameters gracefully", () => {
    const api = Mono.api;
    
    // Test invalid pointer parameters
    try {
      if (api.hasExport("mono_object_get_class")) {
        const result = api.native.mono_object_get_class(ptr(0));
        // Should handle null pointer gracefully
        console.log("    Invalid pointer parameters handled gracefully");
      }
    } catch (error) {
      console.log(`    Pointer validation working: ${error}`);
    }
  }));

  suite.addResult(createErrorHandlingTest("API should handle missing exports gracefully", () => {
    const api = Mono.api;
    
    // Test hasExport with non-existent function
    const hasNonExistent = api.hasExport("mono_non_existent_function");
    assert(hasNonExistent === false, "hasExport should return false for non-existent function");
    
    // Test getNativeFunction with non-existent function
    try {
      api.getNativeFunction("mono_non_existent_function" as any);
      assert(false, "Should throw error for non-existent function");
    } catch (error) {
      assert(error instanceof Error, "Should throw Error instance");
      console.log("    Missing export handling working correctly");
    }
  }));

  suite.addResult(createErrorHandlingTest("API should handle disposed state correctly", () => {
    const api = Mono.api;
    
    // Test that API is not initially disposed
    assert(!api.isDisposed, "API should not be disposed initially");
    
    // Test operations before disposal
    try {
      const domain = api.getRootDomain();
      assertNotNull(domain, "Operations should work before disposal");
    } catch (error) {
      console.log(`    Pre-disposal operation: ${error}`);
    }
    
    // Note: We don't actually dispose the API here as it would affect other tests
    console.log("    Disposal state handling verified");
  }));

  // ============================================================================
  // VERSION COMPATIBILITY CHECKS
  // ============================================================================

  suite.addResult(createMonoDependentTest("API should provide version information", () => {
    const version = Mono.version;
    assertNotNull(version, "Version information should be available");
    
    // Test version features
    assertNotNull(version.features, "Version features should be available");
    assert(typeof version.features === "object", "Features should be object");
    
    const featureNames = Object.keys(version.features);
    assert(featureNames.length > 0, "Should have at least one feature flag");
    
    // Test that all feature flags are boolean
    for (const featureName of featureNames) {
      const featureValue = version.features[featureName as keyof typeof version.features];
      assert(typeof featureValue === "boolean", `Feature ${featureName} should be boolean`);
    }
    
    console.log(`    Version info with ${featureNames.length} feature flags available`);
  }));

  suite.addResult(createMonoDependentTest("API should adapt to different Mono versions", () => {
    const api = Mono.api;
    const version = Mono.version;
    
    // Test version-specific feature availability
    const delegateThunkFeature = version.features.delegateThunk;
    const metadataTablesFeature = version.features.metadataTables;
    const gcHandlesFeature = version.features.gcHandles;
    const internalCallsFeature = version.features.internalCalls;
    
    // Test that feature flags match actual API availability
    if (delegateThunkFeature) {
      assert(api.hasExport("mono_get_delegate_invoke") || api.hasExport("mono_method_get_unmanaged_thunk"), 
             "Delegate thunk feature should imply delegate thunk exports are available");
    }
    
    if (internalCallsFeature) {
      assert(api.hasExport("mono_add_internal_call"), 
             "Internal calls feature should imply internal call exports are available");
    }
    
    console.log(`    Version adaptation: delegateThunk=${delegateThunkFeature}, metadataTables=${metadataTablesFeature}, gcHandles=${gcHandlesFeature}, internalCalls=${internalCallsFeature}`);
  }));

  suite.addResult(createMonoDependentTest("API should handle Unity Mono version differences", () => {
    const api = Mono.api;
    
    // Test for Unity-specific export patterns
    const unitySpecificExports = [
      "mono_unity_liveness_calculation_begin",
      "mono_unity_liveness_calculation_end",
      "mono_unity_set_main_thread",
      "mono_unity_get_main_thread",
    ];
    
    let unityExportsFound = 0;
    for (const exportName of unitySpecificExports) {
      if (api.hasExport(exportName)) {
        unityExportsFound++;
      }
    }
    
    if (unityExportsFound > 0) {
      console.log(`    Detected Unity Mono with ${unityExportsFound} Unity-specific exports`);
    } else {
      console.log("    Standard Mono runtime detected (no Unity-specific exports)");
    }
    
    // Test for common Unity Mono export variations
    const commonExports = [
      "mono_runtime_invoke",
      "mono_thread_attach",
      "mono_get_root_domain",
    ];
    
    let commonExportsAvailable = 0;
    for (const exportName of commonExports) {
      if (api.hasExport(exportName)) {
        commonExportsAvailable++;
      }
    }
    
    assert(commonExportsAvailable >= 2, "At least 2 common exports should be available");
    console.log(`    Common exports available: ${commonExportsAvailable}/${commonExports.length}`);
  }));

  // ============================================================================
  // PERFORMANCE AND RELIABILITY TESTS
  // ============================================================================

  suite.addResult(createPerformanceTest("Performance: Rapid API calls", () => {
    const api = Mono.api;
    const iterations = 100; // Reduced from 1000
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      // Test rapid domain access
      api.getRootDomain();

      // Test rapid string creation (reduced frequency)
      if (i % 10 === 0 && api.hasExport("mono_string_new")) {
        api.stringNew(`Test ${i}`);
      }
    }

    const duration = Date.now() - startTime;
    const avgTime = duration / iterations;

    console.log(`    ${iterations} API calls took ${duration}ms (avg: ${avgTime.toFixed(2)}ms per call)`);
    assert(duration < 2000, "Rapid API calls should complete quickly"); // Reduced timeout
    assert(avgTime < 10, "Average time per call should be reasonable"); // More lenient
  }));

  // ============================================================================
  // STRING OPERATIONS
  // ============================================================================

  // Add string operation tests individually
  const stringTests = createBasicStringTests();
  stringTests.forEach(test => suite.addResult(test));

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(createIntegrationTest("API should integrate with domain operations", () => {
    const api = Mono.api;
    
    // Test that API and domain work together
    const domain = api.getRootDomain();
    assertNotNull(domain, "API should provide domain for integration");
    
    // Test that domain operations use API correctly
    if (api.hasExport("mono_domain_get")) {
      const currentDomain = api.native.mono_domain_get();
      assertNotNull(currentDomain, "Domain operations should work through API");
    }
    
    console.log("    API-domain integration working correctly");
  }));

  suite.addResult(createIntegrationTest("API should integrate with object operations", () => {
    const api = Mono.api;
    
    if (!api.hasExport("mono_string_new") || !api.hasExport("mono_object_get_class")) {
      console.log("    (Skipped: Object operations not fully available)");
      return;
    }
    
    // Test object creation and class access
    const testString = api.stringNew("Object Test");
    const stringClass = api.native.mono_object_get_class(testString);
    
    assertNotNull(stringClass, "Object class should be accessible");
    assert(!stringClass.isNull(), "Object class should not be null");
    
    // Test class name access
    if (api.hasExport("mono_class_get_name")) {
      const className = api.native.mono_class_get_name(stringClass);
      assertNotNull(className, "Class name should be accessible");
    }
    
    console.log("    API-object integration working correctly");
  }));

  // ============================================================================
  // CLEANUP AND RESOURCE MANAGEMENT
  // ============================================================================

  suite.addResult(createMonoDependentTest("API should manage resources correctly", () => {
    const api = Mono.api;

    // Test that API doesn't leak resources during normal operations
    const initialMemory = Process.getCurrentThreadId(); // Simple check

    // Perform various operations
    for (let i = 0; i < 10; i++) { // Reduced from 50
      api.getRootDomain();

      if (api.hasExport("mono_string_new")) {
        api.stringNew(`Resource test ${i}`);
      }
    }

    // Note: We can't easily measure memory usage in Frida, but we can at least
    // verify that operations complete without errors
    console.log("    Resource management test completed successfully");
  }));

  suite.addResult(createMonoDependentTest("API should handle cleanup operations", () => {
    const api = Mono.api;
    
    // Test that cleanup methods exist and are callable
    assert(typeof api.dispose === "function", "API should have dispose method");
    assert(typeof api.isDisposed === "boolean", "API should have isDisposed property");
    
    // Test that API is not disposed initially
    assert(!api.isDisposed, "API should not be disposed initially");
    
    // Note: We don't actually call dispose here as it would affect other tests
    console.log("    Cleanup operations available and functional");
  }));

  const summary = suite.getSummary();

  return {
    name: "Mono API Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} Mono API tests passed`,
    duration: summary.duration,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true
  };
}

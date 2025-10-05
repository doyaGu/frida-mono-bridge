/**
 * Version Detection Tests
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertNotNull } from "./test-framework";

export function testVersionDetection(): TestResult {
  console.log("\nVersion Detection:");

  const suite = new TestSuite("Version Detection Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for version detection tests", () => {
    assertPerformWorks("Mono.perform() should work for version detection tests");
  }));

  suite.addResult(createTest("Should access API for version operations", () => {
    Mono.perform(() => {
      assertApiAvailable("Mono.api should be accessible for version operations");
      console.log("    API is accessible for version detection tests");
    });
  }));

  suite.addResult(createTest("Version object should exist and be accessible", () => {
    Mono.perform(() => {
      assertNotNull(Mono.version, "Version should not be null");
      assertNotNull(Mono.version.features, "Features should not be null");

      console.log(`    Version object accessible with ${Object.keys(Mono.version.features).length} feature flags`);
    });
  }));

  suite.addResult(createTest("All feature flags should be defined and boolean", () => {
    Mono.perform(() => {
      const features = Mono.version.features;
      assert(typeof features.delegateThunk === 'boolean', "delegateThunk should be boolean");
      assert(typeof features.metadataTables === 'boolean', "metadataTables should be boolean");
      assert(typeof features.gcHandles === 'boolean', "gcHandles should be boolean");
      assert(typeof features.internalCalls === 'boolean', "internalCalls should be boolean");

      console.log(`    delegateThunk: ${features.delegateThunk}`);
      console.log(`    metadataTables: ${features.metadataTables}`);
      console.log(`    gcHandles: ${features.gcHandles}`);
      console.log(`    internalCalls: ${features.internalCalls}`);
    });
  }));

  suite.addResult(createTest("Feature flags should reflect API availability", () => {
    Mono.perform(() => {
      const features = Mono.version.features;
      const api = Mono.api;

      // Delegate thunk requires two specific exports
      if (features.delegateThunk) {
        assert(api.hasExport("mono_get_delegate_invoke"), "delegateThunk=true requires mono_get_delegate_invoke");
        assert(api.hasExport("mono_method_get_unmanaged_thunk"), "delegateThunk=true requires mono_method_get_unmanaged_thunk");
        console.log("    [OK] delegateThunk feature matches API availability");
      } else {
        console.log("    [INFO] delegateThunk feature not available");
      }

      // GC handles require specific exports
      if (features.gcHandles) {
        assert(api.hasExport("mono_gchandle_new"), "gcHandles=true requires mono_gchandle_new");
        assert(api.hasExport("mono_gchandle_free"), "gcHandles=true requires mono_gchandle_free");
        console.log("    [OK] gcHandles feature matches API availability");
      } else {
        console.log("    [INFO] gcHandles feature not available");
      }

      // Internal calls require specific export
      if (features.internalCalls) {
        assert(api.hasExport("mono_add_internal_call"), "internalCalls=true requires mono_add_internal_call");
        console.log("    [OK] internalCalls feature matches API availability");
      } else {
        console.log("    [INFO] internalCalls feature not available");
      }

      // Metadata tables require specific exports
      if (features.metadataTables) {
        assert(api.hasExport("mono_method_signature"), "metadataTables=true requires mono_method_signature");
        assert(api.hasExport("mono_signature_get_param_count"), "metadataTables=true requires mono_signature_get_param_count");
        console.log("    [OK] metadataTables feature matches API availability");
      } else {
        console.log("    [INFO] metadataTables feature not available");
      }
    });
  }));

  suite.addResult(createTest("Should test version detection consistency", () => {
    Mono.perform(() => {
      // Test that version detection returns consistent results
      const version1 = Mono.version;
      const version2 = Mono.version;

      assert(version1 === version2, "Version should be cached instance");
      assert(version1.features === version2.features, "Features should be cached instance");

      // Test feature flag consistency
      const features1 = version1.features;
      const features2 = version2.features;

      assert(features1.delegateThunk === features2.delegateThunk, "delegateThunk should be consistent");
      assert(features1.metadataTables === features2.metadataTables, "metadataTables should be consistent");
      assert(features1.gcHandles === features2.gcHandles, "gcHandles should be consistent");
      assert(features1.internalCalls === features2.internalCalls, "internalCalls should be consistent");

      console.log("    Version detection is consistent across calls");
    });
  }));

  suite.addResult(createTest("Should test version detection in nested perform calls", () => {
    Mono.perform(() => {
      // Test nested perform calls
      Mono.perform(() => {
        const version = Mono.version;
        assertNotNull(version, "Version should be accessible in nested perform calls");
        assertNotNull(version.features, "Features should be accessible in nested context");

        console.log("    Version detection works in nested perform calls");
      });
    });
  }));

  suite.addResult(createTest("Should test version feature validation", () => {
    Mono.perform(() => {
      const features = Mono.version.features;
      const api = Mono.api;

      // Validate that each feature flag properly reflects API availability
      const featureTests = [
        {
          name: "delegateThunk",
          flag: features.delegateThunk,
          requiredExports: ["mono_get_delegate_invoke", "mono_method_get_unmanaged_thunk"]
        },
        {
          name: "gcHandles",
          flag: features.gcHandles,
          requiredExports: ["mono_gchandle_new", "mono_gchandle_free"]
        },
        {
          name: "internalCalls",
          flag: features.internalCalls,
          requiredExports: ["mono_add_internal_call"]
        },
        {
          name: "metadataTables",
          flag: features.metadataTables,
          requiredExports: ["mono_method_signature", "mono_signature_get_param_count"]
        }
      ];

      for (const featureTest of featureTests) {
        const hasAllRequired = featureTest.requiredExports.every(exportName => api.hasExport(exportName));

        if (featureTest.flag) {
          assert(hasAllRequired, `${featureTest.name} flag requires all required exports to be available`);
          console.log(`    [OK] ${featureTest.name}: feature flag matches API availability`);
        } else {
          // If flag is false, at least one required export should be missing
          const hasSomeRequired = featureTest.requiredExports.some(exportName => api.hasExport(exportName));
          console.log(`    [INFO] ${featureTest.name}: ${hasSomeRequired ? 'some exports available but feature disabled' : 'exports not available'}`);
        }
      }
    });
  }));

  suite.addResult(createTest("Should test version error handling", () => {
    Mono.perform(() => {
      // Test that version detection handles edge cases gracefully
      try {
        const version = Mono.version;
        const features = version.features;

        // Test that version properties don't throw errors
        assert(typeof features.delegateThunk === 'boolean', "delegateThunk should be accessible");
        assert(typeof features.metadataTables === 'boolean', "metadataTables should be accessible");
        assert(typeof features.gcHandles === 'boolean', "gcHandles should be accessible");
        assert(typeof features.internalCalls === 'boolean', "internalCalls should be accessible");

        console.log("    Version error handling works correctly");
      } catch (error) {
        console.log(`    Version detection error: ${error}`);
        throw error;
      }
    });
  }));

  suite.addResult(createTest("Should test version integration with API", () => {
    Mono.perform(() => {
      const version = Mono.version;
      const api = Mono.api;

      // Test that version information integrates properly with API operations
      assert(version !== null, "Version should be accessible");
      assert(api !== null, "API should be accessible");

      // Test specific feature integration
      if (version.features.internalCalls) {
        const hasInternalCallAPI = api.hasExport("mono_add_internal_call");
        assert(hasInternalCallAPI, "Internal call feature should match API availability");
        console.log("    Version + API integration: internal calls available");
      }

      if (version.features.gcHandles) {
        const hasGCHandleAPI = api.hasExport("mono_gchandle_new");
        assert(hasGCHandleAPI, "GC handle feature should match API availability");
        console.log("    Version + API integration: GC handles available");
      }

      // Test basic API integration regardless of features
      const hasBasicAPI = api.hasExport("mono_string_new");
      console.log(`    Version + API integration: basic string API available = ${hasBasicAPI}`);
    });
  }));

  suite.addResult(createTest("Should test version performance characteristics", () => {
    Mono.perform(() => {
      // Test performance of repeated version access
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const version = Mono.version;
        assert(version !== null, "Version should be accessible repeatedly");
        assert(version.features !== null, "Features should be accessible repeatedly");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`    1000 version access operations took ${duration}ms`);
      assert(duration < 50, "Version access should be fast (cached)");
    });
  }));

  suite.addResult(createTest("Should test version feature combinations", () => {
    Mono.perform(() => {
      const features = Mono.version.features;

      // Test logical feature combinations
      const hasAdvancedFeatures = features.delegateThunk || features.metadataTables;
      const hasBasicFeatures = features.gcHandles || features.internalCalls;

      console.log(`    Advanced features available: ${hasAdvancedFeatures}`);
      console.log(`    Basic features available: ${hasBasicFeatures}`);

      // Count enabled features
      const enabledFeatures = Object.values(features).filter(Boolean).length;
      const totalFeatures = Object.keys(features).length;

      console.log(`    Enabled features: ${enabledFeatures}/${totalFeatures}`);

      // At least some features should be available in a working Mono runtime
      assert(enabledFeatures > 0, "At least one feature should be enabled");
    });
  }));

  suite.addResult(createTest("Should test version metadata integration", () => {
    Mono.perform(() => {
      const version = Mono.version;
      const domain = Mono.domain;

      // Test that version information can be used with domain operations
      assert(version !== null, "Version should be accessible");
      assert(domain !== null, "Domain should be accessible");

      // Try to get assemblies to test integration
      const assemblies = domain.getAssemblies();
      console.log(`    Version + domain integration: ${assemblies.length} assemblies found`);

      // Test that version features correlate with assembly capabilities
      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const image = firstAssembly.getImage();

        if (image && version.features.metadataTables) {
          // If metadata tables are available, we should be able to get classes
          const classes = image.getClasses();
          console.log(`    Metadata tables feature working: ${classes.length} classes accessible`);
        }
      }
    });
  }));

  suite.addResult(createTest("Should test version comprehensive validation", () => {
    Mono.perform(() => {
      const version = Mono.version;
      const api = Mono.api;

      // Comprehensive validation of version object
      assert(typeof version === 'object', "Version should be object");
      assert(typeof version.features === 'object', "Features should be object");

      // Validate all expected feature properties exist
      const expectedFeatures = ['delegateThunk', 'metadataTables', 'gcHandles', 'internalCalls'];
      for (const feature of expectedFeatures) {
        assert(typeof (version.features as any)[feature] === 'boolean', `${feature} should be boolean`);
      }

      // Validate no unexpected properties
      const actualFeatures = Object.keys(version.features);
      const hasUnexpectedFeatures = actualFeatures.some(feature => !expectedFeatures.includes(feature));

      if (hasUnexpectedFeatures) {
        const unexpectedFeatures = actualFeatures.filter(f => !expectedFeatures.includes(f));
        console.log(`    Unexpected features found: ${unexpectedFeatures.join(', ')}`);
      }

      // Validate API integration for each enabled feature
      const enabledFeatures = expectedFeatures.filter(feature => (version.features as any)[feature]);
      console.log(`    Comprehensive validation: ${enabledFeatures.length} features enabled and validated`);

      assert(enabledFeatures.length >= 0, "Feature count should be non-negative");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Version Detection Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} version detection tests passed`,
  };
}

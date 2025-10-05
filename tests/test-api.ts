/**
 * API Availability Tests
 * Tests that all Mono C API exports are available and have correct signatures
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks, assertApiAvailable, assertDomainAvailable } from "./test-framework";

export function testApiAvailability(): TestResult {
  console.log("\nAPI Availability:");

  const suite = new TestSuite("API Tests");

  // Modern API availability tests
  suite.addResult(createTest("Mono.perform should be available and functional", () => {
    assertPerformWorks("Mono.perform() should work");
  }));

  suite.addResult(createTest("Mono.api should be accessible", () => {
    assertApiAvailable("Mono.api should be accessible");
  }));

  suite.addResult(createTest("Mono.domain should be accessible", () => {
    assertDomainAvailable("Mono.domain should be accessible");
  }));

  // Core Domain APIs - wrapped in Mono.perform()
  suite.addResult(createTest("mono_get_root_domain should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_get_root_domain"), "mono_get_root_domain should be exported");
    });
  }));

  suite.addResult(createTest("mono_domain_get should be available", () => {
    Mono.perform(() => {
      // mono_domain_get is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_get")) {
        console.log("    (Skipped: mono_domain_get not available in this Mono version)");
        return;
      }
      assert(Mono.api.hasExport("mono_domain_get"), "mono_domain_get should be exported");
    });
  }));

  suite.addResult(createTest("mono_domain_set should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_domain_set"), "mono_domain_set should be exported");
    });
  }));

  suite.addResult(createTest("mono_domain_assembly_open should be available", () => {
    Mono.perform(() => {
      // mono_domain_assembly_open is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_assembly_open")) {
        console.log("    (Skipped: mono_domain_assembly_open not available in this Mono version)");
        return;
      }
      assert(Mono.api.hasExport("mono_domain_assembly_open"), "mono_domain_assembly_open should be exported");
    });
  }));

  // Thread APIs
  suite.addResult(createTest("mono_thread_attach should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_thread_attach"), "mono_thread_attach should be exported");
    });
  }));

  suite.addResult(createTest("mono_thread_detach should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_thread_detach"), "mono_thread_detach should be exported");
    });
  }));

  // Assembly APIs
  suite.addResult(createTest("mono_assembly_open should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_assembly_open"), "mono_assembly_open should be exported");
    });
  }));

  suite.addResult(createTest("mono_assembly_get_image should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_assembly_get_image"), "mono_assembly_get_image should be exported");
    });
  }));

  suite.addResult(createTest("mono_image_loaded should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_image_loaded"), "mono_image_loaded should be exported");
    });
  }));

  suite.addResult(createTest("mono_assembly_get_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_assembly_get_name"), "mono_assembly_get_name should be exported");
      assert(Mono.api.hasExport("mono_assembly_name_get_name"), "mono_assembly_name_get_name should be exported");
      assert(Mono.api.hasExport("mono_stringify_assembly_name"), "mono_stringify_assembly_name should be exported");
    });
  }));

  // Class APIs
  suite.addResult(createTest("mono_class_from_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_class_from_name"), "mono_class_from_name should be exported");
    });
  }));

  suite.addResult(createTest("mono_class_get_method_from_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_class_get_method_from_name"), "mono_class_get_method_from_name should be exported");
    });
  }));

  suite.addResult(createTest("mono_class_get_field_from_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_class_get_field_from_name"), "mono_class_get_field_from_name should be exported");
    });
  }));

  suite.addResult(createTest("mono_class_get_property_from_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_class_get_property_from_name"), "mono_class_get_property_from_name should be exported");
    });
  }));

  // Property APIs
  suite.addResult(createTest("mono_property_get_get_method should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_property_get_get_method"), "mono_property_get_get_method should be exported");
    });
  }));

  suite.addResult(createTest("mono_property_get_set_method should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_property_get_set_method"), "mono_property_get_set_method should be exported");
    });
  }));

  suite.addResult(createTest("mono_property_get_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_property_get_name"), "mono_property_get_name should be exported");
      assert(Mono.api.hasExport("mono_property_get_flags"), "mono_property_get_flags should be exported");
    });
  }));

  // Method APIs
  suite.addResult(createTest("mono_method_desc_new should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_desc_new"), "mono_method_desc_new should be exported");
    });
  }));

  suite.addResult(createTest("mono_method_desc_free should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_desc_free"), "mono_method_desc_free should be exported");
    });
  }));

  suite.addResult(createTest("mono_method_desc_search_in_image should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_desc_search_in_image"), "mono_method_desc_search_in_image should be exported");
    });
  }));

  suite.addResult(createTest("mono_method_signature should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_signature"), "mono_method_signature should be exported");
    });
  }));

  suite.addResult(createTest("mono_signature_get_param_count should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_signature_get_param_count"), "mono_signature_get_param_count should be exported");
    });
  }));

  suite.addResult(createTest("mono_method_get_name should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_get_name"), "mono_method_get_name should be exported");
    });
  }));

  suite.addResult(createTest("mono_runtime_invoke should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_runtime_invoke"), "mono_runtime_invoke should be exported");
    });
  }));

  suite.addResult(createTest("Method metadata APIs should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_get_class"), "mono_method_get_class should be exported");
      assert(Mono.api.hasExport("mono_method_get_token"), "mono_method_get_token should be exported");
      assert(Mono.api.hasExport("mono_method_get_flags"), "mono_method_get_flags should be exported");
      assert(Mono.api.hasExport("mono_method_full_name"), "mono_method_full_name should be exported");
    });
  }));

  // Object APIs
  suite.addResult(createTest("mono_object_new should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_object_new"), "mono_object_new should be exported");
    });
  }));

  suite.addResult(createTest("mono_object_get_class should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_object_get_class"), "mono_object_get_class should be exported");
    });
  }));

  suite.addResult(createTest("mono_object_unbox should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_object_unbox"), "mono_object_unbox should be exported");
    });
  }));

  // String APIs
  suite.addResult(createTest("mono_string_new should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_string_new"), "mono_string_new should be exported");
    });
  }));

  suite.addResult(createTest("mono_string_new_len should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_string_new_len"), "mono_string_new_len should be exported");
    });
  }));

  suite.addResult(createTest("mono_string_to_utf8 should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_string_to_utf8"), "mono_string_to_utf8 should be exported");
    });
  }));

  suite.addResult(createTest("mono_string_length should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_string_length"), "mono_string_length should be exported");
    });
  }));

  // Exception APIs
  suite.addResult(createTest("mono_raise_exception should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_raise_exception"), "mono_raise_exception should be exported");
    });
  }));

  suite.addResult(createTest("mono_exception_from_name_msg should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_exception_from_name_msg"), "mono_exception_from_name_msg should be exported");
    });
  }));

  // Array APIs
  suite.addResult(createTest("mono_array_new should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_array_new"), "mono_array_new should be exported");
    });
  }));

  suite.addResult(createTest("mono_array_length should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_array_length"), "mono_array_length should be exported");
    });
  }));

  // Field APIs
  suite.addResult(createTest("mono_field_get_value should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_field_get_value"), "mono_field_get_value should be exported");
    });
  }));

  suite.addResult(createTest("mono_field_set_value should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_field_set_value"), "mono_field_set_value should be exported");
    });
  }));

  // Internal Call APIs
  suite.addResult(createTest("mono_add_internal_call should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_add_internal_call"), "mono_add_internal_call should be exported");
    });
  }));

  // Memory Management APIs
  suite.addResult(createTest("mono_free should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_free"), "mono_free should be exported");
    });
  }));

  // GC Handle APIs
  suite.addResult(createTest("mono_gchandle_new should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gchandle_new"), "mono_gchandle_new should be exported");
    });
  }));

  suite.addResult(createTest("mono_gchandle_free should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gchandle_free"), "mono_gchandle_free should be exported");
    });
  }));

  // Garbage Collection APIs
  suite.addResult(createTest("mono_gc_collect should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gc_collect"), "mono_gc_collect should be exported");
    });
  }));

  suite.addResult(createTest("mono_gc_get_heap_size should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_gc_get_heap_size"), "mono_gc_get_heap_size should be exported");
    });
  }));

  // ============================================================================
  // Modern API Tests
  // ============================================================================

  suite.addResult(createTest("MonoApi has dispose method", () => {
    assert(typeof Mono.api.dispose === "function", "dispose should be a function");
  }));

  suite.addResult(createTest("MonoApi dispose can be called multiple times", () => {
    // Test with the existing API instance
    try {
      // Should not throw
      Mono.api.dispose();
      Mono.api.dispose();
      Mono.api.dispose();

      assert(true, "Multiple dispose calls should be safe");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Failed to discover Mono")) {
        console.log("    (Skipped: Mono runtime not available)");
        return;
      }
      throw error;
    }
  }));

  // Test modern API utilities
  suite.addResult(createTest("Mono.find utilities should be available", () => {
    Mono.perform(() => {
      assert(typeof Mono.find === "object", "Mono.find should be available");
      assert(typeof Mono.find.methods === "function", "Mono.find.methods should be available");
      assert(typeof Mono.find.classes === "function", "Mono.find.classes should be available");
    });
  }));

  suite.addResult(createTest("Mono.trace utilities should be available", () => {
    Mono.perform(() => {
      assert(typeof Mono.trace === "object", "Mono.trace should be available");
      assert(typeof Mono.trace.method === "function", "Mono.trace.method should be available");
      // Note: Mono.trace doesn't have a 'class' method, it has 'classAll' and 'classesByPattern'
    });
  }));

  suite.addResult(createTest("Mono.gc utilities should be available", () => {
    Mono.perform(() => {
      assert(typeof Mono.gc === "object", "Mono.gc should be available");
      assert(typeof Mono.gc.collect === "function", "Mono.gc.collect should be available");
      assert(typeof Mono.gc.maxGeneration === "number", "Mono.gc.maxGeneration should be available");
    });
  }));

  suite.addResult(createTest("Mono.version utilities should be available", () => {
    Mono.perform(() => {
      assert(typeof Mono.version === "object", "Mono.version should be available");
      assert(typeof Mono.version.features === "object", "Mono.version.features should be available");
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "API Availability Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} API tests passed`,
  };
}
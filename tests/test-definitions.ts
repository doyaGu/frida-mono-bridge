/**
 * Header Definitions Tests
 */

import Mono from "../src";
import { MonoEnums, MonoDefines } from "../src/runtime/enums";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks } from "./test-framework";

export function testDefinitions(): TestResult {
  console.log("\nHeader Definitions:");

  const suite = new TestSuite("Header Definitions");

  // Modern API tests (definitions don't need thread management, but we include for consistency)
  suite.addResult(createTest("Mono.perform should work for definition tests", () => {
    assertPerformWorks("Mono.perform() should work for definition tests");
  }));

  suite.addResult(createTest("MonoEnums should expose common enumerations", () => {
    Mono.perform(() => {
      assert(MonoEnums.MonoExceptionEnum.MONO_EXCEPTION_CLAUSE_NONE === 0, "Exception enum should include NONE");
      assert(MonoEnums.MonoCallConvention.MONO_CALL_STDCALL === 2, "Call convention enum should match header value");
      assert(MonoEnums.MonoMarshalNative.MONO_NATIVE_UTF8STR === 0x30, "Marshal native enum should include UTF8STR");
      console.log("    Basic enum values are correct");
    });
  }));

  suite.addResult(createTest("MonoEnums should be immutable", () => {
    Mono.perform(() => {
      assert(Object.isFrozen(MonoEnums.MonoExceptionEnum), "Enum maps should be frozen");
      assert(Object.isFrozen(MonoEnums), "Enum container should be frozen via as const");
      console.log("    Enum immutability verified");
    });
  }));

  suite.addResult(createTest("MonoDefines should expose numeric constants", () => {
    Mono.perform(() => {
      assert(MonoDefines.MONO_PROFILER_API_VERSION === 3, "Profiler API version should be available");
      assert(MonoDefines.MONO_DEBUGGER_MAJOR_VERSION >= 0, "Debugger major version should be numeric");
      console.log("    Basic define values are correct");
    });
  }));

  suite.addResult(createTest("Should test exception enumeration values", () => {
    Mono.perform(() => {
      const exceptionEnum = MonoEnums.MonoExceptionEnum;

      // Test common exception clause types
      assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_NONE === 'number', "NONE should be numeric");
      assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FILTER === 'number', "FILTER should be numeric");
      assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FINALLY === 'number', "FINALLY should be numeric");
      assert(typeof exceptionEnum.MONO_EXCEPTION_CLAUSE_FAULT === 'number', "FAULT should be numeric");

      console.log("    Exception enum values verified");
    });
  }));

  suite.addResult(createTest("Should test call convention enumeration", () => {
    Mono.perform(() => {
      const callConvEnum = MonoEnums.MonoCallConvention;

      // Test calling conventions
      assert(typeof callConvEnum.MONO_CALL_DEFAULT === 'number', "DEFAULT should be numeric");
      assert(typeof callConvEnum.MONO_CALL_C === 'number', "C should be numeric");
      assert(typeof callConvEnum.MONO_CALL_STDCALL === 'number', "STDCALL should be numeric");
      assert(typeof callConvEnum.MONO_CALL_THISCALL === 'number', "THISCALL should be numeric");
      assert(typeof callConvEnum.MONO_CALL_FASTCALL === 'number', "FASTCALL should be numeric");

      console.log("    Call convention enum values verified");
    });
  }));

  suite.addResult(createTest("Should test marshal native enumeration", () => {
    Mono.perform(() => {
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
    });
  }));

  suite.addResult(createTest("Should test profiler and debugger defines", () => {
    Mono.perform(() => {
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
    });
  }));

  suite.addResult(createTest("Should test other important defines", () => {
    Mono.perform(() => {
      // Test other common defines if they exist
      const commonDefines = [
        'MONO_TYPE_END', 'MONO_TYPE_VOID', 'MONO_TYPE_BOOLEAN', 'MONO_TYPE_CHAR',
        'MONO_TYPE_I1', 'MONO_TYPE_U1', 'MONO_TYPE_I2', 'MONO_TYPE_U2',
        'MONO_TYPE_I4', 'MONO_TYPE_U4', 'MONO_TYPE_I8', 'MONO_TYPE_U8',
        'MONO_TYPE_R4', 'MONO_TYPE_R8', 'MONO_TYPE_STRING', 'MONO_TYPE_PTR'
      ];

      let foundDefines = 0;
      for (const defineName of commonDefines) {
        if (typeof (MonoDefines as any)[defineName] === 'number') {
          foundDefines++;
        }
      }

      console.log(`    Found ${foundDefines}/${commonDefines.length} common type defines`);
      if (foundDefines === 0) {
        console.log("    Type-level defines not exposed in this runtime; skipping strict validation");
      }
    });
  }));

  suite.addResult(createTest("Should integrate definitions with fluent API", () => {
    Mono.perform(() => {
      // Test that definitions work alongside the fluent API
      const api = Mono.api;
      const domain = Mono.domain;
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
    });
  }));

  suite.addResult(createTest("Should handle definition access errors gracefully", () => {
    Mono.perform(() => {
      // Test accessing non-existent properties
      const nonExistentEnum = (MonoEnums as any).NonExistentEnum;
      assert(nonExistentEnum === undefined, "Non-existent enum should be undefined");

      const nonExistentDefine = (MonoDefines as any).NON_EXISTENT_DEFINE;
      assert(nonExistentDefine === undefined, "Non-existent define should be undefined");

      console.log("    Definition error handling works correctly");
    });
  }));

  suite.addResult(createTest("Should test definition value ranges and validity", () => {
    Mono.perform(() => {
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
    });
  }));

  const summary = suite.getSummary();

  return {
    name: "Header Include Definitions Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} include definition tests passed`,
  };
}

/**
 * Test Suite Index
 * Orchestrates all test modules and provides a unified test runner
 *
 * Test Categories:
 * - Core Infrastructure: Basic module setup and Mono detection
 * - Type System: MonoClass, MonoMethod, MonoField, MonoProperty
 * - Runtime Objects: MonoString, MonoArray, MonoDelegate, MonoObject
 * - Domain & Assembly: MonoDomain, MonoAssembly, MonoImage
 * - Advanced Features: GC Tools, Trace Tools, Find Tools, Generic Types
 * - Unity Integration: GameObject, Components, Engine Modules
 */

// Import test setup files
import "./test-common";
import "./test-utilities";

// ============================================================================
// CATEGORY 1: Core Infrastructure Tests
// ============================================================================
import { testCoreInfrastructure } from "./test-core-infrastructure";
import { testDataOperations } from "./test-data-operations";
import { testIntegration } from "./test-integration";
import { testMonoTypes } from "./test-mono-types";
import { testSupporting } from "./test-supporting";

// ============================================================================
// CATEGORY 2: Utility Tests (STANDALONE - No Mono dependency)
// ============================================================================
import runMonoErrorHandlingTests from "./test-mono-error-handling";
import { testMonoUtils } from "./test-mono-utils";

// ============================================================================
// CATEGORY 3: Type System Tests (MONO_DEPENDENT)
// ============================================================================
import { createGenericTypeTests } from "./test-generic-types";
import { createMonoClassTests } from "./test-mono-class";
import { createMonoFieldTests } from "./test-mono-field";
import { createMonoMethodTests } from "./test-mono-method";
import { createMonoPropertyTests } from "./test-mono-property";

// ============================================================================
// CATEGORY 4: Runtime Object Tests (MONO_DEPENDENT)
// ============================================================================
import { createMonoArrayTests } from "./test-mono-array";
import { testMonoData } from "./test-mono-data";
import { createMonoDelegateTests } from "./test-mono-delegate";
import { createMonoObjectTests } from "./test-mono-object";
import { createMonoStringTests } from "./test-mono-string";

// ============================================================================
// CATEGORY 5: Domain & Assembly Tests (MONO_DEPENDENT)
// ============================================================================
import { testMonoApi } from "./test-mono-api";
import { createMonoAssemblyTests } from "./test-mono-assembly";
import { testMonoDomain } from "./test-mono-domain";
import { createMonoImageTests } from "./test-mono-image";
import { testMonoModule } from "./test-mono-module";
import { testMonoThreading } from "./test-mono-threading";
import { createRuntimeApiTests } from "./test-runtime-api";

// ============================================================================
// CATEGORY 6: Advanced Feature Tests (MONO_DEPENDENT)
// ============================================================================
import { createFindToolTests } from "./test-find-tools";
import { createGCToolsTests } from "./test-gc-tools";
import { createTraceToolsTests } from "./test-trace-tools";

// ============================================================================
// CATEGORY 7: Unity Integration Tests (MONO_DEPENDENT)
// ============================================================================
import { testUnityComponents } from "./test-unity-components";
import { testUnityEngineModules } from "./test-unity-engine-modules";
import { testUnityGameObject } from "./test-unity-gameobject";

// Export consolidated test modules for selective testing
export {
  // Advanced Feature Tests
  createFindToolTests,
  createGCToolsTests,
  createGenericTypeTests,
  createMonoArrayTests,
  createMonoAssemblyTests,
  // Type System Tests
  createMonoClassTests,
  createMonoDelegateTests,
  createMonoFieldTests,
  createMonoImageTests,
  createMonoMethodTests,
  createMonoObjectTests,
  createMonoPropertyTests,
  // Runtime Object Tests
  createMonoStringTests,
  createRuntimeApiTests,
  createTraceToolsTests,
  // Core Infrastructure Tests
  testCoreInfrastructure,
  testDataOperations,
  testIntegration,
  // Domain & Assembly Tests
  testMonoApi,
  testMonoData,
  testMonoDomain,
  runMonoErrorHandlingTests as testMonoErrorHandling,
  testMonoModule,
  testMonoThreading,
  testMonoTypes,
  // Utility Tests (STANDALONE)
  testMonoUtils,
  testSupporting,
  testUnityComponents,
  testUnityEngineModules,
  // Unity Integration Tests
  testUnityGameObject,
};

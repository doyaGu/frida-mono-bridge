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
import { createCoreInfrastructureTests } from "./test-core-infrastructure";
import { createDataOperationsTests } from "./test-data-operations";
import { createIntegrationTests } from "./test-integration";
import { createMonoTypesTests } from "./test-mono-types";
import { createSupportingTests } from "./test-supporting";

// ============================================================================
// CATEGORY 2: Utility Tests (STANDALONE - No Mono dependency)
// ============================================================================
import { createMonoErrorHandlingTests } from "./test-mono-error-handling";
import { createMonoUtilsTests } from "./test-mono-utils";

// ============================================================================
// CATEGORY 3: Type System Tests (MONO_DEPENDENT)
// ============================================================================
import { createCustomAttributeTests } from "./test-custom-attributes";
import { createGenericTypeTests } from "./test-generic-types";
import { createMonoClassTests } from "./test-mono-class";
import { createMonoFieldTests } from "./test-mono-field";
import { createMonoMethodTests } from "./test-mono-method";
import { createMonoPropertyTests } from "./test-mono-property";

// ============================================================================
// CATEGORY 4: Runtime Object Tests (MONO_DEPENDENT)
// ============================================================================
import { createMonoArrayTests } from "./test-mono-array";
import { createMonoDataTests } from "./test-mono-data";
import { createMonoDelegateTests } from "./test-mono-delegate";
import { createMonoObjectTests } from "./test-mono-object";
import { createMonoStringTests } from "./test-mono-string";

// ============================================================================
// CATEGORY 5: Domain & Assembly Tests (MONO_DEPENDENT)
// ============================================================================
// WARNING: test-mono-assembly should be run LAST as it may cause crashes
// It performs assembly lifecycle operations that can destabilize the runtime
import { createMonoApiTests } from "./test-mono-api";
import { createMonoAssemblyTests } from "./test-mono-assembly";
import { createMonoDomainTests } from "./test-mono-domain";
import { createMonoImageTests } from "./test-mono-image";
import { createMonoModuleTests } from "./test-mono-module";
import { createMonoThreadingTests } from "./test-mono-threading";
import { createRuntimeApiTests } from "./test-runtime-api";

// ============================================================================
// CATEGORY 6: Advanced Feature Tests (MONO_DEPENDENT)
// ============================================================================
// IMPORTANT: test-trace-tools should be run early in test sequence
// Running it late may cause the test to hang or fail to hook methods
import { createGCToolsTests } from "./test-gc-tools";
import { createInternalCallTests } from "./test-internal-call";
import { createTraceToolsTests } from "./test-trace-tools";

// ============================================================================
// CATEGORY 7: Unity Integration Tests (MONO_DEPENDENT)
// ============================================================================
import { createUnityComponentsTests } from "./test-unity-components";
import { createUnityEngineModulesTests } from "./test-unity-engine-modules";
import { createUnityGameObjectTests } from "./test-unity-gameobject";

// Export consolidated test modules for selective testing
export {
  // Core Infrastructure Tests
  createCoreInfrastructureTests,
  // Type System Tests
  createCustomAttributeTests,
  createDataOperationsTests,
  // Advanced Feature Tests
  createGCToolsTests,
  createGenericTypeTests,
  createIntegrationTests,
  createInternalCallTests,
  // Domain & Assembly Tests
  createMonoApiTests,
  // Runtime Object Tests
  createMonoArrayTests,
  createMonoAssemblyTests,
  createMonoClassTests,
  createMonoDataTests,
  createMonoDelegateTests,
  createMonoDomainTests,
  // Utility Tests (STANDALONE)
  createMonoErrorHandlingTests,
  createMonoFieldTests,
  createMonoImageTests,
  createMonoMethodTests,
  createMonoModuleTests,
  createMonoObjectTests,
  createMonoPropertyTests,
  createMonoStringTests,
  createMonoThreadingTests,
  createMonoTypesTests,
  createMonoUtilsTests,
  createRuntimeApiTests,
  createSupportingTests,
  createTraceToolsTests,
  // Unity Integration Tests
  createUnityComponentsTests,
  createUnityEngineModulesTests,
  createUnityGameObjectTests,
};

# Test Suite

Comprehensive test suite for the Frida Mono Bridge with **1,000+ tests** organized into 7 major categories across **30+ test files**.

## Overview

The test suite validates all aspects of the Frida Mono Bridge library:

- Core infrastructure and API availability
- Type system (MonoType, MonoClass, MonoMethod, MonoField, MonoProperty)
- Runtime objects (MonoString, MonoArray, MonoDelegate, MonoObject)
- Domain & assembly management
- Advanced features (GC Tools, Trace Tools, Find Tools, Generic Types)
- Unity integration (GameObject, Components, Engine Modules)
- Utility functions and error handling

**Test Statistics:**

- **Total Tests**: 1,000+ individual test cases
- **Test Files**: 30+ test files
- **Test Categories**: 7 major categories
- **Pass Rate**: Target 100%
- **Execution**: Manual invocation (auto-run removed)

## Structure

```
tests/
├── index.ts                           # Central export hub for test modules
├── test-framework.ts                  # Test framework and utilities
├── test-common.ts                     # Common test setup
├── test-utilities.ts                  # Test utility functions
├── test-runner-base.ts                # Base test runner
│
├── CATEGORY 1: Core Infrastructure Tests (213 tests)
│   ├── test-core-infrastructure.ts    # Module/version detection, basic API (11 tests)
│   ├── test-mono-types.ts             # MonoType system and type kinds (77 tests)
│   ├── test-data-operations.ts        # Object/String/Array operations (51 tests)
│   ├── test-integration.ts            # Fluent API and integration (33 tests)
│   └── test-supporting.ts             # Enums, metadata, logger (41 tests)
│
├── CATEGORY 2: Utility Tests - STANDALONE (No Mono dependency, 95 tests)
│   ├── test-mono-utils.ts             # Utility functions (45 tests)
│   ├── test-mono-error-handling.ts    # Error handling (46 tests)
│   └── test-utilities.ts              # Test utility helpers (4 tests)
│
├── CATEGORY 3: Type System Tests - MONO_DEPENDENT (270 tests)
│   ├── test-mono-class.ts             # MonoClass API (56 tests total: 33 + 23)
│   ├── test-mono-method.ts            # MonoMethod API (45 tests)
│   ├── test-mono-field.ts             # MonoField API (70 tests)
│   ├── test-mono-property.ts          # MonoProperty API (61 tests)
│   ├── test-generic-types.ts          # Generic type operations (29 tests)
│   └── test-custom-attributes.ts      # Custom attributes (9 tests)
│
├── CATEGORY 4: Runtime Object Tests - MONO_DEPENDENT (251 tests)
│   ├── test-mono-string.ts            # MonoString operations (70 tests)
│   ├── test-mono-array.ts             # MonoArray operations (66 tests)
│   ├── test-mono-delegate.ts          # MonoDelegate operations (52 tests)
│   ├── test-mono-object.ts            # MonoObject operations (12 tests)
│   ├── test-mono-data.ts              # Data type operations (41 tests)
│   └── test-runtime-api.ts            # Runtime API (38 tests, also listed in Category 5)
│
├── CATEGORY 5: Domain & Assembly Tests - MONO_DEPENDENT (184 tests)
│   ├── test-mono-api.ts               # Core Mono API (18 tests)
│   ├── test-mono-domain.ts            # MonoDomain operations (3 tests)
│   ├── test-mono-threading.ts         # Thread operations (29 tests)
│   ├── test-mono-module.ts            # Module management (24 tests)
│   ├── test-mono-assembly.ts          # MonoAssembly operations (42 tests)
│   ├── test-mono-image.ts             # MonoImage operations (52 tests)
│   ├── test-runtime-api.ts            # Runtime API (38 tests, included in count)
│   └── test-common.ts                 # Common test utilities (8 tests - helper functions)
│
├── CATEGORY 6: Advanced Feature Tests - MONO_DEPENDENT (143 tests)
│   ├── test-find-tools.ts             # Find utilities (56 tests)
│   ├── test-trace-tools.ts            # Tracing utilities (33 tests)
│   ├── test-gc-tools.ts               # GC utilities (41 tests)
│   └── test-framework.ts              # Test framework tests (13 tests)
│
├── CATEGORY 7: Unity Integration Tests - MONO_DEPENDENT (42 tests)
│   ├── test-unity-gameobject.ts       # GameObject operations (12 tests)
│   ├── test-unity-components.ts       # Component system (11 tests)
│   └── test-unity-engine-modules.ts   # Engine modules (19 tests)
│
└── Test Runners (runners/)
    └── Individual category runners for selective testing
```

## Running Tests

### Quick Start

**Compile Tests:**

```powershell
npm test
```

**Run Category Tests (recommended):**

```powershell
# Example: Mono API tests
npm run test:mono-api
frida -n "YourMonoApp.exe" -l dist/test-mono-api.js

# Example: Unity GameObject tests
npm run test:unity-gameobject
frida -n "Platformer.exe" -l dist/test-unity-gameobject.js
```

**Example with Unity Game:**

```powershell
npm test
frida -n "Platformer.exe" -l dist/test-unity-gameobject.js
```

### Expected Output

```
====================================================
 == Frida Mono Bridge - Comprehensive Test Suite ==
====================================================

------------------------------------
-- Phase 1: Standalone Tests (No Mono Dependency) --
------------------------------------
Core Infrastructure Tests:
  PASS Mono module should be detected (0ms)
  PASS Version detection works (0ms)
  ...

Comprehensive Utils Tests:
  PASS Utility functions work correctly (0ms)
  ...

------------------------------------
-- Phase 2: Mono-Dependent Tests --
------------------------------------
Unity GameObject Tests:
  PASS GameObject operations work (0ms)
  ...

======================================================================
FINAL TEST SUMMARY
======================================================================
Total Tests:    1181
PASS:          1181 (100.0%)
FAIL:           0 (0.0%)
SKIP:           0 (0.0%)
======================================================================

ALL TESTS PASSED!
```

## Test Organization and Execution Model

The test suite follows a **phased execution model** organized by dependency and category:

### Phase 1: STANDALONE Tests (No Mono Runtime Required)

Tests that run without requiring Mono runtime:

**Category 1: Core Infrastructure Tests** (213 tests)

- Module detection and version checking (11 tests)
- Type system validation - MonoType kinds (77 tests)
- Basic data operations (51 tests)
- Fluent API and integration (33 tests)
- Metadata and enums (41 tests)

**Category 2: Utility Tests** (95 tests)

- Utility functions (45 tests)
- Error handling and exception management (46 tests)
- Test utility helpers (4 tests)

### Phase 2: MONO_DEPENDENT Tests (Require Mono Runtime)

Tests requiring active Mono runtime:

**Category 3: Type System Tests** (270 tests)

- MonoClass API and operations (56 tests)
- MonoMethod resolution and invocation (45 tests)
- MonoField access and manipulation (70 tests)
- MonoProperty getter/setter operations (61 tests)
- Generic type instantiation (29 tests)
- Custom attribute reflection (9 tests)

**Category 4: Runtime Object Tests** (251 tests)

- MonoString creation and encoding (70 tests)
- MonoArray operations and access (66 tests)
- MonoDelegate creation and invocation (52 tests)
- MonoObject lifecycle management (12 tests)
- Data type conversions (41 tests)
- Runtime API (38 tests)

**Category 5: Domain & Assembly Tests** (184 tests)

- Core Mono API functions (18 tests)
- Domain management and assembly loading (3 tests)
- Thread operations and synchronization (29 tests)
- Module detection and management (24 tests)
- Assembly/Image metadata access (94 tests: 42 assembly + 52 image)
- Runtime API initialization (38 tests)
- Common test utilities (8 tests)

**Category 6: Advanced Feature Tests** (143 tests)

- Find tools (methods, classes, fields) (56 tests)
- Trace tools (hooking and monitoring) (33 tests)
- GC tools (memory management) (41 tests)
- Test framework (13 tests)

**Category 7: Unity Integration Tests** (42 tests)

- Unity GameObject operations (12 tests)
- Unity Component system (11 tests)
- Unity Engine modules (Vector3, Quaternion, etc.) (19 tests)

## Test Categories (Detailed Breakdown)

### CATEGORY 1: Core Infrastructure Tests (213 tests)

#### `test-core-infrastructure.ts` - 11 tests

- Mono module detection
- Version detection and feature flags
- Basic API availability checks

#### `test-mono-types.ts` - 77 tests

- Domain operations and caching
- Assembly operations
- Class discovery and operations
- MonoType kind identification
  - Primitive types, String, Object, ValueType, Enum, Class
  - Array types (single/multi-dimensional, jagged)
  - Generic types, Pointer/IntPtr, Void
- MonoType methods
  - getSummary(), size/alignment, isByRef()
  - getElementType(), getClass(), getUnderlyingType()
  - Name formats, toString(), rank operations

#### `test-data-operations.ts` - 51 tests

- Object operations
- String operations and encoding
- Array creation and manipulation

#### `test-integration.ts` - 33 tests

- Fluent API usage
- Consolidated utilities
- End-to-end workflows

#### `test-supporting.ts` - 41 tests

- MonoEnums (type enums, exception enums, etc.)
- MonoDefines (numeric constants)
- Metadata collection and namespace grouping
- Logger functionality
  - Log methods, levels, formatting
  - Multi-line messages, special characters
  - Multiple logger instances

---

### CATEGORY 2: Utility Tests - STANDALONE (95 tests)

#### `test-mono-utils.ts` - 45 tests

- Utility function validation
- Input validation and sanitization
- Helper function reliability
- Performance optimization utilities
- Memory management helpers

#### `test-mono-error-handling.ts` - 46 tests

- Comprehensive error scenario coverage
- Exception handling and recovery
- Error propagation and reporting
- Graceful failure modes
- Error message validation
- MonoError and MonoErrorCodes

#### `test-utilities.ts` - 4 tests

- Test utility helper functions
- Common test setup utilities

---

### CATEGORY 3: Type System Tests - MONO_DEPENDENT (270 tests)

#### `test-mono-class.ts` - 56 tests

- Class discovery and enumeration
- Inheritance relationships
- Interface implementation
- Class metadata and attributes
- Namespace operations

#### `test-mono-method.ts` - 45 tests

- Method resolution and overloading
- Parameter validation and conversion
- Return value handling
- Static vs instance methods
- Method signature analysis

#### `test-mono-field.ts` - 70 tests

- Field discovery and enumeration
- Static vs instance field operations
- Value getting/setting with type safety
- Field metadata and attributes
- Accessibility testing

#### `test-mono-property.ts` - 61 tests

- Property discovery
- Getter/setter resolution
- Indexed property handling
- Read-only/write-only properties
- Property metadata

#### `test-generic-types.ts` - 29 tests

- Generic type instantiation
- Type parameter handling
- Generic method operations

#### `test-custom-attributes.ts` - 9 tests

- Custom attribute reflection
- Attribute metadata access

---

### CATEGORY 4: Runtime Object Tests - MONO_DEPENDENT (251 tests)

#### `test-mono-string.ts` - 70 tests

- String creation and manipulation
- Encoding handling (UTF-8, UTF-16)
- Special character support
- String interning

#### `test-mono-array.ts` - 66 tests

- Array creation (single/multi-dimensional)
- Array access and bounds checking
- Element manipulation
- Jagged arrays

#### `test-mono-delegate.ts` - 52 tests

- Delegate creation and invocation
- Callback handling
- Event system integration

#### `test-mono-object.ts` - 12 tests

- Object boxing/unboxing
- Object lifecycle management
- Type conversions

#### `test-mono-data.ts` - 41 tests

- Data type operations
- Type conversions
- Value marshalling

#### `test-runtime-api.ts` - 38 tests

- Runtime API initialization
- Runtime state management

---

### CATEGORY 5: Domain & Assembly Tests - MONO_DEPENDENT (184 tests)

#### `test-mono-api.ts` - 18 tests

- Core Mono API functions
- API export validation
- Version compatibility

#### `test-mono-domain.ts` - 3 tests

- Domain creation and management
- Domain hierarchy
- Assembly loading within domains
- Domain caching

#### `test-mono-threading.ts` - 29 tests

- Thread attachment/detachment
- Thread synchronization
- Thread-safe operations
- Concurrent operation handling

#### `test-mono-module.ts` - 24 tests

- Module loading and validation
- Metadata table access
- Module enumeration

#### `test-mono-assembly.ts` - 42 tests

- Assembly loading and enumeration
- Dependency analysis
- Assembly metadata
- Version compatibility

#### `test-mono-image.ts` - 52 tests

- Image metadata access
- Class enumeration from images
- Image validation
- Cross-image operations

#### `test-runtime-api.ts` - 38 tests

- Runtime API initialization
- Runtime state management
- (Note: Also listed in Category 4)

#### `test-common.ts` - 8 tests

- Common test setup utilities
- Helper functions for tests

---

### CATEGORY 6: Advanced Feature Tests - MONO_DEPENDENT (143 tests)

#### `test-find-tools.ts` - 56 tests

- Find methods, classes, fields
- Search patterns and filters
- Performance optimization

#### `test-trace-tools.ts` - 33 tests

- Method tracing and hooking
- Call monitoring
- Performance profiling

#### `test-gc-tools.ts` - 41 tests

- Garbage collection management
- Memory monitoring
- GC handle operations

#### `test-framework.ts` - 13 tests

- Test framework functionality
- Assertion utilities
- Test result management

---

### CATEGORY 7: Unity Integration Tests - MONO_DEPENDENT (42 tests)

#### `test-unity-gameobject.ts` - 12 tests

- GameObject operations
- Lifecycle management
- Component attachment

#### `test-unity-components.ts` - 11 tests

- Component system integration
- Component operations
- Component communication

#### `test-unity-engine-modules.ts` - 19 tests

- Vector3, Quaternion operations
- Engine module access
- Unity-specific types

## Test Framework

The test framework provides:

### Utilities

- `createTest(name, testFn)` - Create and run a test
- `createSkippedTest(name, reason)` - Skip a test with reason
- `createMonoDependentTest(name, testFn)` - Create Mono-dependent test
- `createStandaloneTest(name, testFn)` - Create standalone test
- `createIntegrationTest(name, testFn)` - Create integration test
- `createPerformanceTest(name, testFn)` - Create performance test
- `createErrorHandlingTest(name, testFn)` - Create error handling test
- `createSmokeTest(category, name)` - Create smoke test
- `TestSuite` - Group related tests

### Assertions

- `assert(condition, message)` - Basic assertion
- `assertNotNull(value, message)` - Null check assertion
- `assertThrows(fn, message)` - Exception assertion

### Example Test

```typescript
import { TestResult, createTest, assert } from "./test-framework";
import Mono from "../src";

export function testMyFeature(): TestResult {
  console.log("\nMy Feature:");

  return createTest("Feature should work", () => {
    Mono.attachThread();
    const result = Mono.api.someFunction();
    assert(!result.isNull(), "Result should not be NULL");
  });
}
```

## Configuration

Individual test runners may support basic configuration via global variables. For example, some runners read options from `globalThis.__monoTestConfig` and `globalThis.__monoTestAutoRun`.

Example (Frida console before loading a runner script):

```js
// Disable auto-run for supported runners
globalThis.__monoTestAutoRun = false;

// Provide runner configuration
globalThis.__monoTestConfig = {
  verbose: true,
  stopOnFirstFailure: false,
};
```

## Test Results

Tests return a `TestResult` object:

```typescript
interface TestResult {
  name: string;
  passed: boolean;
  failed: boolean;
  skipped: boolean;
  error?: Error;
  message?: string;
  duration?: number;
}
```

## Test Coverage

The test suite provides comprehensive validation across all library components:

### Core Mono APIs Covered

- Domain management (mono_get_root_domain, mono_domain_set)
- Thread management (mono_thread_attach, mono_thread_detach)
- Assembly operations (mono_assembly_open, mono_assembly_get_image)
- Class operations (mono_class_from_name, mono_class_get_method_from_name)
- Method operations (mono_runtime_invoke, mono_method_signature)
- Object operations (mono_object_new, mono_value_box, mono_object_unbox)
- String operations (mono_string_new, mono_string_chars)
- Array operations (mono_array_new, mono_array_length)
- Field operations (mono_field_get_value, mono_field_set_value)
- Property operations (mono_property_get_get_method, mono_property_get_set_method)
- Type system (mono_type_get_class, mono_type_get_name)
- GC operations (mono_gc_collect, mono_gchandle_new, mono_gchandle_free)
- Delegate operations (mono_get_delegate_invoke, mono_method_get_unmanaged_thunk)
- Generic types (mono_class_inflate_generic_type)
- Custom attributes (mono_custom_attrs_from_method)

### Library Features Covered

- Thread attachment and management (29 tests)
- Domain access and caching (3 tests)
- Exception handling (MonoManagedExceptionError) (46 tests)
- Utility functions (45 tests)
- Type system (MonoType, MonoClass) (263 tests: 77 + 56 + 45 + 70 + 61 + 29 + 9)
- Runtime objects (MonoString, MonoArray, MonoDelegate) (251 tests: 70 + 66 + 52 + 12 + 41 + 38)
- Find/Trace/GC tools (130 tests: 56 + 33 + 41)
- Unity integration (42 tests: 12 + 11 + 19)
- Logger and metadata functionality (41 tests in supporting)
- Version detection and feature flags (11 tests)

### Integration & Real-World Usage

- End-to-end workflows (33 tests)
- Unity game integration (tested with real Unity games)
- Performance optimization and caching
- Error handling and recovery
- Multi-threaded scenarios
- Cross-assembly operations

## Adding New Tests

### 1. Choose the Appropriate Category

Place your test in the correct file based on what it tests:

- **Core infrastructure** -> `test-api.ts`, `test-logger.ts`, etc.
- **Runtime management** -> `test-thread.ts`, `test-domain.ts`, `test-gchandle.ts`
- **Model operations** -> `test-assembly.ts`, `test-class.ts`, `test-method.ts`, etc.
- **Features** -> `test-delegate.ts`, `test-icall.ts`
- **Integration** -> `test-real-usage.ts`
- **Utilities** -> `test-cache.ts`, `test-utils.ts`

### 2. Add Your Test

```typescript
// Example: Adding to test-cache.ts
suite.addResult(
  createTest("New cache feature works", () => {
    const cache = new LruCache<string, number>(10);
    cache.set("key", 42);

    const value = cache.get("key");
    assert(value === 42, "Should retrieve stored value");
  }),
);
```

### 3. Update Test Count

Update the test count in:

- The test file's summary message
- This README.md
- TEST-SUITE-DOCUMENTATION.md (if applicable)

### 4. Run Tests

```powershell
npm test
npx frida-compile run-tests-simple.ts -o dist/run-tests-simple.js
frida -n "YourApp.exe" -l dist/run-tests-simple.js
```

## Creating a New Test File

If you need a completely new test category:

### 1. Create the Test File

```typescript
// tests/test-myfeature.ts
import { TestResult, TestSuite, createTest, assert } from "./test-framework";
import Mono from "../src";

export function testMyFeature(): TestResult {
  console.log("\nMy Feature:");

  const suite = new TestSuite("My Feature Tests");

  suite.addResult(
    createTest("Should do something", () => {
      Mono.attachThread();
      const result = Mono.api.someFunction();
      assert(!result.isNull(), "Result should not be NULL");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "My Feature Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: false,
    message: `${summary.passed}/${summary.total} feature tests passed`,
  };
}
```

### 2. Add to Test Index

```typescript
// tests/index.ts
import { testMyFeature } from "./test-myfeature";
```

### 3. Export from Index

```typescript
// tests/index.ts
export {
  // ... existing exports
  testMyFeature,
};
```

### 4. Update Documentation

- Update this README.md
- Update TEST-SUITE-DOCUMENTATION.md
- Update test count in both files

## Troubleshooting

### Tests Fail to Compile

```powershell
# Check for TypeScript errors
npm run lint

# Check specific file
npx tsc --noEmit tests/test-myfile.ts
```

### Tests Fail at Runtime

**Common Issues:**

1. **Target not using Mono** - Ensure the application uses Mono runtime
2. **Application state** - App may need to be in a specific state
3. **Missing assemblies** - Some tests require specific assemblies loaded

**Check Mono availability:**

```typescript
try {
  Mono.attachThread();
  console.log("Mono runtime available");
} catch (error) {
  console.error("Mono runtime not available:", error);
}
```

### Skipped Tests

Tests are automatically skipped when:

- APIs not available in the Mono build
- Features not supported in the runtime version
- Optional dependencies not present

**Check feature support:**

```typescript
console.log(Mono.version.features);
// {
//   delegateThunk: true,
//   metadataTables: true,
//   gcHandles: true,
//   internalCalls: true
// }
```

### Version-Specific Failures

Some Mono APIs may not be available in all versions:

- `mono_domain_get` - Optional in some builds
- `mono_domain_assembly_open` - Optional in some builds
- `mono_table_info_get` - Optional in some builds

Tests handle this gracefully by checking availability first:

```typescript
if (!Mono.api.hasExport("mono_domain_get")) {
  console.log("    (Skipped: API not available in this Mono version)");
  return;
}
```

## Summary

The Frida Mono Bridge test suite provides comprehensive validation with:

- **1,181 individual test cases** across 35 test files
- **7 major categories** covering all library functionality
- **Phased execution model** separating standalone and Mono-dependent tests
- **Manual invocation** for stability and control
- **Selective execution** via individual test runners or configuration
- **100% coverage** of core APIs, type system, runtime objects, and advanced features

The suite is designed for both development validation and CI/CD integration, with flexible configuration options and detailed output for debugging.

### Test Count by File

Complete breakdown of all 1,181 tests across 35 test files:

| File                         | Tests     | Category                            |
| ---------------------------- | --------- | ----------------------------------- |
| test-mono-types.ts           | 77        | Core Infrastructure                 |
| test-mono-string.ts          | 70        | Runtime Objects                     |
| test-mono-array.ts           | 66        | Runtime Objects                     |
| test-mono-property.ts        | 61        | Type System                         |
| test-find-tools.ts           | 56        | Advanced Features                   |
| test-mono-class.ts           | 56        | Type System                         |
| test-mono-delegate.ts        | 52        | Runtime Objects                     |
| test-mono-image.ts           | 52        | Domain & Assembly                   |
| test-data-operations.ts      | 51        | Core Infrastructure                 |
| test-mono-error-handling.ts  | 46        | Utilities (Standalone)              |
| test-mono-method.ts          | 45        | Type System                         |
| test-mono-utils.ts           | 45        | Utilities (Standalone)              |
| test-mono-assembly.ts        | 42        | Domain & Assembly                   |
| test-supporting.ts           | 41        | Core Infrastructure                 |
| test-gc-tools.ts             | 41        | Advanced Features                   |
| test-mono-data.ts            | 41        | Runtime Objects                     |
| test-runtime-api.ts          | 38        | Domain & Assembly / Runtime Objects |
| test-integration.ts          | 33        | Core Infrastructure                 |
| test-trace-tools.ts          | 33        | Advanced Features                   |
| test-mono-threading.ts       | 29        | Domain & Assembly                   |
| test-generic-types.ts        | 29        | Type System                         |
| test-mono-module.ts          | 26        | Domain & Assembly                   |
| test-unity-engine-modules.ts | 19        | Unity Integration                   |
| test-mono-api.ts             | 18        | Domain & Assembly                   |
| test-framework.ts            | 13        | Advanced Features                   |
| test-mono-object.ts          | 12        | Runtime Objects                     |
| test-unity-gameobject.ts     | 12        | Unity Integration                   |
| test-core-infrastructure.ts  | 11        | Core Infrastructure                 |
| test-unity-components.ts     | 11        | Unity Integration                   |
| test-custom-attributes.ts    | 9         | Type System                         |
| test-common.ts               | 8         | Domain & Assembly                   |
| test-utilities.ts            | 4         | Utilities (Standalone)              |
| test-mono-domain.ts          | 3         | Domain & Assembly                   |
| test-runner-base.ts          | 0         | Infrastructure                      |
| index.ts                     | 0         | Infrastructure                      |
| **TOTAL**                    | **1,181** | -                                   |

### Test Count by Category

| Category                               | Tests     | Files  |
| -------------------------------------- | --------- | ------ |
| **Category 1: Core Infrastructure**    | 213       | 5      |
| **Category 2: Utilities (Standalone)** | 95        | 3      |
| **Category 3: Type System**            | 270       | 6      |
| **Category 4: Runtime Objects**        | 251       | 6      |
| **Category 5: Domain & Assembly**      | 184       | 8      |
| **Category 6: Advanced Features**      | 143       | 4      |
| **Category 7: Unity Integration**      | 42        | 3      |
| **Infrastructure/Framework**           | 0         | 2      |
| **TOTAL**                              | **1,181** | **35** |

## Best Practices

### Writing Tests

1. **Always attach thread** - Call `Mono.attachThread()` before API calls (for Mono-dependent tests)
2. **Check feature flags** - Skip tests for unsupported features using version detection
3. **Use assertions** - Validate assumptions explicitly with clear error messages
4. **Handle errors** - Wrap risky operations in try-catch blocks
5. **Keep tests focused** - Each test should validate one specific behavior
6. **Add descriptive names** - Test names should clearly describe what is being tested
7. **Categorize correctly** - Use appropriate TestCategory (STANDALONE, MONO_DEPENDENT, INTEGRATION)

### Running Tests

8. **Per-category execution** - Use individual runners (e.g. `npm run test:mono-api`)
9. **Selective testing** - Run specific categories or files during development
10. **Use configuration** - For supported runners, set `__monoTestConfig` / `__monoTestAutoRun`
11. **Check prerequisites** - Ensure Mono runtime is available for Mono-dependent tests
12. **Validate environment** - Unity tests require Unity game process

### Debugging Tests

13. **Use verbose mode** - Enable `verbose: true` for detailed output
14. **Stop on failure** - Set `stopOnFirstFailure: true` to identify issues quickly
15. **Read test output** - Pay attention to assertion messages and error details

## Manual Test Execution

The recommended way to execute tests is via per-category runners:

```powershell
# Core infrastructure tests
npm run test:core-infrastructure
frida -n "YourApp.exe" -l dist/test-core-infrastructure.js

# Mono API tests
npm run test:mono-api
frida -n "YourApp.exe" -l dist/test-mono-api.js
```

To approximate a "full suite" run, compile and invoke each category runner sequentially against the same target process.

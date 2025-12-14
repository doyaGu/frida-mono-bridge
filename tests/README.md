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
├── CATEGORY 1: Core Infrastructure Tests (~200 tests)
│   ├── test-core-infrastructure.ts    # Module/version detection, basic API (22 tests)
│   ├── test-mono-types.ts             # MonoType system and type kinds (106 tests)
│   ├── test-data-operations.ts        # Object/String/Array operations (69 tests)
│   ├── test-integration.ts            # Fluent API and integration (75 tests)
│   └── test-supporting.ts             # Enums, metadata, logger (69 tests)
│
├── CATEGORY 2: Utility Tests - STANDALONE (No Mono dependency, ~94 tests)
│   ├── test-mono-utils.ts             # Utility functions (45 tests)
│   └── test-mono-error-handling.ts    # Error handling (49 tests)
│
├── CATEGORY 3: Type System Tests - MONO_DEPENDENT (~245 tests)
│   ├── test-mono-class.ts             # MonoClass API (35 tests)
│   ├── test-mono-method.ts            # MonoMethod API (49 tests)
│   ├── test-mono-field.ts             # MonoField API (74 tests)
│   ├── test-mono-property.ts          # MonoProperty API (58 tests)
│   └── test-generic-types.ts          # Generic type operations (29 tests)
│
├── CATEGORY 4: Runtime Object Tests - MONO_DEPENDENT (~272 tests)
│   ├── test-mono-string.ts            # MonoString operations (70 tests)
│   ├── test-mono-array.ts             # MonoArray operations (66 tests)
│   ├── test-mono-delegate.ts          # MonoDelegate operations (52 tests)
│   ├── test-mono-object.ts            # MonoObject operations (11 tests)
│   └── test-mono-data.ts              # Data type operations (73 tests)
│
├── CATEGORY 5: Domain & Assembly Tests - MONO_DEPENDENT (~291 tests)
│   ├── test-mono-api.ts               # Core Mono API (32 tests)
│   ├── test-mono-domain.ts            # MonoDomain operations (45 tests)
│   ├── test-mono-threading.ts         # Thread operations (50 tests)
│   ├── test-mono-module.ts            # Module management (39 tests)
│   ├── test-mono-assembly.ts          # MonoAssembly operations (39 tests)
│   ├── test-mono-image.ts             # MonoImage operations (47 tests)
│   └── test-runtime-api.ts            # Runtime API (39 tests)
│
├── CATEGORY 6: Advanced Feature Tests - MONO_DEPENDENT (~135 tests)
│   ├── test-find-tools.ts             # Find utilities (56 tests)
│   ├── test-trace-tools.ts            # Tracing utilities (34 tests)
│   ├── test-gc-tools.ts               # GC utilities (36 tests)
│   └── test-custom-attributes.ts      # Custom attributes (9 tests)
│
├── CATEGORY 7: Unity Integration Tests - MONO_DEPENDENT (~58 tests)
│   ├── test-unity-gameobject.ts       # GameObject operations (14 tests)
│   ├── test-unity-components.ts       # Component system (19 tests)
│   └── test-unity-engine-modules.ts   # Engine modules (25 tests)
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
Total Tests:    1400+
PASS:          1400+ (100.0%)
FAIL:           0 (0.0%)
SKIP:           0 (0.0%)
======================================================================

ALL TESTS PASSED!
```

## Test Organization and Execution Model

The test suite follows a **phased execution model** organized by dependency and category:

### Phase 1: STANDALONE Tests (No Mono Runtime Required)

Tests that run without requiring Mono runtime:

**Category 1: Core Infrastructure Tests** (~200 tests)

- Module detection and version checking
- Type system validation (MonoType kinds)
- Basic data operations
- Metadata and enums
- Logger functionality

**Category 2: Utility Tests** (~94 tests)

- Utility functions (45 tests)
- Error handling and exception management (49 tests)

### Phase 2: MONO_DEPENDENT Tests (Require Mono Runtime)

Tests requiring active Mono runtime:

**Category 3: Type System Tests** (~245 tests)

- MonoClass API and operations
- MonoMethod resolution and invocation
- MonoField access and manipulation
- MonoProperty getter/setter operations
- Generic type instantiation

**Category 4: Runtime Object Tests** (~272 tests)

- MonoString creation and encoding
- MonoArray operations and access
- MonoDelegate creation and invocation
- MonoObject lifecycle management
- Data type conversions

**Category 5: Domain & Assembly Tests** (~291 tests)

- Core Mono API functions
- Domain management and assembly loading
- Thread operations and synchronization
- Module detection and management
- Assembly/Image metadata access
- Runtime API initialization

**Category 6: Advanced Feature Tests** (~135 tests)

- Find tools (methods, classes, fields)
- Trace tools (hooking and monitoring)
- GC tools (memory management)
- Custom attribute reflection

**Category 7: Unity Integration Tests** (~58 tests)

- Unity GameObject operations
- Unity Component system
- Unity Engine modules (Vector3, Quaternion, etc.)

## Test Categories (Detailed Breakdown)

### CATEGORY 1: Core Infrastructure Tests (~200 tests)

#### `test-core-infrastructure.ts` - 22 tests

- Mono module detection
- Version detection and feature flags
- Basic API availability checks

#### `test-mono-types.ts` - 106 tests

- Domain operations and caching (10 tests)
- Assembly operations (8 tests)
- Class discovery and operations (14 tests)
- MonoType kind identification (15 tests)
  - Primitive types, String, Object, ValueType, Enum, Class
  - Array types (single/multi-dimensional, jagged)
  - Generic types, Pointer/IntPtr, Void
- MonoType methods (10 tests)
  - getSummary(), size/alignment, isByRef()
  - getElementType(), getClass(), getUnderlyingType()
  - Name formats, toString(), rank operations

#### `test-data-operations.ts` - 69 tests

- Object operations
- String operations and encoding
- Array creation and manipulation

#### `test-integration.ts` - 75 tests

- Fluent API usage
- Consolidated utilities
- End-to-end workflows

#### `test-supporting.ts` - 69 tests

- MonoEnums (type enums, exception enums, etc.)
- MonoDefines (numeric constants)
- Metadata collection and namespace grouping
- Logger functionality (12 tests)
  - Log methods, levels, formatting
  - Multi-line messages, special characters
  - Multiple logger instances

---

### CATEGORY 2: Utility Tests - STANDALONE (~94 tests)

#### `test-mono-utils.ts` - 45 tests

- Utility function validation
- Input validation and sanitization
- Helper function reliability
- Performance optimization utilities
- Memory management helpers

#### `test-mono-error-handling.ts` - 49 tests

- Comprehensive error scenario coverage
- Exception handling and recovery
- Error propagation and reporting
- Graceful failure modes
- Error message validation

---

### CATEGORY 3: Type System Tests - MONO_DEPENDENT (~245 tests)

#### `test-mono-class.ts` - 35 tests

- Class discovery and enumeration
- Inheritance relationships
- Interface implementation
- Class metadata and attributes

#### `test-mono-method.ts` - 49 tests

- Method resolution and overloading
- Parameter validation and conversion
- Return value handling
- Static vs instance methods
- Method signature analysis

#### `test-mono-field.ts` - 74 tests

- Field discovery and enumeration
- Static vs instance field operations
- Value getting/setting with type safety
- Field metadata and attributes
- Accessibility testing

#### `test-mono-property.ts` - 58 tests

- Property discovery
- Getter/setter resolution
- Indexed property handling
- Read-only/write-only properties
- Property metadata

#### `test-generic-types.ts` - 29 tests

- Generic type instantiation
- Type parameter handling
- Generic method operations

---

### CATEGORY 4: Runtime Object Tests - MONO_DEPENDENT (~272 tests)

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

#### `test-mono-object.ts` - 11 tests

- Object boxing/unboxing
- Object lifecycle management
- Type conversions

#### `test-mono-data.ts` - 73 tests

- Data type operations
- Type conversions
- Value marshalling

---

### CATEGORY 5: Domain & Assembly Tests - MONO_DEPENDENT (~291 tests)

#### `test-mono-api.ts` - 32 tests

- Core Mono API functions
- API export validation
- Version compatibility

#### `test-mono-domain.ts` - 45 tests

- Domain creation and management
- Domain hierarchy
- Assembly loading within domains
- Domain caching

#### `test-mono-threading.ts` - 50 tests

- Thread attachment/detachment
- Thread synchronization
- Thread-safe operations
- Concurrent operation handling

#### `test-mono-module.ts` - 39 tests

- Module loading and validation
- Metadata table access
- Module enumeration

#### `test-mono-assembly.ts` - 39 tests

- Assembly loading and enumeration
- Dependency analysis
- Assembly metadata
- Version compatibility

#### `test-mono-image.ts` - 47 tests

- Image metadata access
- Class enumeration from images
- Image validation
- Cross-image operations

#### `test-runtime-api.ts` - 39 tests

- Runtime API initialization
- Runtime state management

---

### CATEGORY 6: Advanced Feature Tests - MONO_DEPENDENT (~135 tests)

#### `test-find-tools.ts` - 56 tests

- Find methods, classes, fields
- Search patterns and filters
- Performance optimization

#### `test-trace-tools.ts` - 34 tests

- Method tracing and hooking
- Call monitoring
- Performance profiling

#### `test-gc-tools.ts` - 36 tests

- Garbage collection management
- Memory monitoring
- GC handle operations

#### `test-custom-attributes.ts` - 9 tests

- Custom attribute reflection
- Attribute metadata access

---

### CATEGORY 7: Unity Integration Tests - MONO_DEPENDENT (~58 tests)

#### `test-unity-gameobject.ts` - 14 tests

- GameObject operations
- Lifecycle management
- Component attachment

#### `test-unity-components.ts` - 19 tests

- Component system integration
- Component operations
- Component communication

#### `test-unity-engine-modules.ts` - 25 tests

- Vector3, Quaternion operations
- Engine module access
- Unity-specific types

## Test Framework

The test framework provides:

### Utilities

- `createTest(name, testFn)` - Create and run a test
- `createSkippedTest(name, reason)` - Skip a test with reason
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

- Thread attachment and management (50 tests)
- Domain access and caching (45 tests)
- Exception handling (MonoManagedExceptionError) (49 tests)
- Utility functions (45 tests)
- Type system (MonoType, MonoClass) (141 tests)
- Runtime objects (MonoString, MonoArray, MonoDelegate) (188 tests)
- Find/Trace/GC tools (126 tests)
- Unity integration (58 tests)
- Logger functionality (12 tests)
- Version detection and feature flags (22 tests)

### Integration & Real-World Usage

- End-to-end workflows (75 tests)
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

- **1,400+ individual test cases** across 31 test files
- **7 major categories** covering all library functionality
- **Phased execution model** separating standalone and Mono-dependent tests
- **Manual invocation** for stability and control
- **Selective execution** via individual test runners or configuration
- **100% coverage** of core APIs, type system, runtime objects, and advanced features

The suite is designed for both development validation and CI/CD integration, with flexible configuration options and detailed output for debugging.

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

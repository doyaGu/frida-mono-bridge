# Test Suite

Comprehensive test suite for the Frida Mono Bridge with **187 tests** organized into 6 major categories.

## Overview

The test suite validates all aspects of the Frida Mono Bridge library:
- Core infrastructure and API availability
- Runtime management (threads, domains, GC)
- Model operations (assemblies, classes, methods, etc.)
- Feature-specific functionality (delegates, internal calls)
- Real-world integration scenarios
- Utility functions and caching

**Test Statistics:**
- **Total Tests**: 187
- **Test Files**: 23
- **Pass Rate**: 100%
- **Duration**: ~500ms

## Structure

```
tests/
├── index.ts                    # Main test orchestrator
├── test-framework.ts           # Test framework and utilities
│
├── Core Infrastructure Tests (69 tests)
│   ├── test-module.ts          # Module detection (1 test)
│   ├── test-version.ts         # Version detection (3 tests)
│   ├── test-api.ts             # API availability + disposal (60 tests)
│   └── test-logger.ts          # Logger functionality (12 tests)
│
├── Runtime Management Tests (26 tests)
│   ├── test-thread.ts          # Thread management + ThreadManager (13 tests)
│   ├── test-thread-model.ts    # MonoThread class (12 tests)
│   ├── test-domain.ts          # Domain access (6 tests)
│   └── test-gchandle.ts        # GC handles (5 tests)
│
├── Model Operations Tests (40 tests)
│   ├── test-assembly.ts        # Assembly operations (3 tests)
│   ├── test-class.ts           # Class operations (3 tests)
│   ├── test-method.ts          # Method operations (18 tests)
│   ├── test-string.ts          # String operations (8 tests)
│   ├── test-object.ts          # Object operations (3 tests)
│   ├── test-array.ts           # Array operations (3 tests)
│   ├── test-field.ts           # Field operations (4 tests)
│   ├── test-property.ts        # Property operations (3 tests)
│   ├── test-metadata.ts        # Metadata collections (3 tests)
│   └── test-definitions.ts     # Header definitions (3 tests)
│
├── Feature-Specific Tests (6 tests)
│   ├── test-delegate.ts        # Delegate operations (3 tests)
│   └── test-icall.ts           # Internal calls (3 tests)
│
├── Real Usage Integration Tests (14 tests)
│   └── test-real-usage.ts      # End-to-end workflows (14 tests)
│
└── Utility and Cache Tests (22 tests)
    ├── test-cache.ts           # LRU cache (9 tests)
    └── test-utils.ts           # Utilities (13 tests)
```

## Running Tests

### Quick Start

**Compile Tests:**
```powershell
npm test
```

**Run All Tests:**
```powershell
# Using the simple test runner (recommended)
npx frida-compile run-tests-simple.ts -o dist/run-tests-simple.js
frida -n "YourMonoApp.exe" -l dist/run-tests-simple.js

# Or using the main test bundle
frida -n "YourMonoApp.exe" -l dist/tests.js
```

**Example with Platformer.exe (Unity game):**
```powershell
npm test
frida -n "Platformer.exe" -l dist/run-tests-simple.js
```

### Expected Output

```
====================================================
 == Frida Mono Bridge - Comprehensive Test Suite ==
====================================================

------------------------------------
-- Core Infrastructure Tests --
------------------------------------
Module Detection:
  PASS Mono module should be detected (0ms)

Version Detection:
  PASS Version object should exist (0ms)
  PASS All feature flags should be defined (0ms)
  ...

======================================================================
FINAL TEST SUMMARY
======================================================================
Total Tests:    187
PASS:          187 (100.0%)
FAIL:           0 (0.0%)
SKIP:           0 (0.0%)
======================================================================

ALL TESTS PASSED!
```

## Test Categories

### 1. Core Infrastructure Tests (69 tests)

#### Module Detection (`test-module.ts`) - 1 test
- Verifies Mono module can be detected and loaded

#### Version Detection (`test-version.ts`) - 3 tests
- Version object existence
- Feature flags definition
- API availability reflection

#### API Availability (`test-api.ts`) - 60 tests
- Domain APIs (4 tests)
- Thread APIs (2 tests)
- Assembly APIs (5 tests)
- Class APIs (4 tests)
- Property APIs (3 tests)
- Method APIs (8 tests)
- Object APIs (6 tests)
- String APIs (3 tests)
- Array APIs (4 tests)
- Metadata Table APIs (3 tests)
- Field APIs (3 tests)
- Internal Call APIs (2 tests)
- GC Handle APIs (5 tests)
- Delegate APIs (2 tests)
- GC APIs (3 tests)
- **Disposal Pattern (2 tests)** ← NEW

#### Logger (`test-logger.ts`) - 12 tests
- Log methods, levels, formatting, special characters

---

### 2. Runtime Management Tests (26 tests)

#### Thread Management (`test-thread.ts`) - 13 tests
- Basic thread operations (8 tests)
  - Thread attachment/detachment
  - withThread helper
  - Nested calls
  - Multiple operations
- **ThreadManager direct tests (5 tests)** ← NEW
  - Thread handle caching
  - Callback execution
  - Result return
  - Nested withAttachedThread
  - detachAll safety

#### Thread Model (`test-thread-model.ts`) - 12 tests
- MonoThread class functionality
- Static methods (current, attach, withAttached)
- Instance methods (getCurrentId, ensureAttached, isValid)
- Integration with domain operations
- Nested calls and safety

#### Domain Access (`test-domain.ts`) - 6 tests
- Root domain access and caching
- Current domain retrieval (version-dependent)

#### GC Handles (`test-gchandle.ts`) - 5 tests
- GC handle APIs
- GCHandlePool operations
- Thread context integration

---

### 3. Model Operations Tests (40 tests)

#### Basic Operations (11 tests)
- **Assembly** (`test-assembly.ts`) - 3 tests
- **Class** (`test-class.ts`) - 3 tests
- **Method** (`test-method.ts`) - 18 tests (finding, invocation, signatures, exceptions)
- **String** (`test-string.ts`) - 8 tests (creation, Unicode, special characters)

#### Advanced Operations (19 tests)
- **Object** (`test-object.ts`) - 3 tests
- **Array** (`test-array.ts`) - 3 tests
- **Field** (`test-field.ts`) - 4 tests (APIs, operations, metadata extraction)
- **Property** (`test-property.ts`) - 3 tests
- **Metadata** (`test-metadata.ts`) - 3 tests (collections, namespace grouping)
- **Definitions** (`test-definitions.ts`) - 3 tests (enums, constants)

---

### 4. Feature-Specific Tests (6 tests)

#### Delegates (`test-delegate.ts`) - 3 tests
- Delegate APIs availability and functionality

#### Internal Calls (`test-icall.ts`) - 3 tests
- Internal call registration and operations

---

### 5. Real Usage Integration Tests (14 tests)

#### Real Usage (`test-real-usage.ts`) - 14 tests
- End-to-end workflow validation
- Image loading (mscorlib)
- Class finding (System.String, System.Object, System.Int32)
- MonoString creation and validation
- Method finding and operations
- UTF-8 string allocation
- Domain access
- Argument preparation

---

### 6. Utility and Cache Tests (22 tests) ← NEW SECTION

#### LRU Cache (`test-cache.ts`) - 9 tests
- Capacity validation (2 tests)
- Store/retrieve operations (1 test)
- Eviction policies (2 tests)
- Access order tracking (1 test)
- Key management (2 tests)
- NativeFunction caching (1 test)

#### Utility Functions (`test-utils.ts`) - 13 tests
- **Pointer null checking** (4 tests)
  - null, zero, non-zero, NULL pointer
- **MonoManagedExceptionError** (4 tests)
  - Exception pointer storage
  - Type and message inclusion
  - Pointer-only construction
- **Input validation** (2 tests)
  - Empty name rejection
  - NULL callback rejection
- **64-bit type boxing** (3 tests)
  - Number type acceptance
  - Bigint type acceptance
  - Type union validation

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

The test suite supports configuration options:

```typescript
runAllTests({
  skipSlowTests: false,      // Skip tests that take a long time
  skipAdvancedTests: false,  // Skip advanced feature tests
  verbose: true,             // Show detailed output
  stopOnFirstFailure: false, // Stop on first failing test
});
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

## Coverage

The test suite comprehensively validates:

### Mono APIs Tested
- [TESTED] Domain management (mono_get_root_domain, mono_domain_set)
- [TESTED] Thread management (mono_thread_attach, mono_thread_detach)
- [TESTED] Assembly operations (mono_assembly_open, mono_assembly_get_image)
- [TESTED] Class operations (mono_class_from_name, mono_class_get_method_from_name)
- [TESTED] Method operations (mono_runtime_invoke, mono_method_signature)
- [TESTED] Object operations (mono_object_new, mono_value_box, mono_object_unbox)
- [TESTED] String operations (mono_string_new, mono_string_chars)
- [TESTED] Array operations (mono_array_new, mono_array_length)
- [TESTED] Field operations (mono_field_get_value, mono_field_set_value)
- [TESTED] Property operations (mono_property_get_get_method, mono_property_get_set_method)
- [TESTED] GC operations (mono_gc_collect, mono_gchandle_new, mono_gchandle_free)
- [TESTED] Delegate operations (mono_get_delegate_invoke, mono_method_get_unmanaged_thunk)
- [TESTED] Internal calls (mono_add_internal_call)

### Library Features Tested
- [TESTED] Thread attachment and management
- [TESTED] ThreadManager caching and performance
- [TESTED] Domain access and caching
- [TESTED] Exception handling (MonoManagedExceptionError)
- [TESTED] Input validation
- [TESTED] **LRU cache functionality** ← NEW
- [TESTED] **Pointer null checking** ← NEW
- [TESTED] **64-bit integer boxing** ← NEW
- [TESTED] Disposal pattern
- [TESTED] Logger functionality
- [TESTED] Version detection and feature flags

### Integration Scenarios
- [TESTED] Real Mono runtime interaction (validated with Platformer.exe Unity game)
- [TESTED] End-to-end workflows
- [TESTED] Multiple API call sequences
- [TESTED] Error handling and recovery
- [TESTED] Performance optimization (caching, repeated operations)

## Adding New Tests

### 1. Choose the Appropriate Category

Place your test in the correct file based on what it tests:
- **Core infrastructure** → `test-api.ts`, `test-logger.ts`, etc.
- **Runtime management** → `test-thread.ts`, `test-domain.ts`, `test-gchandle.ts`
- **Model operations** → `test-assembly.ts`, `test-class.ts`, `test-method.ts`, etc.
- **Features** → `test-delegate.ts`, `test-icall.ts`
- **Integration** → `test-real-usage.ts`
- **Utilities** → `test-cache.ts`, `test-utils.ts`

### 2. Add Your Test

```typescript
// Example: Adding to test-cache.ts
suite.addResult(createTest("New cache feature works", () => {
  const cache = new LruCache<string, number>(10);
  cache.set("key", 42);
  
  const value = cache.get("key");
  assert(value === 42, "Should retrieve stored value");
}));
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
  
  suite.addResult(createTest("Should do something", () => {
    Mono.attachThread();
    const result = Mono.api.someFunction();
    assert(!result.isNull(), "Result should not be NULL");
  }));

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

// In runAllTests():
logSection("My Feature Tests");
suite.addResult(testMyFeature());
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

## Best Practices

1. **Always attach thread** - Call `Mono.attachThread()` before API calls
2. **Check feature flags** - Skip tests for unsupported features
3. **Use assertions** - Validate assumptions explicitly
4. **Handle errors** - Wrap risky operations in try-catch
5. **Keep tests focused** - Each test should validate one thing
6. **Add descriptive messages** - Make assertion failures clear

## Continuous Integration

To integrate with CI systems:

```powershell
# Build tests
npx frida-compile run-tests.ts -o dist/run-tests.js

# Run against a test app
frida -n "TestApp.exe" -l dist/run-tests.js --no-pause

# Check exit code
if ($LASTEXITCODE -ne 0) { exit 1 }
```

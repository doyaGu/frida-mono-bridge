# Test Suite

Comprehensive test suite for frida-mono-bridge with **1,089 tests** across **36 test files**.

## Quick Start

```powershell
# Compile all tests
npm test

# Compile a specific test suite
npm run test:mono-class
npm run test:internal-call
npm run test:find-tools

# Run against a target process
frida -n "YourGame.exe" -l dist/test-mono-class.js
frida -p <PID> -l dist/test-internal-call.js --timeout 60
```

## Test Statistics

| Metric                   | Value                  |
| ------------------------ | ---------------------- |
| **Total Tests**          | 1,089                  |
| **Test Files**           | 36                     |
| **Test Categories**      | 7                      |
| **Standalone Tests**     | ~80 (no Mono required) |
| **Mono-dependent Tests** | ~1,013                 |

## Test Categories

| Category                 | Test Files | Tests | Description                                         |
| ------------------------ | ---------- | ----- | --------------------------------------------------- |
| **Core Infrastructure**  | 5          | ~115  | Module detection, API availability, data operations |
| **Utility (Standalone)** | 3          | ~80   | Error handling, utilities (no Mono dependency)      |
| **Type System**          | 6          | ~260  | Classes, methods, fields, properties, generics      |
| **Runtime Objects**      | 6          | ~275  | Strings, arrays, delegates, objects, data           |
| **Domain & Assembly**    | 5          | ~125  | Domain, image, assembly, threading, module          |
| **Advanced Features**    | 4          | ~160  | Find tools, trace tools, GC tools, internal calls   |
| **Unity Integration**    | 3          | ~30   | GameObject, components, engine modules              |

## Test Files by Count

| File                                                         | Tests | Category            |
| ------------------------------------------------------------ | ----- | ------------------- |
| [test-mono-field.ts](test-mono-field.ts)                     | 75    | Type System         |
| [test-mono-string.ts](test-mono-string.ts)                   | 71    | Runtime Objects     |
| [test-mono-array.ts](test-mono-array.ts)                     | 67    | Runtime Objects     |
| [test-mono-property.ts](test-mono-property.ts)               | 59    | Type System         |
| [test-mono-delegate.ts](test-mono-delegate.ts)               | 53    | Runtime Objects     |
| [test-internal-call.ts](test-internal-call.ts)               | 63    | Advanced Features   |
| [test-mono-method.ts](test-mono-method.ts)                   | 50    | Type System         |
| [test-mono-image.ts](test-mono-image.ts)                     | 47    | Domain & Assembly   |
| [test-trace-tools.ts](test-trace-tools.ts)                   | 46    | Advanced Features   |
| [test-mono-types.ts](test-mono-types.ts)                     | 46    | Type System         |
| [test-gc-tools.ts](test-gc-tools.ts)                         | 42    | Advanced Features   |
| [test-runtime-api.ts](test-runtime-api.ts)                   | 42    | Runtime Objects     |
| [test-mono-assembly.ts](test-mono-assembly.ts)               | 39    | Domain & Assembly   |
| [test-mono-utils.ts](test-mono-utils.ts)                     | 38    | Utility             |
| [test-mono-class.ts](test-mono-class.ts)                     | 36    | Type System         |
| [test-integration.ts](test-integration.ts)                   | 35    | Core Infrastructure |
| [test-supporting.ts](test-supporting.ts)                     | 31    | Core Infrastructure |
| [test-mono-data.ts](test-mono-data.ts)                       | 31    | Runtime Objects     |
| [test-generic-types.ts](test-generic-types.ts)               | 30    | Type System         |
| [test-data-operations.ts](test-data-operations.ts)           | 29    | Core Infrastructure |
| [test-mono-error-handling.ts](test-mono-error-handling.ts)   | 24    | Utility             |
| [test-mono-threading.ts](test-mono-threading.ts)             | 21    | Domain & Assembly   |
| [test-utilities.ts](test-utilities.ts)                       | 17    | Utility             |
| [test-mono-module.ts](test-mono-module.ts)                   | 16    | Domain & Assembly   |
| [test-mono-api.ts](test-mono-api.ts)                         | 13    | Core Infrastructure |
| [test-mono-object.ts](test-mono-object.ts)                   | 12    | Runtime Objects     |
| [test-unity-engine-modules.ts](test-unity-engine-modules.ts) | 11    | Unity               |
| [test-custom-attributes.ts](test-custom-attributes.ts)       | 10    | Type System         |
| [test-unity-gameobject.ts](test-unity-gameobject.ts)         | 8     | Unity               |
| [test-unity-components.ts](test-unity-components.ts)         | 8     | Unity               |
| [test-framework.ts](test-framework.ts)                       | 7     | Core Infrastructure |
| [test-core-infrastructure.ts](test-core-infrastructure.ts)   | 6     | Core Infrastructure |
| [test-common.ts](test-common.ts)                             | 3     | Core Infrastructure |
| [test-mono-domain.ts](test-mono-domain.ts)                   | 3     | Domain & Assembly   |

---

## Category 1: Core Infrastructure (115 tests)

Tests that verify basic functionality and API availability.

| File                                                       | Tests | Description                         |
| ---------------------------------------------------------- | ----- | ----------------------------------- |
| [test-core-infrastructure.ts](test-core-infrastructure.ts) | 6     | Mono module detection, version info |
| [test-mono-api.ts](test-mono-api.ts)                       | 13    | MonoApi native export functions     |
| [test-data-operations.ts](test-data-operations.ts)         | 29    | Object/string/array data operations |
| [test-integration.ts](test-integration.ts)                 | 35    | Fluent API, end-to-end workflows    |
| [test-supporting.ts](test-supporting.ts)                   | 31    | MonoEnums, metadata, logger         |
| [test-framework.ts](test-framework.ts)                     | 7     | Test framework validation           |
| [test-common.ts](test-common.ts)                           | 3     | Common test utilities               |

---

## Category 2: Utility Tests - Standalone (80 tests)

Tests that run **without Mono runtime**. Good for quick validation.

| File                                                       | Tests | Description                                |
| ---------------------------------------------------------- | ----- | ------------------------------------------ |
| [test-mono-utils.ts](test-mono-utils.ts)                   | 38    | Utility functions, input validation        |
| [test-mono-error-handling.ts](test-mono-error-handling.ts) | 24    | MonoError, error codes, exception handling |
| [test-utilities.ts](test-utilities.ts)                     | 17    | Test helper utilities                      |

---

## Category 3: Type System Tests (260 tests)

Tests for Mono type system components.

| File                                                   | Tests | Description                                    |
| ------------------------------------------------------ | ----- | ---------------------------------------------- |
| [test-mono-class.ts](test-mono-class.ts)               | 36    | MonoClass discovery, inheritance, interfaces   |
| [test-mono-method.ts](test-mono-method.ts)             | 50    | MonoMethod resolution, invocation, overloading |
| [test-mono-field.ts](test-mono-field.ts)               | 75    | MonoField access, static/instance, value types |
| [test-mono-property.ts](test-mono-property.ts)         | 59    | MonoProperty getter/setter, indexed properties |
| [test-mono-types.ts](test-mono-types.ts)               | 46    | MonoType kinds, primitives, arrays, generics   |
| [test-generic-types.ts](test-generic-types.ts)         | 30    | Generic type instantiation, type parameters    |
| [test-custom-attributes.ts](test-custom-attributes.ts) | 10    | Custom attribute reflection                    |

---

## Category 4: Runtime Object Tests (275 tests)

Tests for Mono runtime object manipulation.

| File                                           | Tests | Description                                     |
| ---------------------------------------------- | ----- | ----------------------------------------------- |
| [test-mono-string.ts](test-mono-string.ts)     | 71    | MonoString creation, encoding (UTF-8, UTF-16)   |
| [test-mono-array.ts](test-mono-array.ts)       | 67    | MonoArray operations, multi-dimensional, jagged |
| [test-mono-delegate.ts](test-mono-delegate.ts) | 53    | MonoDelegate creation, invocation, callbacks    |
| [test-mono-object.ts](test-mono-object.ts)     | 12    | MonoObject boxing/unboxing, lifecycle           |
| [test-mono-data.ts](test-mono-data.ts)         | 31    | Data type conversions, value marshalling        |
| [test-runtime-api.ts](test-runtime-api.ts)     | 42    | Runtime API initialization, state management    |

---

## Category 5: Domain & Assembly Tests (125 tests)

Tests for domain, assembly, and image management.

| File                                             | Tests | Description                                                         |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------- |
| [test-mono-domain.ts](test-mono-domain.ts)       | 3     | MonoDomain operations, assembly loading (includes Find Tools tests) |
| [test-mono-image.ts](test-mono-image.ts)         | 47    | MonoImage metadata, class enumeration                               |
| [test-mono-assembly.ts](test-mono-assembly.ts)   | 39    | MonoAssembly loading, dependencies                                  |
| [test-mono-threading.ts](test-mono-threading.ts) | 21    | Thread attachment, synchronization                                  |
| [test-mono-module.ts](test-mono-module.ts)       | 16    | Module detection, metadata tables                                   |

---

## Category 6: Advanced Features (160 tests)

Tests for advanced search, trace, GC, and internal call features.

| File                                           | Tests | Description                                |
| ---------------------------------------------- | ----- | ------------------------------------------ |
| [test-trace-tools.ts](test-trace-tools.ts)     | 46    | Method hooking, tracing, call monitoring   |
| [test-gc-tools.ts](test-gc-tools.ts)           | 42    | GC handles, memory stats, heap info        |
| [test-internal-call.ts](test-internal-call.ts) | 63    | Internal call registration, Mono.icall API |

---

## Category 7: Unity Integration (30 tests)

Tests for Unity-specific functionality.

| File                                                         | Tests | Description                       |
| ------------------------------------------------------------ | ----- | --------------------------------- |
| [test-unity-gameobject.ts](test-unity-gameobject.ts)         | 8     | GameObject operations, lifecycle  |
| [test-unity-components.ts](test-unity-components.ts)         | 8     | Component system                  |
| [test-unity-engine-modules.ts](test-unity-engine-modules.ts) | 11    | Vector3, Quaternion, engine types |

---

## Test Architecture

### Test Creation Patterns

```typescript
// Mono-dependent test (runs inside Mono.perform())
await createMonoDependentTest("test name", () => {
  const klass = Mono.domain.tryClass("System.String");
  assert(klass !== null, "Should find class");
});

// Standalone test (no Mono dependency)
createStandaloneTest("test name", () => {
  const result = someUtilityFunction();
  assert(result === expected, "Should match");
});
```

### Export Naming Convention

```typescript
// Returns Promise<TestResult[]> - standard pattern
export async function createXxxTests(): Promise<TestResult[]>;

// Alternative: Returns single TestResult wrapper
export async function testXxx(): Promise<TestResult>;

// Default export for runners
export default createXxxTests;
```

### Test Runners

Each test suite has a runner in `tests/runners/`:

```typescript
// tests/runners/test-xxx.ts
import { createXxxTests } from "../test-xxx";
import { runTestCategory } from "../test-runner-base";

runTestCategory(
  "Xxx Tests",
  async () => {
    const results = await createXxxTests();
    // ... summarize and return
  },
  { verbose: true },
);
```

---

## npm Scripts

| Script                              | Description             |
| ----------------------------------- | ----------------------- |
| `npm test`                          | Compile all tests       |
| `npm run test:mono-class`           | MonoClass tests         |
| `npm run test:mono-method`          | MonoMethod tests        |
| `npm run test:mono-field`           | MonoField tests         |
| `npm run test:mono-property`        | MonoProperty tests      |
| `npm run test:mono-string`          | MonoString tests        |
| `npm run test:mono-array`           | MonoArray tests         |
| `npm run test:mono-delegate`        | MonoDelegate tests      |
| `npm run test:mono-object`          | MonoObject tests        |
| `npm run test:mono-assembly`        | MonoAssembly tests      |
| `npm run test:mono-image`           | MonoImage tests         |
| `npm run test:mono-domain`          | MonoDomain tests        |
| `npm run test:mono-threading`       | Threading tests         |
| `npm run test:mono-module`          | Module tests            |
| `npm run test:mono-data`            | Data operations tests   |
| `npm run test:mono-types`           | MonoType tests          |
| `npm run test:mono-utils`           | Utility tests           |
| `npm run test:mono-error-handling`  | Error handling tests    |
| `npm run test:runtime-api`          | Runtime API tests       |
| `npm run test:generic-types`        | Generic types tests     |
| `npm run test:custom-attributes`    | Custom attributes tests |
| `npm run test:internal-call`        | Internal call tests     |
| `npm run test:trace-tools`          | Trace utilities tests   |
| `npm run test:gc-tools`             | GC utilities tests      |
| `npm run test:data-operations`      | Data operations tests   |
| `npm run test:integration`          | Integration tests       |
| `npm run test:unity-gameobject`     | Unity GameObject tests  |
| `npm run test:unity-components`     | Unity Components tests  |
| `npm run test:unity-engine-modules` | Unity Engine tests      |

---

## Expected Output

```
================================================
== Mono Class Tests ==
================================================
  PASS MonoClass - find System.String class (1ms)
  PASS MonoClass - get class name (0ms)
  PASS MonoClass - get class namespace (0ms)
  ...

Result: 36/36 Mono Class tests passed

------------------------------------------------
TEST SUMMARY
------------------------------------------------
Category: Mono Class Tests
Status: PASSED
Duration: 125ms
------------------------------------------------
ALL TESTS PASSED!
```

---

## Performance Notes

### Fast Tests (< 5 seconds)

- All `tryClass()` tests with System._ or UnityEngine._ namespaces
- API availability tests
- Most type system tests
- GC tools tests
- Standalone utility tests

### Potentially Slow Tests

| Test                           | Reason                     | Mitigation               |
| ------------------------------ | -------------------------- | ------------------------ |
| `Mono.domain.findClasses("*")` | Enumerates all assemblies  | Use `tryClass()`         |
| `Mono.domain.findMethods("*")` | Enumerates all classes     | Use specific class       |
| Full assembly tests            | Many assemblies to iterate | Run with `--timeout 120` |

### Known Issues

1. **test-mono-assembly**: May hang after completion due to assembly lifecycle. Run separately or last.

2. **Find wildcard searches**: Slow in Unity projects. Use `tryClass()` or `limit` option.

---

## Troubleshooting

### Script Timeout

```powershell
# Increase timeout for slow tests
frida -p 1234 -l dist/test-xxx.js --timeout 120
```

### Module Not Found

Ensure target process has loaded Mono before attaching:

```powershell
# Spawn and wait
frida -f "Game.exe" -l dist/test-xxx.js --no-pause
```

### Test Hangs

Use Ctrl+C to interrupt or run with timeout:

```powershell
frida -p 1234 -l dist/test-mono-assembly.js --timeout 60
```

---

## Writing New Tests

### 1. Create Test File

```typescript
// tests/test-my-feature.ts
import Mono from "../src";
import { TestResult, assert, createMonoDependentTest } from "./test-framework";

export async function createMyFeatureTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await createMonoDependentTest("MyFeature - basic test", () => {
      assert(true, "Should pass");
    }),
  );

  return results;
}

export default createMyFeatureTests;
```

### 2. Create Runner

```typescript
// tests/runners/test-my-feature.ts
import { createMyFeatureTests } from "../test-my-feature";
import { runTestCategory } from "../test-runner-base";

runTestCategory(
  "My Feature Tests",
  async () => {
    const results = await createMyFeatureTests();
    const passed = results.filter(r => r.passed).length;
    return {
      name: "My Feature Tests",
      passed: results.length === passed,
      message: `${passed}/${results.length} passed`,
    };
  },
  { verbose: true },
);
```

### 3. Add npm Script

```json
{
  "scripts": {
    "test:my-feature": "frida-compile tests/runners/test-my-feature.ts -o dist/test-my-feature.js"
  }
}
```

---

## Assertions

```typescript
import { assert, assertNotNull, assertThrows, fail } from "./test-framework";

// Basic assertion
assert(condition, "Error message");

// Null check
assertNotNull(value, "Value should not be null");

// Exception testing
assertThrows(() => {
  throw new Error("Expected");
}, "Should throw");

// Explicit failure
fail("This should not be reached");
```

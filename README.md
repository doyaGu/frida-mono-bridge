# frida-mono-bridge

A TypeScript bridge that exposes the Mono runtime (Unity/Xamarin/embedded Mono) to Frida scripts with a clean, high-level API.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)
[![Status](https://img.shields.io/badge/status-production%20ready-brightgreen.svg)]()

## Features

- **Clean API**: High-level object model (Domain, Image, Class, Method, Object, etc.)
- **Auto-Discovery**: Automatically finds and loads Mono runtime with fallback strategies
- **Type-Safe**: Full TypeScript strict mode with comprehensive type definitions
- **Performance**: LRU caching, native delegate thunks, optimized invocation paths
- **Thread-Safe**: Automatic thread attachment with proper lifecycle management
- **Well-Tested**: 600+ tests across 34 modules with 100% pass rate
- **Well-Documented**: Comprehensive JSDoc and guides

## Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```typescript
import Mono from "./src";

// Modern fluent API (recommended)
Mono.perform(() => {
  // Get root domain
  const domain = Mono.domain;

  // Load assembly and find class
  const assembly = domain.assembly("Assembly-CSharp");
  const playerClass = assembly.image.class("Game", "Player");

  // Find and invoke method
  const method = playerClass.method("Say", 1);
  const result = method.invoke(null, ["Hello"]);
});

// Legacy API (still supported)
Mono.attachThread();
const image = Mono.model.Image.fromAssemblyPath(Mono.api, "/path/to/Assembly-CSharp.dll");
const klass = image.classFromName("MyNamespace", "MyClass");
const method = klass.getMethod("MyMethod", 0);
const result = method.invoke(NULL, []);
```

### Build & Run

```powershell
# Build the bridge
npm run build

# Run on a Unity/Mono process
frida -n "UnityGame.exe" -l dist/agent.js
```


## Documentation

- **[Quick Reference](QUICK-REFERENCE.md)**: Fast API lookup and common patterns
- **[Developer Guide](DEVELOPER_GUIDE.md)**: Complete development guide

For detailed technical documentation, see the [docs](docs/) directory.

## Architecture

```
frida-mono-bridge/
├── src/                    # Source code
│   ├── runtime/            # Mono runtime: discovery, signatures, threading
│   ├── model/              # High-level objects: Domain, Assembly, Class, Method, etc.
│   ├── utils/              # Utilities: find, trace, gc, cache, logging
│   ├── mono.ts             # MonoNamespace - Main fluent API entry point
│   └── index.ts            # Global entry point and exports
├── tests/                  # Test suite (34 files, 600+ tests)
│   ├── runners/            # Individual test runners (29 files)
│   ├── test-framework.ts   # Test framework
│   └── index.ts            # Test suite orchestrator
├── docs/                   # Documentation (10 files)
├── unity-explorer/         # Unity scene exploration tool
└── dist/                   # Compiled output
```

## API Overview

### Core APIs

```typescript
// Modern Fluent API (recommended)
Mono.perform(() => {
  // Module & Version
  console.log(Mono.module.name, Mono.version.features.delegateThunk);

  // Domain & Assembly
  const domain = Mono.domain;
  const assembly = domain.assembly("Assembly-CSharp");

  // Class & Method
  const playerClass = assembly.image.class("Game", "Player");
  const method = playerClass.method("Say", 1);
  const result = method.invoke(null, ["Hello"]);
});

// Legacy API (still supported)
Mono.attachThread();
Mono.api.getRootDomain();
Mono.model.Image.fromAssemblyPath(Mono.api, path);
image.classFromName(namespace, name);
klass.getMethod(name, paramCount);
method.invoke(instance, args);
Mono.dispose();
```

## Testing

The Frida Mono Bridge includes a comprehensive test suite with **600+ tests** organized across **34 test files** in 7 categories. The test suite validates all aspects of the bridge from core infrastructure to advanced Unity integration.

### Test Architecture

The test suite is organized into **7 logical categories**:

| Category | Description | Test Files |
|----------|-------------|------------|
| **Core Infrastructure** | Basic module setup, Mono detection | `test-core-infrastructure`, `test-runtime-api`, `test-data-operations`, `test-integration`, `test-supporting` |
| **Utility Tests** | Standalone tests without Mono dependency | `test-mono-utils`, `test-mono-error-handling` |
| **Type System** | Class, method, field, property operations | `test-mono-class`, `test-mono-method`, `test-mono-field`, `test-mono-property`, `test-mono-types`, `test-generic-types` |
| **Runtime Objects** | String, array, delegate, object handling | `test-mono-string`, `test-mono-array`, `test-mono-delegate`, `test-mono-data` |
| **Domain & Assembly** | Domain, assembly, image, threading | `test-mono-api`, `test-mono-domain`, `test-mono-threading`, `test-mono-module`, `test-mono-assembly`, `test-mono-image` |
| **Advanced Features** | GC tools, tracing, search utilities | `test-find-tools`, `test-trace-tools`, `test-gc-tools` |
| **Unity Integration** | GameObject, components, engine modules | `test-unity-gameobject`, `test-unity-components`, `test-unity-engine-modules` |

### Running Tests

#### Complete Test Suite

Run all tests together with comprehensive reporting:
```bash
# Build the complete test suite
npm run test

# Run against a Mono application
frida -n "YourApp.exe" -l dist/tests.js

# Example with Unity game
frida -n "Platformer.exe" -l dist/tests.js
```

#### Individual Test Categories

Run specific test categories independently for faster feedback and targeted testing:

```bash
# Core Infrastructure Tests
npm run test:core-infrastructure
frida -n "YourApp.exe" -l dist/test-core-infrastructure.js

# Type System Tests
npm run test:mono-class
frida -n "YourApp.exe" -l dist/test-mono-class.js

# Runtime Object Tests
npm run test:mono-string
frida -n "YourApp.exe" -l dist/test-mono-string.js

# Advanced Feature Tests
npm run test:gc-tools
frida -n "YourApp.exe" -l dist/test-gc-tools.js

# Unity Tests
npm run test:unity-gameobject
frida -n "YourUnityApp.exe" -l dist/test-unity-gameobject.js
```

#### Run All Tests with PowerShell Script

```powershell
# Run all test categories against a process
.\run-all-tests.ps1 -ProcessId <PID>
```

#### Available Test Categories

**Core & Utility Tests:**
- `test:core-infrastructure` - Core Mono runtime detection and API availability
- `test:runtime-api` - Runtime API functionality
- `test:mono-utils` - Utility functions and validation
- `test:mono-error-handling` - Error scenarios and exception handling

**Type System Tests:**
- `test:mono-class` - Class discovery and metadata operations
- `test:mono-method` - Method resolution and invocation
- `test:mono-field` - Field access and operations
- `test:mono-property` - Property discovery and operations
- `test:mono-types` - Type system operations
- `test:generic-types` - Generic type handling

**Runtime Object Tests:**
- `test:mono-string` - String operations
- `test:mono-array` - Array operations
- `test:mono-delegate` - Delegate operations
- `test:mono-data` - Data manipulation operations

**Domain & Assembly Tests:**
- `test:mono-api` - Low-level Mono API functionality
- `test:mono-domain` - Domain management and operations
- `test:mono-threading` - Thread management and synchronization
- `test:mono-module` - Module loading and operations
- `test:mono-assembly` - Assembly loading and enumeration
- `test:mono-image` - Image metadata access

**Advanced Feature Tests:**
- `test:find-tools` - Search and discovery utilities
- `test:trace-tools` - Method tracing and hooking
- `test:gc-tools` - GC handle and memory management

**Unity Tests:**
- `test:unity-gameobject` - Unity GameObject operations
- `test:unity-components` - Unity Component operations  
- `test:unity-engine-modules` - Unity Engine module access

### Test Configuration

The test suite supports various configuration options:

```typescript
// Configure test execution
runAllTests({
  skipSlowTests: false,        // Skip tests that take a long time
  skipAdvancedTests: false,    // Skip advanced feature tests
  skipUnityTests: false,       // Skip Unity-specific tests
  skipPerformanceTests: false, // Skip performance-intensive tests
  verbose: true,              // Show detailed output
  stopOnFirstFailure: false,   // Stop on first failing test
  categories: ["core"]         // Run specific categories only
});
```

### Expected Test Output

```
===============================================================
== Frida Mono Bridge - Comprehensive Test Suite ==
===============================================================

-- Phase 1: Standalone Tests --
  Core Infrastructure Tests: PASS
  Mono Utils Tests: PASS
  Error Handling Tests: PASS

-- Phase 2: Mono-Dependent Tests --
  Type System Tests: PASS (MonoClass, MonoMethod, MonoField, MonoProperty)
  Runtime Object Tests: PASS (MonoString, MonoArray, MonoDelegate)
  Domain & Assembly Tests: PASS
  
-- Phase 3: Advanced Feature Tests --
  Find Tools Tests: PASS
  Trace Tools Tests: PASS
  GC Tools Tests: PASS
  Generic Types Tests: PASS

===============================================================
TEST SUMMARY
===============================================================
Total Tests:    600+
PASS:          600+ (100.0%)
FAIL:           0 (0.0%)
SKIP:           0 (0.0%)

ALL TESTS PASSED!
```

### Performance Benchmarking

The test suite includes built-in performance benchmarking:

- **API Call Performance**: Measures speed of repeated API calls
- **Memory Allocation**: Tracks memory usage patterns
- **Cache Efficiency**: Validates caching strategies
- **Large Dataset Handling**: Tests performance with big data
- **Concurrent Operations**: Measures thread safety overhead

### Troubleshooting

#### Tests Fail to Compile
```bash
# Check for TypeScript errors
npm run lint

# Check specific file
npx tsc --noEmit tests/test-myfile.ts
```

#### Tests Fail at Runtime
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

#### Version-Specific Failures
Some Mono APIs may not be available in all versions:
- `mono_domain_get` - Optional in some builds
- `mono_domain_assembly_open` - Optional in some builds
- `mono_table_info_get` - Optional in some builds

Tests handle this gracefully by checking availability first.

### Best Practices

1. **Always attach thread** - Call `Mono.attachThread()` before API calls
2. **Check feature flags** - Skip tests for unsupported features
3. **Use assertions** - Validate assumptions explicitly
4. **Handle errors** - Wrap risky operations in try-catch
5. **Keep tests focused** - Each test should validate one thing
6. **Add descriptive messages** - Make assertion failures clear
7. **Follow dependency phases** - Run standalone tests before Mono-dependent tests
8. **Use selective testing** - Run specific categories when debugging
9. **Monitor performance** - Use built-in benchmarking to identify bottlenecks

**Test Coverage**: 600+ tests across 34 test files with 100% pass rate.

See **[tests/README.md](tests/README.md)** for detailed documentation.

## Advanced Features

### Pattern-Based Operations
```typescript
import { MonoOperation, BatchOperation, withErrorHandling } from "./src/patterns";

// Safe operations with built-in error handling
const operation = new MonoOperation(() => {
  const method = playerClass.method("TakeDamage", 1);
  return method.invoke(instance, [damage]);
});
const result = operation.safeExecute("player damage calculation");

// Batch operations for efficiency
const batch = new BatchOperation();
batch.add(() => player.method("Update").invoke(player, []));
batch.add(() => player.method("Render").invoke(player, []));
const results = batch.executeAll("player frame update");
```

### Search & Tracing
```typescript
// Wildcard search for methods
const attackMethods = Mono.find.methods("*Attack*");

// Trace method calls
Mono.trace.method(takeDamageMethod, {
  onEnter(args) { console.log("→ Taking damage:", args[0]); },
  onLeave(retval) { console.log("← Health:", retval); }
});
```

## Performance

- **LRU Caching**: Function cache (256), address cache (512), thunk cache (128)
- **Native Thunks**: High-performance delegate invocation via unmanaged thunks
- **Smart Resolution**: Export discovery with aliases and fallback strategies
- **Pattern System**: Optimized common operations and batch processing

## Contributing

Contributions are welcome! Please:

1. Maintain TypeScript strict mode compliance
2. Add JSDoc documentation for public APIs
3. Include tests for new features
4. Follow existing code patterns
5. Ensure backward compatibility

## License

See [LICENSE](LICENSE) file for details.

## Credits

Inspired by [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge).

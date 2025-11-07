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
- **Well-Tested**: 500+ tests across 37+ modules with 100% pass rate
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

- **[CLAUDE.md](CLAUDE.md)**: Development guidance and project instructions
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)**: Quick API reference
- **[COMPREHENSIVE-GUIDE.md](COMPREHENSIVE-GUIDE.md)**: Comprehensive usage guide
- **[MONO-API-DOCUMENTATION.md](MONO-API-DOCUMENTATION.md)**: Mono API documentation

## Architecture

```
src/
  runtime/     # Mono runtime access: discovery, signatures, threading, memory management
  model/       # High-level object model (Domain, Assembly, Class, Method, Field, etc.)
  patterns/    # Common operation patterns and error handling
  utils/       # Utilities: logging, caching, search, tracing, GC helpers
  mono.ts      # MonoNamespace - Main fluent API entry point
  index.ts     # Global entry point and exports
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

The Frida Mono Bridge includes a comprehensive test suite with **500+ tests** organized across **37+ test files** in a dependency-based execution model. The test suite validates all aspects of the bridge from core infrastructure to advanced Unity integration.

### Test Architecture

The test suite follows a **two-phase dependency-based execution model**:

#### Phase 1: Standalone Tests (No Mono Runtime Dependency)
Tests that can run without requiring Mono runtime to be available:
- **Core Infrastructure** - Module detection, version checking, API availability
- **Mono Utils** - Utility functions, validation, and helper operations (25+ tests)
- **Error Handling** - Comprehensive error scenarios and recovery mechanisms (20+ tests)

#### Phase 2: Mono-Dependent Tests (Require Mono Runtime)
Tests that require Mono runtime to be available and properly initialized:
- **Core API** - Low-level Mono API functionality (30+ tests)
- **Domain Operations** - Mono domain management and operations (25+ tests)
- **Threading Operations** - Thread management and synchronization (20+ tests)
- **Module Operations** - Module loading and metadata access (25+ tests)
- **Class Operations** - Class discovery, inheritance, and metadata (40+ tests)
- **Method Operations** - Method resolution, invocation, and signatures (35+ tests)
- **Field Operations** - Field access, value getting/setting, and metadata (30+ tests)
- **Property Operations** - Property discovery, getter/setter resolution (25+ tests)
- **Assembly Operations** - Assembly loading, enumeration, and dependencies (35+ tests)
- **Image Operations** - Image metadata, class access, and validation (30+ tests)
- **Data Operations** - Array, string, and object operations (40+ tests)
- **Advanced Features** - Complex scenarios and edge cases (25+ tests)

#### Unity-Specific Tests
Specialized tests for Unity engine integration:
- **Unity GameObject** - GameObject lifecycle and component management
- **Unity Components** - Component operations and interactions
- **Unity Engine Modules** - Engine module access and operations

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

# Mono API Tests
npm run test:mono-api
frida -n "YourApp.exe" -l dist/test-mono-api.js

# Unity GameObject Tests
npm run test:unity-gameobject
frida -n "YourUnityApp.exe" -l dist/test-unity-gameobject.js

# Mono Class Tests
npm run test:mono-class
frida -n "YourApp.exe" -l dist/test-mono-class.js
```

#### Available Test Categories

**Core Tests:**
- `test:core-infrastructure` - Core Mono runtime detection and API availability
- `test:mono-api` - Low-level Mono API functionality
- `test:mono-domain` - Domain management and operations
- `test:mono-threading` - Thread management and synchronization
- `test:mono-module` - Module loading and operations

**Model Tests:**
- `test:mono-class` - Class discovery and metadata operations
- `test:mono-method` - Method resolution and invocation
- `test:mono-field` - Field access and operations
- `test:mono-property` - Property discovery and operations
- `test:mono-assembly` - Assembly loading and enumeration
- `test:mono-image` - Image metadata access
- `test:mono-data` - Array, string, and object operations

**Advanced Tests:**
- `test:mono-advanced` - Complex scenarios and edge cases
- `test:mono-utils` - Utility functions and validation
- `test:mono-error-handling` - Error scenarios and exception handling
- `test:mono-types` - Type system operations

**Integration Tests:**
- `test:advanced-features` - Advanced functionality
- `test:data-operations` - Data manipulation operations
- `test:integration` - End-to-end workflows
- `test:supporting` - Supporting utilities

**Unity Tests:**
- `test:unity-gameobject` - Unity GameObject operations
- `test:unity-components` - Unity Component operations
- `test:unity-engine-modules` - Unity Engine module access

#### Batch Operations

Build all individual test runners:
```bash
npm run test:build-all
```

Build and run all test categories:
```bash
npm run test:all
```

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

------------------------------------
-- Phase 1: Standalone Tests (No Mono Dependency) --
------------------------------------
Core Infrastructure Tests:
  PASS Mono module should be detected (0ms)
  PASS Version object should exist (0ms)
  ...

Comprehensive Utils Tests:
  PASS Utility functions should work correctly (0ms)
  ...

------------------------------------
-- Phase 2: Mono-Dependent Tests --
------------------------------------
Unity GameObject Tests:
  PASS GameObject operations should work (0ms)
  ...

Comprehensive Mono API Tests:
  PASS Core API functionality should work (0ms)
  ...

===============================================================
FINAL TEST SUMMARY
===============================================================
Total Tests:    500+
PASS:          500+ (100.0%)
FAIL:           0 (0.0%)
SKIP:           0 (0.0%)
Duration:       ~800ms

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
8. **Use selective testing** - Run specific phases or categories when debugging
9. **Monitor performance** - Use built-in benchmarking to identify bottlenecks
10. **Validate Unity context** - Ensure Unity-specific tests run in appropriate environment

**Test Coverage**: 500+ tests across 37+ modules with 100% pass rate.

See **[tests/README.md](tests/README.md)** for detailed documentation and **[tests/INDIVIDUAL_TEST_RUNNERS.md](tests/INDIVIDUAL_TEST_RUNNERS.md)** for individual test runner instructions.

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

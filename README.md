# frida-mono-bridge

A TypeScript bridge that exposes the Mono runtime (Unity/Xamarin/embedded Mono) to Frida scripts with a clean, high-level API.

[![npm version](https://img.shields.io/npm/v/frida-mono-bridge.svg)](https://www.npmjs.com/package/frida-mono-bridge)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)

## Features

- **Clean API**: High-level object model (Domain, Image, Class, Method, Object, etc.)
- **Auto-Discovery**: Automatically finds and loads Mono runtime with fallback strategies
- **Type-Safe**: Full TypeScript strict mode with comprehensive type definitions
- **Performance**: LRU caching, native delegate thunks, optimized invocation paths
- **Thread-Safe**: Automatic thread attachment with proper lifecycle management
- **Resilient**: Graceful fallbacks for unhookable methods and lazy JIT compilation
- **Well-Tested**: Comprehensive test suite with 1,089 tests across 36 test files

## Quick Start

### Installation

```bash
npm install frida-mono-bridge
```

### Basic Usage

```typescript
import Mono from "frida-mono-bridge";

// Modern fluent API with automatic thread management
// NOTE: perform() is async in v0.3.0+ and must be awaited
await Mono.perform(async () => {
  // Get root domain
  const domain = Mono.domain;

  // Load assembly and find class (throws if class not found)
  const assembly = domain.assembly("Assembly-CSharp");
  const playerClass = assembly.image.class("Game", "Player");

  // Find and invoke method
  const method = playerClass.method("Say", 1);
  const result = method.invoke(null, ["Hello"]);

  // Use facade helpers for object creation
  const str = Mono.string.new("Hello, World!");
  // Use tryClass() for optional lookups (returns null if not found)
  const intClass = Mono.domain.tryClass("System.Int32");
  const intArray = Mono.array.new(intClass!, 10);
});
```

### Build & Run

```bash
# Build the library
npm run build

# Build Frida agent
npm run build:agent

# Run on a Unity/Mono process
frida -n "UnityGame.exe" -l dist/agent.js
```

## Requirements

- **Node.js**: >= 18.0.0
- **Frida**: >= 19.0.0 (peer dependency)
- **Target**: Any process with Mono runtime (Unity games, Xamarin apps, embedded Mono)

### Installing Frida

You need the Frida command-line tools available on your development machine:

```bash
# Install Frida tools via pip (recommended)
pip install frida-tools

# Verify installation
frida --version
```

For platform-specific installation options (Linux, macOS, Windows, Android, iOS), see the official Frida documentation: https://frida.re/docs/home/

## Architecture

The library is organized into three main layers:

```
frida-mono-bridge/
├── src/
│   ├── runtime/            # Low-level Mono C API bindings
│   │   ├── api.ts          # MonoApi - bound Mono functions (~150+ API exports)
│   │   ├── thread.ts       # ThreadManager - thread attachment/lifecycle
│   │   ├── module.ts       # Module discovery (mono-2.0-bdwgc.dll, etc.)
│   │   ├── version.ts      # Runtime version & feature detection
│   │   ├── exports.ts      # Export resolution with aliasing support
│   │   ├── enums.ts        # Mono runtime enumerations
│   │   ├── metadata.ts     # Metadata table access
│   │   ├── memory.ts       # Memory subsystem utilities
│   │   ├── gchandle.ts     # GC handle wrapper
│   │   └── signatures.ts   # Native function signatures
│   ├── model/              # High-level object model
│   │   ├── domain.ts       # MonoDomain - application domain
│   │   ├── assembly.ts     # MonoAssembly - loaded assemblies
│   │   ├── image.ts        # MonoImage - assembly metadata
│   │   ├── class.ts        # MonoClass - type definitions
│   │   ├── method.ts       # MonoMethod - method invocation
│   │   ├── field.ts        # MonoField - field access
│   │   ├── property.ts     # MonoProperty - property access
│   │   ├── object.ts       # MonoObject - managed objects
│   │   ├── string.ts       # MonoString - string operations
│   │   ├── array.ts        # MonoArray - array operations
│   │   ├── delegate.ts     # MonoDelegate - delegate handling
│   │   ├── type.ts         # MonoType - type information and metadata
│   │   ├── handle.ts       # MonoHandle - base handle class
│   │   ├── reference.ts    # MonoReference - lazy loading wrapper
│   │   ├── attribute.ts    # Custom attribute parsing
│   │   ├── collections.ts  # Lazy collections and indexing
│   │   ├── gc.ts           # Garbage collector utilities
│   │   ├── trace.ts        # Method tracing and hooking
│   │   ├── internal-call.ts # Internal call registration
│   │   ├── method-signature.ts # Method signature parsing
│   │   └── value-conversion.ts # Value boxing/unboxing
│   ├── utils/              # Utility modules
│   │   ├── errors.ts       # Error types and handling (MonoError, codes)
│   │   ├── memory.ts       # Memory utilities (boxing, pointers, read/write)
│   │   ├── log.ts          # Logging infrastructure (Logger class)
│   │   ├── cache.ts        # LRU caching utilities
│   │   └── string.ts       # String utilities
│   ├── mono.ts             # MonoNamespace - main fluent API facade
│   └── index.ts            # Package entry point and exports
├── tests/                  # Test suite (36 test files, 1,089 tests)
│   ├── test-*.ts           # 36 test modules covering all APIs
│   ├── runners/            # Individual test runners for selective execution
│   ├── test-framework.ts   # Test framework and utilities
│   ├── test-common.ts      # Common test setup and helpers
│   └── README.md           # Test documentation
├── docs/                   # Documentation
├── scripts/                # Build and generation scripts
│   ├── build.mjs                  # Main build script
│   ├── generate-mono-signatures.ts # API signature generator
│   └── generate-enums.ts          # Enum definition generator
└── dist/                   # Compiled output (ES modules + type definitions)
```

## API Overview

### Core APIs

```typescript
import Mono from "frida-mono-bridge";

// Modern Fluent API (recommended)
await Mono.perform(async () => {
  // Module & Version
  console.log(Mono.module.name); // e.g., "mono-2.0-bdwgc.dll"
  console.log(Mono.version.features); // { delegateThunk, metadataTables, ... }

  // Domain & Assembly
  const domain = Mono.domain;
  const assembly = domain.assembly("Assembly-CSharp");

  // Class & Method
  const playerClass = assembly.image.class("Game", "Player");
  const method = playerClass.method("Say", 1);
  const result = method.invoke(null, ["Hello"]);
});

// Thread-safe cleanup (safe to call anytime)
Mono.detachIfExiting(); // Only detaches if thread is exiting
```

### Facade Helpers

The `Mono` namespace provides convenient helpers for creating and wrapping managed objects:

```typescript
await Mono.perform(() => {
  // String helpers
  const str = Mono.string.new("Hello");
  const wrappedStr = Mono.string.wrap(ptr);
  const maybeStr = Mono.string.tryWrap(nullablePtr); // returns null if invalid

  // Array helpers
  const intClass = Mono.domain.class("System.Int32");
  const arr = Mono.array.new(intClass, 10);
  const wrappedArr = Mono.array.wrap(ptr);

  // Object helpers
  const obj = Mono.object.wrap(ptr);
  const maybeObj = Mono.object.tryWrap(nullablePtr);

  // Delegate helpers
  const delegateClass = Mono.domain.tryClass("System.Action");
  const del = Mono.delegate.new(delegateClass!, targetObj, method);

  // Method helpers
  const method = Mono.method.find(image, "MyClass:MyMethod(int)");
  const maybeMethod = Mono.method.tryFind(image, "NotExist:Method()"); // returns null

  // Assembly/Image helpers
  const asm = Mono.assembly.open("mscorlib");
  const img = Mono.image.fromAssemblyPath("MyAssembly.dll");

  // Class/Field/Property helpers
  const klass = Mono.class.wrap(klassPtr);
  const field = Mono.field.wrap(fieldPtr);
  const prop = Mono.property.wrap(propPtr);

  // Type helpers
  const type = Mono.type.fromClass(klass);
});
```

### MonoNamespace Properties

| Property   | Description                                                                               |
| ---------- | ----------------------------------------------------------------------------------------- |
| `config`   | Configuration (module discovery, export aliasing, timeouts, perform mode, global install) |
| `domain`   | Root application domain                                                                   |
| `api`      | Low-level Mono C API wrapper (internal/advanced)                                          |
| `module`   | Discovered Mono module info                                                               |
| `version`  | Runtime version and feature detection                                                     |
| `memory`   | Memory utilities (boxing/unboxing, string/array helpers, typed read/write)                |
| `gc`       | Garbage collection utilities                                                              |
| `trace`    | Tracing utilities (facade submodule)                                                      |
| `icall`    | Internal call registration and management                                                 |
| `array`    | Array creation and wrapping helpers                                                       |
| `string`   | String creation and wrapping helpers                                                      |
| `object`   | Object wrapping helpers                                                                   |
| `delegate` | Delegate creation and wrapping helpers                                                    |
| `method`   | Method lookup and wrapping helpers                                                        |
| `image`    | Image loading and wrapping helpers                                                        |
| `assembly` | Assembly loading and wrapping helpers                                                     |
| `class`    | Class wrapping helpers                                                                    |
| `field`    | Field wrapping helpers                                                                    |
| `property` | Property wrapping helpers                                                                 |
| `type`     | Type utilities and wrapping helpers                                                       |

### MonoNamespace Methods

| Method                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `initialize()`             | Wait for module + root domain readiness (does not attach thread) |
| `perform(callback, mode?)` | Execute code with guaranteed init + thread attachment (async)    |
| `dispose()`                | Clean up all resources                                           |
| `ensureThreadAttached()`   | Manually attach current thread                                   |
| `detachIfExiting()`        | Safe thread detach (only if exiting)                             |
| `detachAllThreads()`       | Force detach all threads (cleanup only)                          |

## Development Guide

### Building

```bash
# Install dependencies
npm install

# Build library (produces dist/index.js and dist/index.d.ts)
npm run build

# Build Frida agent (produces dist/agent.js for direct use with Frida)
npm run build:agent

# Watch mode for development
npm run watch
```

### Code Quality

```bash
# Run linter
npm run lint
npm run lint:fix     # Auto-fix issues

# Format code
npm run format
npm run format:check

# Type check
npm run typecheck
```

### Project Scripts

| Script                        | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| `npm run build`               | Build library with esbuild + dts-bundle-generator |
| `npm run build:agent`         | Build standalone Frida agent                      |
| `npm run watch`               | Watch mode with frida-compile                     |
| `npm run lint`                | ESLint + TypeScript type check                    |
| `npm run format`              | Prettier formatting                               |
| `npm run test`                | Compile all tests to dist/tests.js                |
| `npm run test:*`              | Compile specific test category                    |
| `npm run docs`                | Generate API docs with TypeDoc                    |
| `npm run generate:signatures` | Regenerate Mono API signatures                    |
| `npm run generate:enums`      | Regenerate enum definitions                       |

### Package Exports

The library is an ES module (`"type": "module"`). In v0.3.0+, the root entry focuses on a single `Mono` facade.

```typescript
// Default export - Mono facade singleton
import Mono from "frida-mono-bridge";

// Named export (same instance)
import { Mono as MonoNamed } from "frida-mono-bridge";

// Error types/enums for typed catch blocks
import { MonoError, MonoErrorCodes, MonoRuntimeNotReadyError } from "frida-mono-bridge";

// Type-only exports for annotations (not runtime values)
import type { MonoDomain, MonoClass, MonoMethod, MonoApi } from "frida-mono-bridge";
```

Notes:

- v0.3.0+ no longer re-exports `runtime/`, `model/`, `utils/` as runtime values. Use facade helpers and domain methods directly.
- Use facade helpers for object creation: `Mono.array`, `Mono.string`, `Mono.object`, `Mono.delegate`, `Mono.method`, `Mono.image`, `Mono.assembly`, `Mono.class`, `Mono.field`, `Mono.property`, `Mono.type`.
- Subsystem facades: `Mono.memory` (memory utilities), `Mono.gc` (garbage collection), `Mono.trace` (method tracing), `Mono.icall` (internal calls).
- `globalThis.Mono` is installed by default on first `Mono.initialize()` / `Mono.perform()`. Disable by setting `Mono.config.installGlobal = false` before first use.

## Testing

The test suite contains **1,089 individual test cases** organized into **7 categories** across **36 test files**.
See [tests/README.md](tests/README.md) for complete documentation and [docs/API_QUALITY_REPORT.md](docs/API_QUALITY_REPORT.md) for quality metrics.

### Test Categories

| Category            | Tests     | Files  | Description                                     |
| ------------------- | --------- | ------ | ----------------------------------------------- |
| Core Infrastructure | ~115      | 5      | Module detection, type system, metadata         |
| Utility Tests       | ~80       | 3      | Standalone tests (no Mono dependency)           |
| Type System         | ~260      | 6      | MonoClass, MonoMethod, MonoField, MonoProperty  |
| Runtime Objects     | ~275      | 6      | MonoString, MonoArray, MonoDelegate, MonoObject |
| Domain & Assembly   | ~125      | 5      | MonoDomain, MonoAssembly, MonoImage, threading  |
| Advanced Features   | ~160      | 4      | Find, Trace, GC, Internal Calls                 |
| Unity Integration   | ~30       | 3      | GameObject, Components, Engine Modules          |
| **TOTAL**           | **1,089** | **36** | Complete test coverage                          |

### Running Tests

Tests are compiled with `frida-compile` and executed against a running Mono process:

```bash
# Step 1: Compile tests
npm run test:mono-class           # Single category (recommended)
npm test                          # All tests

# Step 2: Run with Frida against target process
frida -n "YourApp.exe" -l dist/test-mono-class.js
frida -n "UnityGame.exe" -l dist/tests.js
```

**Test Execution Model:**

- **Phase 1**: Standalone tests (~80 tests) - No Mono runtime required
- **Phase 2**: Mono-dependent tests (~1,024 tests) - Requires active Mono runtime
- **Selective Execution**: Run individual test categories for faster iteration
- **Manual Invocation**: Tests don't auto-run; explicit execution required

### Available Test Scripts

```bash
# Core Infrastructure Tests (213 tests)
npm run test:core-infrastructure    # Module detection, version info (11 tests)
npm run test:mono-types             # MonoType system (77 tests)
npm run test:data-operations        # Object/String/Array ops (51 tests)
npm run test:integration            # Fluent API integration (33 tests)
npm run test:supporting             # Enums, metadata, logger (41 tests)

# Utility Tests - Standalone (95 tests)
npm run test:mono-utils             # Utility functions (45 tests)
npm run test:mono-error-handling    # Error handling (46 tests)

# Type System Tests (270 tests)
npm run test:mono-class             # MonoClass API (56 tests)
npm run test:mono-method            # MonoMethod API (45 tests)
npm run test:mono-field             # MonoField API (70 tests)
npm run test:mono-property          # MonoProperty API (61 tests)
npm run test:generic-types          # Generic types (29 tests)
npm run test:custom-attributes      # Custom attributes (9 tests)

# Runtime Object Tests (251 tests)
npm run test:mono-string            # MonoString ops (70 tests)
npm run test:mono-array             # MonoArray ops (66 tests)
npm run test:mono-delegate          # MonoDelegate ops (52 tests)
npm run test:mono-object            # MonoObject ops (12 tests)
npm run test:mono-data              # Data operations (41 tests)
npm run test:runtime-api            # Runtime API (38 tests)

# Domain & Assembly Tests (184 tests)
npm run test:mono-api               # Core Mono API (18 tests)
npm run test:mono-domain            # MonoDomain ops (3 tests)
npm run test:mono-assembly          # MonoAssembly ops (42 tests)
npm run test:mono-image             # MonoImage ops (52 tests)
npm run test:mono-threading         # Threading (29 tests)
npm run test:mono-module            # Module management (24 tests)

# Advanced Feature Tests (143 tests)
npm run test:find-tools             # Search utilities (56 tests)
npm run test:trace-tools            # Method tracing (33 tests)
npm run test:gc-tools               # GC utilities (41 tests)

# Unity Integration Tests (42 tests)
npm run test:unity-gameobject       # GameObject ops (12 tests)
npm run test:unity-components       # Component system (11 tests)
npm run test:unity-engine-modules   # Engine modules (19 tests)
```

**Test Documentation:**

- Complete test suite documentation: [tests/README.md](tests/README.md)
- Test framework details and best practices included
- Individual test file descriptions and examples

## Advanced Features

### Search Utilities

The `Mono.domain` object provides search methods for classes, methods, fields, and properties:

```typescript
import Mono from "frida-mono-bridge";

await Mono.perform(() => {
  // Fast exact class lookup (optimized for System.* and UnityEngine.* namespaces)
  const stringClass = Mono.domain.tryClass("System.String");
  const gameObjectClass = Mono.domain.tryClass("UnityEngine.GameObject");

  // Find classes by wildcard pattern (* and ?)
  const playerClasses = Mono.domain.findClasses("*Player*");
  const controllers = Mono.domain.findClasses("Game.?Controller");

  // Find with regex
  const managers = Mono.domain.findClasses(".*Manager$", { regex: true });

  // Find with options (limit, filter, etc.)
  const limited = Mono.domain.findClasses("*", {
    limit: 10,
    filter: c => !c.isInterface(),
  });

  // Find methods across all classes
  const attackMethods = Mono.domain.findMethods("*Attack*");

  // Find fields
  const healthFields = Mono.domain.findFields("*health*", { caseInsensitive: true });

  // Find properties
  const positionProps = Mono.domain.findProperties("*Position*");
});
```

### Method Tracing

The `Mono.trace` facade submodule provides method hooking with safe fallbacks for JIT compilation:

```typescript
import Mono from "frida-mono-bridge";

await Mono.perform(() => {
  const playerClass = Mono.domain.assembly("Assembly-CSharp").image.class("Game", "Player");
  const takeDamage = playerClass.method("TakeDamage", 1);

  // Basic method tracing
  const detach = Mono.trace.method(takeDamage, {
    onEnter(args) {
      console.log("-> TakeDamage called with:", args[0].toInt32());
    },
    onLeave(retval) {
      console.log("<- Returned:", retval);
    },
  });

  // Safe tracing (returns null if method not JIT-compiled yet)
  const safeDetach = Mono.trace.tryMethod(takeDamage, {
    onEnter(args) {
      console.log("Called");
    },
  });
  if (!safeDetach) {
    console.log("Method not hookable yet");
  }

  // Extended context access
  Mono.trace.methodExtended(takeDamage, {
    onEnter(args) {
      console.log("Thread:", this.threadId);
      console.log("Return address:", this.returnAddress);
    },
  });

  // Replace return value
  Mono.trace.replaceReturnValue(takeDamage, (original, thisPtr, args) => {
    return ptr(100); // Always return 100
  });

  // Trace all methods in a class
  const detachAll = Mono.trace.classAll(playerClass, {
    onEnter(args) {
      console.log("Method called");
    },
  });

  // Cleanup
  detach();
  detachAll();
});
```

### Error Handling

```typescript
import Mono, { MonoError, MonoErrorCodes, MonoMethodNotFoundError } from "frida-mono-bridge";

await Mono.perform(() => {
  // Option 1: Use try* methods for optional lookups (returns null if not found)
  const playerClass = Mono.domain.tryClass("Game.Player");
  if (!playerClass) {
    console.log("Player class not found");
    return;
  }

  // Option 2: Catch exceptions from throwing methods
  try {
    // This will throw if method is missing / incompatible / runtime not ready
    const assembly = Mono.domain.assembly("Assembly-CSharp");
    const klass = assembly.image.class("Game", "Player"); // throws if not found
    const method = klass.method("TakeDamage", 1);
    method.invoke(null, []);
  } catch (e) {
    if (e instanceof MonoMethodNotFoundError) {
      console.log("Missing method:", e.message);
    } else if (e instanceof MonoError) {
      console.log("MonoError:", e.code, e.message);
      if (e.code === MonoErrorCodes.RUNTIME_NOT_READY) {
        console.log("Tip: call via await Mono.perform(...) once runtime is ready");
      }
    }

    throw e;
  }
});
```

### Custom Attributes

```typescript
await Mono.perform(() => {
  // Get custom attributes from various Mono types
  const assembly = Mono.domain.assembly("Assembly-CSharp");
  const assemblyAttrs = assembly?.getCustomAttributes();

  const klass = assembly?.image.class("Game", "Player");
  const classAttrs = klass?.getCustomAttributes();

  const method = klass?.method("Update", 0);
  const methodAttrs = method?.getCustomAttributes();

  const field = klass?.field("health");
  const fieldAttrs = field?.getCustomAttributes();

  const prop = klass?.property("Health");
  const propAttrs = prop?.getCustomAttributes();
});
```

### Generic Types

```typescript
await Mono.perform(() => {
  // Create generic type instances
  const listDef = Mono.domain.tryClass("System.Collections.Generic.List`1");
  const stringClass = Mono.domain.tryClass("System.String");
  const listOfString = listDef?.makeGenericType([stringClass!]);
  // listOfString is now List<string>

  const dictDef = Mono.domain.tryClass("System.Collections.Generic.Dictionary`2");
  const intClass = Mono.domain.tryClass("System.Int32");
  const dictOfStringInt = dictDef?.makeGenericType([stringClass!, intClass!]);
  // dictOfStringInt is now Dictionary<string, int>
});
```

### GC Utilities

```typescript
await Mono.perform(() => {
  const gc = Mono.gc;

  // Force garbage collection
  gc.collect(0); // Gen 0
  gc.collect(1); // Gen 1

  // Get GC statistics (availability depends on the target runtime)
  const { heapSize, usedHeapSize } = gc.stats;

  // Manage GC handles
  const handle = gc.handle(someObject, true);
  // ... use handle ...
  gc.releaseHandle(handle);

  // Release all handles on cleanup
  gc.releaseAll();
});
```

### Internal Call Registration

```typescript
await Mono.perform(() => {
  // Register a custom internal call
  Mono.icall.register({
    name: "MyNamespace.MyClass::MyInternalMethod",
    implementation: new NativeCallback(
      (arg1, arg2) => {
        console.log("Internal call invoked!", arg1, arg2);
        return ptr(0);
      },
      "pointer",
      ["pointer", "int32"],
    ),
  });

  // Register multiple internal calls
  Mono.icall.registerAll([
    { name: "MyClass::Method1", implementation: ptr(0x12345678) },
    { name: "MyClass::Method2", implementation: myNativeCallback },
  ]);

  // Check registration status
  if (Mono.icall.has("MyClass::Method1")) {
    const info = Mono.icall.get("MyClass::Method1");
    console.log("Registered:", info?.name);
  }
});
```

## Performance

- **LRU Caching**: Function cache (256), address cache (512), thunk cache (128)
- **Native Thunks**: High-performance delegate invocation via unmanaged thunks
- **Smart Resolution**: Export discovery with aliases and fallback strategies
- **Thread Management**: Automatic attachment with nested call optimization

## Compatibility

- **Mono Runtimes**: Standard Mono exports (`mono-2.0-bdwgc.dll`, `monosgen-2.0.dll`, `mono.dll`, etc.)
- **Unity**: Tested with Unity 2022.3.x and other versions using Mono scripting backend
- **Platforms**: Windows, Linux, macOS, Android (depends on Frida platform support)

## Contributing

Contributions are welcome! Please:

1. Maintain TypeScript strict mode compliance
2. Add JSDoc documentation for public APIs
3. Include tests for new features (see [tests/README.md](tests/README.md))
4. Follow existing code patterns
5. Ensure backward compatibility

## License

MIT - See [LICENSE](LICENSE) file for details.

## Credits

Inspired by [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge).

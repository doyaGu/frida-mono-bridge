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
- **Well-Tested**: Comprehensive test suite with 1000+ tests across 30+ test modules

## Quick Start

### Installation

```bash
npm install frida-mono-bridge
```

### Basic Usage

```typescript
import Mono from "frida-mono-bridge";

// Modern fluent API with automatic thread management
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
│   │   ├── api.ts          # MonoApi - bound Mono functions
│   │   ├── thread.ts       # ThreadManager - thread attachment
│   │   ├── module.ts       # Module discovery (mono-2.0-bdwgc.dll, etc.)
│   │   └── version.ts      # Runtime feature detection
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
│   │   └── delegate.ts     # MonoDelegate - delegate handling
│   ├── utils/              # Utility modules
│   │   ├── find.ts         # Search utilities (classes, methods, fields)
│   │   ├── trace.ts        # Method hooking/tracing
│   │   ├── gc.ts           # GC utilities and handle management
│   │   ├── errors.ts       # Error types and handling
│   │   ├── memory.ts       # Memory utilities
│   │   ├── log.ts          # Logging infrastructure
│   │   └── cache.ts        # LRU caching utilities
│   ├── mono.ts             # MonoNamespace - main fluent API facade
│   └── index.ts            # Package entry point and exports
├── tests/                  # Test suite (30+ modules, 1000+ tests)
├── docs/                   # Documentation
└── dist/                   # Compiled output
```

## API Overview

### Core APIs

```typescript
import Mono from "frida-mono-bridge";

// Modern Fluent API (recommended)
Mono.perform(() => {
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

### MonoNamespace Properties

| Property  | Type                 | Description                  |
| --------- | -------------------- | ---------------------------- |
| `domain`  | `MonoDomain`         | Root application domain      |
| `api`     | `MonoApi`            | Low-level Mono C API wrapper |
| `module`  | `MonoModuleInfo`     | Discovered Mono module info  |
| `version` | `MonoRuntimeVersion` | Runtime version and features |
| `gc`      | `GCUtilities`        | Garbage collection utilities |
| `find`    | `Find`               | Search utilities module      |
| `trace`   | `Trace`              | Tracing utilities module     |

### MonoNamespace Methods

| Method                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `perform(callback)`      | Execute code with guaranteed thread attachment |
| `dispose()`              | Clean up all resources                         |
| `ensureThreadAttached()` | Manually attach current thread                 |
| `detachIfExiting()`      | Safe thread detach (only if exiting)           |
| `detachAllThreads()`     | Force detach all threads (cleanup only)        |

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

The library is an ES module (`"type": "module"`) with the following exports:

```typescript
// Default export - MonoNamespace singleton
import Mono from "frida-mono-bridge";

// Named export
import { Mono } from "frida-mono-bridge";

// Direct module access
import {
  // Runtime layer
  MonoApi,
  createMonoApi,
  findMonoModule,
  ThreadManager,

  // Model layer
  MonoDomain,
  MonoAssembly,
  MonoImage,
  MonoClass,
  MonoMethod,
  MonoField,
  MonoProperty,
  MonoObject,
  MonoString,
  MonoArray,
  MonoDelegate,

  // Utilities
  classes,
  methods,
  fields, // Find utilities
  method as traceMethod,
  classAll, // Trace utilities
  GCUtilities, // GC utilities
  withErrorHandling,
  MonoError, // Error handling
  Logger, // Logging
} from "frida-mono-bridge";
```

## Testing

The test suite contains **1000+ tests** organized into **7 categories** across **30+ test modules**.

### Test Categories

| Category            | Tests | Description                                     |
| ------------------- | ----- | ----------------------------------------------- |
| Core Infrastructure | ~200  | Module detection, type system, metadata         |
| Utility Tests       | ~94   | Standalone tests (no Mono dependency)           |
| Type System         | ~245  | MonoClass, MonoMethod, MonoField, MonoProperty  |
| Runtime Objects     | ~272  | MonoString, MonoArray, MonoDelegate, MonoObject |
| Domain & Assembly   | ~291  | MonoDomain, MonoAssembly, MonoImage, threading  |
| Advanced Features   | ~135  | Find, Trace, GC, Custom Attributes              |
| Unity Integration   | ~58   | GameObject, Components, Engine Modules          |

### Running Tests

Tests are compiled with `frida-compile` and executed against a running Mono process:

```bash
# Step 1: Compile tests
npm run test:mono-class           # Single category
npm test                          # All tests

# Step 2: Run with Frida against target process
frida -n "YourApp.exe" -l dist/test-mono-class.js
frida -n "UnityGame.exe" -l dist/tests.js
```

### Available Test Scripts

```bash
# Core tests
npm run test:core-infrastructure
npm run test:mono-types
npm run test:mono-api

# Type system tests
npm run test:mono-class
npm run test:mono-method
npm run test:mono-field
npm run test:mono-property
npm run test:generic-types

# Runtime object tests
npm run test:mono-string
npm run test:mono-array
npm run test:mono-delegate
npm run test:mono-object

# Domain & assembly tests
npm run test:mono-domain
npm run test:mono-assembly
npm run test:mono-image
npm run test:mono-threading

# Advanced feature tests
npm run test:find-tools
npm run test:trace-tools
npm run test:gc-tools
npm run test:custom-attributes

# Unity tests
npm run test:unity-gameobject
npm run test:unity-components
npm run test:unity-engine-modules
```

For detailed test documentation, see [tests/README.md](tests/README.md).

## Advanced Features

### Search Utilities

The `find` module provides wildcard and regex search across the loaded assemblies:

```typescript
import Mono from "frida-mono-bridge";
import { classes, methods, fields, properties } from "frida-mono-bridge";

Mono.perform(() => {
  const api = Mono.api;

  // Find classes by pattern (wildcard: * and ?)
  const playerClasses = classes(api, "*Player*");
  const controllers = classes(api, "Game.?Controller");

  // Find with regex
  const managers = classes(api, ".*Manager$", { regex: true });

  // Find with options
  const limited = classes(api, "*", {
    limit: 10,
    filter: c => !c.isInterface(),
  });

  // Find methods across all classes
  const attackMethods = methods(api, "*Attack*");

  // Find fields
  const healthFields = fields(api, "*health*", { caseInsensitive: true });

  // Find properties
  const positionProps = properties(api, "*Position*");
});
```

### Method Tracing

The `trace` module provides method hooking with safe fallbacks for JIT compilation:

```typescript
import Mono from "frida-mono-bridge";
import * as Trace from "frida-mono-bridge";

Mono.perform(() => {
  const playerClass = Mono.domain.assembly("Assembly-CSharp").image.class("Game", "Player");
  const takeDamage = playerClass.method("TakeDamage", 1);

  // Basic method tracing
  const detach = Trace.method(takeDamage, {
    onEnter(args) {
      console.log("-> TakeDamage called with:", args[0].toInt32());
    },
    onLeave(retval) {
      console.log("← Returned:", retval);
    },
  });

  // Safe tracing (returns null if method not JIT-compiled yet)
  const safeDetach = Trace.tryMethod(takeDamage, {
    onEnter(args) {
      console.log("Called");
    },
  });
  if (!safeDetach) {
    console.log("Method not hookable yet");
  }

  // Extended context access
  Trace.methodExtended(takeDamage, {
    onEnter(args) {
      console.log("Thread:", this.threadId);
      console.log("Return address:", this.returnAddress);
    },
  });

  // Replace return value
  Trace.replaceReturnValue(takeDamage, (original, thisPtr, args) => {
    return ptr(100); // Always return 100
  });

  // Trace all methods in a class
  const detachAll = Trace.classAll(playerClass, {
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
import { withErrorHandling, MonoError, MonoMethodError } from "frida-mono-bridge";

// Wrap operations with automatic error handling
const safeFn = withErrorHandling((damage: number) => {
  const method = playerClass.method("TakeDamage", 1);
  return method.invoke(instance, [damage]);
}, "player damage calculation");

const result = safeFn(100);

// Catch specific error types
try {
  method.invoke(null, []);
} catch (e) {
  if (e instanceof MonoMethodError) {
    console.log("Method error:", e.message);
  }
}
```

### Custom Attributes

```typescript
Mono.perform(() => {
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
Mono.perform(() => {
  // Create generic type instances
  const listDef = Mono.domain.class("System.Collections.Generic.List`1");
  const stringClass = Mono.domain.class("System.String");
  const listOfString = listDef?.makeGenericType([stringClass!]);
  // listOfString is now List<string>

  const dictDef = Mono.domain.class("System.Collections.Generic.Dictionary`2");
  const intClass = Mono.domain.class("System.Int32");
  const dictOfStringInt = dictDef?.makeGenericType([stringClass!, intClass!]);
  // dictOfStringInt is now Dictionary<string, int>
});
```

### GC Utilities

```typescript
Mono.perform(() => {
  const gc = Mono.gc;

  // Force garbage collection
  gc.collect(0); // Gen 0
  gc.collect(1); // Gen 1

  // Get GC statistics
  const heapSize = gc.getHeapSize();
  const usedSize = gc.getUsedSize();

  // Manage GC handles
  const handle = gc.allocHandle(someObject);
  // ... use handle ...
  gc.freeHandle(handle);

  // Release all handles on cleanup
  gc.releaseAll();
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

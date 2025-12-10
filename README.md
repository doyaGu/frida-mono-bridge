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
- **Well-Tested**: Comprehensive test suite across 30+ test modules

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
# Build the bridge
npm run build

# Run on a Unity/Mono process
frida -n "UnityGame.exe" -l dist/agent.js
```

## Architecture

```
frida-mono-bridge/
├── src/                    # Source code
│   ├── runtime/            # Mono runtime: discovery, signatures, threading
│   ├── model/              # High-level objects: Domain, Assembly, Class, Method, etc.
│   ├── utils/              # Utilities: find, trace, gc, cache, logging
│   ├── mono.ts             # MonoNamespace - Main fluent API entry point
│   └── index.ts            # Global entry point and exports
├── tests/                  # Test suite (30+ test modules)
│   ├── runners/            # Individual test runners
│   ├── test-framework.ts   # Test framework with auto thread management
│   └── index.ts            # Central export hub for test modules
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
  console.log(Mono.module.name, Mono.version.features.delegateThunk);

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

## Testing

The Frida Mono Bridge includes a comprehensive test suite organized across **30+ test modules** in 7 categories. The test suite validates all aspects of the bridge from core infrastructure to advanced Unity integration.

### Test Categories

| Category                | Description                               |
| ----------------------- | ----------------------------------------- |
| **Core Infrastructure** | Basic module setup, Mono detection        |
| **Utility Tests**       | Standalone tests without Mono dependency  |
| **Type System**         | Class, method, field, property operations |
| **Runtime Objects**     | String, array, delegate, object handling  |
| **Domain & Assembly**   | Domain, assembly, image, threading        |
| **Advanced Features**   | GC tools, tracing, search utilities       |
| **Unity Integration**   | GameObject, components, engine modules    |

### Running Tests

To run the tests, you can use the provided npm scripts. Ensure you have a target Mono application running.

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

## Advanced Features

### Batch Operations

```typescript
import { BatchOperation } from "./src/utils/batch";
import { withErrorHandling } from "./src/utils/errors";

// Batch operations for efficiency
const batch = new BatchOperation();
batch.add(() => player.method("Update").invoke(player, []));
batch.add(() => player.method("Render").invoke(player, []));
const results = batch.executeAll();

// Safe operations with built-in error handling
const safeFn = withErrorHandling((damage: number) => {
  const method = playerClass.method("TakeDamage", 1);
  return method.invoke(instance, [damage]);
}, "player damage calculation");
const result = safeFn(100);
```

### Custom Attributes

```typescript
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
```

### Generic Types

```typescript
// Create generic type instances
const listDef = Mono.domain.class("System.Collections.Generic.List`1");
const stringClass = Mono.domain.class("System.String");
const listOfString = listDef?.makeGenericType([stringClass!]);
// listOfString is now List<string>

const dictDef = Mono.domain.class("System.Collections.Generic.Dictionary`2");
const intClass = Mono.domain.class("System.Int32");
const dictOfStringInt = dictDef?.makeGenericType([stringClass!, intClass!]);
// dictOfStringInt is now Dictionary<string, int>
```

### Search & Tracing

```typescript
// Wildcard search for methods
const attackMethods = Mono.find.methods("*Attack*");

// Trace method calls
Mono.trace.method(takeDamageMethod, {
  onEnter(args) {
    console.log("→ Taking damage:", args[0]);
  },
  onLeave(retval) {
    console.log("← Health:", retval);
  },
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

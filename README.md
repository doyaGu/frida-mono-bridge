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
- **Well-Tested**: 187 tests across 23 modules with 100% pass rate
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

Run the comprehensive test suite:

```powershell
# Compile tests
npx frida-compile tests/index.ts -o dist/tests.js

# Run against a Mono process
frida -n "UnityGame.exe" -l dist/tests.js
```

**Test Coverage**: 187 tests across 23 modules with 100% pass rate.

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

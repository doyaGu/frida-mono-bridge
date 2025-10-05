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
- **Well-Documented**: Comprehensive JSDoc, examples, and guides

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

# Build examples
npm run build:examples

# Run on a Unity/Mono process
frida -n "UnityGame.exe" -l dist/agent.js
```

## Examples

See the `examples/` directory for practical usage:

- **call-static-method.ts**: Invoke static methods
- **dump-assemblies.ts**: Enumerate and explore assemblies
- **hook-runtime-invoke.ts**: Intercept method invocations
- **invoke-delegate-fast.ts**: High-performance delegate calls
- **register-icall.ts**: Register custom internal calls
- **explore-metadata.ts**: Assembly and class discovery
- **fluent-api-demo.ts**: Modern fluent API usage
- **thread-management.ts**: Thread management patterns

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

## Performance

- **LRU Caching**: Function cache (256), address cache (512), thunk cache (128)
- **Native Thunks**: High-performance delegate invocation via unmanaged thunks
- **Smart Resolution**: Export discovery with aliases and fallback strategies

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

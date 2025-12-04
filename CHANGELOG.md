# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-03

### Added

- **Core Mono API Bridge**
  - Complete TypeScript bridge for Mono runtime with 100+ API functions
  - High-level object model: `MonoDomain`, `MonoAssembly`, `MonoImage`, `MonoClass`, `MonoMethod`, `MonoField`, `MonoProperty`, `MonoObject`, `MonoArray`, `MonoString`, `MonoDelegate`
  - Auto-discovery of Mono runtime module with fallback strategies
  - Type-safe API with full TypeScript strict mode support
  - Comprehensive JSDoc documentation

- **Modern Fluent API**
  - `Mono.perform()` for automatic thread attachment
  - `Mono.domain`, `Mono.module`, `Mono.version`, `Mono.api` accessors
  - Method chaining: `domain.assembly("name").image.class("ns", "name").method("name")`

- **Runtime Features**
  - Automatic Mono thread attachment with lifecycle management
  - LRU caching for classes, methods, and fields
  - Native delegate thunks for optimized invocation paths
  - Support for both legacy Mono and Unity 2022+ (mono-2.0-bdwgc.dll)

- **Type System Support**
  - Generic types with parameter introspection
  - Value types (structs) with proper memory handling
  - Nullable types, enums, arrays, and delegates
  - Custom attributes reading and parsing

- **Utility Functions**
  - `Mono.find` - Search classes, methods, and fields by pattern
  - `Mono.trace` - Method hooking and call tracing
  - `Mono.gc` - Garbage collector interaction and pinning

- **Unity Explorer Tool** (`unity-explorer/`)
  - Scene exploration and hierarchy traversal
  - GameObject and Component discovery
  - UnityEvent finding and triggering
  - RPC-based remote control interface
  - Python client library for automation

- **Test Suite**
  - 750+ tests across 37 test modules
  - 100% pass rate on target Unity applications
  - Comprehensive coverage of all API surfaces

### Technical Details

- Written in TypeScript with strict mode
- Zero runtime dependencies (Frida built-in only)
- Supports Node.js 16+
- Tested on Windows with Unity/Mono games

### Known Limitations

- IL2CPP runtime is not supported (use frida-il2cpp-bridge instead)
- Some edge cases in generic type resolution

[0.1.0]: https://github.com/doyaGu/frida-mono-bridge/releases/tag/v0.1.0

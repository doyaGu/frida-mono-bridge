# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2025-12-05

### Changed
- Replace `AnyNativeFunction` type alias with proper Frida type definitions (`NativeFunctionReturnValue`, `NativeFunctionArgumentValue[]`)
- Build now produces single bundled type declaration file using `dts-bundle-generator`
- Improved npm package structure with clean bundled outputs

### Removed
- Removed `tsconfig.build.json` (no longer needed with new build system)
- Removed Mono Members Tests from the test suite

## [0.2.1] - 2025-12-04

### Changed
- Migrated to esbuild-based bundling system for faster builds
- Updated prepublish script and enhanced build process
- Ensure `dist` directory is created before building

## [0.2.0] - 2025-12-04

### Added
- ES module support with proper `exports` field in package.json
- Resilient method interception with graceful fallbacks for unhookable methods
- Method compatibility detection for InternalCall, P/Invoke, and Runtime implementations
- Non-throwing hooking variants that return null instead of exceptions
- `detachIfExiting()` method for safe thread detachment using `mono_thread_detach_if_exiting`
- `Mono.detachIfExiting()` top-level API for convenience
- Resilient batch hooking with automatic skip of incompatible methods
- Centralized thread management in test framework with automatic `Mono.perform` wrapping
- Enhanced error recovery in tracing utilities
- ESLint and Prettier for code quality

### Changed
- **BREAKING**: Consolidated utility modules - several utility files removed or merged
- **BREAKING**: Removed `types` utility from main Mono namespace
- Centralized type utilities and primitive operations in `type.ts`
- Unified Mono handle enumeration in `utils/memory.ts`
- Standardized logging with `Logger.withTag()` pattern
- TypeScript module settings updated to use ESNext and bundler resolution
- Node.js engine requirement updated to >=18.0.0
- `detachAll()` now uses `detachIfExiting()` for current thread to prevent script hangs
- Consolidated memory allocation functions using Frida's built-in `Memory.allocUtf8String`

### Removed
- Deprecated utility files: `batch.ts`, `retry.ts`, `safe-access.ts`
- Write-barrier utilities in favor of direct API usage
- Deprecated tests for `MonoArray` and `TypesUtils`

### Fixed
- Thread detachment no longer causes script hangs during normal execution
- Instance field setValue now works correctly with proper memory allocation
- Method hooking handles Mono's lazy JIT compilation gracefully

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

---

## Version History

- **0.2.0** - ES module support, resilient method interception, utility consolidation
- **0.1.0** - Initial public release

[Unreleased]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/doyaGu/frida-mono-bridge/releases/tag/v0.1.0

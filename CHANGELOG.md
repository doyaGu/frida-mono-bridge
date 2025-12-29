# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2025-12-29

### Added
- Wrapper registry for arrays and delegates to avoid circular imports and enable lazy wrapper registration
- BigInt support for 64-bit MonoField values
- Batch field operations for MonoObject
- Fuzzy matching utilities for MonoError handling
- Expanded tests for delegates, field operations, object cloning, and tryGetClassPtrFromMonoType
- Stronger assertions in MonoDelegate and MonoObject tests
- MonoArray tests for numeric range validation, boolean writes, and unsafe 64-bit reads

### Changed
- Type system enhancements: replace `any` with `unknown`, improve unwrapInstance type checks, and tighten MonoField pointer handling
- Improved array type handling with wrapper-aware member access
- MonoArray setNumber/getNumber validate integer ranges, accept boolean inputs for Boolean arrays, and reject unsafe 64-bit reads/writes
- MonoArray getElement returns null for null references; setElement accepts null
- MonoObject toObject uses safe property definitions; member access respects readable, non-indexer properties and wraps array/delegate members when wrappers are registered
- MonoClass now caches methods and provides improved error hints for method/field/property lookups
- Test framework respects skipIfNoMono/timeout and preserves result metadata for reporting
- Test runner command execution refactor for readability
- package.json marks dist/index.js as sideEffects to avoid tree-shaking

### Fixed
- Delegate conversions now return MonoDelegate wrappers
- MonoDelegate constructor now uses the allocated method pointer for safer invocation
- MonoObject static member handling
- Field writes enforce numeric limits and apply GC write barriers
- Test runner fixes and improved access violation error handling

## [0.3.1] - 2025-12-24

### Added
- UTF-8 string caching for performance optimization in native API calls
- Unbounded cache support with improved edge case handling
- Circular reference detection in argument formatting for better debugging
- Test fixtures and validators for streamlined test infrastructure
- Comprehensive memoize decorator tests for edge cases

### Changed
- Consolidated test infrastructure with shared fixtures and validators
- Reorganized internal architecture for improved type safety
- Refactored pattern matching functions into dedicated utility module
- Enhanced lazy decorator implementation for better clarity and functionality
- Improved import organization across multiple modules for consistency
- Migrated utilities to domain objects for better encapsulation

### Fixed
- Enhanced test reliability with null checks before detaching functions
- Improved memory management and resource cleanup
- Better error handling and validation across test suite
- Added validity checks in MonoImage for name retrieval and class lookup

## [0.3.0] - 2025-12-13

### Added
- **IL2CPP-style Facade API**: Root entry now focuses on a single `Mono` facade with explicit lifecycle
  - `Mono.initialize()` waits for Mono module + root domain readiness
  - `Mono.perform()` is the recommended execution entry (thread attach/detach managed by `perform`)
  - `globalThis.Mono` installed by default on first `initialize/perform` (disable via `Mono.config.installGlobal = false` before first use)
- **Configuration surface**: `Mono.config` now supports module discovery + export aliasing + lifecycle tuning
  - `moduleName`, `exports`, `initializeTimeoutMs`, `warnAfterMs`, `logLevel`, `performMode`
- **Facade helpers for common tasks** (to avoid importing internal model statics)
  - `Mono.array.new`, `Mono.string.new`, `Mono.method.find`, `Mono.image.fromAssemblyPath`
- **Mono signature pipeline modernization**
  - **Export filtering by default**: signatures now default to DLL-exported APIs only
  - `scripts/generate-mono-signatures.ts` now supports CLI args: `--root`, `--include`, `--exclude`, `--out`
  - Manual signature additions moved to `data/include/mono-manual.h`
  - Uses minimatch for glob-based include/exclude patterns
- **Enhanced ThreadManager capabilities**
  - Detection of externally attached threads for improved attachment management
  - Better integration with Mono's native thread attachment mechanisms
- **GC handle management improvements**
  - Added v2 ABI support for garbage collector handles
  - Improved error handling and validation for GC operations
- **Lazy global installation**
  - Mono API now installs globally on first use for convenient console access
  - Configurable via `Mono.config.installGlobal` flag

### Changed
- **BREAKING**: Root entry no longer re-exports `runtime/`, `model/`, `utils/` runtime values
  - Consumers should use the `Mono` facade (types remain available as type-only exports)
- **BREAKING**: `Mono.perform()` is now async and returns a `Promise<T>`
  - Update call sites to `await Mono.perform(() => { ... })` (or otherwise handle the returned Promise)
- **BREAKING**: Many model APIs migrated from `getX()` methods to `@lazy` properties
  - Example: `klass.getFullName()` -> `klass.fullName`, `method.isStatic()` -> `method.isStatic`
- **BREAKING**: Search API consolidated into domain-centric approach
  - Removed `Mono.find` facade subsystem to reduce API surface complexity
  - All search operations now live on `MonoDomain` instances: `domain.findClasses()`, `domain.findMethods()`, `domain.findFields()`, `domain.findProperties()`
  - Replaced `domain.classExact()` with optimized `domain.tryClass()` for fast exact lookups
  - Assembly-specific fast-path optimizations for `System.*` and `UnityEngine.*` namespaces
- **Default signature generation** now filters by Unity Mono DLL exports
  - `npm run generate:signatures` -> exported-only (~559)
- Signature files consolidated into a single generated `src/runtime/signatures.ts`
- Lazy decorator implementation refactored for improved clarity and functionality
- Memory subsystem consolidated into `src/subsystems.ts` with unified facade builders
- MonoMethod now uses `api.runtimeInvoke` for `MakeGenericMethod` invocation with better exception handling
- Test suite size adjusted to 1,089 tests (from 1,104) after consolidating find-tools tests into mono-domain

### Removed
- **BREAKING**: `Mono.find` facade subsystem
  - Use `Mono.domain.findClasses()`, `Mono.domain.findMethods()`, etc. instead
- **BREAKING**: `domain.classExact()` method
  - Use `domain.tryClass()` for fast exact class lookups (same optimizations, cleaner API)
- Standalone `test-find-tools.ts` test file (consolidated into `test-mono-domain.ts`)
  - A compatibility shim remains for existing test runners

### Fixed
- Robust initialization and diagnostics
  - Wait-for-module + wait-for-root-domain readiness with timeout and warning thresholds
  - Standardized errors via `MonoErrorCodes` + `raise()` for clearer hints and typed handling
- API migration fixes in tests (method-call -> property-access) to restore compilation
- Improved validity checks in MonoImage for name retrieval and class lookup
- Enhanced test reliability with better null checks and error handling
- Memory management and resource cleanup improvements

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
  - `Mono.domain` - Search classes, methods, and fields by pattern (e.g. `domain.findClasses`, `domain.findMethods`)
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

- **0.3.2** - Type system enhancements, wrapper registration, field/array robustness, expanded tests, and test framework improvements
- **0.3.1** - Performance optimizations, test infrastructure consolidation, architecture improvements
- **0.3.0** - facade, async lifecycle, signature pipeline modernization
- **0.2.2** - Bundled declarations, improved package structure
- **0.2.1** - esbuild-based bundling
- **0.2.0** - ES module support, resilient method interception, utility consolidation
- **0.1.0** - Initial public release

[Unreleased]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/doyaGu/frida-mono-bridge/compare/0.2.2...v0.3.0
[0.2.2]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.2.1...0.2.2
[0.2.1]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/doyaGu/frida-mono-bridge/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/doyaGu/frida-mono-bridge/releases/tag/v0.1.0

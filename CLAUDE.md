# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frida Mono Bridge is a TypeScript bridge for instrumenting Mono/.NET runtimes (Unity, Xamarin, embedded Mono) with Frida. It provides a high-level, fluent API for interacting with .NET assemblies, classes, methods, and objects from JavaScript.

## Development Commands

### Core Build Commands
```bash
npm run build              # Build main agent to dist/agent.js
npm run watch              # Build with file watching (development)
npm run lint               # TypeScript type checking
npm test                   # Compile test suite to dist/tests.js
npm run clean              # Remove dist/ directory
```

### Testing
```bash
# Compile tests (builds to dist/tests.js)
npm test

# Run tests against a Mono process
frida -n "TargetProcess.exe" -l dist/tests.js
```

## Architecture

### Core Structure
```
src/
├── index.ts          # Main entry point, exports Mono as default
├── mono.ts           # MonoNamespace class - primary API surface
├── runtime/          # Low-level Mono runtime access
│   ├── api.ts        # MonoApi class - function resolution and bindings
│   ├── guard.ts      # ThreadManager - automatic thread attachment
│   ├── module.ts     # Mono module detection and discovery
│   ├── signatures/   # Mono API function signatures and enums
│   │   ├── generated.ts  # Auto-generated signatures
│   │   ├── manual.ts      # Manual signature definitions
│   │   └── types.ts       # Signature type definitions
│   ├── version.ts    # Runtime version detection
│   ├── metadata.ts   # Metadata table access
│   ├── gchandle.ts   # GC handle management
│   ├── icall.ts      # Internal call registration
│   └── ...
├── model/            # High-level object model
│   ├── base.ts       # MonoHandle - base class for all Mono objects
│   ├── domain.ts     # MonoDomain - application domains
│   ├── assembly.ts   # MonoAssembly - .NET assemblies
│   ├── image.ts      # MonoImage - assembly metadata
│   ├── class.ts      # MonoClass - .NET classes
│   ├── method.ts     # MonoMethod - .NET methods
│   ├── field.ts      # MonoField - .NET fields
│   ├── delegate.ts   # MonoDelegate - delegate handling
│   ├── array.ts      # MonoArray - array operations
│   ├── string.ts     # MonoString - string operations
│   ├── object.ts     # MonoObject - object operations
│   ├── property.ts   # MonoProperty - property access
│   ├── type.ts       # Type system and metadata
│   ├── collections.ts # Collection utilities
│   └── ...
└── utils/            # Utilities and helpers
    ├── find.ts       # Search utilities (wildcard patterns)
    ├── trace.ts      # Method tracing and hooking
    ├── log.ts        # Logger class
    ├── cache.ts      # LRU caching utilities
    ├── gc.ts         # Garbage collection utilities
    ├── types.ts      # Type system helpers
    ├── validation.ts # Input validation
    ├── errors.ts     # Structured error handling
    ├── batch.ts      # Batch operations
    ├── retry.ts      # Retry logic
    ├── safe-access.ts # Safe property access
    ├── thread-context.ts # Thread context management
    └── ...
```

### Key Architecture Concepts

#### MonoNamespace (Primary API)
- **Entry Point**: Main class accessed via `import Mono from "./src"`
- **Fluent API**: Provides properties like `Mono.domain`, `Mono.api`, `Mono.gc`, `Mono.find`, `Mono.trace`, `Mono.types`
- **Thread Management**: `Mono.perform(callback)` ensures thread attachment
- **Lazy Initialization**: Runtime components initialized on first access
- **Utility Support**: Built-in utilities for common operations and error handling

#### ThreadManager (runtime/thread.ts)
- **Automatic Attachment**: Manages Mono thread attachment/detachment
- **Nested Call Prevention**: Tracks active attachments to avoid redundant operations
- **Thread Safety**: Each MonoApi instance has its own ThreadManager

#### MonoApi (runtime/api.ts)
- **Function Resolution**: Discovers Mono exports with fallback strategies
- **LRU Caching**: Caches resolved function pointers for performance
- **Error Handling**: Custom error types for function resolution and managed exceptions
- **Signature Management**: Generated and manual Mono API signatures

#### Utility System (src/utils/)
- **Error Handling**: Structured error types with MonoError hierarchy
- **Batch Operations**: Efficient processing of multiple operations via BatchOperation
- **Retry Logic**: RetryOperation for operations that might fail temporarily
- **Safe Operations**: SafePropertyAccess for safe property/method access
- **Method Invocation**: MethodInvocation class for safe method execution

#### Model Hierarchy
- **Domain → Assembly → Image → Class → Method/Field**
- **Inheritance**: All model classes extend MonoHandle for pointer management
- **Type Safety**: Comprehensive TypeScript definitions with generic type parameters
- **Rich Metadata**: Full access to Mono runtime metadata and type information

## API Patterns

### Modern Fluent API (Recommended)
```typescript
import Mono from "./src";

// Always use perform() for automatic thread management
Mono.perform(() => {
  const domain = Mono.domain;
  const assembly = domain.assembly("Assembly-CSharp");
  const playerClass = assembly.image.class("Game", "Player");
  const method = playerClass.method("Say", 1);
  method.invoke(null, ["Hello"]);
});
```

### Direct Module Imports
```typescript
import Mono from "./src";
import { MonoImage, MonoMethod } from "./src/model";
import { Logger } from "./src/utils";

Mono.perform(() => {
  const image = MonoImage.fromAssemblyPath(Mono.api, path);
  const method = MonoMethod.find(Mono.api, image, "Class:Method(args)");
  const logger = new Logger({ tag: "Script" });
  logger.info("Method invoked");
});
```

### Utility-Based Operations
```typescript
import { BatchOperation, MethodInvocation, withErrorHandling } from "./src/utils";

// Safe method invocation with built-in error handling
const method = playerClass.method("TakeDamage", 1);
const invocation = new MethodInvocation(method, instance, [damage]);
const result = invocation.safeExecute("player damage calculation");

// Batch operations for efficiency
const batch = new BatchOperation();
batch.add(() => player.method("Update").invoke(player, []));
batch.add(() => player.method("Render").invoke(player, []));
const results = batch.executeAll("player frame update");

// Error handling wrapper
const safeMethod = withErrorHandling(
  (damage: number) => player.takeDamage(damage),
  "player damage calculation"
);
```

## Testing Structure

The test suite has **187 tests** across 23 test files organized into:
- **Core Infrastructure** (69 tests): Module detection, API availability, logging
- **Runtime Management** (26 tests): Thread management, domains, GC handles
- **Model Operations** (40 tests): Assemblies, classes, methods, fields
- **Feature Tests** (30+ tests): Delegates, internal calls, metadata
- **Integration Tests** (22+ tests): Real-world scenarios

Key test files:
- `tests/index.ts` - Main test orchestrator
- `tests/test-framework.ts` - Test utilities and framework
- `tests/test-api.ts` - Core API functionality (60 tests)


## TypeScript Configuration

- **Strict Mode**: Enabled with comprehensive type checking
- **Module System**: ESNext with bundler resolution
- **Target**: ES2020 for modern JavaScript features
- **Types**: Custom type definitions in `types/` plus frida-gum and node

## Performance Features

- **LRU Caching**: Function cache (256), address cache (512), thunk cache (128)
- **Lazy Initialization**: Runtime components loaded on-demand
- **Smart Resolution**: Export discovery with multiple fallback strategies
- **Native Thunks**: High-performance delegate invocation

## Common Development Patterns

When working with this codebase:

1. **Always use Mono.perform()** for any Mono operations to ensure thread safety
2. **Import directly from modules** rather than using Mono.model.* namespace access
3. **Use Logger class** for logging instead of console methods
4. **Follow the model hierarchy**: Domain → Assembly → Image → Class → Method
5. **Handle errors gracefully** with try/catch blocks, especially for method invocation
6. **Use proper TypeScript types** - the codebase is strictly typed for safety

## Important Notes

- The main API is accessed through the default export: `import Mono from "./src"`
- All Mono operations must be wrapped in `Mono.perform()` for thread safety
- The codebase maintains backward compatibility but modern utilities are preferred
- Use utilities from `src/utils/` for common operations and error handling
- The test suite validates functionality against real Mono runtimes
- Built-in search utilities (`Mono.find`) support wildcards and pattern matching
- Tracing utilities (`Mono.trace`) provide powerful hooking capabilities
- Type utilities (`Mono.types`) handle boxing, unboxing, and type operations
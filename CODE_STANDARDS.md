# Frida Mono Bridge - Code Standards and Organization

## Table of Contents

1. [File Organization](#file-organization)
2. [Naming Conventions](#naming-conventions)
3. [Import/Export Standards](#importexport-standards)
4. [TypeScript Standards](#typescript-standards)
5. [Documentation Standards](#documentation-standards)
6. [Error Handling Standards](#error-handling-standards)
7. [Testing Standards](#testing-standards)
8. [Performance Standards](#performance-standards)

## File Organization

### Directory Structure

```
src/
├── index.ts                    # Main entry point
├── mono.ts                     # Core MonoNamespace class
├── runtime/                    # Low-level Mono runtime access
│   ├── api.ts                 # MonoApi - core API wrapper
│   ├── guard.ts               # ThreadManager - thread safety
│   ├── module.ts              # Mono module detection
│   ├── signatures.ts          # API function signatures
│   └── index.ts               # Runtime exports
├── model/                      # High-level object model
│   ├── base.ts                # Base MonoHandle class
│   ├── domain.ts              # MonoDomain - app domains
│   ├── assembly.ts            # MonoAssembly - .NET assemblies
│   ├── image.ts               # MonoImage - assembly metadata
│   ├── class.ts               # MonoClass - .NET classes
│   ├── method.ts              # MonoMethod - .NET methods
│   ├── field.ts               # MonoField - .NET fields
│   ├── delegate.ts            # MonoDelegate - delegate handling
│   ├── object.ts              # MonoObject - object wrapper
│   ├── array.ts               # MonoArray - array operations
│   ├── string.ts              # MonoString - string operations
│   ├── type.ts                # MonoType - type information
│   ├── property.ts            # MonoProperty - property access
│   ├── method-signature.ts    # Method signature utilities
│   ├── collections.ts         # Collection utilities
│   ├── metadata.ts            # Metadata helpers
│   ├── signature-infer.ts     # Signature inference
│   └── index.ts               # Model exports
├── utils/                      # Utilities and helpers
│   ├── log.ts                 # Logger class
│   ├── type-guards.ts         # Type validation functions
│   ├── constants.ts           # Centralized constants
│   ├── common-utilities.ts    # Shared utility functions
│   ├── find.ts                # Search and discovery utilities
│   ├── trace.ts               # Method tracing and hooking
│   ├── types-helper.ts        # Type conversion helpers
│   ├── gc.ts                  # Garbage collection utilities
│   ├── validation.ts          # Input validation
│   ├── thread-context.ts      # Thread context management
│   ├── lazy.ts                # Lazy initialization
│   ├── cache.ts               # Caching utilities
│   ├── interceptor.ts         # Method interception
│   ├── watcher.ts             # File/directory watching
│   ├── native-bridge.ts       # Native bridge utilities
│   ├── lru-cache.ts           # LRU cache implementation
│   ├── probe.ts               # Runtime probing
│   ├── types.ts               # Type definitions
│   └── index.ts               # Utils exports
├── patterns/                   # Common operation patterns
│   ├── common.ts              # Reusable operation patterns
│   ├── errors.ts              # Error handling utilities
│   └── index.ts               # Pattern exports
└── legacy/                     # (Optional) Legacy compatibility
    ├── compat.ts              # Legacy compatibility layer
    └── index.ts               # Legacy exports
```

### File Naming Rules

1. **Use kebab-case for directories**: `thread-context`, `type-guards`
2. **Use kebab-case for utility files**: `common-utilities.ts`, `type-guards.ts`
3. **Use PascalCase for core classes**: `MonoDomain.ts`, `MonoMethod.ts`
4. **Use lowercase for index files**: `index.ts`
5. **Keep file names descriptive and concise**

### File Size Guidelines

- **Core files** (mono.ts, api.ts): 100-300 lines
- **Model classes**: 100-500 lines
- **Utility files**: 50-200 lines
- **Pattern files**: 100-300 lines
- **Index files**: 10-50 lines (exports only)

If a file exceeds these guidelines, consider splitting it.

## Naming Conventions

### Classes and Interfaces

```typescript
// Classes: PascalCase, descriptive names
export class MonoDomain { }
export class ThreadManager { }
export class PerformanceTimer { }

// Interfaces: PascalCase, often start with I
export interface MonoHandle { }
export interface LoggerOptions { }
export interface IMonoApi { }
```

### Functions and Methods

```typescript
// Functions: camelCase, descriptive verbs
export function createMonoApi(module: MonoModuleInfo): MonoApi { }
export function validateString(value: string): boolean { }

// Methods: camelCase, action-oriented
public perform<T>(callback: () => T): T { }
public safeExecute(context: string): T | null { }

// Private methods: camelCase, prefixed with underscore if needed
private ensureInitialized(): void { }
private logInternal(level: LogLevel, message: string): void { }
```

### Variables and Properties

```typescript
// Constants: UPPER_SNAKE_CASE
export const MONO_TYPE_KIND = { ... };
export const ERROR_MESSAGES = { ... };

// Private properties: camelCase, prefixed with underscore
private _api: MonoApi;
private _initialized: boolean;

// Public properties: camelCase, descriptive
public readonly handle: NativePointer;
public domain: MonoDomain;

// Local variables: camelCase, descriptive
const assemblyName = "Assembly-CSharp";
const methodSignature = "Class:Method(Type,Type)";
```

### Enums and Types

```typescript
// Enums: PascalCase
export enum LogLevel { Debug, Info, Warn, Error }
export enum MonoTypeKind { Object, String, Array, ... }

// Type aliases: PascalCase, descriptive
export type MonoResult<T> = { success: true; data: T } | { success: false; error: MonoError };
export type MethodArgument = any; // Generic but clear
```

## Import/Export Standards

### Import Organization

```typescript
// 1. External imports (node_modules)
import { NativePointer } from "frida-gum";
import fs from "fs";

// 2. Internal imports - use path mapping
import { MonoApi } from "@/runtime/api";
import { Logger } from "@/utils/log";
import { MonoOperation } from "@/patterns/common";

// 3. Relative imports (only for very local files)
import { HelperClass } from "./helper-class";
```

### Export Organization

```typescript
// index.ts files - organized by category

// Core exports
export { Mono, MonoNamespace } from "./mono";

// Runtime exports
export * from "./runtime/index";

// Model exports
export * from "./model/index";

// Utility exports
export * from "./utils/index";

// Pattern exports
export * from "./patterns/index";
```

### Re-export Standards

```typescript
// Use re-exports for public APIs
export * from "./api";          // Good - clear source
export { Api as MonoApi } from "./api";  // Good - explicit naming

// Avoid selective re-exports unless necessary
export { MonoApi, ThreadManager } from "./api";  // Only for specific cases
```

## TypeScript Standards

### Type Safety

```typescript
// Use specific types, not 'any'
export function processMethod(method: MonoMethod): void { }  // Good
export function processMethod(method: any): void { }        // Bad

// Use generics for type-safe operations
export class MonoArray<T> { }  // Good
export class MonoArray { }     // Less safe

// Use union types for multiple possibilities
export type LogLevel = "debug" | "info" | "warn" | "error";  // Good
```

### Interface Design

```typescript
// Interfaces for configurations
export interface LoggerOptions {
  level?: LogLevel;
  tag?: string;
}

// Interfaces for complex return types
export interface AssemblyInfo {
  name: string;
  image: MonoImage;
  classes?: MonoClass[];
}

// Use readonly for immutable data
export interface ImmutableConfig {
  readonly maxRetries: number;
  readonly timeout: number;
}
```

### Strict Type Checking

```typescript
// Enable strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true
  }
}

// Use type assertions sparingly
const pointer = value as NativePointer;  // Only when necessary
const pointer = <NativePointer>value;   // Alternative syntax
```

## Documentation Standards

### JSDoc Format

```typescript
/**
 * Brief description of the class/function
 *
 * More detailed description if needed. Explain the purpose,
 * usage patterns, and any important considerations.
 *
 * @example
 * ```typescript
 * // Usage example
 * Mono.perform(() => {
 *   const result = SomeClass.someMethod();
 *   console.log(result);
 * });
 * ```
 *
 * @param paramName Description of parameter
 * @returns Description of return value
 * @throws {MonoError} Description of when this error is thrown
 * @since 0.1.0
 * @deprecated Use alternative method instead
 * @see SomeOtherClass for related functionality
 */
export function exampleFunction(param: string): string {
  return param;
}
```

### Class Documentation

```typescript
/**
 * Brief description of the class purpose
 *
 * This class provides functionality for...
 * Important usage patterns:
 * 1. Always use perform() for thread safety
 * 2. Call dispose() when done
 *
 * @example
 * ```typescript
 * const instance = new ExampleClass(api, handle);
 * instance.someMethod();
 * ```
 */
export class ExampleClass {
  /**
   * Constructor description
   * @param api Mono API instance
   * @param handle Native pointer to object
   */
  constructor(api: MonoApi, handle: NativePointer) {
    // Implementation
  }
}
```

### Module Documentation

```typescript
/**
 * @fileoverview Brief description of the module
 *
 * This module contains utilities for...
 * Main exports:
 * - Logger: Logging functionality
 * - LogLevel: Log level enumeration
 *
 * @author Your Name
 * @version 1.0.0
 * @since 0.1.0
 */
```

## Error Handling Standards

### Error Types

```typescript
// Use specific error types
export class MonoMethodError extends MonoError { }
export class MonoAssemblyError extends MonoError { }

// Include context information
throw new MonoMethodError(
  "Method invocation failed",
  "Player.TakeDamage",
  "Game.Player",
  originalError
);
```

### Error Patterns

```typescript
// Safe operation patterns
export function safeOperation(): ResultType | null {
  try {
    return riskyOperation();
  } catch (error) {
    Logger.error("Operation failed", error);
    return null;
  }
}

// Result types instead of exceptions
export function operationWithResult(): MonoResult<Data> {
  try {
    return { success: true, data: riskyOperation() };
  } catch (error) {
    return { success: false, error: handleMonoError(error) };
  }
}
```

### Logging Standards

```typescript
// Use Logger class, not console
const logger = Logger.withTag("MyFeature");

logger.debug("Starting operation", { context: "data" });
logger.info("Operation completed");
logger.warn("Unexpected situation", { details });
logger.error("Operation failed", error);

// Include context in error messages
throw new Error(`Failed to load assembly "${name}": ${error.message}`);
```

## Testing Standards

### Test Structure

```typescript
// Test file naming: *.test.ts or *.spec.ts
// Location: Same directory as source file or tests/ directory

describe("MonoClass", () => {
  describe("constructor", () => {
    it("should create instance with valid handle", () => {
      // Test implementation
    });

    it("should throw error with null handle", () => {
      // Test error cases
    });
  });

  describe("method lookup", () => {
    it("should find existing method", () => {
      // Test success cases
    });

    it("should return null for non-existent method", () => {
      // Test failure cases
    });
  });
});
```

### Test Patterns

```typescript
// Arrange-Act-Assert pattern
it("should invoke method with correct arguments", () => {
  // Arrange
  const mockApi = createMockApi();
  const instance = new TestClass(mockApi, handle);
  const expectedArgs = ["test", 123];

  // Act
  const result = instance.someMethod(...expectedArgs);

  // Assert
  expect(result).toBeDefined();
  expect(mockApi.someFunction).toHaveBeenCalledWith(...expectedArgs);
});

// Test error conditions
it("should handle errors gracefully", () => {
  const instance = new TestClass(mockApi, invalidHandle);

  expect(() => instance.riskyOperation()).toThrow(MonoError);
});
```

## Performance Standards

### Memory Management

```typescript
// Use Mono.perform() for automatic cleanup
Mono.perform(() => {
  const temporaryObjects = [];
  // Use objects
  // Automatic cleanup when perform() completes
});

// Manual cleanup when needed
const resources = new Set<Disposable>();
try {
  // Use resources
} finally {
  resources.forEach(resource => resource.dispose());
}
```

### Caching Patterns

```typescript
// Cache expensive operations
private static readonly methodCache = new Map<string, MonoMethod>();

public getMethod(name: string): MonoMethod | null {
  const cacheKey = `${this.className}.${name}`;
  return this.methodCache.get(cacheKey) ??
    this.findAndCacheMethod(name, cacheKey);
}
```

### Performance Monitoring

```typescript
// Use performance timers for critical paths
const timer = new PerformanceTimer();
try {
  // Operation
} finally {
  const duration = timer.elapsedMs();
  if (duration > PERFORMANCE_THRESHOLDS.SLOW_OPERATION) {
    Logger.warn(`Slow operation detected: ${duration}ms`);
  }
}
```

## Code Review Checklist

### Before Submitting Code

- [ ] **TypeScript**: All types are strict, no `any` types unless necessary
- [ ] **Documentation**: All public APIs have JSDoc comments
- [ ] **Error Handling**: Proper error types and context information
- [ ] **Logging**: Use Logger class, not console methods
- [ ] **Thread Safety**: All Mono operations in `Mono.perform()`
- [ ] **Performance**: No obvious performance issues or memory leaks
- [ ] **Tests**: New functionality has appropriate tests
- [ ] **Imports**: Correct import organization and path mapping
- [ ] **Naming**: Follow naming conventions consistently
- [ ] **File Size**: Files within reasonable size limits

### Common Issues to Avoid

- **Using `console.log` instead of Logger**
- **Throwing plain strings instead of Error objects**
- **Missing JSDoc comments on public APIs**
- **Using `any` type instead of specific types**
- **Forgetting thread safety in Mono operations**
- **Not handling error conditions**
- **Large files that should be split**
- **Inconsistent naming patterns**
- **Missing or inadequate tests**

This standards document ensures consistency and maintainability across the Frida Mono Bridge codebase. Following these guidelines helps create high-quality, maintainable code that is easy to understand and extend.
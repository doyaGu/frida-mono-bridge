# Frida Mono Bridge - Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [API Usage Patterns](#api-usage-patterns)
4. [Error Handling](#error-handling)
5. [Type Safety](#type-safety)
6. [Performance Considerations](#performance-considerations)
7. [Common Patterns](#common-patterns)
8. [Testing and Debugging](#testing-and-debugging)
9. [Contributing](#contributing)

## Getting Started

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd frida-mono-bridge

# Install dependencies
npm install

# Build the project
npm run build

```

### Basic Usage

```typescript
import Mono from "@/index";

// Always wrap Mono operations in perform() for thread safety
Mono.perform(() => {
  const domain = Mono.domain;
  const assembly = domain.assembly("Assembly-CSharp");
  const playerClass = assembly.image.class("Game.Player");

  if (playerClass) {
    console.log(`Found class: ${playerClass.name}`);
    console.log(`Methods: ${playerClass.methods.length}`);
  }
});
```

## Architecture Overview

### Core Components

```
src/
├── index.ts              # Main entry point
├── mono.ts               # MonoNamespace - fluent API
├── runtime/              # Low-level Mono runtime access
│   ├── api.ts           # MonoApi - function resolution
│   ├── guard.ts         # ThreadManager - thread safety
│   ├── module.ts        # Mono module detection
│   └── ...
├── model/                # High-level object model
│   ├── domain.ts        # MonoDomain - application domains
│   ├── assembly.ts      # MonoAssembly - .NET assemblies
│   ├── class.ts         # MonoClass - .NET classes
│   ├── method.ts        # MonoMethod - .NET methods
│   └── ...
├── utils/                # Utilities and helpers
│   ├── log.ts           # Logger class
│   ├── type-guards.ts   # Type validation
│   ├── constants.ts     # Centralized constants
│   └── ...
└── patterns/             # Common operation patterns
    ├── common.ts        # Reusable operations
    └── errors.ts        # Error handling utilities
```

### Design Principles

1. **Thread Safety First**: All operations must be wrapped in `Mono.perform()`
2. **Fluent API**: Discoverable, chainable method calls
3. **Type Safety**: Comprehensive TypeScript definitions
4. **Error Resilience**: Graceful error handling throughout
5. **Performance Optimized**: Caching and efficient patterns

## API Usage Patterns

### Modern Fluent API (Recommended)

```typescript
import Mono from "@/index";

Mono.perform(() => {
  // Domain → Assembly → Image → Class → Method/Field
  const domain = Mono.domain;
  const assembly = domain.assembly("Assembly-CSharp");
  const image = assembly.image;
  const playerClass = image.class("Game.Player");

  // Static method invocation
  const getInstance = playerClass.method("GetInstance", 0);
  const instance = getInstance.invoke(null, []);

  // Instance method invocation
  const takeDamage = playerClass.method("TakeDamage", 1);
  takeDamage.invoke(instance, [100]);
});
```

### Advanced Usage with Patterns

```typescript
import { MonoOperation, BatchOperation, withErrorHandling } from "@/patterns";

// Safe operation with built-in error handling
const operation = new MethodInvocation(method, instance, args);
const result = operation.safeExecute("player damage calculation");

// Batch operations for efficiency
const batch = new BatchOperation();
batch.add(() => method1.invoke(instance1, []));
batch.add(() => method2.invoke(instance2, []));
const results = batch.executeAll("batch player updates");

// Error handling wrapper
const safeMethod = withErrorHandling(
  () => riskyMethod.invoke(instance, args),
  "critical game operation"
);
```

### Direct API Access (Advanced)

```typescript
import Mono, { MonoApi, MonoDomain } from "@/index";

Mono.perform(() => {
  const api: MonoApi = Mono.api;
  const domain: MonoDomain = Mono.domain;

  // Direct API access for maximum control
  const rootDomain = api.getRootDomain();
  const assemblies = api.domainGetAssemblies(rootDomain);

  // Manual thread management (not recommended)
  api._threadManager.withAttachedThread(() => {
    // Low-level operations
  });
});
```

## Error Handling

### Structured Error Types

```typescript
import {
  MonoError,
  MonoMethodError,
  MonoAssemblyError,
  handleMonoError
} from "@/patterns";

try {
  // Mono operations
} catch (error) {
  const monoError = handleMonoError(error, "method invocation");
  console.error(monoError.getFullDescription());
}
```

### Result Types

```typescript
import { asResult, MonoResult } from "@/patterns";

const operation = asResult(
  () => riskyMethod.invoke(instance, args),
  "method invocation"
);

const result: MonoResult<any> = operation();
if (result.success) {
  console.log("Success:", result.data);
} else {
  console.error("Error:", result.error.message);
}
```

### Safe Operations

```typescript
import { MonoOperation } from "@/patterns";

class PlayerDamageOperation extends MonoOperation<number> {
  constructor(private player: any, private damage: number) {
    super();
  }

  protected execute(): number {
    const healthMethod = this.player.method("TakeDamage", 1);
    return healthMethod.invoke(this.player, [this.damage]);
  }
}

const operation = new PlayerDamageOperation(player, 50);
const result = operation.safeExecute("player damage");
```

## Type Safety

### Type Guards

```typescript
import {
  isMonoClass,
  isMonoMethod,
  isMonoHandle,
  validateRequired,
  validateString
} from "@/utils";

if (isMonoClass(value)) {
  // TypeScript knows value has methods, fields arrays
  console.log(value.methods.length);
}

// Runtime validation
const assemblyName = validateString(name, "assembly name", {
  minLength: 1,
  pattern: /^[a-zA-Z][a-zA-Z0-9._]*$/
});
```

### Generic Type Parameters

```typescript
// Strongly typed method invocation
const getStringMethod = playerClass.method<string>("GetName", 0);
const name: string = getStringMethod.invoke(instance, []);

// Array operations with type safety
const items = playerClass.method<MonoArray<string>>("GetItems", 0);
const stringArray: MonoArray<string> = items.invoke(instance, []);
```

## Performance Considerations

### Caching

```typescript
// Method lookups are cached automatically
const method = playerClass.method("Update"); // Cached after first lookup

// Manual caching for expensive operations
const cache = new Map<string, any>();
const cachedMethod = cache.get("player.update") ??
  playerClass.method("Update");
cache.set("player.update", cachedMethod);
```

### Batch Operations

```typescript
// Efficient batch processing
const batch = new BatchOperation();
players.forEach(player => {
  batch.add(() => player.method("Update").invoke(player, []));
});
const results = batch.executeAll("player batch update");
```

### Memory Management

```typescript
// Let GC handle cleanup when thread detaches
Mono.perform(() => {
  const tempObjects = [];
  // Use objects
  // Automatic cleanup when perform() completes
});

// Manual cleanup when needed
Mono.gc.releaseAll();
Mono.dispose();
```

## Common Patterns

### Finding Classes and Methods

```typescript
import { COMMON_ASSEMBLIES, UNITY_CLASSES } from "@/utils";

Mono.perform(() => {
  // Common Unity patterns
  const unityAssembly = Mono.domain.assembly(COMMON_ASSEMBLIES.UNITY_CORE_MODULE);
  const gameObjectClass = unityAssembly.image.class(UNITY_CLASSES.GAME_OBJECT);

  // Pattern matching for method names
  const methods = playerClass.methods.filter(method =>
    method.name.startsWith("get_") || method.name.startsWith("set_")
  );
});
```

### Property Access

```typescript
// Getters and setters follow naming pattern
const healthGetter = playerClass.method("get_Health", 0);
const healthSetter = playerClass.method("set_Health", 1);

const currentHealth = healthGetter.invoke(instance, []);
healthSetter.invoke(instance, [currentHealth + 10]);
```

### Event Handling

```typescript
// Unity event patterns
const onClick = buttonClass.method("add_Click", 1);
const handler = Interceptor.attach(targetPtr, {
  onEnter: function(args) {
    Mono.perform(() => {
      // Handle event in Mono context
    });
  }
});
onClick.invoke(buttonInstance, [handler]);
```

### Thread-Safe Operations

```typescript
import { ThreadContext } from "@/utils";

// Always use Mono.perform() for thread safety
Mono.perform(() => {
  // Safe to call Mono operations here
});

// For advanced scenarios
ThreadContext.maybeExecute(api, () => {
  // Executes with or without thread attachment
});
```

## Testing and Debugging

### Debug Logging

```typescript
import { Logger } from "@/utils";

const logger = Logger.withTag("MyFeature");
logger.debug("Starting operation", { playerId: 123 });

// Static methods
Logger.info("Operation completed successfully");
Logger.error("Operation failed", error);
```

### Error Tracing

```typescript
import { createError, PerformanceTimer } from "@/utils";

const timer = new PerformanceTimer();

try {
  // Operation
} catch (error) {
  const detailedError = createError(
    "Operation failed",
    {
      duration: timer.elapsedMs(),
      playerId: 123,
      method: "TakeDamage"
    },
    error as Error
  );
  Logger.error(detailedError.message);
}
```

### Development Tools

```bash
# Build with source maps for debugging
npm run build

# Type checking
npm run lint


# Clean build
npm run clean && npm run build
```

## Contributing

### Code Standards

1. **TypeScript**: Strict mode enabled, comprehensive types
2. **Error Handling**: Use structured error types, never throw plain strings
3. **Logging**: Use Logger class, not console methods
4. **Thread Safety**: Always wrap Mono operations in `Mono.perform()`
5. **Documentation**: Comprehensive JSDoc comments

### Adding New Features

1. **Model Classes**: Extend `MonoHandle` for new object types
2. **Runtime Functions**: Add to `MonoApi` with proper error handling
3. **Utilities**: Add to appropriate utils module with tests
4. **Patterns**: Create reusable patterns in `src/patterns/`

### Example Structure

```typescript
/**
 * Brief description of the feature
 *
 * @example
 * ```typescript
 * Mono.perform(() => {
 *   const result = newFeature.someMethod();
 *   console.log(result);
 * });
 * ```
 *
 * @throws {MonoError} When operation fails
 * @since 0.1.0
 */
export class NewFeature extends MonoHandle {
  constructor(api: MonoApi, handle: NativePointer) {
    super(api, handle);
  }

  /**
   * Method description
   * @param param Description
   * @returns Return value description
   */
  someMethod(param: string): any {
    return this.perform(() => {
      // Implementation
    });
  }
}
```

### Performance Guidelines

1. **Cache Method Lookups**: Store frequently used methods
2. **Batch Operations**: Group multiple operations
3. **Avoid Memory Leaks**: Use `Mono.perform()` for automatic cleanup
4. **Profile**: Use performance timers for critical paths

### Testing Guidelines

1. **Thread Safety**: Test operations in different thread contexts
2. **Error Cases**: Test all error conditions
3. **Type Safety**: Use type guards and validation
4. **Integration**: Test with real Mono runtimes

## Best Practices Summary

1. **Always use `Mono.perform()`** for thread safety
2. **Use structured error handling** with proper error types
3. **Leverage caching** for expensive operations
4. **Follow naming conventions** consistently
5. **Add comprehensive documentation** to public APIs
6. **Test error conditions** and edge cases
7. **Use type guards** for runtime validation
8. **Monitor performance** with timing utilities
9. **Handle cleanup** properly to prevent memory leaks
10. **Log appropriately** with structured logging

This guide provides a comprehensive foundation for working with Frida Mono Bridge. See inline documentation throughout the codebase for usage patterns.
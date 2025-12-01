# Frida Mono Bridge - Comprehensive Guide

A powerful TypeScript bridge for instrumenting Mono/.NET runtimes with Frida, inspired by frida-il2cpp-bridge.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Examples](#examples)
6. [Advanced Usage](#advanced-usage)
7. [Troubleshooting](#troubleshooting)
8. [API Reference](#detailed-api-reference)

---

## Overview

Frida Mono Bridge provides a high-level, fluent API for interacting with Mono/.NET runtimes through Frida. It offers:

- **Modern Fluent API**: Chainable, discoverable API similar to frida-il2cpp-bridge
- **Thread Management**: Automatic thread attachment and management
- **Memory Safety**: Built-in garbage collection and memory management
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Rich Utilities**: Logging, tracing, metadata exploration, and more
- **Clean Architecture**: Modern ES6 modules with proper imports/exports

### Key Features

- **Runtime Exploration**: Discover assemblies, classes, methods, and fields
- **Method Hooking**: Intercept and modify method calls
- **Object Manipulation**: Create, read, and modify .NET objects
- **Thread Safety**: Automatic Mono thread management
- **Metadata Access**: Complete access to Mono metadata tables
- **Internal Calls**: Register native functions for .NET callbacks

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Frida](https://frida.re/) (v16 or higher)
- Target application using Mono/.NET runtime

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/frida-mono-bridge.git
   cd frida-mono-bridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests to verify**
   ```bash
   npm test
   ```

---

## Quick Start

### Basic Usage

```typescript
import Mono from "./src";

// Modern fluent API
Mono.perform(() => {
  // Access the current domain
  const domain = Mono.domain;

  // Find an assembly
  const gameAssembly = domain.assembly("Assembly-CSharp");
  if (!gameAssembly) {
    console.log("Assembly-CSharp not found");
    return;
  }

  // Find a class
  const PlayerClass = gameAssembly.image.class("Game.Player");
  if (!PlayerClass) {
    console.log("Game.Player class not found");
    return;
  }

  // Find and invoke a method
  const sayMethod = PlayerClass.method("Say", 1); // 1 parameter
  if (sayMethod) {
    sayMethod.invoke(null, ["Hello from Frida!"]);
  }

  // Read a static field
  const nameField = PlayerClass.field("playerName");
  if (nameField) {
    const name = nameField.readStaticValue();
    console.log(`Player name: ${name}`);
  }
});
```

### Hooking Methods

```typescript
import Mono from "./src";

Mono.perform(() => {
  const PlayerClass = Mono.domain.class("Game.Player");
  const takeDamageMethod = PlayerClass.method("TakeDamage", 1);

  if (takeDamageMethod) {
    Mono.trace.method(takeDamageMethod, {
      onEnter(args) {
        console.log(`→ Player taking damage: ${args[0]}`);
      },
      onLeave(retval) {
        console.log(`← Player health after damage: ${retval}`);
      }
    });
  }
});
```

---

## API Reference

### Core Namespace

#### `Mono`

The main entry point for all Mono operations.

**Properties:**
- `domain: MonoDomain` - Current application domain
- `api: MonoApi` - Low-level Mono API
- `module: MonoModuleInfo` - Mono module information
- `version: MonoRuntimeVersion` - Runtime version info
- `gc: GCUtilities` - Garbage collection utilities
- `find: typeof Find` - Search utilities
- `trace: typeof Trace` - Tracing utilities
- `types: typeof Types` - Type utilities

**Methods:**
- `perform<T>(callback: () => T): T` - Execute with thread attachment
- `dispose(): void` - Clean up resources

### Domain Operations

#### `MonoDomain`

Represents a Mono application domain.

**Methods:**
- `getAssemblies(): MonoAssembly[]` - Get all assemblies
- `assembly(name: string): MonoAssembly | null` - Find assembly by name
- `class(name: string): MonoClass | null` - Find class across all assemblies

### Assembly Operations

#### `MonoAssembly`

Represents a .NET assembly.

**Methods:**
- `getName(): string` - Get assembly name
- `getVersion(): Version` - Get assembly version
- `getImage(): MonoImage` - Get assembly image
- `getEntryPoint(): MonoMethod | null` - Get entry point method

### Image Operations

#### `MonoImage`

Represents an assembly image (metadata).

**Methods:**
- `getName(): string` - Get image name
- `classFromName(namespace: string, name: string): MonoClass | null` - Find class
- `getClasses(): MonoClass[]` - Get all classes

### Class Operations

#### `MonoClass`

Represents a .NET class.

**Properties:**
- `name: string` - Class name
- `namespace: string` - Class namespace
- `fullName: string` - Full class name
- `methods: MonoMethod[]` - All methods
- `fields: MonoField[]` - All fields
- `properties: MonoProperty[]` - All properties

**Methods:**
- `method(name: string, paramCount?: number): MonoMethod | null` - Find method
- `field(name: string): MonoField | null` - Find field
- `property(name: string): MonoProperty | null` - Find property
- `alloc(): MonoObject` - Allocate new instance

### Method Operations

#### `MonoMethod`

Represents a .NET method.

**Methods:**
- `getName(): string` - Get method name
- `getFullName(): string` - Get full method signature
- `invoke(instance: MonoObject | null, args: any[]): any` - Invoke method
- `getParameters(): MonoParameterInfo[]` - Get method parameters

### Field Operations

#### `MonoField`

Represents a .NET field.

**Methods:**
- `getName(): string` - Get field name
- `readValue(instance?: MonoObject): any` - Read field value
- `writeValue(instance: MonoObject, value: any): void` - Write field value
- `isStatic(): boolean` - Check if field is static

---

## Examples

### 1. Static Method Invocation

```typescript
import Mono from "./src";
import { MonoImage, MonoMethod } from "./src/model";
import { Logger } from "./src/utils";

function main(): void {
  Mono.perform(() => {
    const image = MonoImage.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
    const method = MonoMethod.find(Mono.api, image, "Game.Player:Say(string)");

    const logger = new Logger({ tag: "Example" });
    logger.info("Invoking Game.Player.Say(string)");
    method.invoke(null, ["Hello from frida-mono-bridge"]);
  });
}

main();
```

### 2. Runtime Method Hooking

```typescript
import Mono from "./src";
import { Logger } from "./src/utils";

function main(): void {
  Mono.perform(() => {
    const logger = new Logger({ tag: "Hook" });

    const invokePtr = Module.findExportByName(Mono.module.name, "mono_runtime_invoke");
    if (!invokePtr) {
      logger.error("mono_runtime_invoke export not found");
      return;
    }

    Interceptor.attach(invokePtr, {
      onEnter(args) {
        const methodPtr = args[0];
        logger.debug(`mono_runtime_invoke(method=${methodPtr})`);
      },
      onLeave(retval) {
        logger.debug(`mono_runtime_invoke returned ${retval}`);
      },
    });
  });
}

main();
```

### 3. Internal Call Registration

```typescript
import Mono from "./src";
import { registerInternalCall } from "./src/model";
import { Logger } from "./src/utils";

function main(): void {
  Mono.perform(() => {
    const logger = new Logger({ tag: "ICall" });

    const callback = new NativeCallback((messagePtr: NativePointer) => {
      const message = Memory.readUtf8String(messagePtr) ?? "";
      logger.info(`ICall invoked with message: ${message}`);
    }, "void", ["pointer"]);

    registerInternalCall(Mono.api, "Game.NativeHooks::OnMessage", callback);
  });
}

main();
```

### 4. Metadata Exploration

```typescript
import Mono from "./src";
import { collectAssemblies, groupClassesByNamespace, indexMethodsByName } from "./src/model";

Mono.perform(() => {
  const assemblies = collectAssemblies(Mono.api, {
    includeClasses: true,
  });

  for (const summary of assemblies) {
    const name = summary.assembly.getName();
    const version = summary.assembly.getVersion();
    const classes = summary.classes ?? [];

    console.log(`Assembly: ${name} (${version.major}.${version.minor}.${version.build}.${version.revision})`);
    console.log(`  Image: ${summary.image.getName()} - ${classes.length} classes`);

    const namespaced = groupClassesByNamespace(classes);
    for (const [namespace, klasses] of namespaced) {
      const displayNamespace = namespace || "<global>";
      console.log(`    Namespace: ${displayNamespace} (${klasses.length})`);
      for (const klass of klasses.slice(0, 3)) {
        const methods = indexMethodsByName(klass.getMethods());
        console.log(`      Class: ${klass.getFullName()} (${methods.size} method groups)`);
      }
      if (klasses.length > 3) {
        console.log("      …");
      }
    }
  }
});
```

### 5. Thread Management

```typescript
import Mono from "./src";
import { MonoThread } from "./src/model";

console.log("=== Mono Thread Management Examples ===\n");

// Example 1: Simple thread attachment
console.log("Example 1: Simple Thread Attachment");
try {
  const thread = MonoThread.current(Mono.api);
  console.log(`[OK] Current thread attached: ${thread}`);
  console.log(`  Thread ID: ${MonoThread.getId()}`);
} catch (error) {
  console.error("[ERROR] Failed to attach thread:", error);
}

// Example 2: Execute with automatic thread management
console.log("\nExample 2: Automatic Thread Management");
try {
  const domain = MonoThread.withAttached(Mono.api, () => {
    const dom = Mono.api.getRootDomain();
    console.log(`[OK] Root domain retrieved: ${dom}`);
    return dom;
  });
  console.log(`  Domain handle: ${domain}`);
} catch (error) {
  console.error("[ERROR] Failed to execute with attached thread:", error);
}

// Example 3: Using modern approach
console.log("\nExample 3: Modern Approach (Recommended)");
try {
  Mono.perform(() => {
    const domain = Mono.api.getRootDomain();
    console.log(`[OK] Domain accessed via modern approach: ${domain}`);

    // Load an image and find a class
    try {
      const image = MonoImage.fromAssemblyPath(
        Mono.api,
        "Assembly-CSharp"
      );
      console.log(`  Image loaded: ${image.getName()}`);

      // Find a common Unity class
      const klass = image.classFromName("UnityEngine", "GameObject");
      if (klass) {
        console.log(`  Found class: ${klass.getName()}`);
      }
    } catch (err) {
      console.log("  (Assembly-CSharp not loaded - this is normal)");
    }
  });
} catch (error) {
  console.error("[ERROR] Failed with model helper:", error);
}

// Cleanup
console.log("\n=== Cleanup ===");
try {
  Mono.dispose();
  console.log("[OK] Mono bridge disposed successfully");
} catch (error) {
  console.error("[ERROR] Failed to dispose:", error);
}

console.log("\n=== Thread Management Examples Complete ===");
```

### 6. Fast Delegate Invocation

```typescript
import Mono from "./src";
import { MonoImage, MonoDelegate } from "./src/model";
import { Logger } from "./src/utils";

function main(): void {
  Mono.perform(() => {
    const logger = new Logger({ tag: "Delegate" });

    const image = MonoImage.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
    const klass = image.classFromName("Game", "TickSource");
    const method = klass.getMethod("GetDelegate", 0);

    logger.info("Creating delegate via managed invocation");
    const delegatePtr = method.invoke(null, []);
    const delegateInstance = new MonoDelegate(Mono.api, delegatePtr);

    const thunk = delegateInstance.compileNative("void", ["pointer"]) as NativeFunction<void, [NativePointer]>;

    logger.info("Calling unmanaged delegate thunk");
    const exceptionSlot = Memory.alloc(Process.pointerSize);
    Memory.writePointer(exceptionSlot, NULL);
    thunk(delegateInstance.pointer);
  });
}

main();
```

### 7. Fluent API Demo

```typescript
/**
 * Fluent API Demo
 *
 * Demonstrates the frida-il2cpp-bridge inspired fluent API
 */

import Mono from "./src";

function main(): void {
  // Attach to current thread
  Mono.perform(() => {
    // Access domain with property syntax
    const domain = Mono.domain;
    console.log("Current domain loaded");

    // Enumerate assemblies with property getter
    console.log("\nLoaded assemblies:");
    for (const assembly of domain.assemblies) {
      console.log(`  - ${assembly.name}`);
    }

    // Find assembly using fluent method
    const gameAssembly = domain.assembly("Assembly-CSharp");
    if (!gameAssembly) {
      console.log("\nAssembly-CSharp not found");
      return;
    }

    // Chain through assembly -> image -> class
    const PlayerClass = gameAssembly.image.class("Game.Player");
    if (!PlayerClass) {
      console.log("\nGame.Player class not found");
      return;
    }

    console.log(`\nFound class: ${PlayerClass.fullName}`);

    // Use property getters
    console.log(`  Methods: ${PlayerClass.methods.length}`);
    console.log(`  Fields: ${PlayerClass.fields.length}`);
    console.log(`  Properties: ${PlayerClass.properties.length}`);

    // Find method using fluent syntax
    const sayMethod = PlayerClass.method("Say", 1);
    if (sayMethod) {
      console.log(`\nFound method: ${sayMethod.getFullName()}`);
    }

    // Find field using fluent syntax
    const nameField = PlayerClass.field("name");
    if (nameField) {
      console.log(`Found field: ${nameField.getName()}`);
    }

    // Allocate new instance using fluent method
    const player = PlayerClass.alloc();
    console.log(`\nAllocated new player instance: ${player.pointer}`);

    // Alternative: Direct class lookup across all assemblies
    const Player2 = domain.class("Game.Player");
    if (Player2) {
      console.log(`\nDirect lookup successful: ${Player2.fullName}`);
    }

    // Use trace utilities
    console.log("\n--- Tracing Demo ---");
    Mono.trace.method(sayMethod!, {
      onEnter(args: any) {
        console.log("→ Player.Say called");
      },
      onLeave(retval: any) {
        console.log("← Player.Say returned");
      },
    });

    // Use find utilities with wildcards
    console.log("\n--- Find Utilities Demo ---");
    const attackMethods = Mono.find.methods("*Attack*");
    console.log(`Found ${attackMethods.length} methods matching *Attack*`);

    const gameclasses = Mono.find.classes("Game.*");
    console.log(`Found ${gameclasses.length} classes in Game namespace`);

    // Use type helpers
    console.log("\n--- Type Utilities Demo ---");
    const gc = Mono.gc;
    console.log(`Max GC generation: ${gc.maxGeneration}`);
    gc.collect(0); // Collect generation 0
  });
}

main();
```

---

## Advanced Usage

### Memory Management

```typescript
import Mono from "./src";

Mono.perform(() => {
  // GC Utilities
  const gc = Mono.gc;

  // Get GC info
  console.log(`Max generation: ${gc.maxGeneration}`);
  console.log(`Collection count: ${gc.collectionCount(0)}`);

  // Force garbage collection
  gc.collect(0); // Collect generation 0
  gc.collect(-1); // Collect all generations

  // Handle lifetime management
  const player = Mono.domain.class("Game.Player")?.alloc();
  if (player) {
    // Add to GC watch list
    gc.watch(player);

    // ... use the object ...

    // Remove from watch list
    gc.unwatch(player);
  }
});
```

### Error Handling

```typescript
import Mono from "./src";

Mono.perform(() => {
  try {
    const assembly = Mono.domain.assembly("NonExistent.Assembly");
    if (!assembly) {
      console.log("Assembly not found");
      return;
    }

    // Continue with assembly operations...
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
    } else {
      console.error(`Unknown error: ${error}`);
    }
  }
});
```

### Custom Logging

```typescript
import Mono from "./src";
import { Logger } from "./src/utils";

// Create custom logger
const logger = new Logger({
  level: "debug",
  tag: "MyScript"
});

Mono.perform(() => {
  logger.debug("Starting script");
  logger.info("Found domain");
  logger.warn("Deprecated method used");
  logger.error("Failed to find class");
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Mono runtime not found"
**Solution**: Ensure the target application is actually using Mono/.NET runtime and that Frida is attached before the Mono runtime initializes.

```typescript
// Wait for Mono to be available
setTimeout(() => {
  try {
    Mono.perform(() => {
      console.log("Mono runtime detected");
    });
  } catch (error) {
    console.error("Mono runtime not available:", error);
  }
}, 1000);
```

#### 2. "Thread not attached to Mono"
**Solution**: Always use `Mono.perform()` for automatic thread management.

```typescript
// Recommended approach
Mono.perform(() => {
  // All Mono operations here
  // Thread is automatically attached and managed
});
```

#### 3. "Method not found"
**Solution**: Check method signature including parameter count and types.

```typescript
// Debug method finding
const klass = Mono.domain.class("Game.Player");
if (klass) {
  console.log("Available methods:");
  klass.methods.forEach(m => console.log(`  ${m.getFullName()}`));

  // Try exact signature
  const method = klass.method("Say", 1); // 1 parameter
}
```

#### 4. "Assembly not found"
**Solution**: List available assemblies to find correct names.

```typescript
// List all assemblies
Mono.perform(() => {
  console.log("Available assemblies:");
  Mono.domain.assemblies.forEach(asm => {
    console.log(`  ${asm.getName()}`);
  });
});
```

### Performance Tips

1. **Cache lookups**: Store frequently accessed classes and methods
2. **Batch operations**: Group multiple Mono operations together
3. **Use perform()**: Prefer `Mono.perform()` over manual thread management
4. **GC awareness**: Be mindful of garbage collection when working with many objects

```typescript
// Good: Cache frequently used items
const PlayerClass = Mono.domain.class("Game.Player");
const sayMethod = PlayerClass?.method("Say", 1);

// Use cached references
Mono.perform(() => {
  if (sayMethod) {
    sayMethod.invoke(null, ["Hello"]);
  }
});
```

---

## Detailed API Reference

### Core Classes

#### `MonoNamespace`
Main entry point class providing fluent API access.

```typescript
class MonoNamespace {
  // Properties
  readonly domain: MonoDomain;
  readonly api: MonoApi;
  readonly module: MonoModuleInfo;
  readonly version: MonoRuntimeVersion;
  readonly gc: GCUtilities;
  readonly find: typeof Find;
  readonly trace: typeof Trace;
  readonly types: typeof Types;

  // Methods
  perform<T>(callback: () => T): T;
  dispose(): void;
}
```

#### `MonoDomain`
Represents a Mono application domain.

```typescript
class MonoDomain extends MonoHandle {
  getAssemblies(): MonoAssembly[];
  assembly(name: string): MonoAssembly | null;
  class(name: string): MonoClass | null;
  // ... other domain methods
}
```

#### `MonoAssembly`
Represents a .NET assembly.

```typescript
class MonoAssembly extends MonoHandle {
  getName(): string;
  getVersion(): Version;
  getImage(): MonoImage;
  getEntryPoint(): MonoMethod | null;
  // ... other assembly methods
}
```

#### `MonoClass`
Represents a .NET class.

```typescript
class MonoClass extends MonoHandle {
  readonly name: string;
  readonly namespace: string;
  readonly fullName: string;
  readonly methods: MonoMethod[];
  readonly fields: MonoField[];
  readonly properties: MonoProperty[];

  method(name: string, paramCount?: number): MonoMethod | null;
  field(name: string): MonoField | null;
  property(name: string): MonoProperty | null;
  alloc(): MonoObject;
  // ... other class methods
}
```

#### `MonoMethod`
Represents a .NET method.

```typescript
class MonoMethod extends MonoHandle {
  getName(): string;
  getFullName(): string;
  getParameters(): MonoParameterInfo[];
  invoke(instance: MonoObject | null, args: any[]): any;
  // ... other method properties
}
```

#### `MonoField`
Represents a .NET field.

```typescript
class MonoField<T = any> extends MonoHandle {
  getName(): string;
  getFullName(): string;
  readValue(instance?: MonoObject): T;
  writeValue(instance: MonoObject, value: T): void;
  isStatic(): boolean;
  // ... other field methods
}
```

### Utility Namespaces

#### `Find` - Search Utilities
```typescript
namespace Find {
  function methods(pattern: string): MonoMethod[];
  function classes(pattern: string): MonoClass[];
  function fields(pattern: string): MonoField[];
  function assemblies(pattern: string): MonoAssembly[];
}
```

#### `Trace` - Tracing Utilities
```typescript
namespace Trace {
  function method(method: MonoMethod, options: TraceOptions): void;
  function class(klass: MonoClass, options: TraceOptions): void;
  function assembly(assembly: MonoAssembly, options: TraceOptions): void;
}

interface TraceOptions {
  onEnter?: (args: any[]) => void;
  onLeave?: (retval: any) => void;
  onException?: (exception: any) => void;
}
```

#### `Types` - Type Utilities
```typescript
namespace Types {
  function box(value: any, type: MonoType): MonoObject;
  function unbox<T>(object: MonoObject): T;
  function isInstanceOf(object: MonoObject, type: MonoType): boolean;
  function cast<T>(object: MonoObject, type: MonoType): T;
}
```

### Thread Management

#### `MonoThread`
Thread management utilities.

```typescript
class MonoThread {
  static current(api: MonoApi): MonoThread;
  static attach(api: MonoApi): MonoThread;
  static withAttached<T>(api: MonoApi, fn: () => T): T;
  static getId(): number;
  static isValid(handle: NativePointer | null | undefined): boolean;

  detach(): void;
  toString(): string;
  toPointer(): NativePointer;
}

// Namespace functions
namespace MonoThread {
  function ensureAttached(api: MonoApi): NativePointer;
  function detachAll(api: MonoApi): void;
  function getCurrentId(): number;
}
```

### Garbage Collection

#### `GCUtilities`
Garbage collection management.

```typescript
class GCUtilities {
  readonly maxGeneration: number;

  collect(generation?: number): void;
  collectCount(generation: number): number;
  addMemoryPressure(bytes: number): void;

  watch(object: MonoObject): void;
  unwatch(object: MonoObject): void;
  releaseAll(): void;

  getHeapSize(): number;
  isAllocated(object: MonoObject): boolean;
}
```

---

## Contributing

### Development Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd frida-mono-bridge
   npm install
   ```

2. **Development workflow**
   ```bash
   # Watch for changes and rebuild
   npm run watch

   # Run tests
   npm test

   # Lint code
   npm run lint

     ```

3. **Project Structure**
   ```
   src/
   ├── index.ts          # Main entry point
   ├── mono.ts           # Mono namespace
   ├── model/            # Mono object models
   ├── runtime/          # Low-level runtime API
   └── utils/            # Utility functions

      tests/               # Test suite
   dist/                # Built files
   ```

### Building for Distribution

```bash
# Clean build
npm run clean

# Build main library
npm run build


# Run test suite
npm test

# Lint TypeScript
npm run lint
```

---

## License

MIT License - see LICENSE file for details.

---

## Support

For issues, questions, or contributions:

- [Report Issues](https://github.com/your-repo/frida-mono-bridge/issues)
- [Discussions](https://github.com/your-repo/frida-mono-bridge/discussions)
- [Email Support](mailto:support@example.com)

---

## Changelog

### v0.1.0
- Initial release
- Core Mono runtime bridge functionality
- Fluent API inspired by frida-il2cpp-bridge
- Thread management and garbage collection
- Comprehensive test suite

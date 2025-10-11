# Frida Mono Bridge - Quick Reference

## Installation & Setup
```powershell
npm install                    # Install dependencies
npm run build                  # Build main agent
npm run test                   # Build test script
.\dev.ps1                      # Interactive menu
```

## Core API

### Initialize & Attach
```typescript
import Mono from "./src";

Mono.attachThread();           // Attach current thread to Mono domain
Mono.detachAllThreads();       // Detach all attached threads
Mono.dispose();                // Cleanup: detach threads + release GC handles
```

### Thread-Safe Execution
```typescript
// Using the helper function
Mono.model.withThread(() => {
  // Your Mono API calls here
  // Thread is automatically attached/detached
});

// Using the Thread model class
import { MonoThread } from "./src/model";

// Get current thread (auto-attaches)
const thread = MonoThread.current(Mono.api);

// Execute with automatic thread attachment
MonoThread.withAttached(Mono.api, () => {
  const domain = Mono.api.getRootDomain();
  // ... your code
});

// Manual thread management
const thread = MonoThread.attach(Mono.api);
try {
  // Use Mono API...
} finally {
  thread.detach();
}

// Thread utilities
const threadId = MonoThread.getCurrentId();
MonoThread.ensureAttached(Mono.api);
MonoThread.detachAll(Mono.api);
```

### Module & Version
```typescript
Mono.module.name               // Module name (e.g., "mono-2.0-bdwgc.dll")
Mono.module.base               // Base address
Mono.module.path               // Full path

Mono.version.features.delegateThunk      // Delegate thunk support
Mono.version.features.metadataTables     // Metadata tables support
Mono.version.features.gcHandles          // GC handle support
Mono.version.features.internalCalls      // Internal call support
```

### API Access
```typescript
// Check if API is available
if (Mono.api.hasExport("mono_method_get_name")) {
  // Use the API
}

// Call Mono API directly
Mono.api.native.mono_get_root_domain();
Mono.api.native.mono_thread_attach(domain);

// Helper methods
Mono.api.getRootDomain();                        // Get root domain
Mono.api.attachThread();                         // Attach thread
Mono.api.detachThread(thread);                   // Detach thread
Mono.api.stringNew("Hello");                     // Create Mono string
Mono.api.runtimeInvoke(method, instance, args);  // Invoke method
```

## Working with Assemblies & Images

### Load Assembly/Image
```typescript
const image = Mono.model.Image.fromAssemblyPath(
  Mono.api, 
  "/path/to/Assembly-CSharp.dll"
);
```

### Find Class
```typescript
const klass = image.classFromName("Namespace", "ClassName");
// or
const klass = Mono.model.Class.find(Mono.api, image, "Namespace.ClassName");
```

### Assembly & Image Metadata
```typescript
const domain = Mono.model.Domain.getRoot(Mono.api);
const assembly = domain.assemblyOpen("/path/Assembly-CSharp.dll");
const fullName = assembly.getFullName();
const version = assembly.getVersion(); // { major, minor, build, revision }
const imageName = assembly.getImage().getName();
const classCount = assembly.getImage().getClassCount();
const classes = assembly.getClasses();
```

### Get Method
```typescript
const method = klass.getMethod("MethodName", paramCount);
// or find by signature
const method = Mono.model.Method.find(
  Mono.api, 
  image, 
  "Namespace.ClassName:MethodName(argType1,argType2)"
);
```

### Invoke Method
```typescript
// Static method
const result = method.invoke(null, [arg1, arg2]);

// Instance method
const result = method.invoke(instancePtr, [arg1, arg2]);

// With exception handling
try {
  const result = method.invoke(null, [arg1]);
} catch (error) {
  if (error instanceof Mono.runtime.MonoManagedExceptionError) {
    console.error("Exception:", error.exception);
  }
}

// Metadata helpers
const declaringClass = method.getDeclaringClass();
const token = method.getToken();
const { flags, implementationFlags } = method.getFlags();
const fullSignature = method.getFullName();
const summary = method.describe();            // Rich metadata (parameters, return type, flags)
```
// Auto-boxing (enabled by default)
const abs = Mono.model.Method.find(Mono.api, corlib, 'System.Math:Abs(int)');
const boxedResult = abs.invoke(null, [-123]);
const absoluteValue = Mono.model.withThread(() => Mono.api.native.mono_object_unbox(boxedResult).readS32());

// Disable auto-boxing to supply raw pointers manually
abs.invoke(null, [42], { autoBoxPrimitives: false });

## Working with Objects\n### Header Enums & Defines
`	ypescript
import { MonoIncludeEnums, MonoIncludeDefines } from \"./src/model/enums\";

const callConv = MonoIncludeEnums.MonoCallConvention.MONO_CALL_STDCALL;
const profilerApiVersion = MonoIncludeDefines.MONO_PROFILER_API_VERSION;
`

### Create Object
```typescript
const obj = new Mono.model.Object(Mono.api, objectPtr);
const klass = obj.getClass();
const size = obj.getSize();
```

### Fields
```typescript
const field = klass.getField("fieldName");
const value = field.getValue(instancePtr);
field.setValue(instancePtr, newValue);
const fieldName = field.getName();
const fieldFlags = field.getFlags();
const fieldOffset = field.getOffset();
```

### Properties
```typescript
const prop = klass.getProperty("PropertyName");
const value = prop.getValue(instancePtr);
prop.setValue(instancePtr, newValue);
const propName = prop.getName();
const propFlags = prop.getFlags();
```

## Working with Strings

### Create Mono String
```typescript
const monoStr = Mono.model.createMonoString(Mono.api, "Hello, World!");
const ptr = monoStr.pointer;
```

### Read Mono String
```typescript
const str = new Mono.model.MonoString(Mono.api, strPtr);
console.log(str.toString());
console.log(str.length);
```

## Working with Arrays

```typescript
const array = new Mono.model.Array(Mono.api, arrayPtr);
const length = array.length;
const elementAddress = array.getElementAddress(index);
const elementRef = array.getReference(index);
const elementSize = array.getElementSize();
```

## Metadata Collections

```typescript
// Summarise assemblies and classes
const assemblies = Mono.model.collectAssemblies(Mono.api, {
  includeClasses: true,
  classFilter: (klass) => klass.getNamespace().startsWith("Game"),
});

for (const summary of assemblies) {
  Mono.utils.logger.info(`Assembly ${summary.assembly.getName()} -> ${summary.classes?.length ?? 0} classes`);
}

// Flatten classes with optional method expansion
const classes = Mono.model.collectClasses(Mono.api, {
  includeMethods: true,
  methodFilter: (method) => method.getName().startsWith("Update"),
});

const namespaceIndex = Mono.model.groupClassesByNamespace(classes.map((entry) => entry.klass));
```

## Working with Delegates

```typescript
const delegate = new Mono.model.Delegate(Mono.api, delegatePtr);

// Compile to native function
const nativeFn = delegate.compileNative<NativeFunction<void, [number]>>(
  "void", 
  ["int"]
);

// Call it
nativeFn(42);
```

## GC Handles

```typescript
// Create handle
const handle = Mono.gchandles.create(objectPtr);
const weakHandle = Mono.gchandles.createWeak(objectPtr);

// Get target
const obj = handle.getTarget();

// Release handle
Mono.gchandles.release(handle);

// Release all handles
Mono.gchandles.releaseAll();
```

## Internal Calls (ICall)

```typescript
const callback = new NativeCallback((arg: NativePointer) => {
  console.log("ICall invoked!");
}, "void", ["pointer"]);

Mono.model.registerInternalCall(
  Mono.api,
  "Namespace.ClassName::MethodName",
  callback
);
```

## Logging

```typescript
Mono.utils.logger.info("Info message");
Mono.utils.logger.warn("Warning message");
Mono.utils.logger.debug("Debug message");
Mono.utils.logger.error("Error message");
```

## Intercepting Mono Functions

```typescript
const invokePtr = Module.findExportByName(
  Mono.module.name, 
  "mono_runtime_invoke"
);

Interceptor.attach(invokePtr, {
  onEnter(args) {
    const methodPtr = args[0];
    console.log("Method:", methodPtr);
  },
  onLeave(retval) {
    console.log("Result:", retval);
  }
});
```

## Common Patterns

### Find and Call Static Method
```typescript
Mono.attachThread();
const image = Mono.model.Image.fromAssemblyPath(Mono.api, "/path/to/dll");
const method = Mono.model.Method.find(Mono.api, image, "Class:Method(args)");
const result = method.invoke(null, [arg1, arg2]);
```

### Hook All Methods in a Class
```typescript
const klass = image.classFromName("Namespace", "ClassName");
// Iterate through methods and hook them
```

### Read/Write Field Value
```typescript
const klass = image.classFromName("Namespace", "ClassName");
const field = klass.getField("fieldName");
const snapshot = field.describe();          // Metadata (flags, type, offset)
const value = field.readValue(instancePtr); // Coerces to JS when possible
field.setValue(instancePtr, newValuePtr);
field.setStaticValue(staticValuePtr);
```

## Development Commands

```powershell
# Build
npm run build              # Build agent
npm run watch              # Build with auto-reload
npm run test               # Build test script

# Type checking
npm run lint               # Check types

# Clean
npm run clean              # Remove dist folder

# Interactive menu
.\dev.ps1                  # Launch dev menu
```

## Frida Commands

```powershell
# List processes
frida-ps
frida-ps -U                # USB devices

# Attach to process
frida -n "ProcessName" -l dist/agent.js
frida -p 1234 -l dist/agent.js
frida -U -n "ProcessName" -l dist/agent.js  # USB

# REPL
frida -n "ProcessName"
# Then: %load dist/agent.js
```

## Testing

```powershell
# Build and run test
npm run test
frida -n "UnityApp.exe" -l dist/test-debug.js

```

## Debugging Tips

1. **Always attach thread first:** `Mono.attachThread()`
2. **Check API availability:** `Mono.api.hasExport("api_name")`
3. **Check features:** `console.log(Mono.version.features)`
4. **Use try-catch:** Especially for `invoke()` calls
5. **Release GC handles:** Prevent memory leaks
6. **Use withThread():** For automatic thread management

## Error Handling

```typescript
try {
  Mono.attachThread();
  const result = method.invoke(null, []);
} catch (error) {
  if (error instanceof Mono.runtime.MonoManagedExceptionError) {
    console.error("Managed exception:", error.exception);
  } else if (error instanceof Mono.runtime.MonoFunctionResolutionError) {
    console.error("API not found:", error.exportName);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Further Reading

- `TESTING.md` - Comprehensive testing guide
- `Design.md` - Architecture documentation
- `Implementation.md` - Implementation details


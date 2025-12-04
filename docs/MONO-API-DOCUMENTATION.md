# Mono API Comprehensive Documentation

## Executive Summary

The frida-mono-bridge provides access to **511 Mono runtime functions** organized into **40 distinct categories**. The API is heavily pointer-based (52.3% of return types) and follows a consistent pattern for runtime interaction, type introspection, and method invocation.

## Quick Reference

### Essential Functions (Top 20 for 80% of Use Cases)

| Function | Purpose | Return Type | Usage Frequency |
|----------|---------|-------------|-----------------|
| `mono_thread_attach` | Attach current thread to Mono runtime | pointer | ⭐⭐⭐⭐⭐ |
| `mono_assembly_load` | Load .NET assembly | pointer | ⭐⭐⭐⭐⭐ |
| `mono_class_from_name` | Find class by namespace/name | pointer | ⭐⭐⭐⭐⭐ |
| `mono_class_get_method_from_name` | Find method in class | pointer | ⭐⭐⭐⭐⭐ |
| `mono_runtime_invoke` | Invoke method | pointer | ⭐⭐⭐⭐⭐ |
| `mono_object_new` | Create object instance | pointer | ⭐⭐⭐⭐ |
| `mono_string_new` | Create string | pointer | ⭐⭐⭐⭐ |
| `mono_string_to_utf8` | Convert string to UTF-8 | pointer | ⭐⭐⭐⭐ |
| `mono_assembly_get_image` | Get assembly image | pointer | ⭐⭐⭐⭐ |
| `mono_field_get_value` | Get field value | void | ⭐⭐⭐ |
| `mono_array_new` | Create array | pointer | ⭐⭐⭐ |
| `mono_object_get_class` | Get object's class | pointer | ⭐⭐⭐ |
| `mono_method_get_name` | Get method name | pointer | ⭐⭐⭐ |
| `mono_free` | Free memory | void | ⭐⭐⭐ |
| `mono_gc_collect` | Trigger garbage collection | void | ⭐⭐ |
| `mono_gchandle_new` | Create GC handle | uint | ⭐⭐ |
| `mono_jit_init` | Initialize JIT runtime | pointer | ⭐⭐ |
| `mono_class_get_parent` | Get base class | pointer | ⭐⭐ |
| `mono_array_length` | Get array length | size_t | ⭐⭐ |
| `mono_field_set_value` | Set field value | void | ⭐⭐ |

## Complete API Categories

### Core Infrastructure (119 functions - 23%)

#### Assembly Management (30 functions)
**Purpose**: Load, manage, and query .NET assemblies

**Essential Functions**:
```typescript
// Load assembly by name
const assembly = mono.mono_assembly_load("Assembly-CSharp", null, null);

// Open assembly from file
const assembly = mono.mono_assembly_open("/path/to/assembly.dll", null);

// Get assembly image for metadata access
const image = mono.mono_assembly_get_image(assembly);

// Get assembly name
const name = mono.mono_assembly_get_name(assembly);
```

**Key Functions**:
- `mono_assembly_load` - Load by name
- `mono_assembly_open` - Load from file
- `mono_assembly_get_image` - Get metadata image
- `mono_assembly_get_name` - Get assembly name
- `mono_assembly_get_main` - Get main assembly
- `mono_assembly_loaded` - Check if loaded
- `mono_assembly_close` - Close assembly

#### Class Operations (56 functions) ⭐ **LARGEST CATEGORY**
**Purpose**: Type system operations, class introspection, inheritance

**Essential Functions**:
```typescript
// Find class by namespace and name
const klass = mono.mono_class_from_name(image, "MyNamespace", "MyClass");

// Get parent class
const parent = mono.mono_class_get_parent(klass);

// Find method by name
const method = mono.mono_class_get_method_from_name(klass, "MyMethod", -1);

// Find field by name
const field = mono.mono_class_get_field_from_name(klass, "myField");

// Check type compatibility
const assignable = mono.mono_class_is_assignable_from(parentClass, childClass);
```

**Key Functions**:
- `mono_class_from_name` - Primary class lookup
- `mono_class_get_method_from_name` - Method discovery
- `mono_class_get_field_from_name` - Field discovery
- `mono_class_get_parent` - Inheritance
- `mono_class_get_name` - Get class name
- `mono_class_get_namespace` - Get namespace
- `mono_class_is_assignable_from` - Type checking
- `mono_class_is_enum` - Check if enum
- `mono_class_is_delegate` - Check if delegate

#### Method Operations (33 functions)
**Purpose**: Method introspection, invocation, metadata

**Essential Functions**:
```typescript
// Get method information
const name = mono.mono_method_get_name(method);
const klass = mono.mono_method_get_class(method);
const signature = mono.mono_method_get_signature(method, image, token);

// Invoke method
const result = mono.mono_runtime_invoke(method, obj, args, null);

// Get method token
const token = mono.mono_method_get_token(method);
```

**Key Functions**:
- `mono_method_get_name` - Get method name
- `mono_method_get_class` - Get method's class
- `mono_method_get_signature` - Get method signature
- `mono_runtime_invoke` - Invoke method
- `mono_method_get_token` - Get metadata token
- `mono_method_get_flags` - Get method flags
- `mono_method_get_header` - Get method header

#### Object Operations (17 functions)
**Purpose**: Object creation, manipulation, introspection

**Essential Functions**:
```typescript
// Create new object
const obj = mono.mono_object_new(domain, klass);

// Initialize object (run constructor)
mono.mono_runtime_object_init(obj);

// Get object's class
const objClass = mono.mono_object_get_class(obj);

// Clone object
const cloned = mono.mono_object_clone(obj);

// Convert to string
const str = mono.mono_object_to_string(obj, null);
```

**Key Functions**:
- `mono_object_new` - Create object
- `mono_object_get_class` - Get object type
- `mono_object_clone` - Clone object
- `mono_object_to_string` - String representation
- `mono_object_unbox` - Unbox value types
- `mono_object_get_size` - Get object size

### Data Structures (67 functions - 13%)

#### Array Operations (8 functions)
**Purpose**: Array creation, manipulation, access

**Essential Functions**:
```typescript
// Create new array
const array = mono.mono_array_new(domain, elementClass, length);

// Get array length
const length = mono.mono_array_length(array);

// Get element address
const elementPtr = mono.mono_array_addr_with_size(array, elementSize, index);

// Clone array
const cloned = mono.mono_array_clone(array);
```

#### String Operations (19 functions)
**Purpose**: String creation, conversion, manipulation

**Essential Functions**:
```typescript
// Create string from C string
const str = mono.mono_string_new(domain, "Hello World");

// Convert to UTF-8
const utf8 = mono.mono_string_to_utf8(str);

// Get string length
const length = mono.mono_string_length(str);

// Create from UTF-16
const str16 = mono.mono_string_new_utf16(domain, utf16Buffer, length);

// Check string equality
const equal = mono.mono_string_equal(str1, str2);
```

#### Field Operations (14 functions)
**Purpose**: Field introspection, value access

**Essential Functions**:
```typescript
// Get field information
const fieldName = mono.mono_field_get_name(field);
const fieldType = mono.mono_field_get_type(field);

// Get field value
const value = mono.mono_field_get_value(obj, field, valuePtr);

// Set field value
mono.mono_field_set_value(obj, field, valuePtr);

// Get static field value
mono.mono_field_static_get_value(domain, field, valuePtr);
```

#### Property Operations (8 functions)
**Purpose**: Property introspection, access

**Essential Functions**:
```typescript
// Get property methods
const getter = mono.mono_property_get_get_method(property);
const setter = mono.mono_property_get_set_method(property);

// Get property value
const value = mono.mono_property_get_value(property, obj, args, null);

// Set property value
mono.mono_property_set_value(property, obj, args, null);
```

### 🧵 Runtime Management (36 functions - 7%)

#### Thread Operations (11 functions)
**Purpose**: Thread management, synchronization

**Essential Functions**:
```typescript
// Attach current thread to Mono runtime
const thread = mono.mono_thread_attach(domain);

// Get current thread
const current = mono.mono_thread_current();

// Create new thread
mono.mono_thread_create(domain, startFunc, userData);

// Detach thread
mono.mono_thread_detach(thread);
```

#### Runtime Operations (10 functions)
**Purpose**: Runtime initialization, execution

**Essential Functions**:
```typescript
// Initialize JIT runtime
const domain = mono.mono_jit_init("MyApp");

// Execute assembly
const result = mono.mono_jit_exec(domain, assembly, argc, argv);

// Run main method
const exitCode = mono.mono_runtime_run_main(method, argc, argv, null);

// Set main arguments
mono.mono_runtime_set_main_args(argc, argv);
```

#### Memory Management (15 functions)
**Purpose**: Garbage collection, memory operations

**Essential Functions**:
```typescript
// Trigger garbage collection
mono.mono_gc_collect(0);

// Get heap statistics
const heapSize = mono.mono_gc_get_heap_size();
const usedSize = mono.mono_gc_get_used_size();

// Create GC handle
const handle = mono.mono_gchandle_new(obj, pinned);

// Free GC handle
mono.mono_gchandle_free(handle);

// Free allocated memory
mono.mono_free(ptr);
```

### Advanced Features (289 functions - 57%)

#### Metadata Operations (54 functions) ⭐ **ADVANCED**
**Purpose**: Low-level PE metadata parsing, access

**Key Functions**:
- `mono_metadata_string_heap` - Access string heap
- `mono_metadata_blob_heap` - Access blob heap
- `mono_metadata_decode_row` - Decode metadata row
- `mono_metadata_parse_signature` - Parse method signature
- `mono_metadata_locate_token` - Locate metadata token

#### Image Operations (34 functions) ⭐ **ADVANCED**
**Purpose**: PE image loading, metadata access

**Key Functions**:
- `mono_image_open` - Open image from file
- `mono_image_get_table_info` - Get metadata table
- `mono_image_get_entry_point` - Get entry point
- `mono_image_get_name` - Get image name

#### Type Operations (22 functions) ⭐ **ADVANCED**
**Purpose**: Type system operations, conversions

**Key Functions**:
- `mono_type_get_name` - Get type name
- `mono_type_get_class` - Get type's class
- `mono_type_is_byref` - Check if by-reference
- `mono_type_is_pointer` - Check if pointer type

#### Debug Operations (18 functions) ⭐ **ADVANCED**
**Purpose**: Runtime debugging, diagnostics

**Key Functions**:
- `mono_debug_enabled` - Check if debugging enabled
- `mono_debug_lookup_method` - Lookup method debug info
- `mono_debug_lookup_source_location` - Get source location

#### Profiler Operations (14 functions) ⭐ **ADVANCED**
**Purpose**: Performance monitoring, profiling

**Key Functions**:
- `mono_profiler_create` - Create profiler
- `mono_profiler_enable_sampling` - Enable sampling
- `mono_profiler_get_coverage_data` - Get coverage data

## Usage Patterns

### Basic Workflow (95% of Use Cases)

```typescript
// 1. Initialize and attach thread
Mono.attachThread();

// 2. Load assembly
const image = MonoImage.fromAssemblyPath(Mono.api, "/path/to/Assembly-CSharp.dll");

// 3. Find class
const klass = Mono.api.mono_class_from_name(image, "MyNamespace", "MyClass");

// 4. Find method
const method = Mono.api.mono_class_get_method_from_name(klass, "MyMethod", -1);

// 5. Create object (if needed)
const obj = Mono.api.mono_object_new(Mono.api.domain, klass);
Mono.api.mono_runtime_object_init(obj);

// 6. Invoke method
const result = Mono.api.mono_runtime_invoke(method, obj, args, null);
```

### Object Manipulation Pattern

```typescript
// Create and initialize object
const obj = Mono.api.mono_object_new(domain, klass);
Mono.api.mono_runtime_object_init(obj);

// Get/set fields
const field = Mono.api.mono_class_get_field_from_name(klass, "myField");
const value = Mono.api.mono_field_get_value(obj, field, null);
Mono.api.mono_field_set_value(obj, field, newValue);

// Get/set properties
const property = Mono.api.mono_class_get_property_from_name(klass, "MyProperty");
const propValue = Mono.api.mono_property_get_value(property, obj, null, null);
```

### String Operations Pattern

```typescript
// Create string from JavaScript string
const monoStr = Mono.api.mono_string_new(domain, "Hello from JavaScript");

// Convert to JavaScript string
const utf8Ptr = Mono.api.mono_string_to_utf8(monoStr);
const jsStr = utf8Ptr.readUtf8String();

// Clean up
Mono.api.mono_free(utf8Ptr);
```

### Array Operations Pattern

```typescript
// Create array
const elementClass = Mono.api.mono_class_get_field_from_name(klass, "items");
const array = Mono.api.mono_array_new(domain, elementClass, 10);

// Get array length
const length = Mono.api.mono_array_length(array);

// Access elements
const elementSize = Mono.api.mono_array_element_size(elementClass);
const elementPtr = Mono.api.mono_array_addr_with_size(array, elementSize, index);
```

## Type System Analysis

### Return Type Distribution
- **pointer (52.3%)**: Object references, method pointers, string pointers
- **void (21.9%)**: Actions without return values
- **int (16.0%)**: Status codes, counts, boolean results
- **uint (9.6%)**: Tokens, flags, sizes
- **size_t (0.2%)**: Large sizes, array lengths

### Argument Type Distribution
- **pointer (796 occurrences)**: Object references, domain pointers
- **int (87 occurrences)**: Counts, indices, boolean flags
- **uint (73 occurrences)**: Tokens, flags, sizes
- **size_t (3 occurrences)**: Array sizes, string lengths
- **long (1 occurrence)**: Large numeric values

## Learning Path

### Beginner (Essential Functions)
1. **Thread Management**: `mono_thread_attach`
2. **Assembly Loading**: `mono_assembly_load`, `mono_assembly_get_image`
3. **Type Discovery**: `mono_class_from_name`
4. **Method Discovery**: `mono_class_get_method_from_name`
5. **Method Invocation**: `mono_runtime_invoke`
6. **Object Creation**: `mono_object_new`
7. **String Operations**: `mono_string_new`, `mono_string_to_utf8`

### Intermediate (Common Operations)
1. **Field Access**: `mono_field_get_value`, `mono_field_set_value`
2. **Property Access**: `mono_property_get_value`, `mono_property_set_value`
3. **Array Operations**: `mono_array_new`, `mono_array_length`
4. **Memory Management**: `mono_gc_collect`, `mono_free`, `mono_gchandle_new`
5. **Type Checking**: `mono_class_is_assignable_from`, `mono_class_get_parent`

### Advanced (Specialized Features)
1. **Metadata Parsing**: `mono_metadata_*` functions
2. **Debug Support**: `mono_debug_*` functions
3. **Profiling**: `mono_profiler_*` functions
4. **Custom Attributes**: `mono_custom_attrs_*` functions
5. **Security**: `mono_declsec_*` functions
6. **Low-level Operations**: `mono_image_*`, `mono_type_*` functions

## Best Practices

### Do's
- Always attach thread before any Mono operations
- Use GC handles for long-lived object references
- Free allocated memory with `mono_free`
- Check return values for errors
- Use proper type checking before casting

### Don'ts
- Don't forget to attach thread in new threads
- Don't leak memory (always free allocated strings)
- Don't use objects after their domain is unloaded
- Don't ignore return codes from functions
- Don't mix pointer types without proper casting

## Generic Type and Method APIs

### Generic Type Operations

**Creating Generic Types:**
```typescript
// Using MonoClass.makeGenericType()
const listGenericDef = image.getClass("System.Collections.Generic", "List`1");
const stringClass = image.getClass("System", "String");
const listString = listGenericDef.makeGenericType([stringClass]);
// Result: List<string>
```

**Querying Generic Types:**
| Function | Description | Availability |
|----------|-------------|--------------|
| `mono_class_is_generic` | Check if class is a generic type definition | Standard |
| `mono_class_is_inflated` | Check if class is an instantiated generic | Standard |
| `mono_unity_class_get_generic_argument_count` | Get number of generic arguments | Unity only |
| `mono_unity_class_get_generic_argument_at` | Get specific generic argument | Unity only |
| `mono_unity_class_get_generic_type_definition` | Get generic definition from instantiated type | Unity only |

### Generic Method Operations

**Creating Generic Methods:**
```typescript
// Using MonoMethod.makeGenericMethod()
const genericMethod = cls.getMethod("Parse"); // e.g., Parse<T>()
const intClass = image.getClass("System", "Int32");
const parseInt = genericMethod.makeGenericMethod([intClass]);
// Result: Parse<int>()
```

**Implementation Strategies** (in priority order):
1. **Unity API**: `mono_unity_method_make_generic(method, typeClasses, count)`
2. **Standard Inflation**: `mono_class_inflate_generic_method(method, context)`
3. **Reflection**: Invoke `MethodInfo.MakeGenericMethod()` via runtime

**Querying Generic Methods:**
| Function | Description | Availability |
|----------|-------------|--------------|
| `unity_mono_method_is_generic` | Check if method has type parameters | Unity only |
| `unity_mono_method_is_inflated` | Check if method is instantiated generic | Unity only |
| `mono_method_get_generic_container` | Get generic container | Unity 2022.3+ |

### Reflection APIs for Generics

| Function | Description | Availability |
|----------|-------------|--------------|
| `mono_reflection_type_from_name` | Parse type name string to MonoType | Standard |
| `mono_reflection_type_get_type` | Get MonoType from System.Type object | Unity 2022.3+ |
| `mono_reflection_type_get_handle` | Get MonoType from System.Type (older name) | Standard |
| `unity_mono_reflection_method_get_method` | Extract MonoMethod from MethodInfo | Unity only |

### API Version Compatibility

The `src/runtime/signatures/manual.ts` file organizes APIs with automatic fallbacks:

1. **Standard Mono APIs** - Work across all Mono versions
2. **Unity-specific APIs** - Available only in Unity's Mono runtime
3. **API Aliases** - Handle naming differences between versions

**Example alias configuration:**
```typescript
// mono_reflection_type_get_type is preferred, but falls back to _get_handle
mono_reflection_type_get_type: {
  aliases: ["mono_reflection_type_get_handle"],
}
```

## Performance Considerations

### High-Impact Functions
- `mono_runtime_invoke` - Method invocation overhead
- `mono_gc_collect` - Garbage collection pause
- `mono_assembly_load` - Assembly loading cost
- `mono_class_from_name` - Type lookup cost

### Optimization Tips
1. Cache frequently used classes and methods
2. Use GC handles instead of raw pointers for long-term storage
3. Batch operations when possible
4. Avoid unnecessary string conversions
5. Use appropriate garbage collection modes

## Error Handling

### Common Error Patterns
- Null pointers from failed lookups
- Invalid arguments to functions
- Memory allocation failures
- Type mismatch errors

### Error Checking Strategy
```typescript
const assembly = Mono.api.mono_assembly_load(name, null, null);
if (!assembly) {
    throw new Error(`Failed to load assembly: ${name}`);
}

const klass = Mono.api.mono_class_from_name(image, ns, name);
if (!klass) {
    throw new Error(`Class not found: ${ns}.${name}`);
}
```

This comprehensive documentation provides a complete roadmap for mastering the frida-mono-bridge API, from basic operations to advanced features.
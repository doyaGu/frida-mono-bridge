# Mono API Structure Analysis

## Overview
This document provides a comprehensive categorization and analysis of the Mono API functions available in the frida-mono-bridge. The analysis is based on the generated signatures file containing 750+ functions.

## Function Categories by Prefix

### 1. Assembly Management (42 functions)
**Purpose**: Loading, managing, and querying .NET assemblies
**Essential Functions**:
- `mono_assembly_load` - Load assembly by name
- `mono_assembly_open` - Open assembly from file
- `mono_assembly_get_image` - Get image from assembly
- `mono_assembly_get_name` - Get assembly name
- `mono_assembly_get_main` - Get main assembly

**Common Usage Pattern**:
```typescript
const assembly = Mono.api.mono_assembly_load("Assembly-CSharp", null, null);
const image = Mono.api.mono_assembly_get_image(assembly);
```

### 2. Class Operations (67 functions)
**Purpose**: Type system operations, class introspection, and metadata
**Essential Functions**:
- `mono_class_from_name` - Get class by namespace and name
- `mono_class_get_method_from_name` - Find method in class
- `mono_class_get_field_from_name` - Find field in class
- `mono_class_get_parent` - Get base class
- `mono_class_is_assignable_from` - Type compatibility check

**Common Usage Pattern**:
```typescript
const klass = Mono.api.mono_class_from_name(image, "MyNamespace", "MyClass");
const method = Mono.api.mono_class_get_method_from_name(klass, "MyMethod", -1);
```

### 3. Method Operations (45 functions)
**Purpose**: Method introspection, invocation, and metadata
**Essential Functions**:
- `mono_method_get_name` - Get method name
- `mono_method_get_class` - Get method's class
- `mono_method_get_signature` - Get method signature
- `mono_runtime_invoke` - Invoke method
- `mono_compile_method` - Compile method (JIT)

**Common Usage Pattern**:
```typescript
const result = Mono.api.mono_runtime_invoke(method, null, args, null);
```

### 4. Object Operations (25 functions)
**Purpose**: Object creation, manipulation, and introspection
**Essential Functions**:
- `mono_object_new` - Create new object instance
- `mono_object_get_class` - Get object's class
- `mono_object_clone` - Clone object
- `mono_object_to_string` - Convert to string
- `mono_object_unbox` - Unbox value type

**Common Usage Pattern**:
```typescript
const obj = Mono.api.mono_object_new(domain, klass);
Mono.api.mono_runtime_object_init(obj);
```

### 5. Array Operations (11 functions)
**Purpose**: Array creation, manipulation, and access
**Essential Functions**:
- `mono_array_new` - Create new array
- `mono_array_length` - Get array length
- `mono_array_addr_with_size` - Get array element address
- `mono_array_clone` - Clone array

**Common Usage Pattern**:
```typescript
const array = Mono.api.mono_array_new(domain, elementClass, length);
```

### 6. String Operations (20 functions)
**Purpose**: String creation, conversion, and manipulation
**Essential Functions**:
- `mono_string_new` - Create new string
- `mono_string_to_utf8` - Convert to UTF-8
- `mono_string_from_utf8` - Create from UTF-8
- `mono_string_length` - Get string length
- `mono_string_equal` - Compare strings

**Common Usage Pattern**:
```typescript
const str = Mono.api.mono_string_new(domain, "Hello World");
const utf8 = Mono.api.mono_string_to_utf8(str);
```

### 7. Field Operations (15 functions)
**Purpose**: Field introspection and value access
**Essential Functions**:
- `mono_field_get_name` - Get field name
- `mono_field_get_type` - Get field type
- `mono_field_get_value` - Get field value
- `mono_field_set_value` - Set field value
- `mono_field_static_get_value` - Get static field value

**Common Usage Pattern**:
```typescript
const value = Mono.api.mono_field_get_value(obj, field, null);
```

### 8. Property Operations (10 functions)
**Purpose**: Property introspection and access
**Essential Functions**:
- `mono_property_get_name` - Get property name
- `mono_property_get_get_method` - Get getter method
- `mono_property_get_set_method` - Get setter method
- `mono_property_get_value` - Get property value
- `mono_property_set_value` - Set property value

### 9. Thread Operations (25 functions)
**Purpose**: Thread management and synchronization
**Essential Functions**:
- `mono_thread_attach` - Attach thread to Mono runtime
- `mono_thread_current` - Get current thread
- `mono_thread_create` - Create new thread
- `mono_thread_detach` - Detach thread from runtime

**Common Usage Pattern**:
```typescript
Mono.api.mono_thread_attach(domain);
```

### 10. Memory Management (15 functions)
**Purpose**: Garbage collection and memory operations
**Essential Functions**:
- `mono_gc_collect` - Trigger garbage collection
- `mono_gc_get_heap_size` - Get heap size
- `mono_gc_get_used_size` - Get used memory
- `mono_free` - Free allocated memory

### 11. Runtime Operations (20 functions)
**Purpose**: Runtime initialization, execution, and configuration
**Essential Functions**:
- `mono_jit_init` - Initialize JIT runtime
- `mono_jit_exec` - Execute assembly
- `mono_runtime_invoke` - Invoke method in runtime
- `mono_runtime_set_main_args` - Set main arguments

### 12. Image Operations (35 functions)
**Purpose**: PE image loading and metadata access
**Essential Functions**:
- `mono_image_open` - Open image from file
- `mono_image_get_name` - Get image name
- `mono_image_get_entry_point` - Get entry point
- `mono_image_get_table_info` - Get metadata table

### 13. Metadata Operations (65 functions)
**Purpose**: Low-level metadata parsing and access
**Essential Functions**:
- `mono_metadata_string_heap` - Access string heap
- `mono_metadata_blob_heap` - Access blob heap
- `mono_metadata_decode_row` - Decode metadata row
- `mono_metadata_parse_signature` - Parse method signature

### 14. Type Operations (25 functions)
**Purpose**: Type system operations and conversions
**Essential Functions**:
- `mono_type_get_name` - Get type name
- `mono_type_get_class` - Get type's class
- `mono_type_is_byref` - Check if by-reference
- `mono_type_is_pointer` - Check if pointer type

### 15. Delegate Operations (8 functions)
**Purpose**: Delegate creation and invocation
**Essential Functions**:
- `mono_get_delegate_invoke` - Get delegate invoke method
- `mono_runtime_delegate_invoke` - Invoke delegate
- `mono_get_delegate_begin_invoke` - Get begin invoke method

### 16. Exception Operations (8 functions)
**Purpose**: Exception handling and management
**Essential Functions**:
- `mono_raise_exception` - Raise exception
- `mono_reraise_exception` - Reraise exception
- `mono_unhandled_exception` - Handle unhandled exception

### 17. Debug Operations (25 functions)
**Purpose**: Debugging and diagnostics
**Essential Functions**:
- `mono_debug_enabled` - Check if debugging enabled
- `mono_debug_lookup_method` - Lookup method debug info
- `mono_debug_lookup_source_location` - Get source location

### 18. Profiler Operations (15 functions)
**Purpose**: Performance profiling and monitoring
**Essential Functions**:
- `mono_profiler_create` - Create profiler
- `mono_profiler_enable_sampling` - Enable sampling
- `mono_profiler_get_coverage_data` - Get coverage data

### 19. GCHandle Operations (8 functions)
**Purpose**: Garbage collector handle management
**Essential Functions**:
- `mono_gchandle_new` - Create GC handle
- `mono_gchandle_get_target` - Get handle target
- `mono_gchandle_free` - Free GC handle

### 20. Monitor Operations (4 functions)
**Purpose**: Thread synchronization (monitor/lock)
**Essential Functions**:
- `mono_monitor_enter` - Enter monitor
- `mono_monitor_exit` - Exit monitor
- `mono_monitor_try_enter` - Try enter monitor

### 21. Event Operations (8 functions)
**Purpose**: Event handling and management
**Essential Functions**:
- `mono_event_get_name` - Get event name
- `mono_event_get_add_method` - Get add method
- `mono_event_get_remove_method` - Get remove method

### 22. Custom Attributes Operations (12 functions)
**Purpose**: Custom attribute introspection
**Essential Functions**:
- `mono_custom_attrs_from_class` - Get class attributes
- `mono_custom_attrs_from_method` - Get method attributes
- `mono_custom_attrs_get_attr` - Get specific attribute

### 23. Security Operations (10 functions)
**Purpose**: Security and declarative security
**Essential Functions**:
- `mono_declsec_flags_from_assembly` - Get assembly security flags
- `mono_declsec_get_assembly_action` - Get security actions

### 24. Miscellaneous Operations (30+ functions)
**Purpose**: Utility functions and specialized operations
**Categories**:
- Internal calls (`mono_add_internal_call`)
- AOT compilation (`mono_aot_register_module`)
- Path operations (`mono_path_canonicalize`)
- GUID operations (`mono_guid_to_string`)
- Configuration (`mono_set_dirs`)

## Type Analysis

### Common Return Types
1. **pointer** (60% of functions) - Most common, returns object references
2. **void** (20% of functions) - Actions without return values
3. **int/uint** (15% of functions) - Status codes, counts, flags
4. **size_t** (3% of functions) - Sizes and lengths
5. **int64** (2% of functions) - Large numeric values

### Common Argument Types
1. **pointer** - Object references, domain pointers, method pointers
2. **int/uint** - Counts, indices, flags, sizes
3. **size_t** - Array sizes, string lengths
4. **char\*** (represented as pointer) - String arguments

## Usage Patterns

### Basic Operations Workflow
1. **Initialize Runtime**: `mono_jit_init` → `mono_thread_attach`
2. **Load Assembly**: `mono_assembly_load` → `mono_assembly_get_image`
3. **Find Type**: `mono_class_from_name`
4. **Find Method**: `mono_class_get_method_from_name`
5. **Create Object**: `mono_object_new` → `mono_runtime_object_init`
6. **Invoke Method**: `mono_runtime_invoke`

### Advanced Operations Workflow
1. **Metadata Access**: `mono_image_get_table_info` → `mono_metadata_decode_row`
2. **Dynamic Invocation**: `mono_method_get_signature` → `mono_runtime_invoke`
3. **Field Access**: `mono_class_get_field_from_name` → `mono_field_get_value`
4. **Array Operations**: `mono_array_new` → `mono_array_addr_with_size`

## Essential vs Advanced Functions

### Essential for Basic Operations (Top 20)
1. `mono_thread_attach` - Thread attachment
2. `mono_assembly_load` - Assembly loading
3. `mono_assembly_get_image` - Image access
4. `mono_class_from_name` - Type lookup
5. `mono_class_get_method_from_name` - Method lookup
6. `mono_runtime_invoke` - Method invocation
7. `mono_object_new` - Object creation
8. `mono_string_new` - String creation
9. `mono_string_to_utf8` - String conversion
10. `mono_array_new` - Array creation
11. `mono_field_get_value` - Field access
12. `mono_property_get_value` - Property access
13. `mono_gchandle_new` - GC handle creation
14. `mono_free` - Memory cleanup
15. `mono_jit_init` - Runtime initialization
16. `mono_method_get_name` - Method introspection
17. `mono_class_get_parent` - Inheritance
18. `mono_object_get_class` - Object type
19. `mono_array_length` - Array size
20. `mono_monitor_enter` - Synchronization

### Advanced/Specialized Functions
- All metadata parsing functions (`mono_metadata_*`)
- Debug functions (`mono_debug_*`)
- Profiler functions (`mono_profiler_*`)
- Security functions (`mono_declsec_*`)
- Custom attribute functions (`mono_custom_attrs_*`)
- Low-level memory functions (`mono_gc_wbarrier_*`)

## Recommendations for Documentation Structure

### Tier 1: Core API (Essential)
- Runtime initialization
- Thread management
- Assembly loading
- Type and method lookup
- Object creation and manipulation
- Method invocation
- Basic field/property access

### Tier 2: Common Operations
- String and array operations
- Delegate operations
- Exception handling
- GC handle management
- Basic synchronization

### Tier 3: Advanced Features
- Metadata introspection
- Custom attributes
- Debugging support
- Profiling
- Security
- Advanced memory management

### Tier 4: Specialized Features
- AOT compilation
- Internal calls
- Low-level runtime operations
- Platform-specific functions

This categorization provides a logical progression for developers learning the frida-mono-bridge API, starting with essential operations and gradually moving to more advanced features.
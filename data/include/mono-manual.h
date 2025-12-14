/**
 * Manual Mono API additions - signatures not in public headers
 *
 * This file contains:
 * 1. Standard Mono internal APIs (available in all Mono versions)
 * 2. Unity-specific APIs (prefixed with mono_unity_ or unity_mono_)
 * 3. Primitive type class getters
 *
 * Signatures verified via IDA Pro analysis of:
 * - mono.dll: Legacy Mono runtime (older Unity versions)
 * - mono-2.0-bdwgc.dll: MonoBleedingEdge runtime (newer Unity versions)
 *
 * Note: API availability depends on Mono runtime version.
 */

#ifndef __MONO_MANUAL_H__
#define __MONO_MANUAL_H__

/* ========================================================================
 * SECTION 1: Standard Mono Internal APIs
 * These are internal APIs that exist in all Mono versions
 * ======================================================================== */

/**
 * Check if a class is a generic type definition (has type parameters)
 * Version differences:
 * - Legacy mono.dll: return (klass->flags2 >> 18) & 1
 * - MonoBleedingEdge: return klass->class_kind == 2
 */
MONO_API int mono_class_is_generic(MonoClass *klass);

/**
 * Check if a class is an instantiated generic type
 * Version differences:
 * - Legacy mono.dll: return (klass->flags2 >> 19) & 1
 * - MonoBleedingEdge: return klass->class_kind == 3
 */
MONO_API int mono_class_is_inflated(MonoClass *klass);

/**
 * Check if a type can be copied bit-by-bit (no managed references)
 * Implementation: return (klass->flags >> 5) & 1
 */
MONO_API int mono_class_is_blittable(MonoClass *klass);

/**
 * Inflate a generic method with a generic context
 * Wraps mono_class_inflate_generic_method_full(method, NULL, context)
 */
MONO_API MonoMethod *mono_class_inflate_generic_method(MonoMethod *method, MonoGenericContext *context);

/**
 * Inflate a generic method with full parameters
 */
MONO_API MonoMethod *mono_class_inflate_generic_method_full(MonoMethod *method, MonoClass *klass, MonoGenericContext *context);

/**
 * Get inflated method (identity function in some versions)
 */
MONO_API MonoMethod *mono_get_inflated_method(MonoMethod *method);

/**
 * Parse a type name and return MonoType*
 */
MONO_API MonoType *mono_reflection_type_from_name(const char *name, MonoImage *image);

/**
 * Get the generic container for a generic method definition
 * Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
 */
MONO_API MonoGenericContainer *mono_method_get_generic_container(MonoMethod *method);

/**
 * Check if a type is a generic parameter (T, TKey, etc.)
 * Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
 */
MONO_API int mono_type_is_generic_parameter(MonoType *type);

/**
 * Get MonoType* from a System.Type reflection object
 * Note: In legacy mono.dll, use mono_reflection_type_get_handle instead
 * Available in MonoBleedingEdge (mono-2.0-bdwgc.dll)
 * @alias mono_reflection_type_get_handle
 */
MONO_API MonoType *mono_reflection_type_get_type(MonoReflectionType *reftype);

/* ========================================================================
 * SECTION 2: Unity-specific Mono APIs
 * These exist in Unity's custom Mono runtime
 * ======================================================================== */

/**
 * Get the number of generic parameters for a generic type definition
 * Implementation: return klass->generic_container ? (klass->generic_container->type_argc * 2) >> 1 : 0
 */
MONO_API int mono_unity_class_get_generic_parameter_count(MonoClass *klass);

/**
 * Get a specific generic parameter from a generic type definition
 * Implementation: mono_class_from_generic_parameter(container->type_params[index], klass->image, 0)
 */
MONO_API MonoClass *mono_unity_class_get_generic_parameter_at(MonoClass *klass, int index);

/**
 * Get the generic type definition from an instantiated generic type
 * e.g., List<int> -> List<T>
 * Implementation: return klass->generic_class ? get_container_class() : NULL
 */
MONO_API MonoClass *mono_unity_class_get_generic_type_definition(MonoClass *klass);

/**
 * Get the number of generic arguments for an instantiated generic type
 * NOTE: Only available in MonoBleedingEdge, not exported in legacy mono.dll
 */
MONO_API int mono_unity_class_get_generic_argument_count(MonoClass *klass);

/**
 * Get a specific generic argument type from an instantiated generic type
 * NOTE: Only available in MonoBleedingEdge, not exported in legacy mono.dll
 */
MONO_API MonoClass *mono_unity_class_get_generic_argument_at(MonoClass *klass, int index);

/**
 * Check if a method is a generic method (has type parameters)
 * Version differences (different bit positions):
 * - Legacy mono.dll: (method->flags >> 10) & 1
 * - MonoBleedingEdge: (method->flags >> 11) & 1
 */
MONO_API int unity_mono_method_is_generic(MonoMethod *method);

/**
 * Check if a method is an instantiated generic method
 * Version differences (different bit positions):
 * - Legacy mono.dll: (method->flags >> 11) & 1
 * - MonoBleedingEdge: (method->flags >> 12) & 1
 */
MONO_API int unity_mono_method_is_inflated(MonoMethod *method);

/**
 * Extract MonoMethod* from a MethodInfo (MonoReflectionMethod) object
 * Implementation: return methodInfo ? *(methodInfo + 16) : NULL
 * This is crucial for makeGenericMethod via reflection
 */
MONO_API MonoMethod *unity_mono_reflection_method_get_method(MonoReflectionMethod *method);

/**
 * Check if a class is abstract
 * Implementation: return klass->flags & 0x80
 */
MONO_API int mono_unity_class_is_abstract(MonoClass *klass);

/**
 * Check if a class is an interface
 */
MONO_API int mono_unity_class_is_interface(MonoClass *klass);

/**
 * Fast thread attach to a domain (Unity-specific optimization)
 * Version differences:
 * - Legacy mono.dll: Returns pointer (previous state)
 * - MonoBleedingEdge: Returns void
 */
MONO_API void mono_unity_thread_fast_attach(MonoDomain *domain);

/**
 * Fast thread detach (Unity-specific optimization)
 * NOTE: Takes NO parameters
 */
MONO_API void mono_unity_thread_fast_detach(void);

/**
 * Unity object creation
 */
MONO_API MonoObject *mono_unity_object_new(MonoDomain *domain, MonoClass *klass);

/**
 * Unity runtime invoke
 */
MONO_API MonoObject *mono_unity_runtime_invoke(MonoMethod *method, void *obj, void **params, MonoObject **exc);

/**
 * Unity string creation
 */
MONO_API MonoString *mono_unity_string_new(MonoDomain *domain, const char *text);

/**
 * Unity array creation
 */
MONO_API MonoArray *mono_unity_array_new(MonoDomain *domain, MonoClass *eclass, int n);

/**
 * Unity 2D array creation
 */
MONO_API MonoArray *mono_unity_array_new_2d(MonoDomain *domain, MonoClass *eclass, int len1, int len2);

/**
 * Unity 3D array creation
 */
MONO_API MonoArray *mono_unity_array_new_3d(MonoDomain *domain, MonoClass *eclass, int len1, int len2, int len3);

/**
 * Unity liveness tracking APIs
 */
MONO_API void *mono_unity_liveness_allocate_struct(void *filter, int max_count, void *callback, void *userdata, void *onworldstart);
MONO_API void mono_unity_liveness_stop_gc_world(void *state);
MONO_API void mono_unity_liveness_finalize(void *state);
MONO_API void mono_unity_liveness_start_gc_world(void *state);
MONO_API void mono_unity_liveness_free_struct(void *state);
MONO_API void mono_unity_liveness_calculation_from_root(void *root, void *state);
MONO_API void mono_unity_liveness_calculation_from_statics(void *state);

/**
 * Get Unity TLS interface pointer
 * NOTE: Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
 */
MONO_API void *mono_unity_get_unitytls_interface(void);

/* ========================================================================
 * SECTION 3: Primitive Type Class Getters
 * Internal APIs to get MonoClass* for built-in types
 * ======================================================================== */

MONO_API MonoClass *mono_get_array_class(void);
MONO_API MonoClass *mono_get_boolean_class(void);
MONO_API MonoClass *mono_get_byte_class(void);
MONO_API MonoClass *mono_get_char_class(void);
MONO_API MonoClass *mono_get_int16_class(void);
MONO_API MonoClass *mono_get_int32_class(void);
MONO_API MonoClass *mono_get_int64_class(void);
MONO_API MonoClass *mono_get_single_class(void);
MONO_API MonoClass *mono_get_double_class(void);
MONO_API MonoClass *mono_get_string_class(void);
MONO_API MonoClass *mono_get_object_class(void);
MONO_API MonoClass *mono_get_enum_class(void);
MONO_API MonoClass *mono_get_exception_class(void);
MONO_API MonoClass *mono_get_void_class(void);
MONO_API MonoClass *mono_get_intptr_class(void);
MONO_API MonoClass *mono_get_uintptr_class(void);
MONO_API MonoClass *mono_get_sbyte_class(void);
MONO_API MonoClass *mono_get_uint16_class(void);
MONO_API MonoClass *mono_get_uint32_class(void);
MONO_API MonoClass *mono_get_uint64_class(void);

/* ========================================================================
 * SECTION 4: API Aliases (declared in comments for generator)
 * Standard internal API aliases - many public APIs have _internal variants
 * ======================================================================== */

/* @alias mono_get_root_domain_internal */
/* @alias mono_thread_attach_internal */
/* @alias mono_thread_detach_internal */
/* @alias mono_domain_set_internal */
/* @alias mono_assembly_get_image_internal */
/* @alias mono_assembly_get_name_internal */
/* @alias mono_class_from_mono_type_internal */
/* @alias mono_method_signature_internal */
/* @alias mono_object_get_size_internal */
/* @alias mono_object_get_vtable_internal */
/* @alias mono_lookup_internal */
/* @alias mono_threads_enter_gc_safe_region_internal */
/* @alias mono_threads_exit_gc_safe_region_internal */
/* @alias mono_threads_exit_gc_unsafe_region_internal */
/* @alias mono_vtable_class_internal */
/* @alias mono_vtable_domain_internal */

/* ========================================================================
 * SECTION 4: Cross-DLL Intersection APIs (Missing from Public Headers)
 * These APIs are exported by both mono.dll and mono-2.0-bdwgc.dll
 * but don't have MONO_API declarations in mono repo headers
 * ======================================================================== */

/**
 * Legacy profiler installation functions (MONO_DEPRECATED in mono repo)
 * Available in both mono.dll and mono-2.0-bdwgc.dll for backward compatibility
 * Type definitions from mono/metadata/profiler-legacy.h
 */
typedef void *MonoLegacyProfiler;
typedef void (*MonoLegacyProfileFunc)(MonoLegacyProfiler *prof);
typedef void (*MonoLegacyProfileThreadFunc)(MonoLegacyProfiler *prof, uintptr_t tid);
typedef void (*MonoLegacyProfileAllocFunc)(MonoLegacyProfiler *prof, MonoObject *obj, MonoClass *klass);

/**
 * Install a profiler instance with callback
 */
MONO_API void mono_profiler_install(MonoLegacyProfiler *prof, MonoLegacyProfileFunc callback);

/**
 * Install thread lifecycle callbacks
 */
MONO_API void mono_profiler_install_thread(MonoLegacyProfileThreadFunc start, MonoLegacyProfileThreadFunc end);

/**
 * Install object allocation callback
 */
MONO_API void mono_profiler_install_allocation(MonoLegacyProfileAllocFunc callback);

/**
 * Unity-specific loader error handling
 * Returns last error and prepares an exception object
 * Signature inferred from naming convention and Unity loader patterns
 */
MONO_API MonoObject *mono_unity_loader_get_last_error_and_error_prepare_exception(MonoDomain *domain);

/* ========================================================================
 * SECTION 5: Additional Cross-DLL Common APIs (Analyzed via IDA Pro)
 * These signatures were extracted from mono.dll using reverse engineering
 * All APIs are confirmed to exist in both mono.dll and mono-2.0-bdwgc.dll
 * ======================================================================== */

/**
 * Parse assembly name string into components
 * Wrapper for internal assembly name parsing function
 */
MONO_API int mono_assembly_name_parse(const char *name, MonoAssemblyName *aname);

/**
 * Get userdata pointer from a class (offset 288)
 */
MONO_API void *mono_class_get_userdata(MonoClass *klass);

/**
 * Get the offset where userdata is stored in MonoClass structure
 * Returns: 288 (constant)
 */
MONO_API int mono_class_get_userdata_offset(void);

/**
 * Set userdata pointer for a class (offset 288)
 */
MONO_API void mono_class_set_userdata(MonoClass *klass, void *userdata);

/**
 * Get custom attributes as an iterator
 * @param attrs Custom attribute collection
 * @param iter Iterator state (pass pointer to 0 to start)
 * @return Next custom attribute object, or NULL when done
 */
MONO_API MonoObject *mono_custom_attrs_get_attrs(MonoCustomAttrInfo *attrs, gpointer *iter);

/**
 * Check if a GC handle is in a specific domain
 */
MONO_API gboolean mono_gchandle_is_in_domain(uint32_t gchandle, MonoDomain *domain);

/**
 * Install enter/leave callbacks for profiler (legacy API)
 */
MONO_API void mono_profiler_install_enter_leave(MonoLegacyProfileMethodFunc enter, MonoLegacyProfileMethodFunc leave);

/**
 * Install exception callbacks for profiler (legacy API)
 */
MONO_API void mono_profiler_install_exception(MonoLegacyProfileExceptionFunc throw_callback, MonoLegacyProfileMethodFunc exc_method_leave, MonoLegacyProfileExceptionClauseFunc clause_callback);

/**
 * Install GC callbacks for profiler (legacy API)
 */
MONO_API void mono_profiler_install_gc(MonoLegacyProfileGCFunc callback, MonoLegacyProfileGCResizeFunc heap_resize_callback);

/**
 * Install JIT end callback for profiler (legacy API)
 */
MONO_API void mono_profiler_install_jit_end(MonoLegacyProfileJitResult end);

/**
 * Set profiler event mask (legacy API)
 */
MONO_API void mono_profiler_set_events(int flags);

/**
 * Set policy for unhandled exceptions
 */
MONO_API void mono_runtime_unhandled_exception_policy_set(int policy);

/**
 * Set security mode
 */
MONO_API void mono_security_set_mode(int mode);

/**
 * Set assemblies path from null-separated string
 */
MONO_API void mono_set_assemblies_path_null_separated(const char *paths);

/**
 * Set callback for plugin loading
 */
MONO_API void mono_set_find_plugin_callback(void *callback);

/**
 * Cleanup thread pool
 */
MONO_API void mono_thread_pool_cleanup(void);

/**
 * Pop app domain reference from thread
 */
MONO_API void mono_thread_pop_appdomain_ref(void);

/**
 * Push app domain reference to thread
 */
MONO_API void mono_thread_push_appdomain_ref(MonoDomain *domain);

/**
 * Suspend all threads except current (used during shutdown)
 */
MONO_API void mono_thread_suspend_all_other_threads(void);

/**
 * Mark runtime as shutting down
 */
MONO_API void mono_threads_set_shutting_down(void);

/**
 * Get backtrace from exception context (Unity wrapper)
 */
MONO_API void *mono_unity_backtrace_from_context(void *ctx);

/**
 * Get MonoClass from image and type (Unity wrapper for mono_class_get)
 */
MONO_API MonoClass *mono_unity_class_get(MonoImage *image, uint32_t type_token);

/**
 * Set domain config (Unity stub - no-op)
 */
MONO_API void mono_unity_domain_set_config(MonoDomain *domain, const char *base_dir, const char *config_file_name);

/**
 * Free memory allocated by Unity (wrapper for g_free)
 */
MONO_API void mono_unity_g_free(void *ptr);

/**
 * Get Unity data directory
 */
MONO_API const char *mono_unity_get_data_dir(void);

/**
 * Install Unity memory allocation callbacks
 */
MONO_API void mono_unity_install_memory_callbacks(void *callbacks);

/**
 * Unity JIT cleanup with thread shutdown
 */
MONO_API void mono_unity_jit_cleanup(MonoDomain *domain);

/**
 * Register path remapper callback
 */
MONO_API void mono_unity_register_path_remapper(void *callback);

/**
 * Set main arguments (Unity wrapper)
 */
MONO_API void mono_unity_runtime_set_main_args(int argc, char **argv);

/**
 * Set Unity data directory
 */
MONO_API void mono_unity_set_data_dir(const char *dir);

/**
 * Set embedding host name
 */
MONO_API void mono_unity_set_embeddinghostname(const char *name);

/**
 * Set vprintf callback function
 */
MONO_API void mono_unity_set_vprintf_func(void *func);

/**
 * Enable/disable socket security
 */
MONO_API void mono_unity_socket_security_enabled_set(int enabled);

/**
 * Get empty string wrapper (returns empty MonoString)
 */
MONO_API MonoString *mono_unity_string_empty_wrapper(void);

/**
 * Upgrade remote class wrapper
 */
MONO_API void mono_upgrade_remote_class_wrapper(MonoObject *obj, MonoClass *klass);

/**
 * Set verifier mode
 */
MONO_API void mono_verifier_set_mode(int mode);

/**
 * Check if method is generic (Unity helper)
 */
MONO_API gboolean unity_mono_method_is_generic(MonoMethod *method);

/**
 * Check if method is inflated (Unity helper)
 */
MONO_API gboolean unity_mono_method_is_inflated(MonoMethod *method);

/**
 * Get MonoMethod from reflection method object (Unity helper)
 */
MONO_API MonoMethod *unity_mono_reflection_method_get_method(MonoReflectionMethod *ref);

#endif /* __MONO_MANUAL_H__ */

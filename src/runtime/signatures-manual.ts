import type { MonoSignatureMap, MonoSignatureOverrides } from "./signatures-types";

/**
 * Manual API signature additions for Mono runtime.
 *
 * Organization:
 * 1. Standard Mono APIs (not in public headers but commonly available)
 * 2. Unity-specific APIs (prefixed with mono_unity_ or unity_mono_)
 * 3. Internal/helper APIs
 *
 * Priority: Standard Mono APIs are preferred over Unity-specific alternatives.
 * Use aliases (in MANUAL_OVERRIDES) to map Unity APIs to standard equivalents.
 *
 * Signatures verified via IDA Pro analysis of:
 * - mono.dll: Legacy Mono runtime (older Unity versions)
 * - mono-2.0-bdwgc.dll: MonoBleedingEdge runtime with Boehm-Demers-Weiser GC (newer Unity versions)
 *
 * Note: API availability depends on Mono runtime version, not Unity version directly.
 */
export const MANUAL_ADDITIONS: MonoSignatureMap = {
  // ============================================================================
  // SECTION 1: Standard Mono APIs (not in public headers)
  // These are internal APIs that exist in all Mono versions
  // Verified via IDA decompilation
  // ============================================================================

  // --- Generic Type/Class APIs ---

  /**
   * Check if a class is a generic type definition (has type parameters)
   *
   * Version differences:
   * - Legacy mono.dll: return (klass->flags2 >> 18) & 1
   * - MonoBleedingEdge: return klass->class_kind == 2
   */
  mono_class_is_generic: {
    name: "mono_class_is_generic",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* -> bool (int)
  },

  /**
   * Check if a class is an instantiated generic type
   *
   * Version differences:
   * - Legacy mono.dll: return (klass->flags2 >> 19) & 1
   * - MonoBleedingEdge: return klass->class_kind == 3
   */
  mono_class_is_inflated: {
    name: "mono_class_is_inflated",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* -> bool (int)
  },

  /**
   * Check if a type can be copied bit-by-bit (no managed references)
   * Implementation: return (klass->flags >> 5) & 1
   * Verified at 0x18001e45c in mono.dll
   */
  mono_class_is_blittable: {
    name: "mono_class_is_blittable",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* -> bool (int)
  },

  /**
   * Inflate a generic method with a generic context
   * Wraps mono_class_inflate_generic_method_full(method, NULL, context)
   * Verified at 0x180022ef4 in mono.dll
   */
  mono_class_inflate_generic_method: {
    name: "mono_class_inflate_generic_method",
    retType: "pointer",
    argTypes: ["pointer", "pointer"], // MonoMethod*, MonoGenericContext* -> MonoMethod*
  },

  /**
   * Inflate a generic method with full parameters
   * Verified at 0x180021b24 in mono.dll
   */
  mono_class_inflate_generic_method_full: {
    name: "mono_class_inflate_generic_method_full",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer"], // MonoMethod*, MonoClass*, MonoGenericContext* -> MonoMethod*
  },

  /**
   * Get inflated method (identity function in some versions)
   * Verified at 0x18001c76c in mono.dll - simply returns the input
   */
  mono_get_inflated_method: {
    name: "mono_get_inflated_method",
    retType: "pointer",
    argTypes: ["pointer"], // MonoMethod* -> MonoMethod*
  },

  /**
   * Parse a type name and return MonoType*
   * Verified at 0x180090fe0 in mono.dll
   */
  mono_reflection_type_from_name: {
    name: "mono_reflection_type_from_name",
    retType: "pointer",
    argTypes: ["pointer", "pointer"], // const char* name, MonoImage* image -> MonoType*
  },

  // --- Generic Method APIs (newer versions only) ---

  /**
   * Get the generic container for a generic method definition
   * Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
   */
  mono_method_get_generic_container: {
    name: "mono_method_get_generic_container",
    retType: "pointer",
    argTypes: ["pointer"], // MonoMethod* -> MonoGenericContainer*
  },

  /**
   * Check if a type is a generic parameter (T, TKey, etc.)
   * Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
   */
  mono_type_is_generic_parameter: {
    name: "mono_type_is_generic_parameter",
    retType: "int",
    argTypes: ["pointer"], // MonoType* -> bool (int)
  },

  // --- Reflection APIs ---

  /**
   * Get MonoType* from a System.Type reflection object
   * Note: In legacy mono.dll, use mono_reflection_type_get_handle instead
   * Available in MonoBleedingEdge (mono-2.0-bdwgc.dll)
   */
  mono_reflection_type_get_type: {
    name: "mono_reflection_type_get_type",
    retType: "pointer",
    argTypes: ["pointer"], // MonoReflectionType* -> MonoType*
  },

  // ============================================================================
  // SECTION 2: Unity-specific Mono APIs
  // These exist in Unity's custom Mono runtime and may have standard equivalents
  // Verified via IDA Pro analysis of Unity mono.dll
  // ============================================================================

  // --- Unity Generic Type APIs ---

  /**
   * Get the number of generic parameters for a generic type definition
   * Implementation: return klass->generic_container ? (klass->generic_container->type_argc * 2) >> 1 : 0
   * Verified at 0x1801547e4 in mono.dll
   */
  mono_unity_class_get_generic_parameter_count: {
    name: "mono_unity_class_get_generic_parameter_count",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* (generic definition) -> int
  },

  /**
   * Get a specific generic parameter from a generic type definition
   * Implementation: mono_class_from_generic_parameter(container->type_params[index], klass->image, 0)
   * Verified at 0x1801547b0 in mono.dll
   */
  mono_unity_class_get_generic_parameter_at: {
    name: "mono_unity_class_get_generic_parameter_at",
    retType: "pointer",
    argTypes: ["pointer", "int"], // MonoClass*, index -> MonoClass*
  },

  /**
   * Get the generic type definition from an instantiated generic type
   * e.g., List<int> -> List<T>
   * Implementation: return klass->generic_class ? get_container_class() : NULL
   * Verified at 0x180154794 in mono.dll
   */
  mono_unity_class_get_generic_type_definition: {
    name: "mono_unity_class_get_generic_type_definition",
    retType: "pointer",
    argTypes: ["pointer"], // MonoClass* (instantiated) -> MonoClass* (definition)
  },

  /**
   * Get the number of generic arguments for an instantiated generic type
   * NOTE: Only available in MonoBleedingEdge, not exported in legacy mono.dll
   */
  mono_unity_class_get_generic_argument_count: {
    name: "mono_unity_class_get_generic_argument_count",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* (instantiated generic) -> int
  },

  /**
   * Get a specific generic argument type from an instantiated generic type
   * NOTE: Only available in MonoBleedingEdge, not exported in legacy mono.dll
   */
  mono_unity_class_get_generic_argument_at: {
    name: "mono_unity_class_get_generic_argument_at",
    retType: "pointer",
    argTypes: ["pointer", "int"], // MonoClass*, index -> MonoClass*
  },

  // --- Unity Generic Method APIs ---

  /**
   * Check if a method is a generic method (has type parameters)
   *
   * Version differences (different bit positions):
   * - Legacy mono.dll: (method->flags >> 10) & 1
   * - MonoBleedingEdge: (method->flags >> 11) & 1
   */
  unity_mono_method_is_generic: {
    name: "unity_mono_method_is_generic",
    retType: "int",
    argTypes: ["pointer"], // MonoMethod* -> bool (int)
  },

  /**
   * Check if a method is an instantiated generic method
   *
   * Version differences (different bit positions):
   * - Legacy mono.dll: (method->flags >> 11) & 1
   * - MonoBleedingEdge: (method->flags >> 12) & 1
   */
  unity_mono_method_is_inflated: {
    name: "unity_mono_method_is_inflated",
    retType: "int",
    argTypes: ["pointer"], // MonoMethod* -> bool (int)
  },

  // NOTE: The following APIs do NOT exist in any known Mono version:
  // - mono_unity_method_make_generic (use reflection MethodInfo.MakeGenericMethod instead)
  // - mono_unity_method_get_generic_argument_count
  // - mono_unity_method_get_generic_argument_at

  // --- Unity Reflection APIs ---

  /**
   * Extract MonoMethod* from a MethodInfo (MonoReflectionMethod) object
   * Implementation: return methodInfo ? *(methodInfo + 16) : NULL
   * Verified at 0x180154698 in mono.dll
   * This is crucial for makeGenericMethod via reflection
   */
  unity_mono_reflection_method_get_method: {
    name: "unity_mono_reflection_method_get_method",
    retType: "pointer",
    argTypes: ["pointer"], // MonoReflectionMethod* -> MonoMethod*
  },

  // --- Unity Class Utility APIs ---

  /**
   * Check if a class is abstract
   * Implementation: return klass->flags & 0x80
   * Verified at 0x1801545b4 in mono.dll
   */
  mono_unity_class_is_abstract: {
    name: "mono_unity_class_is_abstract",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* -> bool (int)
  },

  /**
   * Check if a class is an interface
   * Implementation: checks flags and bytecode
   * Verified at 0x180154594 in mono.dll
   */
  mono_unity_class_is_interface: {
    name: "mono_unity_class_is_interface",
    retType: "int",
    argTypes: ["pointer"], // MonoClass* -> bool (int)
  },

  // --- Unity Threading APIs ---

  /**
   * Fast thread attach to a domain (Unity-specific optimization)
   * Implementation: Performs domain switch, pushes appdomain ref
   *
   * Version differences:
   * - Legacy mono.dll: Returns pointer (previous state)
   * - MonoBleedingEdge: Returns void
   *
   * @param domain MonoDomain* to attach to
   */
  mono_unity_thread_fast_attach: {
    name: "mono_unity_thread_fast_attach",
    retType: "void", // MonoBleedingEdge returns void; legacy returns pointer (but unused)
    argTypes: ["pointer"], // MonoDomain*
  },

  /**
   * Fast thread detach (Unity-specific optimization)
   * Implementation: Restores root domain, pops appdomain reference
   * Verified in both mono.dll and mono-2.0-bdwgc.dll
   * NOTE: Takes NO parameters (verified via decompilation)
   */
  mono_unity_thread_fast_detach: {
    name: "mono_unity_thread_fast_detach",
    retType: "void",
    argTypes: [], // NO parameters - verified via IDA
  },

  // --- Unity Object/Runtime APIs ---

  mono_unity_object_new: {
    name: "mono_unity_object_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"], // MonoDomain*, MonoClass* -> MonoObject*
  },

  mono_unity_runtime_invoke: {
    name: "mono_unity_runtime_invoke",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer", "pointer"], // MonoMethod*, obj, params, exc -> MonoObject*
  },

  mono_unity_string_new: {
    name: "mono_unity_string_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"], // MonoDomain*, const char* -> MonoString*
  },

  mono_unity_array_new: {
    name: "mono_unity_array_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int"], // MonoDomain*, MonoClass*, length -> MonoArray*
  },

  // Unity 2D/3D array creation
  mono_unity_array_new_2d: {
    name: "mono_unity_array_new_2d",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int", "int"], // MonoDomain*, MonoClass*, len1, len2 -> MonoArray*
  },

  mono_unity_array_new_3d: {
    name: "mono_unity_array_new_3d",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int", "int", "int"], // MonoDomain*, MonoClass*, len1, len2, len3 -> MonoArray*
  },

  // --- Unity Liveness Tracking APIs ---

  mono_unity_liveness_allocate_struct: {
    name: "mono_unity_liveness_allocate_struct",
    retType: "pointer",
    argTypes: ["pointer", "int", "pointer", "pointer", "pointer"],
  },
  mono_unity_liveness_stop_gc_world: {
    name: "mono_unity_liveness_stop_gc_world",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_unity_liveness_finalize: {
    name: "mono_unity_liveness_finalize",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_unity_liveness_start_gc_world: {
    name: "mono_unity_liveness_start_gc_world",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_unity_liveness_free_struct: {
    name: "mono_unity_liveness_free_struct",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_unity_liveness_calculation_from_root: {
    name: "mono_unity_liveness_calculation_from_root",
    retType: "void",
    argTypes: ["pointer", "pointer"],
  },
  mono_unity_liveness_calculation_from_statics: {
    name: "mono_unity_liveness_calculation_from_statics",
    retType: "void",
    argTypes: ["pointer"],
  },

  // --- Unity TLS (MonoBleedingEdge only) ---

  /**
   * Get Unity TLS interface pointer
   * NOTE: Only available in MonoBleedingEdge (mono-2.0-bdwgc.dll), not in legacy mono.dll
   */
  mono_unity_get_unitytls_interface: {
    name: "mono_unity_get_unitytls_interface",
    retType: "pointer",
    argTypes: [],
  },

  // ============================================================================
  // SECTION 3: Primitive Type Class Getters
  // Internal APIs to get MonoClass* for built-in types
  // ============================================================================

  mono_get_array_class: {
    name: "mono_get_array_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_boolean_class: {
    name: "mono_get_boolean_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_byte_class: {
    name: "mono_get_byte_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_char_class: {
    name: "mono_get_char_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_int16_class: {
    name: "mono_get_int16_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_int32_class: {
    name: "mono_get_int32_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_int64_class: {
    name: "mono_get_int64_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_single_class: {
    name: "mono_get_single_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_double_class: {
    name: "mono_get_double_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_string_class: {
    name: "mono_get_string_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_object_class: {
    name: "mono_get_object_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_enum_class: {
    name: "mono_get_enum_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_exception_class: {
    name: "mono_get_exception_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_void_class: {
    name: "mono_get_void_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_intptr_class: {
    name: "mono_get_intptr_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_uintptr_class: {
    name: "mono_get_uintptr_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_sbyte_class: {
    name: "mono_get_sbyte_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_uint16_class: {
    name: "mono_get_uint16_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_uint32_class: {
    name: "mono_get_uint32_class",
    retType: "pointer",
    argTypes: [],
  },
  mono_get_uint64_class: {
    name: "mono_get_uint64_class",
    retType: "pointer",
    argTypes: [],
  },
};

/**
 * API name aliases and overrides.
 *
 * Use this to:
 * 1. Map internal API names to public API names
 * 2. Map Unity-specific APIs to standard alternatives
 * 3. Handle naming variations between Mono versions
 *
 * The first available name in [primary, ...aliases] will be used.
 */
export const MANUAL_OVERRIDES: MonoSignatureOverrides = {
  // ============================================================================
  // Standard internal API aliases
  // Many public APIs have _internal variants in some Mono builds
  // ============================================================================

  mono_get_root_domain: {
    aliases: ["mono_get_root_domain_internal"],
  },
  mono_thread_attach: {
    aliases: ["mono_thread_attach_internal"],
  },
  mono_thread_detach: {
    aliases: ["mono_thread_detach_internal"],
  },
  mono_domain_set: {
    aliases: ["mono_domain_set_internal"],
  },
  mono_assembly_get_image: {
    aliases: ["mono_assembly_get_image_internal"],
  },
  mono_assembly_get_name: {
    aliases: ["mono_assembly_get_name_internal"],
  },
  mono_class_from_mono_type: {
    aliases: ["mono_class_from_mono_type_internal"],
  },
  mono_method_signature: {
    aliases: ["mono_method_signature_internal"],
  },
  mono_object_get_size: {
    aliases: ["mono_object_get_size_internal"],
  },
  mono_object_get_vtable: {
    aliases: ["mono_object_get_vtable_internal"],
  },
  mono_lookup: {
    aliases: ["mono_lookup_internal"],
  },
  mono_threads_enter_gc_safe_region: {
    aliases: ["mono_threads_enter_gc_safe_region_internal"],
  },
  mono_threads_exit_gc_safe_region: {
    aliases: ["mono_threads_exit_gc_safe_region_internal"],
  },
  mono_threads_exit_gc_unsafe_region: {
    aliases: ["mono_threads_exit_gc_unsafe_region_internal"],
  },
  mono_vtable_class: {
    aliases: ["mono_vtable_class_internal"],
  },
  mono_vtable_domain: {
    aliases: ["mono_vtable_domain_internal"],
  },

  // ============================================================================
  // Reflection API version compatibility
  // Handle naming differences between Mono versions
  // ============================================================================

  // mono_reflection_type_get_type is newer (2022.3+), _get_handle is older
  mono_reflection_type_get_type: {
    aliases: ["mono_reflection_type_get_handle"],
  },

  // ============================================================================
  // Unity API to standard API mappings
  // Prefer standard APIs but fall back to Unity equivalents
  // ============================================================================

  // For method info -> method extraction, Unity has a dedicated function
  // Note: There's no direct standard equivalent exported, but Unity always has it
  unity_mono_reflection_method_get_method: {
    aliases: [], // No standard equivalent, this is Unity-only
  },
};

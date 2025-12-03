import type { MonoSignatureMap, MonoSignatureOverrides } from "./types";

export const MANUAL_ADDITIONS: MonoSignatureMap = {
  // ============================================
  // Standard Mono APIs not in public headers
  // ============================================
  
  // Generic type support (standard Mono, not Unity-specific)
  mono_class_is_generic: {
    name: "mono_class_is_generic",
    retType: "int",
    argTypes: ["pointer"],  // MonoClass* -> int (bool)
  },
  mono_class_is_inflated: {
    name: "mono_class_is_inflated",
    retType: "int",
    argTypes: ["pointer"],  // MonoClass* -> int (bool)
  },
  mono_class_is_blittable: {
    name: "mono_class_is_blittable",
    retType: "int",
    argTypes: ["pointer"],  // MonoClass* -> int (bool)
  },
  
  // ============================================
  // Unity-specific Mono APIs
  // ============================================
  
  // Unity generic type APIs
  mono_unity_class_get_generic_argument_count: {
    name: "mono_unity_class_get_generic_argument_count",
    retType: "int",
    argTypes: ["pointer"],  // MonoClass*
  },
  mono_unity_class_get_generic_argument_at: {
    name: "mono_unity_class_get_generic_argument_at",
    retType: "pointer",
    argTypes: ["pointer", "int"],  // MonoClass*, index -> MonoClass*
  },
  mono_unity_class_get_generic_parameter_count: {
    name: "mono_unity_class_get_generic_parameter_count",
    retType: "int",
    argTypes: ["pointer"],  // MonoClass*
  },
  mono_unity_class_get_generic_type_definition: {
    name: "mono_unity_class_get_generic_type_definition",
    retType: "pointer",
    argTypes: ["pointer"],  // MonoClass* -> MonoClass*
  },
  
  // Unity method generic APIs
  mono_unity_method_get_generic_argument_count: {
    name: "mono_unity_method_get_generic_argument_count",
    retType: "int",
    argTypes: ["pointer"],  // MonoMethod*
  },
  mono_unity_method_get_generic_argument_at: {
    name: "mono_unity_method_get_generic_argument_at",
    retType: "pointer",
    argTypes: ["pointer", "int"],  // MonoMethod*, index -> MonoClass*
  },
  mono_unity_method_is_generic: {
    name: "mono_unity_method_is_generic",
    retType: "int",
    argTypes: ["pointer"],  // MonoMethod*
  },
  
  // Unity object/runtime APIs
  mono_unity_object_new: {
    name: "mono_unity_object_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],  // MonoDomain*, MonoClass* -> MonoObject*
  },
  mono_unity_runtime_invoke: {
    name: "mono_unity_runtime_invoke",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer", "pointer"],  // MonoMethod*, obj, params, exc -> MonoObject*
  },
  mono_unity_string_new: {
    name: "mono_unity_string_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],  // MonoDomain*, const char* -> MonoString*
  },
  mono_unity_array_new: {
    name: "mono_unity_array_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int"],  // MonoDomain*, MonoClass*, length -> MonoArray*
  },
  
  // Unity liveness tracking APIs
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
  
  // Unity TLS
  mono_unity_get_unitytls_interface: {
    name: "mono_unity_get_unitytls_interface",
    retType: "pointer",
    argTypes: [],
  },
  
  // ============================================
  // Primitive type class getters (internal APIs)
  // ============================================
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

export const MANUAL_OVERRIDES: MonoSignatureOverrides = {
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
};

import type { MonoSignatureMap, MonoSignatureOverrides } from "./types";

export const MANUAL_ADDITIONS: MonoSignatureMap = {
  // Unity-specific or internal Mono APIs not in public headers
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

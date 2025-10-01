export interface MonoExportSignature {
  /** Canonical export name as published by the Mono C embedding API */
  name: string;
  /** Frida NativeFunction return type */
  retType: string;
  /** Frida NativeFunction argument types */
  argTypes: string[];
  /** Known alias names that appear on specific builds */
  aliases?: string[];
}

export type MonoApiName = keyof typeof MONO_EXPORTS;

export const MONO_EXPORTS = {
  mono_get_root_domain: {
    name: "mono_get_root_domain",
    retType: "pointer",
    argTypes: [],
    aliases: ["mono_get_root_domain_internal"],
  },
  mono_thread_attach: {
    name: "mono_thread_attach",
    retType: "pointer",
    argTypes: ["pointer"],
    aliases: ["mono_thread_attach_internal"],
  },
  mono_thread_detach: {
    name: "mono_thread_detach",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_domain_get: {
    name: "mono_domain_get",
    retType: "pointer",
    argTypes: [],
  },
  mono_domain_set: {
    name: "mono_domain_set",
    retType: "void",
    argTypes: ["pointer", "pointer"],
  },
  mono_domain_assembly_open: {
    name: "mono_domain_assembly_open",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_assembly_open: {
    name: "mono_assembly_open",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_assembly_get_image: {
    name: "mono_assembly_get_image",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_image_loaded: {
    name: "mono_image_loaded",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_class_from_name: {
    name: "mono_class_from_name",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer"],
  },
  mono_class_get_method_from_name: {
    name: "mono_class_get_method_from_name",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int"],
  },
  mono_class_get_field_from_name: {
    name: "mono_class_get_field_from_name",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_class_get_property_from_name: {
    name: "mono_class_get_property_from_name",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_property_get_get_method: {
    name: "mono_property_get_get_method",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_property_get_set_method: {
    name: "mono_property_get_set_method",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_method_desc_new: {
    name: "mono_method_desc_new",
    retType: "pointer",
    argTypes: ["pointer", "bool"],
  },
  mono_method_desc_free: {
    name: "mono_method_desc_free",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_method_desc_search_in_image: {
    name: "mono_method_desc_search_in_image",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_method_signature: {
    name: "mono_method_signature",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_signature_get_param_count: {
    name: "mono_signature_get_param_count",
    retType: "int",
    argTypes: ["pointer"],
  },
  mono_method_get_name: {
    name: "mono_method_get_name",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_object_new: {
    name: "mono_object_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_object_get_class: {
    name: "mono_object_get_class",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_object_unbox: {
    name: "mono_object_unbox",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_value_box: {
    name: "mono_value_box",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer"],
  },
  mono_string_new: {
    name: "mono_string_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer"],
  },
  mono_string_new_len: {
    name: "mono_string_new_len",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int"],
  },
  mono_array_new: {
    name: "mono_array_new",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "int"],
  },
  mono_array_length: {
    name: "mono_array_length",
    retType: "int",
    argTypes: ["pointer"],
  },
  mono_array_addr_with_size: {
    name: "mono_array_addr_with_size",
    retType: "pointer",
    argTypes: ["pointer", "int", "uint"],
  },
  mono_image_get_table_info: {
    name: "mono_image_get_table_info",
    retType: "pointer",
    argTypes: ["pointer", "int"],
  },
  mono_table_info_get_rows: {
    name: "mono_table_info_get_rows",
    retType: "int",
    argTypes: ["pointer"],
  },
  mono_table_info_get: {
    name: "mono_table_info_get",
    retType: "pointer",
    argTypes: ["pointer", "int"],
  },
  mono_field_get_value: {
    name: "mono_field_get_value",
    retType: "void",
    argTypes: ["pointer", "pointer", "pointer"],
  },
  mono_field_set_value: {
    name: "mono_field_set_value",
    retType: "void",
    argTypes: ["pointer", "pointer", "pointer"],
  },
  mono_runtime_invoke: {
    name: "mono_runtime_invoke",
    retType: "pointer",
    argTypes: ["pointer", "pointer", "pointer", "pointer"],
  },
  mono_runtime_object_init: {
    name: "mono_runtime_object_init",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_add_internal_call: {
    name: "mono_add_internal_call",
    retType: "void",
    argTypes: ["pointer", "pointer"],
  },
  mono_free: {
    name: "mono_free",
    retType: "void",
    argTypes: ["pointer"],
  },
  mono_gchandle_new: {
    name: "mono_gchandle_new",
    retType: "uint",
    argTypes: ["pointer", "bool"],
  },
  mono_gchandle_new_weakref: {
    name: "mono_gchandle_new_weakref",
    retType: "uint",
    argTypes: ["pointer", "bool"],
  },
  mono_gchandle_free: {
    name: "mono_gchandle_free",
    retType: "void",
    argTypes: ["uint"],
  },
  mono_gchandle_get_target: {
    name: "mono_gchandle_get_target",
    retType: "pointer",
    argTypes: ["uint"],
  },
  mono_get_delegate_invoke: {
    name: "mono_get_delegate_invoke",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_method_get_unmanaged_thunk: {
    name: "mono_method_get_unmanaged_thunk",
    retType: "pointer",
    argTypes: ["pointer"],
  },
  mono_delegate_ctor: {
    name: "mono_delegate_ctor",
    retType: "void",
    argTypes: ["pointer", "pointer", "pointer"],
  },
  mono_gc_collect: {
    name: "mono_gc_collect",
    retType: "void",
    argTypes: ["int"],
  },
  mono_gc_get_heap_size: {
    name: "mono_gc_get_heap_size",
    retType: "size_t",
    argTypes: [],
  },
  mono_gc_get_used_size: {
    name: "mono_gc_get_used_size",
    retType: "size_t",
    argTypes: [],
  },
} satisfies Record<string, MonoExportSignature>;

export function getSignature(name: MonoApiName): MonoExportSignature {
  return MONO_EXPORTS[name];
}

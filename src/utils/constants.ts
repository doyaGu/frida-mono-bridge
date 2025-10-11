/**
 * Centralized constants for Mono operations
 * Reduces magic numbers and strings throughout the codebase
 */

// Mono type kinds from metadata.h
export const MONO_TYPE_KIND = {
  END: 0x00,       // End of List
  VOID: 0x01,      // void
  BOOLEAN: 0x02,   // bool
  CHAR: 0x03,      // char
  I1: 0x04,        // signed 8-bit integer
  U1: 0x05,        // unsigned 8-bit integer
  I2: 0x06,        // signed 16-bit integer
  U2: 0x07,        // unsigned 16-bit integer
  I4: 0x08,        // signed 32-bit integer
  U4: 0x09,        // unsigned 32-bit integer
  I8: 0x0a,        // signed 64-bit integer
  U8: 0x0b,        // unsigned 64-bit integer
  R4: 0x0c,        // 32-bit float
  R8: 0x0d,        // 64-bit float
  STRING: 0x0e,    // System.String
  PTR: 0x0f,       // pointer
  BYREF: 0x10,     // by reference
  VALUETYPE: 0x11, // System.ValueType
  CLASS: 0x12,     // System.Class
  VAR: 0x13,       // System.__Canon
  ARRAY: 0x14,     // System.Array
  GENERICINST: 0x15, // generic instance
  TYPEDBYREF: 0x16, // typed reference
  I: 0x18,         // System.IntPtr
  U: 0x19,         // System.UIntPtr
  FNPTR: 0x1b,     // function pointer
  OBJECT: 0x1c,    // System.Object
  SZARRAY: 0x1d,   // single-dim array with 0 lower bound
  MVAR: 0x1e,      // generic method parameter
  CMOD_REQD: 0x1f, // required modifier
  CMOD_OPT: 0x20,  // optional modifier
  INTERNAL: 0x21,  // Internal CLR type
  MODIFIER: 0x40,  // modifier (required or optional)
  SENTINEL: 0x41,  // sentinel for varargs method signature
  PINNED: 0x45,    // pinned local variable
} as const;

// Pointer-like types that need special handling
export const POINTER_LIKE_TYPES = new Set([
  MONO_TYPE_KIND.OBJECT,
  MONO_TYPE_KIND.SZARRAY,
  MONO_TYPE_KIND.STRING,
  MONO_TYPE_KIND.CLASS,
  MONO_TYPE_KIND.GENERICINST,
  MONO_TYPE_KIND.ARRAY,
  MONO_TYPE_KIND.PTR,
]);

// Primitive type sizes (in bytes)
export const PRIMITIVE_TYPE_SIZES = {
  [MONO_TYPE_KIND.BOOLEAN]: 1,
  [MONO_TYPE_KIND.CHAR]: 2,
  [MONO_TYPE_KIND.I1]: 1,
  [MONO_TYPE_KIND.U1]: 1,
  [MONO_TYPE_KIND.I2]: 2,
  [MONO_TYPE_KIND.U2]: 2,
  [MONO_TYPE_KIND.I4]: 4,
  [MONO_TYPE_KIND.U4]: 4,
  [MONO_TYPE_KIND.I8]: 8,
  [MONO_TYPE_KIND.U8]: 8,
  [MONO_TYPE_KIND.R4]: 4,
  [MONO_TYPE_KIND.R8]: 8,
  [MONO_TYPE_KIND.I]: 4, // IntPtr - platform dependent
  [MONO_TYPE_KIND.U]: 4, // UIntPtr - platform dependent
} as const;

// Common assembly names
export const COMMON_ASSEMBLIES = {
  UNITY_CORE_MODULE: "UnityEngine.CoreModule",
  ASSEMBLY_CSHARP: "Assembly-CSharp",
  ASSEMBLY_CSHARP_FIRSTPASS: "Assembly-CSharp-firstpass",
  SYSTEM_CORE: "System.Core",
  MSCORLIB: "mscorlib",
  SYSTEM: "System",
} as const;

// Common Unity class names
export const UNITY_CLASSES = {
  GAME_OBJECT: "UnityEngine.GameObject",
  COMPONENT: "UnityEngine.Component",
  TRANSFORM: "UnityEngine.Transform",
  MONO_BEHAVIOUR: "UnityEngine.MonoBehaviour",
  SCRIPTABLE_OBJECT: "UnityEngine.ScriptableObject",
  RESOURCE: "UnityEngine.Resource",
  ASSET_BUNDLE: "UnityEngine.AssetBundle",
  SCENE_MANAGER: "UnityEngine.SceneManagement.SceneManager",
  APPLICATION: "UnityEngine.Application",
  DEBUG: "UnityEngine.Debug",
  TIME: "UnityEngine.Time",
  INPUT: "UnityEngine.Input",
  CAMERA: "UnityEngine.Camera",
  AUDIOSOURCE: "UnityEngine.AudioSource",
  RIGIDBODY: "UnityEngine.Rigidbody",
  COLLIDER: "UnityEngine.Collider",
  RENDERER: "UnityEngine.Renderer",
  MESH_FILTER: "UnityEngine.MeshFilter",
  MESH_RENDERER: "UnityEngine.MeshRenderer",
  ANIMATOR: "UnityEngine.Animator",
  PARTICLE_SYSTEM: "UnityEngine.ParticleSystem",
  UI_TEXT: "UnityEngine.UI.Text",
  UI_IMAGE: "UnityEngine.UI.Image",
  UI_BUTTON: "UnityEngine.UI.Button",
  UI_CANVAS: "UnityEngine.Canvas",
} as const;

// Common method patterns
export const METHOD_PATTERNS = {
  GET_PREFIX: "get_",
  SET_PREFIX: "set_",
  ADD_PREFIX: "add_",
  REMOVE_PREFIX: "remove_",
  OPERATOR_PREFIX: "op_",
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NULL_POINTER: "Null pointer provided",
  INVALID_HANDLE: "Invalid Mono handle",
  THREAD_NOT_ATTACHED: "Current thread is not attached to Mono runtime",
  ASSEMBLY_NOT_FOUND: "Assembly not found",
  CLASS_NOT_FOUND: "Class not found",
  METHOD_NOT_FOUND: "Method not found",
  FIELD_NOT_FOUND: "Field not found",
  INVALID_ARGUMENTS: "Invalid method arguments",
  TYPE_MISMATCH: "Type mismatch",
  RUNTIME_ERROR: "Mono runtime error",
  MEMORY_ERROR: "Memory allocation error",
  THREAD_ERROR: "Thread management error",
} as const;

// Log levels and tags
export const LOG_CONFIG = {
  DEFAULT_TAG: "Mono",
  DEFAULT_LEVEL: "info",
  PATTERN_TAG: "Patterns",
  ERROR_TAG: "Error",
  THREAD_TAG: "Thread",
  MEMORY_TAG: "Memory",
  METHOD_TAG: "Method",
  ASSEMBLY_TAG: "Assembly",
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  DEFAULT_SIZE: 256,
  FUNCTION_CACHE_SIZE: 256,
  ADDRESS_CACHE_SIZE: 512,
  THUNK_CACHE_SIZE: 128,
  TTL_MS: 60000, // 1 minute
} as const;

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION: 100,    // Operations taking > 100ms are considered slow
  VERY_SLOW_OPERATION: 1000, // Operations taking > 1s are very slow
  MEMORY_THRESHOLD: 1024 * 1024, // 1MB
} as const;

// Method invocation flags
export const METHOD_FLAGS = {
  STATIC: 0x0010,
  FINAL: 0x0020,
  VIRTUAL: 0x0040,
  HIDE_BY_SIG: 0x0080,
  NEW_SLOT: 0x0100,
  ABSTRACT: 0x0400,
  SPECIAL_NAME: 0x0800,
  RTSPECIAL_NAME: 0x1000,
  HAS_SECURITY: 0x4000,
  REQUIRE_SEC_OBJECT: 0x8000,
} as const;

// Field access flags
export const FIELD_FLAGS = {
  FIELD_ACCESS_MASK: 0x0007,
  PRIVATE_SCOPE: 0x0000,
  PRIVATE: 0x0001,
  FAM_AND_ASSEM: 0x0002,
  ASSEMBLY: 0x0003,
  FAMILY: 0x0004,
  FAM_OR_ASSEM: 0x0005,
  PUBLIC: 0x0006,
  STATIC: 0x0010,
  INIT_ONLY: 0x0020,
  LITERAL: 0x0040,
  NOT_SERIALIZED: 0x0080,
  HAS_FIELD_RVA: 0x0100,
  SPECIAL_NAME: 0x0200,
  RTSPECIAL_NAME: 0x0400,
  HAS_FIELD_MARSHAL: 0x1000,
  HAS_DEFAULT: 0x8000,
  HAS_FIELD_DATA: 0x4000,
} as const;

// String constants
export const STRINGS = {
  EMPTY: "",
  SPACE: " ",
  NEWLINE: "\n",
  TAB: "\t",
  DOT: ".",
  COMMA: ",",
  COLON: ":",
  SEMICOLON: ";",
  PAREN_OPEN: "(",
  PAREN_CLOSE: ")",
  BRACKET_OPEN: "[",
  BRACKET_CLOSE: "]",
  BRACE_OPEN: "{",
  BRACE_CLOSE: "}",
  ANGLE_OPEN: "<",
  ANGLE_CLOSE: ">",
} as const;

// Regular expressions
export const REGEX_PATTERNS = {
  METHOD_SIGNATURE: /^([^:]+):([^()]+)\(([^)]*)\)$/,
  TYPE_NAME: /^[a-zA-Z_][a-zA-Z0-9_<>`.,+\-]*$/,
  ASSEMBLY_NAME: /^[a-zA-Z][a-zA-Z0-9._-]*$/,
  NAMESPACE: /^[a-zA-Z_][a-zA-Z0-9_.]*$/,
  GENERIC_TYPE: /`(\d+)$/,
} as const;

// Default values for various operations
export const DEFAULTS = {
  ARRAY_CAPACITY: 16,
  STRING_BUFFER_SIZE: 256,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 100,
  TIMEOUT_MS: 5000,
  BATCH_SIZE: 50,
} as const;

// Type conversion helpers
export function isPointerType(typeKind: number): boolean {
  const pointerTypes = [0x1, 0x2, 0x3, 0x4, 0x6, 0x8, 0x1c]; // OBJECT, SZARRAY, STRING, CLASS, GENERICINST, ARRAY, PTR
  return pointerTypes.includes(typeKind);
}

export function getPrimitiveTypeSize(typeKind: number): number | null {
  return PRIMITIVE_TYPE_SIZES[typeKind as keyof typeof PRIMITIVE_TYPE_SIZES] || null;
}

export function isCommonAssembly(name: string): boolean {
  return Object.values(COMMON_ASSEMBLIES).includes(name as any);
}

export function isUnityClass(name: string): boolean {
  return Object.values(UNITY_CLASSES).includes(name as any);
}
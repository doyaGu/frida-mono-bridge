/**
 * Centralized constants for Mono operations
 * Reduces magic numbers and strings throughout the codebase
 */

import { MonoEnums } from "../runtime/enums";

export const MONO_TYPE_KIND = MonoEnums.MonoTypeEnum;

// Pointer-like types that need special handling
export const POINTER_LIKE_TYPES = new Set([
  MONO_TYPE_KIND.MONO_TYPE_OBJECT,
  MONO_TYPE_KIND.MONO_TYPE_SZARRAY,
  MONO_TYPE_KIND.MONO_TYPE_STRING,
  MONO_TYPE_KIND.MONO_TYPE_CLASS,
  MONO_TYPE_KIND.MONO_TYPE_GENERICINST,
  MONO_TYPE_KIND.MONO_TYPE_ARRAY,
  MONO_TYPE_KIND.MONO_TYPE_PTR,
]);

// Primitive type sizes (in bytes)
export const PRIMITIVE_TYPE_SIZES = {
  [MONO_TYPE_KIND.MONO_TYPE_BOOLEAN]: 1,
  [MONO_TYPE_KIND.MONO_TYPE_CHAR]: 2,
  [MONO_TYPE_KIND.MONO_TYPE_I1]: 1,
  [MONO_TYPE_KIND.MONO_TYPE_U1]: 1,
  [MONO_TYPE_KIND.MONO_TYPE_I2]: 2,
  [MONO_TYPE_KIND.MONO_TYPE_U2]: 2,
  [MONO_TYPE_KIND.MONO_TYPE_I4]: 4,
  [MONO_TYPE_KIND.MONO_TYPE_U4]: 4,
  [MONO_TYPE_KIND.MONO_TYPE_I8]: 8,
  [MONO_TYPE_KIND.MONO_TYPE_U8]: 8,
  [MONO_TYPE_KIND.MONO_TYPE_R4]: 4,
  [MONO_TYPE_KIND.MONO_TYPE_R8]: 8,
  [MONO_TYPE_KIND.MONO_TYPE_I]: 4, // IntPtr - platform dependent
  [MONO_TYPE_KIND.MONO_TYPE_U]: 4, // UIntPtr - platform dependent
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


// Type conversion helpers
export function isPointerType(typeKind: number): boolean {
  const pointerTypes = [
    MONO_TYPE_KIND.MONO_TYPE_OBJECT,     // 0x1c
    MONO_TYPE_KIND.MONO_TYPE_SZARRAY,   // 0x1d
    MONO_TYPE_KIND.MONO_TYPE_STRING,    // 0x0e
    MONO_TYPE_KIND.MONO_TYPE_CLASS,     // 0x12
    MONO_TYPE_KIND.MONO_TYPE_GENERICINST, // 0x15
    MONO_TYPE_KIND.MONO_TYPE_ARRAY,     // 0x14
    MONO_TYPE_KIND.MONO_TYPE_PTR,       // 0x0f
  ];
  return pointerTypes.includes(typeKind as any);
}

export function getPrimitiveTypeSize(typeKind: number): number | null {
  return PRIMITIVE_TYPE_SIZES[typeKind as keyof typeof PRIMITIVE_TYPE_SIZES] || null;
}
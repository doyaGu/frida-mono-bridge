/**
 * Value Conversion Helper Module
 *
 * Provides unified value conversion, boxing, and unboxing utilities
 * for all Mono model types. Consolidates the scattered conversion logic
 * from property.ts, method.ts, and field.ts into a single source of truth.
 *
 * @module model/value-conversion
 */

import type { MonoApi } from "../runtime/api";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import {
  MonoType,
  MonoTypeKind,
  isArrayKind,
  isPrimitiveKind,
  readPrimitiveValue,
  writePrimitiveValue,
  type ValueReadOptions,
} from "./type";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for reading typed values from memory.
 */
export interface TypedReadOptions extends ValueReadOptions {
  /** Return MonoString/MonoObject wrapper instead of JS value */
  returnRaw?: boolean;
}

/**
 * Options for value conversion operations.
 */
export interface ConversionOptions extends ValueReadOptions {
  /** Target type for conversion */
  targetType?: MonoType;
}

/**
 * Numeric range definition for validation.
 */
interface NumericRange {
  min: number;
  max: number;
  name: string;
}

// ============================================================================
// NUMERIC RANGE DEFINITIONS
// ============================================================================

const NUMERIC_RANGES: Readonly<Record<string, NumericRange>> = Object.freeze({
  Byte: { min: 0, max: 255, name: "Byte" },
  "System.Byte": { min: 0, max: 255, name: "Byte" },
  SByte: { min: -128, max: 127, name: "SByte" },
  "System.SByte": { min: -128, max: 127, name: "SByte" },
  Int16: { min: -32768, max: 32767, name: "Int16" },
  "System.Int16": { min: -32768, max: 32767, name: "Int16" },
  UInt16: { min: 0, max: 65535, name: "UInt16" },
  "System.UInt16": { min: 0, max: 65535, name: "UInt16" },
  Int32: { min: -2147483648, max: 2147483647, name: "Int32" },
  "System.Int32": { min: -2147483648, max: 2147483647, name: "Int32" },
  UInt32: { min: 0, max: 4294967295, name: "UInt32" },
  "System.UInt32": { min: 0, max: 4294967295, name: "UInt32" },
});

// ============================================================================
// NUMERIC VALIDATION
// ============================================================================

/**
 * Validate a numeric value against its target type's range.
 *
 * @param value The numeric value to validate
 * @param typeName The target type name
 * @returns The validated (and possibly truncated) value
 * @throws MonoValidationError if value is out of range
 */
export function validateNumericValue(value: number, typeName: string): number {
  const range = NUMERIC_RANGES[typeName];
  if (range) {
    if (value < range.min || value > range.max) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Value ${value} is out of range for ${range.name} (${range.min} to ${range.max})`,
        `Provide a value within the valid range`,
      );
    }
    return Math.floor(value);
  }

  // Float types don't need range validation
  if (typeName === "Single" || typeName === "System.Single" || typeName === "Double" || typeName === "System.Double") {
    return value;
  }

  // Default: return as-is
  return value;
}

// ============================================================================
// PRIMITIVE VALUE ALLOCATION
// ============================================================================

/**
 * Allocate memory and write a primitive value for use as a method argument.
 *
 * IMPORTANT: mono_runtime_invoke expects a pointer to the raw value for value types,
 * NOT a boxed MonoObject*. This function returns the raw storage pointer.
 *
 * @param type The MonoType of the parameter
 * @param value The primitive value to write
 * @returns Pointer to the allocated memory containing the raw value
 */
export function allocPrimitiveValue(type: MonoType, value: number | boolean | bigint): NativePointer {
  const effectiveType = resolveUnderlyingPrimitive(type);
  const kind = effectiveType.kind;
  const { size } = effectiveType.valueSize;
  const storageSize = Math.max(size, Process.pointerSize);
  const storage = Memory.alloc(storageSize);

  // Handle boolean specially to ensure proper type conversion
  if (kind === MonoTypeKind.Boolean) {
    storage.writeU8(value ? 1 : 0);
    return storage;
  }

  // Handle bigint specially for 64-bit types
  if (typeof value === "bigint") {
    if (kind === MonoTypeKind.I8) {
      storage.writeS64(int64(value.toString()));
    } else if (kind === MonoTypeKind.U8) {
      storage.writeU64(uint64(value.toString()));
    } else {
      // Truncate to appropriate size
      storage.writeS64(int64(value.toString()));
    }
    return storage;
  }

  // Use unified primitive write for all other cases
  if (isPrimitiveKind(kind) || kind === MonoTypeKind.Char) {
    writePrimitiveValue(storage, kind, value);
    return storage;
  }

  // Fallback - write as pointer-sized value
  storage.writeS32(value as number);
  return storage;
}

/**
 * Resolve the underlying primitive type for enums and generic instances.
 */
export function resolveUnderlyingPrimitive(type: MonoType): MonoType {
  // Handle enum types
  if (type.kind === MonoTypeKind.Enum) {
    const underlying = type.underlyingType;
    if (underlying) {
      return underlying;
    }
  }

  // Handle generic instances that are value types
  if (type.kind === MonoTypeKind.GenericInstance && type.valueType) {
    // For generic value types, we need the actual instantiated type
    // which should already have the correct size information
    return type;
  }

  return type;
}

// ============================================================================
// VALUE UNBOXING
// ============================================================================

/**
 * Unbox a value from a boxed MonoObject pointer.
 *
 * @param api The MonoApi instance
 * @param boxedPtr Pointer to the boxed MonoObject
 * @param type The MonoType of the value
 * @param options Read options (e.g., returnBigInt)
 * @returns The unboxed value
 */
export function unboxValue(
  api: MonoApi,
  boxedPtr: NativePointer,
  type: MonoType,
  options: ValueReadOptions = {},
): unknown {
  if (pointerIsNull(boxedPtr)) {
    return null;
  }

  const unboxed = api.native.mono_object_unbox(boxedPtr);
  const kind = type.kind;

  // Try to read as primitive value first
  const primitiveResult = readPrimitiveValue(unboxed, kind, options);
  if (primitiveResult !== null) {
    return primitiveResult;
  }

  // Handle special cases
  switch (kind) {
    case MonoTypeKind.Enum: {
      const underlying = type.underlyingType;
      if (underlying) {
        return readPrimitiveValue(unboxed, underlying.kind, options);
      }
      return unboxed.readS32();
    }

    case MonoTypeKind.ValueType:
    case MonoTypeKind.GenericInstance:
      // Return pointer to the unboxed value for structs
      return unboxed;

    default:
      return unboxed;
  }
}

// ============================================================================
// JS TO MONO VALUE CONVERSION
// ============================================================================

/**
 * Convert a JavaScript value to a Mono-compatible value.
 *
 * Supports automatic conversion of:
 * - number -> Byte, SByte, Int16, UInt16, Int32, UInt32, Single, Double
 * - boolean -> Boolean, or numeric 0/1
 * - string -> String, Char
 * - bigint -> Int64, UInt64
 * - MonoObject -> passthrough
 * - NativePointer -> passthrough
 * - null/undefined -> null
 *
 * @param api The MonoApi instance
 * @param value The JavaScript value to convert
 * @param targetType The target MonoType
 * @returns The converted value suitable for Mono runtime
 */
export function convertJsToMono(api: MonoApi, value: unknown, targetType: MonoType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // Check if value is already a MonoObject-like
  if (typeof value === "object" && value !== null && "pointer" in value) {
    return value;
  }

  const typeName = targetType.name;

  // Handle by JavaScript type
  if (typeof value === "number") {
    return validateNumericValue(value, typeName);
  }

  if (typeof value === "boolean") {
    return convertBoolean(value, typeName, targetType);
  }

  if (typeof value === "string") {
    return convertString(api, value, typeName);
  }

  if (typeof value === "bigint") {
    return convertBigInt(value, typeName);
  }

  // Array handling - delegate to array conversion
  if (Array.isArray(value)) {
    return value; // Caller should handle array conversion with proper element type info
  }

  // NativePointer passthrough
  if (value instanceof NativePointer) {
    return value;
  }

  // Object/Dictionary handling - return as-is
  return value;
}

/**
 * Convert a boolean value to the target type.
 */
function convertBoolean(value: boolean, typeName: string, targetType: MonoType): unknown {
  if (typeName === "Boolean" || typeName === "System.Boolean") {
    return value;
  }
  // Convert boolean to number if target is numeric value type
  if (targetType.valueType) {
    return value ? 1 : 0;
  }
  return value;
}

/**
 * Convert a string value to the target type.
 */
function convertString(api: MonoApi, value: string, typeName: string): unknown {
  // String to MonoString conversion
  if (typeName === "String" || typeName === "System.String") {
    return api.stringNew(value);
  }
  // Char conversion (first character)
  if (typeName === "Char" || typeName === "System.Char") {
    if (value.length === 0) {
      raise(MonoErrorCodes.INVALID_ARGUMENT, "Cannot convert empty string to Char", "Provide a non-empty string");
    }
    return value.charCodeAt(0);
  }
  return value;
}

/**
 * Convert a bigint value to the target type.
 */
function convertBigInt(value: bigint, typeName: string): unknown {
  if (typeName === "Int64" || typeName === "System.Int64") {
    return int64(value.toString());
  }
  if (typeName === "UInt64" || typeName === "System.UInt64") {
    return uint64(value.toString());
  }
  // Fallback to number if within safe range
  if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  raise(
    MonoErrorCodes.INVALID_ARGUMENT,
    `BigInt value ${value} cannot be safely converted to target type ${typeName}`,
    "Use a smaller value or a compatible type",
  );
}

// ============================================================================
// MONO TO JS VALUE CONVERSION
// ============================================================================

/**
 * Convert a Mono value (from method result or field read) to JavaScript.
 *
 * @param api The MonoApi instance
 * @param rawResult The raw pointer result
 * @param type The MonoType of the value
 * @param options Read options
 * @returns The JavaScript value
 */
export function convertMonoToJs(
  api: MonoApi,
  rawResult: NativePointer,
  type: MonoType,
  options: TypedReadOptions = {},
): unknown {
  if (pointerIsNull(rawResult)) {
    return null;
  }

  const kind = type.kind;

  // Handle void
  if (kind === MonoTypeKind.Void) {
    return undefined;
  }

  // Handle string
  if (kind === MonoTypeKind.String) {
    if (options.returnRaw) {
      const { MonoString: MonoStringCtor } = require("./string");
      return new MonoStringCtor(api, rawResult);
    }
    return api.readMonoString(rawResult, false);
  }

  // Handle value types (need to unbox)
  if (type.valueType) {
    return unboxValue(api, rawResult, type, options);
  }

  // Handle arrays
  if (isArrayKind(kind)) {
    const { MonoArray: MonoArrayCtor } = require("./array");
    return new MonoArrayCtor(api, rawResult);
  }

  // Handle reference types - return wrapped MonoObject
  const { MonoObject: MonoObjectCtor } = require("./object");
  return new MonoObjectCtor(api, rawResult);
}

// ============================================================================
// INSTANCE RESOLUTION
// ============================================================================

/**
 * Resolve an instance parameter to a NativePointer.
 *
 * Handles MonoObject (using instancePointer for value types),
 * raw NativePointer, and null.
 *
 * @param instance The instance to resolve
 * @returns The resolved NativePointer or null
 */
export function resolveInstance(instance: unknown): NativePointer | null {
  if (instance === null || instance === undefined) {
    return null;
  }

  // Check for MonoObject-like with instancePointer
  if (typeof instance === "object" && instance !== null) {
    if ("instancePointer" in instance) {
      return (instance as { instancePointer: NativePointer }).instancePointer;
    }
    if ("pointer" in instance) {
      return (instance as { pointer: NativePointer }).pointer;
    }
  }

  // Raw NativePointer
  if (instance instanceof NativePointer) {
    if (pointerIsNull(instance)) {
      return null;
    }
    return instance;
  }

  return null;
}

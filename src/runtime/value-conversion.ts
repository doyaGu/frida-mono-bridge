/**
 * Value Conversion Helpers (runtime)
 *
 * Shared conversion utilities used by the model layer and the Mono facade:
 * - Numeric validation for narrow integer types
 * - Primitive argument allocation (raw value storage for mono_runtime_invoke)
 * - Boxing/unboxing helpers
 * - JS <-> Mono value conversion used by properties/fields/method helpers
 *
 * This file intentionally lives in the runtime layer because it is tightly
 * coupled to invocation semantics and MonoApi utilities.
 *
 * @module runtime/value-conversion
 */

import type { MonoApi } from "./api";

import type { TypedReadOptions } from "../types";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";

import { MonoArray } from "../model/array";
import { MonoDelegate } from "../model/delegate";
import { MonoObject } from "../model/object";
import { MonoString } from "../model/string";
import {
  MonoType,
  MonoTypeKind,
  isArrayKind,
  isPrimitiveKind,
  isValueTypeKind,
  readPrimitiveValue,
  writePrimitiveValue,
  type ValueReadOptions,
} from "../model/type";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for value conversion operations.
 */
export interface ConversionOptions extends ValueReadOptions {
  /** Target type for conversion */
  targetType?: MonoType;
}

/**
 * Optional wrapper overrides for `convertMonoToJs`.
 *
 * This keeps the conversion utility usable in contexts that want raw pointers
 * or custom wrapper implementations.
 */
export interface MonoValueWrappers {
  string?: new (api: MonoApi, ptr: NativePointer) => any;
  array?: new (api: MonoApi, ptr: NativePointer) => any;
  delegate?: new (api: MonoApi, ptr: NativePointer) => any;
  object?: new (api: MonoApi, ptr: NativePointer) => any;
}

const DEFAULT_WRAPPERS: Required<MonoValueWrappers> = {
  string: MonoString,
  array: MonoArray,
  delegate: MonoDelegate,
  object: MonoObject,
};

export interface UnboxValueOptions extends ValueReadOptions {
  /** When true, returns a boxed `MonoObject` wrapper for structs instead of the unboxed data pointer. */
  structAsObject?: boolean;
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
 */
export function validateNumericValue(value: number, typeName: string): number {
  const range = NUMERIC_RANGES[typeName];
  if (range) {
    if (value < range.min || value > range.max) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Value ${value} is out of range for ${range.name} (${range.min} to ${range.max})`,
        "Provide a value within the valid range",
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
      // Best-effort truncate
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
 */
export function unboxValue(
  api: MonoApi,
  boxedPtr: NativePointer,
  type: MonoType,
  options: UnboxValueOptions = {},
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
      // Structs: either return pointer to unboxed data or keep the boxed object.
      if (options.structAsObject) {
        return new MonoObject(api, boxedPtr);
      }
      return unboxed;

    default:
      return unboxed;
  }
}

// ============================================================================
// TYPED MEMORY READ/WRITE (FIELD/PROPERTY STORAGE)
// ============================================================================

/**
 * Read a typed value from a storage pointer.
 *
 * This is the canonical implementation for "read typed" logic used by subsystems
 * and field/property helpers. Note: for reference types the storage holds a
 * managed object reference, so this function dereferences once.
 */
export function readTypedValue(
  api: MonoApi,
  storagePtr: NativePointer,
  monoType: MonoType,
  options: TypedReadOptions = {},
  wrappers: MonoValueWrappers = DEFAULT_WRAPPERS,
): unknown {
  const kind = monoType.kind;

  // String: storage holds a managed object reference.
  if (kind === MonoTypeKind.String) {
    const strPtr = storagePtr.readPointer();
    if (pointerIsNull(strPtr)) return null;
    if (options.returnRaw) {
      const Ctor = wrappers.string ?? DEFAULT_WRAPPERS.string;
      return new Ctor(api, strPtr);
    }
    return api.readMonoString(strPtr, true);
  }

  // Arrays: storage holds a managed object reference.
  if (isArrayKind(kind)) {
    const arrPtr = storagePtr.readPointer();
    if (pointerIsNull(arrPtr)) return null;
    const Ctor = wrappers.array ?? DEFAULT_WRAPPERS.array;
    return new Ctor(api, arrPtr);
  }

  // Class/object references.
  if (kind === MonoTypeKind.Class || kind === MonoTypeKind.Object) {
    const objPtr = storagePtr.readPointer();
    if (pointerIsNull(objPtr)) return null;
    const klass = monoType.class;
    if (klass?.isDelegate) {
      const Ctor = wrappers.delegate ?? DEFAULT_WRAPPERS.delegate;
      return new Ctor(api, objPtr);
    }
    const Ctor = wrappers.object ?? DEFAULT_WRAPPERS.object;
    return new Ctor(api, objPtr);
  }

  // Generic instance: could be value type or reference.
  if (kind === MonoTypeKind.GenericInstance) {
    if (monoType.valueType) {
      // Value type is inlined.
      return storagePtr;
    }
    const objPtr = storagePtr.readPointer();
    if (pointerIsNull(objPtr)) return null;
    const Ctor = wrappers.object ?? DEFAULT_WRAPPERS.object;
    return new Ctor(api, objPtr);
  }

  // Value type: return pointer to inlined data.
  if (kind === MonoTypeKind.ValueType) {
    return storagePtr;
  }

  // Enum: read underlying primitive.
  if (kind === MonoTypeKind.Enum) {
    const underlying = monoType.underlyingType;
    if (underlying) {
      return readPrimitiveValue(storagePtr, underlying.kind, { returnBigInt: options.returnBigInt });
    }
    return storagePtr.readS32();
  }

  // Primitive / pointer-like.
  const primitiveResult = readPrimitiveValue(storagePtr, kind, { returnBigInt: options.returnBigInt });
  if (primitiveResult !== null) {
    return primitiveResult;
  }

  return storagePtr;
}

/**
 * Write a typed value into a storage pointer.
 *
 * This is the canonical implementation for "write typed" logic used by subsystems
 * and field/property helpers.
 */
export function writeTypedValue(api: MonoApi, storagePtr: NativePointer, value: unknown, monoType: MonoType): void {
  const kind = monoType.kind;

  if (value === null || value === undefined) {
    if (isValueTypeKind(kind)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Cannot write null to value type ${monoType.fullName}`,
        "Provide a non-null value (or write a pointer to a boxed value type)",
        { typeName: monoType.fullName },
      );
    }
    storagePtr.writePointer(NULL);
    return;
  }

  if (kind === MonoTypeKind.String) {
    if (typeof value === "string") {
      const monoStr = MonoString.new(api, value);
      storagePtr.writePointer(monoStr.pointer);
      return;
    }
    if (value instanceof MonoString) {
      storagePtr.writePointer(value.pointer);
      return;
    }
    storagePtr.writePointer(value as NativePointer);
    return;
  }

  if (isArrayKind(kind)) {
    if (value instanceof MonoArray) {
      storagePtr.writePointer(value.pointer);
      return;
    }
    storagePtr.writePointer(value as NativePointer);
    return;
  }

  if (kind === MonoTypeKind.Class || kind === MonoTypeKind.Object) {
    if (value instanceof MonoObject) {
      storagePtr.writePointer(value.pointer);
      return;
    }
    storagePtr.writePointer(value as NativePointer);
    return;
  }

  if (kind === MonoTypeKind.GenericInstance) {
    if (monoType.valueType) {
      if (value instanceof NativePointer) {
        const size = monoType.valueSize.size;
        Memory.copy(storagePtr, value, size);
      }
      return;
    }
    if (value instanceof MonoObject) {
      storagePtr.writePointer(value.pointer);
      return;
    }
    storagePtr.writePointer(value as NativePointer);
    return;
  }

  if (kind === MonoTypeKind.ValueType) {
    if (value instanceof NativePointer) {
      const size = monoType.valueSize.size;
      Memory.copy(storagePtr, value, size);
    }
    return;
  }

  if (kind === MonoTypeKind.Enum) {
    const underlying = monoType.underlyingType;
    if (underlying) {
      writePrimitiveValue(storagePtr, underlying.kind, value);
      return;
    }
    storagePtr.writeS32(value as number);
    return;
  }

  writePrimitiveValue(storagePtr, kind, value);
}

/**
 * Box a primitive (or enum underlying) value type into a managed object.
 *
 * Returns the raw boxed object pointer.
 */
export function boxPrimitiveValue(
  api: MonoApi,
  klassPtr: NativePointer,
  type: MonoType,
  value: number | boolean | bigint,
  domain: NativePointer = api.getRootDomain(),
): NativePointer {
  const storage = allocPrimitiveValue(type, value);
  return api.native.mono_value_box(domain, klassPtr, storage);
}

/**
 * Box a value type using an already-prepared raw storage pointer.
 *
 * Use this when you have a struct/value-type buffer (e.g., copied bytes)
 * and need a boxed managed object.
 */
export function boxValueTypePtr(
  api: MonoApi,
  klassPtr: NativePointer,
  valuePtr: NativePointer,
  domain: NativePointer = api.getRootDomain(),
): NativePointer {
  return api.native.mono_value_box(domain, klassPtr, valuePtr);
}

// ============================================================================
// JS TO MONO VALUE CONVERSION
// ============================================================================

/**
 * Convert a JavaScript value to a Mono-compatible value.
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
    // Preserve precision for Int64/UInt64 by converting to bigint when possible.
    if (typeName === "Int64" || typeName === "System.Int64" || typeName === "UInt64" || typeName === "System.UInt64") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        raise(
          MonoErrorCodes.INVALID_ARGUMENT,
          `Cannot convert non-integer number ${value} to ${typeName}`,
          "Pass a bigint (recommended) or an integer number",
        );
      }
      if (!Number.isSafeInteger(value)) {
        raise(
          MonoErrorCodes.INVALID_ARGUMENT,
          `Number ${value} is not a safe integer for ${typeName}`,
          "Pass a bigint to avoid precision loss",
        );
      }
      if (typeName === "UInt64" || typeName === "System.UInt64") {
        if (value < 0) {
          raise(MonoErrorCodes.INVALID_ARGUMENT, `Value ${value} is out of range for UInt64`, "Provide a >= 0 value");
        }
      }
      return BigInt(value);
    }

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

function convertBoolean(value: boolean, typeName: string, targetType: MonoType): unknown {
  if (typeName === "Boolean" || typeName === "System.Boolean") {
    return value;
  }
  if (targetType.valueType) {
    return value ? 1 : 0;
  }
  return value;
}

function convertString(api: MonoApi, value: string, typeName: string): unknown {
  if (typeName === "String" || typeName === "System.String") {
    return api.stringNew(value);
  }
  if (typeName === "Char" || typeName === "System.Char") {
    if (value.length === 0) {
      raise(MonoErrorCodes.INVALID_ARGUMENT, "Cannot convert empty string to Char", "Provide a non-empty string");
    }
    return value.charCodeAt(0);
  }
  return value;
}

function convertBigInt(value: bigint, typeName: string): unknown {
  if (typeName === "Int64" || typeName === "System.Int64") {
    return value;
  }
  if (typeName === "UInt64" || typeName === "System.UInt64") {
    if (value < 0n) {
      raise(MonoErrorCodes.INVALID_ARGUMENT, `Value ${value} is out of range for UInt64`, "Provide a >= 0 value");
    }
    return value;
  }
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
 */
export function convertMonoToJs(
  api: MonoApi,
  rawResult: NativePointer,
  type: MonoType,
  options: TypedReadOptions = {},
  wrappers: MonoValueWrappers = DEFAULT_WRAPPERS,
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
      const Ctor = wrappers.string ?? DEFAULT_WRAPPERS.string;
      return new Ctor(api, rawResult);
    }
    return api.readMonoString(rawResult, false);
  }

  // Handle value types (need to unbox)
  if (type.valueType) {
    return unboxValue(api, rawResult, type, options);
  }

  // Handle arrays
  if (isArrayKind(kind)) {
    const Ctor = wrappers.array ?? DEFAULT_WRAPPERS.array;
    return new Ctor(api, rawResult);
  }

  // Handle reference types - return wrapped MonoObject
  const Ctor = wrappers.object ?? DEFAULT_WRAPPERS.object;
  return new Ctor(api, rawResult);
}

// ============================================================================
// INSTANCE RESOLUTION
// ============================================================================

/**
 * Resolve an instance parameter to a NativePointer.
 */
export function resolveInstance(instance: unknown): NativePointer | null {
  if (instance === null || instance === undefined) {
    return null;
  }

  if (typeof instance === "object" && instance !== null) {
    if ("instancePointer" in instance) {
      return (instance as { instancePointer: NativePointer }).instancePointer;
    }
    if ("pointer" in instance) {
      return (instance as { pointer: NativePointer }).pointer;
    }
  }

  if (instance instanceof NativePointer) {
    if (pointerIsNull(instance)) {
      return null;
    }
    return instance;
  }

  return null;
}

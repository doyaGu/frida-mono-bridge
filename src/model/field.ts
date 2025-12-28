/**
 * Field model (System.Reflection.FieldInfo).
 *
 * Provides metadata access (name/type/flags/offset), custom attribute reading,
 * and value read/write helpers for both static and instance fields.
 *
 * @module model/field
 */

import { FieldAttribute, getMaskedValue, hasFlag } from "../runtime/metadata";
import { boxPrimitiveValue } from "../runtime/value-conversion";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull, tryMakePointer, unwrapInstance, unwrapInstanceRequired } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import type { CustomAttribute } from "./attribute";
import { createFieldAttributeContext, getCustomAttributes } from "./attribute";
import { MonoClass } from "./class";
import { MonoDomain } from "./domain";
import type { MemberAccessibility } from "./handle";
import { MonoHandle } from "./handle";
import { MonoObject } from "./object";
import { MonoString } from "./string";
import {
  isArrayKind,
  isPointerLikeKind,
  isPrimitiveKind,
  MonoType,
  MonoTypeKind,
  MonoTypeSummary,
  readPrimitiveValue,
} from "./type";

export type FieldAccessibility = MemberAccessibility;

/** Options shared by field read/write operations. */
export interface FieldAccessOptions {
  domain?: MonoDomain | NativePointer;
}

/** Options for reading a field value into JavaScript types. */
export interface FieldReadOptions extends FieldAccessOptions {
  coerce?: boolean;
}

/** Serializable summary of a field and its type metadata. */
export interface MonoFieldSummary {
  name: string;
  fullName: string;
  declaringType: string;
  flags: number;
  flagNames: string[];
  access: FieldAccessibility;
  offset: number;
  isStatic: boolean;
  isLiteral: boolean;
  isInitOnly: boolean;
  hasDefault: boolean;
  type: MonoTypeSummary;
  token: number;
}

interface RawFieldValue {
  storage: NativePointer;
  valuePointer: NativePointer;
  type: MonoType;
}

const FIELD_ACCESS_NAMES: Record<number, FieldAccessibility> = {
  [FieldAttribute.PrivateScope]: "private-scope",
  [FieldAttribute.Private]: "private",
  [FieldAttribute.FamANDAssem]: "protected-and-internal",
  [FieldAttribute.Assembly]: "internal",
  [FieldAttribute.Family]: "protected",
  [FieldAttribute.FamORAssem]: "protected-internal",
  [FieldAttribute.Public]: "public",
};

/**
 * Represents a Mono field (System.Reflection.FieldInfo).
 *
 * `MonoField` supports:
 * - Metadata inspection: name/fullName/type/flags/token
 * - Custom attributes: `customAttributes`
 * - Value access: raw pointer, object wrapper, and JS-coerced reads/writes
 */
export class MonoField<T = unknown> extends MonoHandle {
  // ===== CORE PROPERTIES =====

  /** Gets the name of this field. */
  @lazy
  get name(): string {
    const namePtr = this.native.mono_field_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  /** Gets the full name of this field. */
  @lazy
  get fullName(): string {
    // NOTE: mono_field_full_name is only available in mono-2.0-bdwgc.dll
    if (this.api.hasExport("mono_field_full_name")) {
      const namePtr = this.native.mono_field_full_name(this.pointer);
      if (!pointerIsNull(namePtr)) {
        try {
          return readUtf8String(namePtr);
        } finally {
          this.api.tryFree(namePtr);
        }
      }
    }
    // Fallback: construct full name manually
    return `${this.parent.fullName}.${this.name}`;
  }

  /** Gets the flags of this field. */
  @lazy
  get flags(): number {
    return this.native.mono_field_get_flags(this.pointer) as number;
  }

  /** Gets the offset of this field within its declaring type. */
  @lazy
  get offset(): number {
    return this.native.mono_field_get_offset(this.pointer) as number;
  }

  /** Gets the class that declares this field. */
  @lazy
  get parent(): MonoClass {
    const parentPtr = this.native.mono_field_get_parent(this.pointer);
    return new MonoClass(this.api, parentPtr);
  }

  /** Gets the type of this field. */
  @lazy
  get type(): MonoType {
    const typePtr = this.native.mono_field_get_type(this.pointer);
    return new MonoType(this.api, typePtr);
  }

  /** Gets the metadata token of this field. */
  @lazy
  get token(): number {
    return this.native.mono_class_get_field_token(this.parent.pointer, this.pointer) as number;
  }

  /** Gets the access modifier of this field. */
  @lazy
  get accessibility(): FieldAccessibility {
    const mask = getMaskedValue(this.flags, FieldAttribute.FieldAccessMask);
    return FIELD_ACCESS_NAMES[mask] ?? "private";
  }

  // ===== TYPE CHECKS =====

  /** Determines whether this field is static. */
  @lazy
  get isStatic(): boolean {
    return hasFlag(this.flags, FieldAttribute.Static);
  }

  /** Determines whether this field value is known at compile time. */
  @lazy
  get isLiteral(): boolean {
    return hasFlag(this.flags, FieldAttribute.Literal);
  }

  /** Determines whether this field is init-only (readonly). */
  @lazy
  get isInitOnly(): boolean {
    return hasFlag(this.flags, FieldAttribute.InitOnly);
  }

  /** Determines whether this field has a default value. */
  @lazy
  get hasDefault(): boolean {
    return hasFlag(this.flags, FieldAttribute.HasDefault);
  }

  /**
   * Get custom attributes applied to this field.
   * Uses mono_custom_attrs_from_field API to retrieve attribute metadata.
   * @returns Array of CustomAttribute objects with attribute type information
   */
  @lazy get customAttributes(): CustomAttribute[] {
    return getCustomAttributes(
      createFieldAttributeContext(this.api, this.parent.pointer, this.pointer, this.native),
      ptr => new MonoClass(this.api, ptr).name,
      ptr => new MonoClass(this.api, ptr).fullName,
    );
  }

  // ===== VALUE ACCESS (READ OPERATIONS) =====

  /**
   * Get the raw value pointer of this field.
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns NativePointer to the field value
   */
  getValue(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): NativePointer {
    return this.readRawValue(instance, options).valuePointer;
  }

  /**
   * Get the raw value pointer of this static field.
   * @param options Access options
   * @returns NativePointer to the field value
   */
  getStaticValue(options: FieldAccessOptions = {}): NativePointer {
    return this.getValue(null, options);
  }

  /**
   * Get the value of this field as a MonoObject.
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns MonoObject representing the field value, or null
   */
  getValueObject(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): MonoObject | null {
    const domainPtr = this.resolveDomainPointer(options.domain);
    if (this.isStatic) {
      this.parent.ensureInitialized();
    } else if (instance === null || instance === undefined) {
      return null;
    }
    const target = this.isStatic ? unwrapInstance(instance) : unwrapInstanceRequired(instance, this);
    const objectPtr = this.native.mono_field_get_value_object(domainPtr, this.pointer, target);
    return pointerIsNull(objectPtr) ? null : new MonoObject(this.api, objectPtr);
  }

  /**
   * Get the value of a string field as a MonoString object.
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns MonoString object or null
   * @throws {MonoTypeMismatchError} if the field is not a string type
   */
  getStringValue(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): MonoString | null {
    if (this.type.kind !== MonoTypeKind.String) {
      raise(
        MonoErrorCodes.TYPE_MISMATCH,
        `Field ${this.name} is not a string type (is ${this.type.fullName})`,
        "Use getValue() for non-string fields",
      );
    }
    const valuePtr = this.getValue(instance, options);
    return pointerIsNull(valuePtr) ? null : new MonoString(this.api, valuePtr);
  }

  /**
   * Get the static value of a string field as a MonoString object.
   * @param options Access options
   * @returns MonoString object or null
   * @throws {MonoTypeMismatchError} if the field is not a string type
   */
  getStaticStringValue(options: FieldAccessOptions = {}): MonoString | null {
    return this.getStringValue(null, options);
  }

  /**
   * Get the value of an Int64/UInt64 field as a BigInt.
   * This prevents precision loss that occurs when reading 64-bit values as numbers.
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns BigInt value
   * @throws {MonoTypeMismatchError} if the field is not a 64-bit integer type
   */
  getBigIntValue(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): bigint {
    const kind = this.type.kind;
    if (kind !== MonoTypeKind.I8 && kind !== MonoTypeKind.U8) {
      raise(
        MonoErrorCodes.TYPE_MISMATCH,
        `Field ${this.name} is not a 64-bit integer type (is ${this.type.fullName})`,
        "Use getValue() for non-64-bit fields",
      );
    }
    const raw = this.readRawValue(instance, options);
    if (kind === MonoTypeKind.I8) {
      // Convert Frida's Int64 to native bigint
      return BigInt(raw.storage.readS64().toString());
    }
    // Convert Frida's UInt64 to native bigint
    return BigInt(raw.storage.readU64().toString());
  }

  /**
   * Get the static value of an Int64/UInt64 field as a BigInt.
   * @param options Access options
   * @returns BigInt value
   * @throws {MonoTypeMismatchError} if the field is not a 64-bit integer type
   */
  getStaticBigIntValue(options: FieldAccessOptions = {}): bigint {
    return this.getBigIntValue(null, options);
  }

  /**
   * Set the value of an Int64/UInt64 field from a BigInt.
   * @param instance Object instance (null for static fields)
   * @param value BigInt value to set
   * @param options Access options
   * @throws {MonoTypeMismatchError} if the field is not a 64-bit integer type
   */
  setBigIntValue(
    instance: MonoObject | NativePointer | null,
    value: bigint,
    options: FieldAccessOptions = {},
  ): void {
    const kind = this.type.kind;
    if (kind !== MonoTypeKind.I8 && kind !== MonoTypeKind.U8) {
      raise(
        MonoErrorCodes.TYPE_MISMATCH,
        `Field ${this.name} is not a 64-bit integer type (is ${this.type.fullName})`,
        "Use setValue() for non-64-bit fields",
      );
    }
    const storage = Memory.alloc(8);
    // Convert native bigint to Frida's Int64/UInt64
    if (kind === MonoTypeKind.I8) {
      storage.writeS64(int64(value.toString()));
    } else {
      storage.writeU64(uint64(value.toString()));
    }
    this.setValue(instance, storage, options);
  }

  /**
   * Set the static value of an Int64/UInt64 field from a BigInt.
   * @param value BigInt value to set
   * @param options Access options
   * @throws {MonoTypeMismatchError} if the field is not a 64-bit integer type
   */
  setStaticBigIntValue(value: bigint, options: FieldAccessOptions = {}): void {
    this.setBigIntValue(null, value, options);
  }

  /**
   * Read and coerce the field value to a JavaScript type.
   * @param instance Object instance (null for static fields)
   * @param options Read options (set coerce=false to get raw pointer)
   * @returns Coerced value or raw pointer
   */
  readValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): unknown {
    const raw = this.readRawValue(instance, options);
    const type = raw.type;
    if (options.coerce === false) {
      if (isPointerLikeKind(type.kind)) {
        return raw.storage.readPointer();
      }
      return raw.valuePointer;
    }
    return this.coerceValue(raw, type);
  }

  // ===== VALUE MODIFICATION (WRITE OPERATIONS) =====

  /**
   * Set the raw value of this field.
   * @param instance Object instance (null for static fields)
   * @param value NativePointer to the value (for reference types, pass the object pointer)
   * @param options Access options
   */
  setValue(instance: MonoObject | NativePointer | null, value: NativePointer, options: FieldAccessOptions = {}): void {
    const preparedValue = this.prepareValuePointer(value);
    if (this.isStatic) {
      const domainPtr = this.resolveDomainPointer(options.domain);
      const vtable = this.getStaticVTable(domainPtr);
      this.native.mono_field_static_set_value(vtable, this.pointer, preparedValue);
      return;
    }
    const target = unwrapInstanceRequired(instance, this);
    this.native.mono_field_set_value(target, this.pointer, preparedValue);
  }

  /**
   * Set the raw value of this static field.
   * @param value NativePointer to the value
   * @param options Access options
   */
  setStaticValue(value: NativePointer, options: FieldAccessOptions = {}): void {
    this.setValue(null, value, options);
  }

  /**
   * Set the value of this field using a MonoObject.
   * @param instance Object instance (null for static fields)
   * @param value MonoObject or NativePointer to set
   * @param options Access options
   */
  setValueObject(
    instance: MonoObject | NativePointer | null,
    value: MonoObject | NativePointer | null,
    options: FieldAccessOptions = {},
  ): void {
    if (value instanceof MonoObject) {
      if (this.type.valueType) {
        this.setValue(instance, value.unbox(), options);
      } else {
        this.setValue(instance, value.pointer, options);
      }
      return;
    }
    this.setValue(instance, value ?? NULL, options);
  }

  // ===== TYPE-SAFE ACCESSORS =====

  /**
   * Get the typed value of this field.
   * @param instance Object instance (null for static fields)
   * @param options Read options
   * @returns Typed value
   */
  getTypedValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): T {
    return this.readValue(instance, options) as T;
  }

  /**
   * Get the typed static value of this field.
   * @param options Read options
   * @returns Typed value
   */
  getTypedStaticValue(options: FieldReadOptions = {}): T {
    return this.readValue(null, options) as T;
  }

  /**
   * Set the typed value of this field.
   * @param instance Object instance (null for static fields)
   * @param value Typed value to set
   * @param options Access options
   */
  setTypedValue(instance: MonoObject | NativePointer | null, value: T, options: FieldAccessOptions = {}): void {
    if (value === null || value === undefined) {
      if (this.type.valueType) {
        if (this.isNullableType(this.type)) {
          const zeroed = this.allocZeroedValue(this.type);
          this.setValue(instance, zeroed, options);
          return;
        }
        raise(
          MonoErrorCodes.TYPE_MISMATCH,
          `Field ${this.name} is a value type and cannot be set to null`,
          "Provide a non-null value",
          { fieldName: this.name, value, expectedType: this.type.fullName },
        );
      }
      this.setValueObject(instance, null, options);
      return;
    }

    const convertedValue = this.convertToMonoValue(value);
    if (convertedValue === null) {
      raise(
        MonoErrorCodes.TYPE_MISMATCH,
        `Failed to convert value for field ${this.name} (${this.type.fullName})`,
        "Ensure the value matches the field type",
        { fieldName: this.name, value, expectedType: this.type.fullName },
      );
    }
    this.setValueObject(instance, convertedValue, options);
  }

  /**
   * Set the typed static value of this field.
   * @param value Typed value to set
   * @param options Access options
   */
  setTypedStaticValue(value: T, options: FieldAccessOptions = {}): void {
    if (value === null || value === undefined) {
      if (this.type.valueType) {
        if (this.isNullableType(this.type)) {
          const zeroed = this.allocZeroedValue(this.type);
          this.setValue(null, zeroed, options);
          return;
        }
        raise(
          MonoErrorCodes.TYPE_MISMATCH,
          `Field ${this.name} is a value type and cannot be set to null`,
          "Provide a non-null value",
          { fieldName: this.name, value, expectedType: this.type.fullName },
        );
      }
      this.setValueObject(null, null, options);
      return;
    }

    const convertedValue = this.convertToMonoValue(value);
    if (convertedValue === null) {
      raise(
        MonoErrorCodes.TYPE_MISMATCH,
        `Failed to convert value for field ${this.name} (${this.type.fullName})`,
        "Ensure the value matches the field type",
        { fieldName: this.name, value, expectedType: this.type.fullName },
      );
    }
    this.setValueObject(null, convertedValue, options);
  }

  // ===== UTILITY METHODS =====

  /**
   * Get flag names for this field (static, init-only, literal).
   * @returns Array of flag names
   */
  @lazy
  get flagNames(): string[] {
    try {
      const flags: string[] = [];
      if (this.isStatic) flags.push("static");
      if (this.isInitOnly) flags.push("init-only");
      if (this.isLiteral) flags.push("literal");
      return flags;
    } catch {
      return [];
    }
  }

  /**
   * Get a comprehensive summary of this field.
   * @returns MonoFieldSummary object with all field information
   */
  getSummary(): MonoFieldSummary {
    return {
      name: this.name,
      fullName: this.fullName,
      declaringType: this.parent.fullName,
      flags: this.flags,
      flagNames: this.flagNames,
      access: this.accessibility,
      offset: this.offset,
      isStatic: this.isStatic,
      isLiteral: this.isLiteral,
      isInitOnly: this.isInitOnly,
      hasDefault: this.hasDefault,
      type: this.type.getSummary(),
      token: this.token,
    };
  }

  /**
   * Get a human-readable description of this field.
   * @returns Description string with modifiers, type, and name
   */
  describe(): string {
    const modifiers = [];

    if (this.isStatic) modifiers.push("static");
    if (this.isInitOnly) modifiers.push("readonly");
    if (this.isLiteral) modifiers.push("const");

    const modifierStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
    return `${modifierStr}${this.accessibility} ${this.type.fullName} ${this.name}`;
  }

  /**
   * Convert this field to a JSON-serializable object.
   * @returns FieldInfo object
   */
  toJSON(): FieldInfo {
    return {
      name: this.name,
      fullName: this.fullName,
      type: this.type.fullName,
      accessibility: this.accessibility,
      isStatic: this.isStatic,
      isReadOnly: this.isInitOnly,
      isConstant: this.isLiteral,
      offset: this.offset,
      token: this.token,
      declaringType: this.parent.fullName,
    };
  }

  /**
   * Get a string representation of this field.
   * @returns String in format "MonoField(fullName: type)"
   */
  toString(): string {
    return `${this.constructor.name}(${this.fullName}: ${this.type.fullName})`;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Read the raw value of this field into allocated storage.
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns RawFieldValue with storage, valuePointer, and type
   */
  private readRawValue(
    instance: MonoObject | NativePointer | null | undefined,
    options: FieldAccessOptions,
  ): RawFieldValue {
    const type = this.type;
    const { size } = type.valueSize;
    const storageSize = Math.max(size, Process.pointerSize);
    const storage = Memory.alloc(storageSize);

    if (this.isStatic) {
      const domainPtr = this.resolveDomainPointer(options.domain);
      const vtable = this.getStaticVTable(domainPtr);
      this.native.mono_field_static_get_value(vtable, this.pointer, storage);
    } else {
      const target = unwrapInstanceRequired(instance, this);
      this.native.mono_field_get_value(target, this.pointer, storage);
    }

    const kind = type.kind;
    const isValueType = type.valueType;
    const treatAsReference = !isValueType && !isPointerLikeKind(kind);
    const valuePointer = treatAsReference ? storage.readPointer() : storage;

    return { storage, valuePointer, type };
  }

  /**
   * Prepare a value pointer for mono_field_set_value calls.
   * Reference types need an extra level of indirection (object pointer stored in memory).
   */
  private prepareValuePointer(value: NativePointer): NativePointer {
    const type = this.type;
    const kind = type.kind;
    const needsIndirection = !type.valueType && !isPointerLikeKind(kind);
    if (!needsIndirection) {
      return value;
    }
    const storage = Memory.alloc(Process.pointerSize);
    storage.writePointer(value);
    return storage;
  }

  /**
   * Get the VTable for this field's declaring class in the specified domain.
   * @param domainPtr Domain pointer
   * @returns VTable pointer
   * @throws {MonoInitError} if vtable cannot be obtained
   */
  private getStaticVTable(domainPtr: NativePointer): NativePointer {
    this.parent.ensureInitialized();
    const vtable = this.native.mono_class_vtable(domainPtr, this.parent.pointer);
    if (pointerIsNull(vtable)) {
      raise(
        MonoErrorCodes.INIT_FAILED,
        `Failed to get vtable for ${this.parent.fullName} when accessing static field ${this.name}`,
        "Ensure the class is properly initialized",
      );
    }
    return vtable;
  }

  /**
   * Resolve a domain parameter to a NativePointer.
   * @param domain MonoDomain, NativePointer, or undefined (uses root domain)
   * @returns Domain pointer
   */
  private resolveDomainPointer(domain?: MonoDomain | NativePointer): NativePointer {
    if (!domain) {
      return this.api.getRootDomain();
    }
    if (domain instanceof MonoDomain) {
      return domain.pointer;
    }
    return domain;
  }

  /**
   * Coerce a raw field value to a JavaScript type.
   * Unified type coercion for field reads - consistent with Mono.memory.readTyped.
   * @param raw Raw field value with storage and type info
   * @param type MonoType of the field
   * @returns Coerced JavaScript value
   */
  private coerceValue(raw: RawFieldValue, type: MonoType): unknown {
    const { storage, valuePointer } = raw;
    const kind = type.kind;

    // Handle Char specially (return string instead of number)
    if (kind === MonoTypeKind.Char) {
      return String.fromCharCode(storage.readU16());
    }

    // Handle String specially
    if (kind === MonoTypeKind.String) {
      return pointerIsNull(valuePointer) ? null : this.api.readMonoString(valuePointer, true);
    }

    // Handle arrays - keep model layer decoupled from array wrapper
    // (Facade-level Mono.memory provides higher-level array helpers.)
    if (isArrayKind(kind)) {
      if (pointerIsNull(valuePointer)) return null;
      return new MonoObject(this.api, valuePointer);
    }

    // Handle pointer-like types
    if (isPointerLikeKind(kind)) {
      return storage.readPointer();
    }

    // Handle Enum recursively - read underlying type
    if (kind === MonoTypeKind.Enum) {
      const underlying = type.underlyingType;
      if (underlying) {
        return readPrimitiveValue(storage, underlying.kind);
      }
      // Fallback to int32
      return storage.readS32();
    }

    // Handle class/object references
    if (kind === MonoTypeKind.Class || kind === MonoTypeKind.Object) {
      if (pointerIsNull(valuePointer)) return null;
      return new MonoObject(this.api, valuePointer);
    }

    // Handle generic instance
    if (kind === MonoTypeKind.GenericInstance) {
      if (type.valueType) {
        // Value type - return pointer to inline data
        return storage;
      } else {
        if (pointerIsNull(valuePointer)) return null;
        return new MonoObject(this.api, valuePointer);
      }
    }

    // Try to read as primitive using unified implementation
    const primitiveResult = readPrimitiveValue(storage, kind);
    if (primitiveResult !== null) {
      return primitiveResult;
    }

    // Handle value types - return pointer to inline data
    if (type.valueType) {
      return storage;
    }

    // Reference type - return pointer or null
    return pointerIsNull(valuePointer) ? null : valuePointer;
  }

  /**
   * Convert a JavaScript value to a Mono value.
   * Unified type conversion for field writes - delegates to consistent boxing/unboxing rules.
   * @param value JavaScript value to convert
   * @returns MonoObject, NativePointer, or null
   */
  private convertToMonoValue(value: unknown): MonoObject | NativePointer | null {
    if (value === null || value === undefined) {
      return null;
    }

    const type = this.type;
    const kind = type.kind;

    // Handle string conversion
    if (kind === MonoTypeKind.String) {
      if (value instanceof MonoObject) {
        return value;
      }
      if (typeof value === "string") {
        return this.api.stringNew(value);
      }
      return null;
    }

    if (isPointerLikeKind(kind)) {
      if (value instanceof MonoObject) {
        return value;
      }
      if (value instanceof NativePointer) {
        return this.allocPointerValue(value, type);
      }
      if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") {
        const ptrValue = tryMakePointer(value);
        return ptrValue ? this.allocPointerValue(ptrValue, type) : null;
      }
      return null;
    }

    // Pass through existing MonoObjects
    if (value instanceof MonoObject) {
      return value;
    }

    // Pass through NativePointers
    if (value instanceof NativePointer) {
      return value;
    }

    // Handle primitives/enums that need boxing (struct/value types require a pointer or boxed object)
    if (kind === MonoTypeKind.Enum || isPrimitiveKind(kind)) {
      const klass = type.class;
      if (!klass) {
        return null;
      }

      if (typeof value !== "boolean" && typeof value !== "bigint" && typeof value !== "number") {
        return null;
      }

      const boxed = boxPrimitiveValue(this.api, klass.pointer, type, value);
      return pointerIsNull(boxed) ? null : new MonoObject(this.api, boxed);
    }

    // For reference types, just return the value if it's already handled
    return null;
  }

  private isNullableType(type: MonoType): boolean {
    const fullName = type.fullName;
    return (
      fullName === "System.Nullable`1" ||
      fullName.startsWith("System.Nullable`1") ||
      fullName.startsWith("System.Nullable<")
    );
  }

  private allocZeroedValue(type: MonoType): NativePointer {
    const { size } = type.valueSize;
    const storageSize = Math.max(size, Process.pointerSize);
    const storage = Memory.alloc(storageSize);
    const zeros = new Uint8Array(storageSize);
    storage.writeByteArray(zeros);
    return storage;
  }

  private allocPointerValue(value: NativePointer, type: MonoType): NativePointer {
    const storage = this.allocZeroedValue(type);
    storage.writePointer(value);
    return storage;
  }
}

// ===== INTERFACES =====

export interface FieldInfo {
  name: string;
  fullName: string;
  type: string;
  accessibility: FieldAccessibility;
  isStatic: boolean;
  isReadOnly: boolean;
  isConstant: boolean;
  offset: number;
  token: number;
  declaringType: string;
}

/**
 * Namespace for MonoField-related types and utilities
 */
export namespace MonoField {
  /**
   * Types that can be stored in a MonoField
   */
  export type FieldType = boolean | number | bigint | string | NativePointer | MonoObject | MonoString | null;
}

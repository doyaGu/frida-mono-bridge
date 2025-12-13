import { FieldAttribute, getMaskedValue, hasFlag } from "../runtime/metadata";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull, unwrapInstance, unwrapInstanceRequired } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { CustomAttribute, MemberAccessibility, MonoHandle } from "./base";
import { MonoClass } from "./class";
import { createFieldAttributeContext, getCustomAttributes } from "./custom-attributes";
import { MonoDomain } from "./domain";
import { MonoObject } from "./object";
import { MonoString } from "./string";
import {
  isArrayKind,
  isPointerLikeKind,
  isPrimitiveKind,
  isValueTypeKind,
  MonoType,
  MonoTypeKind,
  MonoTypeSummary,
  readPrimitiveValue,
  writePrimitiveValue,
} from "./type";

export type FieldAccessibility = MemberAccessibility;

export interface FieldAccessOptions {
  domain?: MonoDomain | NativePointer;
}

export interface FieldReadOptions extends FieldAccessOptions {
  coerce?: boolean;
}

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

export class MonoField<T = any> extends MonoHandle {
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
    const namePtr = this.native.mono_field_full_name(this.pointer);
    if (pointerIsNull(namePtr)) {
      return `${this.parent.fullName}.${this.name}`;
    }
    try {
      return readUtf8String(namePtr);
    } finally {
      this.api.tryFree(namePtr);
    }
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
    }
    const objectPtr = this.native.mono_field_get_value_object(domainPtr, this.pointer, unwrapInstance(instance));
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
   * Read and coerce the field value to a JavaScript type.
   * @param instance Object instance (null for static fields)
   * @param options Read options (set coerce=false to get raw pointer)
   * @returns Coerced value or raw pointer
   */
  readValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): unknown {
    const raw = this.readRawValue(instance, options);
    const type = raw.type;
    if (options.coerce === false) {
      return raw.valuePointer;
    }
    return this.coerceValue(raw, type);
  }

  // ===== VALUE MODIFICATION (WRITE OPERATIONS) =====

  /**
   * Set the raw value of this field.
   * @param instance Object instance (null for static fields)
   * @param value NativePointer to the value
   * @param options Access options
   */
  setValue(instance: MonoObject | NativePointer | null, value: NativePointer, options: FieldAccessOptions = {}): void {
    if (this.isStatic) {
      const domainPtr = this.resolveDomainPointer(options.domain);
      const vtable = this.getStaticVTable(domainPtr);
      this.native.mono_field_static_set_value(vtable, this.pointer, value);
      return;
    }
    const target = unwrapInstanceRequired(instance, this);
    this.native.mono_field_set_value(target, this.pointer, value);
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
    const convertedValue = this.convertToMonoValue(value);
    this.setValueObject(instance, convertedValue, options);
  }

  /**
   * Set the typed static value of this field.
   * @param value Typed value to set
   * @param options Access options
   */
  setTypedStaticValue(value: T, options: FieldAccessOptions = {}): void {
    const convertedValue = this.convertToMonoValue(value);
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
      return pointerIsNull(valuePointer) ? null : this.readMonoString(valuePointer);
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
  private convertToMonoValue(value: any): MonoObject | NativePointer | null {
    if (value === null || value === undefined) {
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

    const type = this.type;
    const kind = type.kind;

    // Handle string conversion
    if (kind === MonoTypeKind.String) {
      if (typeof value === "string") {
        return this.api.stringNew(value);
      }
      return null;
    }

    // Handle value types that need boxing
    if (isValueTypeKind(kind) || isPrimitiveKind(kind)) {
      const klass = type.class;
      if (!klass) {
        return null;
      }

      // Allocate storage and write the primitive value
      const { size } = type.valueSize;
      const valuePtr = Memory.alloc(Math.max(size, 8));

      if (typeof value === "boolean") {
        valuePtr.writeU8(value ? 1 : 0);
      } else if (typeof value === "bigint") {
        valuePtr.writeS64(new Int64(value.toString()));
      } else if (typeof value === "number") {
        // Use unified primitive write based on kind
        if (kind === MonoTypeKind.Enum) {
          const underlying = type.underlyingType;
          if (underlying) {
            writePrimitiveValue(valuePtr, underlying.kind, value);
          } else {
            valuePtr.writeS32(value);
          }
        } else {
          writePrimitiveValue(valuePtr, kind, value);
        }
      } else {
        return null;
      }

      // Box the value
      const boxed = this.native.mono_value_box(this.api.getRootDomain(), klass.pointer, valuePtr);
      return pointerIsNull(boxed) ? null : new MonoObject(this.api, boxed);
    }

    // For reference types, just return the value if it's already handled
    return null;
  }

  /**
   * Read a MonoString to JavaScript string using available API.
   * @param pointer Pointer to MonoString
   * @returns JavaScript string
   */
  private readMonoString(pointer: NativePointer): string {
    return this.api.readMonoString(pointer, true);
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

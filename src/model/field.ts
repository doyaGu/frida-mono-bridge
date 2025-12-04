import { FieldAttribute, getMaskedValue, hasFlag } from "../runtime/metadata";
import { pointerIsNull, unwrapInstance, unwrapInstanceRequired } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { CustomAttribute, MemberAccessibility, MonoHandle, parseCustomAttributes } from "./base";
import { MonoClass } from "./class";
import { MonoDomain } from "./domain";
import { MonoObject } from "./object";
import { MonoString } from "./string";
import { isPointerLikeKind, MonoType, MonoTypeKind, MonoTypeSummary, readPrimitiveValue } from "./type";

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
  #flags: number | null = null;
  #type: MonoType | null = null;
  #name: string | null = null;
  #fullName: string | null = null;
  #parent: MonoClass | null = null;

  getName(): string {
    if (this.#name !== null) {
      return this.#name;
    }
    const namePtr = this.native.mono_field_get_name(this.pointer);
    this.#name = readUtf8String(namePtr);
    return this.#name;
  }

  get name(): string {
    return this.getName();
  }

  getFullName(): string {
    if (this.#fullName !== null) {
      return this.#fullName;
    }
    const namePtr = this.native.mono_field_full_name(this.pointer);
    if (pointerIsNull(namePtr)) {
      this.#fullName = `${this.getParent().getFullName()}.${this.getName()}`;
      return this.#fullName;
    }
    try {
      this.#fullName = readUtf8String(namePtr);
      return this.#fullName;
    } finally {
      this.api.tryFree(namePtr);
    }
  }

  get fullName(): string {
    return this.getFullName();
  }

  getFlags(): number {
    if (this.#flags !== null) {
      return this.#flags;
    }
    this.#flags = this.native.mono_field_get_flags(this.pointer) as number;
    return this.#flags;
  }

  getOffset(): number {
    return this.native.mono_field_get_offset(this.pointer) as number;
  }

  getParent(): MonoClass {
    if (this.#parent) {
      return this.#parent;
    }
    const parentPtr = this.native.mono_field_get_parent(this.pointer);
    this.#parent = new MonoClass(this.api, parentPtr);
    return this.#parent;
  }

  get parent(): MonoClass {
    return this.getParent();
  }

  getTypePointer(): NativePointer {
    return this.getType().pointer;
  }

  getType(): MonoType {
    if (this.#type) {
      return this.#type;
    }
    const typePtr = this.native.mono_field_get_type(this.pointer);
    this.#type = new MonoType(this.api, typePtr);
    return this.#type;
  }

  get type(): MonoType {
    return this.getType();
  }

  getToken(): number {
    const klass = this.getParent();
    return this.native.mono_class_get_field_token(klass.pointer, this.pointer) as number;
  }

  getAccessibility(): FieldAccessibility {
    const mask = getMaskedValue(this.getFlags(), FieldAttribute.FieldAccessMask);
    return FIELD_ACCESS_NAMES[mask] ?? "private";
  }

  isStatic(): boolean {
    return hasFlag(this.getFlags(), FieldAttribute.Static);
  }

  isLiteral(): boolean {
    return hasFlag(this.getFlags(), FieldAttribute.Literal);
  }

  isInitOnly(): boolean {
    return hasFlag(this.getFlags(), FieldAttribute.InitOnly);
  }

  hasDefault(): boolean {
    return hasFlag(this.getFlags(), FieldAttribute.HasDefault);
  }

  /**
   * Get custom attributes applied to this field.
   * Uses mono_custom_attrs_from_field API to retrieve attribute metadata.
   * @returns Array of CustomAttribute objects with attribute type information
   */
  getCustomAttributes(): CustomAttribute[] {
    if (!this.api.hasExport("mono_custom_attrs_from_field")) {
      return [];
    }

    try {
      const parentClass = this.getParent();
      const customAttrInfoPtr = this.native.mono_custom_attrs_from_field(parentClass.pointer, this.pointer);
      return parseCustomAttributes(
        this.api,
        customAttrInfoPtr,
        ptr => new MonoClass(this.api, ptr).getName(),
        ptr => new MonoClass(this.api, ptr).getFullName(),
      );
    } catch {
      return [];
    }
  }

  getValue(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): NativePointer {
    return this.readRawValue(instance, options).valuePointer;
  }

  getStaticValue(options: FieldAccessOptions = {}): NativePointer {
    return this.getValue(null, options);
  }

  getValueObject(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): MonoObject | null {
    const domainPtr = this.resolveDomainPointer(options.domain);
    if (this.isStatic()) {
      this.getParent().ensureInitialized();
    }
    const objectPtr = this.native.mono_field_get_value_object(domainPtr, this.pointer, unwrapInstance(instance));
    return pointerIsNull(objectPtr) ? null : new MonoObject(this.api, objectPtr);
  }

  /**
   * Get the value of a string field as a MonoString object
   * @param instance Object instance (null for static fields)
   * @param options Access options
   * @returns MonoString object or null
   * @throws Error if the field is not a string type
   */
  getStringValue(instance?: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): MonoString | null {
    const type = this.getType();
    if (type.getKind() !== MonoTypeKind.String) {
      throw new Error(`Field ${this.getName()} is not a string type (is ${type.getFullName()})`);
    }
    const valuePtr = this.getValue(instance, options);
    return pointerIsNull(valuePtr) ? null : new MonoString(this.api, valuePtr);
  }

  /**
   * Get the static value of a string field as a MonoString object
   * @param options Access options
   * @returns MonoString object or null
   * @throws Error if the field is not a string type
   */
  getStaticStringValue(options: FieldAccessOptions = {}): MonoString | null {
    return this.getStringValue(null, options);
  }

  readValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): unknown {
    const raw = this.readRawValue(instance, options);
    const type = raw.type;
    if (options.coerce === false) {
      return raw.valuePointer;
    }
    return this.coerceValue(raw, type);
  }

  setValue(instance: MonoObject | NativePointer | null, value: NativePointer, options: FieldAccessOptions = {}): void {
    if (this.isStatic()) {
      const domainPtr = this.resolveDomainPointer(options.domain);
      const vtable = this.getStaticVTable(domainPtr);
      this.native.mono_field_static_set_value(vtable, this.pointer, value);
      return;
    }
    const target = unwrapInstanceRequired(instance, this);
    this.native.mono_field_set_value(target, this.pointer, value);
  }

  setStaticValue(value: NativePointer, options: FieldAccessOptions = {}): void {
    this.setValue(null, value, options);
  }

  setValueObject(
    instance: MonoObject | NativePointer | null,
    value: MonoObject | NativePointer | null,
    options: FieldAccessOptions = {},
  ): void {
    if (value instanceof MonoObject) {
      if (this.getType().isValueType()) {
        this.setValue(instance, value.unbox(), options);
      } else {
        this.setValue(instance, value.pointer, options);
      }
      return;
    }
    this.setValue(instance, value ?? NULL, options);
  }

  // Type-safe getters/setters
  getTypedValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): T {
    return this.readValue(instance, options) as T;
  }

  getTypedStaticValue(options: FieldReadOptions = {}): T {
    return this.readValue(null, options) as T;
  }

  setTypedValue(instance: MonoObject | NativePointer | null, value: T, options: FieldAccessOptions = {}): void {
    const convertedValue = this.convertToMonoValue(value);
    this.setValueObject(instance, convertedValue, options);
  }

  setTypedStaticValue(value: T, options: FieldAccessOptions = {}): void {
    const convertedValue = this.convertToMonoValue(value);
    this.setValueObject(null, convertedValue, options);
  }

  // Summary and description methods
  getFlagNames(): string[] {
    try {
      const flagNames: string[] = [];
      if (this.isStatic()) flagNames.push("static");
      if (this.isInitOnly()) flagNames.push("init-only");
      if (this.isLiteral()) flagNames.push("literal");
      return flagNames;
    } catch {
      return [];
    }
  }

  getSummary(): MonoFieldSummary {
    const type = this.getType();
    return {
      name: this.getName(),
      fullName: this.getFullName(),
      declaringType: this.getParent().getFullName(),
      flags: this.getFlags(),
      flagNames: this.getFlagNames(),
      access: this.getAccessibility(),
      offset: this.getOffset(),
      isStatic: this.isStatic(),
      isLiteral: this.isLiteral(),
      isInitOnly: this.isInitOnly(),
      hasDefault: this.hasDefault(),
      type: type.getSummary(),
      token: this.getToken(),
    };
  }

  describe(): string {
    const type = this.getType();
    const modifiers = [];

    if (this.isStatic()) modifiers.push("static");
    if (this.isInitOnly()) modifiers.push("readonly");
    if (this.isLiteral()) modifiers.push("const");

    const modifierStr = modifiers.length > 0 ? modifiers.join(" ") + " " : "";
    const accessStr = this.getAccessibility();

    return `${modifierStr}${accessStr} ${type.getFullName()} ${this.getName()}`;
  }

  toJSON(): FieldInfo {
    return {
      name: this.getName(),
      fullName: this.getFullName(),
      type: this.getType().getFullName(),
      accessibility: this.getAccessibility(),
      isStatic: this.isStatic(),
      isReadOnly: this.isInitOnly(),
      isConstant: this.isLiteral(),
      offset: this.getOffset(),
      token: this.getToken(),
      declaringType: this.getParent().getFullName(),
    };
  }

  toString(): string {
    return `${this.constructor.name}(${this.getFullName()}: ${this.getType().getFullName()})`;
  }

  // Private helper methods
  private readRawValue(
    instance: MonoObject | NativePointer | null | undefined,
    options: FieldAccessOptions,
  ): RawFieldValue {
    const type = this.getType();
    const { size } = type.getValueSize();
    const storageSize = Math.max(size, Process.pointerSize);
    const storage = Memory.alloc(storageSize);

    if (this.isStatic()) {
      const domainPtr = this.resolveDomainPointer(options.domain);
      const vtable = this.getStaticVTable(domainPtr);
      this.native.mono_field_static_get_value(vtable, this.pointer, storage);
    } else {
      const target = unwrapInstanceRequired(instance, this);
      this.native.mono_field_get_value(target, this.pointer, storage);
    }

    const kind = type.getKind();
    const isValueType = type.isValueType();
    const treatAsReference = !isValueType && !isPointerLikeKind(kind);
    const valuePointer = treatAsReference ? storage.readPointer() : storage;

    return { storage, valuePointer, type };
  }

  private getStaticVTable(domainPtr: NativePointer): NativePointer {
    const klass = this.getParent();
    klass.ensureInitialized();
    const vtable = this.native.mono_class_vtable(domainPtr, klass.pointer);
    if (pointerIsNull(vtable)) {
      throw new Error(
        `mono_class_vtable returned NULL for ${klass.getFullName()} when accessing static field ${this.getName()}`,
      );
    }
    return vtable;
  }

  private resolveDomainPointer(domain?: MonoDomain | NativePointer): NativePointer {
    if (!domain) {
      return this.api.getRootDomain();
    }
    if (domain instanceof MonoDomain) {
      return domain.pointer;
    }
    return domain;
  }

  private coerceValue(raw: RawFieldValue, type: MonoType): unknown {
    const { storage, valuePointer } = raw;
    const kind = type.getKind();

    // Handle Char specially (return string instead of number)
    if (kind === MonoTypeKind.Char) {
      return String.fromCharCode(storage.readU16());
    }

    // Handle String specially
    if (kind === MonoTypeKind.String) {
      return pointerIsNull(valuePointer) ? null : this.readMonoString(valuePointer);
    }

    // Handle pointer-like types
    if (isPointerLikeKind(kind)) {
      return storage.readPointer();
    }

    // Handle Enum recursively
    if (kind === MonoTypeKind.Enum) {
      const underlying = type.getUnderlyingType();
      if (underlying) {
        return this.coerceValue({ storage, valuePointer, type: underlying }, underlying);
      }
      return storage;
    }

    // Try to read as primitive (note: I8/U8 return Int64/UInt64 objects here)
    const primitiveResult = readPrimitiveValue(storage, kind);
    if (primitiveResult !== null) {
      return primitiveResult;
    }

    // Handle value types and reference types
    if (type.isValueType()) {
      return storage;
    }
    return pointerIsNull(valuePointer) ? null : valuePointer;
  }

  private convertToMonoValue(value: any): MonoObject | NativePointer | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof MonoObject) {
      return value;
    }

    const type = this.getType();
    const kind = type.getKind();

    switch (kind) {
      case MonoTypeKind.String:
        return this.api.stringNew(String(value));
      default:
        return null;
    }
  }

  /**
   * Read a MonoString to JavaScript string using available API
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

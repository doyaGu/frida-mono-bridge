import { MonoHandle } from "./base";
import { pointerIsNull } from "../utils/pointer-utils";
import { readUtf8String, readUtf16String } from "../utils/string-utils";
import { MonoClass } from "./class";
import { MonoObject } from "./object";
import { MonoDomain } from "./domain";
import { MonoType, MonoTypeKind, MonoTypeSummary } from "./type";
import { FieldAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";
import { CustomAttribute } from "./assembly";
import { unwrapInstance, unwrapInstanceRequired } from "../utils/pointer-utils";

export type FieldAccessibility =
  | "private-scope"
  | "private"
  | "protected-and-internal"
  | "internal"
  | "protected"
  | "protected-internal"
  | "public";

export interface FieldAccessOptions {
  domain?: MonoDomain | NativePointer;
}

export interface FieldReadOptions extends FieldAccessOptions {
  coerce?: boolean;
  converter?: (context: FieldCoercionContext) => unknown;
}

export interface FieldCoercionContext {
  pointer: NativePointer;
  storage: NativePointer;
  type: MonoType;
  field: MonoField;
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

const DESCRIBED_FIELD_FLAGS: Record<string, number> = {
  Static: FieldAttribute.Static,
  InitOnly: FieldAttribute.InitOnly,
  Literal: FieldAttribute.Literal,
  NotSerialized: FieldAttribute.NotSerialized,
  HasFieldRva: FieldAttribute.HasFieldRva,
  SpecialName: FieldAttribute.SpecialName,
  RTSpecialName: FieldAttribute.RTSpecialName,
  HasFieldMarshal: FieldAttribute.HasFieldMarshal,
  PInvokeImpl: FieldAttribute.PInvokeImpl,
  HasDefault: FieldAttribute.HasDefault,
};

export class MonoField<T = any> extends MonoHandle {
  #flags: number | null = null;
  #type: MonoType | null = null;
  #name: string | null = null;
  #fullName: string | null = null;
  #parent: MonoClass | null = null;
  #changeTracker: FieldChangeTracker | null = null;
  #accessLog: FieldAccessLogEntry[] = [];

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
      this.native.mono_free(namePtr);
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

  readValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): unknown {
    const raw = this.readRawValue(instance, options);
    const type = raw.type;
    if (options.converter) {
      return options.converter({ pointer: raw.valuePointer, storage: raw.storage, type, field: this });
    }
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

  setValueObject(instance: MonoObject | NativePointer | null, value: MonoObject | NativePointer | null, options: FieldAccessOptions = {}): void {
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

  
  private readRawValue(instance: MonoObject | NativePointer | null | undefined, options: FieldAccessOptions): RawFieldValue {
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
    const pointerLike = isPointerLike(kind);
    const isValueType = type.isValueType();
    const treatAsReference = !isValueType && !pointerLike;
    const valuePointer = treatAsReference ? storage.readPointer() : storage;

    return { storage, valuePointer, type };
  }

  private getStaticVTable(domainPtr: NativePointer): NativePointer {
    const klass = this.getParent();
    klass.ensureInitialized();
    const vtable = this.native.mono_class_vtable(domainPtr, klass.pointer);
    if (pointerIsNull(vtable)) {
      throw new Error(`mono_class_vtable returned NULL for ${klass.getFullName()} when accessing static field ${this.getName()}`);
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

    switch (kind) {
      case MonoTypeKind.Boolean:
        return storage.readU8() !== 0;
      case MonoTypeKind.I1:
        return storage.readS8();
      case MonoTypeKind.U1:
        return storage.readU8();
      case MonoTypeKind.Char:
        return String.fromCharCode(storage.readU16());
      case MonoTypeKind.I2:
        return storage.readS16();
      case MonoTypeKind.U2:
        return storage.readU16();
      case MonoTypeKind.I4:
        return storage.readS32();
      case MonoTypeKind.U4:
        return storage.readU32();
      case MonoTypeKind.I8:
        return storage.readS64();
      case MonoTypeKind.U8:
        return storage.readU64();
      case MonoTypeKind.R4:
        return storage.readFloat();
      case MonoTypeKind.R8:
        return storage.readDouble();
      case MonoTypeKind.String:
        return pointerIsNull(valuePointer) ? null : this.readMonoString(valuePointer);
      case MonoTypeKind.Pointer:
      case MonoTypeKind.ByRef:
      case MonoTypeKind.FunctionPointer:
      case MonoTypeKind.Int:
      case MonoTypeKind.UInt:
        return storage.readPointer();
      case MonoTypeKind.Enum: {
        const underlying = type.getUnderlyingType();
        if (underlying) {
          return this.coerceValue(raw, underlying);
        }
        return storage;
      }
      default:
        if (type.isValueType()) {
          return storage;
        }
        return pointerIsNull(valuePointer) ? null : valuePointer;
    }
  }

  // ===== ENHANCED FUNCTIONALITY =====

  // ===== TYPE-SAFE GETTERS/SETTERS =====

  /**
   * Get the field value as the generic type T
   */
  getTypedValue(instance?: MonoObject | NativePointer | null, options: FieldReadOptions = {}): T {
    return this.readValue(instance, options) as T;
  }

  /**
   * Get static field value as the generic type T
   */
  getTypedStaticValue(options: FieldReadOptions = {}): T {
    return this.readValue(null, options) as T;
  }

  /**
   * Set the field value with type safety
   */
  setTypedValue(instance: MonoObject | NativePointer | null, value: T, options: FieldAccessOptions = {}): void {
    const convertedValue = this.convertToMonoValue(value);
    this.setValueObject(instance, convertedValue, options);
  }

  /**
   * Set static field value with type safety
   */
  setTypedStaticValue(value: T, options: FieldAccessOptions = {}): void {
    const convertedValue = this.convertToMonoValue(value);
    this.setValueObject(null, convertedValue, options);
  }

  // ===== VALIDATION METHODS =====

  /**
   * Validate a value against this field's type
   */
  validateValue(value: any): ValidationResult {
    try {
      const convertedValue = this.convertToMonoValue(value);
      return {
        isValid: true,
        value: convertedValue,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        value: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if a value is valid for this field type
   */
  isValidValue(value: any): boolean {
    return this.validateValue(value).isValid;
  }

  /**
   * Get the expected type information for this field
   */
  getExpectedType(): FieldTypeInfo {
    const type = this.getType();
    return {
      name: type.getFullName(),
      kind: type.getKind(),
      isValueType: type.isValueType(),
      isEnum: type.getKind() === MonoTypeKind.Enum,
      isString: type.getKind() === MonoTypeKind.String,
      isArray: type.getKind() === MonoTypeKind.Array,
      size: type.getValueSize()
    };
  }

  // ===== CHANGE TRACKING =====

  /**
   * Enable change tracking for this field
   */
  enableChangeTracking(): FieldChangeTracker {
    if (!this.#changeTracker) {
      this.#changeTracker = new FieldChangeTracker(this);
    }
    return this.#changeTracker;
  }

  /**
   * Get the change tracker for this field
   */
  getChangeTracker(): FieldChangeTracker | null {
    return this.#changeTracker;
  }

  /**
   * Disable change tracking for this field
   */
  disableChangeTracking(): void {
    this.#changeTracker = null;
  }

  /**
   * Check if change tracking is enabled
   */
  isChangeTrackingEnabled(): boolean {
    return this.#changeTracker !== null;
  }

  /**
   * Get field change history
   */
  getChangeHistory(): FieldChangeRecord[] {
    return this.#changeTracker ? this.#changeTracker.getHistory() : [];
  }

  // ===== ACCESS LOGGING =====

  /**
   * Enable access logging for this field
   */
  enableAccessLogging(maxEntries = 1000): void {
    this.#accessLog = [];
  }

  /**
   * Disable access logging for this field
   */
  disableAccessLogging(): void {
    this.#accessLog = [];
  }

  /**
   * Get access log entries
   */
  getAccessLog(): FieldAccessLogEntry[] {
    return [...this.#accessLog];
  }

  /**
   * Clear access log
   */
  clearAccessLog(): void {
    this.#accessLog = [];
  }

  /**
   * Get access statistics
   */
  getAccessStats(): FieldAccessStats {
    const stats: FieldAccessStats = {
      readCount: 0,
      writeCount: 0,
      totalAccesses: this.#accessLog.length,
      lastAccess: null,
      averageAccessTime: 0,
      errors: 0
    };

    let totalAccessTime = 0;
    this.#accessLog.forEach(entry => {
      if (entry.type === 'read') {
        stats.readCount++;
      } else if (entry.type === 'write') {
        stats.writeCount++;
      }
      if (entry.type === 'error') {
        stats.errors++;
      }
      totalAccessTime += entry.duration;

      if (!stats.lastAccess || entry.timestamp > stats.lastAccess) {
        stats.lastAccess = entry.timestamp;
      }
    });

    if (this.#accessLog.length > 0) {
      stats.averageAccessTime = totalAccessTime / this.#accessLog.length;
    }

    return stats;
  }

  // ===== SECURITY ANALYSIS =====

  /**
   * Get security information for this field
   */
  getSecurityInfo(): FieldSecurityInfo {
    return {
      accessibility: this.getAccessibility(),
      isStatic: this.isStatic(),
      isReadOnly: this.isInitOnly() && !this.isLiteral(),
      isConstant: this.isLiteral(),
      accessLevel: this.calculateAccessLevel(),
      requiresInstance: !this.isStatic(),
      securityFlags: this.getSecurityFlags()
    };
  }

  /**
   * Get the access level (0-100, higher = more accessible)
   */
  getAccessLevel(): number {
    const accessibility = this.getAccessibility();
    const accessLevels: Record<string, number> = {
      'private': 10,
      'private-scope': 15,
      'protected-and-internal': 20,
      'internal': 50,
      'protected': 60,
      'protected-internal': 70,
      'public': 100
    };
    return accessLevels[accessibility] || 0;
  }

  /**
   * Check if this field is safely accessible from the current context
   */
  isSafelyAccessible(): boolean {
    const securityInfo = this.getSecurityInfo();
    // Add actual security logic based on current context
    return securityInfo.accessLevel === 'high' || securityInfo.accessLevel === 'very-high';
  }

  // ===== CUSTOM ATTRIBUTES =====

  /**
   * Get all custom attributes on this field
   */
  getCustomAttributes(): CustomAttribute[] {
    // This would require reflection infrastructure
    return [];
  }

  
  // ===== SERIALIZATION SUPPORT =====

  /**
   * Get the serialized value of this field
   */
  getSerializedValue(instance?: MonoObject | NativePointer | null): any {
    const targetInstance = instance ?? null;
    const value = this.readValue(targetInstance);
    return this.serializeValue(value);
  }

  /**
   * Set the field value from serialized data
   */
  setSerializedValue(instance: MonoObject | NativePointer | null, serializedValue: any): void {
  const value = this.deserializeValue(serializedValue);
  this.setValueObject(instance, value);
  }

  /**
   * Get the static field value from serialized data
   */
  getStaticSerializedValue(): any {
    return this.getSerializedValue(null);
  }

  /**
   * Set the static field value from serialized data
   */
  setStaticSerializedValue(serializedValue: any): void {
    this.setSerializedValue(null, serializedValue);
  }

  // ===== UTILITY AND CONVENIENCE METHODS =====

  /**
   * Check if this field has a value (not null/default)
   */
  hasValue(instance?: MonoObject | NativePointer | null): boolean {
    if (this.isLiteral()) {
      return true; // Literal fields always have values
    }

    try {
  const value = this.readValue(instance ?? null);
      return value !== null && value !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Check if this field has a default value
   */
  hasDefaultValue(): boolean {
    return this.hasDefault();
  }

  /**
   * Reset this field to its default value
   */
  resetToDefault(instance?: MonoObject | NativePointer | null): void {
    if (this.hasDefault()) {
      // Would need to retrieve and set the default value
      // For now, just set to null/zero
      const type = this.getType();
      if (type.isValueType()) {
        const storage = Memory.alloc(type.getValueSize().size);
        storage.writeByteArray(new Array(type.getValueSize().size).fill(0));
        this.setValue(instance ?? null, storage);
      } else {
        this.setValueObject(instance ?? null, null);
      }
    }
  }

  /**
   * Get flag names for this field
   */
  getFlagNames(): string[] {
    try {
      const flags = this.getFlags();
      const flagNames: string[] = [];
      if (this.isStatic()) flagNames.push('static');
      if (this.isInitOnly()) flagNames.push('init-only');
      if (this.isLiteral()) flagNames.push('literal');
      return flagNames;
    } catch {
      return [];
    }
  }

  /**
   * Get a summary of this field as MonoFieldSummary
   */
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
      type: type.describe(),
      token: this.getToken()
    };
  }

  /**
   * Get a human-readable description of this field
   */
  describe(): string {
    const type = this.getType();
    const modifiers = [];

    if (this.isStatic()) modifiers.push('static');
    if (this.isInitOnly()) modifiers.push('readonly');
    if (this.isLiteral()) modifiers.push('const');

    const modifierStr = modifiers.length > 0 ? modifiers.join(' ') + ' ' : '';
    const accessStr = this.getAccessibility();

    return `${modifierStr}${accessStr} ${type.getFullName()} ${this.getName()}`;
  }

  /**
   * Convert to JSON representation
   */
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
      declaringType: this.getParent().getFullName()
    };
  }

  /**
   * Convert to string for debugging
   */
  toString(): string {
    return `${this.constructor.name}(${this.getFullName()}: ${this.getType().getFullName()})`;
  }

  // ===== PRIVATE HELPER METHODS =====

  private convertToMonoValue(value: any): MonoObject | NativePointer | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof MonoObject) {
      return value;
    }

    const type = this.getType();
    const kind = type.getKind();

    // Convert primitive types to Mono objects
    switch (kind) {
      case MonoTypeKind.String:
        return this.api.stringNew(String(value));
      case MonoTypeKind.Boolean:
      case MonoTypeKind.I1:
      case MonoTypeKind.U1:
      case MonoTypeKind.Char:
      case MonoTypeKind.I2:
      case MonoTypeKind.U2:
      case MonoTypeKind.I4:
      case MonoTypeKind.U4:
      case MonoTypeKind.I8:
      case MonoTypeKind.U8:
      case MonoTypeKind.R4:
      case MonoTypeKind.R8:
        // For value types, we'd need to create appropriate boxed objects
        // This is simplified for now
        return null;
      default:
        return null;
    }
  }

  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return { type: 'null', value: null };
    }

    const fieldType = this.getType();
    const typeInfo = {
      name: fieldType.getName(),
      fullName: fieldType.getFullName(),
      isValueType: fieldType.isValueType(),
      isEnum: fieldType.getKind() === MonoTypeKind.Enum
    };

    // Enhanced serialization based on type
    switch (typeof value) {
      case 'string':
        return { type: 'string', value, typeInfo };
      case 'number':
        return { type: 'number', value, typeInfo };
      case 'boolean':
        return { type: 'boolean', value, typeInfo };
      case 'object':
        if (value instanceof MonoObject) {
          return {
            type: 'MonoObject',
            value: {
              className: value.getClass().getFullName(),
              pointer: value.pointer.toString(),
              serializedData: value.toString()
            },
            typeInfo
          };
        } else if (value === null) {
          return { type: 'null', value: null, typeInfo };
        } else if (Array.isArray(value)) {
          return {
            type: 'array',
            value: value.map(item => this._serializeNestedValue(item)),
            typeInfo
          };
        } else {
          return {
            type: 'object',
            value: Object.fromEntries(
              Object.entries(value).map(([key, val]) => [key, this._serializeNestedValue(val)])
            ),
            typeInfo
          };
        }
      default:
        return {
          type: 'unknown',
          value: String(value),
          typeInfo
        };
    }
  }

  private readMonoString(pointer: NativePointer): string {
    const chars = this.native.mono_string_chars(pointer);
    const length = this.native.mono_string_length(pointer) as number;
    return readUtf16String(chars, length);
  }

  private deserializeValue(serializedValue: any): any {
    if (!serializedValue || serializedValue.type === 'null') {
      return null;
    }

    switch (serializedValue.type) {
      case 'string':
      case 'number':
      case 'boolean':
        return serializedValue.value;
      case 'MonoObject':
        // For MonoObject, we need to reconstruct it from the saved data
        // This would require the Mono API to recreate the object
        // For now, return the serialized data as-is
        return serializedValue.value;
      case 'array':
        return serializedValue.value.map((item: any) => this._deserializeNestedValue(item));
      case 'object':
        return Object.fromEntries(
          Object.entries(serializedValue.value).map(([key, val]) => [key, this._deserializeNestedValue(val)])
        );
      default:
        return serializedValue.value;
    }
  }

  /**
   * Serialize nested values recursively
   */
  private _serializeNestedValue(value: any): any {
    if (value === null || value === undefined) {
      return { type: 'null', value: null };
    }

    if (Array.isArray(value)) {
      return {
        type: 'array',
        value: value.map(item => this._serializeNestedValue(item))
      };
    }

    if (typeof value === 'object' && value !== null) {
      return {
        type: 'object',
        value: Object.fromEntries(
          Object.entries(value).map(([key, val]) => [key, this._serializeNestedValue(val)])
        )
      };
    }

    return {
      type: typeof value,
      value
    };
  }

  /**
   * Deserialize nested values recursively
   */
  private _deserializeNestedValue(value: any): any {
    if (!value || value.type === 'null') {
      return null;
    }

    switch (value.type) {
      case 'array':
        return value.value.map((item: any) => this._deserializeNestedValue(item));
      case 'object':
        return Object.fromEntries(
          Object.entries(value.value).map(([key, val]) => [key, this._deserializeNestedValue(val)])
        );
      default:
        return value.value;
    }
  }

  private calculateAccessLevel(): 'low' | 'medium' | 'high' | 'very-high' {
    const level = this.getAccessLevel();
    if (level <= 20) return 'low';
    if (level <= 50) return 'medium';
    if (level <= 80) return 'high';
    return 'very-high';
  }

  private getSecurityFlags(): string[] {
    const flags = this.getFlags();
    const securityFlags: string[] = [];

    if (this.isStatic()) securityFlags.push('static');
    if (this.isInitOnly()) securityFlags.push('readonly');
    if (this.isLiteral()) securityFlags.push('constant');
    if (hasFlag(flags, FieldAttribute.HasFieldRva)) securityFlags.push('has-rva');
    if (hasFlag(flags, FieldAttribute.HasFieldMarshal)) securityFlags.push('has-marshal');

    return securityFlags;
  }

  private logAccess(type: 'read' | 'write' | 'error', duration: number): void {
    if (this.#accessLog.length > 0) {
      // Keep only the most recent entries
      if (this.#accessLog.length >= 1000) {
        this.#accessLog = this.#accessLog.slice(-500);
      }
    }

    this.#accessLog.push({
      type,
      timestamp: Date.now(),
      duration,
      fieldName: this.getName(),
      fieldType: this.getType().getFullName()
    });
  }

  // ===== COMPREHENSIVE VALIDATION METHODS =====

  /**
   * Validate field accessibility and access context
   */
  validateAccess(instance?: MonoObject | NativePointer | null): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if field requires instance but none provided
    if (!this.isStatic() && !instance) {
      errors.push(`Instance field ${this.getName()} requires an object instance`);
    }

    // Check if field is static but instance provided
    if (this.isStatic() && instance) {
      errors.push(`Static field ${this.getName()} should not be accessed with an instance`);
    }

    // Check field accessibility based on current context
    const securityInfo = this.getSecurityInfo();
    if (securityInfo.accessLevel === 'low') {
      errors.push(`Field ${this.getName()} has low accessibility and may not be accessible in current context`);
    }

    // Check if field is read-only
    if (this.isInitOnly() || this.isLiteral()) {
      errors.push(`Field ${this.getName()} is read-only`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate field metadata integrity
   */
  validateMetadata(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if field has a valid name
      if (!this.getName() || this.getName().trim() === '') {
        errors.push('Field has invalid name');
      }

      // Check if field type is accessible
      const fieldType = this.getType();
      if (!fieldType) {
        errors.push('Unable to determine field type');
      }

      // Check if parent class is accessible
      const parentClass = this.getParent();
      if (!parentClass) {
        errors.push('Unable to determine parent class');
      }

      // Check field offset for instance fields
      if (!this.isStatic()) {
        const offset = this.getOffset();
        if (offset < 0) {
          errors.push(`Invalid field offset: ${offset}`);
        }
      }

      // Warnings for unusual patterns
      if (this.isStatic() && this.isInitOnly()) {
        warnings.push('Field is both static and readonly (static readonly pattern)');
      }

      if (this.isLiteral() && !this.isStatic()) {
        warnings.push('Field is literal (const) but not static (unusual pattern)');
      }

      // Check field flags consistency
      const flags = this.getFlags();
      if (flags === 0) {
        warnings.push('Field has no flags set');
      }

    } catch (error) {
      errors.push(`Validation failed with error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate instance compatibility for field access
   */
  validateInstance(instance: MonoObject | NativePointer): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      let instanceClass: MonoClass;

      if (instance instanceof MonoObject) {
        instanceClass = instance.getClass();
      } else {
        // Assume it's a native pointer to an object
        const monoObj = new MonoObject(this.api, instance);
        instanceClass = monoObj.getClass();
      }

      const fieldParentClass = this.getParent();

      // Check if instance type is compatible with field's declaring type
      if (!fieldParentClass.isAssignableFrom(instanceClass)) {
        errors.push(`Cannot access field ${this.getName()} on instance of type ${instanceClass.getFullName()}, expected ${fieldParentClass.getFullName()}`);
      }

      // Check if instance is valid
      if (instance instanceof MonoObject) {
        const validation = instance.validateObject();
        if (!validation.isValid) {
          errors.push(`Instance validation failed: ${validation.errors.join(', ')}`);
        }
      }

    } catch (error) {
      errors.push(`Instance validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Comprehensive field validation including access, metadata, and value
   */
  validateField(value?: any, instance?: MonoObject | NativePointer | null): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validationResults: {
      access: { isValid: boolean; errors: string[] };
      metadata: { isValid: boolean; errors: string[]; warnings: string[] };
      instance?: { isValid: boolean; errors: string[] };
      value?: { isValid: boolean; errors: string[] };
    };
  } {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    const accessValidation = this.validateAccess(instance);
    const metadataValidation = this.validateMetadata();

    if (!accessValidation.isValid) {
      allErrors.push(...accessValidation.errors);
    }
    if (!metadataValidation.isValid) {
      allErrors.push(...metadataValidation.errors);
    }
    allWarnings.push(...metadataValidation.warnings);

    const validationResults: any = {
      access: accessValidation,
      metadata: metadataValidation
    };

    // Validate instance if provided
    if (instance && !this.isStatic()) {
      const instanceValidation = this.validateInstance(instance);
      validationResults.instance = instanceValidation;
      if (!instanceValidation.isValid) {
        allErrors.push(...instanceValidation.errors);
      }
    }

    // Validate value if provided
    if (value !== undefined) {
      const valueValidation = this.validateValue(value);
      validationResults.value = {
        isValid: valueValidation.isValid,
        errors: valueValidation.isValid ? [] : [valueValidation.error || 'Unknown validation error']
      };
      if (!valueValidation.isValid) {
        allErrors.push(...validationResults.value.errors);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      validationResults
    };
  }
}

// ===== ENHANCED INTERFACES =====

export interface FieldTypeInfo {
  name: string;
  kind: MonoTypeKind;
  isValueType: boolean;
  isEnum: boolean;
  isString: boolean;
  isArray: boolean;
  size: { size: number; alignment: number };
}

export interface ValidationResult {
  isValid: boolean;
  value: any;
  error: string | null;
}

export class FieldChangeTracker<T = any> {
  private history: FieldChangeRecord<T>[] = [];
  private maxValue: number = 100;

  constructor(private field: MonoField<T>) {}

  recordChange(oldValue: T, newValue: T): void {
    const record: FieldChangeRecord<T> = {
      timestamp: Date.now(),
      oldValue,
      newValue,
      fieldName: this.field.getName(),
      fieldType: this.field.getType().getFullName()
    };

    this.history.push(record);

    // Keep only recent history
    if (this.history.length > this.maxValue) {
      this.history = this.history.slice(-this.maxValue / 2);
    }
  }

  getHistory(): FieldChangeRecord<T>[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getChangeCount(): number {
    return this.history.length;
  }

  getLastChange(): FieldChangeRecord<T> | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  }

export interface FieldChangeRecord<T = any> {
  timestamp: number;
  oldValue: T;
  newValue: T;
  fieldName: string;
  fieldType: string;
}

export interface FieldAccessLogEntry {
  type: 'read' | 'write' | 'error';
  timestamp: number;
  duration: number;
  fieldName: string;
  fieldType: string;
}

export interface FieldAccessStats {
  readCount: number;
  writeCount: number;
  totalAccesses: number;
  lastAccess: number | null;
  averageAccessTime: number;
  errors: number;
}

export interface FieldSecurityInfo {
  accessibility: FieldAccessibility;
  isStatic: boolean;
  isReadOnly: boolean;
  isConstant: boolean;
  accessLevel: 'low' | 'medium' | 'high' | 'very-high';
  requiresInstance: boolean;
  securityFlags: string[];
}

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

function isPointerLike(kind: MonoTypeKind): boolean {
  switch (kind) {
    case MonoTypeKind.Pointer:
    case MonoTypeKind.ByRef:
    case MonoTypeKind.FunctionPointer:
    case MonoTypeKind.Int:
    case MonoTypeKind.UInt:
      return true;
    default:
      return false;
  }
}

// ===== DEBUGGING AND PROFILING HELPERS =====

/**
 * Field debugging utilities
 */
export class FieldDebugger {
  /**
   * Get comprehensive field debug information
   */
  static getDebugInfo(field: MonoField): {
    field: {
      name: string;
      declaringClass: string;
      fieldType: string;
      offset: number;
      flags: number;
      flagNames: string[];
    };
    memory: {
      staticAddress: NativePointer | null;
      instanceOffset: number | null;
      estimatedSize: number;
    };
    access: {
      isStatic: boolean;
      isLiteral: boolean;
      isInitOnly: boolean;
      accessibility: string;
      securityLevel: string;
      securityFlags: string[];
    };
    typeInfo: {
      isValueType: boolean;
      isEnum: boolean;
      isPrimitive: boolean;
      size: number;
      alignment: number;
    };
  } {
    const fieldType = field.getType();
    const declaringClass = this._getDeclaringClass(field);

    return {
      field: {
        name: field.getName(),
        declaringClass: declaringClass,
        fieldType: fieldType.getFullName(),
        offset: field.getOffset(),
        flags: field.getFlags(),
        flagNames: this._getFlagNames(field)
      },
      memory: {
        staticAddress: field.isStatic() ? this._getStaticAddress(field) : null,
        instanceOffset: field.isStatic() ? null : field.getOffset(),
        estimatedSize: this._estimateFieldSize(field)
      },
      access: {
        isStatic: field.isStatic(),
        isLiteral: field.isLiteral(),
        isInitOnly: field.isInitOnly(),
        accessibility: this._getAccessibility(field),
        securityLevel: this._getSecurityLevel(field),
        securityFlags: this._getSecurityFlags(field)
      },
      typeInfo: {
        isValueType: fieldType.isValueType(),
        isEnum: fieldType.getKind() === MonoTypeKind.Enum,
        isPrimitive: this._isPrimitiveType(fieldType),
        size: this._estimateTypeSize(fieldType),
        alignment: this._estimateTypeAlignment(fieldType)
      }
    };
  }

  /**
   * Profile field access performance
   */
  static profileAccess(field: MonoField, objectPtr?: NativePointer, iterations: number = 1000): {
    readPerformance: {
      totalTime: number;
      averageTime: number;
      operationsPerSecond: number;
      successRate: number;
      errors: string[];
    };
    writePerformance: {
      totalTime: number;
      averageTime: number;
      operationsPerSecond: number;
      successRate: number;
      errors: string[];
    };
    metadata: {
      iterations: number;
      fieldStatic: boolean;
      objectProvided: boolean;
      timestamp: number;
    };
  } {
    const readErrors: string[] = [];
    const writeErrors: string[] = [];
    let readSuccesses = 0;
    let writeSuccesses = 0;

    // Profile reads
    const readStartTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      try {
        if (field.isStatic()) {
          field.getValue();
        } else if (objectPtr) {
          field.getValue(objectPtr);
        } else {
          readErrors.push('No object pointer provided for instance field');
          break;
        }
        readSuccesses++;
      } catch (error) {
        readErrors.push(`Read error on iteration ${i}: ${error}`);
      }
    }
    const readEndTime = Date.now();

    // Profile writes
    const writeStartTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      try {
        const testValue = this._generateTestValue(field);
        if (field.isStatic()) {
          field.setValue(ptr(0), testValue); // Static fields still need object ptr
        } else if (objectPtr) {
          field.setValue(objectPtr, testValue);
        } else {
          writeErrors.push('No object pointer provided for instance field');
          break;
        }
        writeSuccesses++;
      } catch (error) {
        writeErrors.push(`Write error on iteration ${i}: ${error}`);
      }
    }
    const writeEndTime = Date.now();

    const readTotalTime = readEndTime - readStartTime;
    const writeTotalTime = writeEndTime - writeStartTime;

    return {
      readPerformance: {
        totalTime: readTotalTime,
        averageTime: readTotalTime / iterations,
        operationsPerSecond: (readSuccesses / readTotalTime) * 1000,
        successRate: readSuccesses / iterations,
        errors: readErrors
      },
      writePerformance: {
        totalTime: writeTotalTime,
        averageTime: writeTotalTime / iterations,
        operationsPerSecond: (writeSuccesses / writeTotalTime) * 1000,
        successRate: writeSuccesses / iterations,
        errors: writeErrors
      },
      metadata: {
        iterations,
        fieldStatic: field.isStatic(),
        objectProvided: !!objectPtr,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Validate field integrity and accessibility
   */
  static validateField(field: MonoField, objectPtr?: NativePointer): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    accessibility: {
      canRead: boolean;
      canWrite: boolean;
      isAccessible: boolean;
      restrictions: string[];
    };
    memory: {
      staticAddressValid: boolean;
      instanceOffsetValid: boolean;
      typeConsistent: boolean;
    };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if field pointer is valid
    if (pointerIsNull(field.pointer)) {
      errors.push('Field pointer is null or invalid');
    }

    // Check if we can get basic field information
    let nameValid = false;
    let typeValid = false;
    let declaringClassValid = false;

    try {
      const name = field.getName();
      nameValid = !!name && name.length > 0;
      if (!nameValid) {
        errors.push('Unable to get valid field name');
      }
    } catch (error) {
      errors.push(`Error getting field name: ${error}`);
    }

    try {
      const type = field.getType();
      typeValid = !!type;
      if (!typeValid) {
        errors.push('Unable to get field type');
      }
    } catch (error) {
      errors.push(`Error getting field type: ${error}`);
    }

    try {
      const declaringClass = this._getDeclaringClass(field);
      declaringClassValid = !!declaringClass;
      if (!declaringClassValid) {
        errors.push('Unable to get declaring class');
      }
    } catch (error) {
      errors.push(`Error getting declaring class: ${error}`);
    }

    // Test accessibility
    let canRead = false;
    let canWrite = false;
    const restrictions: string[] = [];

    try {
      if (field.isStatic()) {
        field.getValue();
        canRead = true;
      } else if (objectPtr) {
        field.getValue(objectPtr);
        canRead = true;
      } else {
        restrictions.push('Cannot test read access - no object pointer provided');
      }
    } catch (error) {
      restrictions.push(`Read access restricted: ${error}`);
    }

    try {
      const testValue = this._generateTestValue(field);
      if (field.isStatic()) {
        field.setValue(ptr(0), testValue); // Static fields still need object ptr
        canWrite = true;
      } else if (objectPtr) {
        field.setValue(objectPtr, testValue);
        canWrite = true;
      } else {
        restrictions.push('Cannot test write access - no object pointer provided');
      }
    } catch (error) {
      restrictions.push(`Write access restricted: ${error}`);
    }

    if (field.isLiteral()) {
      warnings.push('Field is literal - write operations will be ignored');
    }

    if (field.isInitOnly()) {
      warnings.push('Field is init-only - write operations may be restricted');
    }

    // Memory validation
    const staticAddressValid = field.isStatic() ? !pointerIsNull(this._getStaticAddress(field)) : true;
    const instanceOffsetValid = !field.isStatic() ? field.getOffset() >= 0 : true;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      accessibility: {
        canRead,
        canWrite,
        isAccessible: canRead || canWrite,
        restrictions
      },
      memory: {
        staticAddressValid,
        instanceOffsetValid,
        typeConsistent: typeValid
      }
    };
  }

  // ===== PRIVATE DEBUGGING HELPERS =====

  private static _estimateFieldSize(field: MonoField): number {
    try {
      const fieldType = field.getType();
      return this._estimateTypeSize(fieldType);
    } catch {
      return 8; // Default estimate
    }
  }

  private static _estimateTypeSize(type: MonoType): number {
    const kind = type.getKind();

    switch (kind) {
      case MonoTypeKind.Boolean:
      case MonoTypeKind.I1:
      case MonoTypeKind.U1:
        return 1;
      case MonoTypeKind.I2:
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        return 2;
      case MonoTypeKind.I4:
      case MonoTypeKind.U4:
      case MonoTypeKind.R4:
        return 4;
      case MonoTypeKind.I8:
      case MonoTypeKind.U8:
      case MonoTypeKind.R8:
        return 8;
      case MonoTypeKind.String:
      case MonoTypeKind.Class:
      case MonoTypeKind.Object:
        return Process.pointerSize; // Pointer size
      case MonoTypeKind.Array:
        return Process.pointerSize; // Array reference
      default:
        return Process.pointerSize; // Default to pointer size
    }
  }

  private static _estimateTypeAlignment(type: MonoType): number {
    const size = this._estimateTypeSize(type);
    return size <= Process.pointerSize ? size : Process.pointerSize;
  }

  private static _isPrimitiveType(type: MonoType): boolean {
    const kind = type.getKind();
    return kind >= MonoTypeKind.Boolean && kind <= MonoTypeKind.R8;
  }

  private static _generateTestValue(field: MonoField): any {
    try {
      const fieldType = field.getType();
      const kind = fieldType.getKind();

      switch (kind) {
        case MonoTypeKind.Boolean:
          return true;
        case MonoTypeKind.I1:
        case MonoTypeKind.I2:
        case MonoTypeKind.I4:
          return 42;
        case MonoTypeKind.I8:
          return BigInt(42);
        case MonoTypeKind.U1:
        case MonoTypeKind.U2:
        case MonoTypeKind.U4:
          return 42;
        case MonoTypeKind.U8:
          return BigInt(42);
        case MonoTypeKind.R4:
          return 3.14;
        case MonoTypeKind.R8:
          return 3.14159;
        case MonoTypeKind.String:
          return "test";
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private static _getSecurityFlags(field: MonoField): string[] {
    const flags = field.getFlags();
    const securityFlags: string[] = [];

    if (field.isStatic()) securityFlags.push('static');
    if (field.isInitOnly()) securityFlags.push('readonly');
    if (field.isLiteral()) securityFlags.push('constant');
    if (hasFlag(flags, FieldAttribute.HasFieldRva)) securityFlags.push('has-rva');
    if (hasFlag(flags, FieldAttribute.HasFieldMarshal)) securityFlags.push('has-marshal');

    return securityFlags;
  }

  private static _getDeclaringClass(field: MonoField): string {
    try {
      return field.getParent().getFullName();
    } catch {
      return "Unknown";
    }
  }

  private static _getFlagNames(field: MonoField): string[] {
    try {
      const flags = field.getFlags();
      const flagNames: string[] = [];

      if (field.isStatic()) flagNames.push('static');
      if (field.isInitOnly()) flagNames.push('init-only');
      if (field.isLiteral()) flagNames.push('literal');

      return flagNames;
    } catch {
      return [];
    }
  }

  private static _getStaticAddress(field: MonoField): NativePointer {
    try {
      if (field.isStatic()) {
        const domain = field.api.getRootDomain();
        const klass = field.getParent();
        const vtable = field.api.native.mono_class_vtable(domain, klass.pointer);
        if (!pointerIsNull(vtable)) {
          const offset = field.getOffset();
          return vtable.add(offset);
        }
      }
      return ptr(0);
    } catch {
      return ptr(0);
    }
  }

  private static _getAccessibility(field: MonoField): string {
    try {
      const flags = field.getFlags();

      if (hasFlag(flags, FieldAttribute.Public)) return 'public';
      if (hasFlag(flags, FieldAttribute.Private)) return 'private';
      if (hasFlag(flags, FieldAttribute.Family)) return 'protected';
      if (hasFlag(flags, FieldAttribute.Assembly)) return 'internal';

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private static _getSecurityLevel(field: MonoField): string {
    try {
      const flags = field.getFlags();

      if (hasFlag(flags, FieldAttribute.FieldAccessMask)) {
        // Determine security level based on access flags
        return 'standard';
      }

      return 'low';
    } catch {
      return 'unknown';
    }
  }
}

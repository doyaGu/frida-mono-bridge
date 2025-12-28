import { TypeAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";
import { tryGetClassPtrFromMonoType } from "../runtime/type-resolution";
import { lazy } from "../utils/cache";
import { findSimilarNames, formatSimilarNames, MonoErrorCodes, raise } from "../utils/errors";
import { Logger } from "../utils/log";
import { enumerateMonoHandles, pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import type { CustomAttribute } from "./attribute";
import { createClassAttributeContext, getCustomAttributes } from "./attribute";
import { MonoDomain } from "./domain";
import { MonoField } from "./field";
import type { MethodArgument } from "./handle";
import { MonoHandle } from "./handle";
import { MonoImage } from "./image";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { MonoProperty } from "./property";
import { MonoType, MonoTypeSummary } from "./type";

const classLogger = Logger.withTag("MonoClass");

export interface MonoClassSummary {
  name: string;
  namespace: string;
  fullName: string;
  flags: number;
  flagNames: string[];
  isInterface: boolean;
  isAbstract: boolean;
  isSealed: boolean;
  isValueType: boolean;
  isEnum: boolean;
  isDelegate: boolean;
  isGenericType: boolean;
  isGenericTypeDefinition: boolean;
  genericArgumentCount: number;
  genericParameterCount: number;
  parent: string | null;
  methodCount: number;
  fieldCount: number;
  propertyCount: number;
  typeToken: number;
  type: MonoTypeSummary;
}

const TYPE_DESCRIBED_FLAGS: Record<string, number> = {
  Abstract: TypeAttribute.Abstract,
  Sealed: TypeAttribute.Sealed,
  SpecialName: TypeAttribute.SpecialName,
  RTSpecialName: TypeAttribute.RTSpecialName,
  Import: TypeAttribute.Import,
  Serializable: TypeAttribute.Serializable,
  WindowsRuntime: TypeAttribute.WindowsRuntime,
  HasSecurity: TypeAttribute.HasSecurity,
  BeforeFieldInit: TypeAttribute.BeforeFieldInit,
};

/**
 * Represents a Mono class
 */
export class MonoClass extends MonoHandle {
  #initialized = false;
  #methodCache: Map<string, MonoMethod | null> | null = null;

  // ===== CORE PROPERTIES =====

  /**
   * Get class name
   */
  @lazy
  get name(): string {
    const namePtr = this.native.mono_class_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  /**
   * Get class namespace
   */
  @lazy
  get namespace(): string {
    const namespacePtr = this.native.mono_class_get_namespace(this.pointer);
    return readUtf8String(namespacePtr);
  }

  /**
   * Get full class name (namespace.name)
   */
  @lazy
  get fullName(): string {
    return this.namespace ? `${this.namespace}.${this.name}` : this.name;
  }

  /**
   * Get the image containing this class
   */
  @lazy
  get image(): MonoImage {
    const imagePtr = this.native.mono_class_get_image(this.pointer);
    return new MonoImage(this.api, imagePtr);
  }

  /**
   * Get class flags
   */
  @lazy
  get flags(): number {
    return this.native.mono_class_get_flags(this.pointer) as number;
  }

  /**
   * Get the type token
   */
  @lazy
  get typeToken(): number {
    return this.native.mono_class_get_type_token(this.pointer) as number;
  }

  /**
   * Get the MonoType for this class
   */
  @lazy
  get type(): MonoType {
    const typePtr = this.native.mono_class_get_type(this.pointer);
    return new MonoType(this.api, typePtr);
  }

  /**
   * Get the instance size of this class in bytes.
   */
  @lazy
  get instanceSize(): number {
    return this.native.mono_class_instance_size(this.pointer) as number;
  }

  /**
   * Get the value size and alignment of this class.
   * @returns Object with size and alignment in bytes
   */
  @lazy
  get valueSize(): { size: number; alignment: number } {
    const alignmentPtr = Memory.alloc(4);
    const size = this.native.mono_class_value_size(this.pointer, alignmentPtr) as number;
    const alignment = alignmentPtr.readU32();
    return { size, alignment };
  }

  /**
   * Get custom attributes applied to this class.
   * Uses mono_custom_attrs_from_class API to retrieve attribute metadata.
   * @returns Array of CustomAttribute objects with attribute type information
   */
  @lazy
  get customAttributes(): CustomAttribute[] {
    return getCustomAttributes(
      createClassAttributeContext(this.api, this.pointer, this.native),
      ptr => new MonoClass(this.api, ptr).name,
      ptr => new MonoClass(this.api, ptr).fullName,
    );
  }

  // ===== TYPE CHECKS =====

  @lazy
  get isEnum(): boolean {
    return (this.native.mono_class_is_enum(this.pointer) as number) !== 0;
  }

  @lazy
  get isValueType(): boolean {
    return (this.native.mono_class_is_valuetype(this.pointer) as number) !== 0;
  }

  @lazy
  get isDelegate(): boolean {
    // NOTE: mono_class_is_delegate is only available in mono-2.0-bdwgc.dll
    if (this.api.hasExport("mono_class_is_delegate")) {
      return (this.native.mono_class_is_delegate(this.pointer) as number) !== 0;
    }
    // Fallback: Check if this class inherits from System.Delegate
    try {
      const parent = this.parent;
      if (parent) {
        const parentName = parent.fullName;
        return parentName === "System.Delegate" || parentName === "System.MulticastDelegate";
      }
    } catch {
      // Ignore errors in fallback
    }
    return false;
  }

  @lazy
  get isInterface(): boolean {
    const semantics = getMaskedValue(this.flags, TypeAttribute.ClassSemanticsMask);
    return semantics === TypeAttribute.Interface;
  }

  @lazy
  get isAbstract(): boolean {
    return hasFlag(this.flags, TypeAttribute.Abstract);
  }

  @lazy
  get isSealed(): boolean {
    return hasFlag(this.flags, TypeAttribute.Sealed);
  }

  @lazy
  get isBeforeFieldInit(): boolean {
    return hasFlag(this.flags, TypeAttribute.BeforeFieldInit);
  }

  // ===== MEMBER ACCESS (COLLECTIONS) =====

  /**
   * Get all methods in this class
   */
  @lazy
  get methods(): MonoMethod[] {
    return enumerateMonoHandles(
      iter => this.native.mono_class_get_methods(this.pointer, iter),
      ptr => new MonoMethod(this.api, ptr),
    );
  }

  /**
   * Get all fields in this class
   */
  @lazy
  get fields(): MonoField[] {
    return enumerateMonoHandles(
      iter => this.native.mono_class_get_fields(this.pointer, iter),
      ptr => new MonoField(this.api, ptr),
    );
  }

  /**
   * Get all properties in this class
   */
  @lazy
  get properties(): MonoProperty[] {
    return enumerateMonoHandles(
      iter => this.native.mono_class_get_properties(this.pointer, iter),
      ptr => new MonoProperty(this.api, ptr),
    );
  }

  // ===== MEMBER LOOKUP (INDIVIDUAL) =====

  /**
   * Find a method by name, throwing if not found.
   * @param name Method name
   * @param paramCount Parameter count (-1 to match any)
   * @returns MonoMethod
   * @throws {MonoMethodNotFoundError} if method not found
   */
  method(name: string, paramCount = -1): MonoMethod {
    const m = this.tryMethod(name, paramCount);
    if (m) {
      return m;
    }
    const paramHint = paramCount >= 0 ? ` with ${paramCount} parameter(s)` : "";

    // Find similar method names
    const methodNames = this.methods.map(m => m.name);
    const similar = findSimilarNames(name, methodNames);
    const similarHint = formatSimilarNames(similar);
    const hint = similarHint ? similarHint : "Use tryMethod() to avoid throwing";

    raise(
      MonoErrorCodes.METHOD_NOT_FOUND,
      `Method '${name}'${paramHint} not found on class '${this.fullName}'`,
      hint,
    );
  }

  /**
   * Try to find a method by name without throwing.
   * Uses internal caching to improve performance for repeated lookups.
   * @param name Method name
   * @param paramCount Parameter count (-1 to match any)
   * @returns Method if found, null otherwise
   */
  tryMethod(name: string, paramCount = -1): MonoMethod | null {
    // Build cache key
    const cacheKey = `${name}:${paramCount}`;

    // Initialize cache lazily
    if (!this.#methodCache) {
      this.#methodCache = new Map();
    }

    // Check cache first
    if (this.#methodCache.has(cacheKey)) {
      return this.#methodCache.get(cacheKey) ?? null;
    }

    // Perform actual lookup
    const namePtr = this.api.allocUtf8StringCached(name);
    const methodPtr = this.native.mono_class_get_method_from_name(this.pointer, namePtr, paramCount);
    const result = pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);

    // Cache result
    this.#methodCache.set(cacheKey, result);
    return result;
  }

  /**
   * Clear the method lookup cache.
   * Call this if class methods change dynamically (rare in practice).
   */
  clearMethodCache(): void {
    this.#methodCache?.clear();
  }

  /**
   * Check if this class has a method with the given name.
   * @param name Method name
   * @param paramCount Parameter count (-1 to match any)
   * @returns True if method exists
   */
  hasMethod(name: string, paramCount = -1): boolean {
    return this.tryMethod(name, paramCount) !== null;
  }

  /**
   * Find a field by name, throwing if not found.
   * @param name Field name
   * @returns MonoField
   * @throws {MonoFieldNotFoundError} if field not found
   */
  field(name: string): MonoField {
    const f = this.tryField(name);
    if (f) {
      return f;
    }

    // Find similar field names
    const fieldNames = this.fields.map(f => f.name);
    const similar = findSimilarNames(name, fieldNames);
    const similarHint = formatSimilarNames(similar);
    const hint = similarHint ? similarHint : "Use tryField() to avoid throwing";

    raise(
      MonoErrorCodes.FIELD_NOT_FOUND,
      `Field '${name}' not found on class '${this.fullName}'`,
      hint,
    );
  }

  /**
   * Try to find a field by name without throwing.
   * @param name Field name
   * @returns Field if found, null otherwise
   */
  tryField(name: string): MonoField | null {
    const namePtr = this.api.allocUtf8StringCached(name);
    const fieldPtr = this.native.mono_class_get_field_from_name(this.pointer, namePtr);
    return pointerIsNull(fieldPtr) ? null : new MonoField(this.api, fieldPtr);
  }

  /**
   * Check if this class has a field with the given name.
   * @param name Field name
   * @returns True if field exists
   */
  hasField(name: string): boolean {
    return this.tryField(name) !== null;
  }

  /**
   * Find a property by name, throwing if not found.
   * @param name Property name
   * @returns MonoProperty
   * @throws {MonoPropertyNotFoundError} if property not found
   */
  property(name: string): MonoProperty {
    const p = this.tryProperty(name);
    if (p) {
      return p;
    }

    // Find similar property names
    const propertyNames = this.properties.map(p => p.name);
    const similar = findSimilarNames(name, propertyNames);
    const similarHint = formatSimilarNames(similar);
    const hint = similarHint ? similarHint : "Use tryProperty() to avoid throwing";

    raise(
      MonoErrorCodes.PROPERTY_NOT_FOUND,
      `Property '${name}' not found on class '${this.fullName}'`,
      hint,
    );
  }

  /**
   * Try to find a property by name without throwing.
   * @param name Property name
   * @returns Property if found, null otherwise
   */
  tryProperty(name: string): MonoProperty | null {
    const namePtr = this.api.allocUtf8StringCached(name);
    const propertyPtr = this.native.mono_class_get_property_from_name(this.pointer, namePtr);
    return pointerIsNull(propertyPtr) ? null : new MonoProperty(this.api, propertyPtr);
  }

  /**
   * Check if this class has a property with the given name.
   * @param name Property name
   * @returns True if property exists
   */
  hasProperty(name: string): boolean {
    return this.tryProperty(name) !== null;
  }

  /**
   * Find a nested type by name, throwing if not found.
   * @param name Nested type name
   * @returns MonoClass
   * @throws {MonoClassNotFoundError} if nested type not found
   */
  nestedType(name: string): MonoClass {
    const nested = this.tryNestedType(name);
    if (nested) {
      return nested;
    }
    raise(
      MonoErrorCodes.CLASS_NOT_FOUND,
      `Nested type '${name}' not found in class '${this.fullName}'`,
      "Use tryNestedType() to avoid throwing",
    );
  }

  /**
   * Try to find a nested type by name without throwing.
   * @param name Nested type name
   * @returns Nested type if found, null otherwise
   */
  tryNestedType(name: string): MonoClass | null {
    for (const nested of this.nestedTypes) {
      if (nested.name === name) {
        return nested;
      }
    }
    return null;
  }

  /**
   * Check if this class has a nested type with the given name.
   * @param name Nested type name
   * @returns True if nested type exists
   */
  hasNestedType(name: string): boolean {
    return this.tryNestedType(name) !== null;
  }

  // ===== CLASS RELATIONSHIPS =====

  /**
   * Get parent class
   */
  @lazy
  get parent(): MonoClass | null {
    const parentPtr = this.native.mono_class_get_parent(this.pointer);
    return pointerIsNull(parentPtr) ? null : new MonoClass(this.api, parentPtr);
  }

  /**
   * Get interfaces implemented by this class
   */
  @lazy
  get interfaces(): MonoClass[] {
    return enumerateMonoHandles(
      iter => this.native.mono_class_get_interfaces(this.pointer, iter),
      ptr => new MonoClass(this.api, ptr),
    );
  }

  /**
   * Get nested types in this class
   */
  @lazy
  get nestedTypes(): MonoClass[] {
    return enumerateMonoHandles(
      iter => this.native.mono_class_get_nested_types(this.pointer, iter),
      ptr => new MonoClass(this.api, ptr),
    );
  }

  /**
   * Check if this class is a subclass of the target class.
   * @param target The potential base class
   * @param checkInterfaces Whether to also check if target is an interface implemented by this class
   * @returns True if this class derives from target
   */
  isSubclassOf(target: MonoClass, checkInterfaces = false): boolean {
    return (
      (this.native.mono_class_is_subclass_of(this.pointer, target.pointer, checkInterfaces ? 1 : 0) as number) !== 0
    );
  }

  /**
   * Check if this class is assignable from another class.
   * @param other The source class
   * @returns True if an instance of 'other' can be assigned to this class
   */
  isAssignableFrom(other: MonoClass): boolean {
    return (this.native.mono_class_is_assignable_from(this.pointer, other.pointer) as number) !== 0;
  }

  /**
   * Check if this class implements a specific interface.
   * @param iface The interface class to check
   * @returns True if this class implements the interface
   */
  implementsInterface(iface: MonoClass): boolean {
    // NOTE: mono_class_implements_interface is only available in mono-2.0-bdwgc.dll
    if (this.api.hasExport("mono_class_implements_interface")) {
      return (this.native.mono_class_implements_interface(this.pointer, iface.pointer) as number) !== 0;
    }
    // Fallback: Check interfaces manually
    try {
      const interfaces = this.interfaces;
      return interfaces.some(i => i.pointer.toString() === iface.pointer.toString());
    } catch {
      return false;
    }
  }

  // ===== OBJECT CREATION AND INITIALIZATION =====

  /**
   * Create a new instance of this class.
   *
   * @param args Constructor arguments (optional). If provided, finds and invokes
   *             a matching constructor. If omitted or empty, calls the default constructor.
   * @returns New MonoObject instance
   *
   * @example
   * ```typescript
   * // Create with default constructor
   * const obj = klass.newObject();
   *
   * // Create with constructor arguments
   * const obj = klass.newObject([42, "hello"]);
   *
   * // Create with typed arguments
   * const obj = klass.newObject([{ value: 100, type: intType }]);
   * ```
   */
  newObject(args?: MethodArgument[]): MonoObject {
    this.ensureInitialized();
    const domain = this.api.getRootDomain();
    const objectPtr = this.native.mono_object_new(domain, this.pointer);
    const obj = new MonoObject(this.api, objectPtr);

    // If no args provided, use default initialization
    if (!args || args.length === 0) {
      this.native.mono_runtime_object_init(objectPtr);
      return obj;
    }

    // Find matching constructor
    const ctor = this.findConstructor(args.length);
    if (!ctor) {
      raise(
        MonoErrorCodes.METHOD_NOT_FOUND,
        `No constructor with ${args.length} parameter(s) found on class '${this.fullName}'`,
        "Check constructor signature or use newObject() for default constructor",
      );
    }

    // Invoke constructor
    ctor.invoke(objectPtr, args);
    return obj;
  }

  /**
   * Allocate a new instance of this class.
   *
   * @param args Constructor arguments (optional). If provided, finds and invokes
   *             a matching constructor. If omitted, calls the default constructor.
   * @returns New MonoObject instance
   *
   * @example
   * ```typescript
   * // Allocate with default constructor
   * const obj = klass.alloc();
   *
   * // Allocate with constructor arguments
   * const obj = klass.alloc([42, "hello"]);
   * ```
   */
  alloc(args?: MethodArgument[]): MonoObject {
    return this.newObject(args);
  }

  /**
   * Allocate a raw instance of this class without calling any constructor.
   *
   * This method only allocates memory for the object but does NOT call
   * any initialization logic. Use this when you need to manually set up
   * object fields (e.g., for cloning or delegate creation).
   *
   * @returns New MonoObject instance (uninitialized)
   *
   * @example
   * ```typescript
   * // Allocate raw object for manual field copying
   * const rawObj = klass.allocRaw();
   * field.setValue(rawObj, someValue);
   * ```
   */
  allocRaw(): MonoObject {
    this.ensureInitialized();
    const domain = this.api.getRootDomain();
    const objectPtr = this.native.mono_object_new(domain, this.pointer);
    return new MonoObject(this.api, objectPtr);
  }

  /**
   * Try to create a new instance of this class without throwing.
   *
   * @param args Constructor arguments (optional)
   * @returns New MonoObject instance if successful, null otherwise
   */
  tryNewObject(args?: MethodArgument[]): MonoObject | null {
    try {
      return this.newObject(args);
    } catch {
      return null;
    }
  }

  /**
   * Find a constructor with the specified number of parameters.
   *
   * @param paramCount Number of parameters (-1 for any)
   * @returns MonoMethod representing the constructor, or null if not found
   */
  findConstructor(paramCount = -1): MonoMethod | null {
    return this.tryMethod(".ctor", paramCount);
  }

  /**
   * Get all constructors of this class.
   *
   * @returns Array of MonoMethod representing constructors
   */
  @lazy
  get constructors(): MonoMethod[] {
    return this.methods.filter(m => m.isConstructor);
  }

  /**
   * Ensure the class is initialized.
   * Classes must be initialized before use. This is done automatically by most operations.
   * @throws {MonoInitError} if initialization fails
   */
  ensureInitialized(): void {
    if (this.#initialized) {
      return;
    }
    const result = this.native.mono_class_init(this.pointer);
    if (pointerIsNull(result)) {
      raise(
        MonoErrorCodes.INIT_FAILED,
        `Failed to initialize class ${this.fullName}`,
        "Check that the class definition is valid",
      );
    }
    this.#initialized = true;
  }

  /**
   * Get the VTable for this class in the specified domain.
   * @param domain Domain to get VTable for (default: root domain)
   * @returns VTable pointer
   * @throws {MonoInitError} if VTable creation fails
   */
  getVTable(domain: MonoDomain | NativePointer | null = null): NativePointer {
    const domainPtr = domain instanceof MonoDomain ? domain.pointer : (domain ?? this.api.getRootDomain());
    this.ensureInitialized();
    const vtable = this.native.mono_class_vtable(domainPtr, this.pointer);
    if (pointerIsNull(vtable)) {
      raise(
        MonoErrorCodes.INIT_FAILED,
        `Failed to get vtable for class ${this.fullName}`,
        "Ensure the class is properly initialized in the specified domain",
      );
    }
    return vtable;
  }

  // ===== GENERIC TYPE SUPPORT =====

  /**
   * Parse the generic parameter count from the class name.
   * Generic types have a backtick followed by the parameter count (e.g., `List\`1`, `Dictionary\`2`).
   * @returns The generic parameter count from the class name, or 0 if not a generic type.
   */
  private parseGenericParameterCountFromName(): number {
    const name = this.name;
    const backtickIndex = name.lastIndexOf("`");
    if (backtickIndex === -1) {
      return 0;
    }
    const countStr = name.substring(backtickIndex + 1);
    const count = parseInt(countStr, 10);
    return isNaN(count) ? 0 : count;
  }

  /**
   * Check if this is a generic type definition (open generic type like `List<T>`).
   * Uses standard Mono API `mono_class_is_generic` if available, otherwise falls back to name parsing.
   * This is the unbound form that can be used with makeGenericType().
   */
  @lazy
  get isGenericTypeDefinition(): boolean {
    // Try mono_class_is_generic first (standard Mono API)
    try {
      const result = this.native.mono_class_is_generic(this.pointer);
      return Number(result) !== 0;
    } catch {
      // Fall through to name-based detection
    }

    // Fall back to name-based detection (backtick notation)
    return this.parseGenericParameterCountFromName() > 0;
  }

  /**
   * Check if this is a constructed generic type (closed generic like `List<int>`).
   * Uses standard Mono API via MonoType to detect MONO_TYPE_GENERICINST.
   */
  @lazy
  get isConstructedGenericType(): boolean {
    try {
      // MonoTypeKind.GenericInstance corresponds to MONO_TYPE_GENERICINST (0x15)
      return this.type.kind === 0x15; // MONO_TYPE_GENERICINST
    } catch {
      return false;
    }
  }

  /**
   * Check if this class is a generic type (either open or closed).
   * An open generic type has unbound type parameters (e.g., `List<T>`).
   * A closed generic type has all type parameters bound (e.g., `List<int>`).
   */
  @lazy
  get isGenericType(): boolean {
    return this.isGenericTypeDefinition || this.isConstructedGenericType;
  }

  /**
   * Get the number of generic type parameters (for open generic type definitions).
   * Parsed from the class name using backtick notation (e.g., `List\`1` returns 1).
   * Returns 0 for non-generic types or constructed generic types.
   */
  @lazy
  get genericParameterCount(): number {
    // Only generic type definitions have parameters
    if (!this.isGenericTypeDefinition) {
      return 0;
    }

    return this.parseGenericParameterCountFromName();
  }

  /**
   * Get the number of generic type arguments (for constructed generic types).
   * For now, uses Unity API if available, otherwise returns 0.
   * Returns 0 for non-generic types or open generic type definitions.
   */
  @lazy
  get genericArgumentCount(): number {
    // For constructed generic types, try Unity API if available
    if (this.isConstructedGenericType) {
      if (this.api.hasExport("mono_unity_class_get_generic_argument_count")) {
        try {
          const count = this.native.mono_unity_class_get_generic_argument_count(this.pointer);
          return Number(count);
        } catch {
          // Fall through
        }
      }
      // Without Unity API, we can't easily get argument count for constructed types
      // Could try parsing from type name in the future
    }
    return 0;
  }

  /**
   * Get the generic type arguments for a constructed generic type.
   * For example, for `List<string>`, returns `[System.String]`.
   * Returns empty array for non-generic types.
   *
   * Note: This currently requires Unity-specific API for full implementation.
   * Without it, returns an empty array.
   */
  @lazy
  get genericArguments(): MonoClass[] {
    // This requires Unity API to enumerate actual type arguments
    if (!this.api.hasExport("mono_unity_class_get_generic_argument_at")) {
      return [];
    }

    try {
      const count = this.genericArgumentCount;
      const args: MonoClass[] = [];
      for (let i = 0; i < count; i++) {
        const argPtr = this.native.mono_unity_class_get_generic_argument_at(this.pointer, i);
        if (!pointerIsNull(argPtr)) {
          args.push(new MonoClass(this.api, argPtr));
        }
      }
      return args;
    } catch {
      return [];
    }
  }

  /**
   * Get the generic type definition for a constructed generic type.
   * For example, for `List<string>`, returns the open `List<T>`.
   * Returns null for non-generic types.
   *
   * Note: This currently requires Unity-specific API for full implementation.
   */
  @lazy
  get genericTypeDefinition(): MonoClass | null {
    // Only constructed generic types have a type definition
    if (!this.isConstructedGenericType) {
      return null;
    }

    try {
      const defPtr = this.native.mono_unity_class_get_generic_type_definition(this.pointer);
      if (!pointerIsNull(defPtr)) {
        return new MonoClass(this.api, defPtr);
      }
    } catch {
      // Return null
    }

    return null;
  }

  /**
   * Create a constructed generic type from this generic type definition.
   *
   * Uses `mono_reflection_type_from_name` to construct the generic type by building
   * a type name string in CLR format (e.g., `List`1[[System.String, mscorlib]]`).
   *
   * @param typeArguments Array of MonoClass to use as type arguments
   * @returns Constructed generic type, or null if construction failed
   *
   * @example
   * const listType = Mono.domain.class('System.Collections.Generic.List`1');
   * const stringClass = Mono.domain.class('System.String');
   * const stringListType = listType?.makeGenericType([stringClass]);
   * // stringListType is now List<string>
   */
  makeGenericType(typeArguments: MonoClass[]): MonoClass | null {
    if (!this.isGenericTypeDefinition) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Cannot make generic type from ${this.fullName}`,
        "The class must be a generic type definition (e.g., List<T>, not List<int>)",
      );
    }

    const paramCount = this.genericParameterCount;
    if (typeArguments.length !== paramCount) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Type argument count mismatch: ${this.fullName} requires ${paramCount} arguments but ${typeArguments.length} were provided`,
        "Ensure the number of type arguments matches the generic parameter count",
      );
    }

    // Try mono_reflection_type_from_name approach (most reliable)
    if (this.api.hasExport("mono_reflection_type_from_name") && this.api.hasExport("mono_class_from_mono_type")) {
      const result = this.makeGenericTypeViaReflection(typeArguments);
      if (result) {
        return result;
      }
    }

    // Cannot create generic type - log warning
    classLogger.warn(
      `makeGenericType: Cannot create ${this.fullName}<${typeArguments.map(t => t.fullName).join(", ")}>. ` +
        `mono_reflection_type_from_name API is not available or failed.`,
    );
    return null;
  }

  /**
   * Build CLR type name with assembly qualification for generic type arguments.
   * Format: Namespace.TypeName`N[[ArgType1, Assembly1],[ArgType2, Assembly2]]
   */
  private buildGenericTypeName(typeArguments: MonoClass[]): string {
    const baseName = this.fullName;

    // Build type argument strings with assembly qualification
    const argStrings = typeArguments.map(arg => {
      const argFullName = arg.fullName;
      const argImage = arg.image;
      const argAssemblyName = argImage.name;

      // Format: [TypeName, AssemblyName]
      return `[${argFullName}, ${argAssemblyName}]`;
    });

    // Combine: TypeName`N[[Arg1, Asm1],[Arg2, Asm2]]
    return `${baseName}[${argStrings.join(",")}]`;
  }

  /**
   * Create generic type using mono_reflection_type_from_name.
   * This parses a CLR-format type string to create the constructed generic type.
   */
  private makeGenericTypeViaReflection(typeArguments: MonoClass[]): MonoClass | null {
    try {
      const typeName = this.buildGenericTypeName(typeArguments);
      const typeNamePtr = this.api.allocUtf8StringCached(typeName);
      const currentImage = this.image;

      // mono_reflection_type_from_name(name, image) -> MonoType*
      const monoType = this.native.mono_reflection_type_from_name(typeNamePtr, currentImage.pointer);

      if (pointerIsNull(monoType)) {
        // Try with null image (search all assemblies)
        const monoTypeGlobal = this.native.mono_reflection_type_from_name(typeNamePtr, NULL);
        if (pointerIsNull(monoTypeGlobal)) {
          return null;
        }

        // Convert MonoType to MonoClass
        const klassPtr = tryGetClassPtrFromMonoType(this.api, monoTypeGlobal);
        return klassPtr ? new MonoClass(this.api, klassPtr) : null;
      }

      // Convert MonoType to MonoClass
      const klassPtr = tryGetClassPtrFromMonoType(this.api, monoType);
      return klassPtr ? new MonoClass(this.api, klassPtr) : null;
    } catch (e) {
      // Silently fail and return null
      return null;
    }
  }

  // ===== END GENERIC TYPE SUPPORT =====

  // ===== UTILITY METHODS =====

  /**
   * Get a human-readable description of this class
   */
  @lazy
  get description(): string {
    const currentName = this.name;
    const currentNamespace = this.namespace;

    const modifiers = [];
    if (this.isInterface) modifiers.push("interface");
    if (this.isAbstract) modifiers.push("abstract");
    if (this.isSealed) modifiers.push("sealed");
    if (this.isValueType) modifiers.push("struct");
    if (this.isEnum) modifiers.push("enum");
    if (this.isDelegate) modifiers.push("delegate");

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
    const namespaceStr = currentNamespace ? `${currentNamespace}.` : "";

    return `${modifierStr}class ${namespaceStr}${currentName}`;
  }

  /**
   * Get a comprehensive summary of this class.
   * @returns Object with detailed class information
   */
  describe(): MonoClassSummary {
    return {
      name: this.name,
      namespace: this.namespace,
      fullName: this.fullName,
      flags: this.flags,
      flagNames: pickFlags(this.flags, TYPE_DESCRIBED_FLAGS),
      isInterface: this.isInterface,
      isAbstract: this.isAbstract,
      isSealed: this.isSealed,
      isValueType: this.isValueType,
      isEnum: this.isEnum,
      isDelegate: this.isDelegate,
      isGenericType: this.isGenericType,
      isGenericTypeDefinition: this.isGenericTypeDefinition,
      genericArgumentCount: this.genericArgumentCount,
      genericParameterCount: this.genericParameterCount,
      parent: this.parent ? this.parent.fullName : null,
      methodCount: this.methods.length,
      fieldCount: this.fields.length,
      propertyCount: this.properties.length,
      typeToken: this.typeToken,
      type: this.type?.getSummary(),
    };
  }

  /**
   * Validate if an object is an instance of this class
   * @param obj Object to validate (MonoObject or NativePointer)
   * @returns Validation result with errors if any
   */
  validateInstance(obj: MonoObject | NativePointer | null): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!obj) {
      errors.push("Object is null");
      return { isValid: false, errors };
    }

    try {
      let objectClass: MonoClass;

      if (obj instanceof MonoObject) {
        objectClass = obj.class;
      } else {
        // Assume it's a native pointer to an object
        const monoObj = new MonoObject(this.api, obj);
        objectClass = monoObj.class;
      }

      // Check if object is assignable to this class
      if (!this.isAssignableFrom(objectClass)) {
        errors.push(`Object of type ${objectClass.fullName} is not compatible with ${this.fullName}`);
      }
    } catch (error) {
      errors.push(`Failed to validate object: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== ITERATION SUPPORT =====

  /**
   * Iterate over all methods in this class.
   * Makes MonoClass directly iterable with for...of.
   *
   * @example
   * ```typescript
   * for (const method of klass) {
   *   console.log(method.name);
   * }
   * ```
   */
  *[Symbol.iterator](): IterableIterator<MonoMethod> {
    yield* this.methods;
  }

  /**
   * Iterate over methods with their indices.
   */
  *methodEntries(): IterableIterator<[number, MonoMethod]> {
    const methods = this.methods;
    for (let i = 0; i < methods.length; i++) {
      yield [i, methods[i]];
    }
  }

  /**
   * Iterate over fields with their indices.
   */
  *fieldEntries(): IterableIterator<[number, MonoField]> {
    const fields = this.fields;
    for (let i = 0; i < fields.length; i++) {
      yield [i, fields[i]];
    }
  }

  /**
   * Iterate over properties with their indices.
   */
  *propertyEntries(): IterableIterator<[number, MonoProperty]> {
    const properties = this.properties;
    for (let i = 0; i < properties.length; i++) {
      yield [i, properties[i]];
    }
  }

  /**
   * Find all methods matching a predicate.
   * @param predicate Filter function
   * @returns Array of matching methods
   */
  findMethods(predicate: (method: MonoMethod) => boolean): MonoMethod[] {
    return this.methods.filter(predicate);
  }

  /**
   * Find all fields matching a predicate.
   * @param predicate Filter function
   * @returns Array of matching fields
   */
  findFields(predicate: (field: MonoField) => boolean): MonoField[] {
    return this.fields.filter(predicate);
  }

  /**
   * Find all properties matching a predicate.
   * @param predicate Filter function
   * @returns Array of matching properties
   */
  findProperties(predicate: (property: MonoProperty) => boolean): MonoProperty[] {
    return this.properties.filter(predicate);
  }
}

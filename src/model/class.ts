import { allocUtf8, readU32 } from "../runtime/mem";
import { pointerIsNull } from "../utils/pointer-utils";
import { readUtf8String } from "../utils/string-utils";
import { MonoHandle } from "./base";
import { MonoField } from "./field";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { MonoProperty } from "./property";
import { MonoImage } from "./image";
import { MonoType, MonoTypeSummary } from "./type";
import { MonoDomain } from "./domain";
import { TypeAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";

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
  #name: string | null = null;
  #namespace: string | null = null;
  #fullName: string | null = null;
  #flags: number | null = null;
  #parent: MonoClass | null | undefined = undefined;
  #type: MonoType | null = null;
  #methods: MonoMethod[] | null = null;
  #fields: MonoField[] | null = null;
  #properties: MonoProperty[] | null = null;
  #interfaces: MonoClass[] | null = null;
  #nestedTypes: MonoClass[] | null = null;
  #initialized = false;

  /**
   * Get class name
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get class namespace
   */
  get namespace(): string {
    return this.getNamespace();
  }

  /**
   * Get full class name (namespace.name)
   */
  get fullName(): string {
    return this.getFullName();
  }

  /**
   * Get all methods in this class
   */
  get methods(): MonoMethod[] {
    return this.getMethods();
  }

  /**
   * Get all fields in this class
   */
  get fields(): MonoField[] {
    return this.getFields();
  }

  /**
   * Get all properties in this class
   */
  get properties(): MonoProperty[] {
    return this.getProperties();
  }

  /**
   * Get parent class
   */
  get parent(): MonoClass | null {
    return this.getParent();
  }

  /**
   * Get interfaces implemented by this class
   */
  get interfaces(): MonoClass[] {
    return this.getInterfaces();
  }

  /**
   * Get nested types in this class
   */
  get nestedTypes(): MonoClass[] {
    return this.getNestedTypes();
  }

  /**
   * Find a method by name
   * @param name Method name
   * @param paramCount Parameter count (-1 to match any)
   * @returns Method if found, null otherwise
   */
  method(name: string, paramCount = -1): MonoMethod | null {
    return this.tryGetMethod(name, paramCount);
  }

  /**
   * Find a field by name
   * @param name Field name
   * @returns Field if found, null otherwise
   */
  field(name: string): MonoField | null {
    return this.tryGetField(name);
  }

  /**
   * Find a property by name
   * @param name Property name
   * @returns Property if found, null otherwise
   */
  property(name: string): MonoProperty | null {
    return this.tryGetProperty(name);
  }

  /**
   * Allocate a new instance of this class
   * @param initialise Whether to call the default constructor
   * @returns New object instance
   */
  alloc(initialise = true): MonoObject {
    return this.newObject(initialise);
  }

  getName(): string {
    if (this.#name !== null) {
      return this.#name;
    }
    const namePtr = this.native.mono_class_get_name(this.pointer);
    this.#name = readUtf8String(namePtr);
    return this.#name;
  }

  getNamespace(): string {
    if (this.#namespace !== null) {
      return this.#namespace;
    }
    const namespacePtr = this.native.mono_class_get_namespace(this.pointer);
    this.#namespace = readUtf8String(namespacePtr);
    return this.#namespace;
  }

  getFullName(): string {
    if (this.#fullName !== null) {
      return this.#fullName;
    }
    const namespace = this.getNamespace();
    const name = this.getName();
    this.#fullName = namespace ? `${namespace}.${name}` : name;
    return this.#fullName;
  }

  getImage(): MonoImage {
    const imagePtr = this.native.mono_class_get_image(this.pointer);
    return new MonoImage(this.api, imagePtr);
  }

  getParent(): MonoClass | null {
    if (this.#parent !== undefined) {
      return this.#parent;
    }
    const parentPtr = this.native.mono_class_get_parent(this.pointer);
    this.#parent = pointerIsNull(parentPtr) ? null : new MonoClass(this.api, parentPtr);
    return this.#parent;
  }

  getFlags(): number {
    if (this.#flags !== null) {
      return this.#flags;
    }
    this.#flags = this.native.mono_class_get_flags(this.pointer) as number;
    return this.#flags;
  }

  getTypeToken(): number {
    return this.native.mono_class_get_type_token(this.pointer) as number;
  }

  getType(): MonoType {
    if (this.#type) {
      return this.#type;
    }
    const typePtr = this.native.mono_class_get_type(this.pointer);
    this.#type = new MonoType(this.api, typePtr);
    return this.#type;
  }

  ensureInitialized(): void {
    if (this.#initialized) {
      return;
    }
    const result = this.native.mono_class_init(this.pointer);
    if (pointerIsNull(result)) {
      throw new Error(`mono_class_init returned NULL for ${this.getFullName()}`);
    }
    this.#initialized = true;
  }

  getVTable(domain: MonoDomain | NativePointer | null = null): NativePointer {
    const domainPtr = domain instanceof MonoDomain ? domain.pointer : domain ?? this.api.getRootDomain();
    this.ensureInitialized();
    const vtable = this.native.mono_class_vtable(domainPtr, this.pointer);
    if (pointerIsNull(vtable)) {
      throw new Error(`mono_class_vtable returned NULL for ${this.getFullName()}`);
    }
    return vtable;
  }

  isEnum(): boolean {
    return (this.native.mono_class_is_enum(this.pointer) as number) !== 0;
  }

  isValueType(): boolean {
    return (this.native.mono_class_is_valuetype(this.pointer) as number) !== 0;
  }

  isDelegate(): boolean {
    return (this.native.mono_class_is_delegate(this.pointer) as number) !== 0;
  }

  isInterface(): boolean {
    const semantics = getMaskedValue(this.getFlags(), TypeAttribute.ClassSemanticsMask);
    return semantics === TypeAttribute.Interface;
  }

  isAbstract(): boolean {
    return hasFlag(this.getFlags(), TypeAttribute.Abstract);
  }

  isSealed(): boolean {
    return hasFlag(this.getFlags(), TypeAttribute.Sealed);
  }

  isBeforeFieldInit(): boolean {
    return hasFlag(this.getFlags(), TypeAttribute.BeforeFieldInit);
  }

  isSubclassOf(target: MonoClass, checkInterfaces = false): boolean {
    return (this.native.mono_class_is_subclass_of(this.pointer, target.pointer, checkInterfaces ? 1 : 0) as number) !== 0;
  }

  isAssignableFrom(other: MonoClass): boolean {
    return (this.native.mono_class_is_assignable_from(this.pointer, other.pointer) as number) !== 0;
  }

  implementsInterface(iface: MonoClass): boolean {
    return (this.native.mono_class_implements_interface(this.pointer, iface.pointer) as number) !== 0;
  }

  getMethod(name: string, paramCount = -1): MonoMethod {
    const method = this.tryGetMethod(name, paramCount);
    if (!method) {
      throw new Error(`Method ${name}(${paramCount}) not found on class ${this.getFullName()}.`);
    }
    return method;
  }

  tryGetMethod(name: string, paramCount = -1): MonoMethod | null {
    const namePtr = allocUtf8(name);
    const methodPtr = this.native.mono_class_get_method_from_name(this.pointer, namePtr, paramCount);
    return pointerIsNull(methodPtr) ? null : new MonoMethod(this.api, methodPtr);
  }

  getMethods(refreshCache = false): MonoMethod[] {
    if (!refreshCache && this.#methods) {
      return this.#methods.slice();
    }
    const methods = enumerateHandles(
      (iter) => this.native.mono_class_get_methods(this.pointer, iter),
      (ptr) => new MonoMethod(this.api, ptr),
    );
    this.#methods = methods;
    return methods.slice();
  }

  getField(name: string): MonoField {
    const field = this.tryGetField(name);
    if (!field) {
      throw new Error(`Field ${name} not found on class ${this.getFullName()}.`);
    }
    return field;
  }

  tryGetField(name: string): MonoField | null {
    const namePtr = allocUtf8(name);
    const fieldPtr = this.native.mono_class_get_field_from_name(this.pointer, namePtr);
    return pointerIsNull(fieldPtr) ? null : new MonoField(this.api, fieldPtr);
  }

  getFields(refreshCache = false): MonoField[] {
    if (!refreshCache && this.#fields) {
      return this.#fields.slice();
    }
    const fields = enumerateHandles(
      (iter) => this.native.mono_class_get_fields(this.pointer, iter),
      (ptr) => new MonoField(this.api, ptr),
    );
    this.#fields = fields;
    return fields.slice();
  }

  getProperty(name: string): MonoProperty {
    const property = this.tryGetProperty(name);
    if (!property) {
      throw new Error(`Property ${name} not found on class ${this.getFullName()}.`);
    }
    return property;
  }

  tryGetProperty(name: string): MonoProperty | null {
    const namePtr = allocUtf8(name);
    const propertyPtr = this.native.mono_class_get_property_from_name(this.pointer, namePtr);
    return pointerIsNull(propertyPtr) ? null : new MonoProperty(this.api, propertyPtr);
  }

  getProperties(refreshCache = false): MonoProperty[] {
    if (!refreshCache && this.#properties) {
      return this.#properties.slice();
    }
    const properties = enumerateHandles(
      (iter) => this.native.mono_class_get_properties(this.pointer, iter),
      (ptr) => new MonoProperty(this.api, ptr),
    );
    this.#properties = properties;
    return properties.slice();
  }

  getInterfaces(refreshCache = false): MonoClass[] {
    if (!refreshCache && this.#interfaces) {
      return this.#interfaces.slice();
    }
    const interfaces = enumerateHandles(
      (iter) => this.native.mono_class_get_interfaces(this.pointer, iter),
      (ptr) => new MonoClass(this.api, ptr),
    );
    this.#interfaces = interfaces;
    return interfaces.slice();
  }

  getNestedTypes(refreshCache = false): MonoClass[] {
    if (!refreshCache && this.#nestedTypes) {
      return this.#nestedTypes.slice();
    }
    const nested = enumerateHandles(
      (iter) => this.native.mono_class_get_nested_types(this.pointer, iter),
      (ptr) => new MonoClass(this.api, ptr),
    );
    this.#nestedTypes = nested;
    return nested.slice();
  }

  getInstanceSize(): number {
    return this.native.mono_class_instance_size(this.pointer) as number;
  }

  getValueSize(): { size: number; alignment: number } {
    const alignmentPtr = Memory.alloc(4);
    const size = this.native.mono_class_value_size(this.pointer, alignmentPtr) as number;
    const alignment = readU32(alignmentPtr);
    return { size, alignment };
  }

  describe(): MonoClassSummary {
    const flags = this.getFlags();
    const parent = this.getParent();
    return {
      name: this.getName(),
      namespace: this.getNamespace(),
      fullName: this.getFullName(),
      flags,
      flagNames: pickFlags(flags, TYPE_DESCRIBED_FLAGS),
      isInterface: this.isInterface(),
      isAbstract: this.isAbstract(),
      isSealed: this.isSealed(),
      isValueType: this.isValueType(),
      isEnum: this.isEnum(),
      isDelegate: this.isDelegate(),
      parent: parent ? parent.getFullName() : null,
      methodCount: this.getMethods().length,
      fieldCount: this.getFields().length,
      propertyCount: this.getProperties().length,
      typeToken: this.getTypeToken(),
      type: this.getType().describe(),
    };
  }

  newObject(initialise = true): MonoObject {
    this.ensureInitialized();
    const domain = this.api.getRootDomain();
    const objectPtr = this.native.mono_object_new(domain, this.pointer);
    if (initialise) {
      this.native.mono_runtime_object_init(objectPtr);
    }
    return new MonoObject(this.api, objectPtr);
  }

  // ===== CONSISTENT API PATTERNS =====

  /**
   * Get a human-readable description of this class
   */
  getDescription(): string {
    const name = this.getName();
    const namespace = this.getNamespace();
    const fullName = this.getFullName();

    const modifiers = [];
    if (this.isInterface()) modifiers.push('interface');
    if (this.isAbstract()) modifiers.push('abstract');
    if (this.isSealed()) modifiers.push('sealed');
    if (this.isValueType()) modifiers.push('struct');
    if (this.isEnum()) modifiers.push('enum');
    if (this.isDelegate()) modifiers.push('delegate');

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(' ')} ` : '';
    const namespaceStr = namespace ? `${namespace}.` : '';

    return `${modifierStr}class ${namespaceStr}${name}`;
  }

  /**
   * Validate if an object is an instance of this class
   */
  validateInstance(obj: MonoObject | NativePointer | null): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!obj) {
      errors.push('Object is null');
      return { isValid: false, errors };
    }

    try {
      let objectClass: MonoClass;

      if (obj instanceof MonoObject) {
        objectClass = obj.getClass();
      } else {
        // Assume it's a native pointer to an object
        const monoObj = new MonoObject(this.api, obj);
        objectClass = monoObj.getClass();
      }

      // Check if object is assignable to this class
      if (!this.isAssignableFrom(objectClass)) {
        errors.push(`Object of type ${objectClass.getFullName()} is not compatible with ${this.getFullName()}`);
      }

    } catch (error) {
      errors.push(`Failed to validate object: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

function enumerateHandles<T>(fetch: (iter: NativePointer) => NativePointer, factory: (ptr: NativePointer) => T): T[] {
  const iterator = Memory.alloc(Process.pointerSize);
  iterator.writePointer(NULL);
  const results: T[] = [];
  while (true) {
    const handle = fetch(iterator);
    if (pointerIsNull(handle)) {
      break;
    }
    results.push(factory(handle));
  }
  return results;
}

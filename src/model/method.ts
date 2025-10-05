import { MonoApi, MonoManagedExceptionError } from "../runtime/api";
import { allocUtf8, pointerIsNull, readUtf8String, readU32 } from "../runtime/mem";
import { MonoHandle, MethodArgument } from "./base";
import { MonoImage } from "./image";
import { MonoObject } from "./object";
import { MonoClass } from "./class";
import { MonoMethodSignature, MonoParameterInfo } from "./method-signature";
import { MonoType, MonoTypeKind, MonoTypeSummary } from "./type";
import { MethodAttribute, MethodImplAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";

export interface InvokeOptions {
  throwOnManagedException?: boolean;
  autoBoxPrimitives?: boolean;
}

export type MethodAccessibility =
  | "private-scope"
  | "private"
  | "protected-and-internal"
  | "internal"
  | "protected"
  | "protected-internal"
  | "public";

export interface MonoMethodSummary {
  name: string;
  fullName: string;
  declaringType: string;
  attributes: number;
  attributeNames: string[];
  implementationAttributes: number;
  implementationAttributeNames: string[];
  accessibility: MethodAccessibility;
  isStatic: boolean;
  isVirtual: boolean;
  isAbstract: boolean;
  isConstructor: boolean;
  callConvention: number;
  parameterCount: number;
  parameters: Array<{ index: number; isOut: boolean; type: MonoTypeSummary }>;
  returnType: MonoTypeSummary;
  token: number;
}

const METHOD_ACCESS_NAMES: Record<number, MethodAccessibility> = {
  [MethodAttribute.PrivateScope]: "private-scope",
  [MethodAttribute.Private]: "private",
  [MethodAttribute.FamANDAssem]: "protected-and-internal",
  [MethodAttribute.Assembly]: "internal",
  [MethodAttribute.Family]: "protected",
  [MethodAttribute.FamORAssem]: "protected-internal",
  [MethodAttribute.Public]: "public",
};

const METHOD_DESCRIBED_FLAGS: Record<string, number> = {
  Static: MethodAttribute.Static,
  Final: MethodAttribute.Final,
  Virtual: MethodAttribute.Virtual,
  Abstract: MethodAttribute.Abstract,
  HideBySig: MethodAttribute.HideBySig,
  SpecialName: MethodAttribute.SpecialName,
  RTSpecialName: MethodAttribute.RTSpecialName,
  PInvokeImpl: MethodAttribute.PInvokeImpl,
  UnmanagedExport: MethodAttribute.UnmanagedExport,
  HasSecurity: MethodAttribute.HasSecurity,
  RequireSecObject: MethodAttribute.RequireSecObject,
};

const METHOD_IMPL_FLAGS: Record<string, number> = {
  IL: MethodImplAttribute.IL,
  Native: MethodImplAttribute.Native,
  OPTIL: MethodImplAttribute.OPTIL,
  Runtime: MethodImplAttribute.Runtime,
  Managed: MethodImplAttribute.Managed,
  Unmanaged: MethodImplAttribute.Unmanaged,
  NoInlining: MethodImplAttribute.NoInlining,
  ForwardRef: MethodImplAttribute.ForwardRef,
  Synchronized: MethodImplAttribute.Synchronized,
  NoOptimization: MethodImplAttribute.NoOptimization,
  PreserveSig: MethodImplAttribute.PreserveSig,
  AggressiveInlining: MethodImplAttribute.AggressiveInlining,
  AggressiveOptimization: MethodImplAttribute.AggressiveOptimization,
  InternalCall: MethodImplAttribute.InternalCall,
};

export class MonoMethod extends MonoHandle {
  #name: string | null = null;
  #signature: MonoMethodSignature | null = null;
  #declaringClass: MonoClass | null = null;
  #flagCache: { flags: number; implementationFlags: number } | null = null;

  static find(api: MonoApi, image: MonoImage, descriptor: string): MonoMethod {
    const descPtr = allocUtf8(descriptor);
    const methodDesc = api.native.mono_method_desc_new(descPtr, 1);
    if (pointerIsNull(methodDesc)) {
      throw new Error(`mono_method_desc_new failed for descriptor ${descriptor}`);
    }
    try {
      const methodPtr = api.native.mono_method_desc_search_in_image(methodDesc, image.pointer);
      if (pointerIsNull(methodPtr)) {
        throw new Error(`Method ${descriptor} not found in image.`);
      }
      return new MonoMethod(api, methodPtr);
    } finally {
      api.native.mono_method_desc_free(methodDesc);
    }
  }

  getName(): string {
    if (this.#name !== null) {
      return this.#name;
    }
    const namePtr = this.native.mono_method_get_name(this.pointer);
    this.#name = readUtf8String(namePtr);
    return this.#name;
  }

  getSignature(): MonoMethodSignature {
    if (this.#signature) {
      return this.#signature;
    }
    const signaturePtr = this.native.mono_method_signature(this.pointer);
    this.#signature = new MonoMethodSignature(this.api, signaturePtr);
    return this.#signature;
  }

  getParameterCount(): number {
    return this.getSignature().getParameterCount();
  }

  getParamCount(): number {
    return this.getParameterCount();
  }

  getParameterTypes(): MonoType[] {
    return this.getSignature().getParameterTypes();
  }

  getParameters(): MonoParameterInfo[] {
    return this.getSignature().getParameters();
  }

  getReturnType(): MonoType {
    return this.getSignature().getReturnType();
  }

  getCallConvention(): number {
    return this.getSignature().getCallConvention();
  }

  isInstanceMethod(): boolean {
    return this.getSignature().isInstanceMethod();
  }

  isStatic(): boolean {
    return hasFlag(this.getFlagValues().flags, MethodAttribute.Static);
  }

  isVirtual(): boolean {
    return hasFlag(this.getFlagValues().flags, MethodAttribute.Virtual);
  }

  isAbstract(): boolean {
    return hasFlag(this.getFlagValues().flags, MethodAttribute.Abstract);
  }

  isConstructor(): boolean {
    const flags = this.getFlagValues().flags;
    return hasFlag(flags, MethodAttribute.RTSpecialName) && this.getName() === ".ctor";
  }

  getDeclaringClass(): MonoClass {
    if (this.#declaringClass) {
      return this.#declaringClass;
    }
    const klassPtr = this.native.mono_method_get_class(this.pointer);
    this.#declaringClass = new MonoClass(this.api, klassPtr);
    return this.#declaringClass;
  }

  getToken(): number {
    return this.native.mono_method_get_token(this.pointer) as number;
  }

  getFlags(): { flags: number; implementationFlags: number } {
    return { ...this.getFlagValues() };
  }

  getAccessibility(): MethodAccessibility {
    const mask = getMaskedValue(this.getFlagValues().flags, MethodAttribute.MemberAccessMask);
    return METHOD_ACCESS_NAMES[mask] ?? "private";
  }

  getAttributeNames(): string[] {
    return pickFlags(this.getFlagValues().flags, METHOD_DESCRIBED_FLAGS);
  }

  getImplementationAttributeNames(): string[] {
    return pickFlags(this.getFlagValues().implementationFlags, METHOD_IMPL_FLAGS);
  }

  getFullName(includeSignature = true): string {
    const namePtr = this.native.mono_method_full_name(this.pointer, includeSignature ? 1 : 0);
    if (pointerIsNull(namePtr)) {
      return this.getName();
    }
    try {
      return readUtf8String(namePtr);
    } finally {
      this.native.mono_free(namePtr);
    }
  }

  describe(): MonoMethodSummary {
    const flagValues = this.getFlagValues();
    const parameters = this.getParameters().map((param) => ({
      index: param.index,
      isOut: param.isOut,
      type: param.type.describe(),
    }));
    const returnType = this.getReturnType().describe();
    return {
      name: this.getName(),
      fullName: this.getFullName(),
      declaringType: this.getDeclaringClass().getFullName(),
      attributes: flagValues.flags,
      attributeNames: this.getAttributeNames(),
      implementationAttributes: flagValues.implementationFlags,
      implementationAttributeNames: this.getImplementationAttributeNames(),
      accessibility: this.getAccessibility(),
      isStatic: this.isStatic(),
      isVirtual: this.isVirtual(),
      isAbstract: this.isAbstract(),
      isConstructor: this.isConstructor(),
      callConvention: this.getCallConvention(),
      parameterCount: parameters.length,
      parameters,
      returnType,
      token: this.getToken(),
    };
  }

  invoke(instance: MonoObject | NativePointer | null, args: MethodArgument[] = [], options: InvokeOptions = {}): NativePointer {
    const autoBox = options.autoBoxPrimitives !== false;
    const prepared = autoBox ? this.prepareArguments(args) : args.map((arg) => prepareArgumentRaw(this.api, arg));
    try {
      const result = this.api.runtimeInvoke(this.pointer, unwrapInstance(instance), prepared);
      return result;
    } catch (error) {
      if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
        return NULL;
      }
      throw error;
    }
  }

  private prepareArguments(args: MethodArgument[]): NativePointer[] {
    const signature = this.getSignature();
    const types = signature.getParameterTypes();
    const prepared: NativePointer[] = [];
    for (let index = 0; index < types.length; index += 1) {
      const type = types[index];
      const value = index < args.length ? args[index] : undefined;
      prepared.push(this.prepareArgumentForType(type, value, index));
    }
    return prepared;
  }

  private prepareArgumentForType(type: MonoType, value: MethodArgument | undefined, index: number): NativePointer {
    if (value === null || value === undefined) {
      return NULL;
    }
    if (value instanceof MonoObject) {
      return value.pointer;
    }
    if (typeof value === "string") {
      return this.api.stringNew(value);
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      if (type.isByRef() || this.isPointerLike(type)) {
        throw new Error(`Parameter ${index} on ${this.getFullName()} expects a pointer or reference; received primitive value.`);
      }
      return this.boxPrimitive(type, value);
    }
    return value as NativePointer;
  }

  private boxPrimitive(type: MonoType, value: number | boolean | bigint): NativePointer {
    const effectiveType = this.resolveUnderlyingPrimitive(type);
    const kind = effectiveType.getKind();
    const { size } = effectiveType.getValueSize();
    const storageSize = Math.max(size, Process.pointerSize);
    const storage = Memory.alloc(storageSize);

    switch (kind) {
      case MonoTypeKind.Boolean:
        Memory.writeU8(storage, value ? 1 : 0);
        break;
      case MonoTypeKind.I1:
        Memory.writeS8(storage, Number(value));
        break;
      case MonoTypeKind.U1:
        Memory.writeU8(storage, Number(value));
        break;
      case MonoTypeKind.I2:
        Memory.writeS16(storage, Number(value));
        break;
      case MonoTypeKind.U2:
        Memory.writeU16(storage, Number(value));
        break;
      case MonoTypeKind.Char:
        Memory.writeU16(storage, typeof value === "number" ? value : Number(value));
        break;
      case MonoTypeKind.I4:
        Memory.writeS32(storage, Number(value));
        break;
      case MonoTypeKind.U4:
        Memory.writeU32(storage, Number(value));
        break;
      case MonoTypeKind.R4:
        Memory.writeFloat(storage, Number(value));
        break;
      case MonoTypeKind.R8:
        Memory.writeDouble(storage, Number(value));
        break;
      case MonoTypeKind.I8:
        // Support 64-bit signed integers using Frida's Int64
        if (typeof value === "bigint") {
          Memory.writeS64(storage, int64(value.toString()));
        } else if (typeof value === "number") {
          Memory.writeS64(storage, int64(value.toString()));
        } else {
          // Assume it's already an Int64 or compatible type
          Memory.writeS64(storage, value as any);
        }
        break;
      case MonoTypeKind.U8:
        // Support 64-bit unsigned integers using Frida's UInt64
        if (typeof value === "bigint") {
          Memory.writeU64(storage, uint64(value.toString()));
        } else if (typeof value === "number") {
          Memory.writeU64(storage, uint64(value.toString()));
        } else {
          // Assume it's already a UInt64 or compatible type
          Memory.writeU64(storage, value as any);
        }
        break;
      default:
        throw new Error(`Auto-boxing is not supported for parameter type ${effectiveType.getFullName()} on ${this.getFullName()}`);
    }

    const klass = effectiveType.getClass();
    if (!klass) {
      throw new Error(`Unable to resolve class for parameter type ${effectiveType.getFullName()} on ${this.getFullName()}`);
    }
    klass.ensureInitialized();
    const domain = this.api.getRootDomain();
    return this.api.native.mono_value_box(domain, klass.pointer, storage);
  }

  private resolveUnderlyingPrimitive(type: MonoType): MonoType {
    if (type.getKind() === MonoTypeKind.Enum) {
      const underlying = type.getUnderlyingType();
      if (underlying) {
        return underlying;
      }
    }
    return type;
  }

  private isPointerLike(type: MonoType): boolean {
    const kind = type.getKind();
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

  private getFlagValues(): { flags: number; implementationFlags: number } {
    if (this.#flagCache) {
      return this.#flagCache;
    }
    const implPtr = Memory.alloc(4);
    const flags = this.native.mono_method_get_flags(this.pointer, implPtr) as number;
    const implementationFlags = readU32(implPtr);
    const result = { flags, implementationFlags };
    this.#flagCache = result;
    return result;
  }

  // ===== CONSISTENT API PATTERNS =====

  /**
   * Get method name (property accessor)
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get declaring class (property accessor)
   */
  get declaringClass(): MonoClass {
    return this.getDeclaringClass();
  }

  /**
   * Get a human-readable description of this method
   */
  getDescription(): string {
    const returnType = this.getReturnType().getName();
    const methodName = this.getName();
    const parameters = this.getParameters()
      .map(param => `${param.type.getName()} param${param.index}`)
      .join(', ');

    const modifiers = [];
    if (this.isStatic()) modifiers.push('static');
    if (this.isVirtual()) modifiers.push('virtual');
    if (this.isAbstract()) modifiers.push('abstract');
    if (this.isConstructor()) modifiers.push('constructor');

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(' ')} ` : '';
    return `${modifierStr}${returnType} ${methodName}(${parameters})`;
  }

  /**
   * Validate method arguments before invocation
   */
  validateArguments(args: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const expectedCount = this.getParameterCount();
    const actualCount = args.length;

    if (expectedCount !== actualCount) {
      errors.push(`Expected ${expectedCount} arguments, got ${actualCount}`);
    }

    const paramTypes = this.getParameterTypes();
    const parameters = this.getParameters();

    for (let i = 0; i < Math.min(actualCount, paramTypes.length); i++) {
      const expectedType = paramTypes[i];
      const paramInfo = parameters[i];
      const actualValue = args[i];

      // Basic null/undefined validation
      if (actualValue === null || actualValue === undefined) {
        if (expectedType.isValueType()) {
          errors.push(`Argument ${i} cannot be null for value type ${expectedType.getName()}`);
        }
        continue;
      }

      // Type validation for value types
      if (expectedType.isValueType()) {
        const valueType = typeof actualValue;
        // For now, skip enum and primitive checks since those methods may not exist
        // TODO: Add proper enum and primitive type checking when methods are available
        if (!this.isCompatiblePrimitiveType(valueType, expectedType)) {
          errors.push(`Argument ${i} type mismatch: expected ${expectedType.getName()}, got ${valueType}`);
        }
      }

      // Reference type validation
      if (!expectedType.isValueType() && actualValue instanceof MonoObject) {
        const actualClass = actualValue.getClass();
        if (!this.isTypeCompatible(expectedType, actualClass)) {
          errors.push(`Argument ${i} type mismatch: expected ${expectedType.getName()}, got ${actualClass.getFullName()}`);
        }
      }

      // Out parameter validation
      if (paramInfo && paramInfo.isOut) {
        if (actualValue !== null && actualValue !== undefined) {
          errors.push(`Argument ${i} is an out parameter and should be null or undefined`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate method accessibility in current context
   */
  validateAccessibility(context?: { isStatic?: boolean; instanceType?: MonoClass }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if method is static but being called on instance
    if (this.isStatic() && context?.isStatic === false) {
      errors.push(`Static method ${this.getName()} cannot be called on instance`);
    }

    // Check if instance method is being called without instance
    if (!this.isStatic() && context?.isStatic !== false && !context?.instanceType) {
      errors.push(`Instance method ${this.getName()} requires an object instance`);
    }

    // Check if method is abstract
    if (this.isAbstract()) {
      errors.push(`Abstract method ${this.getName()} cannot be called directly`);
    }

    // Check instance type compatibility
    if (!this.isStatic() && context?.instanceType) {
      const declaringClass = this.getDeclaringClass();
      if (!declaringClass.isAssignableFrom(context.instanceType)) {
        errors.push(`Method ${this.getName()} cannot be called on instance of type ${context.instanceType.getFullName()}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate method metadata integrity
   */
  validateMetadata(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if method has a valid name
      if (!this.getName() || this.getName().trim() === '') {
        errors.push('Method has invalid name');
      }

      // Check if declaring class is accessible
      const declaringClass = this.getDeclaringClass();
      if (!declaringClass) {
        errors.push('Unable to determine declaring class');
      }

      // Check signature validity
      const signature = this.getSignature();
      if (!signature) {
        errors.push('Unable to get method signature');
      }

      // Check return type
      const returnType = this.getReturnType();
      if (!returnType) {
        errors.push('Unable to determine return type');
      }

      // Warnings for unusual patterns
      if (this.isStatic() && this.isVirtual()) {
        warnings.push('Method is both static and virtual (unusual pattern)');
      }

      if (this.isAbstract() && this.isStatic()) {
        warnings.push('Method is both abstract and static (unusual pattern)');
      }

      // Check parameter count consistency
      const paramCount = this.getParameterCount();
      const paramTypes = this.getParameterTypes();
      if (paramCount !== paramTypes.length) {
        errors.push(`Parameter count mismatch: getParameterCount()=${paramCount}, getParameterTypes().length=${paramTypes.length}`);
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

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Check if a JavaScript type is compatible with a Mono primitive type
   */
  private isCompatiblePrimitiveType(jsType: string, monoType: MonoType): boolean {
    const typeName = monoType.getName().toLowerCase();

    switch (jsType) {
      case 'number':
        return ['int32', 'int64', 'uint32', 'uint64', 'single', 'double', 'float'].some(t => typeName.includes(t));
      case 'boolean':
        return typeName.includes('bool');
      case 'string':
        return typeName.includes('string') || typeName.includes('char');
      default:
        return false;
    }
  }

  /**
   * Check if two Mono types are compatible
   */
  private isTypeCompatible(expectedType: MonoType, actualType: MonoClass): boolean {
    const expectedClass = expectedType.getClass();
    if (!expectedClass) return false;
    return expectedClass.isAssignableFrom(actualType);
  }
}

function prepareArgumentRaw(api: MonoApi, arg: MethodArgument): NativePointer {
  if (arg === null || arg === undefined) {
    return NULL;
  }
  if (arg instanceof MonoObject) {
    return arg.pointer;
  }
  if (typeof arg === "string") {
    return api.stringNew(arg);
  }
  if (typeof arg === "number" || typeof arg === "boolean") {
    throw new Error("Primitive arguments need manual boxing before invocation");
  }
  return arg as NativePointer;
}

function unwrapInstance(instance: MonoObject | NativePointer | null): NativePointer {
  if (instance === null || instance === undefined) {
    return NULL;
  }
  if (instance instanceof MonoObject) {
    return instance.pointer;
  }
  return instance as NativePointer;
}


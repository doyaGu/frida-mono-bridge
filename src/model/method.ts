import { MonoApi, MonoManagedExceptionError } from "../runtime/api";
import { allocUtf8, readU32 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle, MethodArgument, MemberAccessibility } from "./base";
import { MonoImage } from "./image";
import { MonoObject } from "./object";
import { MonoClass } from "./class";
import { MonoMethodSignature, MonoParameterInfo } from "./method-signature";
import { MonoType, MonoTypeKind, MonoTypeSummary } from "./type";
import { MethodAttribute, MethodImplAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";
import { unwrapInstance } from "../utils/memory";
import { Logger } from "../utils/log";

export interface InvokeOptions {
  throwOnManagedException?: boolean;
  autoBoxPrimitives?: boolean;
  /** Return Int64/UInt64 as bigint instead of number (prevents precision loss) */
  returnBigInt?: boolean;
}

/**
 * Invoke result with automatic unboxing support
 */
export interface InvokeResult<T = any> {
  /** Raw pointer result from mono_runtime_invoke */
  raw: NativePointer;
  /** Whether the result is null */
  isNull: boolean;
  /** Unboxed value (for value types) or wrapped object (for reference types) */
  value: T;
  /** Type of the return value */
  type: MonoType;
}

/**
 * Type mapping from Mono types to TypeScript types
 */
export type UnboxedType<Kind extends MonoTypeKind> = 
  Kind extends typeof MonoTypeKind.Boolean ? boolean :
  Kind extends typeof MonoTypeKind.Char ? number :
  Kind extends typeof MonoTypeKind.I1 | typeof MonoTypeKind.U1 | 
            typeof MonoTypeKind.I2 | typeof MonoTypeKind.U2 |
            typeof MonoTypeKind.I4 | typeof MonoTypeKind.U4 |
            typeof MonoTypeKind.R4 | typeof MonoTypeKind.R8 ? number :
  Kind extends typeof MonoTypeKind.I8 | typeof MonoTypeKind.U8 ? bigint :
  Kind extends typeof MonoTypeKind.String ? string :
  Kind extends typeof MonoTypeKind.Void ? void :
  any;

export type MethodAccessibility = MemberAccessibility;

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
  isGenericMethod: boolean;
  genericArgumentCount: number;
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
      this.api.tryFree(namePtr);
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
      isGenericMethod: this.isGenericMethod(),
      genericArgumentCount: this.getGenericArgumentCount(),
      callConvention: this.getCallConvention(),
      parameterCount: parameters.length,
      parameters,
      returnType,
      token: this.getToken(),
    };
  }

  // ===== GENERIC METHOD SUPPORT =====

  /**
   * Check if this method is a generic method (has generic type parameters).
   * For example, `void Swap<T>(ref T a, ref T b)` is a generic method.
   * 
   * This uses the Unity API if available, otherwise falls back to checking
   * the method name for the generic arity marker (backtick notation).
   */
  isGenericMethod(): boolean {
    // Try Unity API first
    if (this.api.hasExport('mono_unity_method_is_generic')) {
      try {
        const result = this.native.mono_unity_method_is_generic(this.pointer);
        return Number(result) !== 0;
      } catch {
        // Fall through to name-based detection
      }
    }

    // Fall back to checking method full name for generic markers
    // Generic methods in mono are marked with backtick notation in their full name
    const fullName = this.getFullName(true);
    // Generic methods will have <T> or similar in their signature
    return fullName.includes('<') && fullName.includes('>');
  }

  /**
   * Check if this is a generic method definition (open generic method).
   * A generic method definition has unbound type parameters.
   */
  isGenericMethodDefinition(): boolean {
    // If it's a generic method, we need to check if it's the definition
    // or an instantiated version
    if (!this.isGenericMethod()) {
      return false;
    }

    // For now, assume all generic methods we find are definitions
    // Full implementation would need mono_method_is_generic_sharable_full
    // or mono_method_is_inflated checks
    const fullName = this.getFullName(true);
    // Generic method definitions typically have unbound parameters like <T, U>
    // while instantiated methods have concrete types like <System.String>
    const hasUnboundParams = /\[[A-Z][a-zA-Z0-9_,\s]*\]/.test(fullName) ||
                             /<[A-Z][a-zA-Z0-9_,\s]*>/.test(fullName);
    return hasUnboundParams;
  }

  /**
   * Get the number of generic type parameters for this method.
   * Returns 0 for non-generic methods.
   */
  getGenericArgumentCount(): number {
    // Try Unity API first
    if (this.api.hasExport('mono_unity_method_get_generic_argument_count')) {
      try {
        const count = this.native.mono_unity_method_get_generic_argument_count(this.pointer);
        return Number(count);
      } catch {
        // Fall through to name parsing
      }
    }

    // Fall back to parsing from method name
    // Generic methods are marked like MethodName`2 or in full name <T, U>
    const fullName = this.getFullName(true);
    
    // Count type parameters in angle brackets
    const match = fullName.match(/<([^>]+)>/);
    if (match) {
      const params = match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      return params.length;
    }

    // Check for backtick notation in method name
    const nameMatch = this.getName().match(/`(\d+)/);
    if (nameMatch) {
      return parseInt(nameMatch[1], 10);
    }

    return 0;
  }

  /**
   * Get the generic type arguments for this method.
   * For a generic method definition, returns the type parameter classes.
   * For an instantiated generic method, returns the actual type arguments.
   * 
   * Note: This requires Unity API for full implementation.
   * Without it, returns an empty array.
   */
  getGenericArguments(): MonoClass[] {
    // This requires Unity API
    if (!this.api.hasExport('mono_unity_method_get_generic_argument_at')) {
      return [];
    }

    try {
      const count = this.getGenericArgumentCount();
      const args: MonoClass[] = [];
      for (let i = 0; i < count; i++) {
        const argPtr = this.native.mono_unity_method_get_generic_argument_at(this.pointer, i);
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
   * Create an instantiated generic method from this generic method definition.
   * 
   * Note: This method requires mono_class_inflate_generic_method and 
   * MonoGenericContext infrastructure which is complex to implement.
   * Currently returns null - full implementation deferred.
   * 
   * @param typeArguments Array of MonoClass to use as type arguments
   * @returns Instantiated generic method, or null if instantiation failed
   * 
   * @example
   * // Get a generic method like T Max<T>(T a, T b)
   * const maxMethod = mathClass.method('Max`1');
   * // Create Max<int>
   * const maxInt = maxMethod?.makeGenericMethod([intClass]);
   */
  makeGenericMethod(typeArguments: MonoClass[]): MonoMethod | null {
    // This requires mono_class_inflate_generic_method with a properly constructed
    // MonoGenericContext. The context needs:
    // - class_inst: for class type arguments (null for methods)
    // - method_inst: for method type arguments
    
    // Creating MonoGenericInst is complex and requires internal mono structures
    // that aren't easily accessible from Frida
    
    // For now, return null indicating not implemented
    // Full implementation would need:
    // 1. Create MonoGenericInst from typeArguments
    // 2. Create MonoGenericContext with method_inst set
    // 3. Call mono_class_inflate_generic_method(this.pointer, context)
    
    if (!this.isGenericMethodDefinition()) {
      return null;
    }

    const expectedCount = this.getGenericArgumentCount();
    if (typeArguments.length !== expectedCount) {
      throw new Error(
        `Generic method ${this.getName()} expects ${expectedCount} type arguments, ` +
        `but ${typeArguments.length} were provided`
      );
    }

    // Try to use mono_class_inflate_generic_method if we can construct the context
    if (!this.api.hasExport('mono_class_inflate_generic_method')) {
      return null;
    }

    // Without access to MonoGenericContext creation APIs, we cannot proceed
    // This would require either:
    // - Unity-specific APIs for method instantiation
    // - Low-level access to mono metadata structures
    return null;
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

  /**
   * Call method with automatic unboxing of return value.
   * This is the preferred way to invoke methods as it handles boxing/unboxing automatically.
   * 
   * @param instance The object instance (null for static methods)
   * @param args Method arguments (automatically boxed if needed)
   * @returns Unboxed return value with proper TypeScript type
   * 
   * @example
   * // Calling an instance method that returns int
   * const count = method.call<number>(obj, []);
   * 
   * // Calling a static method that returns string
   * const name = method.call<string>(null, ["arg1", 42]);
   * 
   * // Calling a method that returns a struct/object
   * const result = method.call<MonoObject>(obj, []);
   * 
   * // Calling a method that returns Int64 with BigInt option
   * const bigValue = method.call<bigint>(null, [], { returnBigInt: true });
   */
  call<T = any>(instance: MonoObject | NativePointer | null, args: MethodArgument[] = [], options: InvokeOptions = {}): T {
    const rawResult = this.invoke(instance, args, options);
    return this.unboxResult<T>(rawResult, options);
  }

  /**
   * Call method and get full result information including raw pointer and type.
   * Useful when you need access to both the raw result and the unboxed value.
   * 
   * @param instance The object instance (null for static methods)
   * @param args Method arguments
   * @returns InvokeResult with raw pointer, unboxed value, and type information
   */
  callWithInfo<T = any>(instance: MonoObject | NativePointer | null, args: MethodArgument[] = [], options: InvokeOptions = {}): InvokeResult<T> {
    const rawResult = this.invoke(instance, args, options);
    const returnType = this.getReturnType();
    const isNull = pointerIsNull(rawResult);
    
    return {
      raw: rawResult,
      isNull,
      value: isNull ? (null as unknown as T) : this.unboxResult<T>(rawResult, options),
      type: returnType,
    };
  }

  /**
   * Unbox the raw result pointer based on the return type.
   * Handles value types, strings, and reference types automatically.
   * @param options Include returnBigInt to preserve Int64/UInt64 precision
   */
  private unboxResult<T>(rawResult: NativePointer, options: InvokeOptions = {}): T {
    if (pointerIsNull(rawResult)) {
      return null as unknown as T;
    }

    const returnType = this.getReturnType();
    const kind = returnType.getKind();

    // Handle void
    if (kind === MonoTypeKind.Void) {
      return undefined as unknown as T;
    }

    // Handle string specially
    if (kind === MonoTypeKind.String) {
      return this.readMonoString(rawResult) as unknown as T;
    }

    // Handle value types (need to unbox)
    if (returnType.isValueType()) {
      return this.unboxValue(rawResult, kind, options) as unknown as T;
    }

    // Handle reference types - return wrapped MonoObject
    return new MonoObject(this.api, rawResult) as unknown as T;
  }

  /**
   * Unbox a value type from a boxed MonoObject pointer
   * @param options Include returnBigInt to preserve Int64/UInt64 as bigint
   */
  private unboxValue(boxedPtr: NativePointer, kind: MonoTypeKind, options: InvokeOptions = {}): any {
    const unboxed = this.api.native.mono_object_unbox(boxedPtr);
    
    switch (kind) {
      case MonoTypeKind.Boolean:
        return unboxed.readU8() !== 0;
      case MonoTypeKind.I1:
        return unboxed.readS8();
      case MonoTypeKind.U1:
        return unboxed.readU8();
      case MonoTypeKind.I2:
        return unboxed.readS16();
      case MonoTypeKind.U2:
      case MonoTypeKind.Char:
        return unboxed.readU16();
      case MonoTypeKind.I4:
        return unboxed.readS32();
      case MonoTypeKind.U4:
        return unboxed.readU32();
      case MonoTypeKind.I8:
        // Return as bigint if requested, otherwise convert to number (may lose precision)
        if (options.returnBigInt) {
          const int64Val = unboxed.readS64();
          return BigInt(int64Val.toString());
        }
        return unboxed.readS64().toNumber();
      case MonoTypeKind.U8:
        // Return as bigint if requested, otherwise convert to number (may lose precision)
        if (options.returnBigInt) {
          const uint64Val = unboxed.readU64();
          return BigInt(uint64Val.toString());
        }
        return unboxed.readU64().toNumber();
      case MonoTypeKind.R4:
        return unboxed.readFloat();
      case MonoTypeKind.R8:
        return unboxed.readDouble();
      case MonoTypeKind.Enum:
        // For enums, get underlying type and unbox recursively
        const underlying = this.getReturnType().getUnderlyingType();
        if (underlying) {
          return this.unboxValue(boxedPtr, underlying.getKind(), options);
        }
        // Default to int32 for unknown enums
        return unboxed.readS32();
      case MonoTypeKind.ValueType:
        // For structs, return the boxed object for further processing
        return new MonoObject(this.api, boxedPtr);
      default:
        // Unknown value type, return boxed pointer
        return new MonoObject(this.api, boxedPtr);
    }
  }

  /**
   * Read a MonoString pointer as a JavaScript string
   */
  private readMonoString(strPtr: NativePointer): string {
    if (pointerIsNull(strPtr)) return "";
    
    // Try mono_string_to_utf8 first (most common)
    if (this.api.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(strPtr);
      if (!pointerIsNull(utf8Ptr)) {
        const result = utf8Ptr.readUtf8String() || "";
        this.api.tryFree(utf8Ptr);
        return result;
      }
    }
    
    return "";
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
      // Use allocPrimitiveArg which returns raw value pointer, NOT boxed object
      return this.allocPrimitiveArg(type, value);
    }
    return value as NativePointer;
  }

  /**
   * Allocate and write a primitive value to memory for use as a method argument.
   * 
   * IMPORTANT: mono_runtime_invoke expects a pointer to the raw value for value types,
   * NOT a boxed MonoObject*. This method returns the raw storage pointer.
   * 
   * @param type The MonoType of the parameter
   * @param value The primitive value to write
   * @returns Pointer to the allocated memory containing the raw value
   */
  private allocPrimitiveArg(type: MonoType, value: number | boolean | bigint): NativePointer {
    const effectiveType = this.resolveUnderlyingPrimitive(type);
    const kind = effectiveType.getKind();
    const { size } = effectiveType.getValueSize();
    const storageSize = Math.max(size, Process.pointerSize);
    const storage = Memory.alloc(storageSize);

    switch (kind) {
      case MonoTypeKind.Boolean:
        storage.writeU8(value ? 1 : 0);
        break;
      case MonoTypeKind.I1:
        storage.writeS8(Number(value));
        break;
      case MonoTypeKind.U1:
        storage.writeU8(Number(value));
        break;
      case MonoTypeKind.I2:
        storage.writeS16(Number(value));
        break;
      case MonoTypeKind.U2:
        storage.writeU16(Number(value));
        break;
      case MonoTypeKind.Char:
        storage.writeU16(typeof value === "number" ? value : Number(value));
        break;
      case MonoTypeKind.I4:
        storage.writeS32(Number(value));
        break;
      case MonoTypeKind.U4:
        storage.writeU32(Number(value));
        break;
      case MonoTypeKind.R4:
        storage.writeFloat(Number(value));
        break;
      case MonoTypeKind.R8:
        storage.writeDouble(Number(value));
        break;
      case MonoTypeKind.I8:
        // Support 64-bit signed integers using Frida's Int64
        if (typeof value === "bigint") {
          storage.writeS64(int64(value.toString()));
        } else if (typeof value === "number") {
          storage.writeS64(int64(value.toString()));
        } else {
          // Assume it's already an Int64 or compatible type
          storage.writeS64(value as any);
        }
        break;
      case MonoTypeKind.U8:
        // Support 64-bit unsigned integers using Frida's UInt64
        if (typeof value === "bigint") {
          storage.writeU64(uint64(value.toString()));
        } else if (typeof value === "number") {
          storage.writeU64(uint64(value.toString()));
        } else {
          // Assume it's already a UInt64 or compatible type
          storage.writeU64(value as any);
        }
        break;
      default:
        throw new Error(`Primitive argument allocation is not supported for parameter type ${effectiveType.getFullName()} on ${this.getFullName()}`);
    }

    // Return the raw storage pointer, NOT a boxed object
    // mono_runtime_invoke expects raw value pointers for value type arguments
    return storage;
  }

  /**
   * Box a primitive value into a MonoObject.
   * Use this when you need an actual boxed object (e.g., for storing in collections).
   * Do NOT use this for method invocation arguments.
   * 
   * @param type The MonoType of the value
   * @param value The primitive value to box
   * @returns Pointer to the boxed MonoObject
   */
  boxPrimitive(type: MonoType, value: number | boolean | bigint): NativePointer {
    const effectiveType = this.resolveUnderlyingPrimitive(type);
    const storage = this.allocPrimitiveArg(type, value);
    
    let klass = effectiveType.getClass();
    if (!klass) {
      const klassPtr = this.api.native.mono_class_from_mono_type(effectiveType.pointer);
      if (!pointerIsNull(klassPtr)) {
        klass = new MonoClass(this.api, klassPtr);
      }
    }
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
        // Basic type validation - enum and primitive checks could be enhanced
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

// ===== METHOD INVOCATION UTILITIES =====

const methodLogger = new Logger({ tag: "MethodInvocation" });

/**
 * Method invocation operation with standardized error handling
 * Provides a safe wrapper around method invocation with logging and error handling
 */
export class MethodInvocation {
  constructor(
    private method: MonoMethod,
    private instance: MonoObject | NativePointer | null,
    private args: MethodArgument[] = [],
    private options: InvokeOptions = {}
  ) {}

  /**
   * Execute the method invocation safely
   */
  safeExecute(context?: string): any {
    try {
      return this.method.invoke(this.instance, this.args, this.options);
    } catch (error) {
      const contextStr = context || this.getContextDescription();
      methodLogger.error(`Method invocation failed in ${contextStr}: ${error}`);
      return null;
    }
  }

  /**
   * Execute with custom error handler
   */
  safeExecuteWithHandler(onError: (error: unknown) => void, context?: string): any {
    try {
      return this.method.invoke(this.instance, this.args, this.options);
    } catch (error) {
      const contextStr = context || this.getContextDescription();
      methodLogger.error(`Method invocation failed in ${contextStr}: ${error}`);
      onError(error);
      return null;
    }
  }

  /**
   * Execute method without error handling (throws on error)
   */
  execute(): any {
    return this.method.invoke(this.instance, this.args, this.options);
  }

  /**
   * Get method information for logging
   */
  getMethodInfo(): string {
    try {
      return `${this.method.getFullName?.() || 'Unknown method'}(${this.args.length} args)`;
    } catch {
      return 'Unknown method';
    }
  }

  /**
   * Get context description for error logging
   */
  private getContextDescription(): string {
    const methodName = this.method.getName();
    const className = this.method.getDeclaringClass().getName();
    const instanceDesc = this.instance ? `on instance` : 'static';
    return `${className}.${methodName} ${instanceDesc}`;
  }

  /**
   * Create a new MethodInvocation instance
   */
  static create(
    method: MonoMethod,
    instance: MonoObject | NativePointer | null = null,
    args: MethodArgument[] = [],
    options: InvokeOptions = {}
  ): MethodInvocation {
    return new MethodInvocation(method, instance, args, options);
  }
}

/**
 * Helper function to create method invocations
 */
export function createMethodInvocation(
  method: MonoMethod,
  instance?: MonoObject | NativePointer | null,
  args?: MethodArgument[],
  options?: InvokeOptions
): MethodInvocation {
  return MethodInvocation.create(method, instance, args, options);
}

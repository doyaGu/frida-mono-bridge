/**
 * Method model (System.Reflection.MethodBase/MethodInfo).
 *
 * Provides metadata inspection (name/signature/flags), custom attribute access,
 * compilation helpers, and invocation utilities (including optional unboxing).
 *
 * @module model/method
 */

import type { MonoApi } from "../runtime/api";
import { MethodAttribute, MethodImplAttribute, getMaskedValue, hasFlag, pickFlags } from "../runtime/metadata";
import {
  allocPrimitiveValue,
  boxPrimitiveValue,
  resolveUnderlyingPrimitive,
  unboxValue,
} from "../runtime/value-conversion";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, MonoManagedExceptionError, raise, raiseFrom } from "../utils/errors";
import { Logger } from "../utils/log";
import { pointerIsNull, unwrapInstance } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import type { CustomAttribute } from "./attribute";
import { createMethodAttributeContext, getCustomAttributes } from "./attribute";
import { MonoClass } from "./class";
import type { MemberAccessibility, MethodArgument } from "./handle";
import { MonoHandle } from "./handle";
import { MonoImage } from "./image";
import { MonoMethodSignature, MonoParameterInfo } from "./method-signature";
import { MonoObject } from "./object";
import { MonoType, MonoTypeKind, MonoTypeSummary, isPointerLikeKind } from "./type";

export interface InvokeOptions {
  /** Throw a `MonoManagedExceptionError` when the managed method throws. */
  throwOnManagedException?: boolean;
  /** Auto-box JS primitives into managed boxed value types when possible. */
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
export type UnboxedType<Kind extends MonoTypeKind> = Kind extends typeof MonoTypeKind.Boolean
  ? boolean
  : Kind extends typeof MonoTypeKind.Char
    ? number
    : Kind extends
          | typeof MonoTypeKind.I1
          | typeof MonoTypeKind.U1
          | typeof MonoTypeKind.I2
          | typeof MonoTypeKind.U2
          | typeof MonoTypeKind.I4
          | typeof MonoTypeKind.U4
          | typeof MonoTypeKind.R4
          | typeof MonoTypeKind.R8
      ? number
      : Kind extends typeof MonoTypeKind.I8 | typeof MonoTypeKind.U8
        ? bigint
        : Kind extends typeof MonoTypeKind.String
          ? string
          : Kind extends typeof MonoTypeKind.Void
            ? void
            : any;

export type MethodAccessibility = MemberAccessibility;

/** Serializable summary of a method and its signature/flags. */
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

const methodLogger = new Logger({ tag: "MonoMethod" });

/**
 * Represents a Mono method.
 *
 * Typical workflow:
 * - locate a method (via domain/class helpers or {@link MonoMethod.find})
 * - inspect metadata (name/fullName/flags/signature)
 * - compile and hook (see tracing module) or invoke via `invoke()/call()` helpers
 */
export class MonoMethod extends MonoHandle {
  // ===== STATIC FACTORY METHODS =====

  /**
   * Try to find a method by descriptor without throwing.
   * @param api MonoApi instance
   * @param image Image to search in
   * @param descriptor Method descriptor (e.g., "Namespace.Class:MethodName")
   * @returns MonoMethod if found, null otherwise
   */
  static tryFind(api: MonoApi, image: MonoImage, descriptor: string): MonoMethod | null {
    const descPtr = Memory.allocUtf8String(descriptor);
    const methodDesc = api.native.mono_method_desc_new(descPtr, 1);
    if (pointerIsNull(methodDesc)) {
      return null;
    }
    try {
      const methodPtr = api.native.mono_method_desc_search_in_image(methodDesc, image.pointer);
      if (pointerIsNull(methodPtr)) {
        return null;
      }
      return new MonoMethod(api, methodPtr);
    } finally {
      api.native.mono_method_desc_free(methodDesc);
    }
  }

  /**
   * Find a method by descriptor, throwing if not found.
   * @param api MonoApi instance
   * @param image Image to search in
   * @param descriptor Method descriptor (e.g., "Namespace.Class:MethodName")
   * @returns MonoMethod
   * @throws {MonoValidationError} if descriptor is invalid
   * @throws {MonoMethodNotFoundError} if method not found
   */
  static find(api: MonoApi, image: MonoImage, descriptor: string): MonoMethod {
    const descPtr = Memory.allocUtf8String(descriptor);
    const methodDesc = api.native.mono_method_desc_new(descPtr, 1);
    if (pointerIsNull(methodDesc)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Invalid method descriptor '${descriptor}'`,
        "Use format 'Namespace.Class:MethodName'",
      );
    }
    try {
      const methodPtr = api.native.mono_method_desc_search_in_image(methodDesc, image.pointer);
      if (pointerIsNull(methodPtr)) {
        raise(
          MonoErrorCodes.METHOD_NOT_FOUND,
          `Method '${descriptor}' not found in image '${image.name}'`,
          "Use tryFind() to avoid throwing",
        );
      }
      return new MonoMethod(api, methodPtr);
    } finally {
      api.native.mono_method_desc_free(methodDesc);
    }
  }

  // ===== CORE PROPERTIES =====

  /** Gets the name of this method. */
  @lazy
  get name(): string {
    const namePtr = this.native.mono_method_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  /**
   * Gets the full name of this method (including declaring type and signature).
   */
  @lazy
  get fullName(): string {
    return this.getFullName(true);
  }

  /** Gets the full name of this method without the signature. */
  @lazy
  get fullNameWithoutSignature(): string {
    return this.getFullName(false);
  }

  /** Gets the signature of this method. */
  @lazy
  get signature(): MonoMethodSignature {
    const signaturePtr = this.native.mono_method_signature(this.pointer);
    return new MonoMethodSignature(this.api, signaturePtr);
  }

  /** Gets the class that declares this method. */
  @lazy
  get declaringClass(): MonoClass {
    const klassPtr = this.native.mono_method_get_class(this.pointer);
    return new MonoClass(this.api, klassPtr);
  }

  /** Gets the flags of this method. */
  @lazy
  get flags(): number {
    return this.native.mono_method_get_flags(this.pointer, NULL) as number;
  }

  /** Gets the implementation flags of this method. */
  @lazy
  get implementationFlags(): number {
    const implPtr = Memory.alloc(4);
    this.native.mono_method_get_flags(this.pointer, implPtr);
    return implPtr.readU32();
  }

  /** Gets the metadata token of this method. */
  @lazy
  get token(): number {
    return this.native.mono_method_get_token(this.pointer) as number;
  }

  /** Gets the number of parameters. */
  get parameterCount(): number {
    return this.signature.parameterCount;
  }

  /** Gets the parameter types. */
  get parameterTypes(): MonoType[] {
    return this.signature.parameterTypes;
  }

  /** Gets the parameters. */
  get parameters(): MonoParameterInfo[] {
    return this.signature.parameters;
  }

  /** Gets the return type. */
  get returnType(): MonoType {
    return this.signature.returnType;
  }

  /** Gets the calling convention. */
  get callConvention(): number {
    return this.signature.callConvention;
  }

  /** Determines whether this is an instance method. */
  get isInstanceMethod(): boolean {
    return this.signature.isInstanceMethod;
  }

  // ===== TYPE CHECKS =====

  /** Determines whether this method is static. */
  @lazy
  get isStatic(): boolean {
    return hasFlag(this.flags, MethodAttribute.Static);
  }

  /** Determines whether this method is virtual. */
  @lazy
  get isVirtual(): boolean {
    return hasFlag(this.flags, MethodAttribute.Virtual);
  }

  /** Determines whether this method is abstract. */
  @lazy
  get isAbstract(): boolean {
    return hasFlag(this.flags, MethodAttribute.Abstract);
  }

  /** Determines whether this method is an internal call (implemented in native code). */
  @lazy
  get isInternalCall(): boolean {
    return hasFlag(this.implementationFlags, MethodImplAttribute.InternalCall);
  }

  /** Determines whether this method uses P/Invoke. */
  @lazy
  get isPInvoke(): boolean {
    return hasFlag(this.flags, MethodAttribute.PInvokeImpl);
  }

  /** Determines whether this method is implemented in native code (Runtime code type). */
  @lazy
  get isRuntimeImplemented(): boolean {
    const codeType = getMaskedValue(this.implementationFlags, MethodImplAttribute.CodeTypeMask);
    return codeType === MethodImplAttribute.Runtime;
  }

  /** Determines whether this method can potentially be hooked using Interceptor. */
  get canBeHooked(): boolean {
    if (this.isAbstract) return false;
    if (this.isInternalCall) return false;
    if (this.isPInvoke) return false;
    if (this.isRuntimeImplemented) return false;
    return true;
  }

  /** Determines whether this method is a constructor. */
  @lazy
  get isConstructor(): boolean {
    return hasFlag(this.flags, MethodAttribute.RTSpecialName) && this.name === ".ctor";
  }

  // ===== ACCESSIBILITY AND ATTRIBUTES =====

  /** Gets the access modifier of this method. */
  @lazy
  get accessibility(): MethodAccessibility {
    const mask = getMaskedValue(this.flags, MethodAttribute.MemberAccessMask);
    return METHOD_ACCESS_NAMES[mask] ?? "private";
  }

  /** Gets the attribute names of this method. */
  get attributeNames(): string[] {
    return pickFlags(this.flags, METHOD_DESCRIBED_FLAGS);
  }

  /** Gets the implementation attribute names of this method. */
  get implementationAttributeNames(): string[] {
    return pickFlags(this.implementationFlags, METHOD_IMPL_FLAGS);
  }

  /**
   * Get custom attributes applied to this method.
   * Uses mono_custom_attrs_from_method API to retrieve attribute metadata.
   * @returns Array of CustomAttribute objects with attribute type information
   */
  @lazy get customAttributes(): CustomAttribute[] {
    return getCustomAttributes(
      createMethodAttributeContext(this.api, this.pointer, this.native),
      ptr => new MonoClass(this.api, ptr).name,
      ptr => new MonoClass(this.api, ptr).fullName,
    );
  }

  /**
   * Get the full name of this method.
   * @param includeSignature Whether to include parameter types in the name
   * @returns Full method name with optional signature
   */
  getFullName(includeSignature = true): string {
    const namePtr = this.native.mono_method_full_name(this.pointer, includeSignature ? 1 : 0);
    if (pointerIsNull(namePtr)) {
      return this.name;
    }
    try {
      return readUtf8String(namePtr);
    } finally {
      this.api.tryFree(namePtr);
    }
  }

  /**
   * Get a comprehensive summary of this method.
   * @returns MonoMethodSummary with all method information
   */
  describe(): MonoMethodSummary {
    const params = this.parameters.map(param => ({
      index: param.index,
      isOut: param.isOut,
      type: param.type.getSummary(),
    }));
    const retType = this.returnType.getSummary();
    return {
      name: this.name,
      fullName: this.fullName,
      declaringType: this.declaringClass.fullName,
      attributes: this.flags,
      attributeNames: this.attributeNames,
      implementationAttributes: this.implementationFlags,
      implementationAttributeNames: this.implementationAttributeNames,
      accessibility: this.accessibility,
      isStatic: this.isStatic,
      isVirtual: this.isVirtual,
      isAbstract: this.isAbstract,
      isConstructor: this.isConstructor,
      isGenericMethod: this.isGenericMethod,
      genericArgumentCount: this.genericArgumentCount,
      callConvention: this.callConvention,
      parameterCount: params.length,
      parameters: params,
      returnType: retType,
      token: this.token,
    };
  }

  // ===== GENERIC METHOD SUPPORT =====

  /**
   * Check if this method is a generic method (has generic type parameters).
   * For example, `void Swap<T>(ref T a, ref T b)` is a generic method.
   */
  @lazy
  get isGenericMethod(): boolean {
    // Try Unity API first
    try {
      const result = this.native.unity_mono_method_is_generic(this.pointer);
      return Number(result) !== 0;
    } catch {
      // Fall through to name-based detection
    }

    // Fall back to checking method full name for generic markers
    const fullName = this.fullName;
    return fullName.includes("<") && fullName.includes(">");
  }

  /**
   * Check if this is a generic method definition (open generic method).
   * A generic method definition has unbound type parameters.
   */
  @lazy
  get isGenericMethodDefinition(): boolean {
    if (!this.isGenericMethod) {
      return false;
    }
    const fullName = this.fullName;
    const hasUnboundParams = /\[[A-Z][a-zA-Z0-9_,\s]*\]/.test(fullName) || /<[A-Z][a-zA-Z0-9_,\s]*>/.test(fullName);
    return hasUnboundParams;
  }

  /**
   * Get the number of generic type parameters for this method.
   * Returns 0 for non-generic methods.
   *
   * Note: This parses the method name to determine the count since
   * `mono_unity_method_get_generic_argument_count` does NOT exist in any known Mono version.
   */
  @lazy
  get genericArgumentCount(): number {
    // Parse from method name - generic methods are marked like MethodName`2 or in full name <T, U>
    const fullName = this.fullName;

    // Count type parameters in angle brackets
    const match = fullName.match(/<([^>]+)>/);
    if (match) {
      const params = match[1]
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      return params.length;
    }

    // Check for backtick notation in method name
    const nameMatch = this.name.match(/`(\d+)/);
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
   * Note: Full implementation requires APIs that don't exist in known Mono versions.
   * `mono_unity_method_get_generic_argument_at` does NOT exist.
   * Returns an empty array for now - future implementations could use reflection
   * or parse method signatures.
   */
  @lazy get genericArguments(): MonoClass[] {
    // APIs for getting generic method arguments don't exist in known Mono versions:
    // - mono_unity_method_get_generic_argument_at: NOT exported
    // - mono_unity_method_get_generic_argument_count: NOT exported
    //
    // Future implementation could use reflection via MethodInfo.GetGenericArguments()
    return [];
  }

  /**
   * Create an instantiated generic method from this generic method definition.
   *
   * Uses available Mono APIs to instantiate the generic method with concrete type arguments.
   * Tries multiple approaches: Unity-specific API, reflection-based instantiation, or
   * direct context-based inflation.
   *
   * @param typeArguments Array of MonoClass to use as type arguments
   * @returns Instantiated generic method, or null if instantiation failed
   *
   * @example
   * // Get a generic method like T Max<T>(T a, T b)
   * const maxMethod = mathClass.method('Max`1');
   * const intClass = Mono.domain.class('System.Int32');
   * // Create Max<int>
   * const maxInt = maxMethod?.makeGenericMethod([intClass]);
   */
  makeGenericMethod(typeArguments: MonoClass[]): MonoMethod | null {
    if (!this.isGenericMethodDefinition) {
      return null;
    }

    const expectedCount = this.genericArgumentCount;
    if (typeArguments.length !== expectedCount) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Generic method ${this.name} expects ${expectedCount} type arguments, but ${typeArguments.length} were provided`,
        "Ensure the number of type arguments matches the generic parameter count",
      );
    }

    // Try mono_class_inflate_generic_method with constructed context
    if (this.api.hasExport("mono_class_inflate_generic_method")) {
      const result = this.makeGenericMethodViaInflation(typeArguments);
      if (result) {
        return result;
      }
    }

    // Try reflection-based approach using MethodInfo.MakeGenericMethod
    const result = this.makeGenericMethodViaReflection(typeArguments);
    if (result) {
      return result;
    }

    // Log warning if all approaches fail
    methodLogger.warn(
      `makeGenericMethod: Cannot instantiate ${this.fullName} with ` +
        `[${typeArguments.map(t => t.fullName).join(", ")}]. ` +
        `No suitable API available.`,
    );
    return null;
  }

  /**
   * Create generic method using mono_class_inflate_generic_method.
   * This builds a MonoGenericContext structure and inflates the method.
   *
   * MonoGenericContext structure:
   * - class_inst: MonoGenericInst* (for class type arguments, null for method-only)
   * - method_inst: MonoGenericInst* (for method type arguments)
   *
   * MonoGenericInst structure:
   * - id: int32 (debug, only in non-small config)
   * - type_argc: uint (22 bits)
   * - is_open: uint (1 bit)
   * - type_argv: MonoType*[]
   */
  private makeGenericMethodViaInflation(typeArguments: MonoClass[]): MonoMethod | null {
    try {
      // Build MonoGenericInst-like structure for method_inst
      // Structure: type_argc (4 bytes) + is_open flag (packed) + type_argv pointers
      // In practice, we need to look at the actual Mono internals

      // First, check if we can get the generic container for this method
      // The generic container has context.method_inst that we can use as a template

      if (this.api.hasExport("mono_method_get_generic_container")) {
        const container = this.native.mono_method_get_generic_container(this.pointer);
        if (!pointerIsNull(container)) {
          // MonoGenericContainer has a context field with method_inst
          // The layout depends on Mono version, but typically:
          // context is at offset 0 in the container
          // context.class_inst is at offset 0
          // context.method_inst is at offset sizeof(pointer)
          // Note: This information could be used for template instantiation in future versions
          // const templateInst = container.add(Process.pointerSize).readPointer();
        }
      }

      // Build type_argv array from type arguments (MonoType* for each class)
      const typeCount = typeArguments.length;
      const typeArgv = Memory.alloc(Process.pointerSize * typeCount);

      for (let i = 0; i < typeCount; i++) {
        const monoType = typeArguments[i].type.pointer;
        typeArgv.add(i * Process.pointerSize).writePointer(monoType);
      }

      // We need to construct a valid MonoGenericInst
      // The problem is mono_metadata_get_generic_inst is not always exported
      // We'll try to build the structure manually

      // MonoGenericInst layout (simplified, depends on MONO_SMALL_CONFIG):
      // - uint type_argc (22 bits) + is_open (1 bit) + padding in first 4 bytes
      // - MonoType* type_argv[type_argc]
      //
      // Actually, in modern Mono it's:
      // struct _MonoGenericInst {
      //   gint32 id;           // only if !MONO_SMALL_CONFIG
      //   guint type_argc : 22;
      //   guint is_open : 1;
      //   MonoType *type_argv [MONO_ZERO_LEN_ARRAY];
      // }

      // Calculate size: header + type_argv array
      // Header is either 4 bytes (SMALL_CONFIG) or 8 bytes (with id)
      // Let's try with 4-byte header first (more common in Unity)
      const headerSize = 4; // Just the packed type_argc + is_open
      const instSize = headerSize + Process.pointerSize * typeCount;
      const methodInst = Memory.alloc(instSize);

      // Write type_argc (22 bits) + is_open (1 bit) = not open (0)
      // type_argc in lower 22 bits
      methodInst.writeU32(typeCount & 0x3fffff);

      // Write type_argv pointers
      for (let i = 0; i < typeCount; i++) {
        const monoType = typeArguments[i].type.pointer;
        methodInst.add(headerSize + i * Process.pointerSize).writePointer(monoType);
      }

      // Build MonoGenericContext
      // struct _MonoGenericContext {
      //   MonoGenericInst *class_inst;
      //   MonoGenericInst *method_inst;
      // }
      const contextSize = Process.pointerSize * 2;
      const context = Memory.alloc(contextSize);

      // class_inst = NULL (method-level generic only)
      context.writePointer(NULL);
      // method_inst = our constructed inst
      context.add(Process.pointerSize).writePointer(methodInst);

      // Call mono_class_inflate_generic_method
      const inflatedMethod = this.native.mono_class_inflate_generic_method(this.pointer, context);

      if (pointerIsNull(inflatedMethod)) {
        return null;
      }

      return new MonoMethod(this.api, inflatedMethod);
    } catch (e) {
      // Silently fail - this approach may not work on all Mono versions
      return null;
    }
  }

  // NOTE: mono_unity_method_make_generic is NOT exported in any known Mono version
  // (neither legacy mono.dll nor MonoBleedingEdge). Use reflection or inflation instead.

  /**
   * Create generic method using reflection (MethodInfo.MakeGenericMethod).
   * This invokes the managed MakeGenericMethod method via reflection.
   */
  private makeGenericMethodViaReflection(typeArguments: MonoClass[]): MonoMethod | null {
    try {
      const domain = this.api.getRootDomain();

      // Get System.Type[] for the type arguments
      const typeArray = this.createTypeArray(typeArguments, domain);
      if (pointerIsNull(typeArray)) {
        return null;
      }

      // Get MethodInfo object for this method
      const methodInfo = this.native.mono_method_get_object(domain, this.pointer, NULL);
      if (pointerIsNull(methodInfo)) {
        return null;
      }

      // Get the MakeGenericMethod method from MethodInfo
      const methodInfoClass = this.native.mono_object_get_class(methodInfo);
      if (pointerIsNull(methodInfoClass)) {
        return null;
      }

      const makeGenericMethodName = Memory.allocUtf8String("MakeGenericMethod");
      const makeGenericMethod = this.native.mono_class_get_method_from_name(methodInfoClass, makeGenericMethodName, 1);

      if (pointerIsNull(makeGenericMethod)) {
        return null;
      }

      // Invoke MakeGenericMethod(Type[] typeArguments) via api.runtimeInvoke (shared exc handling)
      let resultMethodInfo: NativePointer;
      try {
        resultMethodInfo = this.api.runtimeInvoke(makeGenericMethod, methodInfo, [typeArray]);
      } catch {
        return null;
      }

      if (pointerIsNull(resultMethodInfo)) {
        return null;
      }

      // Get the MonoMethod from the resulting MethodInfo
      const handleField = this.getMethodHandleFromMethodInfo(resultMethodInfo);
      if (handleField && !pointerIsNull(handleField)) {
        return new MonoMethod(this.api, handleField);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a System.Type[] array from MonoClass array.
   */
  private createTypeArray(typeArguments: MonoClass[], domain: NativePointer): NativePointer {
    try {
      // Get System.Type class
      const mscorlibImage = this.api.native.mono_image_loaded(Memory.allocUtf8String("mscorlib"));
      if (pointerIsNull(mscorlibImage)) {
        return NULL;
      }

      const typeClass = this.api.native.mono_class_from_name(
        mscorlibImage,
        Memory.allocUtf8String("System"),
        Memory.allocUtf8String("Type"),
      );

      if (pointerIsNull(typeClass)) {
        return NULL;
      }

      // Create Type[] array
      const typeArray = this.native.mono_array_new(domain, typeClass, typeArguments.length);
      if (pointerIsNull(typeArray)) {
        return NULL;
      }

      // Fill the array with Type objects for each MonoClass
      for (let i = 0; i < typeArguments.length; i++) {
        const monoType = typeArguments[i].type.pointer;
        const typeObj = this.native.mono_type_get_object(domain, monoType);

        if (pointerIsNull(typeObj)) {
          return NULL;
        }

        // Set array element using mono_gc_wbarrier_set_arrayref instead of mono_array_setref
        // NOTE: mono_array_setref is not exported in any Mono DLL (neither mono.dll nor mono-2.0-bdwgc.dll)
        // mono_gc_wbarrier_set_arrayref(array, slot_ptr, value) is the correct replacement
        const elementAddr = this.native.mono_array_addr_with_size(typeArray, Process.pointerSize, i);
        this.native.mono_gc_wbarrier_set_arrayref(typeArray, elementAddr, typeObj);
      }

      return typeArray;
    } catch {
      return NULL;
    }
  }

  /**
   * Extract the MonoMethod* from a MethodInfo reflection object.
   */
  private getMethodHandleFromMethodInfo(methodInfo: NativePointer): NativePointer | null {
    try {
      // Try Unity-specific API first (common in Unity runtime)
      const method = this.native.unity_mono_reflection_method_get_method(methodInfo);
      if (!pointerIsNull(method)) {
        return method;
      }
    } catch {
      // Fall through to direct field access
    }

    try {
      // Fallback: Try to read the method handle field directly
      // MethodInfo has a RuntimeMethodHandle field at a known offset
      const klass = this.native.mono_object_get_class(methodInfo);
      if (pointerIsNull(klass)) {
        return null;
      }

      // Try to get the "mhandle" field (internal method pointer)
      const mhandleFieldName = Memory.allocUtf8String("mhandle");
      const mhandleField = this.native.mono_class_get_field_from_name(klass, mhandleFieldName);

      if (!pointerIsNull(mhandleField)) {
        const valuePtr = Memory.alloc(Process.pointerSize);
        this.native.mono_field_get_value(methodInfo, mhandleField, valuePtr);
        const methodPtr = valuePtr.readPointer();
        if (!pointerIsNull(methodPtr)) {
          return methodPtr;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // ===== JIT COMPILATION =====

  /**
   * Compile this method to native code and return the code address.
   *
   * This triggers JIT compilation of the method if it hasn't been compiled yet.
   * The returned address points to the start of the native code that can be
   * hooked with Frida's Interceptor.
   *
   * **Warning**: Calling this on methods that haven't been invoked before may cause
   * issues in some Mono builds. Consider using `tryCompile()` for safer operation.
   *
   * @returns Native code address for this method
   * @throws {MonoJitError} if compilation fails or returns NULL
   */
  compile(): NativePointer {
    const result = this.tryCompile();
    if (result === null) {
      raise(
        MonoErrorCodes.JIT_FAILED,
        `Failed to compile method ${this.fullName}`,
        "Use tryCompile() to handle compilation failures gracefully",
      );
    }
    return result;
  }

  /**
   * Attempt to compile this method to native code, returning null on failure.
   *
   * This is a safer alternative to `compile()` that won't throw exceptions.
   * Use this when hooking methods that may or may not have been JIT compiled yet.
   *
   * **Note**: Mono uses lazy JIT compilation. Methods are compiled on first call,
   * not when loaded. If a method hasn't been called yet, `mono_compile_method`
   * may return a trampoline address or fail entirely. This is normal behavior.
   *
   * Possible failure cases:
   * - Method is abstract (no implementation)
   * - Method is an InternalCall or P/Invoke (native implementation)
   * - Method hasn't been called yet and Mono's JIT compiler fails
   * - Memory access violation during compilation (rare)
   *
   * @returns Native code address if compilation succeeds, null otherwise
   *
   * @example
   * const codeAddr = method.tryCompile();
   * if (codeAddr) {
   *   Interceptor.attach(codeAddr, { onEnter(args) { ... } });
   * } else {
   *   console.log("Method cannot be hooked (not yet JIT compiled)");
   * }
   */
  tryCompile(): NativePointer | null {
    // Check if method can potentially be compiled
    if (this.isAbstract) {
      methodLogger.debug(`Cannot compile abstract method: ${this.fullName}`);
      return null;
    }

    // InternalCall and Runtime methods may not have JIT-able code
    if (this.isInternalCall) {
      methodLogger.debug(`Method is InternalCall: ${this.fullName}`);
      // InternalCall methods might still have an address via different mechanism
      // but mono_compile_method typically won't work for them
    }

    try {
      const codeAddr = this.native.mono_compile_method(this.pointer);

      if (pointerIsNull(codeAddr)) {
        methodLogger.debug(`mono_compile_method returned NULL for: ${this.fullName}`);
        return null;
      }

      // Additional validation: Check if the address looks valid
      // Very low addresses (< 0x1000) are typically invalid or trampolines
      // However, this varies by platform, so we only check for NULL
      return codeAddr;
    } catch (error) {
      // mono_compile_method can throw access violations for methods
      // that haven't been JIT compiled and have problematic metadata
      methodLogger.debug(`Exception compiling ${this.fullName}: ${error}`);
      return null;
    }
  }

  /**
   * Check if this method has been JIT compiled (has native code available).
   *
   * This attempts to compile the method and returns true if successful.
   * Note that after calling this, the method will be compiled if it wasn't already.
   *
   * @returns true if native code is available, false otherwise
   */
  isCompiled(): boolean {
    return this.tryCompile() !== null;
  }

  // ===== METHOD INVOCATION =====

  /**
   * Invoke this method with the given arguments.
   * @param instance Object instance (null for static methods)
   * @param args Method arguments
   * @param options Invocation options
   * @returns Raw result pointer from mono_runtime_invoke
   * @throws {MonoManagedExceptionError} if method throws and throwOnManagedException is true
   */
  invoke(
    instance: MonoObject | NativePointer | null,
    args: MethodArgument[] = [],
    options: InvokeOptions = {},
  ): NativePointer {
    const autoBox = options.autoBoxPrimitives !== false;
    const prepared = autoBox ? this.prepareArguments(args) : args.map(arg => this.api.prepareInvocationArgument(arg));
    try {
      const result = this.api.runtimeInvoke(this.pointer, unwrapInstance(instance), prepared);
      return result;
    } catch (error) {
      if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
        return NULL;
      }
      raiseFrom(error);
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
  call<T = any>(
    instance: MonoObject | NativePointer | null,
    args: MethodArgument[] = [],
    options: InvokeOptions = {},
  ): T {
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
  callWithInfo<T = any>(
    instance: MonoObject | NativePointer | null,
    args: MethodArgument[] = [],
    options: InvokeOptions = {},
  ): InvokeResult<T> {
    const rawResult = this.invoke(instance, args, options);
    const retType = this.returnType;
    const isNull = pointerIsNull(rawResult);

    return {
      raw: rawResult,
      isNull,
      value: isNull ? (null as unknown as T) : this.unboxResult<T>(rawResult, options),
      type: retType,
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Unbox the raw result pointer based on the return type.
   * Handles value types, strings, and reference types automatically.
   * @param rawResult Raw pointer from mono_runtime_invoke
   * @param options Include returnBigInt to preserve Int64/UInt64 precision
   * @returns Unboxed value of type T
   */
  private unboxResult<T>(rawResult: NativePointer, options: InvokeOptions = {}): T {
    if (pointerIsNull(rawResult)) {
      return null as unknown as T;
    }

    const retType = this.returnType;
    const kind = retType.kind;

    // Handle void
    if (kind === MonoTypeKind.Void) {
      return undefined as unknown as T;
    }

    // Handle string specially
    if (kind === MonoTypeKind.String) {
      return this.readMonoString(rawResult) as unknown as T;
    }

    // Handle value types (need to unbox)
    if (retType.valueType) {
      return unboxValue(this.api, rawResult, retType, {
        returnBigInt: options.returnBigInt,
        structAsObject: true,
      }) as unknown as T;
    }

    // Handle reference types - return wrapped MonoObject
    return new MonoObject(this.api, rawResult) as unknown as T;
  }

  /**
   * Read a MonoString pointer as a JavaScript string.
   * @param strPtr Pointer to MonoString
   * @returns JavaScript string
   */
  private readMonoString(strPtr: NativePointer): string {
    return this.api.readMonoString(strPtr, false);
  }

  /**
   * Prepare method arguments for invocation.
   * @param args Array of raw arguments
   * @returns Array of prepared NativePointers
   */
  private prepareArguments(args: MethodArgument[]): NativePointer[] {
    const sig = this.signature;
    const types = sig.parameterTypes;
    const prepared: NativePointer[] = [];
    for (let index = 0; index < types.length; index += 1) {
      const type = types[index];
      const value = index < args.length ? args[index] : undefined;
      prepared.push(this.prepareArgumentForType(type, value, index));
    }
    return prepared;
  }

  /**
   * Prepare a single argument for a specific parameter type.
   * @param type Expected MonoType of the parameter
   * @param value Argument value to prepare
   * @param index Parameter index (for error messages)
   * @returns Prepared NativePointer
   * @throws {MonoTypeMismatchError} if value type is incompatible
   */
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
      if (type.byRef || isPointerLikeKind(type.kind)) {
        raise(
          MonoErrorCodes.TYPE_MISMATCH,
          `Parameter ${index} on ${this.fullName} expects a pointer or reference; received primitive value`,
          "Pass a NativePointer instead of a primitive value",
        );
      }
      // Use shared allocPrimitiveValue which returns raw value pointer, NOT boxed object
      return allocPrimitiveValue(type, value);
    }
    return value as NativePointer;
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
    const effectiveType = resolveUnderlyingPrimitive(type);

    let klass = effectiveType.class;
    if (!klass) {
      const klassPtr = this.api.native.mono_class_from_mono_type(effectiveType.pointer);
      if (!pointerIsNull(klassPtr)) {
        klass = new MonoClass(this.api, klassPtr);
      }
    }
    if (!klass) {
      raise(
        MonoErrorCodes.CLASS_NOT_FOUND,
        `Unable to resolve class for parameter type ${effectiveType.fullName} on ${this.fullName}`,
        "Ensure the type is properly defined in the Mono runtime",
      );
    }
    klass.ensureInitialized();
    const domain = this.api.getRootDomain();
    return boxPrimitiveValue(this.api, klass.pointer, effectiveType, value, domain);
  }

  // ===== VALIDATION AND INSPECTION =====

  /**
   * Get a human-readable description of this method.
   * @returns Description string with modifiers, return type, name, and parameters
   */
  @lazy get description(): string {
    const modifiers = [];
    if (this.isStatic) modifiers.push("static");
    if (this.isVirtual) modifiers.push("virtual");
    if (this.isAbstract) modifiers.push("abstract");
    if (this.isConstructor) modifiers.push("constructor");

    const modifierStr = modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
    const params = this.parameters.map(param => `${param.type.name} param${param.index}`).join(", ");
    return `${modifierStr}${this.returnType.name} ${this.name}(${params})`;
  }

  /**
   * Validate method arguments before invocation.
   * @param args Array of arguments to validate
   * @returns Validation result with isValid flag and error messages
   */
  validateArguments(args: any[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const expectedCount = this.parameterCount;
    const actualCount = args.length;

    if (expectedCount !== actualCount) {
      errors.push(`Expected ${expectedCount} arguments, got ${actualCount}`);
    }

    for (let i = 0; i < Math.min(actualCount, this.parameterTypes.length); i++) {
      const expectedType = this.parameterTypes[i];
      const paramInfo = this.parameters[i];
      const actualValue = args[i];

      // Basic null/undefined validation
      if (actualValue === null || actualValue === undefined) {
        if (expectedType.valueType) {
          errors.push(`Argument ${i} cannot be null for value type ${expectedType.name}`);
        }
        continue;
      }

      // Type validation for value types
      if (expectedType.valueType) {
        const valueType = typeof actualValue;
        // Basic type validation - enum and primitive checks could be enhanced
        if (!this.isCompatiblePrimitiveType(valueType, expectedType)) {
          errors.push(`Argument ${i} type mismatch: expected ${expectedType.name}, got ${valueType}`);
        }
      }

      // Reference type validation
      if (!expectedType.valueType && actualValue instanceof MonoObject) {
        const actualClass = actualValue.class;
        if (!this.isTypeCompatible(expectedType, actualClass)) {
          errors.push(`Argument ${i} type mismatch: expected ${expectedType.name}, got ${actualClass.fullName}`);
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
      errors,
    };
  }

  /**
   * Validate method accessibility in current context.
   * @param context Context information including static flag and instance type
   * @returns Validation result with isValid flag and error messages
   */
  validateAccessibility(context?: { isStatic?: boolean; instanceType?: MonoClass }): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if method is static but being called on instance
    if (this.isStatic && context?.isStatic === false) {
      errors.push(`Static method ${this.name} cannot be called on instance`);
    }

    // Check if instance method is being called without instance
    if (!this.isStatic && context?.isStatic !== false && !context?.instanceType) {
      errors.push(`Instance method ${this.name} requires an object instance`);
    }

    // Check if method is abstract
    if (this.isAbstract) {
      errors.push(`Abstract method ${this.name} cannot be called directly`);
    }

    // Check instance type compatibility
    if (!this.isStatic && context?.instanceType) {
      const declClass = this.declaringClass;
      if (!declClass.isAssignableFrom(context.instanceType)) {
        errors.push(`Method ${this.name} cannot be called on instance of type ${context.instanceType.fullName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate method metadata integrity.
   * @returns Validation result with isValid flag, errors, and warnings
   */
  validateMetadata(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if method has a valid name
      if (!this.name || this.name.trim() === "") {
        errors.push("Method has invalid name");
      }

      // Check if declaring class is accessible
      const declClass = this.declaringClass;
      if (!declClass) {
        errors.push("Unable to determine declaring class");
      }

      // Check signature validity
      const sig = this.signature;
      if (!sig) {
        errors.push("Unable to get method signature");
      }

      // Check return type
      const retType = this.returnType;
      if (!retType) {
        errors.push("Unable to determine return type");
      }

      // Warnings for unusual patterns
      if (this.isStatic && this.isVirtual) {
        warnings.push("Method is both static and virtual (unusual pattern)");
      }

      if (this.isAbstract && this.isStatic) {
        warnings.push("Method is both abstract and static (unusual pattern)");
      }

      // Check parameter count consistency
      const paramCount = this.parameterCount;
      const paramTypes = this.parameterTypes;
      if (paramCount !== paramTypes.length) {
        errors.push(
          `Parameter count mismatch: parameterCount=${paramCount}, parameterTypes.length=${paramTypes.length}`,
        );
      }
    } catch (error) {
      errors.push(`Validation failed with error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a JavaScript type is compatible with a Mono primitive type.
   * @param jsType JavaScript type name ("number", "boolean", "string")
   * @param monoType Mono type to check against
   * @returns True if types are compatible
   */
  private isCompatiblePrimitiveType(jsType: string, monoType: MonoType): boolean {
    const typeName = monoType.name.toLowerCase();

    switch (jsType) {
      case "number":
        return ["int32", "int64", "uint32", "uint64", "single", "double", "float"].some(t => typeName.includes(t));
      case "boolean":
        return typeName.includes("bool");
      case "string":
        return typeName.includes("string") || typeName.includes("char");
      default:
        return false;
    }
  }

  /**
   * Check if two Mono types are compatible.
   * @param expectedType Expected MonoType
   * @param actualType Actual MonoClass
   * @returns True if types are compatible
   */
  private isTypeCompatible(expectedType: MonoType, actualType: MonoClass): boolean {
    const expectedClass = expectedType.class;
    if (!expectedClass) return false;
    return expectedClass.isAssignableFrom(actualType);
  }
}

// ===== METHOD INVOCATION UTILITIES =====

/**
 * Method invocation operation with standardized error handling
 * Provides a safe wrapper around method invocation with logging and error handling
 */
export class MethodInvocation {
  constructor(
    private method: MonoMethod,
    private instance: MonoObject | NativePointer | null,
    private args: MethodArgument[] = [],
    private options: InvokeOptions = {},
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
      return `${this.method.fullName || "Unknown method"}(${this.args.length} args)`;
    } catch {
      return "Unknown method";
    }
  }

  /**
   * Get context description for error logging
   */
  private getContextDescription(): string {
    const methodName = this.method.name;
    const className = this.method.declaringClass.name;
    const instanceDesc = this.instance ? `on instance` : "static";
    return `${className}.${methodName} ${instanceDesc}`;
  }

  /**
   * Create a new MethodInvocation instance
   */
  static new(
    method: MonoMethod,
    instance: MonoObject | NativePointer | null = null,
    args: MethodArgument[] = [],
    options: InvokeOptions = {},
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
  options?: InvokeOptions,
): MethodInvocation {
  return MethodInvocation.new(method, instance, args, options);
}

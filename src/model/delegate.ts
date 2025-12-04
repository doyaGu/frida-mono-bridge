import { MonoApi, MonoArg, MonoManagedExceptionError } from "../runtime/api";
import { Logger } from "../utils/log";
import { MonoClass } from "./class";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { isCompatibleNativeType, MonoType, MonoTypeKind, monoTypeKindToNative } from "./type";

const delegateLogger = Logger.withTag("MonoDelegate");

type AnyNativeFunction = NativeFunction<any, any[]>;

// ===== TYPE DEFINITIONS =====

/**
 * Options for managed delegate invocation
 */
export interface DelegateInvokeOptions {
  /** Whether to throw on managed exceptions (default: true) */
  throwOnManagedException?: boolean;
}

/**
 * Options for compiling native delegate thunks
 */
export interface CompileNativeOptions {
  /** Whether to cache the compiled thunk (default: true) */
  cache?: boolean;
  /** Whether to validate ABI compatibility (default: true). Set to false to skip validation for performance. */
  validateAbi?: boolean;
}

/**
 * Result of ABI validation for native delegate compilation
 */
export interface AbiValidationResult {
  /** Whether the ABI is valid */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
  /** Expected native signature based on managed delegate */
  expectedSignature: {
    returnType: string;
    argTypes: string[];
  };
}

/**
 * Information about a delegate's target
 */
export interface DelegateTargetInfo {
  /** Whether the delegate has a target instance */
  hasTarget: boolean;
  /** Target object (null for static methods) */
  target: MonoObject | null;
  /** The method bound to the delegate */
  method: MonoMethod | null;
}

/**
 * Summary information for a delegate
 */
export interface MonoDelegateSummary {
  /** Delegate type name */
  typeName: string;
  /** Full delegate type name */
  fullTypeName: string;
  /** Whether this is a multicast delegate */
  isMulticast: boolean;
  /** Number of delegates in invocation list */
  invocationCount: number;
  /** Return type name */
  returnTypeName: string;
  /** Parameter type names */
  parameterTypeNames: string[];
  /** Parameter count */
  parameterCount: number;
  /** Whether the delegate has a target instance */
  hasTarget: boolean;
  /** Expected native signature */
  nativeSignature: {
    returnType: string;
    argTypes: string[];
  };
}

// ===== MAIN CLASS =====

/**
 * Wrapper for Mono delegate objects with managed and native invocation support.
 *
 * Provides both safe managed invocation and high-performance native thunk compilation.
 * Delegates in .NET are type-safe function pointers that can reference both static
 * and instance methods.
 *
 * @extends MonoObject
 *
 * @example
 * ```typescript
 * // Create a delegate for a static method
 * const delegate = MonoDelegate.create(api, actionClass, null, staticMethod);
 *
 * // Invoke using managed mode (safe)
 * delegate.invokeManaged([arg1, arg2]);
 *
 * // Compile native thunk for high-performance invocation
 * const thunk = delegate.compileNative<NativeFunction<"void", ["pointer"]>>("void", ["pointer"]);
 * thunk(delegate.pointer);
 *
 * // Get delegate information
 * console.log(delegate.describe());
 * console.log(delegate.getSummary());
 * ```
 */
export class MonoDelegate extends MonoObject {
  #invokePtr: NativePointer | null = null;
  #thunkPtr: NativePointer | null = null;
  #nativeFunctions = new Map<string, AnyNativeFunction>();
  #invokeMethod: MonoMethod | null = null;

  // ===== STATIC FACTORY =====

  /**
   * Creates a new delegate instance bound to a target and method.
   *
   * @param api MonoApi instance
   * @param delegateClass MonoClass representing the delegate type
   * @param target Target object instance (null for static methods)
   * @param method MonoMethod or method pointer to bind
   * @returns New MonoDelegate instance
   *
   * @example
   * ```typescript
   * // Create delegate for static method
   * const delegate = MonoDelegate.create(api, actionClass, null, staticMethod);
   *
   * // Create delegate for instance method
   * const delegate = MonoDelegate.create(api, actionClass, targetInstance, instanceMethod);
   * ```
   */
  static create(
    api: MonoApi,
    delegateClass: MonoClass,
    target: MonoObject | NativePointer | null,
    method: MonoMethod | NativePointer,
  ): MonoDelegate {
    const instance = delegateClass.newObject(false);
    const methodPtr = method instanceof MonoMethod ? method.pointer : (method as NativePointer);
    const targetPtr = target instanceof MonoObject ? target.pointer : (target ?? NULL);
    const delegate = new MonoDelegate(api, instance.pointer);
    delegate.native.mono_delegate_ctor(instance.pointer, targetPtr, methodPtr);
    return delegate;
  }

  // ===== ACCESSOR PROPERTIES =====

  /**
   * Get the Invoke method for this delegate type
   */
  get invokeMethod(): MonoMethod {
    return this.getInvokeMethod();
  }

  /**
   * Get the native thunk pointer for direct invocation
   */
  get nativeThunk(): NativePointer {
    return this.getNativeThunk();
  }

  /**
   * Get the return type of this delegate
   */
  get returnType(): MonoType {
    return this.getInvokeMethod().getReturnType();
  }

  /**
   * Get the parameter types of this delegate
   */
  get parameterTypes(): MonoType[] {
    return this.getInvokeMethod().getParameterTypes();
  }

  /**
   * Get the number of parameters this delegate accepts
   */
  get parameterCount(): number {
    return this.getInvokeMethod().getParameterCount();
  }

  // ===== BASIC METHODS =====

  /**
   * Get the Invoke method for this delegate type.
   * The Invoke method defines the delegate's signature.
   *
   * @returns MonoMethod representing the Invoke method
   */
  getInvokeMethod(): MonoMethod {
    if (this.#invokeMethod) {
      return this.#invokeMethod;
    }
    const { invoke } = this.ensureInvokeData();
    this.#invokeMethod = new MonoMethod(this.api, invoke);
    return this.#invokeMethod;
  }

  /**
   * Get the native thunk pointer for this delegate.
   * The thunk is used for high-performance native invocation.
   *
   * @returns Native pointer to the delegate's thunk
   */
  getNativeThunk(): NativePointer {
    const { thunk } = this.ensureInvokeData();
    return thunk;
  }

  /**
   * Get the return type of this delegate's Invoke method.
   *
   * @returns MonoType representing the return type
   */
  getReturnType(): MonoType {
    return this.getInvokeMethod().getReturnType();
  }

  /**
   * Get the parameter types of this delegate's Invoke method.
   *
   * @returns Array of MonoType representing parameter types
   */
  getParameterTypes(): MonoType[] {
    return this.getInvokeMethod().getParameterTypes();
  }

  /**
   * Get the number of parameters this delegate accepts.
   *
   * @returns Number of parameters
   */
  getParameterCount(): number {
    return this.getInvokeMethod().getParameterCount();
  }

  // ===== INVOCATION METHODS =====

  /**
   * Invoke the delegate using managed invocation (safe mode).
   *
   * This method is safer than native invocation as it handles
   * type conversion and exception handling automatically.
   *
   * @param args Arguments to pass to the delegate
   * @param options Invocation options
   * @returns Result pointer from the delegate invocation
   * @throws MonoManagedExceptionError if the delegate throws and throwOnManagedException is true
   *
   * @example
   * ```typescript
   * // Invoke with no arguments
   * delegate.invokeManaged();
   *
   * // Invoke with arguments
   * delegate.invokeManaged([arg1, arg2]);
   *
   * // Invoke without throwing on managed exceptions
   * const result = delegate.invokeManaged([], { throwOnManagedException: false });
   * ```
   */
  invokeManaged(args: MonoArg[] = [], options: DelegateInvokeOptions = {}): NativePointer {
    const { invoke } = this.ensureInvokeData();
    const prepared = args.map(arg => this.api.prepareInvocationArgument(arg));
    try {
      return this.api.runtimeInvoke(invoke, this.pointer, prepared);
    } catch (error) {
      if (error instanceof MonoManagedExceptionError && options.throwOnManagedException === false) {
        return NULL;
      }
      throw error;
    }
  }

  /**
   * Compiles a native thunk for high-performance delegate invocation.
   *
   * SAFETY WARNING: Incorrect return/argument types will crash the target process.
   * Ensure types match the delegate's Invoke method signature exactly.
   * The calling convention must match the target platform (cdecl, stdcall, etc.).
   *
   * Use invokeManaged() if unsure about ABI compatibility - it's safer but slower.
   *
   * @param returnType Native return type (e.g., "void", "int", "pointer")
   * @param argTypes Array of native argument types. First arg is always the delegate instance pointer.
   * @param cache Whether to cache the compiled thunk (default: true)
   * @returns Compiled native function ready for high-frequency invocation
   *
   * @example
   * // For Action<string> delegate (void Invoke(string)):
   * const thunk = delegate.compileNative<NativeFunction<"void", ["pointer", "pointer"]>>(
   *   "void",
   *   ["pointer", "pointer"] // this (delegate) + string parameter
   * );
   * thunk(delegate.pointer, stringPtr);
   *
   * @example
   * // For Func<int, bool> delegate (bool Invoke(int)):
   * const thunk = delegate.compileNative<NativeFunction<"bool", ["pointer", "int"]>>(
   *   "bool",
   *   ["pointer", "int"] // this (delegate) + int parameter
   * );
   * const result = thunk(delegate.pointer, 42);
   */
  compileNative<T extends AnyNativeFunction = AnyNativeFunction>(
    returnType: NativeFunctionReturnType,
    argTypes: NativeFunctionArgumentType[],
    cacheOrOptions: boolean | CompileNativeOptions = true,
  ): T {
    const options: CompileNativeOptions =
      typeof cacheOrOptions === "boolean" ? { cache: cacheOrOptions } : cacheOrOptions;
    const { cache = true, validateAbi = true } = options;

    const cacheKey = `${returnType}->${argTypes.join(",")}`;
    if (cache) {
      const cached = this.#nativeFunctions.get(cacheKey);
      if (cached) {
        return cached as T;
      }
    }

    // Perform ABI validation if enabled
    if (validateAbi) {
      const validation = this.validateAbi(returnType, argTypes);
      if (!validation.valid) {
        const errorMsg =
          `ABI validation failed for delegate compilation:\n` +
          `  Errors: ${validation.errors.join("; ")}\n` +
          `  Expected signature: ${validation.expectedSignature.returnType}(${validation.expectedSignature.argTypes.join(", ")})`;
        throw new Error(errorMsg);
      }
      if (validation.warnings.length > 0) {
        delegateLogger.warn(`ABI warnings: ${validation.warnings.join("; ")}`);
      }
    }

    const { thunk } = this.ensureInvokeData();
    const nativeFn = new NativeFunction<any, any[]>(thunk, returnType as any, argTypes as any[]) as T;
    if (cache) {
      this.#nativeFunctions.set(cacheKey, nativeFn);
    }
    return nativeFn;
  }

  /**
   * Validates that the provided native types match the delegate's managed signature.
   * Call this before compileNative to check for ABI mismatches.
   *
   * @param returnType The native return type to validate
   * @param argTypes The native argument types to validate (first should be "pointer" for delegate instance)
   * @returns Validation result with errors and warnings
   */
  validateAbi(returnType: NativeFunctionReturnType, argTypes: NativeFunctionArgumentType[]): AbiValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const invokeMethod = this.getInvokeMethod();
    const managedReturnType = invokeMethod.getReturnType();
    const managedParamTypes = invokeMethod.getParameterTypes();

    // Build expected signature
    const expectedReturnType = monoTypeToNativeType(managedReturnType);
    const expectedArgTypes: string[] = ["pointer"]; // First arg is always delegate instance
    for (const paramType of managedParamTypes) {
      expectedArgTypes.push(monoTypeToNativeType(paramType));
    }

    // Validate return type
    if (!isCompatibleNativeType(returnType, expectedReturnType)) {
      errors.push(
        `Return type mismatch: provided '${returnType}', expected '${expectedReturnType}' ` +
          `(managed type: ${managedReturnType.getName()})`,
      );
    }

    // Validate argument count
    const expectedArgCount = managedParamTypes.length + 1; // +1 for delegate instance
    if (argTypes.length !== expectedArgCount) {
      errors.push(
        `Argument count mismatch: provided ${argTypes.length}, expected ${expectedArgCount} ` +
          `(1 delegate instance + ${managedParamTypes.length} parameters)`,
      );
    }

    // Validate first argument (delegate instance)
    if (argTypes.length > 0 && argTypes[0] !== "pointer") {
      errors.push(`First argument must be 'pointer' (delegate instance), got '${argTypes[0]}'`);
    }

    // Validate parameter types
    const minLen = Math.min(argTypes.length - 1, managedParamTypes.length);
    for (let i = 0; i < minLen; i++) {
      const providedType = argTypes[i + 1];
      const managedType = managedParamTypes[i];
      const expectedType = monoTypeToNativeType(managedType);

      if (!isCompatibleNativeType(providedType, expectedType)) {
        errors.push(
          `Parameter ${i} type mismatch: provided '${providedType}', expected '${expectedType}' ` +
            `(managed type: ${managedType.getName()})`,
        );
      }
    }

    // Check for value types passed by value (potential issue)
    for (let i = 0; i < managedParamTypes.length; i++) {
      const managedType = managedParamTypes[i];
      if (managedType.isValueType() && !managedType.isByRef()) {
        const kind = managedType.getKind();
        // Large structs should be warned about
        if (kind === MonoTypeKind.ValueType) {
          warnings.push(
            `Parameter ${i} is a struct type (${managedType.getName()}). ` +
              `Ensure calling convention handles struct passing correctly.`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      expectedSignature: {
        returnType: expectedReturnType,
        argTypes: expectedArgTypes,
      },
    };
  }

  /**
   * Get the expected native signature for this delegate.
   * Useful for understanding what types to pass to compileNative.
   */
  getExpectedNativeSignature(): { returnType: string; argTypes: string[] } {
    const invokeMethod = this.getInvokeMethod();
    const managedReturnType = invokeMethod.getReturnType();
    const managedParamTypes = invokeMethod.getParameterTypes();

    return {
      returnType: monoTypeToNativeType(managedReturnType),
      argTypes: ["pointer", ...managedParamTypes.map(monoTypeToNativeType)],
    };
  }

  /**
   * Cleans up cached native functions and invoke data.
   * Should be called when the delegate is no longer needed.
   */
  dispose(): void {
    this.#nativeFunctions.clear();
    this.#invokePtr = null;
    this.#thunkPtr = null;
  }

  /**
   * Get the invocation list of this delegate (for multicast delegates).
   * For a non-multicast delegate, returns an array containing only this delegate.
   * For a multicast delegate, returns all delegates in the invocation list.
   *
   * @returns Array of MonoDelegate instances in the invocation list
   */
  getInvocationList(): MonoDelegate[] {
    // Try to call GetInvocationList() managed method
    const klass = this.getClass();
    const getInvocationListMethod = klass.tryGetMethod("GetInvocationList", 0);

    if (!getInvocationListMethod) {
      // Method not found - return self as single-element array
      return [this];
    }

    try {
      // Invoke GetInvocationList() which returns Delegate[]
      const resultPtr = this.api.runtimeInvoke(getInvocationListMethod.pointer, this.pointer, []);

      if (resultPtr.isNull()) {
        return [this];
      }

      // Parse the returned array
      const delegates: MonoDelegate[] = [];
      const arrayLength = this.native.mono_array_length(resultPtr) as number;

      for (let i = 0; i < arrayLength; i++) {
        const elementPtr = this.native.mono_array_addr_with_size(resultPtr, Process.pointerSize, i);
        const delegatePtr = elementPtr.readPointer();
        if (!delegatePtr.isNull()) {
          delegates.push(new MonoDelegate(this.api, delegatePtr));
        }
      }

      return delegates.length > 0 ? delegates : [this];
    } catch (error) {
      // If invocation fails, return self
      delegateLogger.warn(`getInvocationList failed: ${error}`);
      return [this];
    }
  }

  /**
   * Check if this delegate is a multicast delegate (has multiple invocation targets).
   *
   * @returns true if this is a multicast delegate with multiple targets
   */
  isMulticast(): boolean {
    return this.getInvocationList().length > 1;
  }

  /**
   * Get the number of delegates in the invocation list.
   *
   * @returns Number of delegates (1 for simple delegates, >1 for multicast)
   */
  getInvocationCount(): number {
    return this.getInvocationList().length;
  }

  // ===== TARGET AND METHOD INFO =====

  /**
   * Get information about the delegate's target and method.
   *
   * @returns DelegateTargetInfo with target and method details
   */
  getTargetInfo(): DelegateTargetInfo {
    const klass = this.getClass();
    let target: MonoObject | null = null;
    let method: MonoMethod | null = null;
    let hasTarget = false;

    // Try to get _target field (internal delegate implementation)
    try {
      const targetField = klass.tryGetField("_target") || klass.tryGetField("m_target");
      if (targetField) {
        const targetPtr = targetField.getValue(this);
        if (targetPtr && !targetPtr.isNull()) {
          hasTarget = true;
          target = new MonoObject(this.api, targetPtr);
        }
      }
    } catch {
      // Ignore field access errors
    }

    // Get the Invoke method
    method = this.getInvokeMethod();

    return { hasTarget, target, method };
  }

  /**
   * Check if this delegate has a target instance (instance method delegate).
   *
   * @returns true if delegate targets an instance method
   */
  hasTarget(): boolean {
    return this.getTargetInfo().hasTarget;
  }

  // ===== METADATA AND REFLECTION =====

  /**
   * Get comprehensive summary information about this delegate.
   *
   * @returns MonoDelegateSummary with detailed delegate information
   *
   * @example
   * ```typescript
   * const summary = delegate.getSummary();
   * console.log(`Delegate: ${summary.fullTypeName}`);
   * console.log(`Parameters: ${summary.parameterCount}`);
   * console.log(`Returns: ${summary.returnTypeName}`);
   * ```
   */
  getSummary(): MonoDelegateSummary {
    const klass = this.getClass();
    const invokeMethod = this.getInvokeMethod();
    const returnType = invokeMethod.getReturnType();
    const parameterTypes = invokeMethod.getParameterTypes();
    const nativeSignature = this.getExpectedNativeSignature();
    const targetInfo = this.getTargetInfo();

    return {
      typeName: klass.getName(),
      fullTypeName: klass.getFullName(),
      isMulticast: this.isMulticast(),
      invocationCount: this.getInvocationCount(),
      returnTypeName: returnType.getName(),
      parameterTypeNames: parameterTypes.map(t => t.getName()),
      parameterCount: parameterTypes.length,
      hasTarget: targetInfo.hasTarget,
      nativeSignature,
    };
  }

  /**
   * Get a human-readable description of this delegate.
   *
   * @returns Formatted delegate signature string
   *
   * @example
   * ```typescript
   * // Returns: "Action<String, Int32>(String, Int32) -> Void"
   * // Returns: "Func<Int32>(Int32) -> Boolean [multicast: 3]"
   * ```
   */
  describe(): string {
    const klass = this.getClass();
    const invokeMethod = this.getInvokeMethod();
    const returnType = invokeMethod.getReturnType();
    const parameterTypes = invokeMethod.getParameterTypes();

    const typeName = klass.getName();
    const params = parameterTypes.map(t => t.getName()).join(", ");
    const returnTypeName = returnType.getName();

    let description = `${typeName}(${params}) -> ${returnTypeName}`;

    const invocationCount = this.getInvocationCount();
    if (invocationCount > 1) {
      description += ` [multicast: ${invocationCount}]`;
    }

    return description;
  }

  /**
   * Get string representation of this delegate.
   *
   * @returns String in format "DelegateType(params) -> ReturnType"
   */
  override toString(): string {
    try {
      return this.describe();
    } catch {
      return `MonoDelegate(${this.pointer})`;
    }
  }

  // ===== PRIVATE METHODS =====

  private ensureInvokeData(): { invoke: NativePointer; thunk: NativePointer } {
    if (this.#invokePtr && this.#thunkPtr) {
      return { invoke: this.#invokePtr, thunk: this.#thunkPtr };
    }
    const klass = this.getClass();
    const { invoke, thunk } = this.api.getDelegateThunk(klass.pointer);
    this.#invokePtr = invoke;
    this.#thunkPtr = thunk;
    return { invoke, thunk };
  }
}

/**
 * Convert a MonoType to the corresponding native type string for Frida NativeFunction
 */
function monoTypeToNativeType(monoType: MonoType): string {
  return monoTypeKindToNative(monoType.getKind());
}

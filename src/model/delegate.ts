import { MonoApi, MonoArg, MonoManagedExceptionError } from "../runtime/api";
import { MonoClass } from "./class";
import { MonoMethod } from "./method";
import { MonoObject } from "./object";
import { MonoType, MonoTypeKind } from "./type";

type AnyNativeFunction = NativeFunction<any, any[]>;

export interface DelegateInvokeOptions {
  throwOnManagedException?: boolean;
}

export interface CompileNativeOptions {
  /** Whether to cache the compiled thunk (default: true) */
  cache?: boolean;
  /** Whether to validate ABI compatibility (default: true). Set to false to skip validation for performance. */
  validateAbi?: boolean;
}

export interface AbiValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  expectedSignature: {
    returnType: string;
    argTypes: string[];
  };
}

/**
 * Maps MonoTypeKind to expected Frida NativeFunctionReturnType
 */
const MONO_TO_NATIVE_TYPE_MAP: Partial<Record<MonoTypeKind, NativeFunctionReturnType | NativeFunctionArgumentType>> = {
  [MonoTypeKind.Void]: "void",
  [MonoTypeKind.Boolean]: "bool",
  [MonoTypeKind.Char]: "uint16",
  [MonoTypeKind.I1]: "int8",
  [MonoTypeKind.U1]: "uint8",
  [MonoTypeKind.I2]: "int16",
  [MonoTypeKind.U2]: "uint16",
  [MonoTypeKind.I4]: "int32",
  [MonoTypeKind.U4]: "uint32",
  [MonoTypeKind.I8]: "int64",
  [MonoTypeKind.U8]: "uint64",
  [MonoTypeKind.R4]: "float",
  [MonoTypeKind.R8]: "double",
  [MonoTypeKind.String]: "pointer",
  [MonoTypeKind.Pointer]: "pointer",
  [MonoTypeKind.ByRef]: "pointer",
  [MonoTypeKind.Class]: "pointer",
  [MonoTypeKind.Object]: "pointer",
  [MonoTypeKind.Array]: "pointer",
  [MonoTypeKind.SingleDimArray]: "pointer",
  [MonoTypeKind.GenericInstance]: "pointer",
  [MonoTypeKind.ValueType]: "pointer", // Value types are passed by pointer in managed calls
  [MonoTypeKind.Int]: "pointer", // IntPtr
  [MonoTypeKind.UInt]: "pointer", // UIntPtr
};

export interface DelegateInvokeOptions {
  throwOnManagedException?: boolean;
}

/**
 * Wrapper for Mono delegate objects with managed and native invocation support.
 * Provides both safe managed invocation and high-performance native thunk compilation.
 */
export class MonoDelegate extends MonoObject {
  #invokePtr: NativePointer | null = null;
  #thunkPtr: NativePointer | null = null;
  #nativeFunctions = new Map<string, AnyNativeFunction>();

  /**
   * Creates a new delegate instance bound to a target and method.
   *
   * @param api MonoApi instance
   * @param delegateClass MonoClass representing the delegate type
   * @param target Target object instance (null for static methods)
   * @param method MonoMethod or method pointer to bind
   * @returns New MonoDelegate instance
   */
  static create(api: MonoApi, delegateClass: MonoClass, target: MonoObject | NativePointer | null, method: MonoMethod | NativePointer): MonoDelegate {
    const instance = delegateClass.newObject(false);
    const methodPtr = method instanceof MonoMethod ? method.pointer : (method as NativePointer);
    const targetPtr = target instanceof MonoObject ? target.pointer : (target ?? NULL);
    const delegate = new MonoDelegate(api, instance.pointer);
    delegate.native.mono_delegate_ctor(instance.pointer, targetPtr, methodPtr);
    return delegate;
  }

  getInvokeMethod(): MonoMethod {
    const { invoke } = this.ensureInvokeData();
    return new MonoMethod(this.api, invoke);
  }

  getNativeThunk(): NativePointer {
    const { thunk } = this.ensureInvokeData();
    return thunk;
  }

  invokeManaged(args: MonoArg[] = [], options: DelegateInvokeOptions = {}): NativePointer {
    const { invoke } = this.ensureInvokeData();
    const prepared = args.map((arg) => prepareDelegateArgument(this.api, arg));
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
    const options: CompileNativeOptions = typeof cacheOrOptions === 'boolean' 
      ? { cache: cacheOrOptions } 
      : cacheOrOptions;
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
        const errorMsg = `ABI validation failed for delegate compilation:\n` +
          `  Errors: ${validation.errors.join('; ')}\n` +
          `  Expected signature: ${validation.expectedSignature.returnType}(${validation.expectedSignature.argTypes.join(', ')})`;
        throw new Error(errorMsg);
      }
      if (validation.warnings.length > 0) {
        console.warn(`[MonoDelegate] ABI warnings: ${validation.warnings.join('; ')}`);
      }
    }

    const { thunk } = this.ensureInvokeData();
    const nativeFn = new NativeFunction<any, any[]>(
      thunk,
      returnType as any,
      argTypes as any[],
    ) as T;
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
  validateAbi(
    returnType: NativeFunctionReturnType,
    argTypes: NativeFunctionArgumentType[]
  ): AbiValidationResult {
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
        `(managed type: ${managedReturnType.getName()})`
      );
    }
    
    // Validate argument count
    const expectedArgCount = managedParamTypes.length + 1; // +1 for delegate instance
    if (argTypes.length !== expectedArgCount) {
      errors.push(
        `Argument count mismatch: provided ${argTypes.length}, expected ${expectedArgCount} ` +
        `(1 delegate instance + ${managedParamTypes.length} parameters)`
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
          `(managed type: ${managedType.getName()})`
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
            `Ensure calling convention handles struct passing correctly.`
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
      console.warn(`[MonoDelegate] getInvocationList failed: ${error}`);
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

function prepareDelegateArgument(api: MonoApi, arg: MonoArg): NativePointer {
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

/**
 * Convert a MonoType to the corresponding native type string for Frida NativeFunction
 */
function monoTypeToNativeType(monoType: MonoType): string {
  const kind = monoType.getKind();
  
  // Check the mapping first
  const mapped = MONO_TO_NATIVE_TYPE_MAP[kind];
  if (mapped !== undefined) {
    return mapped as string;
  }
  
  // For unknown types, default to pointer (safest assumption for references)
  return "pointer";
}

/**
 * Check if two native types are compatible
 */
function isCompatibleNativeType(
  provided: NativeFunctionReturnType | NativeFunctionArgumentType,
  expected: string
): boolean {
  // Exact match
  if (provided === expected) {
    return true;
  }
  
  // Compatible aliases
  const aliases: Record<string, string[]> = {
    "int": ["int32"],
    "int32": ["int"],
    "uint": ["uint32"],
    "uint32": ["uint"],
    "long": ["int64"],
    "int64": ["long"],
    "ulong": ["uint64"],
    "uint64": ["ulong"],
    "pointer": ["void*"],
    "void*": ["pointer"],
  };
  
  const providedAliases = aliases[provided as string] || [];
  if (providedAliases.includes(expected)) {
    return true;
  }
  
  // Pointer types are compatible with each other
  const isPointerType = (t: string) => 
    ["pointer", "void*"].includes(t) || t.endsWith("*");
  
  if (isPointerType(provided as string) && isPointerType(expected)) {
    return true;
  }
  
  return false;
}

import { MonoApi } from "../runtime/api";
import { MonoErrorCodes, raise } from "../utils/errors";
import { isValidPointer, pointerIsNull } from "../utils/memory";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents any value that can be used in custom attributes.
 * Includes primitive types, strings, arrays, and type references.
 */
export type AttributeValue =
  | string
  | number
  | boolean
  | null
  | AttributeValue[]
  | { type: string; value: AttributeValue };

/**
 * Custom attribute information.
 * Represents metadata attached to assemblies, classes, methods, fields, and properties.
 *
 * @example
 * ```typescript
 * const attributes = method.getCustomAttributes();
 * for (const attr of attributes) {
 *   console.log(`${attr.name}: ${attr.type}`);
 * }
 * ```
 */
export interface CustomAttribute {
  /** Short name of the attribute class */
  name: string;
  /** Full type name including namespace */
  type: string;
  /** Arguments passed to the attribute constructor */
  constructorArguments: AttributeValue[];
  /** Named properties set on the attribute */
  properties: Record<string, AttributeValue>;
}

/**
 * Common accessibility levels for Mono members.
 * Matches C# accessibility modifiers.
 */
export type MemberAccessibility =
  | "private-scope" // FamANDAssem - Not accessible outside the type
  | "private" // Private - Only accessible within the declaring type
  | "protected-and-internal" // FamANDAssem - Protected AND internal
  | "internal" // Assembly - Only accessible within the same assembly
  | "protected" // Family - Accessible to derived types
  | "protected-internal" // FamORAssem - Protected OR internal
  | "public"; // Public - Accessible everywhere

/**
 * Interface for objects that have a native pointer.
 * Used for type checking in comparison operations.
 */
export interface HasPointer {
  pointer: NativePointer;
}

/**
 * Base class for all Mono handles.
 *
 * Provides automatic thread-safe access to native API and common handle operations.
 * Individual methods don't need to worry about thread attachment.
 *
 * @typeParam THandle The native pointer type (defaults to NativePointer)
 *
 * @example
 * ```typescript
 * class MyMonoType extends MonoHandle {
 *   // Automatically has access to:
 *   // - this.api (Mono API)
 *   // - this.native (thread-safe native calls)
 *   // - this.pointer (native pointer)
 * }
 * ```
 */
export abstract class MonoHandle<THandle extends NativePointer = NativePointer> {
  private _native: any = null;

  /**
   * Create a new Mono handle.
   * @param _api Mono API instance
   * @param handle Native pointer handle
   * @throws {MonoValidationError} If handle is null or invalid
   */
  constructor(
    protected readonly _api: MonoApi,
    protected readonly handle: THandle,
  ) {
    if (!isValidPointer(handle)) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `${this.constructor.name} received a NULL or invalid handle`,
        "Ensure the native pointer is valid before creating a handle",
      );
    }
  }

  // ===== CORE PROPERTIES =====

  /**
   * Get the Mono API instance.
   * Provides access to all Mono runtime operations.
   */
  get api(): MonoApi {
    return this._api;
  }

  /**
   * Get thread-safe native API.
   * All calls are automatically wrapped with thread attachment when needed.
   * Avoids nested attachments by checking if already in attached context.
   */
  protected get native(): any {
    if (!this._native) {
      this._native = this._api.native;
    }
    return this._native;
  }

  /**
   * Get the native pointer handle.
   * Direct access to the underlying Mono object pointer.
   */
  get pointer(): THandle {
    return this.handle;
  }

  // ===== VALIDATION METHODS =====

  /**
   * Check if this handle is valid (not null).
   * @returns True if the pointer is valid
   */
  isValid(): boolean {
    return isValidPointer(this.pointer);
  }

  // ===== COMPARISON METHODS =====

  /**
   * Check if this handle points to the same object as another.
   * Compares the underlying native pointers.
   * Note: Subclasses may override this for semantic equality.
   *
   * @param other Another MonoHandle to compare with (can be null or a subclass type)
   * @returns True if both handles point to the same native object
   *
   * @example
   * ```typescript
   * if (handle1.equals(handle2)) {
   *   console.log("Same object");
   * }
   * ```
   */
  equals(other: HasPointer | null | undefined): boolean {
    if (!other || !other.pointer) return false;
    return this.pointer.equals(other.pointer);
  }

  /**
   * Try to check equality without throwing.
   * @param other Another MonoHandle to compare with
   * @returns True if equal, false if not equal or comparison fails
   */
  tryEquals(other: HasPointer | null | undefined): boolean {
    try {
      return this.equals(other);
    } catch {
      return false;
    }
  }

  /**
   * Get the hash code for this handle.
   * Based on the pointer address, suitable for use in hash tables.
   * @returns Hash code as a 32-bit integer
   */
  getHashCode(): number {
    return this.pointer.toInt32();
  }

  // ===== UTILITY METHODS =====

  /**
   * Get string representation for debugging.
   * Subclasses may override to provide more specific information.
   * @returns Concise string like "MonoClass(0x12345678)"
   */
  toString(): string {
    return `${this.constructor.name}(${this.pointer})`;
  }
}

/**
 * Generic lazy reference wrapper for Mono objects.
 *
 * Provides deferred object creation with caching. The factory function
 * is only called once, on first access, and the result is cached.
 *
 * @typeParam T The MonoHandle type being referenced
 *
 * @example
 * ```typescript
 * const classRef = new MonoReference(() => {
 *   // Expensive operation only runs once
 *   return assembly.class("MyClass");
 * });
 *
 * // First access triggers factory
 * const cls1 = classRef.value;
 *
 * // Subsequent accesses use cached value
 * const cls2 = classRef.value; // Same instance
 *
 * // Reset to re-run factory on next access
 * classRef.reset();
 * ```
 */
export class MonoReference<T extends MonoHandle> {
  private _value: T | null = null;
  private readonly _factory: () => T;

  /**
   * Create a new lazy reference.
   * @param factory Factory function that creates the referenced object
   */
  constructor(factory: () => T) {
    this._factory = factory;
  }

  // ===== CORE PROPERTIES =====

  /**
   * Get the referenced value.
   * Triggers factory on first access, then caches the result.
   * @returns The referenced MonoHandle instance
   * @throws If factory function throws
   */
  get value(): T {
    if (!this._value) {
      this._value = this._factory();
    }
    return this._value;
  }

  // ===== VALIDATION METHODS =====

  /**
   * Check if reference has been resolved.
   * @returns True if the value has been created and cached
   */
  get isResolved(): boolean {
    return this._value !== null;
  }

  /**
   * Check if reference is valid (can be resolved without error).
   * @returns True if the reference can be successfully resolved
   */
  get isValid(): boolean {
    try {
      return this.value !== null && this.value.isValid();
    } catch {
      return false;
    }
  }

  // ===== RESOLUTION METHODS =====

  /**
   * Resolve the reference (alias for value getter).
   * @returns The referenced MonoHandle instance
   * @throws If factory function throws
   */
  resolve(): T {
    return this.value;
  }

  /**
   * Try to resolve the reference without throwing.
   * @returns The referenced object if successful, null otherwise
   *
   * @example
   * ```typescript
   * const obj = ref.tryResolve();
   * if (obj) {
   *   console.log("Resolution succeeded");
   * }
   * ```
   */
  tryResolve(): T | null {
    try {
      return this.value;
    } catch {
      return null;
    }
  }

  // ===== CACHE MANAGEMENT =====

  /**
   * Clear the cached value.
   * Next access will re-run the factory function.
   *
   * @example
   * ```typescript
   * ref.reset(); // Clear cache
   * const newValue = ref.value; // Factory runs again
   * ```
   */
  reset(): void {
    this._value = null;
  }

  /**
   * Force immediate resolution and caching.
   * Useful for pre-warming caches.
   * @returns The resolved value
   */
  preload(): T {
    return this.value;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get string representation.
   * @returns Description string
   */
  toString(): string {
    if (this._value) {
      return `MonoReference(resolved: ${this._value})`;
    }
    return "MonoReference(unresolved)";
  }

  /**
   * Get JSON-friendly representation.
   * @returns Object with reference state
   */
  toJSON(): MonoReferenceJSON {
    let value: unknown = null;
    if (this._value) {
      const v = this._value as unknown;
      if (
        typeof v === "object" &&
        v !== null &&
        "toJSON" in v &&
        typeof (v as { toJSON: unknown }).toJSON === "function"
      ) {
        value = (v as { toJSON(): unknown }).toJSON();
      } else {
        value = this._value;
      }
    }
    return {
      isResolved: this.isResolved,
      value,
    };
  }
}

/**
 * JSON representation of MonoReference.
 */
export interface MonoReferenceJSON {
  isResolved: boolean;
  value: unknown;
}

/**
 * Method argument type for Mono method invocations.
 * Supports all common .NET types that can be passed as arguments.
 */
export type MethodArgument = NativePointer | number | boolean | string | bigint | null | undefined;

/**
 * Parse custom attributes from a MonoCustomAttrInfo pointer.
 * This is a shared utility used by MonoAssembly, MonoClass, MonoMethod, MonoField, and MonoProperty.
 *
 * MonoCustomAttrInfo structure:
 * - int num_attrs (offset 0)
 * - int cached (offset 4)
 * - MonoImage* image (offset 8)
 * - MonoCustomAttrEntry attrs[] (offset 16)
 *
 * MonoCustomAttrEntry structure (24 bytes):
 * - MonoMethod* ctor (offset 0)
 * - uint32 data_size (offset 8)
 * - const byte* data (offset 16)
 *
 * @param api The MonoApi instance
 * @param customAttrInfoPtr Pointer to MonoCustomAttrInfo structure
 * @param getClassName Function to get class name from class pointer
 * @param getClassFullName Function to get full class name from class pointer
 * @returns Array of CustomAttribute objects
 *
 * @example
 * ```typescript
 * const attributes = parseCustomAttributes(
 *   api,
 *   customAttrInfoPtr,
 *   (classPtr) => api.native.mono_class_get_name(classPtr).readUtf8String(),
 *   (classPtr) => {
 *     const namespace = api.native.mono_class_get_namespace(classPtr).readUtf8String();
 *     const name = api.native.mono_class_get_name(classPtr).readUtf8String();
 *     return namespace ? `${namespace}.${name}` : name;
 *   }
 * );
 * ```
 */
export function parseCustomAttributes(
  api: MonoApi,
  customAttrInfoPtr: NativePointer,
  getClassName: (classPtr: NativePointer) => string,
  getClassFullName: (classPtr: NativePointer) => string,
): CustomAttribute[] {
  const attributes: CustomAttribute[] = [];

  // Early return for null pointer
  if (pointerIsNull(customAttrInfoPtr)) {
    return attributes;
  }

  try {
    // Read number of attributes at offset 0
    const numAttrs = customAttrInfoPtr.readInt();

    // Constants for memory layout
    const ENTRY_SIZE = 24; // sizeof(MonoCustomAttrEntry)
    const ATTRS_BASE_OFFSET = 16; // offset of attrs[] in MonoCustomAttrInfo

    // Read each attribute entry
    for (let i = 0; i < numAttrs; i++) {
      try {
        const entryPtr = customAttrInfoPtr.add(ATTRS_BASE_OFFSET + i * ENTRY_SIZE);
        const ctorPtr = entryPtr.readPointer();

        if (!pointerIsNull(ctorPtr)) {
          // Get the declaring class of the constructor to determine attribute type
          const declClassPtr = api.native.mono_method_get_class(ctorPtr);

          if (!pointerIsNull(declClassPtr)) {
            // Note: Parsing constructor arguments and properties from the blob data
            // requires complex binary deserialization of custom attribute encoding.
            // This is left empty for now as it requires significant implementation.
            const attr: CustomAttribute = {
              name: getClassName(declClassPtr),
              type: getClassFullName(declClassPtr),
              constructorArguments: [], // TODO: Parse blob data
              properties: {}, // TODO: Parse named properties from blob
            };

            attributes.push(attr);
          }
        }
      } catch {
        // Skip invalid attribute entries silently
        // Individual attribute parsing failures shouldn't break the entire operation
        continue;
      }
    }
  } finally {
    // Clean up: Free the custom attrs info if it's not cached
    // The cached flag at offset 4 indicates if Mono is managing the lifetime
    try {
      const cached = customAttrInfoPtr.add(4).readInt();
      if (cached === 0 && api.hasExport("mono_custom_attrs_free")) {
        api.native.mono_custom_attrs_free(customAttrInfoPtr);
      }
    } catch {
      // Ignore cleanup errors - Mono may have already freed the memory
    }
  }

  return attributes;
}

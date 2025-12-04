import { MonoApi } from "../runtime/api";
import { isValidPointer, pointerIsNull } from "../utils/memory";
import { MonoError } from "../utils/errors";

/**
 * Custom attribute information
 */
export interface CustomAttribute {
  name: string;
  type: string;
  constructorArguments: any[];
  properties: Record<string, any>;
}

/**
 * Common accessibility levels for Mono members
 */
export type MemberAccessibility =
  | "private-scope"
  | "private"
  | "protected-and-internal"
  | "internal"
  | "protected"
  | "protected-internal"
  | "public";

/**
 * Base class for all Mono handles
 *
 * Provides automatic thread-safe access to native API.
 * Individual methods don't need to worry about thread attachment.
 */
export abstract class MonoHandle<THandle extends NativePointer = NativePointer> {
  private _native: any = null;

  constructor(
    protected readonly _api: MonoApi,
    protected readonly handle: THandle,
  ) {
    if (!isValidPointer(handle)) {
      throw new MonoError(`${this.constructor.name} received a NULL handle.`, "Handle Creation", undefined);
    }
  }

  /**
   * Get the Mono API instance
   */
  get api(): MonoApi {
    return this._api;
  }

  /**
   * Get thread-safe native API
   * All calls are automatically wrapped with thread attachment when needed
   * Avoids nested attachments by checking if already in attached context
   */
  protected get native(): any {
    if (!this._native) {
      this._native = this._api.native;
    }
    return this._native;
  }

  /**
   * Get the native pointer handle
   */
  get pointer(): THandle {
    return this.handle;
  }

  /**
   * Check if this handle points to the same object as another
   */
  equals(other: MonoHandle<THandle>): boolean {
    return (this.pointer as any).toInt32() === (other.pointer as any).toInt32();
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `${this.constructor.name}(${this.pointer})`;
  }
}

/**
 * Generic reference wrapper for Mono objects
 */
export class MonoReference<T extends MonoHandle> {
  private _value: T | null = null;
  private readonly _factory: () => T;

  constructor(factory: () => T) {
    this._factory = factory;
  }

  /**
   * Get the referenced value
   */
  get value(): T {
    if (!this._value) {
      this._value = this._factory();
    }
    return this._value;
  }

  /**
   * Check if reference is valid (not null)
   */
  get isValid(): boolean {
    try {
      return this.value !== null;
    } catch {
      return false;
    }
  }

  /**
   * Resolve the reference
   */
  resolve(): T {
    return this.value;
  }

  /**
   * Clear the cached value
   */
  reset(): void {
    this._value = null;
  }
}

/**
 * Method argument type
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
 */
export function parseCustomAttributes(
  api: MonoApi,
  customAttrInfoPtr: NativePointer,
  getClassName: (classPtr: NativePointer) => string,
  getClassFullName: (classPtr: NativePointer) => string,
): CustomAttribute[] {
  const attributes: CustomAttribute[] = [];

  if (pointerIsNull(customAttrInfoPtr)) {
    return attributes;
  }

  try {
    const numAttrs = customAttrInfoPtr.readInt();

    // Read each attribute entry
    const entrySize = 24; // sizeof(MonoCustomAttrEntry)
    const attrsBaseOffset = 16; // offset of attrs[] in MonoCustomAttrInfo

    for (let i = 0; i < numAttrs; i++) {
      try {
        const entryPtr = customAttrInfoPtr.add(attrsBaseOffset + i * entrySize);
        const ctorPtr = entryPtr.readPointer();

        if (!pointerIsNull(ctorPtr)) {
          // Get the declaring class of the constructor to determine attribute type
          const declClassPtr = api.native.mono_method_get_class(ctorPtr);

          if (!pointerIsNull(declClassPtr)) {
            const attr: CustomAttribute = {
              name: getClassName(declClassPtr),
              type: getClassFullName(declClassPtr),
              constructorArguments: [], // Parsing blob data is complex
              properties: {},
            };

            attributes.push(attr);
          }
        }
      } catch {
        // Skip invalid attribute entries
        continue;
      }
    }
  } finally {
    // Free the custom attrs info if it's not cached
    // Check cached flag at offset 4
    const cached = customAttrInfoPtr.add(4).readInt();
    if (cached === 0 && api.hasExport("mono_custom_attrs_free")) {
      api.native.mono_custom_attrs_free(customAttrInfoPtr);
    }
  }

  return attributes;
}

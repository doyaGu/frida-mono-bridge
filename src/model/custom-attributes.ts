/**
 * Custom Attributes Helper Module
 *
 * Provides unified custom attribute retrieval for all Mono model types.
 * Eliminates the repeated "hasExport + try/catch + parseCustomAttributes"
 * pattern across class.ts, field.ts, method.ts, property.ts, and assembly.ts.
 *
 * @module model/custom-attributes
 */

import type { MonoApi } from "../runtime/api";
import type { CustomAttribute } from "./base";
import { parseCustomAttributes } from "./base";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context for retrieving custom attributes from different Mono types.
 * Each model type provides its own context with the appropriate API call.
 */
export interface CustomAttributeContext {
  /** The MonoApi instance */
  api: MonoApi;
  /** Name of the mono_custom_attrs_from_* export to check */
  exportName: string;
  /** Function that retrieves the MonoCustomAttrInfo pointer */
  getAttrInfoPtr: () => NativePointer;
}

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Retrieve custom attributes using a unified pattern.
 *
 * This function consolidates the common pattern used across all model types:
 * 1. Check if the required API export exists
 * 2. Try to get the custom attribute info pointer
 * 3. Parse the attributes using parseCustomAttributes
 * 4. Return empty array on any failure
 *
 * @param context The custom attribute retrieval context
 * @param getClassName Function to get class name from class pointer
 * @param getClassFullName Function to get full class name from class pointer
 * @returns Array of CustomAttribute objects
 *
 * @example
 * ```typescript
 * // In MonoClass
 * get customAttributes(): CustomAttribute[] {
 *   return getCustomAttributes({
 *     api: this.api,
 *     exportName: "mono_custom_attrs_from_class",
 *     getAttrInfoPtr: () => this.native.mono_custom_attrs_from_class(this.pointer),
 *   });
 * }
 * ```
 */
export function getCustomAttributes(
  context: CustomAttributeContext,
  getClassName?: (classPtr: NativePointer) => string,
  getClassFullName?: (classPtr: NativePointer) => string,
): CustomAttribute[] {
  const { api, exportName, getAttrInfoPtr } = context;

  // Check if the required export exists
  if (!api.hasExport(exportName)) {
    return [];
  }

  try {
    const customAttrInfoPtr = getAttrInfoPtr();

    // Use default class name resolvers if not provided
    const resolveName =
      getClassName ??
      ((ptr: NativePointer) => {
        const { MonoClass: MonoClassCtor } = require("./class");
        return new MonoClassCtor(api, ptr).name;
      });

    const resolveFullName =
      getClassFullName ??
      ((ptr: NativePointer) => {
        const { MonoClass: MonoClassCtor } = require("./class");
        return new MonoClassCtor(api, ptr).fullName;
      });

    return parseCustomAttributes(api, customAttrInfoPtr, resolveName, resolveFullName);
  } catch {
    return [];
  }
}

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a custom attribute context for a MonoClass.
 */
export function createClassAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_class",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_class(classPtr),
  };
}

/**
 * Create a custom attribute context for a MonoMethod.
 */
export function createMethodAttributeContext(
  api: MonoApi,
  methodPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_method",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_method(methodPtr),
  };
}

/**
 * Create a custom attribute context for a MonoField.
 */
export function createFieldAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  fieldPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_field",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_field(classPtr, fieldPtr),
  };
}

/**
 * Create a custom attribute context for a MonoProperty.
 */
export function createPropertyAttributeContext(
  api: MonoApi,
  classPtr: NativePointer,
  propertyPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_property",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_property(classPtr, propertyPtr),
  };
}

/**
 * Create a custom attribute context for a MonoAssembly.
 */
export function createAssemblyAttributeContext(
  api: MonoApi,
  assemblyPtr: NativePointer,
  native: any,
): CustomAttributeContext {
  return {
    api,
    exportName: "mono_custom_attrs_from_assembly",
    getAttrInfoPtr: () => native.mono_custom_attrs_from_assembly(assemblyPtr),
  };
}

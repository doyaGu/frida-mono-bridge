/**
 * Model - Core Mono runtime object model and type system.
 *
 * Provides:
 * - Base classes and types (MonoHandle, MonoReference, CustomAttribute)
 * - Core Mono types (Assembly, Class, Domain, Image, Method, Field, Property)
 * - Object system (MonoObject, MonoString, MonoArray, MonoDelegate)
 * - Type system (MonoType, MonoTypeKind, type utilities)
 * - Collections and utilities (LazyCollection, indexing functions)
 * - Metadata access (MonoMetadataTable)
 *
 * @module model
 */

// ============================================================================
// BASE TYPES AND UTILITIES
// ============================================================================

export * from "./handle";
export * from "./reference";
export * from "./attribute";
export * from "./collections";

// ============================================================================
// CORE MONO TYPES (alphabetically ordered)
// ============================================================================

// Array
export { ArrayTypeGuards, MonoArray, MonoArraySummary } from "./array";

// Assembly
export { MonoAssembly as Assembly, MonoAssembly } from "./assembly";

// Class
export { MonoClass as Class, MonoClass, MonoClassSummary } from "./class";

// Delegate
export { MonoDelegate as Delegate, DelegateInvokeOptions, MonoDelegate, MonoDelegateSummary } from "./delegate";

// Domain
export { MonoDomain as Domain, MonoDomain, MonoDomainSummary } from "./domain";

// Field
export {
  MonoField as Field,
  FieldAccessibility,
  FieldAccessOptions,
  FieldReadOptions,
  MonoField,
  MonoFieldSummary,
} from "./field";

// Image
export { MonoImage as Image, MonoImage, MonoImageSummary } from "./image";

// Method
export { InvokeOptions, MonoMethod as Method, MethodAccessibility, MonoMethod, MonoMethodSummary } from "./method";

// Method Signature
export {
  MonoMethodSignature as MethodSignature,
  MonoCallConvention,
  MonoCallConventionModifier,
  MonoCallConventionModifiers,
  MonoMethodSignature,
  MonoParameterInfo,
} from "./method-signature";

// Object
export { MonoObject, MonoObject as Object } from "./object";

// Property
export { MonoProperty, MonoPropertySummary, MonoProperty as Property } from "./property";

// String
export { MonoString, MonoStringSummary } from "./string";

// Type System
export {
  // Type utilities
  getPrimitiveSize,
  isArrayKind,
  isCompatibleNativeType,
  isNumericKind,
  isPointerLikeKind,
  isPrimitiveKind,
  isValueTypeKind,
  MonoType,
  MonoTypeKind,
  monoTypeKindToNative,
  MonoTypeNameFormat,
  MonoTypeSummary,
  readPrimitiveValue,
  MonoType as Type,
  ValueReadOptions,
  writePrimitiveValue,
} from "./type";

// ============================================================================
// HELPERS (shared utilities for model types)
// ============================================================================

export {
  createAssemblyAttributeContext,
  createClassAttributeContext,
  createFieldAttributeContext,
  createMethodAttributeContext,
  createPropertyAttributeContext,
  getCustomAttributes,
  // Custom attributes
  type CustomAttributeContext,
} from "./attribute";

export {
  allocPrimitiveValue,
  convertJsToMono,
  convertMonoToJs,
  resolveInstance,
  resolveUnderlyingPrimitive,
  unboxValue,
  validateNumericValue,
  type ConversionOptions,
  // Value conversion
  type TypedReadOptions,
} from "./value-conversion";

// ============================================================================
// INTERNAL CALLS
// ============================================================================

export {
  createInternalCallRegistrar,
  DuplicatePolicy,
  InternalCallRegistrar,
  type InternalCallCallback,
  type InternalCallDefinition,
  type InternalCallRegistrarSummary,
  type InternalCallRegistrationInfo,
  type InternalCallRegistrationOptions,
} from "./internal-call";

// ============================================================================
// GARBAGE COLLECTION (Domain Objects)
// ============================================================================

export {
  // Domain object
  createGarbageCollector,
  GarbageCollector,
  // Types
  CollectionReport,
  DEFAULT_GC_CONFIG,
  FinalizationInfo,
  GarbageCollectorConfig,
  GenerationStats,
  HandleStats,
  MemoryStats,
  type CollectionEventCallback,
  type HandleEventCallback,
} from "./gc";

// ============================================================================
// TRACING (Domain Objects)
// ============================================================================

export {
  // Domain objects
  createPerformanceTracker,
  createTracer,
  PerformanceTracker,
  Tracer,
  // Types
  AccessTraceInfo,
  DEFAULT_TRACER_CONFIG,
  HookInfo,
  HookResult,
  HookStats,
  TracerConfig,
  type FieldAccessCallbacks,
  type MethodCallbacks,
  type MethodCallbacksExtended,
  type MethodCallbacksTimed,
  type MethodStats,
  type PropertyAccessCallbacks,
  type ReturnValueReplacer,
} from "./trace";

/**
 * Runtime Version Detection - Detect Mono runtime capabilities.
 *
 * Provides feature flag detection for the loaded Mono runtime:
 * - Delegate thunk support
 * - Metadata table access
 * - GC handle operations
 * - Internal call registration
 *
 * Different Mono versions (and Unity builds) may have varying
 * API availability. Use feature flags to adapt behavior.
 *
 * @module runtime/version
 */

import { MonoApi } from "./api";
import { MonoApiName } from "./exports";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Feature flags indicating available Mono capabilities.
 */
export interface MonoFeatureFlags {
  /** Whether delegate-to-native thunks are available */
  delegateThunk: boolean;
  /** Whether metadata table APIs are available */
  metadataTables: boolean;
  /** Whether GC handle APIs are available */
  gcHandles: boolean;
  /** Whether internal call registration is available */
  internalCalls: boolean;
}

/**
 * Extended feature information with details.
 */
export interface MonoFeatureDetails {
  /** Feature name */
  name: string;
  /** Whether the feature is available */
  available: boolean;
  /** Required exports for this feature */
  requiredExports: string[];
  /** Missing exports (if not available) */
  missingExports: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Exports required for metadata table access */
const REQUIRED_FOR_METADATA: MonoApiName[] = ["mono_method_signature", "mono_signature_get_param_count"];

/** Exports required for delegate thunks */
const REQUIRED_FOR_DELEGATE_THUNK: MonoApiName[] = ["mono_get_delegate_invoke", "mono_method_get_unmanaged_thunk"];

/** Exports required for GC handles */
const REQUIRED_FOR_GC_HANDLES: MonoApiName[] = ["mono_gchandle_new", "mono_gchandle_free"];

/** Export required for internal calls */
const REQUIRED_FOR_INTERNAL_CALLS: MonoApiName[] = ["mono_add_internal_call"];

// ============================================================================
// RUNTIME VERSION CLASS
// ============================================================================

/**
 * Represents the capabilities of the loaded Mono runtime.
 *
 * Use this to adapt code behavior based on available features.
 *
 * @example
 * ```typescript
 * const version = MonoRuntimeVersion.fromApi(api);
 *
 * if (version.features.delegateThunk) {
 *   // Use native delegate callbacks
 * } else {
 *   // Fall back to alternative approach
 * }
 *
 * // Check specific feature
 * if (version.hasFeature('gcHandles')) {
 *   // Use GC handle APIs
 * }
 * ```
 */
export class MonoRuntimeVersion {
  /** Available feature flags */
  readonly features: MonoFeatureFlags;

  private constructor(features: MonoFeatureFlags) {
    this.features = features;
  }

  /**
   * Create a version instance from a MonoApi.
   * Probes the API to determine available features.
   *
   * @param api MonoApi instance to probe
   * @returns Version with detected features
   */
  static fromApi(api: MonoApi): MonoRuntimeVersion {
    const hasDelegateThunk = REQUIRED_FOR_DELEGATE_THUNK.every(name => api.hasExport(name));
    const metadataTables = REQUIRED_FOR_METADATA.every(name => api.hasExport(name));
    const gcHandles = REQUIRED_FOR_GC_HANDLES.every(name => api.hasExport(name));
    const internalCalls = REQUIRED_FOR_INTERNAL_CALLS.every(name => api.hasExport(name));

    return new MonoRuntimeVersion({
      delegateThunk: hasDelegateThunk,
      metadataTables,
      gcHandles,
      internalCalls,
    });
  }

  // ===== FEATURE CHECKING =====

  /**
   * Check if a specific feature is available.
   *
   * @param feature Feature name
   * @returns True if available
   */
  hasFeature(feature: keyof MonoFeatureFlags): boolean {
    return this.features[feature];
  }

  /**
   * Check if all specified features are available.
   *
   * @param features Features to check
   * @returns True if all available
   */
  hasAllFeatures(...features: Array<keyof MonoFeatureFlags>): boolean {
    return features.every(f => this.features[f]);
  }

  /**
   * Check if any of the specified features are available.
   *
   * @param features Features to check
   * @returns True if any available
   */
  hasAnyFeature(...features: Array<keyof MonoFeatureFlags>): boolean {
    return features.some(f => this.features[f]);
  }

  // ===== DETAILED FEATURE INFO =====

  /**
   * Get detailed information about all features.
   * Useful for diagnostics and debugging.
   *
   * @param api MonoApi to check exports against
   * @returns Array of feature details
   */
  static getFeatureDetails(api: MonoApi): MonoFeatureDetails[] {
    return [
      createFeatureDetail(api, "delegateThunk", REQUIRED_FOR_DELEGATE_THUNK),
      createFeatureDetail(api, "metadataTables", REQUIRED_FOR_METADATA),
      createFeatureDetail(api, "gcHandles", REQUIRED_FOR_GC_HANDLES),
      createFeatureDetail(api, "internalCalls", REQUIRED_FOR_INTERNAL_CALLS),
    ];
  }

  // ===== UTILITY =====

  /**
   * Get a summary of available features.
   * @returns Object mapping feature names to availability
   */
  toObject(): MonoFeatureFlags {
    return { ...this.features };
  }

  /**
   * Get a human-readable summary of features.
   */
  toString(): string {
    const available = Object.entries(this.features)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const unavailable = Object.entries(this.features)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    return `MonoRuntimeVersion { available: [${available.join(", ")}], unavailable: [${unavailable.join(", ")}] }`;
  }

  /**
   * Get a list of available feature names.
   */
  getAvailableFeatures(): Array<keyof MonoFeatureFlags> {
    return Object.entries(this.features)
      .filter(([, v]) => v)
      .map(([k]) => k as keyof MonoFeatureFlags);
  }

  /**
   * Get a list of unavailable feature names.
   */
  getUnavailableFeatures(): Array<keyof MonoFeatureFlags> {
    return Object.entries(this.features)
      .filter(([, v]) => !v)
      .map(([k]) => k as keyof MonoFeatureFlags);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createFeatureDetail(api: MonoApi, name: string, requiredExports: MonoApiName[]): MonoFeatureDetails {
  const missingExports = requiredExports.filter(exp => !api.hasExport(exp));
  return {
    name,
    available: missingExports.length === 0,
    requiredExports: [...requiredExports],
    missingExports,
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick check if delegate thunks are supported.
 * @param api MonoApi instance
 */
export function supportsDelegateThunks(api: MonoApi): boolean {
  return REQUIRED_FOR_DELEGATE_THUNK.every(name => api.hasExport(name));
}

/**
 * Quick check if GC handles are supported.
 * @param api MonoApi instance
 */
export function supportsGCHandles(api: MonoApi): boolean {
  return REQUIRED_FOR_GC_HANDLES.every(name => api.hasExport(name));
}

/**
 * Quick check if internal calls are supported.
 * @param api MonoApi instance
 */
export function supportsInternalCalls(api: MonoApi): boolean {
  return REQUIRED_FOR_INTERNAL_CALLS.every(name => api.hasExport(name));
}

/**
 * Quick check if metadata tables are supported.
 * @param api MonoApi instance
 */
export function supportsMetadataTables(api: MonoApi): boolean {
  return REQUIRED_FOR_METADATA.every(name => api.hasExport(name));
}

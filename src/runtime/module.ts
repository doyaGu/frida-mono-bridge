/**
 * Module Discovery - Find and load the Mono runtime module.
 *
 * Provides utilities for discovering the Mono runtime in a process:
 * - Automatic detection by common module names
 * - Export-based heuristic detection
 * - Async waiting for delayed module loading
 * - Manual module name specification
 *
 * @module runtime/module
 */

import { MonoModuleNotFoundError } from "../utils/errors";
import { MONO_EXPORTS, MonoApiName, MonoExportSignature } from "./exports";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Information about the discovered Mono module.
 */
export interface MonoModuleInfo {
  /** Module file name */
  name: string;
  /** Base address in memory */
  base: NativePointer;
  /** Module size in bytes */
  size: number;
  /** Full path to the module */
  path: string;
}

/**
 * Options for waiting for the Mono module to load.
 */
export interface MonoModuleWaitOptions {
  /** Specific module name(s) to search for */
  moduleName?: string | string[];
  /** Maximum time to wait (milliseconds) */
  timeoutMs: number;
  /** Time before logging a warning (milliseconds) */
  warnAfterMs: number;
  /** Polling interval (milliseconds, default: 50) */
  pollIntervalMs?: number;
}

/**
 * Result from module discovery including detection method.
 */
export interface ModuleDiscoveryResult {
  /** The discovered module info */
  module: MonoModuleInfo;
  /** How the module was discovered */
  method: "explicit" | "common-name" | "export-heuristic";
  /** Confidence level (for heuristic detection) */
  confidence?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common Mono module names across platforms.
 * Ordered by prevalence (Unity names first).
 */
const COMMON_MODULE_NAMES = [
  // Unity common names (prioritized)
  "mono-2.0-bdwgc.dll",
  "mono-2.0-sgen.dll",
  "monosgen-2.0.dll",
  "mono-2.0.dll",
  // Generic names
  "mono.dll",
  // Linux/Mac
  "libmonosgen-2.0.so",
  "libmonosgen-2.0.dylib",
  "libmono-2.0.so",
  "libmono.so",
  "libmono-2.0.dylib",
] as const;

/**
 * Key exports used for heuristic module detection.
 */
const PROBE_EXPORT_NAMES = ["mono_runtime_invoke", "mono_thread_attach", "mono_get_root_domain"] as const;

// ============================================================================
// MODULE DISCOVERY
// ============================================================================

/**
 * Try to find the Mono module without throwing.
 *
 * Uses multiple detection strategies:
 * 1. Explicit module name if provided
 * 2. Common Mono module names
 * 3. Export-based heuristic detection
 *
 * @param moduleName Optional specific module name(s) to search for
 * @returns MonoModuleInfo if found, null otherwise
 *
 * @example
 * ```typescript
 * // Auto-detect
 * const module = tryFindMonoModule();
 *
 * // Explicit name
 * const module = tryFindMonoModule('mono-2.0-bdwgc.dll');
 * ```
 */
export function tryFindMonoModule(moduleName?: string | string[]): MonoModuleInfo | null {
  const result = tryFindMonoModuleWithDetails(moduleName);
  return result?.module ?? null;
}

/**
 * Try to find the Mono module with additional discovery details.
 *
 * @param moduleName Optional specific module name(s) to search for
 * @returns Discovery result with module and detection method, or null
 */
export function tryFindMonoModuleWithDetails(moduleName?: string | string[]): ModuleDiscoveryResult | null {
  const modules = Process.enumerateModules();

  // Strategy 1: Explicit module name(s)
  const candidates = normalizeCandidates(moduleName);
  if (candidates.length > 0) {
    for (const candidate of candidates) {
      const moduleInfo = findModuleByName(modules, candidate);
      if (moduleInfo) {
        return {
          module: normalizeModuleInfo(moduleInfo),
          method: "explicit",
        };
      }
    }
  }

  // Strategy 2: Common module names
  for (const candidate of COMMON_MODULE_NAMES) {
    const moduleInfo = findModuleByName(modules, candidate);
    if (moduleInfo) {
      return {
        module: normalizeModuleInfo(moduleInfo),
        method: "common-name",
      };
    }
  }

  // Strategy 3: Export-based heuristic
  const heuristicResult = findByExportHeuristic(modules);
  if (heuristicResult) {
    return heuristicResult;
  }

  return null;
}

/**
 * Try to wait for the Mono module to load without throwing.
 *
 * @param options Wait options
 * @returns MonoModuleInfo if found within timeout, null on timeout
 *
 * @example
 * ```typescript
 * const module = await tryWaitForMonoModule({
 *   timeoutMs: 30000,
 *   warnAfterMs: 10000,
 * });
 * if (module) {
 *   console.log('Found Mono:', module.name);
 * }
 * ```
 */
export async function tryWaitForMonoModule(options: MonoModuleWaitOptions): Promise<MonoModuleInfo | null> {
  const pollIntervalMs = options.pollIntervalMs ?? 50;
  const deadline = Date.now() + options.timeoutMs;
  const warnAt = Date.now() + options.warnAfterMs;
  let didWarn = false;

  while (Date.now() < deadline) {
    const moduleInfo = tryFindMonoModule(options.moduleName);
    if (moduleInfo) {
      return moduleInfo;
    }

    if (!didWarn && Date.now() >= warnAt) {
      didWarn = true;
      const candidates = normalizeCandidates(options.moduleName);
      const hint = candidates.length > 0 ? ` (candidates: ${candidates.join(", ")})` : "";
      console.warn(`[Mono] Waiting for Mono module to load${hint}...`);
    }

    await delay(pollIntervalMs);
  }

  return null;
}

/**
 * Wait for the Mono module to load, throwing on timeout.
 *
 * @param options Wait options
 * @returns Module info
 * @throws {MonoModuleNotFoundError} if module not found within timeout
 *
 * @example
 * ```typescript
 * try {
 *   const module = await waitForMonoModule({
 *     timeoutMs: 30000,
 *     warnAfterMs: 10000,
 *   });
 *   console.log('Mono loaded:', module.path);
 * } catch (error) {
 *   console.error('Mono not found');
 * }
 * ```
 */
export async function waitForMonoModule(options: MonoModuleWaitOptions): Promise<MonoModuleInfo> {
  const moduleInfo = await tryWaitForMonoModule(options);
  if (moduleInfo) {
    return moduleInfo;
  }

  const candidates = normalizeCandidates(options.moduleName);
  const loadedModules = Process.enumerateModules().map(m => m.name);
  throw new MonoModuleNotFoundError(
    `Timed out waiting for Mono module to load. Ensure Mono is loaded before the bridge attaches or set Mono.config.moduleName`,
    candidates.length > 0 ? candidates : undefined,
    loadedModules,
  );
}

/**
 * Find the Mono module synchronously, throwing if not found.
 *
 * @param moduleName Optional specific module name(s) to search for
 * @returns Module info
 * @throws {MonoModuleNotFoundError} if module not found
 *
 * @example
 * ```typescript
 * const module = findMonoModule();
 * console.log('Mono at:', module.base);
 * ```
 */
export function findMonoModule(moduleName?: string | string[]): MonoModuleInfo {
  const moduleInfo = tryFindMonoModule(moduleName);
  if (moduleInfo) {
    return moduleInfo;
  }

  const candidates = normalizeCandidates(moduleName);
  const loadedModules = Process.enumerateModules().map(m => m.name);
  throw new MonoModuleNotFoundError(
    `Failed to discover Mono runtime module. Specify the module name manually or ensure Mono is loaded before the bridge attaches`,
    candidates.length > 0 ? candidates : undefined,
    loadedModules,
  );
}

/**
 * Check if a module looks like Mono based on its exports.
 *
 * @param moduleName Name of the module to check
 * @returns True if module has Mono exports
 */
export function isMonoModule(moduleName: string): boolean {
  try {
    const mod = Process.findModuleByName(moduleName);
    if (!mod) {
      return false;
    }

    const exports = mod.enumerateExports();
    const exportSet = new Set(exports.map(e => e.name));

    // Check for key Mono exports
    return PROBE_EXPORT_NAMES.some(name => exportSet.has(name));
  } catch {
    return false;
  }
}

/**
 * Get all common Mono module names.
 * Useful for debugging or manual discovery.
 */
export function getCommonModuleNames(): readonly string[] {
  return COMMON_MODULE_NAMES;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function findModuleByName(modules: Module[], name: string): Module | undefined {
  return modules.find(m => m.name === name || m.path.endsWith(`/${name}`) || m.path.endsWith(`\\${name}`));
}

function findByExportHeuristic(modules: Module[]): ModuleDiscoveryResult | null {
  // Build complete set of known Mono export names
  const exportNames = new Set<string>(PROBE_EXPORT_NAMES);
  for (const name of Object.keys(MONO_EXPORTS) as MonoApiName[]) {
    exportNames.add(name);
    const signature = MONO_EXPORTS[name] as MonoExportSignature;
    if (signature.aliases) {
      for (const alias of signature.aliases) {
        exportNames.add(alias);
      }
    }
  }

  let bestMatch: MonoModuleInfo | null = null;
  let bestHits = 0;

  for (const mod of modules) {
    try {
      const exports = mod.enumerateExports();
      const hits = exports.reduce((count, item) => count + (exportNames.has(item.name) ? 1 : 0), 0);
      if (hits > bestHits) {
        bestHits = hits;
        bestMatch = normalizeModuleInfo(mod);
      }
    } catch (_error) {
      // Some system modules cannot be enumerated; ignore
    }
  }

  if (bestMatch && bestHits > 0) {
    return {
      module: bestMatch,
      method: "export-heuristic",
      confidence: Math.min(1, bestHits / PROBE_EXPORT_NAMES.length),
    };
  }

  return null;
}

function normalizeCandidates(moduleName?: string | string[]): string[] {
  if (!moduleName) {
    return [];
  }
  return Array.isArray(moduleName) ? moduleName : [moduleName];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeModuleInfo(moduleDetails: {
  name: string;
  base: NativePointer;
  size: number;
  path: string;
}): MonoModuleInfo {
  return {
    name: moduleDetails.name,
    base: moduleDetails.base,
    size: moduleDetails.size,
    path: moduleDetails.path,
  };
}

import { MonoApi } from "../runtime/api";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { MonoAssembly } from "./assembly";
import { MonoHandle } from "./base";
import { MonoClass } from "./class";

// ===== INTERFACES =====

/**
 * Summary information for a MonoDomain, providing essential metadata about
 * an application domain in the Mono runtime.
 *
 * @remarks
 * Use `domain.getSummary()` to generate this summary for any MonoDomain instance.
 * The summary provides a snapshot of the domain's state for logging, debugging,
 * and analysis purposes.
 *
 * @example
 * ```typescript
 * const summary = domain.getSummary();
 * console.log(`Domain: ${summary.id}`);
 * console.log(`Assemblies: ${summary.assemblyCount}`);
 * ```
 */
export interface MonoDomainSummary {
  /** Domain identifier (pointer address) */
  id: number;
  /** Whether this is the root domain */
  isRoot: boolean;
  /** Total number of loaded assemblies */
  assemblyCount: number;
  /** Names of loaded assemblies */
  assemblyNames: string[];
  /** Total number of unique namespaces across all assemblies */
  namespaceCount: number;
  /** Native pointer address as hex string */
  pointer: string;
}

/**
 * Result of an assembly unload operation.
 */
export interface UnloadAssemblyResult {
  /** Whether the unload operation completed without error */
  success: boolean;
  /** Reason for failure or success note */
  reason: string;
  /** Whether assembly unloading is supported by this runtime */
  supported: boolean;
}

/**
 * Represents a Mono application domain.
 *
 * A MonoDomain is a container for code execution in the Mono runtime,
 * providing isolation for assemblies and their types. In most Unity/Mono
 * applications, there is only one active domain (the root domain).
 *
 * @remarks
 * - All native calls are automatically thread-safe
 * - No manual thread management is needed
 * - Use `MonoDomain.getRoot()` to get the root application domain
 * - Use `MonoDomain.current()` to get the current thread's domain
 *
 * @example
 * ```typescript
 * // Get the root domain
 * const domain = MonoDomain.getRoot(api);
 *
 * // List all loaded assemblies
 * domain.assemblies.forEach(asm => console.log(asm.name));
 *
 * // Find a class by full name
 * const playerClass = domain.class("Game.Player");
 *
 * // Get domain summary
 * console.log(domain.describe());
 * ```
 */
export class MonoDomain extends MonoHandle {
  /** Cached root domain pointer for comparison */
  private static rootDomainPtr: NativePointer | null = null;

  // ===== STATIC FACTORY METHODS =====

  /**
   * Get the root application domain.
   *
   * @param api The Mono API instance
   * @returns The root MonoDomain instance
   *
   * @example
   * ```typescript
   * const domain = MonoDomain.getRoot(api);
   * console.log(`Root domain: ${domain.id}`);
   * ```
   */
  static getRoot(api: MonoApi): MonoDomain {
    const domainPtr = api.getRootDomain();
    MonoDomain.rootDomainPtr = domainPtr;
    return new MonoDomain(api, domainPtr);
  }

  /**
   * Get the current thread's application domain.
   *
   * @param api The Mono API instance
   * @returns The current MonoDomain instance
   *
   * @example
   * ```typescript
   * const current = MonoDomain.current(api);
   * console.log(`Current domain: ${current.id}`);
   * ```
   */
  static current(api: MonoApi): MonoDomain {
    const domainPtr = api.native.mono_domain_get();
    return new MonoDomain(api, domainPtr);
  }

  /**
   * Create a MonoDomain from a native pointer.
   *
   * @param api The Mono API instance
   * @param pointer Native pointer to the MonoDomain
   * @returns MonoDomain instance
   */
  static fromPointer(api: MonoApi, pointer: NativePointer): MonoDomain {
    return new MonoDomain(api, pointer);
  }

  // ===== CORE PROPERTIES =====

  /**
   * Get domain name (if available).
   *
   * @remarks
   * Mono doesn't expose domain names directly in all configurations.
   * This typically returns null.
   */
  get name(): string | null {
    return null; // Mono doesn't expose domain names directly
  }

  /**
   * Get domain ID (derived from pointer address).
   *
   * @example
   * ```typescript
   * console.log(`Domain ID: ${domain.id}`);
   * ```
   */
  get id(): number {
    return this.pointer.toInt32();
  }

  /**
   * Check if this is the root application domain.
   */
  @lazy
  get isRoot(): boolean {
    try {
      const rootPtr = this.api.getRootDomain();
      return this.pointer.equals(rootPtr);
    } catch {
      return false;
    }
  }

  // ===== ASSEMBLY ACCESS =====

  /**
   * Open an assembly from a file path.
   *
   * @param path Path to the assembly file (.dll)
   * @returns The loaded MonoAssembly
   * @throws Error if the assembly cannot be loaded
   *
   * @example
   * ```typescript
   * const assembly = domain.assemblyOpen("MyPlugin.dll");
   * console.log(`Loaded: ${assembly.name}`);
   * ```
   */
  assemblyOpen(path: string): MonoAssembly {
    const pathPtr = Memory.allocUtf8String(path);
    const assemblyPtr = this.native.mono_domain_assembly_open(this.pointer, pathPtr);
    if (pointerIsNull(assemblyPtr)) {
      raise(
        MonoErrorCodes.ASSEMBLY_NOT_FOUND,
        `Unable to open assembly at ${path}`,
        "Ensure the file exists and is a valid Mono assembly",
      );
    }
    return new MonoAssembly(this.api, assemblyPtr);
  }

  /**
   * Get all assemblies loaded in this domain.
   *
   * @example
   * ```typescript
   * const assemblies = domain.assemblies;
   * assemblies.forEach(asm => console.log(asm.name));
   * ```
   */
  @lazy
  get assemblies(): MonoAssembly[] {
    const assemblies: MonoAssembly[] = [];
    this.enumerateAssemblies(assembly => assemblies.push(assembly));
    return assemblies;
  }

  /**
   * Get the number of loaded assemblies.
   *
   * @example
   * ```typescript
   * console.log(`Domain has ${domain.assemblyCount} assemblies`);
   * ```
   */
  get assemblyCount(): number {
    return this.assemblies.length;
  }

  /**
   * Try to find an assembly by name without throwing.
   *
   * @param name Assembly name (with or without .dll extension)
   * @returns MonoAssembly if found, null otherwise
   *
   * @example
   * ```typescript
   * const asm = domain.tryAssembly("UnityEngine");
   * if (asm) {
   *   console.log(`Found: ${asm.name}`);
   * }
   * ```
   */
  tryAssembly(name: string): MonoAssembly | null {
    return this.getAssembly(name);
  }

  /**
   * Find an assembly by name, throwing if not found.
   *
   * @param name Assembly name (with or without .dll extension)
   * @returns MonoAssembly
   * @throws {MonoAssemblyNotFoundError} if assembly not found
   *
   * @example
   * ```typescript
   * const asm = domain.assembly("UnityEngine");
   * console.log(`Found: ${asm.name}`);
   * ```
   */
  assembly(name: string): MonoAssembly {
    const result = this.tryAssembly(name);
    if (result) {
      return result;
    }
    raise(
      MonoErrorCodes.ASSEMBLY_NOT_FOUND,
      `Assembly '${name}' not found in domain`,
      "Use tryAssembly() to avoid throwing",
    );
  }

  /**
   * Get an assembly by name.
   *
   * @param name Assembly name (with or without .dll extension)
   * @returns MonoAssembly if found, null otherwise
   *
   * @example
   * ```typescript
   * const mscorlib = domain.getAssembly("mscorlib");
   * const unity = domain.getAssembly("UnityEngine.CoreModule");
   * ```
   */
  getAssembly(name: string): MonoAssembly | null {
    const normalizedName = name.endsWith(".dll") ? name.slice(0, -4) : name;

    for (const assembly of this.assemblies) {
      const assemblyName = assembly.name;
      if (assemblyName === normalizedName || assemblyName === name) {
        return assembly;
      }
    }

    return null;
  }

  /**
   * Load an assembly from file path.
   *
   * @param path Path to the assembly file (.dll)
   * @returns The loaded MonoAssembly
   * @throws Error if the assembly cannot be loaded
   *
   * @remarks
   * This is an alias for `assemblyOpen()`.
   *
   * @example
   * ```typescript
   * const assembly = domain.loadAssembly("MyPlugin.dll");
   * ```
   */
  loadAssembly(path: string): MonoAssembly {
    return this.assemblyOpen(path);
  }

  // ===== CLASS LOOKUP =====

  /**
   * Try to find a class by full name across all assemblies without throwing.
   *
   * @param fullName Full class name including namespace (e.g., "UnityEngine.GameObject")
   * @returns MonoClass if found, null otherwise
   *
   * @remarks
   * This method searches through all loaded assemblies until it finds a match.
   * For better performance when you know which assembly contains the class,
   * use `assembly.image.tryClass()` directly.
   *
   * @example
   * ```typescript
   * const go = domain.tryClass("UnityEngine.GameObject");
   * if (go) {
   *   console.log(`Found: ${go.fullName}`);
   * }
   * ```
   */
  tryClass(fullName: string): MonoClass | null {
    const trimmed = fullName ? fullName.trim() : "";
    if (trimmed.length === 0) {
      return null;
    }
    for (const assembly of this.assemblies) {
      const klass = assembly.image.tryClass(trimmed);
      if (klass) {
        return klass;
      }
    }
    return null;
  }

  /**
   * Find a class by full name across all assemblies, throwing if not found.
   *
   * @param fullName Full class name including namespace (e.g., "UnityEngine.GameObject")
   * @returns MonoClass
   * @throws {MonoClassNotFoundError} if class not found
   *
   * @remarks
   * This method searches through all loaded assemblies until it finds a match.
   * For better performance when you know which assembly contains the class,
   * use `assembly.image.class()` directly.
   *
   * @example
   * ```typescript
   * const go = domain.class("UnityEngine.GameObject");
   * console.log(`Found: ${go.fullName}`);
   * ```
   */
  class(fullName: string): MonoClass {
    const trimmed = fullName ? fullName.trim() : "";
    if (trimmed.length === 0) {
      raise(MonoErrorCodes.INVALID_ARGUMENT, "Class name cannot be empty", "Use tryClass() to avoid throwing");
    }
    const klass = this.tryClass(trimmed);
    if (klass) {
      return klass;
    }
    raise(
      MonoErrorCodes.CLASS_NOT_FOUND,
      `Class '${trimmed}' not found in any loaded assembly`,
      "Use tryClass() to avoid throwing",
    );
  }

  /**
   * Get all root namespaces in this domain.
   *
   * @returns Array of top-level namespace names, sorted alphabetically
   *
   * @remarks
   * Root namespaces are the first component of namespace paths.
   * For example, "System.Collections.Generic" has root namespace "System".
   *
   * @example
   * ```typescript
   * const roots = domain.rootNamespaces;
   * // ["System", "UnityEngine", "Game", ...]
   * ```
   */
  @lazy
  get rootNamespaces(): string[] {
    const namespaces = new Set<string>();

    for (const assembly of this.assemblies) {
      for (const klass of assembly.image.classes) {
        const ns = klass.namespace;
        if (ns) {
          const rootNs = ns.split(".")[0];
          namespaces.add(rootNs);
        }
      }
    }

    return Array.from(namespaces).sort();
  }

  /**
   * Get all namespaces in this domain (full namespace paths).
   *
   * @returns Array of all unique namespace paths, sorted alphabetically
   *
   * @example
   * ```typescript
   * const namespaces = domain.allNamespaces;
   * // ["System", "System.Collections", "System.Collections.Generic", ...]
   * ```
   */
  @lazy
  get allNamespaces(): string[] {
    const namespaces = new Set<string>();

    for (const assembly of this.assemblies) {
      for (const klass of assembly.image.classes) {
        const ns = klass.namespace;
        if (ns) {
          namespaces.add(ns);
        }
      }
    }

    return Array.from(namespaces).sort();
  }

  /**
   * Get classes in a specific namespace.
   *
   * @param namespace Full namespace path to filter by
   * @returns Array of classes in the specified namespace
   *
   * @remarks
   * This searches across all loaded assemblies. For better performance
   * when searching within a single assembly, use `image.getClassesByNamespace()`.
   *
   * @example
   * ```typescript
   * const systemClasses = domain.getClassesInNamespace("System");
   * const gameClasses = domain.getClassesInNamespace("Game.Player");
   * ```
   */
  getClassesInNamespace(namespace: string): MonoClass[] {
    const classes: MonoClass[] = [];

    for (const assembly of this.assemblies) {
      for (const klass of assembly.image.classes) {
        if (klass.namespace === namespace) {
          classes.push(klass);
        }
      }
    }

    return classes;
  }

  // ===== ASSEMBLY MANAGEMENT =====

  /**
   * Enumerate all assemblies in this domain.
   *
   * @param visitor Callback function called for each assembly
   *
   * @remarks
   * This is more memory-efficient than `getAssemblies()` for large domains
   * as it doesn't create an array of all assemblies.
   *
   * @example
   * ```typescript
   * domain.enumerateAssemblies(assembly => {
   *   console.log(assembly.name);
   * });
   * ```
   */
  enumerateAssemblies(visitor: (assembly: MonoAssembly) => void): void {
    const seen = new Set<string>();
    const callback = new NativeCallback(
      (assemblyPtr: NativePointer, _userData: NativePointer) => {
        if (pointerIsNull(assemblyPtr)) {
          return;
        }
        const key = assemblyPtr.toString();
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        visitor(new MonoAssembly(this.api, assemblyPtr));
      },
      "void",
      ["pointer", "pointer"],
      undefined,
    );

    try {
      this.native.mono_assembly_foreach(callback, NULL);
    } finally {
      // keep callback in scope until enumeration completes
    }
  }

  /**
   * Attempt to unload an assembly from the domain.
   *
   * **Warning**: Assembly unloading is not fully supported in standard Mono/.NET Framework.
   * In most Mono runtimes (including Unity), assemblies cannot be unloaded once loaded
   * because they are loaded into the default AppDomain which cannot be unloaded.
   *
   * This method will:
   * 1. Check if the `mono_assembly_close` API is available
   * 2. Attempt to close the assembly
   * 3. Return information about whether unloading was successful
   *
   * For proper assembly unloading, consider:
   * - Using .NET Core 3.0+ AssemblyLoadContext (not available in standard Mono)
   * - Creating a separate AppDomain (if supported by the runtime)
   * - Restarting the application
   *
   * @param assembly The assembly to unload
   * @returns Result indicating success/failure and reason
   *
   * @example
   * const result = domain.unloadAssembly(myAssembly);
   * if (!result.success) {
   *   console.log(`Failed to unload: ${result.reason}`);
   * }
   */
  unloadAssembly(assembly: MonoAssembly | string): UnloadAssemblyResult {
    // Resolve assembly
    const targetAssembly = typeof assembly === "string" ? this.getAssembly(assembly) : assembly;

    if (!targetAssembly) {
      return {
        success: false,
        reason: `Assembly not found: ${assembly}`,
        supported: false,
      };
    }

    // Check if mono_assembly_close is available
    if (!this.api.hasExport("mono_assembly_close")) {
      return {
        success: false,
        reason: "mono_assembly_close API not available in this runtime",
        supported: false,
      };
    }

    // Check if this is a system assembly (shouldn't be unloaded)
    if (targetAssembly.isSystemAssembly) {
      return {
        success: false,
        reason: `Cannot unload system assembly: ${targetAssembly.name}`,
        supported: true,
      };
    }

    // Check for dependent assemblies
    const dependents = targetAssembly.referencingAssemblies;
    if (dependents.length > 0) {
      return {
        success: false,
        reason: `Assembly is referenced by ${dependents.length} other assemblies: ${dependents.map((a: MonoAssembly) => a.name).join(", ")}`,
        supported: true,
      };
    }

    try {
      // Attempt to close the assembly
      // Note: This may not actually unload the assembly from memory in most Mono runtimes
      this.native.mono_assembly_close(targetAssembly.pointer);

      return {
        success: true,
        reason: "mono_assembly_close called successfully (note: actual unloading may not occur)",
        supported: true,
      };
    } catch (error) {
      return {
        success: false,
        reason: `Error closing assembly: ${error}`,
        supported: true,
      };
    }
  }

  /**
   * Check if assembly unloading is supported in this runtime.
   *
   * @returns true if mono_assembly_close is available
   */
  isAssemblyUnloadingSupported(): boolean {
    return this.api.hasExport("mono_assembly_close");
  }

  /**
   * Create a new application domain (if supported).
   *
   * Note: Not all Mono runtimes support creating additional domains.
   * Unity, for example, uses a single AppDomain.
   *
   * @param friendlyName Name for the new domain
   * @returns New domain or null if not supported
   */
  createDomain(friendlyName: string): MonoDomain | null {
    if (!this.api.hasExport("mono_domain_create_appdomain")) {
      return null;
    }

    try {
      const namePtr = Memory.allocUtf8String(friendlyName);
      const configFilePtr = NULL; // No config file
      const domainPtr = this.native.mono_domain_create_appdomain(namePtr, configFilePtr);

      if (pointerIsNull(domainPtr)) {
        return null;
      }

      return new MonoDomain(this.api, domainPtr);
    } catch {
      return null;
    }
  }

  /**
   * Set this domain as the current domain for the thread.
   *
   * @returns Previous domain, or null if API not available
   */
  setAsCurrent(): MonoDomain | null {
    if (!this.api.hasExport("mono_domain_set")) {
      return null;
    }

    try {
      const previousPtr = this.native.mono_domain_set(this.pointer, 0);
      if (pointerIsNull(previousPtr)) {
        return null;
      }
      return new MonoDomain(this.api, previousPtr);
    } catch {
      return null;
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Search for assemblies by name pattern (substring match).
   *
   * @returns An object with essential domain metadata
   *
   * @example
   * ```typescript
   * const summary = domain.getSummary();
   * console.log(JSON.stringify(summary, null, 2));
   * // {
   * //   "id": 123456,
   * //   "isRoot": true,
   * //   "assemblyCount": 45,
   * //   "assemblyNames": ["mscorlib", "UnityEngine", ...],
   * //   "namespaceCount": 200,
   * //   "pointer": "0x12345678"
   * // }
   * ```
   */
  getSummary(): MonoDomainSummary {
    return {
      id: this.id,
      isRoot: this.isRoot,
      assemblyCount: this.assemblies.length,
      assemblyNames: this.assemblies.map(a => a.name),
      namespaceCount: this.allNamespaces.length,
      pointer: this.pointer.toString(),
    };
  }

  /**
   * Get a human-readable description of this domain.
   *
   * @returns Formatted string with domain details
   *
   * @example
   * ```typescript
   * console.log(domain.describe());
   * // MonoDomain: 0x12345678 (root)
   * //   Assemblies (45): mscorlib, UnityEngine, ...
   * //   Namespaces: 200 total
   * ```
   */
  describe(): string {
    const rootLabel = this.isRoot ? " (root)" : "";
    const asmPreview = this.assemblies
      .slice(0, 5)
      .map(a => a.name)
      .join(", ");
    const asmMore = this.assemblies.length > 5 ? `, ... (+${this.assemblies.length - 5} more)` : "";

    return [
      `MonoDomain: ${this.pointer}${rootLabel}`,
      `  ID: ${this.id}`,
      `  Assemblies (${this.assemblies.length}): ${asmPreview}${asmMore}`,
      `  Namespaces: ${this.allNamespaces.length} total`,
    ].join("\n");
  }

  /**
   * Returns a string representation of this domain.
   *
   * @returns String in format "MonoDomain(id, assemblies)"
   *
   * @example
   * ```typescript
   * console.log(domain.toString());
   * // "MonoDomain(123456, 45 assemblies, root)"
   * ```
   */
  override toString(): string {
    const rootLabel = this.isRoot ? ", root" : "";
    return `MonoDomain(${this.id}, ${this.assemblyCount} assemblies${rootLabel})`;
  }

  // ===== ADDITIONAL UTILITY METHODS =====

  /**
   * Check if this domain has a specific assembly loaded.
   *
   * @param name Assembly name (with or without .dll extension)
   * @returns true if the assembly is loaded
   *
   * @example
   * ```typescript
   * if (domain.hasAssembly("UnityEngine")) {
   *   console.log("Unity is loaded");
   * }
   * ```
   */
  hasAssembly(name: string): boolean {
    return this.getAssembly(name) !== null;
  }

  /**
   * Check if this domain has a specific class.
   *
   * @param fullName Full class name including namespace
   * @returns true if the class exists in any loaded assembly
   *
   * @example
   * ```typescript
   * if (domain.hasClass("UnityEngine.GameObject")) {
   *   console.log("GameObject class is available");
   * }
   * ```
   */
  hasClass(fullName: string): boolean {
    return this.class(fullName) !== null;
  }

  /**
   * Search for assemblies by name pattern (substring match).
   *
   * @param pattern Substring to search for in assembly names (case-insensitive)
   * @returns Array of matching assemblies
   *
   * @example
   * ```typescript
   * const unityAssemblies = domain.searchAssemblies("unity");
   * // Finds: UnityEngine, UnityEngine.CoreModule, UnityEngine.UI, etc.
   * ```
   */
  searchAssemblies(pattern: string): MonoAssembly[] {
    const lowerPattern = pattern.toLowerCase();
    return this.assemblies.filter(asm => asm.name.toLowerCase().includes(lowerPattern));
  }

  /**
   * Search for classes by name pattern across all assemblies.
   *
   * @param pattern Substring to search for in class names (case-insensitive)
   * @param maxResults Maximum number of results to return (default: 100)
   * @returns Array of matching classes
   *
   * @example
   * ```typescript
   * const managerClasses = domain.searchClasses("manager", 50);
   * ```
   */
  searchClasses(pattern: string, maxResults: number = 100): MonoClass[] {
    const lowerPattern = pattern.toLowerCase();
    const results: MonoClass[] = [];

    for (const assembly of this.assemblies) {
      for (const klass of assembly.image.classes) {
        if (klass.name.toLowerCase().includes(lowerPattern)) {
          results.push(klass);
          if (results.length >= maxResults) {
            return results;
          }
        }
      }
    }

    return results;
  }

  /**
   * Get total class count across all assemblies.
   *
   * @returns Total number of classes in all loaded assemblies
   *
   * @example
   * ```typescript
   * console.log(`Domain has ${domain.getTotalClassCount()} classes`);
   * ```
   */
  @lazy get totalClassCount(): number {
    let count = 0;
    for (const assembly of this.assemblies) {
      count += assembly.image.classCount;
    }
    return count;
  }

  // ===== ITERATION SUPPORT =====

  /**
   * Iterate over all assemblies in this domain.
   * Makes MonoDomain directly iterable with for...of.
   *
   * @example
   * ```typescript
   * for (const assembly of domain) {
   *   console.log(assembly.name);
   * }
   * ```
   */
  *[Symbol.iterator](): IterableIterator<MonoAssembly> {
    yield* this.assemblies;
  }

  /**
   * Iterate over assemblies with their indices.
   */
  *entries(): IterableIterator<[number, MonoAssembly]> {
    const assemblies = this.assemblies;
    for (let i = 0; i < assemblies.length; i++) {
      yield [i, assemblies[i]];
    }
  }

  /**
   * Iterate over assembly indices.
   */
  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.assemblyCount; i++) {
      yield i;
    }
  }

  /**
   * Iterate over assemblies (alias for Symbol.iterator).
   */
  *values(): IterableIterator<MonoAssembly> {
    yield* this.assemblies;
  }

  /**
   * Find assemblies matching a predicate.
   * @param predicate Filter function
   * @returns Array of matching assemblies
   */
  findAssemblies(predicate: (assembly: MonoAssembly) => boolean): MonoAssembly[] {
    return this.assemblies.filter(predicate);
  }
}

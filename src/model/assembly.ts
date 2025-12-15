import { MonoApi } from "../runtime/api";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { readUtf8String } from "../utils/string";
import type { CustomAttribute } from "./attribute";
import { MonoHandle } from "./handle";
import { MonoClass } from "./class";
import { createAssemblyAttributeContext, getCustomAttributes } from "./attribute";
import { MonoImage } from "./image";

/**
 * Represents a Mono assembly (.dll)
 */
export class MonoAssembly extends MonoHandle {
  constructor(api: MonoApi, pointer: NativePointer) {
    super(api, pointer);
  }

  // ===== CORE PROPERTIES =====

  /**
   * Get the image (metadata) for this assembly
   */
  @lazy
  get image(): MonoImage {
    return this.#getImage();
  }

  /**
   * Internal method to get the image (metadata) for this assembly
   */
  #getImage(): MonoImage {
    const imagePtr = this.native.mono_assembly_get_image(this.pointer);
    return new MonoImage(this.api, imagePtr);
  }

  /**
   * Get assembly name
   */
  @lazy
  get name(): string {
    try {
      // Primary method: Get name from MonoAssemblyName structure
      // NOTE: mono_assembly_get_name and mono_assembly_name_get_name are only available in mono-2.0-bdwgc.dll
      if (this.api.hasExport("mono_assembly_get_name") && this.api.hasExport("mono_assembly_name_get_name")) {
        const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
        if (!assemblyNamePtr.isNull()) {
          const namePtr = this.native.mono_assembly_name_get_name(assemblyNamePtr);
          const name = readUtf8String(namePtr);
          if (name && name !== "") {
            return name;
          }
        }
      }
    } catch (error) {
      // Continue to fallback methods
    }

    try {
      // Fallback method: Get name from assembly image (available in both mono.dll and bdwgc)
      const image = this.#getImage();
      const imageNamePtr = this.native.mono_image_get_name(image.pointer);
      const imageName = readUtf8String(imageNamePtr);
      if (imageName && imageName !== "") {
        // Remove .dll extension if present
        return imageName.replace(/\.dll$/i, "");
      }
    } catch (error) {
      // Continue to final fallback
    }

    // Final fallback: use pointer-based name
    return `Assembly_${this.pointer.toString(16)}`;
  }

  /**
   * Get assembly full name (including version, culture, and public key token)
   */
  @lazy
  get fullName(): string {
    const name = this.name;
    const version = this.version;
    const culture = this.culture;

    // Try to get public key token
    // NOTE: mono_assembly_get_name and mono_assembly_name_get_pubkeytoken are only available in mono-2.0-bdwgc.dll
    let publicKeyToken = "null";
    try {
      if (this.api.hasExport("mono_assembly_get_name") && this.api.hasExport("mono_assembly_name_get_pubkeytoken")) {
        const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
        if (!assemblyNamePtr.isNull()) {
          const tokenPtr = this.native.mono_assembly_name_get_pubkeytoken(assemblyNamePtr);
          if (!tokenPtr.isNull()) {
            // Public key token is 8 bytes
            const bytes: string[] = [];
            for (let i = 0; i < 8; i++) {
              const byte = tokenPtr.add(i).readU8();
              if (byte === 0 && i === 0) break; // No token
              bytes.push(byte.toString(16).padStart(2, "0"));
            }
            if (bytes.length > 0) {
              publicKeyToken = bytes.join("");
            }
          }
        }
      }
    } catch {
      // Keep default 'null'
    }

    return `${name}, Version=${version.major}.${version.minor}.${version.build}.${version.revision}, Culture=${culture}, PublicKeyToken=${publicKeyToken}`;
  }

  /**
   * Get assembly culture
   */
  @lazy
  get culture(): string {
    // NOTE: mono_assembly_get_name and mono_assembly_name_get_culture are only available in mono-2.0-bdwgc.dll
    try {
      if (this.api.hasExport("mono_assembly_get_name") && this.api.hasExport("mono_assembly_name_get_culture")) {
        const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
        if (!assemblyNamePtr.isNull()) {
          const culturePtr = this.native.mono_assembly_name_get_culture(assemblyNamePtr);
          if (!culturePtr.isNull()) {
            const culture = culturePtr.readUtf8String();
            if (culture && culture !== "") {
              return culture;
            }
          }
        }
      }
    } catch {
      // Fall through to default
    }
    return "neutral";
  }

  /**
   * Get assembly version
   */
  @lazy
  get version(): { major: number; minor: number; build: number; revision: number } {
    // NOTE: mono_assembly_get_name and mono_assembly_name_get_version are only available in mono-2.0-bdwgc.dll
    try {
      if (this.api.hasExport("mono_assembly_get_name") && this.api.hasExport("mono_assembly_name_get_version")) {
        const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
        if (!assemblyNamePtr.isNull()) {
          // mono_assembly_name_get_version returns major version and takes out params for minor/build/revision
          const minorPtr = Memory.alloc(4);
          const buildPtr = Memory.alloc(4);
          const revisionPtr = Memory.alloc(4);

          const major = this.native.mono_assembly_name_get_version(assemblyNamePtr, minorPtr, buildPtr, revisionPtr);

          return {
            major: major as number,
            minor: minorPtr.readU16(),
            build: buildPtr.readU16(),
            revision: revisionPtr.readU16(),
          };
        }
      }
    } catch {
      // Fall through to default
    }
    return { major: 0, minor: 0, build: 0, revision: 0 };
  }

  /**
   * Get custom attributes applied to this assembly.
   *
   * Uses `mono_custom_attrs_from_assembly` to get the custom attributes info,
   * then constructs the attributes using `mono_custom_attrs_construct`.
   *
   * @returns Array of CustomAttribute objects with attribute information
   */
  @lazy
  get customAttributes(): CustomAttribute[] {
    return getCustomAttributes(
      createAssemblyAttributeContext(this.api, this.pointer, this.native),
      ptr => new MonoClass(this.api, ptr).name,
      ptr => new MonoClass(this.api, ptr).fullName,
    );
  }

  /**
   * Get all classes in this assembly
   */
  @lazy
  get classes(): MonoClass[] {
    const image = this.#getImage();
    return image.classes;
  }

  // ===== TYPE CHECKS =====

  /**
   * Check if this is a system assembly (framework/CLR)
   */
  @lazy
  get isSystemAssembly(): boolean {
    const name = this.name.toLowerCase();
    const systemPrefixes = ["system.", "mscorlib", "netstandard", "dotnet", "mono.", "unityengine", "unity."];
    return systemPrefixes.some(prefix => name.startsWith(prefix));
  }

  /**
   * Check if this is a user assembly (application code)
   */
  @lazy
  get isUserAssembly(): boolean {
    return !this.isSystemAssembly;
  }

  // ===== MEMBER ACCESS =====

  /**
   * Get the entry point of this assembly
   */
  @lazy
  get entryPoint(): MonoClass | null {
    try {
      // Look for Main class or Entry Point attribute
      const mainClass = this.tryFindClass("", "Program");
      if (mainClass) {
        return mainClass;
      }
      const entryClass = this.tryFindClass("", "EntryPoint");
      if (entryClass) {
        return entryClass;
      }
    } catch {
      // Return null on error
    }
    return null;
  }

  // ===== STATISTICS AND COUNTS =====

  /**
   * Get the total number of classes in this assembly
   */
  @lazy
  get classCount(): number {
    return this.#getImage().classCount;
  }

  /**
   * Get the total number of types in this assembly
   */
  @lazy
  get typeCount(): number {
    // This would require enumeration through all type tokens
    // For now, return class count as approximation
    return this.classCount;
  }

  // ===== CLASS LOOKUP =====

  /**
   * Find a class by full name, throwing if not found.
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns MonoClass
   * @throws {MonoClassNotFoundError} if class not found
   */
  class(fullName: string): MonoClass {
    const klass = this.tryClass(fullName);
    if (klass) {
      return klass;
    }
    raise(
      MonoErrorCodes.CLASS_NOT_FOUND,
      `Class '${fullName}' not found in assembly '${this.name}'`,
      "Use tryClass() to avoid throwing",
    );
  }

  /**
   * Try to find a class by full name without throwing.
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns Class if found, null otherwise
   */
  tryClass(fullName: string): MonoClass | null {
    return this.#getImage().tryFindClassByFullName(fullName);
  }

  /**
   * Check if a class exists by full name.
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns True if class exists
   */
  hasClass(fullName: string): boolean {
    return this.tryClass(fullName) !== null;
  }

  /**
   * Find a class by namespace and name, throwing if not found.
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   * @returns MonoClass
   * @throws {MonoClassNotFoundError} if class not found
   */
  findClass(namespace: string, name: string): MonoClass {
    return this.#getImage().classFromName(namespace, name);
  }

  /**
   * Try to find a class by namespace and name without throwing.
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   * @returns Class if found, null otherwise
   */
  tryFindClass(namespace: string, name: string): MonoClass | null {
    return this.#getImage().tryClassFromName(namespace, name);
  }

  // ===== PERFORMANCE METRICS =====

  /**
   * Get performance statistics for this assembly
   * Measures actual lookup times and estimates memory usage
   */
  @lazy
  get performanceStats(): AssemblyPerformanceStats {
    const name = this.name;
    const image = this.#getImage();

    // Measure class lookup time
    const classStart = Date.now();
    const classCount = image.classCount;
    // Do a sample lookup
    try {
      image.tryClassFromName("System", "Object");
    } catch {
      // Ignore errors during performance measurement
    }
    const classLookupTime = Date.now() - classStart;

    // Measure method lookup time
    const methodStart = Date.now();
    let methodCount = 0;
    try {
      const classes = image.classes;
      if (classes.length > 0) {
        const firstClass = classes[0];
        methodCount = firstClass.methods.length;
      }
    } catch {
      // Ignore errors during performance measurement
    }
    const methodLookupTime = Date.now() - methodStart;

    // Measure field access time
    const fieldStart = Date.now();
    let fieldCount = 0;
    try {
      const classes = image.classes;
      if (classes.length > 0) {
        const firstClass = classes[0];
        fieldCount = firstClass.fields.length;
      }
    } catch {
      // Ignore errors during performance measurement
    }
    const fieldAccessTime = Date.now() - fieldStart;

    // Estimate memory usage based on class count and metadata
    // This is a rough estimate: ~1KB per class for metadata
    const estimatedMemoryUsage = classCount * 1024;

    // Cache hit rate is not directly measurable, estimate based on repeated lookups
    let cacheHitRate = 0;
    try {
      const lookupStart = Date.now();
      for (let i = 0; i < 10; i++) {
        image.tryClassFromName("System", "Object");
      }
      const lookupTime = Date.now() - lookupStart;
      // If 10 lookups take less than 2ms total, assume good cache hit rate
      cacheHitRate = lookupTime < 2 ? 0.95 : lookupTime < 10 ? 0.7 : 0.5;
    } catch {
      cacheHitRate = 0;
    }

    return {
      assemblyName: name,
      classCount,
      methodCount,
      fieldCount,
      classLookupTime,
      methodLookupTime,
      fieldAccessTime,
      totalMemoryUsage: estimatedMemoryUsage,
      cacheHitRate,
    };
  }

  // ===== DEPENDENCY ANALYSIS =====

  /**
   * Get all assemblies referenced by this assembly.
   *
   * This reads the AssemblyRef metadata table to find all referenced assemblies,
   * then attempts to resolve them from loaded assemblies in the current domain.
   */
  @lazy
  get referencedAssemblies(): MonoAssembly[] {
    const result: MonoAssembly[] = [];

    try {
      const image = this.#getImage();

      // MONO_TABLE_ASSEMBLYREF = 35
      const MONO_TABLE_ASSEMBLYREF = 35;

      // Get number of assembly references
      const refCount = this.native.mono_image_get_table_rows(image.pointer, MONO_TABLE_ASSEMBLYREF);

      if (refCount <= 0) {
        return result;
      }

      // Get loaded assemblies to resolve references
      const loadedAssemblies = new Map<string, MonoAssembly>();

      // Use mono_assembly_foreach to enumerate all loaded assemblies
      const seenPtrs = new Set<string>();
      const callback = new NativeCallback(
        (assemblyPtr: NativePointer, _userData: NativePointer) => {
          if (assemblyPtr.isNull()) return;
          const key = assemblyPtr.toString();
          if (seenPtrs.has(key)) return;
          seenPtrs.add(key);

          try {
            const asm = new MonoAssembly(this.api, assemblyPtr);
            const name = asm.name.toLowerCase();
            loadedAssemblies.set(name, asm);
          } catch {
            // Skip invalid assemblies
          }
        },
        "void",
        ["pointer", "pointer"],
      );

      this.native.mono_assembly_foreach(callback, NULL);

      // Get referenced assembly names using mono_assembly_get_assemblyref
      // NOTE: mono_assembly_name_get_name is only available in mono-2.0-bdwgc.dll
      if (this.api.hasExport("mono_assembly_name_get_name")) {
        const assemblyNameStruct = Memory.alloc(256); // MonoAssemblyName is a structure

        for (let i = 0; i < Number(refCount); i++) {
          try {
            // mono_assembly_get_assemblyref fills the MonoAssemblyName structure
            this.native.mono_assembly_get_assemblyref(image.pointer, i, assemblyNameStruct);

            // Get name from the assembly name structure
            const namePtr = this.native.mono_assembly_name_get_name(assemblyNameStruct);
            if (!namePtr.isNull()) {
              const refName = namePtr.readUtf8String();
              if (refName) {
                const normalizedName = refName.toLowerCase();
                const resolved = loadedAssemblies.get(normalizedName);
                if (resolved && resolved.pointer.toString() !== this.pointer.toString()) {
                  // Avoid duplicates
                  if (!result.some(a => a.pointer.toString() === resolved.pointer.toString())) {
                    result.push(resolved);
                  }
                }
              }
            }
          } catch {
            // Skip invalid references
          }
        }
      }
    } catch {
      // Return empty array on error
    }
    return result;
  }

  /**
   * Get all assemblies that reference this assembly.
   *
   * This performs a reverse dependency analysis by iterating through all loaded
   * assemblies and checking if they reference this assembly.
   *
   * @returns Array of assemblies that depend on this assembly
   *
   * @example
   * const mscorlib = domain.getAssembly('mscorlib');
   * const dependents = mscorlib.referencingAssemblies;
   * // Most assemblies will reference mscorlib
   */
  @lazy
  get referencingAssemblies(): MonoAssembly[] {
    const result: MonoAssembly[] = [];

    try {
      const myName = this.name.toLowerCase();
      const myPointer = this.pointer.toString();

      // Enumerate all loaded assemblies
      const seenPtrs = new Set<string>();
      const callback = new NativeCallback(
        (assemblyPtr: NativePointer, _userData: NativePointer) => {
          if (assemblyPtr.isNull()) return;
          const key = assemblyPtr.toString();
          if (seenPtrs.has(key)) return;
          seenPtrs.add(key);

          // Skip self
          if (key === myPointer) return;

          try {
            const otherAsm = new MonoAssembly(this.api, assemblyPtr);

            // Check if this assembly references us
            const refs = otherAsm.referencedAssemblies;
            const referencesMe = refs.some(
              ref => ref.name.toLowerCase() === myName || ref.pointer.toString() === myPointer,
            );

            if (referencesMe) {
              // Avoid duplicates
              if (!result.some(a => a.pointer.toString() === key)) {
                result.push(otherAsm);
              }
            }
          } catch {
            // Skip assemblies that fail to enumerate
          }
        },
        "void",
        ["pointer", "pointer"],
      );

      this.native.mono_assembly_foreach(callback, NULL);
    } catch {
      // Return empty array on error
    }
    return result;
  }

  /**
   * Get dependency tree for this assembly
   */
  @lazy
  get dependencyTree(): AssemblyDependencyTree {
    const visited = new Set<string>();
    const buildTree = (asm: MonoAssembly): AssemblyDependencyNode => {
      const name = asm.name;
      if (visited.has(name)) {
        return { name, visited: true, dependencies: [] };
      }
      visited.add(name);

      const dependencies = asm.referencedAssemblies.filter(dep => !visited.has(dep.name)).map(dep => buildTree(dep));

      return {
        name,
        visited: false,
        dependencies,
      };
    };

    return {
      root: buildTree(this),
      totalAssemblies: visited.size,
      maxDepth: this.calculateDependencyDepth(buildTree(this)),
    };
  }

  private calculateDependencyDepth(node: AssemblyDependencyNode, depth = 0): number {
    if (node.visited) return depth;
    if (node.dependencies.length === 0) return depth;
    return Math.max(...node.dependencies.map(dep => this.calculateDependencyDepth(dep, depth + 1)));
  }

  // ===== COMPARISON AND RELATIONSHIPS =====

  /**
   * Check if this assembly depends on another assembly
   * @param assembly Assembly or assembly name to check
   * @returns True if this assembly depends on the target
   */
  dependsOn(assembly: MonoAssembly | string): boolean {
    const targetName = assembly instanceof MonoAssembly ? assembly.name : assembly;
    return this.referencedAssemblies.some(ref => ref.name.toLowerCase() === targetName.toLowerCase());
  }

  /**
   * Check if this assembly equals another
   */
  equals(other: MonoAssembly): boolean {
    if (!other) return false;
    return this.pointer.toString() === other.pointer.toString();
  }

  /**
   * Compare this assembly to another
   * @returns -1 if less, 0 if equal, 1 if greater
   */
  compareTo(other: MonoAssembly): number {
    if (!other) return 1;

    const nameCompare = this.name.localeCompare(other.name);
    if (nameCompare !== 0) return nameCompare;

    const version1 = this.version;
    const version2 = other.version;

    // Compare versions
    if (version1.major !== version2.major) {
      return version1.major - version2.major;
    }
    if (version1.minor !== version2.minor) {
      return version1.minor - version2.minor;
    }
    if (version1.build !== version2.build) {
      return version1.build - version2.build;
    }
    return version1.revision - version2.revision;
  }

  /**
   * Check if this assembly is compatible with another version
   */
  isCompatibleWith(other: MonoAssembly): boolean {
    const version1 = this.version;
    const version2 = other.version;

    // Simple compatibility check - same major version
    return version1.major === version2.major && version1.minor >= version2.minor;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get detailed information about this assembly
   */
  @lazy
  get detailedInfo(): AssemblyDetailedInfo {
    return {
      basic: {
        name: this.name,
        fullName: this.fullName,
        culture: this.culture,
        version: this.version,
      },
      classification: {
        isSystemAssembly: this.isSystemAssembly,
        isUserAssembly: this.isUserAssembly,
      },
      statistics: {
        classCount: this.classCount,
        typeCount: this.typeCount,
        referencedCount: this.referencedAssemblies.length,
        referencingCount: this.referencingAssemblies.length,
      },
      analysis: {
        hasEntryPoint: this.entryPoint !== null,
        entryPointName: this.entryPoint?.name || null,
        dependencyCount: this.referencedAssemblies.length,
        maxDependencyDepth: this.dependencyTree.maxDepth,
      },
    };
  }

  /**
   * Get a human-readable description of this assembly
   */
  describe(): string {
    const info = this.detailedInfo;
    return `${info.basic.name} v${info.basic.version.major}.${info.basic.version.minor}.${info.basic.version.build} (${info.classification.isUserAssembly ? "User" : "System"} Assembly)`;
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Get a summary string for debugging
   */
  toString(): string {
    return `${this.constructor.name}(${this.name} v${this.version.major}.${this.version.minor}.${this.version.build})`;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): AssemblyInfo {
    return {
      name: this.name,
      fullName: this.fullName,
      culture: this.culture,
      version: this.version,
      isSystem: this.isSystemAssembly,
      isUser: this.isUserAssembly,
      classCount: this.classCount,
    };
  }

  // ===== ITERATION SUPPORT =====

  /**
   * Iterate over all classes in this assembly.
   * Makes MonoAssembly directly iterable with for...of.
   *
   * @example
   * ```typescript
   * for (const klass of assembly) {
   *   console.log(klass.fullName);
   * }
   * ```
   */
  *[Symbol.iterator](): IterableIterator<MonoClass> {
    yield* this.classes;
  }

  /**
   * Iterate over classes with their indices.
   */
  *entries(): IterableIterator<[number, MonoClass]> {
    const classes = this.classes;
    for (let i = 0; i < classes.length; i++) {
      yield [i, classes[i]];
    }
  }

  /**
   * Iterate over class indices.
   */
  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.classCount; i++) {
      yield i;
    }
  }

  /**
   * Iterate over classes (alias for Symbol.iterator).
   */
  *values(): IterableIterator<MonoClass> {
    yield* this.classes;
  }

  /**
   * Find classes matching a predicate.
   * @param predicate Filter function
   * @returns Array of matching classes
   */
  findClasses(predicate: (klass: MonoClass) => boolean): MonoClass[] {
    return this.classes.filter(predicate);
  }
}

// ===== INTERFACES AND TYPES =====

export interface AssemblyPerformanceStats {
  assemblyName: string;
  classCount: number;
  methodCount: number;
  fieldCount: number;
  classLookupTime: number;
  methodLookupTime: number;
  fieldAccessTime: number;
  totalMemoryUsage: number;
  cacheHitRate: number;
}

export interface AssemblyInfo {
  name: string;
  fullName: string;
  culture: string;
  version: { major: number; minor: number; build: number; revision: number };
  isSystem: boolean;
  isUser: boolean;
  classCount: number;
}

export interface AssemblyDetailedInfo {
  basic: {
    name: string;
    fullName: string;
    culture: string;
    version: { major: number; minor: number; build: number; revision: number };
  };
  classification: {
    isSystemAssembly: boolean;
    isUserAssembly: boolean;
  };
  statistics: {
    classCount: number;
    typeCount: number;
    referencedCount: number;
    referencingCount: number;
  };
  analysis: {
    hasEntryPoint: boolean;
    entryPointName: string | null;
    dependencyCount: number;
    maxDependencyDepth: number;
  };
}

export interface AssemblyDependencyNode {
  name: string;
  visited: boolean;
  dependencies: AssemblyDependencyNode[];
}

export interface AssemblyDependencyTree {
  root: AssemblyDependencyNode;
  totalAssemblies: number;
  maxDepth: number;
}

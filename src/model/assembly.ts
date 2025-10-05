import { MonoApi } from "../runtime/api";
import { pointerIsNull, readUtf8String, readU16 } from "../runtime/mem";
import { MonoHandle } from "./base";
import { MonoImage } from "./image";
import { MonoClass } from "./class";

/**
 * Represents a Mono assembly (.dll)
 */
export class MonoAssembly extends MonoHandle {
  #assemblyName: string | null = null;
  #referencedAssemblies: MonoAssembly[] | null = null;
  #referencingAssemblies: MonoAssembly[] | null = null;
  #entryPoint: MonoClass | null = null;
  #loadState: AssemblyLoadState = AssemblyLoadState.Unknown;

  constructor(api: MonoApi, pointer: NativePointer) {
    super(api, pointer);
  }

  /**
   * Get the image (metadata) for this assembly
   */
  get image(): MonoImage {
    return this.getImage();
  }

  /**
   * Get the image (metadata) for this assembly (legacy method)
   */
  getImage(): MonoImage {
    const imagePtr = this.native.mono_assembly_get_image(this.pointer);
    return new MonoImage(this.api, imagePtr);
  }

  /**
   * Get assembly name
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get assembly name (method implementation)
   */
  getName(): string {
    const namePtr = this.native.mono_assembly_get_name(this.pointer);
    return readUtf8String(namePtr) || "Unknown";
  }

  /**
   * Get assembly full name
   */
  getFullName(): string {
    // For now, return the simple name
    return this.getName();
  }

  /**
   * Get assembly culture
   */
  getCulture(): string {
    // Would need to use mono_assembly_name_get_culture
    return "neutral";
  }

  /**
   * Get assembly version
   */
  getVersion(): { major: number; minor: number; build: number; revision: number } {
    // Would need to use mono_assembly_name_get_version
    return { major: 1, minor: 0, build: 0, revision: 0 };
  }

  /**
   * Get all classes in this assembly
   */
  get classes(): MonoClass[] {
    return this.getClasses();
  }

  /**
   * Get all classes in this assembly (method implementation)
   */
  getClasses(): MonoClass[] {
    // For now, return empty array - would need image enumeration
    return [];
  }

  // ===== ANALYSIS AND CLASSIFICATION METHODS =====

  /**
   * Check if this is a system assembly (framework/CLR)
   */
  isSystemAssembly(): boolean {
    const name = this.getName().toLowerCase();
    const systemPrefixes = [
      'system.', 'mscorlib', 'netstandard', 'dotnet',
      'mono.', 'unityengine', 'unity.'
    ];
    return systemPrefixes.some(prefix => name.startsWith(prefix));
  }

  /**
   * Check if this is a user assembly (application code)
   */
  isUserAssembly(): boolean {
    return !this.isSystemAssembly();
  }

  /**
   * Check if this assembly is fully loaded
   */
  isFullyLoaded(): boolean {
    return this.getLoadState() === AssemblyLoadState.Loaded;
  }

  /**
   * Get the load state of this assembly
   */
  getLoadState(): AssemblyLoadState {
    if (this.#loadState === AssemblyLoadState.Unknown) {
      // Try to determine load state by checking if we can access the image
      try {
        this.getImage().getClassCount();
        this.#loadState = AssemblyLoadState.Loaded;
      } catch {
        this.#loadState = AssemblyLoadState.Error;
      }
    }
    return this.#loadState;
  }

  // ===== STATISTICS AND COUNTS =====

  /**
   * Get the total number of classes in this assembly
   */
  getClassCount(): number {
    return this.getImage().getClassCount();
  }

  /**
   * Get the total number of types in this assembly
   */
  getTypeCount(): number {
    // This would require enumeration through all type tokens
    // For now, return class count as approximation
    return this.getClassCount();
  }

  /**
   * Get assembly size information
   */
  getSizeInfo(): AssemblySizeInfo {
    const image = this.getImage();
    const classCount = this.getClassCount();

    return {
      assemblyName: this.getName(),
      fileSize: 0, // Would need actual file access
      classCount,
      typeCount: classCount,
      metadataSize: 0, // Would need image size calculation
      loadTime: Date.now() // Placeholder
    };
  }

  /**
   * Get performance statistics for this assembly
   */
  getPerformanceStats(): AssemblyPerformanceStats {
    return {
      assemblyName: this.getName(),
      classLookupTime: 0, // Would need measurement
      methodLookupTime: 0,
      fieldAccessTime: 0,
      totalMemoryUsage: 0,
      cacheHitRate: 0
    };
  }

  // ===== ASSEMBLY ANALYSIS =====

  /**
   * Get the entry point of this assembly
   */
  getEntryPoint(): MonoClass | null {
    if (this.#entryPoint === null) {
      try {
        // Look for Main class or Entry Point attribute
        const mainClass = this.tryFindClass("", "Program");
        if (mainClass) {
          this.#entryPoint = mainClass;
        } else {
          const entryClass = this.tryFindClass("", "EntryPoint");
          if (entryClass) {
            this.#entryPoint = entryClass;
          }
        }
      } catch {
        this.#entryPoint = null;
      }
    }
    return this.#entryPoint;
  }

  /**
   * Get all custom attributes on this assembly
   */
  getCustomAttributes(): CustomAttribute[] {
    // This would require reflection infrastructure
    // For now, return empty array
    return [];
  }

  
  // ===== DEPENDENCY ANALYSIS =====

  /**
   * Get all assemblies referenced by this assembly
   */
  getReferencedAssemblies(): MonoAssembly[] {
    if (this.#referencedAssemblies === null) {
      try {
        // This would require assembly dependency analysis
        // For now, return empty array
        this.#referencedAssemblies = [];
      } catch {
        this.#referencedAssemblies = [];
      }
    }
    return this.#referencedAssemblies;
  }

  /**
   * Get all assemblies that reference this assembly
   */
  getReferencingAssemblies(): MonoAssembly[] {
    if (this.#referencingAssemblies === null) {
      try {
        // This would require reverse dependency analysis
        // For now, return empty array
        this.#referencingAssemblies = [];
      } catch {
        this.#referencingAssemblies = [];
      }
    }
    return this.#referencingAssemblies;
  }

  /**
   * Check if this assembly depends on another assembly
   */
  dependsOn(assembly: MonoAssembly | string): boolean {
    const targetName = assembly instanceof MonoAssembly ? assembly.name : assembly;
    return this.getReferencedAssemblies().some(
      ref => ref.name.toLowerCase() === targetName.toLowerCase()
    );
  }

  /**
   * Get dependency tree for this assembly
   */
  getDependencyTree(): AssemblyDependencyTree {
    const visited = new Set<string>();
    const buildTree = (asm: MonoAssembly): AssemblyDependencyNode => {
      const name = asm.name;
      if (visited.has(name)) {
        return { name, visited: true, dependencies: [] };
      }
      visited.add(name);

      const dependencies = asm.getReferencedAssemblies()
        .filter(dep => !visited.has(dep.name))
        .map(dep => buildTree(dep));

      return {
        name,
        visited: false,
        dependencies
      };
    };

    return {
      root: buildTree(this),
      totalAssemblies: visited.size,
      maxDepth: this.calculateDependencyDepth(buildTree(this))
    };
  }

  private calculateDependencyDepth(node: AssemblyDependencyNode, depth = 0): number {
    if (node.visited) return depth;
    if (node.dependencies.length === 0) return depth;
    return Math.max(
      ...node.dependencies.map(dep => this.calculateDependencyDepth(dep, depth + 1))
    );
  }

  // ===== COMPARISON AND EQUALITY =====

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

    const nameCompare = this.getName().localeCompare(other.getName());
    if (nameCompare !== 0) return nameCompare;

    const version1 = this.getVersion();
    const version2 = other.getVersion();

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
    const version1 = this.getVersion();
    const version2 = other.getVersion();

    // Simple compatibility check - same major version
    return version1.major === version2.major &&
           version1.minor >= version2.minor;
  }

  // ===== REFLECTION AND INSPECTION =====

  /**
   * Get detailed information about this assembly
   */
  getDetailedInfo(): AssemblyDetailedInfo {
    return {
      basic: {
        name: this.getName(),
        fullName: this.getFullName(),
        culture: this.getCulture(),
        version: this.getVersion(),
        location: this.getLocation()
      },
      classification: {
        isSystemAssembly: this.isSystemAssembly(),
        isUserAssembly: this.isUserAssembly(),
        isFullyLoaded: this.isFullyLoaded(),
        loadState: this.getLoadState()
      },
      statistics: {
        classCount: this.getClassCount(),
        typeCount: this.getTypeCount(),
        referencedCount: this.getReferencedAssemblies().length,
        referencingCount: this.getReferencingAssemblies().length
      },
      analysis: {
        hasEntryPoint: this.getEntryPoint() !== null,
        entryPointName: this.getEntryPoint()?.name || null,
        dependencyCount: this.getReferencedAssemblies().length,
        maxDependencyDepth: this.getDependencyTree().maxDepth
      }
    };
  }

  /**
   * Get the location of this assembly file
   */
  getLocation(): string {
    // This would require access to the assembly's file path
    // For now, return the assembly name as location
    return this.getName() + ".dll";
  }

  /**
   * Get a human-readable description of this assembly
   */
  describe(): string {
    const info = this.getDetailedInfo();
    return `${info.basic.name} v${info.basic.version.major}.${info.basic.version.minor}.${info.basic.version.build} (${info.classification.isUserAssembly ? 'User' : 'System'} Assembly)`;
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Get a summary string for debugging
   */
  toString(): string {
    return `${this.constructor.name}(${this.getName()} v${this.getVersion().major}.${this.getVersion().minor}.${this.getVersion().build})`;
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): AssemblyInfo {
    return {
      name: this.getName(),
      fullName: this.getFullName(),
      culture: this.getCulture(),
      version: this.getVersion(),
      isSystem: this.isSystemAssembly(),
      isUser: this.isUserAssembly(),
      isLoaded: this.isFullyLoaded(),
      classCount: this.getClassCount(),
      location: this.getLocation()
    };
  }

  /**
   * Find a class by namespace and name
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   */
  findClass(namespace: string, name: string): MonoClass {
    return this.getImage().classFromName(namespace, name);
  }

  /**
   * Try to find a class by namespace and name
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   * @returns Class if found, null otherwise
   */
  tryFindClass(namespace: string, name: string): MonoClass | null {
    return this.getImage().tryClassFromName(namespace, name);
  }

  /**
   * Find a class by full name
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns Class if found, null otherwise
   */
  class(fullName: string): MonoClass | null {
    return this.getImage().tryFindClassByFullName(fullName);
  }
}

// ===== INTERFACES AND TYPES =====

export enum AssemblyLoadState {
  Unknown = 'unknown',
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error'
}

export interface AssemblySizeInfo {
  assemblyName: string;
  fileSize: number;
  classCount: number;
  typeCount: number;
  metadataSize: number;
  loadTime: number;
}

export interface AssemblyPerformanceStats {
  assemblyName: string;
  classLookupTime: number;
  methodLookupTime: number;
  fieldAccessTime: number;
  totalMemoryUsage: number;
  cacheHitRate: number;
}

export interface CustomAttribute {
  name: string;
  type: string;
  constructorArguments: any[];
  properties: Record<string, any>;
}

export interface AssemblyInfo {
  name: string;
  fullName: string;
  culture: string;
  version: { major: number; minor: number; build: number; revision: number };
  isSystem: boolean;
  isUser: boolean;
  isLoaded: boolean;
  classCount: number;
  location: string;
}

export interface AssemblyDetailedInfo {
  basic: {
    name: string;
    fullName: string;
    culture: string;
    version: { major: number; minor: number; build: number; revision: number };
    location: string;
  };
  classification: {
    isSystemAssembly: boolean;
    isUserAssembly: boolean;
    isFullyLoaded: boolean;
    loadState: AssemblyLoadState;
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

  
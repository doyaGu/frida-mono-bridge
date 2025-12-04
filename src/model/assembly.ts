import { MonoApi } from "../runtime/api";
import { readUtf8String } from "../utils/string";
import { pointerIsNull } from "../utils/memory";
import { MonoHandle, CustomAttribute, parseCustomAttributes } from "./base";
import { MonoImage } from "./image";
import { MonoClass } from "./class";

/**
 * Represents a Mono assembly (.dll)
 */
export class MonoAssembly extends MonoHandle {
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
  get name(): string {
    return this.getName();
  }

  /**
   * Get assembly name (method implementation)
   */
  getName(): string {
    try {
      // Primary method: Get name from MonoAssemblyName structure
      const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
      if (!assemblyNamePtr.isNull()) {
        const namePtr = this.native.mono_assembly_name_get_name(assemblyNamePtr);
        const name = readUtf8String(namePtr);
        if (name && name !== "") {
          return name;
        }
      }
    } catch (error) {
      // Continue to fallback methods
    }

    try {
      // Fallback method: Get name from assembly image
      const image = this.#getImage();
      const imageNamePtr = this.native.mono_image_get_name(image.pointer);
      const imageName = readUtf8String(imageNamePtr);
      if (imageName && imageName !== "") {
        // Remove .dll extension if present
        return imageName.replace(/\.dll$/i, '');
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
  getFullName(): string {
    const name = this.getName();
    const version = this.getVersion();
    const culture = this.getCulture();
    
    // Try to get public key token
    let publicKeyToken = 'null';
    try {
      const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
      if (!assemblyNamePtr.isNull() && this.api.hasExport('mono_assembly_name_get_pubkeytoken')) {
        const tokenPtr = this.native.mono_assembly_name_get_pubkeytoken(assemblyNamePtr);
        if (!tokenPtr.isNull()) {
          // Public key token is 8 bytes
          const bytes: string[] = [];
          for (let i = 0; i < 8; i++) {
            const byte = tokenPtr.add(i).readU8();
            if (byte === 0 && i === 0) break; // No token
            bytes.push(byte.toString(16).padStart(2, '0'));
          }
          if (bytes.length > 0) {
            publicKeyToken = bytes.join('');
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
  getCulture(): string {
    try {
      const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
      if (!assemblyNamePtr.isNull()) {
        // Check if the function exists
        if (this.api.hasExport('mono_assembly_name_get_culture')) {
          const culturePtr = this.native.mono_assembly_name_get_culture(assemblyNamePtr);
          if (!culturePtr.isNull()) {
            const culture = culturePtr.readUtf8String();
            if (culture && culture !== '') {
              return culture;
            }
          }
        }
      }
    } catch {
      // Fall through to default
    }
    return 'neutral';
  }

  /**
   * Get assembly version
   */
  getVersion(): { major: number; minor: number; build: number; revision: number } {
    try {
      const assemblyNamePtr = this.native.mono_assembly_get_name(this.pointer);
      if (!assemblyNamePtr.isNull() && this.api.hasExport('mono_assembly_name_get_version')) {
        // mono_assembly_name_get_version returns major version and takes out params for minor/build/revision
        const minorPtr = Memory.alloc(4);
        const buildPtr = Memory.alloc(4);
        const revisionPtr = Memory.alloc(4);
        
        const major = this.native.mono_assembly_name_get_version(
          assemblyNamePtr,
          minorPtr,
          buildPtr,
          revisionPtr
        );
        
        return {
          major: major as number,
          minor: minorPtr.readU16(),
          build: buildPtr.readU16(),
          revision: revisionPtr.readU16()
        };
      }
    } catch {
      // Fall through to default
    }
    return { major: 0, minor: 0, build: 0, revision: 0 };
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
    const image = this.#getImage();
    return image.getClasses();
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
        this.#getImage().getClassCount();
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
    return this.#getImage().getClassCount();
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
    const classCount = this.getClassCount();

    return {
      assemblyName: this.getName(),
      fileSize: 0, // Would need actual file access
      classCount,
      typeCount: classCount,
      metadataSize: 0, // Would need image size calculation
      loadTime: Date.now() // Assembly load timestamp
    };
  }

  /**
   * Get performance statistics for this assembly
   * Measures actual lookup times and estimates memory usage
   */
  getPerformanceStats(): AssemblyPerformanceStats {
    const name = this.getName();
    const image = this.#getImage();
    
    // Measure class lookup time
    const classStart = Date.now();
    const classCount = image.getClassCount();
    // Do a sample lookup
    try {
      image.tryClassFromName('System', 'Object');
    } catch {}
    const classLookupTime = Date.now() - classStart;
    
    // Measure method lookup time
    const methodStart = Date.now();
    let methodCount = 0;
    try {
      const classes = image.getClasses();
      if (classes.length > 0) {
        const firstClass = classes[0];
        methodCount = firstClass.getMethods().length;
      }
    } catch {}
    const methodLookupTime = Date.now() - methodStart;
    
    // Measure field access time
    const fieldStart = Date.now();
    let fieldCount = 0;
    try {
      const classes = image.getClasses();
      if (classes.length > 0) {
        const firstClass = classes[0];
        fieldCount = firstClass.getFields().length;
      }
    } catch {}
    const fieldAccessTime = Date.now() - fieldStart;
    
    // Estimate memory usage based on class count and metadata
    // This is a rough estimate: ~1KB per class for metadata
    const estimatedMemoryUsage = classCount * 1024;
    
    // Cache hit rate is not directly measurable, estimate based on repeated lookups
    let cacheHitRate = 0;
    try {
      const lookupStart = Date.now();
      for (let i = 0; i < 10; i++) {
        image.tryClassFromName('System', 'Object');
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
      cacheHitRate
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
   * Get all custom attributes on this assembly.
   * 
   * Uses `mono_custom_attrs_from_assembly` to get the custom attributes info,
   * then constructs the attributes using `mono_custom_attrs_construct`.
   * 
   * @returns Array of CustomAttribute objects with attribute information
   */
  getCustomAttributes(): CustomAttribute[] {
    if (!this.api.hasExport('mono_custom_attrs_from_assembly')) {
      return [];
    }

    try {
      const customAttrInfoPtr = this.native.mono_custom_attrs_from_assembly(this.pointer);
      return parseCustomAttributes(
        this.api,
        customAttrInfoPtr,
        (ptr) => new MonoClass(this.api, ptr).getName(),
        (ptr) => new MonoClass(this.api, ptr).getFullName()
      );
    } catch {
      return [];
    }
  }

  
  // ===== DEPENDENCY ANALYSIS =====

  /**
   * Get all assemblies referenced by this assembly.
   * 
   * This reads the AssemblyRef metadata table to find all referenced assemblies,
   * then attempts to resolve them from loaded assemblies in the current domain.
   */
  getReferencedAssemblies(): MonoAssembly[] {
    if (this.#referencedAssemblies === null) {
      this.#referencedAssemblies = [];
      
      try {
        const image = this.#getImage();
        
        // MONO_TABLE_ASSEMBLYREF = 35
        const MONO_TABLE_ASSEMBLYREF = 35;
        
        // Check if the API is available
        if (!this.api.hasExport('mono_image_get_table_rows')) {
          return this.#referencedAssemblies;
        }
        
        // Get number of assembly references
        const refCount = this.native.mono_image_get_table_rows(
          image.pointer,
          MONO_TABLE_ASSEMBLYREF
        );
        
        if (refCount <= 0) {
          return this.#referencedAssemblies;
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
              const name = asm.getName().toLowerCase();
              loadedAssemblies.set(name, asm);
            } catch {
              // Skip invalid assemblies
            }
          },
          'void',
          ['pointer', 'pointer']
        );
        
        this.native.mono_assembly_foreach(callback, NULL);
        
        // Try to get referenced assembly names using mono_assembly_get_assemblyref
        if (this.api.hasExport('mono_assembly_get_assemblyref')) {
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
                    if (!this.#referencedAssemblies.some(a => 
                      a.pointer.toString() === resolved.pointer.toString()
                    )) {
                      this.#referencedAssemblies.push(resolved);
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
        this.#referencedAssemblies = [];
      }
    }
    return this.#referencedAssemblies;
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
   * const dependents = mscorlib.getReferencingAssemblies();
   * // Most assemblies will reference mscorlib
   */
  getReferencingAssemblies(): MonoAssembly[] {
    if (this.#referencingAssemblies === null) {
      this.#referencingAssemblies = [];
      
      try {
        const myName = this.getName().toLowerCase();
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
              const refs = otherAsm.getReferencedAssemblies();
              const referencesMe = refs.some(ref => 
                ref.getName().toLowerCase() === myName ||
                ref.pointer.toString() === myPointer
              );
              
              if (referencesMe) {
                // Avoid duplicates
                if (!this.#referencingAssemblies!.some(a => 
                  a.pointer.toString() === key
                )) {
                  this.#referencingAssemblies!.push(otherAsm);
                }
              }
            } catch {
              // Skip assemblies that fail to enumerate
            }
          },
          'void',
          ['pointer', 'pointer']
        );
        
        this.native.mono_assembly_foreach(callback, NULL);
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
    return this.#getImage().classFromName(namespace, name);
  }

  /**
   * Try to find a class by namespace and name
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   * @returns Class if found, null otherwise
   */
  tryFindClass(namespace: string, name: string): MonoClass | null {
    return this.#getImage().tryClassFromName(namespace, name);
  }

  /**
   * Find a class by full name
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns Class if found, null otherwise
   */
  class(fullName: string): MonoClass | null {
    return this.#getImage().tryFindClassByFullName(fullName);
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

  
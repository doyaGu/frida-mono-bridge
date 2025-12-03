import { MonoApi } from "../runtime/api";
import { allocUtf8 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { MonoHandle } from "./base";
import { MonoAssembly } from "./assembly";
import { MonoClass } from "./class";

/**
 * Represents a Mono application domain
 *
 * No thread management needed - all native calls are automatically thread-safe
 */
export class MonoDomain extends MonoHandle {
  static getRoot(api: MonoApi): MonoDomain {
    const domainPtr = api.getRootDomain();
    return new MonoDomain(api, domainPtr);
  }

  static current(api: MonoApi): MonoDomain {
    const domainPtr = api.native.mono_domain_get();
    return new MonoDomain(api, domainPtr);
  }

  static fromPointer(api: MonoApi, pointer: NativePointer): MonoDomain {
    return new MonoDomain(api, pointer);
  }

  /**
   * Open an assembly from a file path
   */
  assemblyOpen(path: string): MonoAssembly {
    const pathPtr = allocUtf8(path);
    const assemblyPtr = this.native.mono_domain_assembly_open(this.pointer, pathPtr);
    if (pointerIsNull(assemblyPtr)) {
      throw new Error(`Unable to open assembly at ${path}`);
    }
    return new MonoAssembly(this.api, assemblyPtr);
  }

  /**
   * Get all assemblies loaded in this domain
   */
  get assemblies(): MonoAssembly[] {
    return this.getAssemblies();
  }

  /**
   * Get all assemblies loaded in this domain
   */
  getAssemblies(): MonoAssembly[] {
    const assemblies: MonoAssembly[] = [];
    this.enumerateAssemblies((assembly) => assemblies.push(assembly));
    return assemblies;
  }

  /**
   * Find an assembly by name
   */
  assembly(name: string): MonoAssembly | null {
    return this.getAssembly(name);
  }

  /**
   * Get an assembly by name
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
   * Load an assembly from file path
   */
  loadAssembly(path: string): MonoAssembly {
    return this.assemblyOpen(path);
  }

  /**
   * Find a class by full name across all assemblies
   */
  class(fullName: string): MonoClass | null {
    const trimmed = fullName ? fullName.trim() : "";
    if (trimmed.length === 0) {
      return null;
    }
    for (const assembly of this.assemblies) {
      const klass = assembly.image.class(trimmed);
      if (klass) {
        return klass;
      }
    }
    return null;
  }

  /**
   * Get all root namespaces in this domain
   */
  getRootNamespaces(): string[] {
    const namespaces = new Set<string>();

    for (const assembly of this.assemblies) {
      for (const klass of assembly.image.classes) {
        const ns = klass.namespace;
        if (ns) {
          const rootNs = ns.split('.')[0];
          namespaces.add(rootNs);
        }
      }
    }

    return Array.from(namespaces).sort();
  }

  /**
   * Get all namespaces in this domain (full namespace paths)
   */
  getAllNamespaces(): string[] {
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
   * Get classes in a specific namespace
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

  /**
   * Get domain name (if available)
   */
  get name(): string | null {
    return null; // Mono doesn't expose domain names directly
  }

  /**
   * Get domain ID
   */
  get id(): number {
    return this.pointer.toInt32();
  }

  /**
   * Enumerate all assemblies in this domain
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

  // ===== ASSEMBLY MANAGEMENT =====

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
    const targetAssembly = typeof assembly === 'string' 
      ? this.getAssembly(assembly)
      : assembly;
    
    if (!targetAssembly) {
      return {
        success: false,
        reason: `Assembly not found: ${assembly}`,
        supported: false
      };
    }
    
    // Check if mono_assembly_close is available
    if (!this.api.hasExport('mono_assembly_close')) {
      return {
        success: false,
        reason: 'mono_assembly_close API not available in this runtime',
        supported: false
      };
    }
    
    // Check if this is a system assembly (shouldn't be unloaded)
    if (targetAssembly.isSystemAssembly()) {
      return {
        success: false,
        reason: `Cannot unload system assembly: ${targetAssembly.getName()}`,
        supported: true
      };
    }
    
    // Check for dependent assemblies
    const dependents = targetAssembly.getReferencingAssemblies();
    if (dependents.length > 0) {
      return {
        success: false,
        reason: `Assembly is referenced by ${dependents.length} other assemblies: ${dependents.map(a => a.getName()).join(', ')}`,
        supported: true
      };
    }
    
    try {
      // Attempt to close the assembly
      // Note: This may not actually unload the assembly from memory in most Mono runtimes
      this.native.mono_assembly_close(targetAssembly.pointer);
      
      return {
        success: true,
        reason: 'mono_assembly_close called successfully (note: actual unloading may not occur)',
        supported: true
      };
    } catch (error) {
      return {
        success: false,
        reason: `Error closing assembly: ${error}`,
        supported: true
      };
    }
  }

  /**
   * Check if assembly unloading is supported in this runtime.
   * 
   * @returns true if mono_assembly_close is available
   */
  isAssemblyUnloadingSupported(): boolean {
    return this.api.hasExport('mono_assembly_close');
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
    if (!this.api.hasExport('mono_domain_create_appdomain')) {
      return null;
    }
    
    try {
      const namePtr = allocUtf8(friendlyName);
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
    if (!this.api.hasExport('mono_domain_set')) {
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
}

// ===== INTERFACES =====

export interface UnloadAssemblyResult {
  /** Whether the unload operation completed without error */
  success: boolean;
  /** Reason for failure or success note */
  reason: string;
  /** Whether assembly unloading is supported by this runtime */
  supported: boolean;
}

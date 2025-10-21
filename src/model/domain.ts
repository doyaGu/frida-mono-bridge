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
}

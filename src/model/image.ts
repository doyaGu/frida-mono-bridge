import { MonoApi } from "../runtime/api";
import { allocUtf8 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoDomain } from "./domain";
import { MonoClass } from "./class";

/**
 * Represents a Mono image (assembly metadata)
 */
export class MonoImage extends MonoHandle {
  static fromAssemblyPath(api: MonoApi, path: string, domain: MonoDomain = MonoDomain.getRoot(api)): MonoImage {
    return domain.assemblyOpen(path).image;
  }

  /**
   * Get image name
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get all classes in this image
   */
  get classes(): MonoClass[] {
    return this.getClasses();
  }

  /**
   * Find a class by namespace and name
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   */
  classFromName(namespace: string, name: string): MonoClass {
    const nsPtr = namespace ? allocUtf8(namespace) : NULL;
    const namePtr = allocUtf8(name);
    const klassPtr = this.native.mono_class_from_name(this.pointer, nsPtr, namePtr);
    if (pointerIsNull(klassPtr)) {
      throw new Error(`Class ${namespace}.${name} not found in image.`);
    }
    return new MonoClass(this.api, klassPtr);
  }

  /**
   * Try to find a class by namespace and name
   * @param namespace Namespace (can be empty string)
   * @param name Class name
   * @returns Class if found, null otherwise
   */
  tryClassFromName(namespace: string, name: string): MonoClass | null {
    const trimmedName = name ? name.trim() : "";
    if (trimmedName.length === 0) {
      return null;
    }
    const nsPtr = namespace ? allocUtf8(namespace) : NULL;
    const namePtr = allocUtf8(trimmedName);
    const klassPtr = this.native.mono_class_from_name(this.pointer, nsPtr, namePtr);
    return pointerIsNull(klassPtr) ? null : new MonoClass(this.api, klassPtr);
  }

  /**
   * Find a class by full name
   * @param fullName Full class name (e.g., "Game.Player")
   * @returns Class if found, null otherwise
   */
  class(fullName: string): MonoClass | null {
    return this.tryFindClassByFullName(fullName);
  }

  findClassByFullName(fullName: string): MonoClass {
    const trimmed = fullName ? fullName.trim() : "";
    if (trimmed.length === 0) {
      throw new Error("Class name must be non-empty");
    }
    const separatorIndex = trimmed.lastIndexOf(".");
    if (separatorIndex === -1) {
      return this.classFromName("", trimmed);
    }
    const namespace = trimmed.slice(0, separatorIndex);
    const name = trimmed.slice(separatorIndex + 1);
    return this.classFromName(namespace, name);
  }

  tryFindClassByFullName(fullName: string): MonoClass | null {
    const trimmed = fullName ? fullName.trim() : "";
    if (trimmed.length === 0) {
      return null;
    }
  const separatorIndex = trimmed.lastIndexOf(".");
    if (separatorIndex === -1) {
      return this.tryClassFromName("", trimmed);
    }
    const namespace = trimmed.slice(0, separatorIndex);
    const name = trimmed.slice(separatorIndex + 1);
    return this.tryClassFromName(namespace, name);
  }

  getClassTokens(): number[] {
    if (!this.api.hasExport("mono_image_get_table_info")) {
      return [];
    }
    const count = this.getClassCount();
    const tokens: number[] = [];
    for (let index = 0; index < count; index += 1) {
      tokens.push(MONO_METADATA_TOKEN_TYPEDEF | (index + 1));
    }
    return tokens;
  }

  getClasses(): MonoClass[] {
    const classes: MonoClass[] = [];
    this.enumerateClasses((klass) => classes.push(klass));
    return classes;
  }

  enumerateClasses(visitor: (klass: MonoClass, index: number) => void): void {
    const tokens = this.getClassTokens();
    if (tokens.length === 0) {
      return;
    }
    tokens.forEach((token, index) => {
      const klassPtr = this.native.mono_class_get(this.pointer, token);
      if (!pointerIsNull(klassPtr)) {
        visitor(new MonoClass(this.api, klassPtr), index);
      }
    });
  }

  getName(): string {
    const namePtr = this.native.mono_image_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  getClassCount(): number {
    if (!this.api.hasExport("mono_image_get_table_info")) {
      return 0;
    }
    const table = this.native.mono_image_get_table_info(this.pointer, MONO_METADATA_TABLE_TYPEDEF);
    if (pointerIsNull(table)) {
      return 0;
    }
    return this.native.mono_table_info_get_rows(table) as number;
  }

  // ===== NEW METHODS =====

  /**
   * Get all unique namespaces in this image.
   * Collects namespaces from all classes and returns them sorted.
   * 
   * @returns Array of unique namespace strings (empty string for global namespace)
   * 
   * @example
   * const namespaces = image.getNamespaces();
   * // ['', 'System', 'System.Collections', 'Game', 'Game.Player']
   */
  getNamespaces(): string[] {
    const namespaces = new Set<string>();
    
    this.enumerateClasses((klass) => {
      const ns = klass.getNamespace();
      namespaces.add(ns);
    });
    
    return Array.from(namespaces).sort();
  }

  /**
   * Get a class by its metadata token.
   * Uses mono_class_get to resolve the token to a MonoClass.
   * 
   * @param token Metadata token (TypeDef token with MONO_TOKEN_TYPE_DEF flag)
   * @returns MonoClass if found, null otherwise
   * 
   * @example
   * // Get class by raw token
   * const klass = image.getTypeByToken(0x02000001);
   * 
   * // Get class by index (will be converted to token)
   * const klass2 = image.getTypeByToken(1, true);
   */
  getTypeByToken(token: number, isIndex = false): MonoClass | null {
    // Convert index to token if needed
    const actualToken = isIndex ? (MONO_METADATA_TOKEN_TYPEDEF | token) : token;
    
    try {
      const klassPtr = this.native.mono_class_get(this.pointer, actualToken);
      if (pointerIsNull(klassPtr)) {
        return null;
      }
      return new MonoClass(this.api, klassPtr);
    } catch {
      return null;
    }
  }

  /**
   * Get classes filtered by namespace.
   * 
   * @param namespace Namespace to filter by (exact match, use empty string for global)
   * @returns Array of classes in the specified namespace
   * 
   * @example
   * const gameClasses = image.getClassesByNamespace('Game');
   * const globalClasses = image.getClassesByNamespace('');
   */
  getClassesByNamespace(namespace: string): MonoClass[] {
    const classes: MonoClass[] = [];
    
    this.enumerateClasses((klass) => {
      if (klass.getNamespace() === namespace) {
        classes.push(klass);
      }
    });
    
    return classes;
  }
}

const MONO_METADATA_TABLE_TYPEDEF = 0x02;
const MONO_METADATA_TOKEN_TYPEDEF = 0x02000000;

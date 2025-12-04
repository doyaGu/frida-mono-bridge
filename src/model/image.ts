import { MonoApi } from "../runtime/api";
import { allocUtf8 } from "../runtime/mem";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoDomain } from "./domain";
import { MonoClass } from "./class";

/**
 * Summary information for a MonoImage, providing essential metadata about
 * a loaded assembly/module in the Mono runtime.
 *
 * @remarks
 * Use `image.getSummary()` to generate this summary for any MonoImage instance.
 * The summary provides a snapshot of the image's metadata for logging, debugging,
 * and analysis purposes.
 *
 * @example
 * ```typescript
 * const summary = image.getSummary();
 * console.log(`Image: ${summary.name}`);
 * console.log(`Classes: ${summary.classCount}, Namespaces: ${summary.namespaceCount}`);
 * ```
 */
export interface MonoImageSummary {
  /** Name of the image (assembly name without extension) */
  name: string;
  /** Total number of classes defined in the image */
  classCount: number;
  /** Total number of unique namespaces in the image */
  namespaceCount: number;
  /** Unique namespaces in this image (sorted) */
  namespaces: string[];
  /** Native pointer address as hex string */
  pointer: string;
}

/**
 * Represents a Mono image (assembly metadata) in the runtime.
 *
 * A MonoImage represents a loaded assembly or module, containing metadata about
 * all the types, methods, fields, and other members defined within it. This is
 * the primary entry point for accessing type information from a loaded assembly.
 *
 * @remarks
 * MonoImage corresponds to System.Reflection.Module in the CLR type system.
 * Each MonoAssembly contains one main MonoImage (and potentially module images).
 *
 * @example
 * ```typescript
 * // Get image from assembly
 * const assembly = domain.assemblyOpen("GameAssembly");
 * const image = assembly.image;
 *
 * // Access type information
 * const playerClass = image.classFromName("Game", "Player");
 * const classes = image.getClasses();
 * const namespaces = image.getNamespaces();
 *
 * // Get summary
 * console.log(image.describe());
 * ```
 */
export class MonoImage extends MonoHandle {
  /**
   * Create a MonoImage from an assembly path.
   *
   * @param api The Mono API instance
   * @param path Path to the assembly file
   * @param domain Optional domain to load into (defaults to root domain)
   * @returns MonoImage for the loaded assembly
   *
   * @example
   * ```typescript
   * const image = MonoImage.fromAssemblyPath(api, "GameAssembly.dll");
   * ```
   */
  static fromAssemblyPath(api: MonoApi, path: string, domain: MonoDomain = MonoDomain.getRoot(api)): MonoImage {
    return domain.assemblyOpen(path).image;
  }

  /**
   * Get image name (assembly name without extension).
   *
   * @example
   * ```typescript
   * const image = assembly.image;
   * console.log(image.name); // "Assembly-CSharp"
   * ```
   */
  get name(): string {
    return this.getName();
  }

  /**
   * Get all classes defined in this image.
   *
   * @remarks
   * This is a convenience accessor that calls `getClasses()`.
   * For large assemblies, consider using `enumerateClasses()` for better performance.
   *
   * @example
   * ```typescript
   * const classes = image.classes;
   * classes.forEach(c => console.log(c.fullName));
   * ```
   */
  get classes(): MonoClass[] {
    return this.getClasses();
  }

  /**
   * Get the total number of classes defined in this image.
   *
   * @example
   * ```typescript
   * console.log(`Image has ${image.classCount} classes`);
   * ```
   */
  get classCount(): number {
    return this.getClassCount();
  }

  /**
   * Get all unique namespaces in this image.
   *
   * @example
   * ```typescript
   * image.namespaces.forEach(ns => console.log(ns || "(global)"));
   * ```
   */
  get namespaces(): string[] {
    return this.getNamespaces();
  }

  /**
   * Find a class by namespace and name.
   *
   * @param namespace Namespace (can be empty string for global namespace)
   * @param name Class name
   * @returns The MonoClass instance
   * @throws Error if the class is not found
   *
   * @example
   * ```typescript
   * const playerClass = image.classFromName("Game", "Player");
   * const globalClass = image.classFromName("", "GlobalConfig");
   * ```
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
   * Try to find a class by namespace and name.
   *
   * @param namespace Namespace (can be empty string for global namespace)
   * @param name Class name
   * @returns Class if found, null otherwise
   *
   * @example
   * ```typescript
   * const klass = image.tryClassFromName("Game", "Player");
   * if (klass) {
   *   console.log(`Found: ${klass.fullName}`);
   * }
   * ```
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
   * Find a class by its full name.
   *
   * @param fullName Full class name with namespace (e.g., "Game.Player", "UnityEngine.GameObject")
   * @returns Class if found, null otherwise
   *
   * @remarks
   * This is a convenience method that parses the full name and calls `tryClassFromName`.
   * Use this when you have a fully qualified type name.
   *
   * @example
   * ```typescript
   * const player = image.class("Game.Player");
   * const go = image.class("UnityEngine.GameObject");
   * ```
   */
  class(fullName: string): MonoClass | null {
    return this.tryFindClassByFullName(fullName);
  }

  /**
   * Find a class by its full name.
   *
   * @param fullName Full class name with namespace (e.g., "Game.Player")
   * @returns The MonoClass instance
   * @throws Error if the class is not found or name is empty
   *
   * @example
   * ```typescript
   * const player = image.findClassByFullName("Game.Player");
   * ```
   */
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

  /**
   * Try to find a class by its full name.
   *
   * @param fullName Full class name with namespace (e.g., "Game.Player")
   * @returns The MonoClass if found, null otherwise
   *
   * @example
   * ```typescript
   * const klass = image.tryFindClassByFullName("Game.Player");
   * if (klass) {
   *   console.log(`Found: ${klass.fullName}`);
   * }
   * ```
   */
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

  /**
   * Get metadata tokens for all classes in this image.
   *
   * @returns Array of TypeDef metadata tokens
   *
   * @remarks
   * Tokens are in the format `MONO_TOKEN_TYPE_DEF | (index + 1)`.
   * Returns empty array if the required API is not available.
   *
   * @example
   * ```typescript
   * const tokens = image.getClassTokens();
   * // [0x02000001, 0x02000002, ...]
   * ```
   */
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

  /**
   * Get all classes defined in this image.
   *
   * @returns Array of all MonoClass instances
   *
   * @remarks
   * For large assemblies with many classes, consider using `enumerateClasses()`
   * to avoid creating the entire array in memory.
   *
   * @example
   * ```typescript
   * const classes = image.getClasses();
   * console.log(`Found ${classes.length} classes`);
   * ```
   */
  getClasses(): MonoClass[] {
    const classes: MonoClass[] = [];
    this.enumerateClasses(klass => classes.push(klass));
    return classes;
  }

  /**
   * Enumerate all classes in this image with a visitor callback.
   *
   * @param visitor Callback function called for each class with (klass, index)
   *
   * @remarks
   * This is more memory-efficient than `getClasses()` for large assemblies
   * as it doesn't create an array of all classes.
   *
   * @example
   * ```typescript
   * image.enumerateClasses((klass, index) => {
   *   console.log(`${index}: ${klass.fullName}`);
   * });
   * ```
   */
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

  /**
   * Get the name of this image (assembly name without extension).
   *
   * @returns Image name
   *
   * @example
   * ```typescript
   * const name = image.getName();
   * // "Assembly-CSharp"
   * ```
   */
  getName(): string {
    const namePtr = this.native.mono_image_get_name(this.pointer);
    return readUtf8String(namePtr);
  }

  /**
   * Get the total number of classes defined in this image.
   *
   * @returns Number of classes
   *
   * @example
   * ```typescript
   * console.log(`Image has ${image.getClassCount()} classes`);
   * ```
   */
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

  /**
   * Get all unique namespaces in this image.
   * Collects namespaces from all classes and returns them sorted.
   *
   * @returns Array of unique namespace strings (empty string for global namespace)
   *
   * @example
   * ```typescript
   * const namespaces = image.getNamespaces();
   * // ['', 'System', 'System.Collections', 'Game', 'Game.Player']
   * ```
   */
  getNamespaces(): string[] {
    const namespaces = new Set<string>();

    this.enumerateClasses(klass => {
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
    const actualToken = isIndex ? MONO_METADATA_TOKEN_TYPEDEF | token : token;

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

    this.enumerateClasses(klass => {
      if (klass.getNamespace() === namespace) {
        classes.push(klass);
      }
    });

    return classes;
  }

  // ===== SUMMARY & DESCRIPTION METHODS =====

  /**
   * Get a summary object containing key image information.
   *
   * @returns An object with essential image metadata
   *
   * @example
   * ```typescript
   * const summary = image.getSummary();
   * console.log(JSON.stringify(summary, null, 2));
   * // {
   * //   "name": "Assembly-CSharp",
   * //   "classCount": 1234,
   * //   "namespaceCount": 45,
   * //   "namespaces": ["", "Game", "Game.Player", ...],
   * //   "pointer": "0x12345678"
   * // }
   * ```
   */
  getSummary(): MonoImageSummary {
    const namespaces = this.getNamespaces();
    return {
      name: this.getName(),
      classCount: this.getClassCount(),
      namespaceCount: namespaces.length,
      namespaces,
      pointer: this.pointer.toString(),
    };
  }

  /**
   * Get a human-readable description of this image.
   *
   * @returns Formatted string with image details
   *
   * @example
   * ```typescript
   * console.log(image.describe());
   * // MonoImage: Assembly-CSharp
   * //   Classes: 1234
   * //   Namespaces (45): "", "Game", "Game.Player", ...
   * //   Pointer: 0x12345678
   * ```
   */
  describe(): string {
    const namespaces = this.getNamespaces();
    const nsPreview = namespaces
      .slice(0, 5)
      .map(ns => (ns ? `"${ns}"` : '""'))
      .join(", ");
    const nsMore = namespaces.length > 5 ? `, ... (+${namespaces.length - 5} more)` : "";

    return [
      `MonoImage: ${this.getName()}`,
      `  Classes: ${this.getClassCount()}`,
      `  Namespaces (${namespaces.length}): ${nsPreview}${nsMore}`,
      `  Pointer: ${this.pointer}`,
    ].join("\n");
  }

  /**
   * Returns a string representation of this image.
   *
   * @returns String in format "MonoImage(name, classes)"
   *
   * @example
   * ```typescript
   * console.log(image.toString());
   * // "MonoImage(Assembly-CSharp, 1234 classes)"
   * ```
   */
  override toString(): string {
    return `MonoImage(${this.getName()}, ${this.getClassCount()} classes)`;
  }

  // ===== ADDITIONAL UTILITY METHODS =====

  /**
   * Check if this image contains a class with the given full name.
   *
   * @param fullName Full class name to search for
   * @returns true if the class exists in this image
   *
   * @example
   * ```typescript
   * if (image.hasClass("Game.Player")) {
   *   console.log("Player class found!");
   * }
   * ```
   */
  hasClass(fullName: string): boolean {
    return this.tryFindClassByFullName(fullName) !== null;
  }

  /**
   * Check if this image contains a class with the given namespace and name.
   *
   * @param namespace Namespace (can be empty string for global namespace)
   * @param name Class name
   * @returns true if the class exists in this image
   *
   * @example
   * ```typescript
   * if (image.hasClassByName("Game", "Player")) {
   *   console.log("Player class found!");
   * }
   * ```
   */
  hasClassByName(namespace: string, name: string): boolean {
    return this.tryClassFromName(namespace, name) !== null;
  }

  /**
   * Get the number of unique namespaces in this image.
   *
   * @returns Number of unique namespaces
   *
   * @example
   * ```typescript
   * console.log(`Image has ${image.getNamespaceCount()} namespaces`);
   * ```
   */
  getNamespaceCount(): number {
    return this.getNamespaces().length;
  }

  /**
   * Find classes whose names match a predicate.
   *
   * @param predicate Function to test each class
   * @returns Array of matching classes
   *
   * @example
   * ```typescript
   * // Find all classes with "Manager" in the name
   * const managers = image.findClasses(c => c.name.includes("Manager"));
   *
   * // Find all MonoBehaviour subclasses
   * const behaviours = image.findClasses(c => {
   *   const parent = c.getParent();
   *   return parent?.name === "MonoBehaviour";
   * });
   * ```
   */
  findClasses(predicate: (klass: MonoClass) => boolean): MonoClass[] {
    const result: MonoClass[] = [];
    this.enumerateClasses(klass => {
      if (predicate(klass)) {
        result.push(klass);
      }
    });
    return result;
  }

  /**
   * Search for classes by name pattern (substring match).
   *
   * @param pattern Substring to search for in class names (case-insensitive)
   * @returns Array of classes whose names contain the pattern
   *
   * @example
   * ```typescript
   * const playerClasses = image.searchClasses("player");
   * // Finds: Player, PlayerController, PlayerData, etc.
   * ```
   */
  searchClasses(pattern: string): MonoClass[] {
    const lowerPattern = pattern.toLowerCase();
    return this.findClasses(klass => klass.getName().toLowerCase().includes(lowerPattern));
  }
}

const MONO_METADATA_TABLE_TYPEDEF = 0x02;
const MONO_METADATA_TOKEN_TYPEDEF = 0x02000000;

import { MonoApi } from "../runtime/api";
import { allocUtf8 } from "../runtime/mem";
import { pointerIsNull } from "../utils/pointer-utils";
import { readUtf8String } from "../utils/string-utils";
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
}

const MONO_METADATA_TABLE_TYPEDEF = 0x02;
const MONO_METADATA_TOKEN_TYPEDEF = 0x02000000;

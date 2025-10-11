/**
 * Search and discovery utilities for finding classes, methods, and fields
 * Provides wildcard matching and filtering capabilities
 */

import { MonoClass } from "../model/class";
import { MonoMethod } from "../model/method";
import { MonoField } from "../model/field";
import { MonoApi } from "../runtime/api";

/**
 * Convert wildcard pattern to regex
 * Supports * for any characters and ? for single character
 */
function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // Escape regex special chars
    .replace(/\*/g, ".*")                   // * -> .*
    .replace(/\?/g, ".");                   // ? -> .

  return new RegExp(`^${escaped}$`, "i");
}

/**
 * Match a name against a wildcard pattern
 */
function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const regex = wildcardToRegex(pattern);
  return regex.test(name);
}

/**
 * Find classes by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern (* for any, ? for single char)
 * @param searchNamespace If true, searches in namespace.name format
 * @returns Array of matching classes
 *
 * @example
 * // Find all Player classes
 * const players = findClasses(api, "*Player*");
 *
 * // Find classes in Game namespace
 * const gameClasses = findClasses(api, "Game.*", true);
 */
export function classes(api: MonoApi, pattern: string, searchNamespace = true): MonoClass[] {
  const results: MonoClass[] = [];
  const domain = api.getRootDomain();

  // Get all assemblies
  const assemblyIter = Memory.alloc(Process.pointerSize);
  assemblyIter.writePointer(NULL);

  while (true) {
    const assembly = api.native.mono_domain_assembly_open(domain, assemblyIter);
    if (assemblyIter.readPointer().isNull()) {
      break;
    }

    const image = api.native.mono_assembly_get_image(assembly);

    // Enumerate classes in this image
    const classIter = Memory.alloc(Process.pointerSize);
    classIter.writePointer(NULL);

    while (true) {
      const klassPtr = api.native.mono_image_get_types(image, classIter);
      if (klassPtr.readPointer().isNull()) {
        break;
      }

      const klass = new MonoClass(api, klassPtr);
      const name = klass.getName();
      const namespace = klass.getNamespace();
      const fullName = namespace ? `${namespace}.${name}` : name;

      if (searchNamespace && matchesPattern(fullName, pattern)) {
        results.push(klass);
      } else if (!searchNamespace && matchesPattern(name, pattern)) {
        results.push(klass);
      }
    }
  }

  return results;
}

/**
 * Find methods by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern (supports ClassName.MethodName format)
 * @returns Array of matching methods
 *
 * @example
 * // Find all Attack methods
 * const attacks = findMethods(api, "*Attack*");
 *
 * // Find methods in Player class
 * const playerMethods = findMethods(api, "Player.*");
 */
export function methods(api: MonoApi, pattern: string): MonoMethod[] {
  const results: MonoMethod[] = [];
  let classPattern = "*";
  let methodPattern = pattern;

  // Parse ClassName.MethodName pattern
  if (pattern.includes(".")) {
    const parts = pattern.split(".");
    classPattern = parts.slice(0, -1).join(".");
    methodPattern = parts[parts.length - 1];
  }

  // Find matching classes
  const matchingClasses = classes(api, classPattern, true);

  for (const klass of matchingClasses) {
    const klassMethods = klass.getMethods();

    for (const method of klassMethods) {
      const methodName = method.getName();

      if (matchesPattern(methodName, methodPattern)) {
        results.push(method);
      }
    }
  }

  return results;
}

/**
 * Find fields by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern (supports ClassName.FieldName format)
 * @returns Array of matching fields
 *
 * @example
 * // Find all health fields
 * const healthFields = findFields(api, "*health*");
 *
 * // Find fields in Player class
 * const playerFields = findFields(api, "Player.*");
 */
export function fields(api: MonoApi, pattern: string): MonoField[] {
  const results: MonoField[] = [];
  let classPattern = "*";
  let fieldPattern = pattern;

  // Parse ClassName.FieldName pattern
  if (pattern.includes(".")) {
    const parts = pattern.split(".");
    classPattern = parts.slice(0, -1).join(".");
    fieldPattern = parts[parts.length - 1];
  }

  // Find matching classes
  const matchingClasses = classes(api, classPattern, true);

  for (const klass of matchingClasses) {
    const klassFields = klass.getFields();

    for (const field of klassFields) {
      const fieldName = field.getName();

      if (matchesPattern(fieldName, fieldPattern)) {
        results.push(field);
      }
    }
  }

  return results;
}

/**
 * Find a single class by full name
 * Returns null if not found
 *
 * @param api Mono API instance
 * @param fullName Full class name (Namespace.ClassName)
 * @returns MonoClass or null
 *
 * @example
 * const Player = findClass(api, "Game.Player");
 */
export function classExact(api: MonoApi, fullName: string): MonoClass | null {
  const parts = fullName.split(".");
  const className = parts.pop()!;
  const namespace = parts.join(".");

  const domain = api.getRootDomain();
  const assemblyIter = Memory.alloc(Process.pointerSize);
  assemblyIter.writePointer(NULL);

  while (true) {
    const assembly = api.native.mono_domain_assembly_open(domain, assemblyIter);
    if (assemblyIter.readPointer().isNull()) {
      break;
    }

    const image = api.native.mono_assembly_get_image(assembly);
    const klassPtr = api.native.mono_class_from_name(image, Memory.allocUtf8String(namespace), Memory.allocUtf8String(className));

    if (!klassPtr.isNull()) {
      return new MonoClass(api, klassPtr);
    }
  }

  return null;
}

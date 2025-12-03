/**
 * Search and discovery utilities for finding classes, methods, and fields
 * Provides wildcard matching, regex matching, and filtering capabilities
 */

import { MonoClass } from "../model/class";
import { MonoMethod } from "../model/method";
import { MonoField } from "../model/field";
import { MonoProperty } from "../model/property";
import { MonoAssembly } from "../model/assembly";
import { MonoDomain } from "../model/domain";
import { MonoApi } from "../runtime/api";

/**
 * Search options for find operations
 */
export interface FindOptions {
  /** Use regex pattern instead of wildcard */
  regex?: boolean;
  /** Case insensitive matching (default: true) */
  caseInsensitive?: boolean;
  /** Include namespace in search (default: true for classes) */
  searchNamespace?: boolean;
  /** Maximum number of results to return */
  limit?: number;
  /** Filter function to apply after pattern matching */
  filter?: (item: any) => boolean;
}

/**
 * Convert wildcard pattern to regex
 * Supports * for any characters and ? for single character
 */
function wildcardToRegex(pattern: string, caseInsensitive = true): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // Escape regex special chars
    .replace(/\*/g, ".*")                   // * -> .*
    .replace(/\?/g, ".");                   // ? -> .

  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

/**
 * Create a regex from a pattern string
 * Supports both wildcard and regex patterns
 */
function createMatcher(pattern: string, options: FindOptions = {}): RegExp {
  const caseInsensitive = options.caseInsensitive !== false;
  
  if (options.regex) {
    // Use pattern as-is (regex)
    try {
      return new RegExp(pattern, caseInsensitive ? "i" : "");
    } catch (e) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  } else {
    // Convert wildcard to regex
    return wildcardToRegex(pattern, caseInsensitive);
  }
}

/**
 * Match a name against a pattern
 */
function matchesPattern(name: string, pattern: string, options: FindOptions = {}): boolean {
  if (pattern === "*" || pattern === "") {
    return true;
  }

  const regex = createMatcher(pattern, options);
  return regex.test(name);
}

/**
 * Find classes by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern (* for any, ? for single char) or regex if options.regex=true
 * @param searchNamespaceOrOptions If boolean, searches in namespace.name format. If object, FindOptions.
 * @returns Array of matching classes
 *
 * @example
 * // Find all Player classes (wildcard)
 * const players = classes(api, "*Player*");
 *
 * // Find classes in Game namespace
 * const gameClasses = classes(api, "Game.*", true);
 * 
 * // Find classes using regex
 * const controllers = classes(api, ".*Controller$", { regex: true });
 * 
 * // Find with limit and filter
 * const filtered = classes(api, "*", { limit: 10, filter: c => !c.isInterface() });
 */
export function classes(
  api: MonoApi, 
  pattern: string, 
  searchNamespaceOrOptions: boolean | FindOptions = true
): MonoClass[] {
  const results: MonoClass[] = [];
  const domain = MonoDomain.getRoot(api);
  const seenClasses = new Set<string>();
  
  // Handle backwards compatibility with boolean parameter
  let options: FindOptions;
  if (typeof searchNamespaceOrOptions === 'boolean') {
    options = { searchNamespace: searchNamespaceOrOptions };
  } else {
    options = searchNamespaceOrOptions;
  }
  
  const searchNamespace = options.searchNamespace !== false;
  const limit = options.limit;
  const customFilter = options.filter;

  // Enumerate all assemblies using the domain's enumeration method
  domain.enumerateAssemblies((assembly: MonoAssembly) => {
    // Check if we've hit the limit
    if (limit !== undefined && results.length >= limit) {
      return;
    }
    
    const image = assembly.image;
    
    // Use image.getClasses() to enumerate all classes
    const klassArray = image.getClasses();
    
    for (const klass of klassArray) {
      // Check limit again
      if (limit !== undefined && results.length >= limit) {
        break;
      }
      
      const klassKey = klass.pointer.toString();
      if (seenClasses.has(klassKey)) {
        continue;
      }
      seenClasses.add(klassKey);
      
      const name = klass.getName();
      const namespace = klass.getNamespace();
      const fullName = namespace ? `${namespace}.${name}` : name;

      let matches = false;
      if (searchNamespace && matchesPattern(fullName, pattern, options)) {
        matches = true;
      } else if (!searchNamespace && matchesPattern(name, pattern, options)) {
        matches = true;
      }
      
      if (matches) {
        // Apply custom filter if provided
        if (customFilter && !customFilter(klass)) {
          continue;
        }
        results.push(klass);
      }
    }
  });

  return results;
}

/**
 * Find methods by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern or regex (supports ClassName.MethodName format)
 * @param options FindOptions for regex, limit, filter, etc.
 * @returns Array of matching methods
 *
 * @example
 * // Find all Attack methods
 * const attacks = methods(api, "*Attack*");
 *
 * // Find methods in Player class
 * const playerMethods = methods(api, "Player.*");
 * 
 * // Find using regex
 * const handlers = methods(api, "On[A-Z].*", { regex: true });
 * 
 * // Find static methods only
 * const staticMethods = methods(api, "*Get*", { filter: m => m.isStatic() });
 */
export function methods(api: MonoApi, pattern: string, options: FindOptions = {}): MonoMethod[] {
  const results: MonoMethod[] = [];
  let classPattern = "*";
  let methodPattern = pattern;
  const limit = options.limit;
  const customFilter = options.filter;

  // Parse ClassName.MethodName pattern
  if (pattern.includes(".") && !options.regex) {
    const parts = pattern.split(".");
    classPattern = parts.slice(0, -1).join(".");
    methodPattern = parts[parts.length - 1];
  }

  // Find matching classes
  const matchingClasses = classes(api, classPattern, { ...options, searchNamespace: true, limit: undefined, filter: undefined });

  for (const klass of matchingClasses) {
    // Check limit
    if (limit !== undefined && results.length >= limit) {
      break;
    }
    
    const klassMethods = klass.getMethods();

    for (const method of klassMethods) {
      // Check limit
      if (limit !== undefined && results.length >= limit) {
        break;
      }
      
      const methodName = method.getName();

      if (matchesPattern(methodName, methodPattern, options)) {
        // Apply custom filter if provided
        if (customFilter && !customFilter(method)) {
          continue;
        }
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
 * @param pattern Wildcard pattern or regex (supports ClassName.FieldName format)
 * @param options FindOptions for regex, limit, filter, etc.
 * @returns Array of matching fields
 *
 * @example
 * // Find all health fields
 * const healthFields = fields(api, "*health*");
 *
 * // Find fields in Player class
 * const playerFields = fields(api, "Player.*");
 * 
 * // Find using regex
 * const privateFields = fields(api, "_.*", { regex: true });
 * 
 * // Find static fields only
 * const staticFields = fields(api, "*", { filter: f => f.isStatic() });
 */
export function fields(api: MonoApi, pattern: string, options: FindOptions = {}): MonoField[] {
  const results: MonoField[] = [];
  let classPattern = "*";
  let fieldPattern = pattern;
  const limit = options.limit;
  const customFilter = options.filter;

  // Parse ClassName.FieldName pattern
  if (pattern.includes(".") && !options.regex) {
    const parts = pattern.split(".");
    classPattern = parts.slice(0, -1).join(".");
    fieldPattern = parts[parts.length - 1];
  }

  // Find matching classes
  const matchingClasses = classes(api, classPattern, { ...options, searchNamespace: true, limit: undefined, filter: undefined });

  for (const klass of matchingClasses) {
    // Check limit
    if (limit !== undefined && results.length >= limit) {
      break;
    }
    
    const klassFields = klass.getFields();

    for (const field of klassFields) {
      // Check limit
      if (limit !== undefined && results.length >= limit) {
        break;
      }
      
      const fieldName = field.getName();

      if (matchesPattern(fieldName, fieldPattern, options)) {
        // Apply custom filter if provided
        if (customFilter && !customFilter(field)) {
          continue;
        }
        results.push(field);
      }
    }
  }

  return results;
}

/**
 * Find properties by name pattern
 *
 * @param api Mono API instance
 * @param pattern Wildcard pattern or regex (supports ClassName.PropertyName format)
 * @param options FindOptions for regex, limit, filter, etc.
 * @returns Array of matching properties
 *
 * @example
 * // Find all Name properties
 * const nameProps = properties(api, "*Name*");
 *
 * // Find properties in Player class
 * const playerProps = properties(api, "Player.*");
 * 
 * // Find using regex
 * const getterProps = properties(api, "get_.*", { regex: true });
 * 
 * // Find read-only properties
 * const readOnly = properties(api, "*", { filter: p => p.setter === null });
 */
export function properties(api: MonoApi, pattern: string, options: FindOptions = {}): MonoProperty[] {
  const results: MonoProperty[] = [];
  let classPattern = "*";
  let propPattern = pattern;
  const limit = options.limit;
  const customFilter = options.filter;

  // Parse ClassName.PropertyName pattern
  if (pattern.includes(".") && !options.regex) {
    const parts = pattern.split(".");
    classPattern = parts.slice(0, -1).join(".");
    propPattern = parts[parts.length - 1];
  }

  // Find matching classes
  const matchingClasses = classes(api, classPattern, { ...options, searchNamespace: true, limit: undefined, filter: undefined });

  for (const klass of matchingClasses) {
    // Check limit
    if (limit !== undefined && results.length >= limit) {
      break;
    }
    
    const klassProperties = klass.getProperties();

    for (const prop of klassProperties) {
      // Check limit
      if (limit !== undefined && results.length >= limit) {
        break;
      }
      
      const propName = prop.getName();

      if (matchesPattern(propName, propPattern, options)) {
        // Apply custom filter if provided
        if (customFilter && !customFilter(prop)) {
          continue;
        }
        results.push(prop);
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
 * const Player = classExact(api, "Game.Player");
 */
export function classExact(api: MonoApi, fullName: string): MonoClass | null {
  const parts = fullName.split(".");
  const className = parts.pop()!;
  const namespace = parts.join(".");

  const domain = MonoDomain.getRoot(api);
  let result: MonoClass | null = null;

  // Enumerate all assemblies and look for the class
  domain.enumerateAssemblies((assembly: MonoAssembly) => {
    if (result !== null) {
      return; // Already found
    }

    const image = assembly.image;
    const klass = image.tryClassFromName(namespace, className);
    
    if (klass !== null) {
      result = klass;
    }
  });

  return result;
}

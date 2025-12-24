/**
 * Test Fixtures
 * Provides pre-configured test contexts with commonly-needed Mono objects
 * to reduce boilerplate in test files.
 *
 * Usage:
 * ```typescript
 * // Instead of:
 * results.push(await createMonoDependentTest("test name", () => {
 *   const domain = Mono.domain;
 *   assertNotNull(domain, "Domain should be available");
 *   const stringClass = domain.tryClass("System.String");
 *   assertNotNull(stringClass, "String class should exist");
 *   // actual test logic
 * }));
 *
 * // Use:
 * results.push(await withCoreClasses("test name", ({ domain, stringClass }) => {
 *   // actual test logic - classes pre-validated
 * }));
 * ```
 */

import Mono from "../src";
import type { MonoArray } from "../src/model/array";
import type { MonoAssembly } from "../src/model/assembly";
import type { MonoClass } from "../src/model/class";
import type { MonoDomain } from "../src/model/domain";
import type { MonoMethod } from "../src/model/method";
import { TestResult, assertNotNull, createMonoDependentTest } from "./test-framework";

// ============================================================================
// FIXTURE INTERFACES
// ============================================================================

/**
 * Basic fixture with just the domain.
 */
export interface DomainFixture {
  domain: MonoDomain;
}

/**
 * Fixture with core .NET types pre-loaded.
 * All classes are validated to exist before the test runs.
 */
export interface CoreClassesFixture extends DomainFixture {
  objectClass: MonoClass;
  stringClass: MonoClass;
  int32Class: MonoClass;
  booleanClass: MonoClass;
}

/**
 * Extended fixture with additional common types.
 */
export interface ExtendedClassesFixture extends CoreClassesFixture {
  int64Class: MonoClass | null;
  doubleClass: MonoClass | null;
  dateTimeClass: MonoClass | null;
  arrayClass: MonoClass | null;
  typeClass: MonoClass | null;
}

/**
 * Numeric types fixture for array and value type tests.
 */
export interface NumericTypesFixture extends CoreClassesFixture {
  byteClass: MonoClass;
  sbyteClass: MonoClass | null;
  int16Class: MonoClass | null;
  uint16Class: MonoClass | null;
  uint32Class: MonoClass | null;
  int64Class: MonoClass | null;
  uint64Class: MonoClass | null;
  singleClass: MonoClass | null;
  doubleClass: MonoClass | null;
}

/**
 * Unity-specific fixture (classes may be null if not in Unity).
 */
export interface UnityFixture extends DomainFixture {
  gameObjectClass: MonoClass | null;
  componentClass: MonoClass | null;
  transformClass: MonoClass | null;
  vector3Class: MonoClass | null;
  monoBehaviourClass: MonoClass | null;
}

// ============================================================================
// FIXTURE SETUP FUNCTIONS
// ============================================================================

/**
 * Set up the basic domain fixture.
 * @throws if domain is not available
 */
export function setupDomainFixture(): DomainFixture {
  const domain = Mono.domain;
  assertNotNull(domain, "Domain should be available");
  return { domain };
}

/**
 * Set up the core classes fixture.
 * @throws if any core class is not available
 */
export function setupCoreClassesFixture(): CoreClassesFixture {
  const { domain } = setupDomainFixture();

  const objectClass = domain.tryClass("System.Object");
  assertNotNull(objectClass, "System.Object class should exist");

  const stringClass = domain.tryClass("System.String");
  assertNotNull(stringClass, "System.String class should exist");

  const int32Class = domain.tryClass("System.Int32");
  assertNotNull(int32Class, "System.Int32 class should exist");

  const booleanClass = domain.tryClass("System.Boolean");
  assertNotNull(booleanClass, "System.Boolean class should exist");

  return {
    domain,
    objectClass,
    stringClass,
    int32Class,
    booleanClass,
  };
}

/**
 * Set up extended classes fixture.
 * Core classes are required; extended classes are optional (null if not found).
 */
export function setupExtendedClassesFixture(): ExtendedClassesFixture {
  const core = setupCoreClassesFixture();

  return {
    ...core,
    int64Class: core.domain.tryClass("System.Int64"),
    doubleClass: core.domain.tryClass("System.Double"),
    dateTimeClass: core.domain.tryClass("System.DateTime"),
    arrayClass: core.domain.tryClass("System.Array"),
    typeClass: core.domain.tryClass("System.Type"),
  };
}

/**
 * Set up numeric types fixture for value type and array tests.
 * Byte is required; other numeric types are optional.
 */
export function setupNumericTypesFixture(): NumericTypesFixture {
  const core = setupCoreClassesFixture();

  const byteClass = core.domain.tryClass("System.Byte");
  assertNotNull(byteClass, "System.Byte class should exist");

  return {
    ...core,
    byteClass,
    sbyteClass: core.domain.tryClass("System.SByte"),
    int16Class: core.domain.tryClass("System.Int16"),
    uint16Class: core.domain.tryClass("System.UInt16"),
    uint32Class: core.domain.tryClass("System.UInt32"),
    int64Class: core.domain.tryClass("System.Int64"),
    uint64Class: core.domain.tryClass("System.UInt64"),
    singleClass: core.domain.tryClass("System.Single"),
    doubleClass: core.domain.tryClass("System.Double"),
  };
}

/**
 * Set up Unity-specific fixture.
 * All Unity classes are optional (null if not in Unity environment).
 */
export function setupUnityFixture(): UnityFixture {
  const { domain } = setupDomainFixture();

  return {
    domain,
    gameObjectClass: domain.tryClass("UnityEngine.GameObject"),
    componentClass: domain.tryClass("UnityEngine.Component"),
    transformClass: domain.tryClass("UnityEngine.Transform"),
    vector3Class: domain.tryClass("UnityEngine.Vector3"),
    monoBehaviourClass: domain.tryClass("UnityEngine.MonoBehaviour"),
  };
}

// ============================================================================
// CONVENIENCE TEST WRAPPERS
// ============================================================================

/**
 * Create a test with just domain access.
 *
 * @example
 * ```typescript
 * results.push(await withDomain("should access domain", ({ domain }) => {
 *   assert(domain.assemblies.length > 0, "Should have assemblies");
 * }));
 * ```
 */
export async function withDomain(
  name: string,
  testFn: (fixture: DomainFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupDomainFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with core .NET classes pre-loaded and validated.
 *
 * @example
 * ```typescript
 * results.push(await withCoreClasses("should find methods on String", ({ stringClass }) => {
 *   const methods = stringClass.methods;
 *   assert(methods.length > 0, "String should have methods");
 * }));
 * ```
 */
export async function withCoreClasses(
  name: string,
  testFn: (fixture: CoreClassesFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupCoreClassesFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with extended .NET classes (core required, extended optional).
 *
 * @example
 * ```typescript
 * results.push(await withExtendedClasses("should handle DateTime", ({ dateTimeClass }) => {
 *   if (!dateTimeClass) {
 *     console.log("  - DateTime not available, skipping");
 *     return;
 *   }
 *   // test DateTime...
 * }));
 * ```
 */
export async function withExtendedClasses(
  name: string,
  testFn: (fixture: ExtendedClassesFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupExtendedClassesFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with numeric types for array/value type testing.
 *
 * @example
 * ```typescript
 * results.push(await withNumericTypes("should handle byte arrays", ({ byteClass, int16Class }) => {
 *   const arr = Mono.array.new(byteClass, 10);
 *   // test numeric arrays...
 * }));
 * ```
 */
export async function withNumericTypes(
  name: string,
  testFn: (fixture: NumericTypesFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupNumericTypesFixture();
    await testFn(fixture);
  });
}

/**
 * Create a Unity-specific test. All Unity classes are optional.
 *
 * @example
 * ```typescript
 * results.push(await withUnity("should access GameObject", ({ gameObjectClass }) => {
 *   if (!gameObjectClass) {
 *     console.log("  - Not in Unity environment, skipping");
 *     return;
 *   }
 *   // test GameObject...
 * }));
 * ```
 */
export async function withUnity(
  name: string,
  testFn: (fixture: UnityFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupUnityFixture();
    await testFn(fixture);
  });
}

// ============================================================================
// COMMON SKIP HELPERS
// ============================================================================

/**
 * Skip helper for optional Unity classes.
 * Returns true if the class is null (test should skip), false if present.
 */
export function skipIfNoUnityClass(klass: MonoClass | null, className: string): boolean {
  if (klass === null) {
    console.log(`  - ${className} not available (not Unity?), skipping`);
    return true;
  }
  return false;
}

/**
 * Skip helper for optional extended classes.
 */
export function skipIfNoClass(klass: MonoClass | null, className: string): boolean {
  if (klass === null) {
    console.log(`  - ${className} not available, skipping`);
    return true;
  }
  return false;
}

// ============================================================================
// COMMON TEST PATTERNS
// ============================================================================

/**
 * Common string class names used in tests.
 */
export const CORE_CLASS_NAMES = {
  OBJECT: "System.Object",
  STRING: "System.String",
  INT32: "System.Int32",
  INT64: "System.Int64",
  BOOLEAN: "System.Boolean",
  DOUBLE: "System.Double",
  DATETIME: "System.DateTime",
  ARRAY: "System.Array",
  TYPE: "System.Type",
} as const;

/**
 * Unity class names for tests.
 */
export const UNITY_CLASS_NAMES = {
  GAME_OBJECT: "UnityEngine.GameObject",
  COMPONENT: "UnityEngine.Component",
  TRANSFORM: "UnityEngine.Transform",
  VECTOR3: "UnityEngine.Vector3",
  MONO_BEHAVIOUR: "UnityEngine.MonoBehaviour",
} as const;

// ============================================================================
// EXTENDED FIXTURES (Added in refactoring)
// ============================================================================

/**
 * Method-related fixture with pre-configured test methods.
 * Provides common methods for testing method invocation and signatures.
 */
export interface MethodFixture extends CoreClassesFixture {
  concatMethod: MonoMethod; // String.Concat(string, string)
  parseMethod: MonoMethod; // Int32.Parse(string)
  getLengthMethod: MonoMethod; // String.get_Length()
}

/**
 * Array-related fixture with array class and test arrays.
 * Includes pre-created test arrays for common scenarios.
 */
export interface ArrayFixture extends ExtendedClassesFixture {
  arrayClass: MonoClass;
  int32Array: MonoArray | null; // Pre-created Int32[] test array
  stringArray: MonoArray | null; // Pre-created String[] test array
}

/**
 * Generic-related fixture for testing generic types.
 * All generic classes are optional (null if not available).
 */
export interface GenericFixture extends CoreClassesFixture {
  listClass: MonoClass | null; // List<T> generic definition
  dictionaryClass: MonoClass | null; // Dictionary<K,V> generic definition
  nullableClass: MonoClass | null; // Nullable<T>
  instantiatedIntList: MonoClass | null; // List<Int32> instantiated type
}

/**
 * Assembly-related fixture for testing assembly operations.
 * All assemblies are optional (null if not available).
 */
export interface AssemblyFixture extends DomainFixture {
  mscorlib: MonoAssembly | null;
  unityCore: MonoAssembly | null;
  assemblyCSharp: MonoAssembly | null;
}

// ============================================================================
// EXTENDED FIXTURE SETUP FUNCTIONS
// ============================================================================

/**
 * Set up method fixture with common test methods.
 * @throws if any core method is not available
 */
export function setupMethodFixture(): MethodFixture {
  const core = setupCoreClassesFixture();

  // String.Concat(string, string) - static method
  const concatMethod = core.stringClass.tryMethod("Concat", 2);
  assertNotNull(concatMethod, "String.Concat(string, string) method should exist");

  // Int32.Parse(string) - static method
  const parseMethod = core.int32Class.tryMethod("Parse", 1);
  assertNotNull(parseMethod, "Int32.Parse(string) method should exist");

  // String.get_Length() - instance property getter
  const getLengthMethod = core.stringClass.tryMethod("get_Length", 0);
  assertNotNull(getLengthMethod, "String.get_Length() method should exist");

  return {
    ...core,
    concatMethod,
    parseMethod,
    getLengthMethod,
  };
}

/**
 * Set up array fixture with array class and test arrays.
 * Core classes are required; arrays are optional (null if creation fails).
 */
export function setupArrayFixture(): ArrayFixture {
  const extended = setupExtendedClassesFixture();

  const arrayClass = extended.arrayClass;
  assertNotNull(arrayClass, "System.Array class should exist");

  // Try to create test arrays using Mono.array.new
  let int32Array: MonoArray | null = null;
  let stringArray: MonoArray | null = null;

  try {
    int32Array = Mono.array.new(extended.int32Class, 5);
    // Initialize values
    for (let i = 0; i < 5; i++) {
      int32Array.setNumber(i, i + 1);
    }
  } catch (error) {
    console.log("  - Could not create Int32[] test array");
  }

  try {
    stringArray = Mono.array.new(extended.stringClass, 2);
    // Note: String arrays need object references, which is more complex
  } catch (error) {
    console.log("  - Could not create String[] test array");
  }

  return {
    ...extended,
    arrayClass,
    int32Array,
    stringArray,
  };
}

/**
 * Set up generic fixture for testing generic types.
 * Core classes are required; generic classes are optional.
 */
export function setupGenericFixture(): GenericFixture {
  const core = setupCoreClassesFixture();

  return {
    ...core,
    listClass: core.domain.tryClass("System.Collections.Generic.List`1"),
    dictionaryClass: core.domain.tryClass("System.Collections.Generic.Dictionary`2"),
    nullableClass: core.domain.tryClass("System.Nullable`1"),
    instantiatedIntList: core.domain.tryClass("System.Collections.Generic.List`1[System.Int32]"),
  };
}

/**
 * Set up assembly fixture for testing assembly operations.
 * Domain is required; assemblies are optional (null if not available).
 */
export function setupAssemblyFixture(): AssemblyFixture {
  const { domain } = setupDomainFixture();

  return {
    domain,
    mscorlib: domain.tryAssembly("mscorlib") || domain.tryAssembly("System.Private.CoreLib"),
    unityCore: domain.tryAssembly("UnityEngine.CoreModule") || domain.tryAssembly("UnityEngine"),
    assemblyCSharp: domain.tryAssembly("Assembly-CSharp"),
  };
}

// ============================================================================
// EXTENDED CONVENIENCE TEST WRAPPERS
// ============================================================================

/**
 * Create a test with pre-configured test methods.
 *
 * @example
 * ```typescript
 * results.push(await withMethods("should invoke Concat", ({ concatMethod }) => {
 *   const result = concatMethod.invoke(null, ["Hello", "World"]);
 *   assert(result.toString() === "HelloWorld", "Should concat strings");
 * }));
 * ```
 */
export async function withMethods(
  name: string,
  testFn: (fixture: MethodFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupMethodFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with array class and test arrays.
 *
 * @example
 * ```typescript
 * results.push(await withArrays("should access array elements", ({ int32Array }) => {
 *   if (!int32Array) return;
 *   const length = int32Array.length;
 *   assert(length === 5, "Array should have 5 elements");
 * }));
 * ```
 */
export async function withArrays(
  name: string,
  testFn: (fixture: ArrayFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupArrayFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with generic types.
 *
 * @example
 * ```typescript
 * results.push(await withGenerics("should handle generic types", ({ listClass }) => {
 *   if (!listClass) return;
 *   assert(listClass.isGenericTypeDefinition, "Should be generic type definition");
 * }));
 * ```
 */
export async function withGenerics(
  name: string,
  testFn: (fixture: GenericFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupGenericFixture();
    await testFn(fixture);
  });
}

/**
 * Create a test with assemblies.
 *
 * @example
 * ```typescript
 * results.push(await withAssemblies("should access assemblies", ({ mscorlib }) => {
 *   if (!mscorlib) return;
 *   assert(mscorlib.name === "mscorlib", "Should be mscorlib");
 * }));
 * ```
 */
export async function withAssemblies(
  name: string,
  testFn: (fixture: AssemblyFixture) => void | Promise<void>,
): Promise<TestResult> {
  return createMonoDependentTest(name, async () => {
    const fixture = setupAssemblyFixture();
    await testFn(fixture);
  });
}

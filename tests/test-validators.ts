/**
 * Test Validators
 * Centralized validation helpers for metadata, signatures, and common patterns.
 * Reduces code duplication by providing reusable validation functions for
 * Mono object metadata verification.
 *
 * Usage:
 * ```typescript
 * // Instead of:
 * const summary = field.getSummary();
 * assertNotNull(summary, "Summary should be available");
 * assert(typeof summary.name === "string", "Should have name");
 * assert(typeof summary.flags === "number", "Should have flags");
 * // ... 10+ lines of repetitive validation
 *
 * // Use:
 * verifyFieldSummary(field);
 * ```
 */

import type { MonoField } from "../src/model/field";
import type { MonoMethod } from "../src/model/method";
import type { MonoProperty } from "../src/model/property";
import type { MonoClass } from "../src/model/class";
import { assert, assertNotNull } from "./test-framework";

// ============================================================================
// FIELD VALIDATORS
// ============================================================================

/**
 * Expected metadata for field validation.
 */
export interface FieldMetadataExpectations {
  name: string;
  typeName?: string;           // e.g. "Int32", "String"
  isStatic?: boolean;
  isLiteral?: boolean;
  isInitOnly?: boolean;
  accessibility?: string;      // "public", "private", etc.
  offset?: number;
}

/**
 * Verify field metadata against expectations.
 * Validates name, type, flags, and other field properties.
 *
 * @example
 * ```typescript
 * verifyFieldMetadata(maxValueField, {
 *   name: "MaxValue",
 *   typeName: "Int32",
 *   isStatic: true,
 *   isLiteral: true
 * });
 * ```
 */
export function verifyFieldMetadata(
  field: MonoField,
  expectations: FieldMetadataExpectations,
): void {
  assert(
    field.name === expectations.name,
    `Field name should be ${expectations.name}, got ${field.name}`,
  );

  if (expectations.typeName !== undefined) {
    const fieldType = field.type;
    assertNotNull(fieldType, "Field should have type");
    assert(
      fieldType.name === expectations.typeName ||
        fieldType.fullName === `System.${expectations.typeName}`,
      `Field type should be ${expectations.typeName}, got ${fieldType.name}`,
    );
  }

  if (expectations.isStatic !== undefined) {
    assert(
      field.isStatic === expectations.isStatic,
      `Field isStatic should be ${expectations.isStatic}, got ${field.isStatic}`,
    );
  }

  if (expectations.isLiteral !== undefined) {
    assert(
      field.isLiteral === expectations.isLiteral,
      `Field isLiteral should be ${expectations.isLiteral}, got ${field.isLiteral}`,
    );
  }

  if (expectations.isInitOnly !== undefined) {
    assert(
      field.isInitOnly === expectations.isInitOnly,
      `Field isInitOnly should be ${expectations.isInitOnly}, got ${field.isInitOnly}`,
    );
  }

  if (expectations.accessibility !== undefined) {
    assert(
      field.accessibility === expectations.accessibility,
      `Field accessibility should be ${expectations.accessibility}, got ${field.accessibility}`,
    );
  }
}

/**
 * Verify that field.getSummary() returns valid structure.
 * Checks for presence and types of all expected summary fields.
 */
export function verifyFieldSummary(field: MonoField): void {
  const summary = field.getSummary();

  assertNotNull(summary, "Field summary should be available");
  assert(typeof summary.name === "string", "Summary should have name");
  assert(typeof summary.flags === "number", "Summary should have flags");
  assert(typeof summary.isStatic === "boolean", "Summary should have isStatic");
  assert(typeof summary.offset === "number", "Summary should have offset");
}

// ============================================================================
// METHOD VALIDATORS
// ============================================================================

/**
 * Expected method signature for validation.
 */
export interface MethodSignatureExpectations {
  name: string;
  parameterCount: number;
  returnTypeName?: string;
  isStatic?: boolean;
  isVirtual?: boolean;
  isAbstract?: boolean;
  accessibility?: string;
  parameterTypes?: string[];   // Parameter type names array
}

/**
 * Verify method signature against expectations.
 * Validates name, parameter count, return type, and method attributes.
 *
 * @example
 * ```typescript
 * verifyMethodSignature(concatMethod, {
 *   name: "Concat",
 *   parameterCount: 2,
 *   returnTypeName: "String",
 *   isStatic: true,
 *   parameterTypes: ["String", "String"]
 * });
 * ```
 */
export function verifyMethodSignature(
  method: MonoMethod,
  expectations: MethodSignatureExpectations,
): void {
  assert(
    method.name === expectations.name,
    `Method name should be ${expectations.name}, got ${method.name}`,
  );

  assert(
    method.parameterCount === expectations.parameterCount,
    `Method should have ${expectations.parameterCount} parameters, got ${method.parameterCount}`,
  );

  if (expectations.returnTypeName !== undefined) {
    const returnType = method.returnType;
    assertNotNull(returnType, "Method should have return type");
    assert(
      returnType.name === expectations.returnTypeName ||
        returnType.fullName === `System.${expectations.returnTypeName}`,
      `Return type should be ${expectations.returnTypeName}, got ${returnType.name}`,
    );
  }

  if (expectations.isStatic !== undefined) {
    assert(
      method.isStatic === expectations.isStatic,
      `Method isStatic should be ${expectations.isStatic}, got ${method.isStatic}`,
    );
  }

  if (expectations.isVirtual !== undefined) {
    assert(
      method.isVirtual === expectations.isVirtual,
      `Method isVirtual should be ${expectations.isVirtual}, got ${method.isVirtual}`,
    );
  }

  if (expectations.isAbstract !== undefined) {
    assert(
      method.isAbstract === expectations.isAbstract,
      `Method isAbstract should be ${expectations.isAbstract}, got ${method.isAbstract}`,
    );
  }

  if (expectations.accessibility !== undefined) {
    assert(
      method.accessibility === expectations.accessibility,
      `Method accessibility should be ${expectations.accessibility}, got ${method.accessibility}`,
    );
  }

  if (expectations.parameterTypes !== undefined) {
    const params = method.parameters;
    assert(
      params.length === expectations.parameterTypes.length,
      "Parameter count should match expectations",
    );

    expectations.parameterTypes.forEach((expectedType, index) => {
      const param = params[index];
      assert(
        param.type.name === expectedType ||
          param.type.fullName === `System.${expectedType}`,
        `Parameter ${index} type should be ${expectedType}, got ${param.type.name}`,
      );
    });
  }
}

/**
 * Verify that method.describe() returns valid structure.
 * Checks for presence and types of all expected describe() fields.
 */
export function verifyMethodDescribe(method: MonoMethod): void {
  const summary = method.describe();

  assertNotNull(summary, "Method describe() should return value");
  assert(typeof summary.name === "string", "describe() should have name");
  assert(typeof summary.declaringType === "string", "describe() should have declaringType");
  assert(typeof summary.attributes === "number", "describe() should have attributes");
  assert(Array.isArray(summary.attributeNames), "describe() should have attributeNames");
  assert(typeof summary.isStatic === "boolean", "describe() should have isStatic");
  assert(typeof summary.parameterCount === "number", "describe() should have parameterCount");
  assert(Array.isArray(summary.parameters), "describe() should have parameters array");
}

// ============================================================================
// PROPERTY VALIDATORS
// ============================================================================

/**
 * Expected property metadata for validation.
 */
export interface PropertyMetadataExpectations {
  name: string;
  typeName?: string;
  canRead?: boolean;
  canWrite?: boolean;
  isStatic?: boolean;
  isIndexer?: boolean;
  hasParameters?: boolean;
}

/**
 * Verify property metadata against expectations.
 * Validates name, type, accessors, and property attributes.
 *
 * @example
 * ```typescript
 * verifyPropertyMetadata(lengthProperty, {
 *   name: "Length",
 *   typeName: "Int32",
 *   canRead: true,
 *   canWrite: false,
 *   isStatic: false
 * });
 * ```
 */
export function verifyPropertyMetadata(
  property: MonoProperty,
  expectations: PropertyMetadataExpectations,
): void {
  assert(
    property.name === expectations.name,
    `Property name should be ${expectations.name}, got ${property.name}`,
  );

  if (expectations.typeName !== undefined) {
    const propType = property.type;
    assertNotNull(propType, "Property should have type");
    assert(
      propType.name === expectations.typeName ||
        propType.fullName === `System.${expectations.typeName}`,
      `Property type should be ${expectations.typeName}, got ${propType.name}`,
    );
  }

  if (expectations.canRead !== undefined) {
    assert(
      property.canRead === expectations.canRead,
      `Property canRead should be ${expectations.canRead}, got ${property.canRead}`,
    );
  }

  if (expectations.canWrite !== undefined) {
    assert(
      property.canWrite === expectations.canWrite,
      `Property canWrite should be ${expectations.canWrite}, got ${property.canWrite}`,
    );
  }

  if (expectations.isStatic !== undefined) {
    assert(
      property.isStatic === expectations.isStatic,
      `Property isStatic should be ${expectations.isStatic}, got ${property.isStatic}`,
    );
  }

  if (expectations.isIndexer !== undefined) {
    assert(
      property.isIndexer === expectations.isIndexer,
      `Property isIndexer should be ${expectations.isIndexer}, got ${property.isIndexer}`,
    );
  }

  if (expectations.hasParameters !== undefined) {
    assert(
      property.hasParameters === expectations.hasParameters,
      `Property hasParameters should be ${expectations.hasParameters}, got ${property.hasParameters}`,
    );
  }
}

/**
 * Verify that property.getSummary() returns valid structure.
 * Checks for presence and types of all expected summary fields.
 */
export function verifyPropertySummary(property: MonoProperty): void {
  const summary = property.getSummary();

  assertNotNull(summary, "Property getSummary() should return value");
  assert(typeof summary.name === "string", "Summary should have name");
  assert(typeof summary.typeName === "string", "Summary should have typeName");
  assert(typeof summary.canRead === "boolean", "Summary should have canRead");
  assert(typeof summary.canWrite === "boolean", "Summary should have canWrite");
  assert(typeof summary.isStatic === "boolean", "Summary should have isStatic");
  assert(typeof summary.isIndexer === "boolean", "Summary should have isIndexer");
}

// ============================================================================
// CLASS VALIDATORS
// ============================================================================

/**
 * Expected class metadata for validation.
 */
export interface ClassMetadataExpectations {
  name: string;
  namespace?: string;
  fullName?: string;
  isAbstract?: boolean;
  isInterface?: boolean;
  isValueType?: boolean;
  isEnum?: boolean;
  parentClassName?: string;
  implementsInterfaces?: string[];
}

/**
 * Verify class metadata against expectations.
 * Validates name, namespace, type attributes, and inheritance.
 *
 * @example
 * ```typescript
 * verifyClassMetadata(stringClass, {
 *   name: "String",
 *   namespace: "System",
 *   fullName: "System.String",
 *   isValueType: false
 * });
 * ```
 */
export function verifyClassMetadata(
  klass: MonoClass,
  expectations: ClassMetadataExpectations,
): void {
  assert(
    klass.name === expectations.name,
    `Class name should be ${expectations.name}, got ${klass.name}`,
  );

  if (expectations.namespace !== undefined) {
    assert(
      klass.namespace === expectations.namespace,
      `Class namespace should be ${expectations.namespace}, got ${klass.namespace}`,
    );
  }

  if (expectations.fullName !== undefined) {
    assert(
      klass.fullName === expectations.fullName,
      `Class fullName should be ${expectations.fullName}, got ${klass.fullName}`,
    );
  }

  if (expectations.isAbstract !== undefined) {
    assert(
      klass.isAbstract === expectations.isAbstract,
      `Class isAbstract should be ${expectations.isAbstract}, got ${klass.isAbstract}`,
    );
  }

  if (expectations.isInterface !== undefined) {
    assert(
      klass.isInterface === expectations.isInterface,
      `Class isInterface should be ${expectations.isInterface}, got ${klass.isInterface}`,
    );
  }

  if (expectations.isValueType !== undefined) {
    assert(
      klass.isValueType === expectations.isValueType,
      `Class isValueType should be ${expectations.isValueType}, got ${klass.isValueType}`,
    );
  }

  if (expectations.isEnum !== undefined) {
    assert(
      klass.isEnum === expectations.isEnum,
      `Class isEnum should be ${expectations.isEnum}, got ${klass.isEnum}`,
    );
  }

  if (expectations.parentClassName !== undefined) {
    const parent = klass.parent;
    assertNotNull(parent, "Class should have parent");
    assert(
      parent.name === expectations.parentClassName,
      `Parent class should be ${expectations.parentClassName}, got ${parent.name}`,
    );
  }

  if (expectations.implementsInterfaces !== undefined) {
    expectations.implementsInterfaces.forEach(interfaceName => {
      const interfaceClass = klass.image.tryClass(interfaceName);
      if (interfaceClass) {
        assert(
          klass.implementsInterface(interfaceClass),
          `Class should implement ${interfaceName}`,
        );
      }
    });
  }
}

// ============================================================================
// COMMON VALIDATION PATTERNS
// ============================================================================

/**
 * Verify that an object has basic metadata capabilities.
 * Checks for presence of toString() and describe() methods.
 */
export function verifyHasBasicMetadata(obj: any, typeName: string): void {
  assert(
    typeof obj.toString === "function",
    `${typeName} should have toString method`,
  );
  assert(
    typeof obj.describe === "function",
    `${typeName} should have describe method`,
  );
}

/**
 * Verify that a class is a collection type.
 * Checks for Add method and Count property.
 */
export function verifyCollectionType(
  klass: MonoClass,
  expectedElementType?: string,
): void {
  assert(
    klass.methods.some(m => m.name === "Add"),
    "Collection should have Add method",
  );
  assert(
    klass.properties.some(p => p.name === "Count"),
    "Collection should have Count property",
  );

  if (expectedElementType !== undefined) {
    // Check generic parameter
    const fullName = klass.fullName;
    assert(
      fullName.includes(expectedElementType),
      `Collection should contain ${expectedElementType} in full name`,
    );
  }
}

/**
 * Verify that a class is an enum with expected values.
 * Checks isEnum flag and validates enum field names.
 */
export function verifyEnumType(klass: MonoClass, expectedValues: string[]): void {
  assert(klass.isEnum, "Class should be enum");

  const fields = klass.fields;
  expectedValues.forEach(valueName => {
    const field = fields.find(f => f.name === valueName);
    assertNotNull(field, `Enum should have value ${valueName}`);
    assert(field!.isLiteral, `Enum value ${valueName} should be literal`);
  });
}

// ============================================================================
// ASSEMBLY VALIDATORS
// ============================================================================

/**
 * Expectations for assembly version validation.
 */
export interface AssemblyVersionExpectations {
  major?: number;
  minor?: number;
  build?: number;
  revision?: number;
}

/**
 * Verify assembly version structure.
 * Validates that version object has all required numeric properties.
 */
export function verifyAssemblyVersion(
  version: any,
  expectations?: AssemblyVersionExpectations,
): void {
  assertNotNull(version, "Version should be available");
  assert(typeof version.major === "number", "Version major should be number");
  assert(typeof version.minor === "number", "Version minor should be number");
  assert(typeof version.build === "number", "Version build should be number");
  assert(typeof version.revision === "number", "Version revision should be number");

  if (expectations) {
    if (expectations.major !== undefined) {
      assert(version.major === expectations.major, `Version major should be ${expectations.major}`);
    }
    if (expectations.minor !== undefined) {
      assert(version.minor === expectations.minor, `Version minor should be ${expectations.minor}`);
    }
    if (expectations.build !== undefined) {
      assert(version.build === expectations.build, `Version build should be ${expectations.build}`);
    }
    if (expectations.revision !== undefined) {
      assert(
        version.revision === expectations.revision,
        `Version revision should be ${expectations.revision}`,
      );
    }
  }
}

/**
 * Expectations for assembly metadata validation.
 */
export interface AssemblyMetadataExpectations {
  name?: string;
  fullName?: string;
  culture?: string;
  hasVersion?: boolean;
  isSystemAssembly?: boolean;
  isUserAssembly?: boolean;
}

/**
 * Verify assembly basic metadata.
 * Validates name, fullName, culture, version, and classification.
 */
export function verifyAssemblyMetadata(
  assembly: any,
  expectations?: AssemblyMetadataExpectations,
): void {
  assertNotNull(assembly, "Assembly should exist");
  assertNotNull(assembly.name, "Assembly name should be available");
  assert(typeof assembly.name === "string", "Assembly name should be string");

  if (expectations) {
    if (expectations.name) {
      assert(assembly.name === expectations.name, `Assembly name should be ${expectations.name}`);
    }

    if (expectations.fullName !== undefined) {
      const fullName = assembly.fullName;
      assertNotNull(fullName, "Full name should be available");
      if (expectations.fullName) {
        assert(
          fullName.includes(expectations.fullName),
          `Full name should include ${expectations.fullName}`,
        );
      }
    }

    if (expectations.culture !== undefined) {
      const culture = assembly.culture;
      assertNotNull(culture, "Culture should be available");
      assert(typeof culture === "string", "Culture should be string");
      if (expectations.culture) {
        assert(culture === expectations.culture, `Culture should be ${expectations.culture}`);
      }
    }

    if (expectations.hasVersion) {
      const version = assembly.version;
      verifyAssemblyVersion(version);
    }

    if (expectations.isSystemAssembly !== undefined) {
      assert(
        assembly.isSystemAssembly === expectations.isSystemAssembly,
        `Assembly ${expectations.isSystemAssembly ? "should" : "should not"} be system assembly`,
      );
    }

    if (expectations.isUserAssembly !== undefined) {
      assert(
        assembly.isUserAssembly === expectations.isUserAssembly,
        `Assembly ${expectations.isUserAssembly ? "should" : "should not"} be user assembly`,
      );
    }
  }
}

/**
 * Verify assembly performance stats structure.
 * Validates that performance stats object has all required properties.
 */
export function verifyPerformanceStats(stats: any, assemblyName?: string): void {
  assertNotNull(stats, "Performance stats should be available");
  assert(typeof stats.assemblyName === "string", "assemblyName should be string");
  assert(typeof stats.classCount === "number", "classCount should be number");
  assert(typeof stats.methodCount === "number", "methodCount should be number");
  assert(typeof stats.fieldCount === "number", "fieldCount should be number");
  assert(typeof stats.classLookupTime === "number", "classLookupTime should be number");
  assert(typeof stats.methodLookupTime === "number", "methodLookupTime should be number");
  assert(typeof stats.fieldAccessTime === "number", "fieldAccessTime should be number");
  assert(typeof stats.totalMemoryUsage === "number", "totalMemoryUsage should be number");
  assert(typeof stats.cacheHitRate === "number", "cacheHitRate should be number");

  assert(stats.classCount >= 0, "classCount should be non-negative");
  assert(stats.totalMemoryUsage > 0, "totalMemoryUsage should be positive");
  assert(
    stats.cacheHitRate >= 0 && stats.cacheHitRate <= 1,
    "cacheHitRate should be between 0 and 1",
  );

  if (assemblyName) {
    assert(
      stats.assemblyName === assemblyName,
      `assemblyName should be ${assemblyName}, got ${stats.assemblyName}`,
    );
  }
}

/**
 * Verify assembly dependency tree structure.
 * Validates that dependency tree has required properties.
 */
export function verifyDependencyTree(dependencyTree: any): void {
  assertNotNull(dependencyTree, "Dependency tree should be available");
  assertNotNull(dependencyTree.root, "Dependency tree should have root");
  assert(typeof dependencyTree.totalAssemblies === "number", "Should have total assemblies count");
  assert(typeof dependencyTree.maxDepth === "number", "Should have max depth");
  assert(dependencyTree.totalAssemblies >= 0, "Total assemblies should be non-negative");
  assert(dependencyTree.maxDepth >= 0, "Max depth should be non-negative");
}

/**
 * Verify assembly detailed info structure.
 * Validates that detailed info has all required sections.
 */
export function verifyDetailedInfo(detailedInfo: any, assemblyName?: string): void {
  assertNotNull(detailedInfo, "Detailed info should be available");
  assertNotNull(detailedInfo.basic, "Basic info should be available");
  assertNotNull(detailedInfo.classification, "Classification should be available");
  assertNotNull(detailedInfo.statistics, "Statistics should be available");
  assertNotNull(detailedInfo.analysis, "Analysis should be available");

  if (assemblyName) {
    assert(
      detailedInfo.basic.name === assemblyName,
      `Basic info name should be ${assemblyName}`,
    );
  }
}

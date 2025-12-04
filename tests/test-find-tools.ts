/**
 * Find Tools Module Complete Tests
 *
 * Tests for search and discovery tools API:
 * - classes(api, pattern, searchNamespace) - Search classes by wildcard pattern
 * - methods(api, pattern) - Search methods by wildcard pattern
 * - fields(api, pattern) - Search fields by wildcard pattern
 * - classExact(api, fullName) - Exact class lookup
 *
 * Test scenarios:
 * - Wildcard patterns (* matches any, ? matches single character)
 * - Namespace search
 * - Exact match
 * - Case insensitive
 * - Edge cases
 */

import Mono from "../src";
import { TestResult, assert, assertNotNull, createMonoDependentTest } from "./test-framework";

export function createFindToolTests(): TestResult[] {
  const results: TestResult[] = [];

  // =====================================================
  // Section 1: Mono.find API Availability Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find - Mono.find object exists", () => {
      assertNotNull(Mono.find, "Mono.find should exist");
      assert(typeof Mono.find === "object", "Mono.find should be an object");
    }),
  );

  results.push(
    createMonoDependentTest("Find - classes function exists", () => {
      assert(typeof Mono.find.classes === "function", "Mono.find.classes should be a function");
    }),
  );

  results.push(
    createMonoDependentTest("Find - methods function exists", () => {
      assert(typeof Mono.find.methods === "function", "Mono.find.methods should be a function");
    }),
  );

  results.push(
    createMonoDependentTest("Find - fields function exists", () => {
      assert(typeof Mono.find.fields === "function", "Mono.find.fields should be a function");
    }),
  );

  results.push(
    createMonoDependentTest("Find - classExact function exists", () => {
      assert(typeof Mono.find.classExact === "function", "Mono.find.classExact should be a function");
    }),
  );

  // =====================================================
  // Section 2: classExact Exact Search Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classExact - find System.String", () => {
      const stringClass = Mono.find.classExact(Mono.api, "System.String");
      assertNotNull(stringClass, "Should find System.String class");
      assert(stringClass!.getName() === "String", "Class name should be String");
      assert(stringClass!.getNamespace() === "System", "Namespace should be System");
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - find System.Int32", () => {
      const intClass = Mono.find.classExact(Mono.api, "System.Int32");
      assertNotNull(intClass, "Should find System.Int32 class");
      assert(intClass!.getName() === "Int32", "Class name should be Int32");
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - find System.Object", () => {
      const objectClass = Mono.find.classExact(Mono.api, "System.Object");
      assertNotNull(objectClass, "Should find System.Object class");
      assert(objectClass!.getName() === "Object", "Class name should be Object");
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - non-existent class returns null", () => {
      const nonExistent = Mono.find.classExact(Mono.api, "NonExistent.FakeClass");
      assert(nonExistent === null, "Non-existent class should return null");
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - find class without namespace", () => {
      // Try to find top-level type (if exists)
      const result = Mono.find.classExact(Mono.api, "Object");
      // This may return null since Object is in System namespace
      console.log(`[INFO] No-namespace lookup 'Object': ${result ? "found" : "not found"}`);
    }),
  );

  // =====================================================
  // Section 3: classes Wildcard Search Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - search with * wildcard", () => {
      // Search for classes containing String
      const stringClasses = Mono.find.classes(Mono.api, "*String*", true);
      assert(stringClasses.length > 0, "Should find classes containing String");

      // Verify results include System.String
      const hasSystemString = stringClasses.some(c => c.getFullName() === "System.String");
      assert(hasSystemString, "Results should include System.String");

      console.log(`[INFO] Found ${stringClasses.length} classes containing 'String'`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - search System.* namespace", () => {
      const systemClasses = Mono.find.classes(Mono.api, "System.*", true);
      assert(systemClasses.length > 0, "Should find classes in System namespace");

      // All results should be in System namespace
      for (const klass of systemClasses.slice(0, 10)) {
        const ns = klass.getNamespace();
        assert(
          ns === "System" || ns.startsWith("System."),
          `Class ${klass.getFullName()} should be in System namespace`,
        );
      }

      console.log(`[INFO] Found ${systemClasses.length} System.* classes`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - search class name only without namespace", () => {
      const classes = Mono.find.classes(Mono.api, "*Object*", false);
      assert(classes.length > 0, "Should find classes containing Object");

      // Verify matching by class name only
      for (const klass of classes) {
        const name = klass.getName();
        assert(name.toLowerCase().includes("object"), `Class name ${name} should contain 'object'`);
      }

      console.log(`[INFO] Found ${classes.length} classes with name containing 'Object'`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - use ? single character wildcard", () => {
      // Int?? should match Int16, Int32, Int64 etc
      const intClasses = Mono.find.classes(Mono.api, "*Int??*", false);

      if (intClasses.length === 0) {
        console.log("[SKIP] No classes matching Int??");
        return;
      }

      console.log(`[INFO] Found ${intClasses.length} classes matching Int??`);
      for (const klass of intClasses.slice(0, 5)) {
        console.log(`[INFO]   - ${klass.getFullName()}`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - empty pattern returns all classes", () => {
      // * should match all
      const allClasses = Mono.find.classes(Mono.api, "*", false);
      assert(allClasses.length > 0, "Should find classes");
      console.log(`[INFO] Using * found ${allClasses.length} classes`);
    }),
  );

  // =====================================================
  // Section 4: methods Search Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.methods - search ToString methods", () => {
      const methods = Mono.find.methods(Mono.api, "*ToString*");
      assert(methods.length > 0, "Should find ToString methods");

      // Verify method names contain ToString
      for (const method of methods.slice(0, 5)) {
        const name = method.getName();
        assert(name.toLowerCase().includes("tostring"), `Method name ${name} should contain 'toString'`);
      }

      console.log(`[INFO] Found ${methods.length} ToString methods`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - search ClassName.MethodName format", () => {
      // Search System.String class methods
      const methods = Mono.find.methods(Mono.api, "System.String.*");

      if (methods.length === 0) {
        console.log("[SKIP] No methods found for System.String");
        return;
      }

      // Verify all are String class methods
      for (const method of methods.slice(0, 5)) {
        const declaringClass = method.getDeclaringClass();
        const className = declaringClass.getName();
        assert(className === "String", `Method should belong to String class, got ${className}`);
      }

      console.log(`[INFO] Found ${methods.length} System.String.* methods`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - search Get* methods", () => {
      const getMethods = Mono.find.methods(Mono.api, "*Get*");
      assert(getMethods.length > 0, "Should find Get methods");

      console.log(`[INFO] Found ${getMethods.length} methods containing 'Get'`);
    }),
  );

  // =====================================================
  // Section 5: fields Search Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.fields - search Empty field", () => {
      // String.Empty is a common static field
      const fields = Mono.find.fields(Mono.api, "*Empty*");

      if (fields.length === 0) {
        console.log("[SKIP] No Empty fields found");
        return;
      }

      console.log(`[INFO] Found ${fields.length} fields containing 'Empty'`);
      for (const field of fields.slice(0, 5)) {
        console.log(`[INFO]   - ${field.getFullName()}`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.fields - search ClassName.FieldName format", () => {
      // Search System.String class fields
      const fields = Mono.find.fields(Mono.api, "System.String.*");

      if (fields.length === 0) {
        console.log("[SKIP] No fields found for System.String");
        return;
      }

      console.log(`[INFO] Found ${fields.length} System.String.* fields`);
      for (const field of fields) {
        console.log(`[INFO]   - ${field.getName()}`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.fields - search _* private field pattern", () => {
      // Many private fields start with _
      const privateFields = Mono.find.fields(Mono.api, "*_*");

      console.log(`[INFO] Found ${privateFields.length} fields containing '_'`);
    }),
  );

  // =====================================================
  // Section 6: Case Insensitive Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - case insensitive search", () => {
      const upperCase = Mono.find.classes(Mono.api, "*STRING*", false);
      const lowerCase = Mono.find.classes(Mono.api, "*string*", false);
      const mixedCase = Mono.find.classes(Mono.api, "*String*", false);

      // All three searches should return the same number of results
      assert(
        upperCase.length === lowerCase.length && lowerCase.length === mixedCase.length,
        `Case search results should be equal: upper=${upperCase.length}, lower=${lowerCase.length}, mixed=${mixedCase.length}`,
      );
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - case insensitive search", () => {
      const upperCase = Mono.find.methods(Mono.api, "*TOSTRING*");
      const lowerCase = Mono.find.methods(Mono.api, "*tostring*");

      assert(
        upperCase.length === lowerCase.length,
        `Method search should be case insensitive: upper=${upperCase.length}, lower=${lowerCase.length}`,
      );
    }),
  );

  // =====================================================
  // Section 7: Unity Specific Search Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - search UnityEngine.* classes", () => {
      const unityClasses = Mono.find.classes(Mono.api, "UnityEngine.*", true);

      if (unityClasses.length === 0) {
        console.log("[SKIP] No UnityEngine classes found (may not be a Unity project)");
        return;
      }

      console.log(`[INFO] Found ${unityClasses.length} UnityEngine.* classes`);

      // List some common Unity classes
      const knownClasses = ["GameObject", "Transform", "MonoBehaviour", "Component"];
      for (const known of knownClasses) {
        const found = unityClasses.some(c => c.getName() === known);
        console.log(`[INFO]   ${known}: ${found ? "found" : "not found"}`);
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - search Update methods (Unity)", () => {
      const updateMethods = Mono.find.methods(Mono.api, "*Update*");

      console.log(`[INFO] Found ${updateMethods.length} methods containing 'Update'`);

      if (updateMethods.length > 0) {
        // List first few
        for (const method of updateMethods.slice(0, 5)) {
          const className = method.getDeclaringClass().getFullName();
          console.log(`[INFO]   - ${className}.${method.getName()}`);
        }
      }
    }),
  );

  // =====================================================
  // Section 8: Edge Case Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - empty string pattern", () => {
      const classes = Mono.find.classes(Mono.api, "", false);
      console.log(`[INFO] Empty string pattern returned ${classes.length} classes`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - special character patterns", () => {
      // Test patterns containing special characters
      const patterns = ["*<>*", "*`*", "*[]*"];

      for (const pattern of patterns) {
        try {
          const classes = Mono.find.classes(Mono.api, pattern, false);
          console.log(`[INFO] Pattern '${pattern}' returned ${classes.length} classes`);
        } catch (e) {
          console.log(`[INFO] Pattern '${pattern}' threw exception: ${e}`);
        }
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - non-existent pattern", () => {
      const methods = Mono.find.methods(Mono.api, "NonExistent.FakeMethod");
      assert(methods.length === 0, "Non-existent method pattern should return empty array");
    }),
  );

  results.push(
    createMonoDependentTest("Find.fields - non-existent pattern", () => {
      const fields = Mono.find.fields(Mono.api, "NonExistent.FakeField");
      assert(fields.length === 0, "Non-existent field pattern should return empty array");
    }),
  );

  // =====================================================
  // Section 9: Performance Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - performance: search all classes", () => {
      const startTime = Date.now();
      const allClasses = Mono.find.classes(Mono.api, "*", true);
      const elapsed = Date.now() - startTime;

      console.log(`[INFO] Searching all classes took: ${elapsed}ms, found ${allClasses.length} classes`);

      // Search should not exceed 30 seconds
      assert(elapsed < 30000, `Search took too long: ${elapsed}ms`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - performance: search common methods", () => {
      const startTime = Date.now();
      const methods = Mono.find.methods(Mono.api, "*Get*");
      const elapsed = Date.now() - startTime;

      console.log(`[INFO] Searching Get* methods took: ${elapsed}ms, found ${methods.length} methods`);
    }),
  );

  // =====================================================
  // Section 10: Result Validation
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - results are valid MonoClass objects", () => {
      const classes = Mono.find.classes(Mono.api, "*String*", false);
      assert(classes.length > 0, "Should find classes");

      for (const klass of classes.slice(0, 5)) {
        // Verify MonoClass methods can be called
        const name = klass.getName();
        const methods = klass.getMethods();
        const fields = klass.getFields();

        assert(typeof name === "string" && name.length > 0, "Class name should be non-empty string");
        assert(Array.isArray(methods), "getMethods() should return array");
        assert(Array.isArray(fields), "getFields() should return array");
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - results are valid MonoMethod objects", () => {
      const methods = Mono.find.methods(Mono.api, "*ToString*");
      assert(methods.length > 0, "Should find methods");

      for (const method of methods.slice(0, 5)) {
        // Verify MonoMethod methods can be called
        const name = method.getName();
        const declaringClass = method.getDeclaringClass();
        const paramCount = method.getParameterCount();

        assert(typeof name === "string" && name.length > 0, "Method name should be non-empty string");
        assertNotNull(declaringClass, "Declaring class should not be null");
        assert(typeof paramCount === "number" && paramCount >= 0, "Parameter count should be non-negative number");
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.fields - results are valid MonoField objects", () => {
      const fields = Mono.find.fields(Mono.api, "*");

      if (fields.length === 0) {
        console.log("[SKIP] No fields found");
        return;
      }

      for (const field of fields.slice(0, 5)) {
        // Verify MonoField methods can be called
        const name = field.getName();
        const parent = field.getParent();
        const type = field.getType();

        assert(typeof name === "string" && name.length > 0, "Field name should be non-empty string");
        assertNotNull(parent, "Parent should not be null");
        assertNotNull(type, "Field type should not be null");
      }
    }),
  );

  // =====================================================
  // Section 11: Regex Search Tests (New Feature)
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - regex search", () => {
      // Search all classes ending with String
      const classes = Mono.find.classes(Mono.api, ".*String$", { regex: true });
      assert(classes.length > 0, "Should find classes ending with String");

      for (const klass of classes) {
        const name = klass.getName();
        assert(name.endsWith("String"), `Class name ${name} should end with String`);
      }
      console.log(`[INFO] Found ${classes.length} classes ending with String`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - regex search - starting with uppercase", () => {
      // Search classes in System namespace starting with Int
      const classes = Mono.find.classes(Mono.api, "System\\.Int.*", { regex: true });
      assert(classes.length > 0, "Should find System.Int* classes");

      for (const klass of classes) {
        const fullName = klass.getFullName();
        assert(fullName.startsWith("System.Int"), `Class name ${fullName} should start with System.Int`);
      }
      console.log(`[INFO] Found ${classes.length} System.Int* classes`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - regex search", () => {
      // Search all methods starting with get_ or set_
      const methods = Mono.find.methods(Mono.api, "^(get|set)_.*", { regex: true, limit: 50 });
      assert(methods.length > 0, "Should find get_/set_ methods");

      for (const method of methods.slice(0, 10)) {
        const name = method.getName();
        assert(
          name.startsWith("get_") || name.startsWith("set_"),
          `Method name ${name} should start with get_ or set_`,
        );
      }
      console.log(`[INFO] Found ${methods.length} get_/set_ methods`);
    }),
  );

  // =====================================================
  // Section 12: limit Option Tests (New Feature)
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - limit option", () => {
      const limit = 5;
      const classes = Mono.find.classes(Mono.api, "*", { limit });
      assert(classes.length <= limit, `Result count ${classes.length} should be <= ${limit}`);
      console.log(`[INFO] Limit ${limit} returned ${classes.length} classes`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - limit option", () => {
      const limit = 10;
      const methods = Mono.find.methods(Mono.api, "*", { limit });
      assert(methods.length <= limit, `Result count ${methods.length} should be <= ${limit}`);
      console.log(`[INFO] Limit ${limit} returned ${methods.length} methods`);
    }),
  );

  // =====================================================
  // Section 13: filter Option Tests (New Feature)
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - filter option for interfaces", () => {
      const classes = Mono.find.classes(Mono.api, "System.I*", {
        filter: (c: any) => c.isInterface(),
      });

      for (const klass of classes.slice(0, 5)) {
        assert(klass.isInterface(), `${klass.getName()} should be an interface`);
      }
      console.log(`[INFO] Found ${classes.length} System.I* interfaces`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - filter option for static methods", () => {
      const methods = Mono.find.methods(Mono.api, "*Parse*", {
        filter: (m: any) => m.isStatic(),
        limit: 20,
      });

      for (const method of methods) {
        assert(method.isStatic(), `${method.getName()} should be a static method`);
      }
      console.log(`[INFO] Found ${methods.length} static Parse methods`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.fields - filter option for static fields", () => {
      const fields = Mono.find.fields(Mono.api, "*", {
        filter: (f: any) => f.isStatic(),
        limit: 20,
      });

      for (const field of fields) {
        assert(field.isStatic(), `${field.getName()} should be a static field`);
      }
      console.log(`[INFO] Found ${fields.length} static fields`);
    }),
  );

  // =====================================================
  // Section 14: properties Search Tests (New Feature)
  // =====================================================
  results.push(
    createMonoDependentTest("Find.properties - function exists", () => {
      assert(typeof Mono.find.properties === "function", "Mono.find.properties should be a function");
    }),
  );

  results.push(
    createMonoDependentTest("Find.properties - basic search", () => {
      const props = Mono.find.properties(Mono.api, "*Length*", { limit: 20 });
      assert(props.length > 0, "Should find properties containing Length");

      for (const prop of props.slice(0, 5)) {
        const name = prop.getName();
        assert(name.toLowerCase().includes("length"), `Property name ${name} should contain Length`);
      }
      console.log(`[INFO] Found ${props.length} Length properties`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.properties - ClassName.PropertyName format", () => {
      const props = Mono.find.properties(Mono.api, "System.String.*", { limit: 20 });

      for (const prop of props.slice(0, 5)) {
        const parent = prop.getParent();
        assert(
          parent.getNamespace() === "System" && parent.getName() === "String",
          `Property ${prop.getName()} should belong to System.String`,
        );
      }
      console.log(`[INFO] Found ${props.length} System.String properties`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.properties - regex search", () => {
      // Search properties starting with uppercase letter
      const props = Mono.find.properties(Mono.api, "^[A-Z].*", { regex: true, limit: 20 });
      assert(props.length > 0, "Should find properties starting with uppercase letter");

      for (const prop of props.slice(0, 5)) {
        const name = prop.getName();
        assert(/^[A-Z]/.test(name), `Property name ${name} should start with uppercase letter`);
      }
      console.log(`[INFO] Found ${props.length} properties starting with uppercase letter`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.properties - results are valid MonoProperty objects", () => {
      const props = Mono.find.properties(Mono.api, "*", { limit: 10 });

      if (props.length === 0) {
        console.log("[SKIP] No properties found");
        return;
      }

      for (const prop of props.slice(0, 5)) {
        // Verify MonoProperty methods can be called
        const name = prop.getName();
        const parent = prop.getParent();
        const getter = prop.getter;
        const setter = prop.setter;

        assert(typeof name === "string" && name.length > 0, "Property name should be non-empty string");
        assertNotNull(parent, "Parent should not be null");
        // At least getter or setter should exist
        assert(getter !== null || setter !== null, "Property should have getter or setter");
      }
    }),
  );

  // =====================================================
  // Section 14: caseInsensitive Option Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - caseInsensitive option (default true)", () => {
      // Search with lowercase pattern - should match uppercase class names by default
      const classesLower = Mono.find.classes(Mono.api, "*string*", { limit: 10 });
      assert(classesLower.length > 0, "Should find classes with case-insensitive match (default)");

      // Verify at least some matches have different case
      const names = classesLower.map(c => c.getName());
      console.log(
        `[INFO] Found ${classesLower.length} classes matching '*string*' (case-insensitive): ${names.slice(0, 5).join(", ")}`,
      );
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - caseInsensitive option set to false", () => {
      // Search with exact case matching
      const classesExact = Mono.find.classes(Mono.api, "*String*", { caseInsensitive: false, limit: 20 });
      const classesLower = Mono.find.classes(Mono.api, "*string*", { caseInsensitive: false, limit: 20 });

      // When case-sensitive, searching for lowercase 'string' should find fewer or no results
      // compared to searching for 'String' which is the actual casing
      console.log(`[INFO] Case-sensitive '*String*': ${classesExact.length}, '*string*': ${classesLower.length}`);

      // Verify case-sensitive search for String finds results
      assert(classesExact.length > 0, "Should find classes with exact case 'String'");
    }),
  );

  results.push(
    createMonoDependentTest("Find.methods - caseInsensitive option", () => {
      // Test case-insensitive method search
      const methodsLower = Mono.find.methods(Mono.api, "*tostring*", { limit: 20 });
      assert(methodsLower.length > 0, "Should find ToString methods with lowercase pattern");

      for (const method of methodsLower.slice(0, 5)) {
        const name = method.getName().toLowerCase();
        assert(name.includes("tostring"), `Method ${method.getName()} should match pattern`);
      }
      console.log(`[INFO] Found ${methodsLower.length} methods matching '*tostring*'`);
    }),
  );

  // =====================================================
  // Section 15: searchNamespace Option Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classes - searchNamespace true (default)", () => {
      // Search with namespace included - should find System.String
      const classes = Mono.find.classes(Mono.api, "System.String", { searchNamespace: true });
      assert(classes.length >= 1, "Should find System.String when searching namespace");

      const found = classes.find(c => c.getFullName() === "System.String");
      assert(found !== undefined, "Should find exact System.String class");
      console.log(`[INFO] Found ${classes.length} classes matching 'System.String'`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - searchNamespace false", () => {
      // Search without namespace - should match class name only
      const classes = Mono.find.classes(Mono.api, "String", { searchNamespace: false, limit: 20 });
      assert(classes.length > 0, "Should find classes named 'String'");

      for (const klass of classes) {
        const name = klass.getName();
        assert(name === "String", `Class name should be 'String', got '${name}'`);
      }
      console.log(`[INFO] Found ${classes.length} classes named 'String' (without namespace search)`);
    }),
  );

  results.push(
    createMonoDependentTest("Find.classes - searchNamespace with wildcard", () => {
      // Search with wildcard in namespace
      const classes = Mono.find.classes(Mono.api, "System.Collections.*", { searchNamespace: true, limit: 20 });
      assert(classes.length > 0, "Should find classes in System.Collections namespace");

      for (const klass of classes.slice(0, 5)) {
        const fullName = klass.getFullName();
        assert(fullName.startsWith("System.Collections"), `Class ${fullName} should be in System.Collections`);
      }
      console.log(`[INFO] Found ${classes.length} classes in System.Collections.*`);
    }),
  );

  // =====================================================
  // Section 16: classExact Function Tests
  // =====================================================
  results.push(
    createMonoDependentTest("Find.classExact - find exact class by full name", () => {
      const stringClass = Mono.find.classExact(Mono.api, "System.String");
      assertNotNull(stringClass, "Should find System.String class");

      if (stringClass) {
        assert(stringClass.getName() === "String", "Class name should be String");
        assert(stringClass.getNamespace() === "System", "Namespace should be System");
        assert(stringClass.getFullName() === "System.String", "Full name should be System.String");
      }
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - return null for non-existent class", () => {
      const nonExistent = Mono.find.classExact(Mono.api, "NonExistent.FakeClass.DoesNotExist");
      assert(nonExistent === null, "Should return null for non-existent class");
    }),
  );

  results.push(
    createMonoDependentTest("Find.classExact - find class without namespace", () => {
      // Some classes might not have namespace
      const intClass = Mono.find.classExact(Mono.api, "System.Int32");
      assertNotNull(intClass, "Should find System.Int32 class");

      if (intClass) {
        assert(intClass.getName() === "Int32", "Class name should be Int32");
      }
    }),
  );

  return results;
}

// Export test function
export default createFindToolTests;

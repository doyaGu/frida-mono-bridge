/**
 * Internal Call Registration Complete Tests
 *
 * Tests internal call registration via the public Mono facade:
 * - Mono.icall - High-level registrar facade
 * - register() - Register with duplicate handling policies
 * - tryRegister() - Safe registration without throwing
 * - registerAll() / tryRegisterAll() - Batch registration
 * - has() / get() / getAll() / count / names - Query methods
 * - DuplicatePolicy - Skip, Throw, Overwrite policies
 * - NativeCallback keep-alive to prevent GC issues
 * - Feature detection (isSupported / requireSupported)
 * - Error handling and validation
 */

import Mono from "../src";
import { withDomain } from "./test-fixtures";
import { TestResult, assert, assertNotNull } from "./test-framework";

export async function createInternalCallTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // =====================================================
  // SECTION 1: Basic Registration Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - basic registration with registrar", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::TestMethod_" + Date.now();

      const callback = new NativeCallback(
        () => {
          console.log("Test callback invoked");
        },
        "void",
        [],
      );

      // Should not throw
      Mono.icall.register({ name: testName, callback });

      // Should be tracked in registry
      assert(Mono.icall.has(testName), `Internal call ${testName} should be registered`);
    }),
  );

  results.push(
    await withDomain("InternalCall - tryRegister successful registration", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::TryMethod_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      const result = Mono.icall.tryRegister({ name: testName, callback });

      assert(result === true, "tryRegister should return true on success");
      assert(Mono.icall.has(testName), `Internal call ${testName} should be registered`);
    }),
  );

  results.push(
    await withDomain("InternalCall - register callback with return value", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::ReturnsInt_" + Date.now();

      const callback = new NativeCallback(() => 42, "int", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Callback with return value should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register callback with parameters", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::WithParams_" + Date.now();

      const callback = new NativeCallback((a: number, b: number) => a + b, "int", ["int", "int"]);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Callback with parameters should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register callback with pointer parameters", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::WithPointer_" + Date.now();

      const callback = new NativeCallback((ptr: NativePointer) => ptr, "pointer", ["pointer"]);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Callback with pointer should register");
    }),
  );

  // =====================================================
  // SECTION 2: Registry Query Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - has() returns false for unregistered", () => {
      Mono.icall.clear();
      const fakeName = "NonExistent.Class::Method_" + Date.now();

      const result = Mono.icall.has(fakeName);

      assert(result === false, "has() should return false for non-existent call");
    }),
  );

  results.push(
    await withDomain("InternalCall - get() returns info for registered", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::InfoTest_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const info = Mono.icall.get(testName);

      assertNotNull(info, "get() should return info for registered call");
      assert(info!.name === testName, `Info name should be ${testName}`);
      assert(!info!.callbackPtr.isNull(), "Info callback pointer should not be null");
      assert(typeof info!.registeredAt === "number", "Info should include registration timestamp");
      assert(info!.registeredAt > 0, "Registration timestamp should be positive");
      assert(typeof info!.keepAlive === "boolean", "Info should include keepAlive flag");
    }),
  );

  results.push(
    await withDomain("InternalCall - get() returns undefined for unregistered", () => {
      Mono.icall.clear();
      const fakeName = "NonExistent.Class::Method_" + Date.now();

      const info = Mono.icall.get(fakeName);

      assert(info === undefined, "get() should return undefined for non-existent call");
    }),
  );

  results.push(
    await withDomain("InternalCall - getAll() returns array", () => {
      Mono.icall.clear();

      const allCalls = Mono.icall.getAll();

      assert(Array.isArray(allCalls), "getAll() should return an array");
      assert(allCalls.length >= 0, "Array length should be non-negative");

      // Each item should have required properties
      if (allCalls.length > 0) {
        const first = allCalls[0];
        assert(typeof first.name === "string", "Call info should have name string");
        assert(typeof first.callbackPtr === "object", "Call info should have callback pointer");
        assert(typeof first.registeredAt === "number", "Call info should have timestamp");
        assert(typeof first.keepAlive === "boolean", "Call info should have keepAlive flag");
      }
    }),
  );

  results.push(
    await withDomain("InternalCall - count property returns count", () => {
      Mono.icall.clear();
      const countBefore = Mono.icall.count;

      const testName = "TestNamespace.TestClass::CountTest_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);
      Mono.icall.register({ name: testName, callback });

      const countAfter = Mono.icall.count;

      assert(typeof countBefore === "number", "Count should be a number");
      assert(typeof countAfter === "number", "Count should be a number");
      assert(countAfter === countBefore + 1, "Count should increment after registration");
    }),
  );

  results.push(
    await withDomain("InternalCall - names property returns name array", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::NamesTest_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const names = Mono.icall.names;

      assert(Array.isArray(names), "names should return an array");
      assert(names.includes(testName), `names should include ${testName}`);
    }),
  );

  results.push(
    await withDomain("InternalCall - getSummary() returns complete summary", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::SummaryTest_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const summary = Mono.icall.getSummary();

      assert(typeof summary.count === "number", "Summary should have count");
      assert(typeof summary.supported === "boolean", "Summary should have supported flag");
      assert(Array.isArray(summary.names), "Summary should have names array");
      assert(summary.names.includes(testName), "Summary names should include registered call");
    }),
  );

  // =====================================================
  // SECTION 3: Duplicate Policy Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - DuplicatePolicy.Throw on different pointer", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::DupThrow_" + Date.now();

      const callback1 = new NativeCallback(() => {}, "void", []);
      const callback2 = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback: callback1 });

      let threw = false;
      try {
        Mono.icall.register(
          { name: testName, callback: callback2 },
          { duplicatePolicy: Mono.icall.DuplicatePolicy.Throw },
        );
      } catch (e) {
        threw = true;
      }

      assert(threw, "Should throw on duplicate with different pointer when policy is Throw");
    }),
  );

  results.push(
    await withDomain("InternalCall - DuplicatePolicy.Throw idempotent with same pointer", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::DupSame_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      // Should not throw when registering same pointer
      Mono.icall.register({ name: testName, callback }, { duplicatePolicy: Mono.icall.DuplicatePolicy.Throw });

      assert(Mono.icall.has(testName), "Should remain registered after idempotent registration");
    }),
  );

  results.push(
    await withDomain("InternalCall - DuplicatePolicy.Skip silently ignores duplicate", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::DupSkip_" + Date.now();

      const callback1 = new NativeCallback(() => {}, "void", []);
      const callback2 = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback: callback1 });
      const info1 = Mono.icall.get(testName);

      // Should not throw, should keep original
      Mono.icall.register(
        { name: testName, callback: callback2 },
        { duplicatePolicy: Mono.icall.DuplicatePolicy.Skip },
      );
      const info2 = Mono.icall.get(testName);

      assertNotNull(info1, "First registration should have info");
      assertNotNull(info2, "Second registration should have info");
      assert(info2!.callbackPtr.equals(info1!.callbackPtr), "Skip policy should keep original pointer");
    }),
  );

  results.push(
    await withDomain("InternalCall - DuplicatePolicy.Overwrite replaces callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::DupOverwrite_" + Date.now();

      const callback1 = new NativeCallback(() => {}, "void", []);
      const callback2 = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback: callback1 });
      const info1 = Mono.icall.get(testName);

      Mono.icall.register(
        { name: testName, callback: callback2 },
        { duplicatePolicy: Mono.icall.DuplicatePolicy.Overwrite },
      );
      const info2 = Mono.icall.get(testName);

      assertNotNull(info1, "First registration should have info");
      assertNotNull(info2, "Second registration should have info");
      assert(!info2!.callbackPtr.equals(info1!.callbackPtr), "Overwrite policy should replace pointer");
    }),
  );

  // =====================================================
  // SECTION 4: Keep-Alive Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - default keepAlive true for NativeCallback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::KeepAliveDefault_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const info = Mono.icall.get(testName);

      assertNotNull(info, "Registration should have info");
      assert(info!.keepAlive === true, "keepAlive should default to true for NativeCallback");
    }),
  );

  results.push(
    await withDomain("InternalCall - explicit keepAlive false", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::KeepAliveFalse_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback, keepAlive: false });

      const info = Mono.icall.get(testName);

      assertNotNull(info, "Registration should have info");
      assert(info!.keepAlive === false, "keepAlive should respect explicit false");
    }),
  );

  results.push(
    await withDomain("InternalCall - explicit keepAlive true", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::KeepAliveTrue_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback, keepAlive: true });

      const info = Mono.icall.get(testName);

      assertNotNull(info, "Registration should have info");
      assert(info!.keepAlive === true, "keepAlive should be true when explicit");
    }),
  );

  // =====================================================
  // SECTION 5: Batch Registration Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - registerAll with multiple definitions", () => {
      Mono.icall.clear();
      const baseName = "TestNamespace.TestClass::Batch_" + Date.now();

      const callback1 = new NativeCallback(() => {}, "void", []);
      const callback2 = new NativeCallback(() => 42, "int", []);
      const callback3 = new NativeCallback((x: number) => x * 2, "int", ["int"]);

      Mono.icall.registerAll([
        { name: baseName + "_1", callback: callback1 },
        { name: baseName + "_2", callback: callback2 },
        { name: baseName + "_3", callback: callback3 },
      ]);

      assert(Mono.icall.has(baseName + "_1"), "First callback should be registered");
      assert(Mono.icall.has(baseName + "_2"), "Second callback should be registered");
      assert(Mono.icall.has(baseName + "_3"), "Third callback should be registered");
      assert(Mono.icall.count >= 3, "Count should include all batch registrations");
    }),
  );

  results.push(
    await withDomain("InternalCall - registerAll with shared options", () => {
      Mono.icall.clear();
      const baseName = "TestNamespace.TestClass::BatchOpts_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      // Register first
      Mono.icall.register({ name: baseName + "_1", callback });

      // Batch with skip policy
      Mono.icall.registerAll(
        [
          { name: baseName + "_1", callback }, // Duplicate
          { name: baseName + "_2", callback },
        ],
        { duplicatePolicy: Mono.icall.DuplicatePolicy.Skip },
      );

      assert(Mono.icall.has(baseName + "_1"), "Duplicate should be skipped");
      assert(Mono.icall.has(baseName + "_2"), "New registration should succeed");
    }),
  );

  results.push(
    await withDomain("InternalCall - tryRegisterAll returns success count", () => {
      Mono.icall.clear();

      const baseName = "TestNamespace.TestClass::TryBatch_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      const successCount = Mono.icall.tryRegisterAll([
        { name: baseName + "_1", callback },
        { name: baseName + "_2", callback },
        { name: baseName + "_3", callback },
      ]);

      assert(successCount === 3, "tryRegisterAll should return count of successful registrations");
      assert(Mono.icall.has(baseName + "_1"), "First should be registered");
      assert(Mono.icall.has(baseName + "_2"), "Second should be registered");
      assert(Mono.icall.has(baseName + "_3"), "Third should be registered");
    }),
  );

  results.push(
    await withDomain("InternalCall - tryRegisterAll partial success with invalid", () => {
      Mono.icall.clear();

      const baseName = "TestNamespace.TestClass::TryBatchPartial_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      const successCount = Mono.icall.tryRegisterAll([
        { name: baseName + "_1", callback },
        { name: "", callback }, // Invalid - empty name
        { name: baseName + "_3", callback },
      ]);

      assert(successCount === 2, "tryRegisterAll should return 2 for 2 successes");
      assert(Mono.icall.has(baseName + "_1"), "First should be registered");
      assert(Mono.icall.has(baseName + "_3"), "Third should be registered");
    }),
  );

  // =====================================================
  // SECTION 6: Error Handling Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - register throws on empty name", () => {
      Mono.icall.clear();
      const callback = new NativeCallback(() => {}, "void", []);

      let threw = false;
      try {
        Mono.icall.register({ name: "", callback });
      } catch {
        threw = true;
      }

      assert(threw, "Should throw on empty name");
    }),
  );

  results.push(
    await withDomain("InternalCall - register throws on whitespace-only name", () => {
      Mono.icall.clear();
      const callback = new NativeCallback(() => {}, "void", []);

      let threw = false;
      try {
        Mono.icall.register({ name: "   ", callback });
      } catch {
        threw = true;
      }

      assert(threw, "Should throw on whitespace-only name");
    }),
  );

  results.push(
    await withDomain("InternalCall - register throws on null callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::NullCallback_" + Date.now();

      let threw = false;
      try {
        Mono.icall.register({ name: testName, callback: NULL });
      } catch {
        threw = true;
      }

      assert(threw, "Should throw on null callback");
    }),
  );

  results.push(
    await withDomain("InternalCall - tryRegister returns false on empty name", () => {
      Mono.icall.clear();
      const callback = new NativeCallback(() => {}, "void", []);

      const result = Mono.icall.tryRegister({ name: "", callback });

      assert(result === false, "tryRegister should return false on invalid name");
    }),
  );

  results.push(
    await withDomain("InternalCall - tryRegister returns false on null callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::TryNullCallback_" + Date.now();

      const result = Mono.icall.tryRegister({ name: testName, callback: NULL });

      assert(result === false, "tryRegister should return false on null callback");
    }),
  );

  results.push(
    await withDomain("InternalCall - validateCallback option can disable null check", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::NoValidation_" + Date.now();

      // Should not throw even with NULL when validation disabled
      Mono.icall.register({ name: testName, callback: NULL }, { validateCallback: false });

      assert(Mono.icall.has(testName), "Should register even with NULL when validation disabled");
    }),
  );

  // =====================================================
  // SECTION 7: Feature Support Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - isSupported returns boolean", () => {
      const supported = Mono.icall.isSupported;

      assert(typeof supported === "boolean", "isSupported should return boolean");
      // In most Unity builds, internal calls should be supported
      assert(supported === true, "Internal calls should be supported");
    }),
  );

  results.push(
    await withDomain("InternalCall - ensureSupported does not throw when supported", () => {
      // Should not throw
      Mono.icall.requireSupported();

      assert(true, "ensureSupported should not throw when supported");
    }),
  );

  // =====================================================
  // SECTION 8: Registrar Behavior Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - facade registrar tracks globally", () => {
      Mono.icall.clear();

      const testName1 = "TestNamespace.TestClass::Tracked1_" + Date.now();
      const testName2 = "TestNamespace.TestClass::Tracked2_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName1, callback });
      Mono.icall.register({ name: testName2, callback });

      assert(Mono.icall.has(testName1), "Registrar should have testName1");
      assert(Mono.icall.has(testName2), "Registrar should have testName2");
      assert(Mono.icall.count === 2, "Count should be 2 after two registrations");
    }),
  );

  results.push(
    await withDomain("InternalCall - clear() resets local tracking only", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::Clear_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.count > 0, "Should have registrations before clear");

      Mono.icall.clear();

      assert(Mono.icall.count === 0, "Count should be 0 after clear");
      assert(!Mono.icall.has(testName), "Should not have registration after clear");
    }),
  );

  // =====================================================
  // SECTION 9: Name Format Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - accept fully qualified name format", () => {
      Mono.icall.clear();
      const testName = "MyNamespace.MyClass::MyMethod_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      assert(Mono.icall.has(testName), "Should accept namespace.class::method format");
    }),
  );

  results.push(
    await withDomain("InternalCall - accept nested namespace format", () => {
      Mono.icall.clear();
      const testName = "Outer.Inner.Deep.MyClass::MyMethod_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      assert(Mono.icall.has(testName), "Should accept nested namespace format");
    }),
  );

  results.push(
    await withDomain("InternalCall - accept Unity-style format", () => {
      Mono.icall.clear();
      const testName = "UnityEngine.GameObject::Internal_Instantiate_" + Date.now();
      const callback = new NativeCallback((ptr: NativePointer) => ptr, "pointer", ["pointer"]);

      Mono.icall.register({ name: testName, callback });

      assert(Mono.icall.has(testName), "Should accept Unity-style internal call name");
    }),
  );

  results.push(
    await withDomain("InternalCall - accept generic type markers", () => {
      Mono.icall.clear();
      const testName = "Test.GenericClass`1::Method_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      assert(Mono.icall.has(testName), "Should accept generic type markers");
    }),
  );

  // =====================================================
  // SECTION 10: Callback Signature Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - register void callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::VoidCallback_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Void callback should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register int return callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::IntReturn_" + Date.now();

      const callback = new NativeCallback(() => 123, "int", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Int return callback should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register pointer return callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::PointerReturn_" + Date.now();

      const callback = new NativeCallback(() => ptr("0x1234"), "pointer", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Pointer return callback should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register float return callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::FloatReturn_" + Date.now();

      const callback = new NativeCallback(() => 3.14, "float", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Float return callback should register");
    }),
  );

  results.push(
    await withDomain("InternalCall - register multi-parameter callback", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::MultiParam_" + Date.now();

      const callback = new NativeCallback((a: number, b: number, c: number, d: number) => a + b + c + d, "int", [
        "int",
        "int",
        "int",
        "int",
      ]);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Multi-parameter callback should register");
    }),
  );

  // =====================================================
  // SECTION 11: Integration Tests
  // =====================================================
  results.push(
    await withDomain("InternalCall - registry persists across queries", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::Persist_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      // Query multiple times
      for (let i = 0; i < 5; i++) {
        assert(Mono.icall.has(testName), `Should remain registered on query ${i + 1}`);

        const info = Mono.icall.get(testName);
        assertNotNull(info, `Should have info on query ${i + 1}`);
      }
    }),
  );

  results.push(
    await withDomain("InternalCall - getAll() consistency", () => {
      Mono.icall.clear();

      const allCalls1 = Mono.icall.getAll();
      const allCalls2 = Mono.icall.getAll();

      assert(allCalls1.length === allCalls2.length, "Call count should be consistent");

      // Names should match
      const names1 = allCalls1.map(c => c.name).sort();
      const names2 = allCalls2.map(c => c.name).sort();

      for (let i = 0; i < names1.length; i++) {
        assert(names1[i] === names2[i], `Name at index ${i} should match`);
      }
    }),
  );

  results.push(
    await withDomain("InternalCall - count matches array length", () => {
      Mono.icall.clear();

      const count = Mono.icall.count;
      const allCalls = Mono.icall.getAll();

      assert(count === allCalls.length, "Count should match getAll() length");
    }),
  );

  results.push(
    await withDomain("InternalCall - names matches getAll names", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.TestClass::NamesMatch_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const names = Mono.icall.names;
      const allCalls = Mono.icall.getAll();
      const allNames = allCalls.map(c => c.name);

      assert(names.length === allNames.length, "names length should match getAll names length");
      for (const name of names) {
        assert(allNames.includes(name), `names should include ${name}`);
      }
    }),
  );

  // =====================================================
  // SECTION 12: Edge Cases
  // =====================================================
  results.push(
    await withDomain("InternalCall - handle very long method name", () => {
      Mono.icall.clear();
      const longName = "Test.Class::" + "A".repeat(200) + "_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: longName, callback });

      assert(Mono.icall.has(longName), "Should handle very long method names");
    }),
  );

  results.push(
    await withDomain("InternalCall - handle special characters in name", () => {
      Mono.icall.clear();
      const testName = "Test.Class::Method$With<Special>Chars_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });
      assert(Mono.icall.has(testName), "Registry should track names with special chars");
    }),
  );

  results.push(
    await withDomain("InternalCall - timestamp ordering", () => {
      Mono.icall.clear();
      const testName1 = "TestNamespace.TestClass::First_" + Date.now();
      const testName2 = "TestNamespace.TestClass::Second_" + Date.now();

      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName1, callback });
      // Small delay to ensure different timestamps
      const startTime = Date.now();
      while (Date.now() === startTime) {
        // Busy wait for timestamp change
      }
      Mono.icall.register({ name: testName2, callback });

      const info1 = Mono.icall.get(testName1);
      const info2 = Mono.icall.get(testName2);

      assertNotNull(info1, "First registration should have info");
      assertNotNull(info2, "Second registration should have info");
      assert(info1!.registeredAt <= info2!.registeredAt, "First registration should have earlier or equal timestamp");
    }),
  );

  // =====================================================
  // SECTION 13: Facade Availability Tests
  // =====================================================
  results.push(
    await withDomain("Mono.icall - facade surface smoke test", () => {
      Mono.icall.clear();
      assert(typeof Mono.icall.isSupported === "boolean", "Mono.icall.isSupported should be boolean");
      assert(typeof Mono.icall.register === "function", "Mono.icall.register should be a function");
      assert(typeof Mono.icall.tryRegister === "function", "Mono.icall.tryRegister should be a function");
      assert(typeof Mono.icall.count === "number", "Mono.icall.count should be a number");
      assert(Array.isArray(Mono.icall.names), "Mono.icall.names should be an array");
    }),
  );

  // =====================================================
  // SECTION 14: Mono.icall Facade Tests (V2 Style)
  // =====================================================
  results.push(
    await withDomain("Mono.icall - isSupported property", () => {
      Mono.icall.clear();
      const isSupported = Mono.icall.isSupported;
      assert(typeof isSupported === "boolean", "isSupported should be a boolean");
      // In most Mono runtimes, internal calls are supported
      assert(isSupported === true, "Internal calls should be supported in this runtime");
    }),
  );

  results.push(
    await withDomain("Mono.icall - requireSupported() does not throw when supported", () => {
      Mono.icall.clear();
      // Should not throw if internal calls are supported
      let threw = false;
      try {
        Mono.icall.requireSupported();
      } catch {
        threw = true;
      }
      assert(!threw, "requireSupported() should not throw when supported");
    }),
  );

  results.push(
    await withDomain("Mono.icall - register via facade", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.FacadeTest::RegisterViaFacade_" + Date.now();
      const callback = new NativeCallback(
        () => {
          console.log("Facade callback invoked");
        },
        "void",
        [],
      );

      // Register via facade
      Mono.icall.register({ name: testName, callback });

      // Verify via facade
      assert(Mono.icall.has(testName), "Internal call should be registered via facade");
    }),
  );

  results.push(
    await withDomain("Mono.icall - tryRegister via facade", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.FacadeTest::TryRegisterViaFacade_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      const result = Mono.icall.tryRegister({ name: testName, callback });

      assert(result === true, "tryRegister should return true on success");
      assert(Mono.icall.has(testName), "Internal call should be registered");
    }),
  );

  results.push(
    await withDomain("Mono.icall - get() and getAll() via facade", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.FacadeTest::QueryViaFacade_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const info = Mono.icall.get(testName);
      assertNotNull(info, "get() should return info via facade");
      assert(info!.name === testName, "Info name should match");

      const all = Mono.icall.getAll();
      assert(Array.isArray(all), "getAll() should return array via facade");
      assert(
        all.some(i => i.name === testName),
        "getAll() should include registered call",
      );
    }),
  );

  results.push(
    await withDomain("Mono.icall - count and names via facade", () => {
      Mono.icall.clear();
      const countBefore = Mono.icall.count;
      const testName = "TestNamespace.FacadeTest::CountNames_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback });

      const countAfter = Mono.icall.count;
      assert(countAfter >= countBefore + 1, "Count should increase after registration");

      const names = Mono.icall.names;
      assert(Array.isArray(names), "names should be an array");
      assert(names.includes(testName), "names should include registered call");
    }),
  );

  results.push(
    await withDomain("Mono.icall - getSummary() via facade", () => {
      Mono.icall.clear();
      const summary = Mono.icall.getSummary();

      assert(typeof summary.count === "number", "Summary should have count");
      assert(typeof summary.supported === "boolean", "Summary should have supported flag");
      assert(Array.isArray(summary.names), "Summary should have names array");
    }),
  );

  results.push(
    await withDomain("Mono.icall - DuplicatePolicy via facade", () => {
      Mono.icall.clear();
      // Test that DuplicatePolicy is accessible via facade
      const dp = Mono.icall.DuplicatePolicy;

      assert(dp.Skip === "skip", "DuplicatePolicy.Skip should be 'skip'");
      assert(dp.Throw === "throw", "DuplicatePolicy.Throw should be 'throw'");
      assert(dp.Overwrite === "overwrite", "DuplicatePolicy.Overwrite should be 'overwrite'");
    }),
  );

  results.push(
    await withDomain("Mono.icall - registerAll via facade", () => {
      Mono.icall.clear();
      const baseName = "TestNamespace.FacadeTest::BatchReg_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      const definitions = [
        { name: `${baseName}_1`, callback },
        { name: `${baseName}_2`, callback },
        { name: `${baseName}_3`, callback },
      ];

      Mono.icall.registerAll(definitions);

      assert(Mono.icall.has(`${baseName}_1`), "First batch item should be registered");
      assert(Mono.icall.has(`${baseName}_2`), "Second batch item should be registered");
      assert(Mono.icall.has(`${baseName}_3`), "Third batch item should be registered");
    }),
  );

  results.push(
    await withDomain("Mono.icall - tryRegisterAll via facade", () => {
      Mono.icall.clear();
      const baseName = "TestNamespace.FacadeTest::TryBatchReg_" + Date.now();
      const callback = new NativeCallback(() => {}, "void", []);

      const definitions = [
        { name: `${baseName}_A`, callback },
        { name: `${baseName}_B`, callback },
      ];

      const successCount = Mono.icall.tryRegisterAll(definitions);

      assert(successCount === 2, "tryRegisterAll should return count of successful registrations");
      assert(Mono.icall.has(`${baseName}_A`), "First item should be registered");
      assert(Mono.icall.has(`${baseName}_B`), "Second item should be registered");
    }),
  );

  results.push(
    await withDomain("Mono.icall - register with DuplicatePolicy.Skip via facade", () => {
      Mono.icall.clear();
      const testName = "TestNamespace.FacadeTest::DupSkipFacade_" + Date.now();
      const callback1 = new NativeCallback(() => {}, "void", []);
      const callback2 = new NativeCallback(() => {}, "void", []);

      Mono.icall.register({ name: testName, callback: callback1 });

      // Should not throw with Skip policy
      let threw = false;
      try {
        Mono.icall.register(
          { name: testName, callback: callback2 },
          { duplicatePolicy: Mono.icall.DuplicatePolicy.Skip },
        );
      } catch {
        threw = true;
      }

      assert(!threw, "Should not throw with DuplicatePolicy.Skip via facade");
    }),
  );

  return results;
}

export default createInternalCallTests;

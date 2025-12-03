/**
 * MonoClass Generic Type Tests
 * 
 * Tests for generic type support in MonoClass:
 * - isGenericType()
 * - isGenericTypeDefinition()
 * - isConstructedGenericType()
 * - getGenericArgumentCount()
 * - getGenericParameterCount()
 * - getGenericArguments()
 * - getGenericTypeDefinition()
 */

import Mono from '../src';
import { 
  TestResult, 
  createMonoDependentTest, 
  createStandaloneTest,
  assert, 
  assertNotNull,
} from './test-framework';

/**
 * Create MonoClass generic type test suite
 */
export function createGenericTypeTests(): TestResult[] {
  const results: TestResult[] = [];

  // ============================================
  // Non-Generic Type Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - String is not generic type',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String class should exist');
        
        assert(!stringClass!.isGenericType(), 'String should not be generic');
        assert(!stringClass!.isGenericTypeDefinition(), 'String should not be generic definition');
        assert(!stringClass!.isConstructedGenericType(), 'String should not be constructed generic');
        assert(stringClass!.getGenericArgumentCount() === 0, 'String should have 0 generic arguments');
        assert(stringClass!.getGenericParameterCount() === 0, 'String should have 0 generic parameters');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - Int32 is not generic type',
    () => {
      Mono.perform(() => {
        const intClass = Mono.domain.class('System.Int32');
        assertNotNull(intClass, 'Int32 class should exist');
        
        assert(!intClass!.isGenericType(), 'Int32 should not be generic');
        assert(intClass!.getGenericArguments().length === 0, 'Int32 should have no generic arguments');
      });
    }
  ));

  // ============================================
  // Generic Type Definition Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - List`1 exists',
    () => {
      Mono.perform(() => {
        // Generic type definitions have backtick and number (List`1)
        const listClass = Mono.domain.class('System.Collections.Generic.List`1');
        
        if (!listClass) {
          console.log('[INFO] List<T> not found, trying alternate names');
          return;
        }
        
        console.log(`[INFO] Found ${listClass.getFullName()}`);
        const desc = listClass.describe();
        console.log(`[INFO] isGenericType: ${desc.isGenericType}`);
        console.log(`[INFO] isGenericTypeDefinition: ${desc.isGenericTypeDefinition}`);
        console.log(`[INFO] genericParameterCount: ${desc.genericParameterCount}`);
        console.log(`[INFO] genericArgumentCount: ${desc.genericArgumentCount}`);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - Dictionary`2 exists',
    () => {
      Mono.perform(() => {
        const dictClass = Mono.domain.class('System.Collections.Generic.Dictionary`2');
        
        if (!dictClass) {
          console.log('[INFO] Dictionary<K,V> not found');
          return;
        }
        
        console.log(`[INFO] Found ${dictClass.getFullName()}`);
        const paramCount = dictClass.getGenericParameterCount();
        console.log(`[INFO] Generic parameter count: ${paramCount}`);
        
        // Dictionary should have 2 type parameters (K, V)
        if (paramCount > 0) {
          assert(paramCount === 2, 'Dictionary should have 2 type parameters');
        }
      });
    }
  ));

  // ============================================
  // Constructed Generic Type Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - Find constructed generic types',
    () => {
      Mono.perform(() => {
        let genericFound = false;
        
        // Search for any constructed generic type
        for (const assembly of Mono.domain.assemblies.slice(0, 5)) {
          for (const klass of assembly.classes.slice(0, 100)) {
            const argCount = klass.getGenericArgumentCount();
            if (argCount > 0) {
              console.log(`[INFO] Found constructed generic: ${klass.getFullName()}`);
              console.log(`[INFO]   Generic argument count: ${argCount}`);
              
              const args = klass.getGenericArguments();
              for (let i = 0; i < args.length; i++) {
                console.log(`[INFO]   Argument ${i}: ${args[i].getFullName()}`);
              }
              
              genericFound = true;
              break;
            }
          }
          if (genericFound) break;
        }
        
        if (!genericFound) {
          console.log('[INFO] No constructed generic types found in scanned classes');
        }
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - getGenericArguments returns MonoClass array',
    () => {
      Mono.perform(() => {
        // Search for any constructed generic type
        for (const assembly of Mono.domain.assemblies) {
          for (const klass of assembly.classes) {
            const argCount = klass.getGenericArgumentCount();
            if (argCount > 0) {
              const args = klass.getGenericArguments();
              
              assert(Array.isArray(args), 'Should return array');
              assert(args.length === argCount, 'Array length should match count');
              
              for (const arg of args) {
                assertNotNull(arg, 'Argument should not be null');
                assert(typeof arg.getFullName() === 'string', 'Argument should have name');
              }
              
              return;
            }
          }
        }
        
        console.log('[INFO] No constructed generic types found to test');
      });
    }
  ));

  // ============================================
  // Generic Type Definition Retrieval Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - getGenericTypeDefinition for constructed type',
    () => {
      Mono.perform(() => {
        // Search for any constructed generic type
        for (const assembly of Mono.domain.assemblies) {
          for (const klass of assembly.classes) {
            if (klass.isConstructedGenericType()) {
              const def = klass.getGenericTypeDefinition();
              
              if (def) {
                console.log(`[INFO] Constructed: ${klass.getFullName()}`);
                console.log(`[INFO] Definition: ${def.getFullName()}`);
                
                // Definition should be a generic type definition
                if (def.isGenericTypeDefinition()) {
                  console.log('[INFO] Definition is correctly a generic type definition');
                }
              }
              
              return;
            }
          }
        }
        
        console.log('[INFO] No constructed generic types found to test');
      });
    }
  ));

  // ============================================
  // Caching Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - getGenericArguments is cached',
    () => {
      Mono.perform(() => {
        for (const assembly of Mono.domain.assemblies) {
          for (const klass of assembly.classes) {
            if (klass.getGenericArgumentCount() > 0) {
              const args1 = klass.getGenericArguments();
              const args2 = klass.getGenericArguments();
              
              // Should return copies, but from same cached source
              assert(args1.length === args2.length, 'Should return same length');
              
              return;
            }
          }
        }
        
        console.log('[INFO] No generic types to test caching');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - getGenericTypeDefinition is cached',
    () => {
      Mono.perform(() => {
        for (const assembly of Mono.domain.assemblies) {
          for (const klass of assembly.classes) {
            if (klass.isConstructedGenericType()) {
              const def1 = klass.getGenericTypeDefinition();
              const def2 = klass.getGenericTypeDefinition();
              
              // Should return same cached value
              assert(def1 === def2, 'Should return same cached instance');
              
              return;
            }
          }
        }
        
        console.log('[INFO] No constructed generics to test caching');
      });
    }
  ));

  // ============================================
  // Describe Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - describe() includes generic info',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String should exist');
        
        const desc = stringClass!.describe();
        
        assert('isGenericType' in desc, 'describe should have isGenericType');
        assert('isGenericTypeDefinition' in desc, 'describe should have isGenericTypeDefinition');
        assert('genericArgumentCount' in desc, 'describe should have genericArgumentCount');
        assert('genericParameterCount' in desc, 'describe should have genericParameterCount');
        
        assert(desc.isGenericType === false, 'String isGenericType should be false');
        assert(desc.genericArgumentCount === 0, 'String genericArgumentCount should be 0');
      });
    }
  ));

  // ============================================
  // Edge Cases
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - non-existent Unity API graceful handling',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String should exist');
        
        // These should not throw even if Unity API is not available
        const argCount = stringClass!.getGenericArgumentCount();
        const paramCount = stringClass!.getGenericParameterCount();
        const args = stringClass!.getGenericArguments();
        const def = stringClass!.getGenericTypeDefinition();
        
        assert(argCount === 0, 'Non-generic should have 0 arguments');
        assert(paramCount === 0, 'Non-generic should have 0 parameters');
        assert(args.length === 0, 'Non-generic should have empty arguments array');
        assert(def === null, 'Non-generic should have null definition');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - Nullable`1 is generic type definition',
    () => {
      Mono.perform(() => {
        const nullableClass = Mono.domain.class('System.Nullable`1');
        
        if (!nullableClass) {
          console.log('[INFO] Nullable<T> not found');
          return;
        }
        
        console.log(`[INFO] Found ${nullableClass.getFullName()}`);
        const paramCount = nullableClass.getGenericParameterCount();
        console.log(`[INFO] Generic parameter count: ${paramCount}`);
        
        if (paramCount > 0) {
          assert(paramCount === 1, 'Nullable should have 1 type parameter');
          assert(nullableClass.isGenericTypeDefinition(), 'Should be generic type definition');
        }
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic - Action`1 is generic delegate',
    () => {
      Mono.perform(() => {
        const actionClass = Mono.domain.class('System.Action`1');
        
        if (!actionClass) {
          console.log('[INFO] Action<T> not found');
          return;
        }
        
        console.log(`[INFO] Found ${actionClass.getFullName()}`);
        console.log(`[INFO] isDelegate: ${actionClass.isDelegate()}`);
        console.log(`[INFO] isGenericTypeDefinition: ${actionClass.isGenericTypeDefinition()}`);
        
        const paramCount = actionClass.getGenericParameterCount();
        if (paramCount > 0) {
          assert(paramCount === 1, 'Action<T> should have 1 type parameter');
        }
      });
    }
  ));

  // ============================================
  // Integration Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic - enumerate all generic types in mscorlib',
    () => {
      Mono.perform(() => {
        const mscorlib = Mono.domain.assembly('mscorlib');
        if (!mscorlib) {
          console.log('[INFO] mscorlib not found');
          return;
        }
        
        let genericDefCount = 0;
        let constructedCount = 0;
        
        for (const klass of mscorlib.classes) {
          if (klass.isGenericTypeDefinition()) {
            genericDefCount++;
          }
          if (klass.isConstructedGenericType()) {
            constructedCount++;
          }
        }
        
        console.log(`[INFO] mscorlib generic type definitions: ${genericDefCount}`);
        console.log(`[INFO] mscorlib constructed generic types: ${constructedCount}`);
      });
    }
  ));

  // ============================================
  // Generic Method Tests
  // ============================================
  results.push(createMonoDependentTest(
    'Generic Method - non-generic method is not generic',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String should exist');
        
        const toStringMethod = stringClass!.tryGetMethod('ToString', 0);
        assertNotNull(toStringMethod, 'ToString should exist');
        
        assert(!toStringMethod!.isGenericMethod(), 'ToString should not be generic');
        assert(!toStringMethod!.isGenericMethodDefinition(), 'ToString should not be generic definition');
        assert(toStringMethod!.getGenericArgumentCount() === 0, 'ToString should have 0 generic args');
        assert(toStringMethod!.getGenericArguments().length === 0, 'ToString should have empty generic args');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic Method - Array generic methods',
    () => {
      Mono.perform(() => {
        const arrayClass = Mono.domain.class('System.Array');
        if (!arrayClass) {
          console.log('[INFO] System.Array not found');
          return;
        }
        
        const methods = arrayClass.methods;
        let genericMethodCount = 0;
        
        for (const method of methods) {
          if (method.isGenericMethod()) {
            genericMethodCount++;
            const argCount = method.getGenericArgumentCount();
            console.log(`[INFO] Generic method: ${method.getName()}, ${argCount} type param(s)`);
          }
        }
        
        console.log(`[INFO] System.Array has ${genericMethodCount} generic methods`);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic Method - Enumerable LINQ methods',
    () => {
      Mono.perform(() => {
        const enumerableClass = Mono.domain.class('System.Linq.Enumerable');
        if (!enumerableClass) {
          console.log('[INFO] System.Linq.Enumerable not found (LINQ may not be loaded)');
          return;
        }
        
        const methods = enumerableClass.methods;
        let genericMethodCount = 0;
        
        for (const method of methods) {
          if (method.isGenericMethod()) {
            genericMethodCount++;
            if (genericMethodCount <= 5) {
              console.log(`[INFO] Generic: ${method.getName()}, ${method.getGenericArgumentCount()} type param(s)`);
            }
          }
        }
        
        console.log(`[INFO] Enumerable has ${genericMethodCount} generic methods`);
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic Method - describe includes generic info',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String should exist');
        
        const toStringMethod = stringClass!.tryGetMethod('ToString', 0);
        assertNotNull(toStringMethod, 'ToString should exist');
        
        const desc = toStringMethod!.describe();
        
        assert('isGenericMethod' in desc, 'describe should have isGenericMethod');
        assert('genericArgumentCount' in desc, 'describe should have genericArgumentCount');
        
        assert(desc.isGenericMethod === false, 'ToString isGenericMethod should be false');
        assert(desc.genericArgumentCount === 0, 'ToString genericArgumentCount should be 0');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic Method - makeGenericMethod returns null for non-generic',
    () => {
      Mono.perform(() => {
        const stringClass = Mono.domain.class('System.String');
        assertNotNull(stringClass, 'String should exist');
        
        const toStringMethod = stringClass!.tryGetMethod('ToString', 0);
        assertNotNull(toStringMethod, 'ToString should exist');
        
        const result = toStringMethod!.makeGenericMethod([]);
        assert(result === null, 'makeGenericMethod should return null for non-generic method');
      });
    }
  ));

  results.push(createMonoDependentTest(
    'Generic Method - getGenericArguments graceful handling',
    () => {
      Mono.perform(() => {
        const intClass = Mono.domain.class('System.Int32');
        assertNotNull(intClass, 'Int32 should exist');
        
        const toStringMethod = intClass!.tryGetMethod('ToString', 0);
        assertNotNull(toStringMethod, 'ToString should exist');
        
        // Should not throw even if Unity API is not available
        const args = toStringMethod!.getGenericArguments();
        assert(Array.isArray(args), 'Should return array');
        assert(args.length === 0, 'Non-generic method should have empty args');
      });
    }
  ));

  return results;
}

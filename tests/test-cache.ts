/**
 * LRU Cache Tests
 * Tests for the LRU (Least Recently Used) cache implementation
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertThrows, assertPerformWorks } from "./test-framework";
import { LruCache } from "../src/utils/lru-cache";

export function testLruCache(): TestResult {
  console.log("\nLRU Cache:");

  const suite = new TestSuite("LRU Cache Tests");

  // Test basic Mono.perform functionality first
  suite.addResult(createTest("Mono.perform should work for cache tests", () => {
    assertPerformWorks("Mono.perform() should work for cache tests");
  }));

  suite.addResult(createTest("LRU cache accepts valid capacity", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(10);
      assert(cache !== null, "Cache should be created");
    });
  }));

  suite.addResult(createTest("LRU cache rejects invalid capacity", () => {
    Mono.perform(() => {
      assertThrows(() => {
        new LruCache<string, number>(0);
      }, "Should throw on zero capacity");

      assertThrows(() => {
        new LruCache<string, number>(-1);
      }, "Should throw on negative capacity");
    });
  }));

  suite.addResult(createTest("LRU cache stores and retrieves values", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      assert(cache.get("a") === 1, "Should retrieve value for 'a'");
      assert(cache.get("b") === 2, "Should retrieve value for 'b'");
      assert(cache.get("c") === 3, "Should retrieve value for 'c'");
    });
  }));

  suite.addResult(createTest("LRU cache evicts oldest entry when full", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // 'a' is now the oldest
      cache.set("d", 4); // Should evict 'a'

      assert(cache.get("a") === undefined, "'a' should be evicted");
      assert(cache.get("b") === 2, "'b' should still exist");
      assert(cache.get("c") === 3, "'c' should still exist");
      assert(cache.get("d") === 4, "'d' should be present");
    });
  }));

  suite.addResult(createTest("LRU cache updates access order on get", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access 'a' to make it most recent
      cache.get("a");

      // Add 'd', should evict 'b' (oldest)
      cache.set("d", 4);

      assert(cache.get("a") === 1, "'a' should still exist (was accessed)");
      assert(cache.get("b") === undefined, "'b' should be evicted");
      assert(cache.get("c") === 3, "'c' should still exist");
      assert(cache.get("d") === 4, "'d' should be present");
    });
  }));

  suite.addResult(createTest("LRU cache handles overwriting existing keys", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("a", 10); // Overwrite 'a'

      assert(cache.get("a") === 10, "'a' should have new value");
      assert(cache.get("b") === 2, "'b' should still exist");
    });
  }));

  suite.addResult(createTest("LRU cache has() returns correct boolean", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);

      assert(cache.has("a") === true, "Should return true for existing key");
      assert(cache.has("b") === false, "Should return false for non-existing key");
    });
  }));

  suite.addResult(createTest("LRU cache clear() removes all entries", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      cache.clear();

      assert(cache.get("a") === undefined, "'a' should be cleared");
      assert(cache.get("b") === undefined, "'b' should be cleared");
      assert(cache.get("c") === undefined, "'c' should be cleared");
    });
  }));

  suite.addResult(createTest("Function cache stores and retrieves NativeFunctions", () => {
    Mono.perform(() => {
      type VoidFunc = NativeFunction<void, []>;
      const cache = new LruCache<string, VoidFunc>(10);
      const fn1 = new NativeFunction(ptr("0x1234"), "void", []) as VoidFunc;
      const fn2 = new NativeFunction(ptr("0x5678"), "void", []) as VoidFunc;

      cache.set("func1", fn1);
      cache.set("func2", fn2);

      assert(cache.get("func1") === fn1, "Should retrieve func1");
      assert(cache.get("func2") === fn2, "Should retrieve func2");
    });
  }));

  // Modern API integration tests
  suite.addResult(createTest("Cache works with Mono API integration", () => {
    Mono.perform(() => {
      const api = Mono.api;
      const cache = new LruCache<string, NativePointer>(5);

      // Cache some common API exports
      if (api.hasExport("mono_get_root_domain")) {
        const rootDomainPtr = api.getRootDomain();
        cache.set("root_domain", rootDomainPtr);

        assert(cache.get("root_domain") === rootDomainPtr, "Should cache domain pointer");
      }

      if (api.hasExport("mono_thread_attach")) {
        const threadAttachPtr = ptr("0x1000"); // Mock pointer
        cache.set("thread_attach", threadAttachPtr);

        assert(cache.get("thread_attach") === threadAttachPtr, "Should cache function pointer");
      }

      // Test cache functionality
      assert(cache.has("root_domain"), "Cache should contain root_domain");
    });
  }));

  suite.addResult(createTest("Cache performance with multiple operations", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(100);
      const startTime = Date.now();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
        const value = cache.get(`key${i % 50}`); // Access some keys multiple times
        assert(value === i % 50, "Should retrieve correct value");
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(duration < 500, `1000 cache operations should complete quickly (took ${duration}ms)`);
      // Cache should be at capacity (items beyond 100 were evicted)
      assert(cache.has("key99"), "Cache should contain recent items");
      assert(!cache.has("key0"), "Oldest items should be evicted");
    });
  }));

  const summary = suite.getSummary();
  
  return {
    name: "LRU Cache Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: false,
    message: `${summary.passed}/${summary.total} cache tests passed`,
  };
}

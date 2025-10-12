/**
 * LRU Cache Tests
 * Tests for the LRU (Least Recently Used) cache implementation
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertThrows, createPerformSmokeTest } from "./test-framework";
import { LruCache } from "../src/utils/lru-cache";

export function testLruCache(): TestResult {
  console.log("\nLRU Cache:");

  const suite = new TestSuite("LRU Cache Tests");

  // Test basic Mono.perform functionality first
  suite.addResult(createPerformSmokeTest("cache tests"));

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

  suite.addResult(createTest("LRU cache supports size and delete operations", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      assert(cache.size === 2, "Cache size should reflect inserted entries");
      assert(cache.delete("a") === true, "delete should remove existing entry");
      assert(cache.size === 1, "Cache size should update after delete");
      assert(cache.has("a") === false, "Deleted key should not be present");
      assert(cache.delete("missing") === false, "delete should return false for unknown keys");
    });
  }));

  suite.addResult(createTest("LRU cache getOrCreate memoizes factory results", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, number>(3);
      let factoryCalls = 0;
      const first = cache.getOrCreate("key", () => {
        factoryCalls += 1;
        return 42;
      });
      const second = cache.getOrCreate("key", () => {
        factoryCalls += 1;
        return 99;
      });
      assert(first === 42, "First factory value should be returned");
      assert(second === 42, "Cached value should be returned on subsequent calls");
      assert(factoryCalls === 1, "Factory should only be invoked once");
    });
  }));

  suite.addResult(createTest("LRU cache triggers eviction callbacks", () => {
    Mono.perform(() => {
      const evicted: Array<[string, number]> = [];
      const cache = new LruCache<string, number>({
        capacity: 1,
        onEvict: (key, value) => {
          evicted.push([key, value]);
        },
      });

      cache.set("a", 1);
      cache.set("b", 2); // Evicts "a"
      assert(evicted.length === 1, "Eviction callback should run when capacity exceeded");
      assert(evicted[0][0] === "a", "First evicted key should be 'a'");
      assert(evicted[0][1] === 1, "First evicted value should be 1");

      cache.clear(); // clearing should evict remaining entry
      assert(evicted.length === 2, "Eviction callback should run when clearing cache");
      assert(evicted[1][0] === "b", "Second evicted key should be 'b'");
    });
  }));

  suite.addResult(createTest("Function cache stores and retrieves NativeFunctions", () => {
    Mono.perform(() => {
      const cache = new LruCache<string, NativeFunction<any, NativePointerValue[]>>(10);
      const attachFn = Mono.api.getNativeFunction("mono_thread_attach");
      const detachFn = Mono.api.getNativeFunction("mono_thread_detach");

      cache.set("mono_thread_attach", attachFn);
      cache.set("mono_thread_detach", detachFn);

      assert(cache.get("mono_thread_attach") === attachFn, "Should retrieve mono_thread_attach");
      assert(cache.get("mono_thread_detach") === detachFn, "Should retrieve mono_thread_detach");
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
        const moduleHandle = Process.getModuleByName(Mono.module.name);
        let exportPtr = moduleHandle.findExportByName("mono_thread_attach");

        if (!exportPtr || exportPtr.isNull()) {
          const matchingModule = Process.enumerateModules().find(m => m.path === Mono.module.path);
          if (matchingModule) {
            exportPtr = Process.getModuleByName(matchingModule.name).findExportByName("mono_thread_attach");
          }
        }

        if (exportPtr && !exportPtr.isNull()) {
          cache.set("thread_attach", exportPtr);
          const cachedPtr = cache.get("thread_attach");
          assert(cachedPtr !== undefined && cachedPtr.equals(exportPtr), "Should cache real mono_thread_attach pointer");
        } else {
          throw new Error("mono_thread_attach export not found in current module");
        }
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
        if (value !== undefined) {
          assert(value === i % 50, "Should retrieve correct value when present");
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      assert(duration < 500, `1000 cache operations should complete quickly (took ${duration}ms)`);
      let presentCount = 0;
      for (let i = 0; i < 1000; i++) {
        if (cache.has(`key${i}`)) {
          presentCount++;
        }
      }
      assert(presentCount <= 100, "Cache should not exceed configured capacity");
      assert(cache.has("key999"), "Cache should retain the most recently written items");
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

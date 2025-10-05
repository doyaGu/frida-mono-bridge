/**
 * Domain Access Tests
 * Tests Mono AppDomain operations
 */

import Mono from "../src";
import { TestResult, TestSuite, createTest, assert, assertNotNull, assertPerformWorks, assertDomainAvailable } from "./test-framework";

export function testDomainAccess(): TestResult {
  console.log("\nDomain Access:");
  
  const suite = new TestSuite("Domain Tests");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for domain tests", () => {
    assertPerformWorks("Mono.perform() should work for domain tests");
  }));

  suite.addResult(createTest("Mono.domain property should be accessible", () => {
    assertDomainAvailable("Mono.domain should be accessible");
  }));

  suite.addResult(createTest("Root domain should be accessible", () => {
    Mono.perform(() => {
      const domain = Mono.api.getRootDomain();
      assertNotNull(domain, "Root domain should not be null");
      assert(!domain.isNull(), "Root domain should not be NULL pointer");
    });
  }));
  
  suite.addResult(createTest("Root domain should be cached", () => {
    Mono.perform(() => {
      const domain1 = Mono.api.getRootDomain();
      const domain2 = Mono.api.getRootDomain();

      assertNotNull(domain1, "First call should return domain");
      assertNotNull(domain2, "Second call should return domain");
      assert(domain1.equals(domain2), "Should return the same domain pointer");
    });
  }));
  
  suite.addResult(createTest("Current domain can be retrieved", () => {
    Mono.perform(() => {
      // mono_domain_get is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_get")) {
        console.log("    (Skipped: mono_domain_get not available in this Mono version)");
        return;
      }
      const current = Mono.api.native.mono_domain_get();
      assertNotNull(current, "Current domain should not be null");
      assert(!current.isNull(), "Current domain should not be NULL");
    });
  }));

  suite.addResult(createTest("Current domain should be root domain initially", () => {
    Mono.perform(() => {
      // mono_domain_get is optional in some Mono versions
      if (!Mono.api.hasExport("mono_domain_get")) {
        console.log("    (Skipped: mono_domain_get not available in this Mono version)");
        return;
      }
      const root = Mono.api.getRootDomain();
      const current = Mono.api.native.mono_domain_get();

      assert(root.equals(current), "Current domain should equal root domain");
    });
  }));
  
  suite.addResult(createTest("Multiple domain retrievals should be consistent", () => {
    Mono.perform(() => {
      const domains = [];
      for (let i = 0; i < 5; i++) {
        domains.push(Mono.api.getRootDomain());
      }

      for (let i = 1; i < domains.length; i++) {
        assert(domains[0].equals(domains[i]), `Domain ${i} should equal domain 0`);
      }
    });
  }));

  // Modern fluent API tests
  suite.addResult(createTest("Domain should have assembly access methods", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      assert(typeof domain.getAssemblies === "function", "Domain should have getAssemblies method");
      assert(typeof domain.assembly === "function", "Domain should have assembly method");
      assert(typeof domain.class === "function", "Domain should have class method");

      const assemblies = domain.getAssemblies();
      assert(Array.isArray(assemblies), "getAssemblies should return array");
    });
  }));

  suite.addResult(createTest("Domain should be accessible through multiple calls", () => {
    Mono.perform(() => {
      const domain1 = Mono.domain;
      const domain2 = Mono.domain;

      assert(domain1 !== null, "First domain access should work");
      assert(domain2 !== null, "Second domain access should work");
      assert(domain1 === domain2, "Domain should be cached (same instance)");
    });
  }));

  const summary = suite.getSummary();
  
  return {
    name: "Domain Access Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: false,
    message: `${summary.passed}/${summary.total} domain tests passed`,
  };
}

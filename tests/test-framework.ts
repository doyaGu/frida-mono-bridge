/**
 * Test Framework
 * Provides utilities for writing and running tests
 */

import Mono from "../src";

export interface TestResult {
  name: string;
  passed: boolean;
  failed: boolean;
  skipped: boolean;
  error?: Error;
  message?: string;
  duration?: number;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

export class TestSuite {
  public results: TestResult[] = [];

  constructor(public readonly name: string) {}

  addResult(result: TestResult): void {
    this.results.push(result);
  }

  getSummary(): TestSummary {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => r.failed).length,
      skipped: this.results.filter(r => r.skipped).length,
      results: this.results,
    };
  }
}

export function createTest(name: string, testFn: () => void): TestResult {
  const startTime = Date.now();
  try {
    testFn();
    const duration = Date.now() - startTime;
    console.log(`  PASS ${name} (${duration}ms)`);
    return {
      name,
      passed: true,
      failed: false,
      skipped: false,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`  FAIL ${name} (${duration}ms)`);
    if (error instanceof Error) {
      console.error(`    Error: ${error.message}`);
      if (error.stack) {
        console.error(`    Stack: ${error.stack.split('\n').slice(0, 3).join('\n    ')}`);
      }
    }
    return {
      name,
      passed: false,
      failed: true,
      skipped: false,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

export function createSkippedTest(name: string, reason?: string): TestResult {
  console.log(`  ⊘ ${name} (skipped${reason ? ': ' + reason : ''})`);
  return {
    name,
    passed: false,
    failed: false,
    skipped: true,
    message: reason,
  };
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed (null check): ${message}`);
  }
}

export function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    throw new Error(`Assertion failed: Expected function to throw, but it didn't. ${message}`);
  } catch (error) {
    // Expected
    if (error instanceof Error && error.message.includes("Expected function to throw")) {
      throw error;
    }
  }
}

// Modern API assertion helpers for the fluent API
export function assertPerformWorks(message: string): void {
  try {
    Mono.perform(() => {
      // If this executes, perform() is working
    });
  } catch (error) {
    throw new Error(`Mono.perform() not working: ${message}. Error: ${error}`);
  }
}

export function assertDomainAvailable(message: string): void {
  try {
    const domain = Mono.domain;
    if (!domain) {
      throw new Error(`Mono.domain not available: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.domain access failed: ${message}. Error: ${error}`);
  }
}

export function assertApiAvailable(message: string): void {
  try {
    const api = Mono.api;
    if (!api) {
      throw new Error(`Mono.api not available: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.api access failed: ${message}. Error: ${error}`);
  }
}

export function assertPerformReturns<T>(fn: () => T, expected: T, message: string): void {
  try {
    const result = Mono.perform(fn);
    if (result !== expected) {
      throw new Error(`Expected ${expected}, got ${result}: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.perform() failed: ${message}. Error: ${error}`);
  }
}

export function assertThrowsInPerform(fn: () => void, expectedErrorPattern: string | RegExp, message: string): void {
  try {
    Mono.perform(fn);
    throw new Error(`Expected function to throw inside Mono.perform(): ${message}`);
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    const pattern = expectedErrorPattern instanceof RegExp ? expectedErrorPattern : new RegExp(expectedErrorPattern);
    if (!pattern.test(errorStr)) {
      throw new Error(`Expected error matching ${expectedErrorPattern}, got: ${errorStr}: ${message}`);
    }
  }
}

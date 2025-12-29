/**
 * Test Framework
 * Provides utilities for writing and running tests
 *
 * V2 Migration: All test helpers now use async Mono.perform()
 */

import Mono from "../src";
import type { MonoDomain } from "../src/model/domain";
import { tryFindMonoModule, tryWaitForMonoModule } from "../src/runtime/module";

export interface TestResult {
  name: string;
  passed: boolean;
  failed: boolean;
  skipped: boolean;
  error?: Error;
  message?: string;
  duration?: number;
  category?: TestCategory;
  requiresMono?: boolean;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  duration?: number;
}

export enum TestCategory {
  STANDALONE = "standalone",
  MONO_DEPENDENT = "mono-dependent",
  PERFORMANCE = "performance",
  INTEGRATION = "integration",
  ERROR_HANDLING = "error-handling",
}

export interface TestOptions {
  category?: TestCategory;
  requiresMono?: boolean;
  skipIfNoMono?: boolean;
  timeout?: number;
}

export class TestSuite {
  public results: TestResult[] = [];
  private readonly startTime = Date.now();

  constructor(
    public readonly name: string,
    public readonly category?: TestCategory,
  ) {}

  addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * Add a test result that may be a Promise (for async tests).
   * V2: Supports both sync TestResult and Promise<TestResult>
   */
  async addResultAsync(result: TestResult | Promise<TestResult>): Promise<void> {
    const resolvedResult = await result;
    this.results.push(resolvedResult);
  }

  getSummary(): TestSummary {
    return {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => r.failed).length,
      skipped: this.results.filter(r => r.skipped).length,
      results: this.results,
      duration: Date.now() - this.startTime,
    };
  }

  getMonoDependentTests(): TestResult[] {
    return this.results.filter(r => r.requiresMono);
  }

  getStandaloneTests(): TestResult[] {
    return this.results.filter(r => !r.requiresMono);
  }

  getByCategory(category: TestCategory): TestResult[] {
    return this.results.filter(r => r.category === category);
  }
}

let monoDetected = false;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as { then?: unknown }).then === "function";
}

function normalizeTimeout(timeout?: number): number | undefined {
  if (timeout === undefined) {
    return undefined;
  }
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return undefined;
  }
  return timeout;
}

function getMonoMissingReason(): string {
  const moduleName = Mono.config.moduleName;
  if (Array.isArray(moduleName) && moduleName.length > 0) {
    return `Mono module not found (${moduleName.join(", ")})`;
  }
  if (typeof moduleName === "string" && moduleName.trim().length > 0) {
    return `Mono module not found (${moduleName})`;
  }
  return "Mono module not detected";
}

function getMonoSkipReason(options: TestOptions | undefined, requiresMono: boolean): string | null {
  if (!options?.skipIfNoMono || !requiresMono) {
    return null;
  }

  if (monoDetected) {
    return null;
  }

  try {
    const moduleInfo = tryFindMonoModule(Mono.config.moduleName);
    if (!moduleInfo) {
      return getMonoMissingReason();
    }
    monoDetected = true;
  } catch {
    return getMonoMissingReason();
  }

  return null;
}

async function getMonoSkipReasonAsync(
  options: TestOptions | undefined,
  requiresMono: boolean,
  timeoutMs: number | undefined,
): Promise<string | null> {
  if (!options?.skipIfNoMono || !requiresMono) {
    return null;
  }

  if (monoDetected) {
    return null;
  }

  const waitTimeoutMs = normalizeTimeout(timeoutMs) ?? Mono.config.initializeTimeoutMs;
  const warnAfterMs = Math.min(Mono.config.warnAfterMs, waitTimeoutMs);

  try {
    const moduleInfo = await tryWaitForMonoModule({
      moduleName: Mono.config.moduleName,
      timeoutMs: waitTimeoutMs,
      warnAfterMs,
    });
    if (!moduleInfo) {
      return getMonoMissingReason();
    }
    monoDetected = true;
  } catch {
    return getMonoMissingReason();
  }

  return null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Test "${name}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createTest(name: string, testFn: () => void | Promise<void>, options?: TestOptions): TestResult {
  const startTime = Date.now();
  const normalizedOptions: TestOptions = { ...options, requiresMono: options?.requiresMono ?? true };
  const timeoutMs = normalizeTimeout(normalizedOptions.timeout);
  const skipReason = getMonoSkipReason(normalizedOptions, normalizedOptions.requiresMono ?? true);
  if (skipReason) {
    return createSkippedTest(name, skipReason, normalizedOptions);
  }

  try {
    const result = testFn();
    // Handle both sync and async test functions
    if (isThenable(result)) {
      Promise.resolve(result).catch(error => {
        console.error(`  FAIL ${name} (async)`);
        if (error instanceof Error) {
          console.error(`    Error: ${error.message}`);
        }
      });
      throw new Error("Async tests must use createStandaloneTestAsync or a Mono-perform test helper");
    }
    const duration = Date.now() - startTime;
    if (timeoutMs !== undefined && duration > timeoutMs) {
      throw new Error(`Test "${name}" timed out after ${timeoutMs}ms`);
    }
    console.log(`  PASS ${name} (${duration}ms)`);
    return {
      name,
      passed: true,
      failed: false,
      skipped: false,
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  } catch (error) {
    if (error instanceof TestSkippedError) {
      const duration = Date.now() - startTime;
      return createSkippedTest(name, error.message, normalizedOptions, duration);
    }
    const duration = Date.now() - startTime;
    console.error(`  FAIL ${name} (${duration}ms)`);
    if (error instanceof Error) {
      console.error(`    Error: ${error.message}`);
      if (error.stack) {
        console.error(`    Stack: ${error.stack.split("\n").slice(0, 3).join("\n    ")}`);
      }
    }
    return {
      name,
      passed: false,
      failed: true,
      skipped: false,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  }
}

export function createSkippedTest(
  name: string,
  reason?: string,
  options?: TestOptions,
  duration?: number,
): TestResult {
  console.log(`  - ${name} (skipped${reason ? ": " + reason : ""})`);
  return {
    name,
    passed: false,
    failed: false,
    skipped: true,
    message: reason,
    duration,
    category: options?.category,
    requiresMono: options?.requiresMono,
  };
}

export class TestSkippedError extends Error {
  constructor(message?: string) {
    super(message ?? "Skipped");
    this.name = "TestSkippedError";
  }
}

export function skipTest(reason?: string): never {
  throw new TestSkippedError(reason);
}

/**
 * Create a test that runs inside Mono.perform() with proper async handling.
 * V2: Now returns a Promise and properly awaits Mono.perform().
 */
export async function createMonoTestAsync<T>(
  name: string,
  testFn: () => T | Promise<T>,
  options?: TestOptions,
): Promise<TestResult> {
  const startTime = Date.now();
  const normalizedOptions: TestOptions = {
    ...options,
    category: options?.category ?? TestCategory.MONO_DEPENDENT,
    requiresMono: options?.requiresMono ?? true,
  };
  const timeoutMs = normalizeTimeout(normalizedOptions.timeout);
  const skipReason = await getMonoSkipReasonAsync(
    normalizedOptions,
    normalizedOptions.requiresMono ?? true,
    timeoutMs,
  );
  if (skipReason) {
    return createSkippedTest(name, skipReason, normalizedOptions);
  }
  const elapsedMs = Date.now() - startTime;
  const remainingTimeout = timeoutMs !== undefined ? Math.max(timeoutMs - elapsedMs, 0) : undefined;

  try {
    const performPromise = Mono.perform(async () => {
      try {
        await testFn();
        return { skipped: false as const };
      } catch (error) {
        if (error instanceof TestSkippedError) {
          return { skipped: true as const, reason: error.message };
        }
        throw error;
      }
    });
    const outcome =
      remainingTimeout !== undefined
        ? await withTimeout(performPromise, remainingTimeout, name)
        : await performPromise;
    if (outcome.skipped) {
      const duration = Date.now() - startTime;
      return createSkippedTest(name, outcome.reason, normalizedOptions, duration);
    }
    const duration = Date.now() - startTime;
    console.log(`  PASS ${name} (${duration}ms)`);
    return {
      name,
      passed: true,
      failed: false,
      skipped: false,
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  } catch (error) {
    if (error instanceof TestSkippedError) {
      const duration = Date.now() - startTime;
      return createSkippedTest(name, error.message, normalizedOptions, duration);
    }
    const duration = Date.now() - startTime;
    console.error(`  FAIL ${name} (${duration}ms)`);
    if (error instanceof Error) {
      console.error(`    Error: ${error.message}`);
      if (error.stack) {
        console.error(`    Stack: ${error.stack.split("\n").slice(0, 3).join("\n    ")}`);
      }
    }
    return {
      name,
      passed: false,
      failed: true,
      skipped: false,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  }
}

/**
 * Create a domain test with proper async handling.
 * V2: Properly awaits Mono.perform().
 */
export async function createDomainTestAsync(
  name: string,
  testFn: (domain: MonoDomain) => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  return createMonoTestAsync(
    name,
    async () => {
      const domain = Mono.domain;
      await testFn(domain);
    },
    options,
  );
}

/**
 * Raise an assertion failure with consistent formatting.
 */
export function fail(message: string): never {
  throw new Error(`Assertion failed: ${message}`);
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
    if (error instanceof TestSkippedError) {
      throw error;
    }
    // Expected
    if (error instanceof Error && error.message.includes("Expected function to throw")) {
      throw error;
    }
  }
}

// Modern API assertion helpers for the fluent API
export async function assertPerformWorks(message: string): Promise<void> {
  try {
    await Mono.perform(() => {
      // If this executes, perform() is working
    });
  } catch (error) {
    throw new Error(`Mono.perform() not working: ${message}. Error: ${error}`);
  }
}

export async function assertDomainAvailable(message: string): Promise<void> {
  try {
    const domain = await Mono.perform(() => Mono.domain);
    if (!domain) {
      throw new Error(`Mono.domain not available: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.domain access failed: ${message}. Error: ${error}`);
  }
}

export async function assertApiAvailable(message: string): Promise<void> {
  try {
    const api = await Mono.perform(() => Mono.api);
    if (!api) {
      throw new Error(`Mono.api not available: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.api access failed: ${message}. Error: ${error}`);
  }
}

export async function assertPerformReturns<T>(fn: () => T, expected: T, message: string): Promise<void> {
  try {
    const result = await Mono.perform(fn);
    if (result !== expected) {
      throw new Error(`Expected ${expected}, got ${result}: ${message}`);
    }
  } catch (error) {
    throw new Error(`Mono.perform() failed: ${message}. Error: ${error}`);
  }
}

export async function assertThrowsInPerform(
  fn: () => void,
  expectedErrorPattern: string | RegExp,
  message: string,
): Promise<void> {
  try {
    await Mono.perform(fn);
    throw new Error(`Expected function to throw inside Mono.perform(): ${message}`);
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    const pattern = expectedErrorPattern instanceof RegExp ? expectedErrorPattern : new RegExp(expectedErrorPattern);
    if (!pattern.test(errorStr)) {
      throw new Error(`Expected error matching ${expectedErrorPattern}, got: ${errorStr}: ${message}`);
    }
  }
}

export interface PerformSmokeTestOptions {
  testName?: string;
  message?: string;
}

export async function createPerformSmokeTest(
  context: string,
  options: PerformSmokeTestOptions = {},
): Promise<TestResult> {
  const testName = options.testName ?? `Mono.perform should work for ${context}`;
  const message = options.message ?? `Mono.perform() should work for ${context}`;
  return createMonoTestAsync(testName, async () => {
    await assertPerformWorks(message);
  });
}

export interface ApiAvailabilityTestOptions {
  context: string;
  testName?: string;
  message?: string;
  requiredExports?: string[];
  validate?: (api: any) => void;
}

export async function createApiAvailabilityTest(options: ApiAvailabilityTestOptions): Promise<TestResult> {
  const { context, testName, message, requiredExports = [], validate } = options;

  const resolvedTestName = testName ?? "Mono API should be available";
  const resolvedMessage = message ?? `Mono.api should be accessible for ${context}`;

  return createMonoTestAsync(resolvedTestName, async () => {
    await assertApiAvailable(resolvedMessage);
    const api = Mono.api;

    for (const exportName of requiredExports) {
      assert(api.hasExport(exportName), `${exportName} should be available`);
    }

    if (validate) {
      validate(api);
    }
  });
}

export interface NestedPerformTestOptions {
  context: string;
  testName?: string;
  message?: string;
  validate?: (domain: MonoDomain) => void;
}

export async function createNestedPerformTest(options: NestedPerformTestOptions): Promise<TestResult> {
  const {
    context,
    testName = `Should support ${context} in nested perform calls`,
    message = `Nested Mono.perform should work for ${context}`,
    validate,
  } = options;

  return createDomainTestAsync(testName, async domain => {
    await Mono.perform(async () => {
      try {
        await validate?.(domain);
      } catch (error) {
        throw new Error(`${message}: ${error}`);
      }
    });
  });
}

export async function assertDomainCached(message = "Mono.domain should be cached instance"): Promise<void> {
  await Mono.perform(() => {
    const domain1 = Mono.domain;
    const domain2 = Mono.domain;
    if (domain1 !== domain2) {
      fail(message);
    }
  });
}

// Enhanced test creation functions with categorization
export function createStandaloneTest(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): TestResult {
  const result = createTest(name, testFn, {
    ...options,
    category: TestCategory.STANDALONE,
    requiresMono: false,
  });
  return result;
}

export async function createStandaloneTestAsync(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  const startTime = Date.now();
  const normalizedOptions: TestOptions = {
    ...options,
    category: options?.category ?? TestCategory.STANDALONE,
    requiresMono: options?.requiresMono ?? false,
  };
  const timeoutMs = normalizeTimeout(normalizedOptions.timeout);
  const skipReason = await getMonoSkipReasonAsync(
    normalizedOptions,
    normalizedOptions.requiresMono ?? false,
    timeoutMs,
  );
  if (skipReason) {
    return createSkippedTest(name, skipReason, normalizedOptions);
  }
  const elapsedMs = Date.now() - startTime;
  const remainingTimeout = timeoutMs !== undefined ? Math.max(timeoutMs - elapsedMs, 0) : undefined;

  try {
    const testPromise = Promise.resolve().then(() => testFn());
    if (remainingTimeout !== undefined) {
      await withTimeout(testPromise, remainingTimeout, name);
    } else {
      await testPromise;
    }
    const duration = Date.now() - startTime;
    console.log(`  PASS ${name} (${duration}ms)`);
    return {
      name,
      passed: true,
      failed: false,
      skipped: false,
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  } catch (error) {
    if (error instanceof TestSkippedError) {
      const duration = Date.now() - startTime;
      return createSkippedTest(name, error.message, normalizedOptions, duration);
    }
    const duration = Date.now() - startTime;
    console.error(`  FAIL ${name} (${duration}ms)`);
    if (error instanceof Error) {
      console.error(`    Error: ${error.message}`);
      if (error.stack) {
        console.error(`    Stack: ${error.stack.split("\n").slice(0, 3).join("\n    ")}`);
      }
    }
    return {
      name,
      passed: false,
      failed: true,
      skipped: false,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
      category: normalizedOptions.category,
      requiresMono: normalizedOptions.requiresMono,
    };
  }
}

export async function createMonoDependentTest(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  // Wrap the test function in Mono.perform for proper thread attachment
  return createMonoTestAsync(name, testFn, {
    ...options,
    category: TestCategory.MONO_DEPENDENT,
    requiresMono: true,
  });
}

export async function createIntegrationTest(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  // Wrap the test function in Mono.perform for proper thread attachment
  return createMonoTestAsync(name, testFn, {
    ...options,
    category: TestCategory.INTEGRATION,
    requiresMono: true,
  });
}

export async function createPerformanceTest(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  // Wrap the test function in Mono.perform for proper thread attachment
  return createMonoTestAsync(name, testFn, {
    ...options,
    category: TestCategory.PERFORMANCE,
    requiresMono: true,
  });
}

export async function createErrorHandlingTest(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  // Wrap the test function in Mono.perform for proper thread attachment
  return createMonoTestAsync(name, testFn, {
    ...options,
    category: TestCategory.ERROR_HANDLING,
    requiresMono: true,
  });
}

// Enhanced versions of existing functions with categorization
// Note: createMonoDependentTest already wraps in Mono.perform, so no double-wrap needed
export async function createMonoTestEnhanced<T>(
  name: string,
  testFn: () => T | Promise<T>,
  options?: TestOptions,
): Promise<TestResult> {
  return createMonoDependentTest(
    name,
    async () => {
      await testFn();
    },
    options,
  );
}

export async function createDomainTestEnhanced(
  name: string,
  testFn: (domain: MonoDomain) => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  return createMonoDependentTest(
    name,
    async () => {
      const domain = Mono.domain;
      await testFn(domain);
    },
    options,
  );
}

export function createSmokeTest(category: TestCategory, context: string): TestResult {
  return createTest(
    `Smoke test for ${context}`,
    () => {
      // Basic functionality check
      console.log(`[SUCCESS] ${context} smoke test passed`);
    },
    {
      category,
      requiresMono: category === TestCategory.MONO_DEPENDENT,
    },
  );
}

// Additional specialized test creation functions
export async function createMonoThread(
  name: string,
  testFn: () => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  return createMonoDependentTest(name, testFn, {
    ...options,
    category: TestCategory.MONO_DEPENDENT,
  });
}

// Alias for createDomainTestEnhanced to provide consistent naming
export async function createDomainTestEnhancedAlias(
  name: string,
  testFn: (domain: MonoDomain) => void | Promise<void>,
  options?: TestOptions,
): Promise<TestResult> {
  return createDomainTestAsync(name, testFn, options);
}

// ============================================================================
// ERROR HANDLING STRATEGY
// ============================================================================

/**
 * Error handling strategy for tests:
 *
 * 1. tryXxx() methods: Return null on failure, never throw
 * 2. xxx() methods: Throw on failure (required access)
 * 3. Optional features (Unity classes): Return null, log warning
 * 4. Test failures: Always throw to fail the test
 */

/**
 * Handle optional feature access (e.g., Unity-specific classes).
 * Returns null if not available, logs warning.
 *
 * @example
 * ```typescript
 * const gameObjectClass = tryOptionalFeature(
 *   () => domain.tryClass("UnityEngine.GameObject"),
 *   "UnityEngine.GameObject"
 * );
 * if (!gameObjectClass) return; // Skip test
 * ```
 */
export function tryOptionalFeature<T>(
  accessor: () => T | null,
  featureName: string,
  warningMessage?: string,
): T | null {
  try {
    const result = accessor();
    if (result === null) {
      console.log(warningMessage || `  - ${featureName} not available (optional)`);
    }
    return result;
  } catch (error) {
    console.log(warningMessage || `  - ${featureName} not available (optional): ${error}`);
    return null;
  }
}

/**
 * Handle required feature access.
 * Throws with descriptive error if not available.
 *
 * @example
 * ```typescript
 * const stringClass = requireFeature(
 *   () => domain.tryClass("System.String"),
 *   "System.String class"
 * );
 * // stringClass is guaranteed to be non-null here
 * ```
 */
export function requireFeature<T>(
  accessor: () => T | null,
  featureName: string,
): T {
  const result = accessor();
  if (result === null) {
    throw new Error(`Required feature not available: ${featureName}`);
  }
  return result;
}

/**
 * Safely invoke a method that might throw managed exceptions.
 * Returns { success: boolean, result: any, error: any }
 *
 * @example
 * ```typescript
 * const { success, result, error } = safeInvoke(() => {
 *   return method.invoke(instance, args);
 * });
 *
 * if (success) {
 *   assert(result !== null, "Should return value");
 * } else {
 *   console.log(`  - Invocation failed (expected): ${error}`);
 * }
 * ```
 */
export function safeInvoke<T>(
  invoker: () => T,
  errorHandler?: (error: any) => void,
): { success: boolean; result: T | null; error: any } {
  try {
    const result = invoker();
    return { success: true, result, error: null };
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    }
    return { success: false, result: null, error };
  }
}

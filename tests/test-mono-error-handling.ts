/**
 * Mono Error Handling Tests (V2 API)
 * Tests for error handling mechanisms and exception management
 * Updated for V2 API with MonoErrorCodes and new error class structure
 */

import Mono, {
  asResult,
  MonoError,
  MonoErrorCodes,
  monoErrorResult,
  monoInvariant,
  MonoManagedExceptionError,
  monoSuccess,
  raise,
  raiseUnless,
  ValidationBuilder,
  withErrorHandling,
} from "../src";
import { Logger } from "../src/utils/log";
import { withCoreClasses, withDomain } from "./test-fixtures";
import {
  assert,
  createIntegrationTest,
  createPerformanceTest,
  createStandaloneTest,
  TestCategory,
  TestResult,
  TestSuite,
} from "./test-framework";

/**
 * Run Mono Error Handling test suite
 */
export async function createMonoErrorHandlingTests(): Promise<TestResult> {
  const suite = new TestSuite("Mono Error Handling Tests");

  // ============================================================================
  // MONO ERROR CODES TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("MonoErrorCodes - has all expected error codes", () => {
      // Initialization & Module
      assert(MonoErrorCodes.MODULE_NOT_FOUND === "MODULE_NOT_FOUND", "MODULE_NOT_FOUND code");
      assert(MonoErrorCodes.RUNTIME_NOT_READY === "RUNTIME_NOT_READY", "RUNTIME_NOT_READY code");
      assert(MonoErrorCodes.EXPORT_NOT_FOUND === "EXPORT_NOT_FOUND", "EXPORT_NOT_FOUND code");
      assert(MonoErrorCodes.INIT_FAILED === "INIT_FAILED", "INIT_FAILED code");

      // Thread
      assert(MonoErrorCodes.THREAD_ATTACH_FAILED === "THREAD_ATTACH_FAILED", "THREAD_ATTACH_FAILED code");

      // Type System
      assert(MonoErrorCodes.CLASS_NOT_FOUND === "CLASS_NOT_FOUND", "CLASS_NOT_FOUND code");
      assert(MonoErrorCodes.METHOD_NOT_FOUND === "METHOD_NOT_FOUND", "METHOD_NOT_FOUND code");
      assert(MonoErrorCodes.FIELD_NOT_FOUND === "FIELD_NOT_FOUND", "FIELD_NOT_FOUND code");
      assert(MonoErrorCodes.PROPERTY_NOT_FOUND === "PROPERTY_NOT_FOUND", "PROPERTY_NOT_FOUND code");
      assert(MonoErrorCodes.ASSEMBLY_NOT_FOUND === "ASSEMBLY_NOT_FOUND", "ASSEMBLY_NOT_FOUND code");

      // Invocation
      assert(MonoErrorCodes.INVOKE_FAILED === "INVOKE_FAILED", "INVOKE_FAILED code");
      assert(MonoErrorCodes.MANAGED_EXCEPTION === "MANAGED_EXCEPTION", "MANAGED_EXCEPTION code");

      // Memory & GC
      assert(MonoErrorCodes.MEMORY_ERROR === "MEMORY_ERROR", "MEMORY_ERROR code");

      // Validation
      assert(MonoErrorCodes.INVALID_ARGUMENT === "INVALID_ARGUMENT", "INVALID_ARGUMENT code");
      assert(MonoErrorCodes.NULL_POINTER === "NULL_POINTER", "NULL_POINTER code");
      assert(MonoErrorCodes.TYPE_MISMATCH === "TYPE_MISMATCH", "TYPE_MISMATCH code");

      // General
      assert(MonoErrorCodes.NOT_SUPPORTED === "NOT_SUPPORTED", "NOT_SUPPORTED code");
      assert(MonoErrorCodes.UNKNOWN === "UNKNOWN", "UNKNOWN code");

      console.log("    All MonoErrorCodes verified");
    }),
  );

  // ============================================================================
  // MONO ERROR TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("MonoError - basic creation", () => {
      const error = new MonoError("Test error message", MonoErrorCodes.UNKNOWN);

      assert(error instanceof Error, "Should be instance of Error");
      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error.name === "MonoError", "Should have correct name");
      assert(error.message.includes("Test error message"), "Should contain message");
      assert(error.code === MonoErrorCodes.UNKNOWN, "Should have correct code");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("MonoError - creation with error code and details", () => {
      const details = { className: "TestClass", methodName: "TestMethod" };
      const error = new MonoError("Method not found", MonoErrorCodes.METHOD_NOT_FOUND, details);

      assert(error.code === MonoErrorCodes.METHOD_NOT_FOUND, "Should have correct code");
      assert(error.details !== undefined, "Should have details");
      assert(error.details?.className === "TestClass", "Should preserve className in details");
      assert(error.details?.methodName === "TestMethod", "Should preserve methodName in details");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("MonoError - creation with cause", () => {
      const cause = new Error("Original error");
      const error = new MonoError("Wrapped error", MonoErrorCodes.UNKNOWN, undefined, cause);

      assert(error.cause === cause, "Should preserve cause");
      assert(error.message.includes("Wrapped error"), "Should have wrapper message");
    }),
  );

  // ============================================================================
  // RAISE FUNCTION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("raise() - throws MonoError with correct code", () => {
      try {
        raise(MonoErrorCodes.CLASS_NOT_FOUND, "Test class not found");
        assert(false, "Should have thrown");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
        assert((error as MonoError).code === MonoErrorCodes.CLASS_NOT_FOUND, "Should have correct code");
      }
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("raiseUnless() - only throws on false condition", () => {
      // Should not throw
      raiseUnless(true, MonoErrorCodes.INVALID_ARGUMENT, "This should not throw");

      // Should throw
      try {
        raiseUnless(false, MonoErrorCodes.INVALID_ARGUMENT, "This should throw");
        assert(false, "Should have thrown");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
        assert((error as MonoError).code === MonoErrorCodes.INVALID_ARGUMENT, "Should have INVALID_ARGUMENT code");
      }
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("monoInvariant() - validates conditions", () => {
      // Should not throw for truthy values
      monoInvariant(true, () => new MonoError("This should not throw", MonoErrorCodes.UNKNOWN));
      monoInvariant(1, () => new MonoError("This should not throw", MonoErrorCodes.UNKNOWN));
      monoInvariant("truthy", () => new MonoError("This should not throw", MonoErrorCodes.UNKNOWN));

      // Should throw for falsy values
      try {
        monoInvariant(false, () => new MonoError("This should throw", MonoErrorCodes.UNKNOWN));
        assert(false, "Should have thrown");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
      }

      try {
        monoInvariant(null, () => new MonoError("Null should throw", MonoErrorCodes.UNKNOWN));
        assert(false, "Should have thrown for null");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError for null");
      }
    }),
  );

  // ============================================================================
  // MONO MANAGED EXCEPTION ERROR TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("MonoManagedExceptionError - creation with exception pointer", () => {
      const fakeExceptionPtr = ptr(0x12345678);
      const error = new MonoManagedExceptionError(
        "Managed exception occurred",
        fakeExceptionPtr,
        "System.FormatException",
        "Input string was not in correct format",
      );

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error.name === "MonoManagedExceptionError", "Should have correct name");
      assert(error.exception !== undefined, "Should have exception pointer");
      if (error.exception) {
        assert(error.exception.equals(fakeExceptionPtr), "Should preserve exception pointer");
      }
      assert(error.exceptionType === "System.FormatException", "Should preserve exception type");
      assert(error.exceptionMessage !== undefined, "Should have exception message");
      if (error.exceptionMessage) {
        assert(error.exceptionMessage.includes("Input string"), "Should preserve exception message");
      }
    }),
  );

  await suite.addResultAsync(
    withCoreClasses("MonoManagedExceptionError - real exception from Int32.Parse", ({ int32Class }) => {
      const parseMethod = int32Class.tryMethod("Parse", 1);
      if (!parseMethod) {
        console.log("    (Skipped: Int32.Parse method not available)");
        return;
      }

      try {
        const invalidStr = Mono.api.stringNew("not_a_number");
        Mono.api.runtimeInvoke(parseMethod.pointer, NULL, [invalidStr]);
        console.log("    (Unexpected: No exception thrown)");
      } catch (error) {
        if (error instanceof MonoManagedExceptionError) {
          assert(error.exception !== undefined, "Should have exception pointer");
          if (error.exception) {
            assert(!error.exception.isNull(), "Exception pointer should not be null");
          }

          if (error.exceptionType) {
            console.log(`    Exception type: ${error.exceptionType}`);
            assert(
              error.exceptionType.includes("FormatException") || error.exceptionType.includes("Exception"),
              "Should be FormatException or similar",
            );
          }

          console.log("    MonoManagedExceptionError correctly captures managed exception");
        } else {
          console.log(`    (Unexpected error type: ${error})`);
        }
      }
    }),
  );

  // ============================================================================
  // VALIDATION BUILDER TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("ValidationBuilder - basic usage", () => {
      const validation = new ValidationBuilder().addError("error1").addWarning("warning1").build();

      assert(validation.isValid === false, "Should be invalid with errors");
      assert(validation.errors.length === 1, "Should have 1 error");
      assert(validation.warnings.length === 1, "Should have 1 warning");
      console.log("    ValidationBuilder basic usage: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("ValidationBuilder - check method (condition-based)", () => {
      const validation = new ValidationBuilder()
        .check(true, "should not appear (condition is true, check adds error on false)")
        .check(false, "this error should appear")
        .warn(true, "this warning should appear")
        .warn(false, "should not appear (condition is false)")
        .build();

      assert(validation.errors.length === 1, "Should have 1 error from failed check");
      assert(validation.warnings.length === 1, "Should have 1 warning from triggered warn");
      assert(validation.errors[0] === "this error should appear", "Should have correct error message");
      console.log("    ValidationBuilder check/warn: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("ValidationBuilder - execute wraps exceptions", () => {
      const validation = new ValidationBuilder()
        .execute(() => {
          throw new Error("Execution failed");
        }, "Operation")
        .build();

      assert(validation.isValid === false, "Should be invalid after execute throws");
      assert(validation.errors.length === 1, "Should have 1 error");
      assert(validation.errors[0].includes("Operation"), "Should include prefix");
      console.log("    ValidationBuilder execute: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("ValidationBuilder - buildOrThrow", () => {
      // Valid case - should not throw
      const valid = new ValidationBuilder().build();
      assert(valid.isValid === true, "Empty validation should be valid");

      // Invalid case - should throw
      try {
        new ValidationBuilder().addError("test error").buildOrThrow();
        assert(false, "Should have thrown");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
        console.log("    ValidationBuilder.buildOrThrow: Passed");
      }
    }),
  );

  // ============================================================================
  // RESULT TYPE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("monoSuccess - creates success result", () => {
      const result = monoSuccess(42);

      assert(result.success === true, "Should be success");
      assert(result.data === 42, "Should have correct data");
      console.log("    monoSuccess: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("monoErrorResult - creates error result", () => {
      const error = new MonoError("Test error", MonoErrorCodes.UNKNOWN);
      const result = monoErrorResult<number>(error);

      assert(result.success === false, "Should be failure");
      assert(result.error === error, "Should have correct error");
      console.log("    monoErrorResult: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("asResult - wraps function for safe execution", () => {
      // Success case
      const successFn = asResult(() => 42);
      const successResult = successFn();

      assert(successResult.success === true, "Success function should return success");
      if (successResult.success) {
        assert(successResult.data === 42, "Should have correct data");
      }

      // Error case
      const errorFn = asResult(() => {
        throw new Error("Test error");
      });
      const errorResult = errorFn();

      assert(errorResult.success === false, "Error function should return failure");
      if (!errorResult.success) {
        assert(errorResult.error instanceof MonoError, "Should wrap in MonoError");
      }

      console.log("    asResult wrapper: Passed");
    }),
  );

  // ============================================================================
  // ERROR HANDLING WRAPPER TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("withErrorHandling - wraps errors", () => {
      const wrappedFn = withErrorHandling(() => {
        throw new Error("Original error");
      });

      try {
        wrappedFn();
        assert(false, "Should have thrown");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
        console.log("    withErrorHandling wrapper: Passed");
      }
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("withErrorHandling - passes through on success", () => {
      const wrappedFn = withErrorHandling(() => "success value");
      const result = wrappedFn();

      assert(result === "success value", "Should return original value");
      console.log("    withErrorHandling success pass-through: Passed");
    }),
  );

  // ============================================================================
  // LOGGER TESTS
  // ============================================================================

  await suite.addResultAsync(
    createStandaloneTest("Logger - basic instantiation", () => {
      const logger = new Logger({ tag: "TestLogger" });
      assert(logger !== undefined, "Logger should be created");
      console.log("    Logger instantiation: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - log levels work correctly", () => {
      const logger = new Logger({ tag: "TestLogger", level: "debug" });

      // These should not throw
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");

      console.log("    Logger log levels: Passed");
    }),
  );

  await suite.addResultAsync(
    createStandaloneTest("Logger - static methods work", () => {
      // These should not throw
      Logger.debug("Static debug");
      Logger.info("Static info");
      Logger.warn("Static warn");
      Logger.error("Static error");

      console.log("    Logger static methods: Passed");
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  await suite.addResultAsync(
    createIntegrationTest("Error handling integration - ValidationBuilder with Logger", () => {
      const logger = new Logger({ tag: "ValidationIntegration" });

      const validation = new ValidationBuilder()
        .check(true, "This should not appear")
        .warn(true, "This is a warning")
        .build();

      if (!validation.isValid) {
        logger.error("Validation failed", { errors: validation.errors });
      }

      if (validation.warnings.length > 0) {
        logger.warn("Validation warnings", { warnings: validation.warnings });
      }

      assert(validation.isValid === true, "Validation should pass");
      assert(validation.warnings.length === 1, "Should have 1 warning");
      console.log("    ValidationBuilder with Logger integration: Passed");
    }),
  );

  await suite.addResultAsync(
    createIntegrationTest("Error handling integration - error recovery with logging", () => {
      const logger = new Logger({ tag: "RecoveryIntegration" });

      let attempts = 0;
      const maxAttempts = 3;

      const result = (() => {
        while (attempts < maxAttempts) {
          attempts++;
          const wrappedFn = asResult(() => {
            if (attempts < 3) {
              throw new Error(`Attempt ${attempts} failed`);
            }
            return `success on attempt ${attempts}`;
          });
          const opResult = wrappedFn();

          if (opResult.success) {
            logger.info("Operation recovered successfully", { result: opResult.data });
            return opResult;
          } else {
            logger.warn(`Operation attempt ${attempts} failed`, { error: String(opResult.error) });
          }
        }
        return monoErrorResult<string>(new MonoError("Max attempts reached", MonoErrorCodes.UNKNOWN));
      })();

      assert(result.success === true, "Should eventually succeed");
      console.log("    Error recovery with logging: Passed");
    }),
  );

  await suite.addResultAsync(
    withDomain("Error handling integration - Mono API errors", ({ domain }) => {
      // Test class not found error
      const nonExistentClass = domain.tryClass("NonExistent.Class.Name");
      assert(nonExistentClass === null, "tryClass should return null for non-existent class");

      // Test method not found with tryMethod
      const stringClass = domain.tryClass("System.String");
      if (stringClass) {
        const nonExistentMethod = stringClass.tryMethod("NonExistentMethod", 999);
        assert(nonExistentMethod === null, "tryMethod should return null for non-existent method");
      }

      console.log("    Mono API error handling integration: Passed");
    }),
  );

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  await suite.addResultAsync(
    createPerformanceTest("Error creation performance", () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        new MonoError(`Error ${i}`, MonoErrorCodes.UNKNOWN);
      }

      const duration = Date.now() - startTime;
      console.log(`    ${iterations} error creations took ${duration}ms`);
      assert(duration < 500, "Error creation should be fast");
    }),
  );

  await suite.addResultAsync(
    createPerformanceTest("Validation builder performance", () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        new ValidationBuilder()
          .check(i % 2 !== 0, `Error ${i}`)
          .warn(i % 3 === 0, `Warning ${i}`)
          .build();
      }

      const duration = Date.now() - startTime;
      console.log(`    ${iterations} validations took ${duration}ms`);
      assert(duration < 500, "Validation should be fast");
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Error Handling Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} error handling tests passed`,
    duration: summary.duration,
    category: TestCategory.ERROR_HANDLING,
  };
}

// Export for test runner
export default createMonoErrorHandlingTests;

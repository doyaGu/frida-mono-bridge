/**
 * Comprehensive Error Handling and Logging Tests (Phase 4)
 * Tests for error handling mechanisms, logging systems, and exception management
 */

import {
  TestResult,
  TestSuite,
  TestCategory,
  createStandaloneTest,
  createPerformanceTest,
  createErrorHandlingTest,
  createIntegrationTest,
  assert,
  assertNotNull,
  assertThrows,
} from "./test-framework";

// Import all error handling and logging modules
import {
  MonoError,
  MonoValidationError,
  MonoMemoryError,
  MonoInitializationError,
  MonoThreadError,
  MonoMethodError,
  MonoAssemblyError,
  MonoTypeError,
  validationError,
  monoInvariant,
  handleMonoError,
  withErrorHandling,
  withAsyncErrorHandling,
  monoSuccess,
  monoErrorResult,
  asResult,
  ValidationBuilder,
} from "../src/utils/errors";

// Define MonoManagedExceptionError locally since it's not exported
class MonoManagedExceptionError extends MonoError {
  constructor(
    message: string,
    public readonly exception: any,
    public readonly stackTrace?: string[],
  ) {
    super(message, "Managed Exception");
    this.name = "MonoManagedExceptionError";
  }

  getFullDescription(): string {
    let description = super.getFullDescription();
    if (this.stackTrace && this.stackTrace.length > 0) {
      description += "\nStack trace:\n" + this.stackTrace.join("\n");
    }
    return description;
  }
}

import { Logger, LogLevel } from "../src/utils/log";

// Mock classes for testing
class MockMonoObject {
  constructor(public handle: NativePointer) {}
  toPointer() {
    return this.handle;
  }
}

class MockMonoClass {
  constructor(public name: string) {}
  getName() {
    return this.name;
  }
}

class MockMonoMethod {
  constructor(
    public name: string,
    public className?: string,
  ) {}
  getName() {
    return this.name;
  }
  getFullName() {
    return this.className ? `${this.className}.${this.name}` : this.name;
  }
}

export function testMonoErrorHandling(): TestResult {
  console.log("\nComprehensive Error Handling and Logging Tests:");

  const suite = new TestSuite("Mono Error Handling Complete Tests", TestCategory.ERROR_HANDLING);

  // ============================================================================
  // MONO ERROR BASE CLASS TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("MonoError - basic creation and properties", () => {
      // Test basic MonoError creation
      const error = new MonoError("Test error message");

      assert(error instanceof Error, "Should be instance of Error");
      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error.name === "MonoError", "Should have correct name");
      assert(error.message === "Test error message", "Should have correct message");
      assert(error.context === undefined, "Should have undefined context by default");
      assert(error.cause === undefined, "Should have undefined cause by default");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoError - with context and cause", () => {
      // Test MonoError with context and cause
      const cause = new Error("Original error");
      const error = new MonoError("Test error", "TestContext", cause);

      assert(error.message === "Test error", "Should have correct message");
      assert(error.context === "TestContext", "Should have correct context");
      assert(error.cause === cause, "Should have correct cause");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoError - full description", () => {
      // Test full error description
      const cause = new Error("Cause error");
      const error = new MonoError("Test error", "TestContext", cause);

      const description = error.getFullDescription();
      assert(description.includes("Test error"), "Should include message");
      assert(description.includes("TestContext"), "Should include context");
      assert(description.includes("Cause error"), "Should include cause");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoError - JSON serialization", () => {
      // Test JSON serialization
      const cause = new Error("Cause error");
      const error = new MonoError("Test error", "TestContext", cause);

      const json = error.toJSON();
      assert(json.name === "MonoError", "Should include name");
      assert(json.message === "Test error", "Should include message");
      assert(json.context === "TestContext", "Should include context");
      assert(json.cause !== null, "Should include cause");
      assert(json.stack !== undefined, "Should include stack");
    }),
  );

  // ============================================================================
  // MONO VALIDATION ERROR TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("MonoValidationError - basic creation", () => {
      // Test MonoValidationError creation
      const error = new MonoValidationError("Validation failed", "testParam", "invalidValue");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoValidationError, "Should be instance of MonoValidationError");
      assert(error.name === "MonoValidationError", "Should have correct name");
      assert(error.parameter === "testParam", "Should have correct parameter");
      assert(error.value === "invalidValue", "Should have correct value");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoValidationError - JSON serialization", () => {
      // Test JSON serialization with validation-specific fields
      const error = new MonoValidationError("Validation failed", "testParam", "invalidValue");

      const json = error.toJSON();
      assert(json.parameter === "testParam", "Should include parameter");
      assert(json.value === "invalidValue", "Should include value");
    }),
  );

  suite.addResult(
    createStandaloneTest("validationError helper function", () => {
      // Test validationError helper function
      const error = validationError("testParam", "must be positive", -1);

      assert(error instanceof MonoValidationError, "Should create MonoValidationError");
      assert(error.parameter === "testParam", "Should set parameter correctly");
      assert(error.message.includes("must be positive"), "Should include reason in message");
      assert(error.value === -1, "Should include value");
    }),
  );

  // ============================================================================
  // SPECIALIZED MONO ERROR CLASSES TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("MonoMemoryError - creation and properties", () => {
      // Test MonoMemoryError creation
      const cause = new Error("Out of memory");
      const error = new MonoMemoryError("Memory allocation failed", cause);

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoMemoryError, "Should be instance of MonoMemoryError");
      assert(error.name === "MonoMemoryError", "Should have correct name");
      assert(error.context === "Memory Management", "Should have correct context");
      assert(error.cause === cause, "Should have correct cause");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoInitializationError - creation and properties", () => {
      // Test MonoInitializationError creation
      const error = new MonoInitializationError("Failed to initialize Mono runtime");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoInitializationError, "Should be instance of MonoInitializationError");
      assert(error.name === "MonoInitializationError", "Should have correct name");
      assert(error.context === "Initialization", "Should have correct context");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoThreadError - creation and properties", () => {
      // Test MonoThreadError creation
      const error = new MonoThreadError("Failed to attach to thread");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoThreadError, "Should be instance of MonoThreadError");
      assert(error.name === "MonoThreadError", "Should have correct name");
      assert(error.context === "Thread Management", "Should have correct context");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoMethodError - creation and properties", () => {
      // Test MonoMethodError creation
      const error = new MonoMethodError("Method invocation failed", "TestMethod", "TestClass");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoMethodError, "Should be instance of MonoMethodError");
      assert(error.name === "MonoMethodError", "Should have correct name");
      assert(error.methodName === "TestMethod", "Should have correct method name");
      assert(error.className === "TestClass", "Should have correct class name");
      assert(error.context === "Method Invocation: TestClass.TestMethod", "Should have correct context");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoAssemblyError - creation and properties", () => {
      // Test MonoAssemblyError creation
      const error = new MonoAssemblyError("Failed to load assembly", "TestAssembly.dll");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoAssemblyError, "Should be instance of MonoAssemblyError");
      assert(error.name === "MonoAssemblyError", "Should have correct name");
      assert(error.assemblyName === "TestAssembly.dll", "Should have correct assembly name");
      assert(error.context === "Assembly Loading: TestAssembly.dll", "Should have correct context");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoTypeError - creation and properties", () => {
      // Test MonoTypeError creation
      const error = new MonoTypeError("Type conversion failed", "System.String", "System.Int32");

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoTypeError, "Should be instance of MonoTypeError");
      assert(error.name === "MonoTypeError", "Should have correct name");
      assert(error.expectedType === "System.String", "Should have correct expected type");
      assert(error.actualType === "System.Int32", "Should have correct actual type");
      assert(
        error.context !== undefined && error.context.includes("System.String"),
        "Should include expected type in context",
      );
      assert(
        error.context !== undefined && error.context.includes("System.Int32"),
        "Should include actual type in context",
      );
    }),
  );

  // ============================================================================
  // MONO MANAGED EXCEPTION ERROR TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("MonoManagedExceptionError - creation and properties", () => {
      // Test MonoManagedExceptionError creation
      const exception = new MockMonoObject(ptr(0x12345678));
      const error = new MonoManagedExceptionError("Managed exception occurred", exception);

      assert(error instanceof MonoError, "Should be instance of MonoError");
      assert(error instanceof MonoManagedExceptionError, "Should be instance of MonoManagedExceptionError");
      assert(error.name === "MonoManagedExceptionError", "Should have correct name");
      assert(error.exception === exception, "Should have correct exception");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoManagedExceptionError - with stack trace", () => {
      // Test MonoManagedExceptionError with stack trace
      const exception = new MockMonoObject(ptr(0x12345678));
      const stackTrace = ["at TestClass.Method1()", "at TestClass.Method2()"];
      const error = new MonoManagedExceptionError("Managed exception occurred", exception, stackTrace);

      assert(error.stackTrace === stackTrace, "Should have correct stack trace");
      assert(error.getFullDescription().includes("Stack trace"), "Should include stack trace in description");
    }),
  );

  // ============================================================================
  // ERROR HANDLING UTILITIES TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("monoInvariant - assertion helper", () => {
      // Test monoInvariant with true condition
      monoInvariant(true, () => new MonoError("Should not throw"));

      // Test monoInvariant with false condition
      assertThrows(() => {
        monoInvariant(false, () => new MonoError("Should throw"));
      }, "Should throw when condition is false");
    }),
  );

  suite.addResult(
    createStandaloneTest("handleMonoError - error categorization", () => {
      // Test error categorization
      const threadError = new Error("Thread attachment failed");
      const handledThreadError = handleMonoError(threadError);
      assert(handledThreadError instanceof MonoThreadError, "Should categorize thread errors");

      const assemblyError = new Error("Assembly not found");
      const handledAssemblyError = handleMonoError(assemblyError);
      assert(handledAssemblyError instanceof MonoAssemblyError, "Should categorize assembly errors");

      const methodError = new Error("Method invocation failed");
      const handledMethodError = handleMonoError(methodError);
      assert(handledMethodError instanceof MonoMethodError, "Should categorize method errors");

      const typeError = new Error("Type cast failed");
      const handledTypeError = handleMonoError(typeError);
      assert(handledTypeError instanceof MonoTypeError, "Should categorize type errors");

      const memoryError = new Error("Out of memory");
      const handledMemoryError = handleMonoError(memoryError);
      assert(handledMemoryError instanceof MonoMemoryError, "Should categorize memory errors");
    }),
  );

  suite.addResult(
    createStandaloneTest("handleMonoError - existing MonoError", () => {
      // Test handling existing MonoError
      const originalError = new MonoValidationError("Original error");
      const handledError = handleMonoError(originalError);

      assert(handledError === originalError, "Should return original MonoError unchanged");
    }),
  );

  suite.addResult(
    createStandaloneTest("handleMonoError - non-Error objects", () => {
      // Test handling non-Error objects
      const stringError = handleMonoError("String error");
      assert(stringError instanceof MonoError, "Should convert string to MonoError");
      assert(stringError.message === "String error", "Should use string as message");

      const numberError = handleMonoError(42);
      assert(numberError instanceof MonoError, "Should convert number to MonoError");
      assert(numberError.message === "42", "Should use number as message");
    }),
  );

  suite.addResult(
    createStandaloneTest("withErrorHandling - synchronous wrapper", () => {
      // Test synchronous error handling wrapper
      const successfulFn = () => "success";
      const wrappedSuccessful = withErrorHandling(successfulFn, "test context");
      assert(wrappedSuccessful() === "success", "Should return result for successful function");

      const failingFn = () => {
        throw new Error("Test error");
      };
      const wrappedFailing = withErrorHandling(failingFn, "test context");

      assertThrows(() => wrappedFailing(), "Should throw wrapped error for failing function");
    }),
  );

  suite.addResult(
    createStandaloneTest("withAsyncErrorHandling - asynchronous wrapper", async () => {
      // Test asynchronous error handling wrapper
      const successfulAsyncFn = async () => "async success";
      const wrappedSuccessful = withAsyncErrorHandling(successfulAsyncFn, [], "test context");
      const result = await wrappedSuccessful;
      assert(result === "async success", "Should return result for successful async function");

      const failingAsyncFn = async () => {
        throw new Error("Async test error");
      };
      const wrappedFailing = withAsyncErrorHandling(failingAsyncFn, [], "test context");

      try {
        await wrappedFailing;
        assert(false, "Should throw wrapped error for failing async function");
      } catch (error) {
        assert(error instanceof MonoError, "Should throw MonoError");
      }
    }),
  );

  // ============================================================================
  // RESULT TYPE TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("MonoResult - success result", () => {
      // Test successful result creation
      const result = monoSuccess("test data");

      assert(result.success === true, "Should be marked as success");
      assert(result.data === "test data", "Should contain data");
      assert((result as any).error === undefined, "Should not have error");
    }),
  );

  suite.addResult(
    createStandaloneTest("MonoResult - error result", () => {
      // Test error result creation
      const error = new MonoError("Test error");
      const result = monoErrorResult(error);

      assert(result.success === false, "Should be marked as failure");
      assert(result.error === error, "Should contain error");
      assert((result as any).data === undefined, "Should not have data");
    }),
  );

  suite.addResult(
    createStandaloneTest("asResult - function wrapper", () => {
      // Test asResult function wrapper
      const successfulFn = () => "success";
      const wrappedSuccessful = asResult(successfulFn);
      const successResult = wrappedSuccessful();

      assert(successResult.success === true, "Should return success result");
      assert(successResult.data === "success", "Should contain data");

      const failingFn = () => {
        throw new Error("Test error");
      };
      const wrappedFailing = asResult(failingFn);
      const errorResult = wrappedFailing();

      assert(errorResult.success === false, "Should return error result");
      assert(errorResult.error instanceof MonoError, "Should contain MonoError");
    }),
  );

  // ============================================================================
  // VALIDATION BUILDER TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("ValidationBuilder - basic usage", () => {
      // Test ValidationBuilder basic usage
      const builder = new ValidationBuilder();

      const result = builder
        .check(true, "Should not fail")
        .check(false, "Should fail")
        .warn(true, "Should add warning")
        .build();

      assert(result.isValid === false, "Should be invalid due to failed check");
      assert(result.errors.length === 1, "Should have one error");
      assert(result.errors[0] === "Should fail", "Should have correct error message");
      assert(result.warnings.length === 1, "Should have one warning");
      assert(result.warnings[0] === "Should add warning", "Should have correct warning message");
    }),
  );

  suite.addResult(
    createStandaloneTest("ValidationBuilder - execute method", () => {
      // Test ValidationBuilder execute method
      const builder = new ValidationBuilder();

      const result = builder
        .execute(() => {
          throw new Error("Execution error");
        }, "Execution failed")
        .execute(() => {
          // Successful execution
        }, "Should not fail")
        .build();

      assert(result.isValid === false, "Should be invalid due to execution error");
      assert(result.errors.length === 1, "Should have one error");
      assert(result.errors[0].includes("Execution failed"), "Should include error prefix");
      assert(result.errors[0].includes("Execution error"), "Should include actual error");
    }),
  );

  suite.addResult(
    createStandaloneTest("ValidationBuilder - custom errors and warnings", () => {
      // Test adding custom errors and warnings
      const builder = new ValidationBuilder();

      const result = builder.addError("Custom error").addWarning("Custom warning").build();

      assert(result.isValid === false, "Should be invalid due to custom error");
      assert(result.errors.length === 1, "Should have one error");
      assert(result.errors[0] === "Custom error", "Should have custom error");
      assert(result.warnings.length === 1, "Should have one warning");
      assert(result.warnings[0] === "Custom warning", "Should have custom warning");
    }),
  );

  suite.addResult(
    createStandaloneTest("ValidationBuilder - buildOrThrow", () => {
      // Test buildOrThrow method
      const validBuilder = new ValidationBuilder();
      validBuilder.check(true, "Should not fail");

      // Should not throw for valid validation
      validBuilder.buildOrThrow("test context");

      const invalidBuilder = new ValidationBuilder();
      invalidBuilder.check(false, "Should fail");

      // Should throw for invalid validation
      assertThrows(() => {
        invalidBuilder.buildOrThrow("test context");
      }, "Should throw MonoValidationError for invalid validation");
    }),
  );

  // ============================================================================
  // LOGGER TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Logger - level filtering", () => {
      // Test log level filtering
      const debugLogger = new Logger({ level: "debug" });
      const infoLogger = new Logger({ level: "info" });
      const warnLogger = new Logger({ level: "warn" });
      const errorLogger = new Logger({ level: "error" });

      // These should not throw
      debugLogger.debug("Debug message");
      debugLogger.info("Info message");
      debugLogger.warn("Warning message");
      debugLogger.error("Error message");

      infoLogger.info("Info message");
      infoLogger.warn("Warning message");
      infoLogger.error("Error message");

      warnLogger.warn("Warning message");
      warnLogger.error("Error message");

      errorLogger.error("Error message");
    }),
  );

  suite.addResult(
    createStandaloneTest("Logger - tag functionality", () => {
      // Test logger with custom tag
      const taggedLogger = new Logger({ tag: "TestTag" });

      // Should not throw
      taggedLogger.debug("Debug message");
      taggedLogger.info("Info message");
      taggedLogger.warn("Warning message");
      taggedLogger.error("Error message");
    }),
  );

  suite.addResult(
    createStandaloneTest("Logger - static convenience methods", () => {
      // Test static convenience methods
      Logger.debug("Static debug message");
      Logger.info("Static info message");
      Logger.warn("Static warning message");
      Logger.error("Static error message");

      // Test static factory methods
      const taggedLogger = Logger.withTag("StaticTag");
      assertNotNull(taggedLogger, "Should create tagged logger");

      const levelLogger = Logger.withLevel("debug");
      assertNotNull(levelLogger, "Should create logger with level");

      const customLogger = Logger.create({ tag: "Custom", level: "warn" });
      assertNotNull(customLogger, "Should create custom logger");
    }),
  );

  suite.addResult(
    createStandaloneTest("Logger - message formatting", () => {
      // Test message formatting with arguments
      const logger = new Logger({ level: "debug" });

      // Test with various argument types
      logger.debug("Message with string", "arg1");
      logger.info("Message with number", 42);
      logger.warn("Message with object", { key: "value" });
      logger.error("Message with multiple args", "string", 42, { obj: true }, [1, 2, 3]);
    }),
  );

  // ============================================================================
  // ERROR RECOVERY AND FALLBACK TESTS
  // ============================================================================

  suite.addResult(
    createErrorHandlingTest("Error recovery - fallback mechanisms", () => {
      // Test fallback mechanisms for error recovery
      let attemptCount = 0;

      const operationWithFallback = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return "success";
      };

      // Simulate fallback logic
      let result = null;
      for (let i = 0; i < 3; i++) {
        try {
          result = operationWithFallback();
          break;
        } catch (error) {
          if (i === 2) {
            // Last attempt failed, use fallback
            result = "fallback result";
          }
        }
      }

      assert(result === "success", "Should recover from temporary failures");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Error recovery - graceful degradation", () => {
      // Test graceful degradation when operations fail
      const primaryOperation = () => {
        throw new Error("Primary operation failed");
      };
      const fallbackOperation = () => "fallback result";

      let result;
      try {
        result = primaryOperation();
      } catch (error) {
        result = fallbackOperation();
      }

      assert(result === "fallback result", "Should gracefully degrade to fallback");
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Error recovery - partial success handling", () => {
      // Test handling partial success scenarios
      const operations = [
        () => "result1",
        () => {
          throw new Error("Operation 2 failed");
        },
        () => "result3",
        () => "result4",
      ];

      const results: any[] = [];
      const errors: Error[] = [];

      for (const operation of operations) {
        try {
          const result = operation();
          results.push(result);
        } catch (error) {
          errors.push(error as Error);
        }
      }

      assert(results.length === 3, "Should have 3 successful results");
      assert(errors.length === 1, "Should have 1 error");
      assert(results[0] === "result1", "Should preserve successful results");
      assert(results[1] === "result3", "Should preserve successful results");
      assert(results[2] === "result4", "Should preserve successful results");
    }),
  );

  // ============================================================================
  // UNITY-SPECIFIC ERROR HANDLING TESTS
  // ============================================================================

  suite.addResult(
    createErrorHandlingTest("Unity-specific error handling - MonoBehaviour errors", () => {
      // Test Unity-specific MonoBehaviour error scenarios
      const simulateMonoBehaviourError = () => {
        throw new MonoMethodError("MonoBehaviour method failed", "Update", "PlayerController");
      };

      try {
        simulateMonoBehaviourError();
        assert(false, "Should throw MonoBehaviour error");
      } catch (error) {
        assert(error instanceof MonoMethodError, "Should throw MonoMethodError");
        const methodError = error as MonoMethodError;
        assert(methodError.methodName === "Update", "Should have correct method name");
        assert(methodError.className === "PlayerController", "Should have correct class name");
      }
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Unity-specific error handling - Component errors", () => {
      // Test Unity-specific Component error scenarios
      const simulateComponentError = () => {
        throw new MonoValidationError("Component reference is null", "component", null);
      };

      try {
        simulateComponentError();
        assert(false, "Should throw Component error");
      } catch (error) {
        assert(error instanceof MonoValidationError, "Should throw MonoValidationError");
        const validationError = error as MonoValidationError;
        assert(validationError.parameter === "component", "Should have correct parameter name");
        assert(validationError.value === null, "Should have correct null value");
      }
    }),
  );

  suite.addResult(
    createErrorHandlingTest("Unity-specific error handling - Asset loading errors", () => {
      // Test Unity-specific asset loading error scenarios
      const simulateAssetError = () => {
        throw new MonoAssemblyError("Failed to load asset bundle", "resources.assets");
      };

      try {
        simulateAssetError();
        assert(false, "Should throw asset loading error");
      } catch (error) {
        assert(error instanceof MonoAssemblyError, "Should throw MonoAssemblyError");
        const assemblyError = error as MonoAssemblyError;
        assert(assemblyError.assemblyName === "resources.assets", "Should have correct asset name");
      }
    }),
  );

  // ============================================================================
  // PERFORMANCE IMPACT TESTS
  // ============================================================================

  suite.addResult(
    createPerformanceTest("Error handling performance - error creation overhead", () => {
      // Test performance of error creation
      for (let i = 0; i < 10000; i++) {
        const error = new MonoError(`Test error ${i}`, "PerformanceTest");
        error.getFullDescription();
        error.toJSON();
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("Error handling performance - validation builder overhead", () => {
      // Test performance of ValidationBuilder
      for (let i = 0; i < 1000; i++) {
        const builder = new ValidationBuilder();
        builder
          .check(i % 2 === 0, `Check failed for ${i}`)
          .check(i % 3 === 0, `Another check failed for ${i}`)
          .warn(i % 5 === 0, `Warning for ${i}`)
          .build();
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("Error handling performance - logging overhead", () => {
      // Test performance of logging operations
      const logger = new Logger({ level: "debug", tag: "PerformanceTest" });

      for (let i = 0; i < 10000; i++) {
        logger.debug(`Debug message ${i}`, { data: i });
        logger.info(`Info message ${i}`);
        logger.warn(`Warning message ${i}`);
        logger.error(`Error message ${i}`);
      }
    }),
  );

  suite.addResult(
    createPerformanceTest("Error handling performance - error handling wrapper", () => {
      // Test performance of error handling wrappers
      const successfulFn = () => `result ${Math.random()}`;
      const failingFn = () => {
        throw new Error(`Error ${Math.random()}`);
      };

      const wrappedSuccessful = withErrorHandling(successfulFn, "PerformanceTest");
      const wrappedFailing = asResult(failingFn);

      for (let i = 0; i < 5000; i++) {
        wrappedSuccessful();
        wrappedFailing();
      }
    }),
  );

  // ============================================================================
  // ERROR REPORTING AND DIAGNOSTICS TESTS
  // ============================================================================

  suite.addResult(
    createStandaloneTest("Error reporting - comprehensive error information", () => {
      // Test comprehensive error information collection
      const cause = new Error("Root cause");
      const error = new MonoMethodError("Method invocation failed", "TestMethod", "TestClass", cause);

      const errorInfo = {
        name: error.name,
        message: error.message,
        context: error.context,
        fullDescription: error.getFullDescription(),
        json: error.toJSON(),
        stack: error.stack,
        cause: error.cause,
        methodName: error.methodName,
        className: error.className,
      };

      assertNotNull(errorInfo.name, "Should have error name");
      assertNotNull(errorInfo.message, "Should have error message");
      assertNotNull(errorInfo.context, "Should have error context");
      assertNotNull(errorInfo.fullDescription, "Should have full description");
      assertNotNull(errorInfo.json, "Should have JSON representation");
      assertNotNull(errorInfo.stack, "Should have stack trace");
      assertNotNull(errorInfo.cause, "Should have cause");
      assertNotNull(errorInfo.methodName, "Should have method name");
      assertNotNull(errorInfo.className, "Should have class name");
    }),
  );

  suite.addResult(
    createStandaloneTest("Error reporting - validation result diagnostics", () => {
      // Test validation result diagnostics
      const builder = new ValidationBuilder();

      const result = builder
        .check(false, "Validation error 1")
        .check(false, "Validation error 2")
        .warn(true, "Validation warning 1")
        .warn(true, "Validation warning 2")
        .addError("Custom error")
        .addWarning("Custom warning")
        .build();

      const diagnostics = {
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        errors: result.errors,
        warnings: result.warnings,
      };

      assert(diagnostics.isValid === false, "Should be invalid");
      assert(diagnostics.errorCount === 3, "Should have 3 errors");
      assert(diagnostics.warningCount === 3, "Should have 3 warnings");
      assert(diagnostics.errors.includes("Validation error 1"), "Should include all errors");
      assert(diagnostics.warnings.includes("Validation warning 1"), "Should include all warnings");
    }),
  );

  suite.addResult(
    createStandaloneTest("Error reporting - error aggregation", () => {
      // Test error aggregation from multiple sources
      const errors: MonoError[] = [];

      // Collect errors from different sources
      try {
        throw new MonoValidationError("Validation failed", "param1");
      } catch (error) {
        errors.push(error as MonoError);
      }

      try {
        throw new MonoMethodError("Method failed", "TestMethod");
      } catch (error) {
        errors.push(error as MonoError);
      }

      try {
        throw new MonoMemoryError("Memory allocation failed");
      } catch (error) {
        errors.push(error as MonoError);
      }

      const errorSummary = {
        totalErrors: errors.length,
        validationErrors: errors.filter(e => e instanceof MonoValidationError).length,
        methodErrors: errors.filter(e => e instanceof MonoMethodError).length,
        memoryErrors: errors.filter(e => e instanceof MonoMemoryError).length,
        errorTypes: errors.map(e => e.constructor.name),
      };

      assert(errorSummary.totalErrors === 3, "Should have 3 total errors");
      assert(errorSummary.validationErrors === 1, "Should have 1 validation error");
      assert(errorSummary.methodErrors === 1, "Should have 1 method error");
      assert(errorSummary.memoryErrors === 1, "Should have 1 memory error");
      assert(errorSummary.errorTypes.includes("MonoValidationError"), "Should include validation error type");
      assert(errorSummary.errorTypes.includes("MonoMethodError"), "Should include method error type");
      assert(errorSummary.errorTypes.includes("MonoMemoryError"), "Should include memory error type");
    }),
  );

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  suite.addResult(
    createIntegrationTest("Error handling integration - validation with logging", () => {
      // Test integration between validation and logging
      const logger = Logger.withTag("ValidationIntegration");
      const builder = new ValidationBuilder();

      // Perform validation with logging
      const result = builder
        .check(true, "Valid condition")
        .check(false, "Invalid condition")
        .warn(true, "Warning condition")
        .build();

      // Log validation results
      if (!result.isValid) {
        logger.error("Validation failed", { errors: result.errors });
      }

      if (result.warnings.length > 0) {
        logger.warn("Validation warnings", { warnings: result.warnings });
      }

      assert(result.isValid === false, "Should detect validation failure");
      assert(result.errors.length === 1, "Should have one error");
      assert(result.warnings.length === 1, "Should have one warning");
    }),
  );

  suite.addResult(
    createIntegrationTest("Error handling integration - error handling with result types", () => {
      // Test integration between error handling and result types
      const riskyOperation = (shouldFail: boolean) => {
        if (shouldFail) {
          throw new MonoError("Operation failed");
        }
        return "success";
      };

      const wrappedOperation = asResult(riskyOperation);

      // Test successful operation
      const successResult = wrappedOperation(false);
      assert(successResult.success === true, "Should return success result");
      assert(successResult.data === "success", "Should return correct data");

      // Test failed operation
      const failureResult = wrappedOperation(true);
      assert(failureResult.success === false, "Should return failure result");
      assert(failureResult.error instanceof MonoError, "Should return MonoError");
    }),
  );

  suite.addResult(
    createIntegrationTest("Error handling integration - comprehensive error workflow", () => {
      // Test comprehensive error handling workflow
      const logger = Logger.withTag("WorkflowIntegration");
      const builder = new ValidationBuilder();

      // Step 1: Validate inputs (all passing)
      const validationResult = builder
        .check(true, "Input validation passed")
        .check(true, "Second validation passed")
        .build();

      assert(validationResult.isValid, "Validation should pass");

      // Step 2: Test validation failure handling separately
      const failBuilder = new ValidationBuilder();
      const failResult = failBuilder.check(true, "First check passed").check(false, "Second check failed").build();

      assert(!failResult.isValid, "Validation with failure should not be valid");
      assert(failResult.errors.length > 0, "Should have error messages");

      // Step 3: Execute operation with error handling
      const successOperation = () => "operation result";
      const wrappedOperation = withErrorHandling(successOperation, "workflow");

      const result = wrappedOperation();
      assert(result === "operation result", "Should return operation result");

      // Step 4: Test error handling for failing operation
      const failingOperation = () => {
        throw new MonoMethodError("Operation failed", "TestMethod", "TestClass");
      };

      const wrappedFailingOperation = withErrorHandling(failingOperation, "workflow");

      assertThrows(() => wrappedFailingOperation(), "Should throw MonoMethodError");

      logger.info("Comprehensive workflow test completed");
    }),
  );

  suite.addResult(
    createIntegrationTest("Error handling integration - error recovery with logging", () => {
      // Test error recovery with comprehensive logging
      const logger = Logger.withTag("RecoveryIntegration");

      const operationWithRetry = (maxRetries: number) => {
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            attempt++;
            if (attempt < 3) {
              throw new Error(`Attempt ${attempt} failed`);
            }
            return `success on attempt ${attempt}`;
          } catch (error) {
            logger.warn(`Operation attempt ${attempt} failed`, { error: String(error) });

            if (attempt === maxRetries) {
              logger.error("All retry attempts failed", { totalAttempts: maxRetries });
              throw new MonoError("Operation failed after all retries", "RecoveryIntegration");
            }
          }
        }

        throw new MonoError("Unexpected error in retry logic", "RecoveryIntegration");
      };

      const result = operationWithRetry(5);
      assert(result.includes("success"), "Should recover and succeed");
      logger.info("Operation recovered successfully", { result });
    }),
  );

  const summary = suite.getSummary();

  return {
    name: "Mono Error Handling Complete Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} error handling tests passed`,
    duration: summary.duration,
    category: TestCategory.ERROR_HANDLING,
    requiresMono: false,
  };
}

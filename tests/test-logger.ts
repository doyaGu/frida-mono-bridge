/**
 * Logger Tests
 * Tests the logging utility functionality
 */

import Mono from "../src";
import { Logger } from "../src/utils/log";
import { TestResult, TestSuite, createTest, assert, assertPerformWorks } from "./test-framework";

export function testLogger(): TestResult {
  console.log("\nLogger:");

  const suite = new TestSuite("Logger Tests");

  // Test basic Mono.perform functionality first
  suite.addResult(createTest("Mono.perform should work for logger tests", () => {
    assertPerformWorks("Mono.perform() should work for logger tests");
  }));

  // Modern API tests
  suite.addResult(createTest("Logger can be imported and used directly", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "Test" });
      assert(typeof logger.info === 'function', "info method should exist");
      assert(typeof logger.warn === 'function', "warn method should exist");
      assert(typeof logger.debug === 'function', "debug method should exist");
      assert(typeof logger.error === 'function', "error method should exist");
    });
  }));

  suite.addResult(createTest("Logger methods should not throw", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "MethodsTest" });
      // These should not throw
      logger.info("Test info message");
      logger.warn("Test warning message");
      logger.debug("Test debug message");
      logger.error("Test error message");
    });
  }));
  
  suite.addResult(createTest("Logger can be created with custom tag", () => {
    Mono.perform(() => {
      const customLogger = new Logger({ tag: "CustomTag" });
      assert(typeof customLogger.info === 'function', "Custom logger should have info method");
      customLogger.info("Custom tagged message");
    });
  }));

  suite.addResult(createTest("Logger can be created with custom level", () => {
    Mono.perform(() => {
      const debugLogger = new Logger({ level: "debug", tag: "DebugLogger" });
      debugLogger.debug("Debug level message");
      debugLogger.info("Info level message");

      const errorLogger = new Logger({ level: "error", tag: "ErrorLogger" });
      errorLogger.error("Error level message");
    });
  }));

  suite.addResult(createTest("Logger respects log levels", () => {
    Mono.perform(() => {
      // Error level logger should only show error messages
      const errorLogger = new Logger({ level: "error" });
      errorLogger.debug("Should not appear"); // Below threshold
      errorLogger.info("Should not appear");  // Below threshold
      errorLogger.warn("Should not appear");  // Below threshold
      errorLogger.error("Should appear");     // At threshold
    });
  }));

  suite.addResult(createTest("Logger can log multi-line messages", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "MultiLine" });
      logger.info("Line 1\nLine 2\nLine 3");
    });
  }));

  suite.addResult(createTest("Logger can log special characters", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "SpecialChars" });
      logger.info("Special: !@#$%^&*()[]{}");
      logger.info("Unicode: 你好世界");
    });
  }));

  suite.addResult(createTest("Logger can log empty strings", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "Empty" });
      logger.info("");
      logger.debug("");
    });
  }));

  suite.addResult(createTest("Multiple loggers can coexist", () => {
    Mono.perform(() => {
      const logger1 = new Logger({ tag: "Logger1" });
      const logger2 = new Logger({ tag: "Logger2" });
      const logger3 = new Logger({ tag: "Logger3", level: "debug" });

      logger1.info("From logger 1");
      logger2.info("From logger 2");
      logger3.debug("From logger 3");

      // All should work independently
    });
  }));

  suite.addResult(createTest("Logger handles very long messages", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "LongMessage" });
      const longMessage = "A".repeat(1000);
      logger.info(longMessage);
    });
  }));

  // Modern API integration tests
  suite.addResult(createTest("Logger works with Mono domain operations", () => {
    Mono.perform(() => {
      const logger = new Logger({ tag: "DomainTest" });

      const domain = Mono.domain;
      logger.info(`Domain available: ${domain !== null}`);

      const api = Mono.api;
      logger.info(`API available: ${api !== null}`);

      const version = Mono.version;
      logger.info(`Version available: ${version !== null}`);
      if (version) {
        logger.info(`Features: delegateThunk=${version.features.delegateThunk}, metadataTables=${version.features.metadataTables}`);
      }
    });
  }));

  const summary = suite.getSummary();
  
  return {
    name: "Logger Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: false,
    message: `${summary.passed}/${summary.total} logger tests passed`,
  };
}

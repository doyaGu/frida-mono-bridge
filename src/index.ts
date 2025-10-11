/**
 * frida-mono-bridge - Main entry point
 *
 * This module provides the modern fluent API (default export)
 * and direct access to all underlying components.
 */

// Import the main Mono namespace
import { Mono } from "./mono";

// Export fluent API as default
export { Mono };
export default Mono;

// Also set global for convenience
(globalThis as any).Mono = Mono;

// Re-export all modules for direct access
// Runtime exports (API, threading, memory management, etc.)
export * from "./runtime/index";

// Model exports (Mono classes, methods, fields, etc.)
export * from "./model/index";

// Utility exports (helpers, tools, logging, etc.)
export * from "./utils/index";

// Pattern exports (common operations, error handling, etc.)
export * from "./patterns/index";

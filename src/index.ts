/**
 * frida-mono-bridge - Main entry point
 *
 * This module provides both the modern fluent API (default export)
 * and legacy API components for backward compatibility.
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

/**
 * Runtime Module - Core Mono runtime interaction layer.
 *
 * This module provides the foundation for interacting with the Mono runtime:
 * - API bindings for Mono C functions
 * - Thread management and attachment
 * - Module discovery and loading
 * - GC handle management
 * - Internal call registration
 * - Runtime version detection
 *
 * @module runtime
 */

// ===== CORE API =====
// Main interface to Mono C API with caching and thread management
export * from "./api";

// ===== THREAD MANAGEMENT =====
// Thread attachment and execution context management
export * from "./thread";

// ===== MODULE DISCOVERY =====
// Mono module finding and loading
export * from "./module";

// ===== GC HANDLES =====
// Garbage collection handle management
export * from "./gchandle";

// ===== INTERNAL CALLS =====
// Native function registration for managed code
export * from "./icall";

// ===== RUNTIME INFO =====
// Version detection and feature flags
export * from "./version";

// ===== METADATA =====
// Attribute flags and utilities
export * from "./metadata";

// ===== EXPORTS =====
// Mono export mappings and signature lookup
export * from "./exports";

// ===== SIGNATURES =====
// Pure signature data definitions
export * from "./signatures";

// ===== ENUMS =====
// Mono runtime enumeration values
export * from "./enums";

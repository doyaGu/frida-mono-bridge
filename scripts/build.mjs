#!/usr/bin/env node

/**
 * Build script for frida-mono-bridge library
 * Uses esbuild to bundle the library for npm distribution
 */

import * as esbuild from "esbuild";
import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");

// Clean dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

console.log("Building frida-mono-bridge...\n");

// Step 1: Build JavaScript bundle with esbuild
console.log("[1/2] Building JavaScript bundle with esbuild...");
await esbuild.build({
  entryPoints: [resolve(rootDir, "src/index.ts")],
  outfile: resolve(distDir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  sourcemap: true,
  treeShaking: true,
  // Don't minify for better debugging
  minify: false,
  // Banner for the output
  banner: {
    js: "// frida-mono-bridge - TypeScript bridge for Mono runtimes\n// https://github.com/doyaGu/frida-mono-bridge\n",
  },
});
console.log("  ✓ dist/index.js created\n");

// Step 2: Generate TypeScript declarations
console.log("[2/2] Generating TypeScript declarations...");
try {
  execSync("npx tsc -p tsconfig.build.json", {
    cwd: rootDir,
    stdio: "inherit",
  });
  console.log("  ✓ dist/index.d.ts created\n");
} catch (error) {
  console.error("  ✗ Failed to generate declarations");
  process.exit(1);
}

console.log("Build completed successfully!");

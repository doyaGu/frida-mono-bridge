/**
 * Thread Management Example
 * Demonstrates various ways to manage Mono thread attachment
 */

import Mono from "../src";
import { MonoThread } from "../src/model";

console.log("=== Mono Thread Management Examples ===\n");

// Example 1: Simple thread attachment
console.log("Example 1: Simple Thread Attachment");
try {
  const thread = MonoThread.current(Mono.api);
  console.log(`[OK] Current thread attached: ${thread}`);
  console.log(`  Thread ID: ${MonoThread.getId()}`);
} catch (error) {
  console.error("[ERROR] Failed to attach thread:", error);
}

// Example 2: Execute with automatic thread management
console.log("\nExample 2: Automatic Thread Management");
try {
  const domain = MonoThread.withAttached(Mono.api, () => {
    const dom = Mono.api.getRootDomain();
    console.log(`[OK] Root domain retrieved: ${dom}`);
    return dom;
  });
  console.log(`  Domain handle: ${domain}`);
} catch (error) {
  console.error("[ERROR] Failed to execute with attached thread:", error);
}

// Example 3: Manual thread management
console.log("\nExample 3: Manual Thread Management");
try {
  const thread = MonoThread.attach(Mono.api);
  console.log(`[OK] Thread manually attached: ${thread}`);
  
  // Perform operations...
  const domain = Mono.api.getRootDomain();
  console.log(`  Root domain: ${domain}`);
  
  // Clean up (optional - ThreadManager handles this)
  // thread.detach();
  console.log(`  Thread handle is valid: ${MonoThread.isValid(thread.handle)}`);
} catch (error) {
  console.error("[ERROR] Failed manual thread management:", error);
}

// Example 4: Using model.withThread helper
console.log("\nExample 4: Model Helper (Recommended)");
try {
  Mono.model.withThread(() => {
    const domain = Mono.api.getRootDomain();
    console.log(`[OK] Domain accessed via model helper: ${domain}`);
    
    // Load an image and find a class
    try {
      const image = Mono.model.Image.fromAssemblyPath(
        Mono.api,
        "Assembly-CSharp"
      );
      console.log(`  Image loaded: ${image.getName()}`);
      
      // Find a common Unity class
      const klass = image.classFromName("UnityEngine", "GameObject");
      if (klass) {
        console.log(`  Found class: ${klass.getName()}`);
      }
    } catch (err) {
      // Assembly might not exist, that's okay for this example
      console.log("  (Assembly-CSharp not loaded - this is normal)");
    }
  });
} catch (error) {
  console.error("[ERROR] Failed with model helper:", error);
}

// Example 5: Thread utilities
console.log("\nExample 5: Thread Utilities");
try {
  const threadId = MonoThread.getId();
  console.log(`[OK] Current thread ID: ${threadId}`);
  
  const handle = MonoThread.ensureAttached(Mono.api);
  console.log(`  Thread handle: ${handle}`);
  console.log(`  Handle is valid: ${MonoThread.isValid(handle)}`);
} catch (error) {
  console.error("[ERROR] Failed thread utilities:", error);
}

// Example 6: Thread information
console.log("\nExample 6: Thread Information");
try {
  const thread = MonoThread.current(Mono.api);
  console.log(`[OK] Thread info:`);
  console.log(`  toString(): ${thread.toString()}`);
  console.log(`  toPointer(): ${thread.toPointer()}`);
  console.log(`  handle: ${thread.handle}`);
} catch (error) {
  console.error("[ERROR] Failed to get thread info:", error);
}

// Cleanup
console.log("\n=== Cleanup ===");
try {
  // The dispose() method will detach all threads and clean up resources
  Mono.dispose();
  console.log("[OK] Mono bridge disposed successfully");
} catch (error) {
  console.error("[ERROR] Failed to dispose:", error);
}

console.log("\n=== Thread Management Examples Complete ===");

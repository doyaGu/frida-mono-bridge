/**
 * Advanced Thread Management Example
 *
 * This example demonstrates comprehensive thread management patterns for Unity/Mono
 * applications including cross-thread operations, async callback handling, and
 * performance optimization in multi-threaded environments.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Advanced Thread Management Example ===\n");

  // Example 1: Basic thread attachment patterns
  console.log("--- Example 1: Essential Thread Management ---");

  Mono.perform(() => {
    try {
      console.log("[OK] Attached to Mono domain using Mono.perform()");

      // Get current thread information
      const currentThreadId = Process.getCurrentThreadId();
      console.log(`[INFO] Current native thread ID: ${currentThreadId}`);

      // Example 2: Cross-thread operations (common in Unity games)
      console.log("\n--- Example 2: Cross-Thread Operations ---");

      // Simulate accessing Unity from different threads
      console.log("[INFO] Unity threading scenarios:");
      console.log("1. Main Thread: GameObject operations, physics calculations");
      console.log("2. Render Thread: Graphics operations, UI updates");
      console.log("3. Worker Threads: AI calculations, network operations");
      console.log("4. Audio Thread: Sound processing and playback");

      // Demonstrate safe cross-thread patterns
      try {
        const unityAssembly = Mono.domain.assembly("UnityEngine.CoreModule");
        if (unityAssembly) {
          const gameObjectClass = unityAssembly.image.class("UnityEngine.GameObject");
          if (gameObjectClass) {
            console.log("[OK] GameObject class accessible from current thread");

            // Find common GameObject methods
            const findMethod = gameObjectClass.method("Find", 1);
            const instantiateMethod = gameObjectClass.method("Instantiate", 1);

            if (findMethod) {
              console.log("[INFO] GameObject.Find() available for main thread operations");
            }
            if (instantiateMethod) {
              console.log("[INFO] GameObject.Instantiate() available for object creation");
            }
          }
        }
      } catch (error) {
        console.log(`[WARN] Unity operations not available: ${error}`);
      }

      // Example 3: Performance-critical thread operations
      console.log("\n--- Example 3: Performance-Optimized Operations ---");

      // Demonstrate efficient batched operations
      console.log("[INFO] Batch operation patterns:");
      console.log("1. Collect all operations in a list");
      console.log("2. Execute them within a single thread attachment");
      console.log("3. Detach only once after all operations complete");

      // Simulate batched method calls
      const gameAssembly = Mono.domain.assembly("Assembly-CSharp");
      if (gameAssembly) {
        const classes = gameAssembly.image.classes.slice(0, 5); // Limit for demo

        console.log(`[INFO] Processing ${classes.length} classes in batch`);

        // Batch 1: Collect all method lookups
        const methodLookups = [];
        for (const cls of classes) {
          const methods = cls.methods.slice(0, 3); // Limit methods per class
          for (const method of methods) {
            methodLookups.push({
              className: cls.name,
              methodName: method.name,
              paramCount: method.getParameters()?.length || 0
            });
          }
        }

        console.log(`[OK] Collected ${methodLookups.length} method lookups`);

        // Batch 2: Process method information
        const staticMethods = methodLookups.filter(m => m.methodName.startsWith("get_") || m.methodName.startsWith("set_"));
        console.log(`[INFO] Found ${staticMethods.length} potential property accessors`);
      }

      // Example 4: Thread-safe callback patterns
      console.log("\n--- Example 4: Thread-Safe Callback Patterns ---");

      console.log("[INFO] Common callback scenarios in Unity:");
      console.log("1. Event callbacks: OnCollisionEnter, OnTriggerEnter");
      console.log("2. UI callbacks: Button.onClick, Slider.onValueChanged");
      console.log("3. Network callbacks: OnConnectedToServer, OnDisconnected");
      console.log("4. Asset callbacks: OnResourceLoaded, OnSceneLoaded");

      // Demonstrate callback registration pattern
      console.log("[INFO] Thread-safe callback patterns:");
      console.log("1. Always wrap callback execution in Mono.perform()");
      console.log("2. Queue operations for main thread execution");
      console.log("3. Use thread-safe data structures for shared state");
      console.log("4. Implement proper exception handling in callbacks");

      // Example 5: Memory management across threads
      console.log("\n--- Example 5: Cross-Thread Memory Management ---");

      console.log("[INFO] Memory management considerations:");
      console.log("1. MonoObjects are thread-affinitized");
      console.log("2. GC handles must be created on the correct thread");
      console.log("3. Thread-local storage for temporary objects");
      console.log("4. Proper disposal patterns to prevent leaks");

      // Demonstrate safe memory patterns
      try {
        console.log("[INFO] Safe memory usage patterns:");
        console.log("```typescript");
        console.log("Mono.perform(() => {");
        console.log("  // Create temporary objects");
        console.log("  const tempObj = someClass.alloc();");
        console.log("  try {");
        console.log("    // Use the object");
        console.log("    tempObj.method(...);");
        console.log("  } finally {");
        console.log("    // Clean up automatically");
        console.log("    // GC will handle cleanup when thread detaches");
        console.log("  }");
        console.log("});");
        console.log("```");
      } catch (error) {
        console.log(`[WARN] Memory management demo failed: ${error}`);
      }

      // Example 6: Error handling and recovery
      console.log("\n--- Example 6: Error Handling and Recovery ---");

      console.log("[INFO] Common threading errors:");
      console.log("1. ThreadNotAttachedException: Forgetting to attach thread");
      console.log("2. ThreadStateException: Invalid thread state");
      console.log("3. ObjectDisposedException: Using disposed objects");
      console.log("4. NullReferenceException: Missing thread context");

      // Demonstrate error recovery patterns
      console.log("[INFO] Error recovery strategies:");
      console.log("1. Implement retry logic for transient failures");
      console.log("2. Use fallback operations for non-critical features");
      console.log("3. Log detailed error information for debugging");
      console.log("4. Graceful degradation when threads are unavailable");

      // Example 7: Advanced threading patterns
      console.log("\n--- Example 7: Advanced Threading Patterns ---");

      console.log("[INFO] Advanced scenarios:");
      console.log("1. Thread pooling for repeated operations");
      console.log("2. Async/await patterns for long-running operations");
      console.log("3. Producer-consumer patterns for data processing");
      console.log("4. Lock-free operations for performance-critical code");

      // Demonstrate thread pool pattern concept
      console.log("[INFO] Thread pool pattern:");
      console.log("```typescript");
      console.log("// Queue operation for execution on Mono thread");
      console.log("function queueMonoOperation(operation: () => void) {");
      console.log("  // Store operation for later execution");
        console.log("  pendingOperations.push(operation);");
      console.log("}");
      console.log("");
      console.log("// Execute all pending operations");
      console.log("Mono.perform(() => {");
      console.log("  while (pendingOperations.length > 0) {");
      console.log("    const op = pendingOperations.shift();");
      console.log("    if (op) op();");
      console.log("  }");
      console.log("});");
      console.log("```");

      // Example 8: Monitoring and debugging
      console.log("\n--- Example 8: Thread Monitoring and Debugging ---");

      console.log("[INFO] Thread monitoring strategies:");
      console.log("1. Log thread attachment/detachment events");
      console.log("2. Monitor thread pool utilization");
      console.log("3. Track cross-thread operation latency");
      console.log("4. Profile memory usage per thread");

      // Demonstrate monitoring information
      console.log("[INFO] Current thread status:");
      console.log(`  Native thread ID: ${Process.getCurrentThreadId()}`);
      console.log(`  Mono thread attached: ${true}`);
      console.log(`  Domain accessible: ${true}`);

      // Example 9: Unity-specific threading considerations
      console.log("\n--- Example 9: Unity-Specific Threading ---");

      console.log("[INFO] Unity threading rules:");
      console.log("1. Main thread: Required for most Unity API calls");
      console.log("2. GameObject operations: Must be on main thread");
      console.log("3. Transform operations: Thread-safe but limited");
      console.log("4. Physics calculations: Can use worker threads");
      console.log("5. Rendering operations: Dedicated render thread");

      // Demonstrate Unity thread checks
      console.log("[INFO] Unity thread safety patterns:");
      console.log("1. Check UnityMainThreadDispatcher.IsMainThread()");
      console.log("2. Use UnityMainThreadDispatcher for cross-thread calls");
      console.log("3. Queue operations to main thread when needed");
      console.log("4. Use ThreadSafeCommandBuffer for graphics operations");

      // Example 10: Best practices and optimization
      console.log("\n--- Example 10: Best Practices ---");

      console.log("[INFO] Thread management best practices:");
      console.log("1. Use Mono.perform() for automatic thread management");
      console.log("2. Minimize cross-thread operations");
      console.log("3. Batch operations within single thread attachment");
      console.log("4. Implement proper error handling and logging");
      console.log("5. Monitor performance and memory usage");
      console.log("6. Test threading behavior under load");
      console.log("7. Document threading requirements for API users");

      console.log("\n[OK] Advanced thread management examples completed");

    } catch (error) {
      console.error("[ERROR] Thread management example failed:", error);
    }
  });

  console.log("\n=== Thread Management Example Complete ===");
  console.log("[INFO] Key takeaways:");
  console.log("1. Always use Mono.perform() for automatic thread management");
  console.log("2. Be aware of Unity's main thread requirements");
  console.log("3. Implement proper error handling for threading operations");
  console.log("4. Monitor performance and memory usage across threads");
  console.log("5. Use batching to minimize thread attachment overhead");
}

main();

/**
 * Internal Call (ICall) Registration Example
 *
 * This example demonstrates how to register native callbacks that can be called
 * from managed code, enabling bi-directional communication between native
 * Frida scripts and Unity/Mono managed code.
 */

import Mono from "../src";

function main(): void {
  console.log("=== Internal Call (ICall) Registration Example ===\n");

  Mono.perform(() => {
    try {
      const domain = Mono.domain;
      console.log("[OK] Attached to Mono domain");

      // Example 1: Basic logging callback
      console.log("\n--- Example 1: Native Logging Callback ---");

      const logCallback = new NativeCallback((messagePtr: NativePointer) => {
        try {
          const message = messagePtr.isNull() ? "<null>" : Memory.readUtf8String(messagePtr) ?? "<invalid>";
          console.log(`[NATIVE LOG] ${message}`);
        } catch (error) {
          console.error(`[ERROR] Failed to read log message: ${error}`);
        }
      }, "void", ["pointer"]);

      console.log("[OK] Created native logging callback");
      console.log(`[INFO] Callback address: ${logCallback}`);

      // Example 2: Mathematical operations callback
      console.log("\n--- Example 2: Math Operations Callback ---");

      const mathCallback = new NativeCallback((aPtr: NativePointer, bPtr: NativePointer) => {
        try {
          const a = Memory.readFloat(aPtr);
          const b = Memory.readFloat(bPtr);
          const result = Math.sqrt(a * a + b * b); // Pythagorean theorem
          console.log(`[MATH] sqrt(${a}² + ${b}²) = ${result}`);
          return result;
        } catch (error) {
          console.error(`[ERROR] Math operation failed: ${error}`);
          return 0.0;
        }
      }, "float", ["pointer", "pointer"]);

      console.log("[OK] Created math operations callback");

      // Example 3: Game state modification callback
      console.log("\n--- Example 3: Game State Modification Callback ---");

      const gameStateCallback = new NativeCallback((stateNamePtr: NativePointer, valuePtr: NativePointer) => {
        try {
          const stateName = stateNamePtr.isNull() ? "<unknown>" : Memory.readUtf8String(stateNamePtr) ?? "<invalid>";
          const value = Memory.readS32(valuePtr);

          console.log(`[GAME STATE] ${stateName} = ${value}`);

          // Demonstrate different handling based on state name
          switch (stateName.toLowerCase()) {
            case "player_health":
              console.log(`[INFO] Player health modified: ${value}`);
              if (value <= 0) {
                console.log(`[WARNING] Player would be dead!`);
              }
              break;
            case "score":
              console.log(`[INFO] Score updated: ${value}`);
              if (value > 10000) {
                console.log(`[ACHIEVEMENT] High score reached!`);
              }
              break;
            case "level":
              console.log(`[INFO] Level changed: ${value}`);
              break;
            default:
              console.log(`[INFO] Unknown state modified: ${stateName} = ${value}`);
          }

          return 1; // Success
        } catch (error) {
          console.error(`[ERROR] Game state callback failed: ${error}`);
          return 0; // Failure
        }
      }, "int", ["pointer", "pointer"]);

      console.log("[OK] Created game state modification callback");

      // Example 4: Array processing callback
      console.log("\n--- Example 4: Array Processing Callback ---");

      const arrayCallback = new NativeCallback((arrayPtr: NativePointer, lengthPtr: NativePointer) => {
        try {
          const length = Memory.readS32(lengthPtr);
          console.log(`[ARRAY] Processing array with ${length} elements`);

          if (length <= 0 || length > 1000) { // Sanity check
            console.log(`[WARNING] Invalid array length: ${length}`);
            return 0;
          }

          let sum = 0;
          let max = -Infinity;
          let min = Infinity;

          for (let i = 0; i < length; i++) {
            const elementPtr = arrayPtr.add(i * 4); // Assuming 32-bit integers
            const value = Memory.readS32(elementPtr);
            sum += value;
            max = Math.max(max, value);
            min = Math.min(min, value);
          }

          const average = sum / length;
          console.log(`[ARRAY] Sum: ${sum}, Avg: ${average.toFixed(2)}, Min: ${min}, Max: ${max}`);

          return sum; // Return sum as result
        } catch (error) {
          console.error(`[ERROR] Array processing failed: ${error}`);
          return 0;
        }
      }, "int", ["pointer", "pointer"]);

      console.log("[OK] Created array processing callback");

      // Example 5: String manipulation callback
      console.log("\n--- Example 5: String Manipulation Callback ---");

      const stringCallback = new NativeCallback((inputPtr: NativePointer) => {
        try {
          const input = inputPtr.isNull() ? "" : Memory.readUtf8String(inputPtr) ?? "";
          console.log(`[STRING] Processing: "${input}"`);

          // Demonstrate string processing
          const processed = input
            .toUpperCase()
            .replace(/\s+/g, "_")
            .replace(/[^A-Z0-9_]/g, "");

          console.log(`[STRING] Processed: "${processed}"`);

          // For this example, we'll just return the length
          // In a real scenario, you might allocate memory and return a pointer
          return processed.length;
        } catch (error) {
          console.error(`[ERROR] String processing failed: ${error}`);
          return 0;
        }
      }, "int", ["pointer"]);

      console.log("[OK] Created string manipulation callback");

      // Example 6: Time and performance callback
      console.log("\n--- Example 6: Performance Monitoring Callback ---");

      const perfCallback = new NativeCallback((operationPtr: NativePointer) => {
        try {
          const operation = operationPtr.isNull() ? "unknown" : Memory.readUtf8String(operationPtr) ?? "unknown";
          const startTime = Date.now();
          console.log(`[PERF] Starting operation: ${operation}`);

          // Simulate some work
          const iterations = 1000000;
          let sum = 0;
          for (let i = 0; i < iterations; i++) {
            sum += Math.random();
          }

          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`[PERF] Completed ${operation} in ${duration}ms (${iterations} iterations)`);
          console.log(`[PERF] Random sum check: ${sum.toFixed(2)}`);

          return duration; // Return duration in milliseconds
        } catch (error) {
          console.error(`[ERROR] Performance monitoring failed: ${error}`);
          return -1;
        }
      }, "int", ["pointer"]);

      console.log("[OK] Created performance monitoring callback");

      // Example 7: Registration patterns and best practices
      console.log("\n--- Example 7: ICall Registration Patterns ---");

      console.log("[INFO] Common ICall registration patterns:");
      console.log("1. Logging: NativeLog(string message)");
      console.log("2. Math: CalculateDistance(float x1, float y1, float x2, float y2)");
      console.log("3. State: SetGameState(string key, int value)");
      console.log("4. Arrays: ProcessIntArray(int[] array, int length)");
      console.log("5. Strings: ProcessString(string input)");
      console.log("6. Performance: MeasureTime(string operation)");

      console.log("\n[INFO] ICall usage guidelines:");
      console.log("- Always validate input parameters");
      console.log("- Handle null pointers gracefully");
      console.log("- Use appropriate data types for parameters");
      console.log("- Implement proper error handling");
      console.log("- Consider thread safety for concurrent calls");
      console.log("- Document callback signatures clearly");

      // Example 8: Error handling and safety
      console.log("\n--- Example 8: Error Handling and Safety ---");

      const safeCallback = new NativeCallback((dataPtr: NativePointer, size: NativePointer) => {
        try {
          const dataSize = Memory.readS32(size);

          // Safety checks
          if (dataPtr.isNull()) {
            console.log("[ERROR] Null data pointer received");
            return -1;
          }

          if (dataSize <= 0 || dataSize > 1024 * 1024) { // 1MB limit
            console.log(`[ERROR] Invalid data size: ${dataSize}`);
            return -2;
          }

          // Process data safely
          console.log(`[SAFE] Processing ${dataSize} bytes safely`);

          // Simulate processing
          let checksum = 0;
          for (let i = 0; i < Math.min(dataSize, 100); i++) { // Limit for demo
            checksum += Memory.readU8(dataPtr.add(i));
          }

          console.log(`[SAFE] Data checksum (first 100 bytes): ${checksum}`);
          return checksum;
        } catch (error) {
          console.error(`[ERROR] Safe callback failed: ${error}`);
          return -3;
        }
      }, "int", ["pointer", "pointer"]);

      console.log("[OK] Created safe callback with error handling");

      console.log("\n[OK] All ICall examples prepared successfully");
      console.log("[INFO] In a real scenario, you would register these with:");
      console.log("  Mono.addInternalCall('Namespace.Class::MethodName', callback);");

    } catch (error) {
      console.error("[ERROR] ICall example failed:", error);
    }
  });

  console.log("\n=== Internal Call (ICall) Registration Example Complete ===");
}

main();

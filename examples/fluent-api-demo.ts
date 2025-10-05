/**
 * Fluent API Demo
 *
 * Demonstrates the frida-il2cpp-bridge inspired fluent API
 */

import Mono from "../src";

function main(): void {
  // Attach to current thread
  Mono.perform(() => {
    // Access domain with property syntax
    const domain = Mono.domain;
    console.log("Current domain loaded");

    // Enumerate assemblies with property getter
    console.log("\nLoaded assemblies:");
    for (const assembly of domain.assemblies) {
      console.log(`  - ${assembly.name}`);
    }

    // Find assembly using fluent method
    const gameAssembly = domain.assembly("Assembly-CSharp");
    if (!gameAssembly) {
      console.log("\nAssembly-CSharp not found");
      return;
    }

    // Chain through assembly -> image -> class
    const PlayerClass = gameAssembly.image.class("Game.Player");
    if (!PlayerClass) {
      console.log("\nGame.Player class not found");
      return;
    }

    console.log(`\nFound class: ${PlayerClass.fullName}`);

    // Use property getters
    console.log(`  Methods: ${PlayerClass.methods.length}`);
    console.log(`  Fields: ${PlayerClass.fields.length}`);
    console.log(`  Properties: ${PlayerClass.properties.length}`);

    // Find method using fluent syntax
    const sayMethod = PlayerClass.method("Say", 1);
    if (sayMethod) {
      console.log(`\nFound method: ${sayMethod.getFullName()}`);
    }

    // Find field using fluent syntax
    const nameField = PlayerClass.field("name");
    if (nameField) {
      console.log(`Found field: ${nameField.getName()}`);
    }

    // Allocate new instance using fluent method
    const player = PlayerClass.alloc();
    console.log(`\nAllocated new player instance: ${player.pointer}`);

    // Alternative: Direct class lookup across all assemblies
    const Player2 = domain.class("Game.Player");
    if (Player2) {
      console.log(`\nDirect lookup successful: ${Player2.fullName}`);
    }

    // Use trace utilities
    console.log("\n--- Tracing Demo ---");
    Mono.trace.method(sayMethod!, {
      onEnter(args: any) {
        console.log("→ Player.Say called");
      },
      onLeave(retval: any) {
        console.log("← Player.Say returned");
      },
    });

    // Use find utilities with wildcards
    console.log("\n--- Find Utilities Demo ---");
    const attackMethods = Mono.find.methods("*Attack*");
    console.log(`Found ${attackMethods.length} methods matching *Attack*`);

    const gameclasses = Mono.find.classes("Game.*");
    console.log(`Found ${gameclasses.length} classes in Game namespace`);

    // Use type helpers
    console.log("\n--- Type Utilities Demo ---");
    const gc = Mono.gc;
    console.log(`Max GC generation: ${gc.maxGeneration}`);
    gc.collect(0); // Collect generation 0
  });
}

main();

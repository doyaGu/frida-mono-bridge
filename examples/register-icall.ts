import Mono from "../src";

function main(): void {
  Mono.attachThread();

  const callback = new NativeCallback((messagePtr: NativePointer) => {
    const message = Memory.readUtf8String(messagePtr) ?? "";
    Mono.utils.logger.info(`ICall invoked with message: ${message}`);
  }, "void", ["pointer"]);

  Mono.model.withThread(() => {
    Mono.model.registerInternalCall(Mono.api, "Game.NativeHooks::OnMessage", callback);
  });
}

main();

import Mono from "../src";

function main(): void {
  Mono.attachThread();

  const invokePtr = Module.findExportByName(Mono.module.name, "mono_runtime_invoke");
  if (!invokePtr) {
    Mono.utils.logger.error("mono_runtime_invoke export not found");
    return;
  }

  Interceptor.attach(invokePtr, {
    onEnter(args) {
      const methodPtr = args[0];
      Mono.utils.logger.debug(`mono_runtime_invoke(method=${methodPtr})`);
    },
    onLeave(retval) {
      Mono.utils.logger.debug(`mono_runtime_invoke returned ${retval}`);
    },
  });
}

main();

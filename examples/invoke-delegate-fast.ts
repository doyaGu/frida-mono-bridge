import Mono from "../src";

function main(): void {
  Mono.attachThread();

  const image = Mono.model.Image.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
  const klass = image.classFromName("Game", "TickSource");
  const method = klass.getMethod("GetDelegate", 0);

  Mono.utils.logger.info("Creating delegate via managed invocation");
  const delegatePtr = method.invoke(null, []);
  const delegateInstance = new Mono.model.Delegate(Mono.api, delegatePtr);

  const thunk = delegateInstance.compileNative<NativeFunction<void, [NativePointer]>>("void", ["pointer"]);

  Mono.utils.logger.info("Calling unmanaged delegate thunk");
  const exceptionSlot = Memory.alloc(Process.pointerSize);
  Memory.writePointer(exceptionSlot, NULL);
  thunk(delegateInstance.pointer);
}

main();

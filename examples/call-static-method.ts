import Mono from "../src";

function main(): void {
  Mono.attachThread();

  const image = Mono.model.Image.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
  const method = Mono.model.Method.find(Mono.api, image, "Game.Player:Say(string)");

  Mono.utils.logger.info("Invoking Game.Player.Say(string)");
  method.invoke(null, ["Hello from frida-mono-bridge"]);
}

main();

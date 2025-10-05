import Mono from "../src";
import { MonoImage, MonoMethod } from "../src/model";

function main(): void {
  Mono.attachThread();

  const image = MonoImage.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
  const method = MonoMethod.find(Mono.api, image, "Game.Player:Say(string)");

  Mono.utils.logger.info("Invoking Game.Player.Say(string)");
  method.invoke(null, ["Hello from frida-mono-bridge"]);
}

main();

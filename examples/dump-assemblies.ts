import Mono from "../src";

function main(): void {
  Mono.attachThread();

  const image = Mono.model.Image.fromAssemblyPath(Mono.api, "/data/app/Assembly-CSharp.dll");
  Mono.utils.logger.info(`Image loaded at ${image.pointer}`);

  try {
    const table = Mono.tools.getMetadataTable(Mono.api, image, 0x02 /* MONO_TABLE_TYPEDEF */);
    Mono.utils.logger.info(`TypeDef rows: ${table.rows}`);
  } catch (error) {
    Mono.utils.logger.warn(`Metadata tables unavailable: ${(error as Error).message}`);
  }
}

main();

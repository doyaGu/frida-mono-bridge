import Mono from "../src";
import { collectAssemblies, groupClassesByNamespace, indexMethodsByName } from "../src/model";

Mono.model.withThread(() => {
  const assemblies = collectAssemblies(Mono.api, {
    includeClasses: true,
  });

  for (const summary of assemblies) {
    const name = summary.assembly.getName();
    const version = summary.assembly.getVersion();
    const classes = summary.classes ?? [];

    console.log(`Assembly: ${name} (${version.major}.${version.minor}.${version.build}.${version.revision})`);
    console.log(`  Image: ${summary.image.getName()} - ${classes.length} classes`);

    const namespaced = groupClassesByNamespace(classes);
    for (const [namespace, klasses] of namespaced) {
      const displayNamespace = namespace || "<global>";
      console.log(`    Namespace: ${displayNamespace} (${klasses.length})`);
      for (const klass of klasses.slice(0, 3)) {
        const methods = indexMethodsByName(klass.getMethods());
        console.log(`      Class: ${klass.getFullName()} (${methods.size} method groups)`);
      }
      if (klasses.length > 3) {
        console.log("      …");
      }
    }
  }
});

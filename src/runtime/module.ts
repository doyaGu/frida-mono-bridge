import { MONO_EXPORTS, MonoApiName, MonoExportSignature } from "./signatures";

export interface MonoModuleInfo {
  name: string;
  base: NativePointer;
  size: number;
  path: string;
}

const COMMON_MODULE_NAMES = [
  "libmonosgen-2.0.so",
  "libmonosgen-2.0.dylib",
  "libmono-2.0.so",
  "libmono.so",
  "mono.dll",
  "mono-2.0-bdwgc.dll",
  "mono-2.0-sgen.dll",
  "mono-2.0.dll",
  "libmono-2.0.dylib",
  "monosgen-2.0.dll",
];

const PROBE_EXPORT_NAMES = [
  "mono_runtime_invoke",
  "mono_thread_attach",
  "mono_get_root_domain",
];

export class MonoModuleDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonoModuleDiscoveryError";
  }
}

export function findMonoModule(): MonoModuleInfo {
  // Use Process.enumerateModules() instead of Module.enumerateModulesSync()
  const modules = Process.enumerateModules();

  for (const candidate of COMMON_MODULE_NAMES) {
    const moduleInfo = modules.find((m) => m.name === candidate || m.path.endsWith(`/${candidate}`) || m.path.endsWith(`\\${candidate}`));
    if (moduleInfo) {
      return normalizeModuleInfo(moduleInfo);
    }
  }

  const exportNames = new Set(PROBE_EXPORT_NAMES);
  for (const name of Object.keys(MONO_EXPORTS) as MonoApiName[]) {
    exportNames.add(name);
    const signature = MONO_EXPORTS[name] as MonoExportSignature;
    if (signature.aliases) {
      for (const alias of signature.aliases) {
        exportNames.add(alias);
      }
    }
  }

  let bestMatch: MonoModuleInfo | null = null;
  let bestHits = 0;

  for (const mod of modules) {
    try {
      const exports = mod.enumerateExports();
      const hits = exports.reduce((count, item) => count + (exportNames.has(item.name) ? 1 : 0), 0);
      if (hits > bestHits) {
        bestHits = hits;
        bestMatch = normalizeModuleInfo(mod);
      }
    } catch (_error) {
      // Some system modules cannot be enumerated; ignore and continue scanning others.
    }
  }

  if (bestMatch && bestHits > 0) {
    return bestMatch;
  }

  throw new MonoModuleDiscoveryError(
    "Failed to discover Mono runtime module. Specify the module name manually or ensure Mono is loaded before the bridge attaches.",
  );
}

function normalizeModuleInfo(moduleDetails: {
  name: string;
  base: NativePointer;
  size: number;
  path: string;
}): MonoModuleInfo {
  return {
    name: moduleDetails.name,
    base: moduleDetails.base,
    size: moduleDetails.size,
    path: moduleDetails.path,
  };
}

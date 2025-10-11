export interface ExportProbeMatch {
  name: string;
  address: NativePointer;
}

export function findExportsLike(moduleName: string, pattern: string): ExportProbeMatch[] {
  try {
    const moduleHandle = Process.findModuleByName(moduleName);
    if (moduleHandle === null) {
      return [];
    }
    const exports = moduleHandle.enumerateExports();
    const normalized = pattern.toLowerCase();
    return exports
      .filter((item) => item.name.toLowerCase().includes(normalized))
      .map((item) => ({ name: item.name, address: item.address }));
  } catch (_error) {
    return [];
  }
}

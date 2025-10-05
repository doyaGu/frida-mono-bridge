import { MonoApi } from "../runtime/api";
import { MonoDomain } from "./domain";
import { MonoAssembly } from "./assembly";
import { MonoImage } from "./image";
import { MonoClass } from "./class";
import { MonoMethod } from "./method";

export interface AssemblySummary {
  assembly: MonoAssembly;
  image: MonoImage;
  classes?: MonoClass[];
}

export interface AssemblyCollectionOptions {
  domain?: MonoDomain;
  includeClasses?: boolean;
  filter?: (assembly: MonoAssembly) => boolean;
  classFilter?: (klass: MonoClass) => boolean;
}

export interface ClassSummary {
  assembly: MonoAssembly;
  image: MonoImage;
  klass: MonoClass;
  methods?: MonoMethod[];
}

export interface ClassCollectionOptions extends AssemblyCollectionOptions {
  includeMethods?: boolean;
  methodFilter?: (method: MonoMethod) => boolean;
}

export function collectAssemblies(api: MonoApi, options: AssemblyCollectionOptions = {}): AssemblySummary[] {
  const domain = options.domain ?? MonoDomain.getRoot(api);
  const assemblies = domain.getAssemblies();
  const summaries: AssemblySummary[] = [];

  for (const assembly of assemblies) {
    if (options.filter && !options.filter(assembly)) {
      continue;
    }

    const image = assembly.getImage();
    let classes: MonoClass[] | undefined;

    if (options.includeClasses) {
      const collected = image.getClasses();
      classes = options.classFilter ? collected.filter(options.classFilter) : collected;
    }

    summaries.push({ assembly, image, classes });
  }

  return summaries;
}

export function collectClasses(api: MonoApi, options: ClassCollectionOptions = {}): ClassSummary[] {
  const assemblySummaries = collectAssemblies(api, { ...options, includeClasses: true });
  const summaries: ClassSummary[] = [];

  for (const entry of assemblySummaries) {
    if (!entry.classes) {
      continue;
    }

    for (const klass of entry.classes) {
      if (options.classFilter && !options.classFilter(klass)) {
        continue;
      }

      let methods: MonoMethod[] | undefined;
      if (options.includeMethods) {
        const collected = klass.getMethods();
        methods = options.methodFilter ? collected.filter(options.methodFilter) : collected;
      }

      summaries.push({ assembly: entry.assembly, image: entry.image, klass, methods });
    }
  }

  return summaries;
}

export function groupClassesByNamespace(classes: Iterable<MonoClass>): Map<string, MonoClass[]> {
  const index = new Map<string, MonoClass[]>();
  for (const klass of classes) {
    const key = klass.getNamespace() || "";
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(klass);
  }
  return index;
}

export function indexMethodsByName(methods: Iterable<MonoMethod>): Map<string, MonoMethod[]> {
  const index = new Map<string, MonoMethod[]>();
  for (const method of methods) {
    const key = method.getName();
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(method);
  }
  return index;
}

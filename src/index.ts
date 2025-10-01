import { createMonoApi, MonoApi } from "./runtime/api";
import { findMonoModule, MonoModuleInfo } from "./runtime/module";
import { MonoRuntimeVersion } from "./runtime/version";
import { withAttachedThread, detachAll, ensureAttached } from "./runtime/guard";
import { GCHandlePool } from "./runtime/gchandle";
import * as Model from "./model";
import * as Tools from "./tools";
import * as Runtime from "./runtime";
import * as Utils from "./utils";
import { Logger } from "./utils/log";

const logger = new Logger({ tag: "Mono" });

const monoModule: MonoModuleInfo = findMonoModule();
const api: MonoApi = createMonoApi(monoModule);
const version = MonoRuntimeVersion.fromApi(api);
const gchandles = new GCHandlePool(api);

export interface MonoBridge {
  api: MonoApi;
  module: MonoModuleInfo;
  version: MonoRuntimeVersion;
  gchandles: GCHandlePool;
  model: typeof Model & {
    withThread<T>(fn: () => T): T;
  };
  tools: typeof Tools;
  runtime: typeof Runtime;
  utils: typeof Utils & {
    logger: Logger;
  };
  attachThread(): NativePointer;
  detachAllThreads(): void;
  dispose(): void;
}

const Mono: MonoBridge = {
  api,
  module: monoModule,
  version,
  gchandles,
  model: {
    ...Model,
    withThread<T>(fn: () => T): T {
      return withAttachedThread(api, fn);
    },
  },
  tools: Tools,
  runtime: Runtime,
  utils: {
    ...Utils,
    logger,
  },
  attachThread(): NativePointer {
    return ensureAttached(api);
  },
  detachAllThreads(): void {
    detachAll(api);
  },
  dispose(): void {
    detachAll(api);
    gchandles.releaseAll();
  },
};

(globalThis as any).Mono = Mono;

export default Mono;
export * from "./runtime";
export * from "./model";
export * from "./tools";
export * from "./utils";

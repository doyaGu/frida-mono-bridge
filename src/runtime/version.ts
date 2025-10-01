import { MonoApi } from "./api";
import { MonoApiName } from "./signatures";

export interface MonoFeatureFlags {
  delegateThunk: boolean;
  metadataTables: boolean;
  gcHandles: boolean;
  internalCalls: boolean;
}

const REQUIRED_FOR_METADATA: MonoApiName[] = ["mono_method_signature", "mono_signature_get_param_count"];

export class MonoRuntimeVersion {
  readonly features: MonoFeatureFlags;

  private constructor(features: MonoFeatureFlags) {
    this.features = features;
  }

  static fromApi(api: MonoApi): MonoRuntimeVersion {
    const hasDelegateThunk = api.hasExport("mono_get_delegate_invoke") && api.hasExport("mono_method_get_unmanaged_thunk");
    const metadataTables = REQUIRED_FOR_METADATA.every((name) => api.hasExport(name));
    const gcHandles = api.hasExport("mono_gchandle_new") && api.hasExport("mono_gchandle_free");
    const internalCalls = api.hasExport("mono_add_internal_call");
    return new MonoRuntimeVersion({
      delegateThunk: hasDelegateThunk,
      metadataTables,
      gcHandles,
      internalCalls,
    });
  }
}

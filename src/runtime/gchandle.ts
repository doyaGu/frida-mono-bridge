import { MonoApi } from "./api";

export class GCHandle {
  #handle: number;
  constructor(private readonly api: MonoApi, handle: number, private readonly weak: boolean) {
    this.#handle = handle;
  }

  get handle(): number {
    return this.#handle;
  }

  get isWeak(): boolean {
    return this.weak;
  }

  getTarget(): NativePointer {
    if (this.#handle === 0) {
      return NULL;
    }
    return this.api.native.mono_gchandle_get_target(this.#handle);
  }

  free(): void {
    if (this.#handle === 0) {
      return;
    }
    this.api.native.mono_gchandle_free(this.#handle);
    this.#handle = 0;
  }
}

export class GCHandlePool {
  private readonly handles = new Set<GCHandle>();

  constructor(private readonly api: MonoApi) {}

  /**
   * Get the number of active handles in this pool
   */
  get size(): number {
    return this.handles.size;
  }

  create(object: NativePointer, pinned = false): GCHandle {
    const handleId = this.api.native.mono_gchandle_new(object, pinned) as number;
    const handle = new GCHandle(this.api, handleId, false);
    this.handles.add(handle);
    return handle;
  }

  createWeak(object: NativePointer, trackResurrection = false): GCHandle {
    if (!this.api.hasExport("mono_gchandle_new_weakref")) {
      console.warn("[Mono] Weak GCHandles are not supported on this runtime; using a strong handle instead.");
      return this.create(object, false);
    }
    const handleId = this.api.native.mono_gchandle_new_weakref(object, trackResurrection) as number;
    const handle = new GCHandle(this.api, handleId, true);
    this.handles.add(handle);
    return handle;
  }

  release(handle: GCHandle): void {
    if (!this.handles.has(handle)) {
      return;
    }
    handle.free();
    this.handles.delete(handle);
  }

  releaseAll(): void {
    for (const handle of this.handles) {
      handle.free();
    }
    this.handles.clear();
  }
}

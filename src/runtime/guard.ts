import { MonoApi } from "./api";

const attachedThreads = new Map<number, NativePointer>();

export function withAttachedThread<T>(api: MonoApi, fn: () => T): T {
  const threadId = getCurrentThreadId();
  ensureAttached(api, threadId);
  return fn();
}

export function detachAll(api: MonoApi): void {
  for (const [threadId, threadHandle] of attachedThreads.entries()) {
    try {
      api.detachThread(threadHandle);
    } catch (_error) {
      // Best-effort detach; loggers can hook here once logging infrastructure exists.
    }
    attachedThreads.delete(threadId);
  }
}

export function ensureAttached(api: MonoApi, threadId = getCurrentThreadId()): NativePointer {
  const handle = attachedThreads.get(threadId);
  if (handle && !isNull(handle)) {
    return handle;
  }
  const attached = api.attachThread();
  attachedThreads.set(threadId, attached);
  return attached;
}

function getCurrentThreadId(): number {
  if (typeof Process.getCurrentThreadId === "function") {
    return Process.getCurrentThreadId();
  }
  // As a fallback, use the JavaScript thread id (Frida currently runs agents on a single thread).
  return 0;
}

function isNull(pointer: NativePointer | null): boolean {
  if (pointer === null || pointer === undefined) {
    return true;
  }
  if (typeof pointer === "object" && typeof (pointer as any).isNull === "function") {
    return (pointer as any).isNull();
  }
  if (typeof pointer === "number") {
    return pointer === 0;
  }
  return false;
}

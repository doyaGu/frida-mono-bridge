frida-mono-bridge — Implementation Document

This document specifies how to implement frida-mono-bridge, a TypeScript bridge exposing the Mono runtime to Frida scripts with an ergonomic, high-level API (in the spirit of frida-il2cpp-bridge). It covers modules, public APIs, control/data flows, threading/GC, delegate thunks, performance, testing, and build/release.

⸻

1) Scope & Non-Goals

Scope
	•	Discover a loaded Mono runtime inside a target process and resolve the C embedding API.
	•	Provide a TypeScript API with a model layer (Domain, Image, Klass, Method, Object, String, Array, Field, Property, Delegate).
	•	Support managed invocation, internal calls (ICall), GCHandle management, basic metadata queries, and delegate fast-path using unmanaged thunks.
	•	Build to a single agent (dist/agent.js) using frida-compile; run on Android, Windows, macOS, Linux.  ￼

Non-Goals
	•	IL2CPP support (out of scope; see frida-il2cpp-bridge as inspiration only).  ￼
	•	Full Mono metadata decoding (only light table access when exports exist).

⸻

2) Architecture

src/
  index.ts                 -> Global entry point: exposes Mono.{api, model, helpers}
  runtime/
    module.ts              -> Locate Mono module (name candidates + export heuristics)
    signatures.ts          -> Canonical Mono C API signatures + aliases
    api.ts                 -> Export resolution → NativeFunction wrapping + helpers
    guard.ts               -> Thread attach; withAttachedThread; exception slot helpers
    mem.ts                 -> argv buffer, UTF-8 helpers
    version.ts             -> Feature flags based on export presence
    gchandle.ts            -> GCHandlePool for strong/weak handles
  model/
    domain.ts, assembly.ts, image.ts
    klass.ts, method.ts, object.ts, string.ts, array.ts
    field.ts, property.ts
    delegate.ts            -> Delegate Invoke discovery, unmanaged thunk, ctor
  tools/
    metadata.ts            -> Lightweight table reads if available
    signature-infer.ts     -> Parameter counting/validation helpers
    cache.ts               -> Simple LRU (optional)
    probe.ts               -> AOB/near-name export probing fallback
  utils/
    log.ts, types.ts
examples/
  dump-assemblies.ts, call-static-method.ts, register-icall.ts
  invoke-delegate-fast.ts, hook-runtime-invoke.ts

Key External References
	•	Mono Embedding API: invocation, thread attach, descriptors, GC handles.  ￼
	•	Frida JavaScript & Functions API: NativeFunction, Interceptor, agent patterns.  ￼
	•	TypeScript agent workflow using frida-compile.  ￼
	•	Delegate unmanaged thunk path.  ￼
	•	frida-il2cpp-bridge style & ergonomics.  ￼

⸻

3) Module Design & Responsibilities

3.1 runtime/module.ts — Runtime Discovery
	•	Try known module names: libmonosgen-2.0.so, libmono-2.0.so, libmono.so, mono-2.0-bdwgc.dll, mono.dll.
	•	If none found, heuristically scan all modules for exports like mono_runtime_invoke / mono_thread_attach. This mirrors real-world Mono distributions where names vary. (Enumerating exports is supported by Frida.)  ￼

3.2 runtime/signatures.ts — API Signatures
	•	Provide canonical signatures for commonly exported Mono APIs (return/arg types).
	•	Include aliases for version/build differences (e.g., mono_thread_attach_internal).
	•	Coverage:
	•	Domain/Thread: mono_get_root_domain, mono_thread_attach, mono_thread_detach.
	•	Assembly/Image: mono_assembly_open, mono_domain_assembly_open, mono_assembly_get_image.
	•	Lookup/Call: mono_method_desc_new, mono_method_desc_search_in_image, mono_class_from_name, mono_class_get_method_from_name, mono_runtime_invoke.  ￼
	•	Objects/Strings/Arrays/Boxing: mono_object_new, mono_string_new, mono_array_new, mono_value_box, mono_object_unbox.  ￼
	•	Field/Property ops: mono_field_get_value, mono_field_set_value.  ￼
	•	Signatures: mono_method_signature, mono_signature_get_param_count, mono_method_get_name.  ￼
	•	ICall/GC: mono_add_internal_call, mono_gc_collect, mono_gc_get_heap_size, mono_gc_get_used_size.  ￼
	•	Delegate: mono_object_get_class, mono_get_delegate_invoke, mono_method_get_unmanaged_thunk, mono_delegate_ctor.  ￼

3.3 runtime/api.ts — Export Resolution & Helpers
	•	Resolution strategy:
	1.	Module.findExportByName(primary);
	2.	try aliases[];
	3.	near-name match from Module.enumerateExportsSync;
	4.	(optional) AOB in tools/probe.ts.
	•	Wrap to NativeFunction and cache. Provide helpers:
	•	attachThread(): mono_thread_attach(mono_get_root_domain()). Required before other APIs.  ￼
	•	stringNew(text): domain-aware mono_string_new.
	•	runtimeInvoke(method, obj, args): alloc argv, pass MonoObject** exception slot, throw JS error if non-null. (Pattern taken from embedding docs.)  ￼
	•	getDelegateInvokeThunk(delegateClass): returns { invoke: MonoMethod*, thunk: void* } via mono_get_delegate_invoke + mono_method_get_unmanaged_thunk.  ￼

3.4 runtime/guard.ts — Thread & Exception Guards
	•	withAttachedThread(api, fn) ensures the current thread is attached before fn() runs. Mono requires attach before mono_runtime_invoke on foreign threads.  ￼

3.5 runtime/gchandle.ts — GCHandle Pool
	•	Strong/weak handle creation with mono_gchandle_new and release with mono_gchandle_free. Long-lived managed objects (delegates, pinned objects) are held here to prevent premature collection. (Standard embedding practice.)  ￼

3.6 model/* — High-Level Object Model
	•	Image: fromAssemblyPath(api, path) → MonoImage* via mono_assembly_open & mono_assembly_get_image.
	•	Klass: fromName(api, image, ns, name) → MonoClass*.
	•	Method:
	•	find(api, image, "Namespace.Type:Method(sig)") via method descriptors.  ￼
	•	getParamCount() using mono_method_signature + mono_signature_get_param_count.
	•	invoke(obj, args) → api.runtimeInvoke.
	•	Object/String/Array: constructors & boxing/unboxing via Mono API.  ￼
	•	Field/Property: value get/set.
	•	Delegate (first-class):
	•	Managed path: invokeManaged(argv) → mono_runtime_invoke(Invoke, this, argv, &exc).
	•	Fast path: compileNative(ret, argTypes) builds a NativeFunction from unmanaged thunk (void*) of Invoke. This is the recommended high-frequency path (e.g., per-frame callbacks).  ￼
	•	Construction: MonoDelegate.create(api, delegateClass, targetOrNull, method) uses mono_object_new + mono_delegate_ctor to build a managed delegate instance.  ￼

3.7 tools/* — Optional Enhancements
	•	metadata.ts: If present, use mono_image_get_table_info et al. to enumerate types/methods; otherwise, fall back to descriptors. (Embedding doc lists available tables and APIs.)  ￼
	•	signature-infer.ts: method/param inference using signature APIs to validate arguments for runtimeInvoke.
	•	probe.ts: AOB or “near name” fallback used by api.ts when exports are stripped.

⸻

4) Public API (selected)

// index.ts
Mono.api.attachThread(): NativePointer
Mono.api.stringNew(text: string): NativePointer
Mono.api.runtimeInvoke(method: ptr, obj: ptr, args: ptr[]): NativePointer

Mono.model.Image.fromAssemblyPath(api, path): Image
Mono.model.Klass.fromName(api, image, ns, name): Klass
Mono.model.Method.find(api, image, desc): Method
Mono.model.Method#getParamCount(): number
Mono.model.Method#invoke(obj: ptr | null, args: ptr[]): ptr

Mono.model.Delegate.create(api, delegateClass: ptr, targetOrNull: ptr, method: ptr): MonoDelegate
Mono.model.Delegate#invokeManaged(args: ptr[]): ptr   // safe, slower
Mono.model.Delegate#compileNative(ret, argTypes): NativeFunction // fastest

Frida API mappings (JS-side):
	•	NativeFunction(address, returnType, argTypes[, abi]) for export wrappers and delegate thunks.  ￼
	•	Interceptor.attach() to implement tracers or mono_runtime_invoke hooks.  ￼

⸻

5) Control Flows

5.1 Managed Call (universal)
	1.	Ensure thread: withAttachedThread(api, () => ...).  ￼
	2.	Resolve method via descriptor or class+name.  ￼
	3.	Pack void** argv and MonoObject** exc.
	4.	mono_runtime_invoke(method, obj, argv, &exc) → throw JS error if exc set.  ￼

5.2 Delegate Fast Call (high-frequency)
	1.	Get delegate class from object: mono_object_get_class.
	2.	mono_get_delegate_invoke(klass) → MonoMethod*.
	3.	mono_method_get_unmanaged_thunk(invoke) → native function ptr.
	4.	Create NativeFunction(thunk, ret, argTypes) with correct ABI/arg layout (typically (MonoObject* this, ...args, MonoObject** exc)).  ￼

Keep a GCHandle on the delegate object while in use. Always attach thread before calling managed code; StackOverflow and embedding docs emphasize this.  ￼

⸻

6) Error Handling & Diagnostics
	•	Export resolution: fail with a clear error (Export not found: mono_runtime_invoke) listing attempted aliases; log “heuristic match” when falling back to near-names.
	•	Threading: throw if attachThread fails; surface a guidance string (“Mono requires mono_thread_attach before mono_runtime_invoke on non-Mono threads”).  ￼
	•	Managed exceptions: runtimeInvoke checks exception slot and throws a JS Error with the raw pointer; future TODO: convert to string if mono_object_to_string is available.
	•	Thunk misuse: if the thunk is present but the call crashes, print the declared signature, platform ABI, and a link to unmanaged-thunk references.  ￼

⸻

7) Performance Plan
	•	Cache all NativeFunction instances (exports & thunks).
	•	Keep argv buffers alive and reuse them across repeated calls.
	•	Attach once per instrumentation thread; avoid frequent attach/detach.  ￼
	•	Prefer delegate thunks for tight loops; the Embeddinator issue tracks the perf benefit of thunks vs runtime_invoke.  ￼
	•	Use LRU caches for class/method lookups and resolved pointers.

⸻

8) Security & Safety
	•	All API calls should run inside withAttachedThread to avoid deadlocks/crashes during GC STW.  ￼
	•	Validate pointers before usage (non-null, readable).
	•	GCHandlePool must support bulk release on script unload to avoid leaks.
	•	Delegate thunk callers must pass a valid exception slot and check it afterward (pattern from embedding docs).  ￼

⸻

9) Build, Packaging, and Loading
	•	Build with frida-compile (TS → single agent):
frida-compile src/index.ts -o dist/agent.js (or npm run build).  ￼
	•	Load: frida -U -f <bundle.id> -l dist/agent.js --no-pause.
	•	Developer workflow: npm run watch + VS Code typings (@types/frida-gum).  ￼

⸻

10) Testing Strategy

Smoke tests (scripts under examples/):
	•	dump-assemblies.ts: traverse domain → assemblies → images → classes → methods (prints JSON).
	•	call-static-method.ts: descriptor lookup + string arg + exception handling.
	•	register-icall.ts: register a NativeCallback and call it from C#.
	•	invoke-delegate-fast.ts: create a thunk and call it with an exception slot.

Behavioral tests
	•	Verified thread attach needed before runtimeInvoke on new threads (StackOverflow canonical answer).  ￼
	•	Thunk correctness on common signatures; link to Mono list thread if ABI hints needed.  ￼

⸻

11) Migration & Parity with frida-il2cpp-bridge
	•	Similar OOP surface and naming so existing scripts port easily (Image, Class/Klass, Method, Object, Delegate).
	•	Differences:
	•	IL2CPP has its own C API; this project targets Mono embedding API and method descriptors; metadata usage is optional.  ￼

⸻

12) Risks & Mitigations

Risk	Mitigation
Export names differ across Mono builds	aliases, near-name scan, optional AOB probe
Thunk ABI mismatch causes crashes	Provide examples, require explicit arg types, document exception slot, cite official sources.  ￼
Unattached threads cause random crashes	Centralize all public entry-points behind withAttachedThread; assert preconditions.  ￼
GCHandle leaks	GCHandlePool.releaseAll() on script unload; unit smoke tests
Complex TS agents	Follow official TS agent example & frida-compile workflow.  ￼


⸻

13) Minimal Code Sketches (for implementers)

Export wrapper creation

const decl = SIGNATURES[name];
const ptr = Module.findExportByName(mod.name, name) ||
            tryAliases(decl.aliases) ||
            findNearName(mod, name);
const fn  = new NativeFunction(ptr, decl.ret, decl.args); // cached

(Frida Functions & JavaScript APIs document NativeFunction conventions.)  ￼

Managed invoke

const exc = Memory.alloc(Process.pointerSize);
Memory.writePointer(exc, NULL);
const argv = makeArgv(args);
const ret  = mono_runtime_invoke(method, obj, argv, exc);
if (!Memory.readPointer(exc).isNull()) throw new Error("Managed exception");

(Pattern from Mono embedding docs.)  ￼

Delegate thunk

const invoke = mono_get_delegate_invoke(delegateClass);
const thunk  = mono_method_get_unmanaged_thunk(invoke);
const Fast   = new NativeFunction(thunk, "bool", ["pointer","float","pointer"]);

(References discuss getting Invoke and obtaining its unmanaged thunk.)  ￼

⸻

14) References
	•	Mono Embedding docs (init, thread attach, runtime invoke, descriptors, GC): official site.  ￼
	•	Mono embed slides (API guidelines & components).  ￼
	•	Thread attach before mono_runtime_invoke on foreign threads (Q&A).  ￼
	•	Unmanaged thunk: discussions and perf motivation.  ￼
	•	Frida JavaScript & Functions docs: NativeFunction, Interceptor.  ￼
	•	TypeScript agent example & frida-compile usage.  ￼
	•	frida-il2cpp-bridge repo/wiki for API design inspiration.  ￼

⸻

Deliverable

Implement the modules as specified, wire them through index.ts, and export a single global Mono object providing both low-level (api) and model access. Ensure all public entry-points attach the thread, check exceptions, and keep managed objects alive through GC handles. Build with frida-compile, ship dist/agent.js, and validate with the provided examples.
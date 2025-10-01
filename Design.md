frida-mono-bridge — Design Document

1) Overview

frida-mono-bridge is a TypeScript bridge that exposes the Mono runtime (Unity/Xamarin/embedded Mono) to Frida scripts with a clean, high-level API. It mirrors the ergonomics of frida-il2cpp-bridge while targeting Mono’s C embedding API. The project compiles to a single Frida agent via frida-compile.

Primary goals
	•	Discover a Mono runtime in a target process and safely call its C API.
	•	Provide a model layer (Domain, Image, Class, Method, Object, String, Array, Field, Property, Delegate) for ergonomic scripting.
	•	Support internal calls (ICall), GCHandle management, basic metadata queries, and robust thread/exception handling.
	•	Offer high-performance invocation paths (managed invoke + unmanaged delegate thunks) with caching and batch helpers.

⸻

2) High-Level Architecture

src/
  runtime/     # Mono runtime access: discovery, signatures, NativeFunction wrapping, thread guard, GCHandle
  model/       # High-level object model (Domain, Image, Klass, Method, Object, String, Array, Field, Property, Delegate)
  tools/       # Utilities: metadata access, signature inference, export/AOB probing, caches
  utils/       # Logging, shared types
index.ts       # Global entry point: exposes Mono.{api, model, helpers}
examples/      # Practical scripts (dump, hook, icall, delegate)

Layers
	1.	Runtime: Finds the Mono module, resolves exports (with aliases/AOB for resilience), wraps them as Frida NativeFunctions, and provides helpers (thread attach, managed invoke, delegate thunk).
	2.	Model: OOP façade over raw pointers; caches lookups, boxes/unboxes values, manages GC handles, and offers safe defaults.
	3.	Tools: Optional helpers for metadata tables, signature/param counting, and last-ditch symbol probing when exports are stripped.

⸻

3) Core Components

3.1 Runtime Discovery (runtime/module.ts)
	•	Tries common module names (libmonosgen-2.0.so, mono-2.0-bdwgc.dll, etc.).
	•	Falls back to heuristic export scans (e.g., presence of mono_runtime_invoke) across all modules.

3.2 API Signatures & Fallback (runtime/signatures.ts, runtime/api.ts)
	•	Canonical Mono C API signatures (return & arg types) with aliases per version/build.
	•	Resolution strategy:
	1.	Module.findExportByName for primary name
	2.	Try aliases
	3.	Scan module exports for “near matches”
	4.	(Optional) AOB/pattern probe (in tools/probe.ts)
	•	All wrapped functions are cached; NativeFunction creation is idempotent.

3.3 Threading & Exceptions (runtime/guard.ts, runtime/api.ts)
	•	Every call pathway ensures mono_thread_attach against the root domain.
	•	Managed invoke (mono_runtime_invoke) uses a preallocated exception slot; non-null is surfaced as a JS error.
	•	A withAttachedThread helper wraps user code to enforce thread safety.

3.4 Memory & GC (runtime/mem.ts, runtime/gchandle.ts)
	•	Helpers for argv assembly, UTF-8 strings, and pointer arrays.
	•	GCHandlePool for strong/weak handles to keep managed objects alive across native calls.

3.5 Model Layer (model/*)
	•	Image: fromAssemblyPath(), returns MonoImage*.
	•	Klass: fromName(image, namespace, name), resolves MonoClass*.
	•	Method: find(image, "Namespace.Type:Method(sig)"), getParamCount(), invoke(obj, args).
	•	Object/String/Array: constructors + boxing/unboxing helpers.
	•	Field/Property: get/set via exported APIs.
	•	Delegate (first-class):
	•	Managed path: invokeManaged(argv) → mono_runtime_invoke (safe & generic).
	•	Native/fast path: compileNative(...) using
mono_get_delegate_invoke → mono_method_get_unmanaged_thunk
Produces a callable native thunk (e.g., bool (MonoObject* this, …, MonoObject** exc)), ideal for high-frequency callbacks.
	•	Construction: MonoDelegate.create(api, delegateClass, targetOrNull, method) calling mono_delegate_ctor.

3.6 ICall Support (model/icall.ts)
	•	Register/replace internal calls via mono_add_internal_call.
	•	Optional “ICall proxy” strategy: if registration is locked down, fall back to intercepting mono_runtime_invoke per-method.

3.7 Metadata & Signature Tools (tools/metadata.ts, tools/signature-infer.ts)
	•	If mono_image_get_table_info and related exports are present, provide lightweight table reads to aid discovery.
	•	If not, rely on method descriptors and runtime Method helpers for parameter counting.

⸻

4) Invocation Paths

Path	API	When to use	Characteristics
Managed	mono_runtime_invoke	Universal fallback	Simple; automatic exception capture; some overhead per call
Delegate Thunk	mono_get_delegate_invoke → mono_method_get_unmanaged_thunk → NativeFunction	Frequent callbacks (e.g., Action<T>)	Highest performance; requires correct ABI/arg layout; explicit exception slot

Recommendation: Use managed for control flows and low QPS; use thunk for inner-loop or per-frame callbacks.

⸻

5) Error Handling & Reliability
	•	All runtime calls enforce thread attach and exception slot checks.
	•	Export discovery is defensive (aliases, heuristic scans).
	•	Model APIs throw precise errors (e.g., “class not found”, “unmanaged thunk not available”).
	•	GC handles are explicitly managed; pooled for long-lived references.

⸻

6) Performance Design
	•	Cache resolved exports and model lookups (Class/Method pointers).
	•	Reuse argv buffers for repeated calls; avoid excessive Memory.alloc.
	•	Keep threads attached for session duration instead of attach/detach per call.
	•	Prefer delegate thunks for high-frequency invocations.

⸻

7) Public API (at a glance)

// global entry (index.ts)
Mono.api.attachThread()
Mono.api.stringNew("txt")
Mono.api.runtimeInvoke(methodPtr, objPtr, [argPtrs...])

// model
const img = Mono.model.Image.fromAssemblyPath(Mono.api, "/path/Assembly-CSharp.dll").handle
const k   = Mono.model.Klass.fromName(Mono.api, img, "Game", "Player")
const m   = Mono.model.Method.find(Mono.api, img, "Game.Player:Say(System.String)")
m.invoke(NULL, [ Mono.api.stringNew("hi") ])

const del = Mono.model.Delegate.create(Mono.api, delegateClass, targetOrNull, methodPtr)
// fast thunk example (signature depends on delegate Invoke)
type Thunk = NativeFunction<"bool", ["pointer","float","pointer"]>
const t = del.compileNative<Thunk>("bool", ["pointer","float","pointer"])


⸻

8) Examples & Tooling
	•	examples/dump-assemblies.ts — Enumerate assemblies/images/classes/methods and print JSON.
	•	examples/call-static-method.ts — Find via method descriptor and invoke with string arg.
	•	examples/register-icall.ts — Register or replace an internal call with a NativeCallback.
	•	examples/invoke-delegate-fast.ts — Compile a delegate thunk and call it in a tight loop.
	•	examples/hook-runtime-invoke.ts — Intercept all managed invocations for tracing.

⸻

9) Build & Run
	•	Build: npm run build → dist/agent.js (via frida-compile)
	•	Dev: npm run watch
	•	Inject: frida -U -f <bundle.id> -l dist/agent.js --no-pause
	•	REPL: Mono.attachThread() then use Mono.api/Mono.model helpers.

⸻

10) Testing Strategy (suggested)
	•	Unit-like scripts in utils/tests/ that exercise:
	•	Export resolution (aliases & fallback).
	•	Managed invoke with exception propagation.
	•	Delegate fast path correctness (ABI & exception slot).
	•	GCHandle lifetime (no premature collection).
	•	Optional CI job that spins an instrumented sample app (desktop/Android emulator) and runs example scripts.

⸻

11) Security & Safety Notes
	•	Always attach current thread before touching the runtime.
	•	Treat unmanaged thunks carefully: incorrect signatures can crash the target.
	•	GCHandle leaks will keep objects alive; maintain strict release discipline (use GCHandlePool).
	•	Keep export probing conservative; prefer explicit names and aliases before heuristics/AOB.

⸻

12) Roadmap
	•	Richer metadata decoders and symbolization helpers.
	•	Argument marshalling utilities for common value types/structs.
	•	Batch/vectorized invoke for stable signatures.
	•	Optional symbol providers for stripped builds (pattern databases).
	•	Minimal host CLI (dump, trace, call) wrapping the examples.

⸻

13) Rationale & Parity
	•	The design echoes frida-il2cpp-bridge so users can transfer skills/scripts with minimal friction.
	•	It embraces Mono’s embedding primitives: mono_thread_attach, mono_runtime_invoke, method descriptors, ICall, GCHandle.
	•	Delegates become first-class: managed (safe) and native thunk (fast) paths are both supported.

⸻

Deliverable: a maintainable, high-performance Frida bridge for Mono with a clear separation of concerns, robust discovery and safety guards, and a pleasant TypeScript developer experience.
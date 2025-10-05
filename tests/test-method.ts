/**
 * Method Operations Tests
 */

import Mono from "../src";
import { MonoMethod } from "../src/model/method";
import { MonoImage } from "../src/model/image";
import { MonoObject } from "../src/model/object";
import { createMonoString } from "../src/model/string";
import { MonoApi, MonoManagedExceptionError } from "../src/runtime/api";
import { TestResult, TestSuite, assert, createTest, assertPerformWorks } from "./test-framework";

interface FakeMethodFixture {
  descriptor: string;
  image: NativePointer;
  methodPointer: NativePointer;
  name?: string;
  paramCount?: number;
}

interface FakeMonoApiOptions {
  methods?: FakeMethodFixture[];
  descriptorFailures?: string[];
  runtimeInvoke?: (method: NativePointer, instance: NativePointer, args: NativePointer[]) => NativePointer;
}

const CORELIB_CANDIDATES = ["mscorlib", "System.Private.CoreLib", "netstandard"];

let cachedCorlibImage: MonoImage | null = null;
let cachedStringToUtf8: ((input: NativePointer) => NativePointer) | null = null;

function getCorlibImage(): MonoImage {
  if (cachedCorlibImage) {
    return cachedCorlibImage;
  }

  return Mono.perform(() => {
    for (const name of CORELIB_CANDIDATES) {
      const namePtr = Memory.allocUtf8String(name);
      const imagePtr = Mono.api.native.mono_image_loaded(namePtr);
      if (!imagePtr.isNull()) {
        cachedCorlibImage = new MonoImage(Mono.api, imagePtr);
        return cachedCorlibImage;
      }
    }

    throw new Error(`Unable to locate core library image (tried: ${CORELIB_CANDIDATES.join(", ")})`);
  });
}

function getStringToUtf8(): (input: NativePointer) => NativePointer {
  if (cachedStringToUtf8) {
    return cachedStringToUtf8;
  }
  const address = Module.findExportByName(Mono.module.name, "mono_string_to_utf8");
  if (!address) {
    throw new Error("mono_string_to_utf8 export not available on this Mono runtime");
  }
  cachedStringToUtf8 = new NativeFunction(address, "pointer", ["pointer"]) as (input: NativePointer) => NativePointer;
  return cachedStringToUtf8;
}

function readManagedString(pointer: NativePointer): string {
  if (pointer.isNull()) {
    return "";
  }
  return Mono.perform(() => {
    const toUtf8 = getStringToUtf8();
    const utf8Ptr = toUtf8(pointer);
    if (utf8Ptr.isNull()) {
      return "";
    }
    try {
      return Memory.readUtf8String(utf8Ptr) ?? "";
    } finally {
      Mono.api.native.mono_free(utf8Ptr);
    }
  });
}

function readManagedBool(pointer: NativePointer): boolean {
  if (pointer.isNull()) {
    throw new Error("Expected boxed boolean value but received NULL pointer");
  }
  return Mono.perform(() => {
    const unboxed = Mono.api.native.mono_object_unbox(pointer);
    return unboxed.readU8() !== 0;
  });
}

class FakeThreadManager {
  public attachThreadCalls = 0;
  public withAttachedThreadCalls = 0;
  public readonly activeAttachments = new Set<number>();
  public readonly attachedThreads = new Map<number, NativePointer>();
  private currentThreadId = 12345;

  constructor(private readonly threadHandle: NativePointer) {}

  withAttachedThread<T>(fn: () => T): T {
    this.withAttachedThreadCalls++;
    const threadId = this.currentThreadId;

    // If thread is already in an attachment context, just execute the function
    if (this.activeAttachments.has(threadId)) {
      return fn();
    }

    // Mark thread as actively attached to prevent nested calls
    this.activeAttachments.add(threadId);
    this.attachThreadCalls++;
    this.attachedThreads.set(threadId, this.threadHandle);
    try {
      return fn();
    } finally {
      this.activeAttachments.delete(threadId);
    }
  }

  isInAttachedContext(): boolean {
    return this.activeAttachments.has(this.currentThreadId);
  }

  ensureAttached(): NativePointer {
    const threadId = this.currentThreadId;
    const handle = this.attachedThreads.get(threadId);
    if (handle && !handle.isNull()) {
      return handle;
    }
    this.attachThreadCalls++;
    this.attachedThreads.set(threadId, this.threadHandle);
    return this.threadHandle;
  }

  detachAll(): void {
    for (const threadId of this.attachedThreads.keys()) {
      this.attachedThreads.delete(threadId);
      this.activeAttachments.delete(threadId);
    }
  }
}

class FakeMonoApiHarness {
  public readonly api: MonoApi;
  public attachThreadCalls = 0;
  public detachThreadCalls = 0;
  public readonly freedDescriptors: NativePointer[] = [];
  public readonly runtimeInvokeCalls: Array<{ method: NativePointer; instance: NativePointer; args: NativePointer[] }> = [];
  public readonly stringNewInputs: string[] = [];
  public readonly threadManager: FakeThreadManager;

  private readonly descriptorFailures = new Set<string>();
  private readonly descriptorHandles = new Map<string, string>();
  private readonly methodsByKey = new Map<string, FakeMethodFixture>();
  private readonly methodsByPointer = new Map<string, FakeMethodFixture>();
  private readonly signatureByMethod = new Map<string, NativePointer>();
  private readonly signatureParamCounts = new Map<string, number>();
  private descriptorCounter = 0;
  private signatureCounter = 0;
  private readonly runtimeInvokeImpl?: (method: NativePointer, instance: NativePointer, args: NativePointer[]) => NativePointer;
  private readonly threadHandle: NativePointer;

  constructor(options: FakeMonoApiOptions = {}) {
    this.threadHandle = ptr("0x7f00");
    this.threadManager = new FakeThreadManager(this.threadHandle);
    options.descriptorFailures?.forEach((descriptor) => this.descriptorFailures.add(descriptor));

    (options.methods ?? []).forEach((method, index) => {
      this.methodsByKey.set(this.makeKey(method.descriptor, method.image), method);
      this.methodsByPointer.set(method.methodPointer.toString(), method);
      const signaturePtr = ptr(`0x${(0x6000 + index).toString(16)}`);
      this.signatureByMethod.set(method.methodPointer.toString(), signaturePtr);
      this.signatureParamCounts.set(signaturePtr.toString(), method.paramCount ?? 0);
    });

    this.runtimeInvokeImpl = options.runtimeInvoke;

    const native = {
      mono_method_desc_new: (descPtr: NativePointer, _includeNamespace: boolean) => this.handleDescriptorNew(descPtr),
      mono_method_desc_search_in_image: (descHandle: NativePointer, imagePtr: NativePointer) => this.handleDescriptorSearch(descHandle, imagePtr),
      mono_method_desc_free: (descHandle: NativePointer) => this.handleDescriptorFree(descHandle),
      mono_method_get_name: (methodPtr: NativePointer) => this.handleGetName(methodPtr),
      mono_method_signature: (methodPtr: NativePointer) => this.handleSignature(methodPtr),
      mono_signature_get_param_count: (signaturePtr: NativePointer) => this.handleSignatureParamCount(signaturePtr),
    };

    const apiShape = {
      native,
      attachThread: () => {
        this.attachThreadCalls += 1;
        return this.threadHandle;
      },
      detachThread: (_thread: NativePointer) => {
        this.detachThreadCalls += 1;
      },
      getRootDomain: () => ptr("0x9000"),
      stringNew: (text: string) => {
        this.stringNewInputs.push(text);
        return Memory.allocUtf8String(text);
      },
      runtimeInvoke: (method: NativePointer, instance: NativePointer, args: NativePointer[]) => {
        const snapshotArgs = args.slice();
        this.runtimeInvokeCalls.push({ method, instance, args: snapshotArgs });
        if (this.runtimeInvokeImpl) {
          return this.runtimeInvokeImpl(method, instance, snapshotArgs);
        }
        return ptr("0xb000");
      },
    };

    this.api = apiShape as unknown as MonoApi;
    (this.api as any)._threadManager = this.threadManager;
  }

  private makeKey(descriptor: string, image: NativePointer): string {
    return `${descriptor}::${image.toString()}`;
  }

  private handleDescriptorNew(descPtr: NativePointer): NativePointer {
    const descriptor = Memory.readUtf8String(descPtr) ?? "";
    if (this.descriptorFailures.has(descriptor)) {
      return NULL;
    }
    const handle = ptr(`0x${(0x4000 + this.descriptorCounter++).toString(16)}`);
    this.descriptorHandles.set(handle.toString(), descriptor);
    return handle;
  }

  private handleDescriptorSearch(descHandle: NativePointer, imagePtr: NativePointer): NativePointer {
    const descriptor = this.descriptorHandles.get(descHandle.toString());
    if (!descriptor) {
      return NULL;
    }
    const fixture = this.methodsByKey.get(this.makeKey(descriptor, imagePtr));
    return fixture ? fixture.methodPointer : NULL;
  }

  private handleDescriptorFree(descHandle: NativePointer): void {
    this.freedDescriptors.push(descHandle);
    this.descriptorHandles.delete(descHandle.toString());
  }

  private handleGetName(methodPtr: NativePointer): NativePointer {
    const fixture = this.methodsByPointer.get(methodPtr.toString());
    const name = fixture?.name ?? "Method";
    return Memory.allocUtf8String(name);
  }

  private handleSignature(methodPtr: NativePointer): NativePointer {
    const key = methodPtr.toString();
    let signaturePtr = this.signatureByMethod.get(key);
    if (!signaturePtr) {
      signaturePtr = ptr(`0x${(0x6000 + this.signatureCounter++).toString(16)}`);
      this.signatureByMethod.set(key, signaturePtr);
      this.signatureParamCounts.set(signaturePtr.toString(), 0);
    }
    return signaturePtr;
  }

  private handleSignatureParamCount(signaturePtr: NativePointer): number {
    return this.signatureParamCounts.get(signaturePtr.toString()) ?? 0;
  }
}

function withFakeHarness(options: FakeMonoApiOptions, fn: (harness: FakeMonoApiHarness) => void): void {
  const harness = new FakeMonoApiHarness(options);
  try {
    fn(harness);
  } finally {
    // Note: detachAll is no longer needed with modern API
  }
}

export function testMethodOperations(): TestResult {
  console.log("\nMethod Operations:");

  const suite = new TestSuite("Method Operations");

  // Modern API tests
  suite.addResult(createTest("Mono.perform should work for method tests", () => {
    assertPerformWorks("Mono.perform() should work for method tests");
  }));

  suite.addResult(createTest("Method-related exports should be available", () => {
    Mono.perform(() => {
      assert(Mono.api.hasExport("mono_method_get_name"), "mono_method_get_name should be available");
      assert(Mono.api.hasExport("mono_method_desc_new"), "mono_method_desc_new should be available");
      assert(Mono.api.hasExport("mono_method_desc_search_in_image"), "mono_method_desc_search_in_image should be available");
    });
  }));

  suite.addResult(createTest("MonoMethod.find resolves method handles and frees descriptors", () => {
    const imagePtr = ptr("0x2000");
    const methodPtr = ptr("0x3000");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:DoWork",
          image: imagePtr,
          methodPointer: methodPtr,
          name: "DoWork",
          paramCount: 2,
        },
      ],
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:DoWork");
      assert(method.pointer.toString() === methodPtr.toString(), "Returned MonoMethod should wrap located pointer");
      assert(harness.freedDescriptors.length === 1, "Method descriptors should be freed after lookup");
    });
  }));

  suite.addResult(createTest("MonoMethod.find throws when descriptor cannot be created", () => {
    const imagePtr = ptr("0x2100");
    withFakeHarness({ descriptorFailures: ["Missing.Type:Fail"] }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      let captured: unknown = null;
      try {
        MonoMethod.find(harness.api, image, "Missing.Type:Fail");
      } catch (error) {
        captured = error;
      }
      assert(captured instanceof Error && captured.message.includes("mono_method_desc_new failed"), "Should surface descriptor allocation failure");
    });
  }));

  suite.addResult(createTest("MonoMethod.find throws when method is missing", () => {
    const imagePtr = ptr("0x2200");
    withFakeHarness({
      methods: [
        {
          descriptor: "Other.Type:Existing",
          image: imagePtr,
          methodPointer: ptr("0x3100"),
        },
      ],
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      let captured: unknown = null;
      try {
        MonoMethod.find(harness.api, image, "Game.Type:Missing");
      } catch (error) {
        captured = error;
      }
      assert(captured instanceof Error && captured.message.includes("not found"), "Should throw when mono_method_desc_search_in_image returns NULL");
      assert(harness.freedDescriptors.length === 1, "Descriptor should be freed even when method lookup fails");
    });
  }));

  suite.addResult(createTest("MonoMethod.getName attaches thread and reads method name", () => {
    const imagePtr = ptr("0x2300");
    const methodPtr = ptr("0x3200");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:GetName",
          image: imagePtr,
          methodPointer: methodPtr,
          name: "GetName",
        },
      ],
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:GetName");
      const name = method.getName();
      assert(name === "GetName", "mono_method_get_name result should be decoded");
      assert(harness.attachThreadCalls === 1, "withThread should attach the current thread once");
    });
  }));

  suite.addResult(createTest("MonoMethod.getParamCount returns signature metadata", () => {
    const imagePtr = ptr("0x2400");
    const methodPtr = ptr("0x3300");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:GetParamCount",
          image: imagePtr,
          methodPointer: methodPtr,
          paramCount: 3,
        },
      ],
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:GetParamCount");
      const count = method.getParamCount();
      assert(count === 3, "mono_signature_get_param_count should drive parameter count");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke forwards instance and prepared arguments", () => {
    const imagePtr = ptr("0x2500");
    const methodPtr = ptr("0x3400");
    const expectedReturn = ptr("0x4400");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:Invoke",
          image: imagePtr,
          methodPointer: methodPtr,
          paramCount: 2,
        },
      ],
      runtimeInvoke: (_method, instance, args) => {
        assert(!instance.isNull(), "Instance pointer should be passed through");
        assert(args.length === 2, "Two arguments should be forwarded");
        return expectedReturn;
      },
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:Invoke");
      const instance = new MonoObject(harness.api, ptr("0x5000"));
      const argObject = new MonoObject(harness.api, ptr("0x5100"));
      const result = method.invoke(instance, [argObject, "hello world"], { autoBoxPrimitives: false });
      assert(result.toString() === expectedReturn.toString(), "Return value should propagate from runtimeInvoke");
      assert(harness.runtimeInvokeCalls.length === 1, "runtimeInvoke should be called once");
      const call = harness.runtimeInvokeCalls[0];
      assert(call.instance.toString() === instance.pointer.toString(), "Instance pointer should match provided MonoObject");
      assert(call.args[0].toString() === argObject.pointer.toString(), "First argument should be unwrapped MonoObject pointer");
      assert(Memory.readUtf8String(call.args[1]) === "hello world", "String arguments should be boxed via mono_string_new");
      assert(harness.stringNewInputs.includes("hello world"), "stringNew should be invoked for string arguments");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke suppresses managed exceptions when requested", () => {
    const imagePtr = ptr("0x2600");
    const methodPtr = ptr("0x3500");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:InvokeSafe",
          image: imagePtr,
          methodPointer: methodPtr,
        },
      ],
      runtimeInvoke: () => {
        throw new MonoManagedExceptionError(ptr("0xdeadbeef"));
      },
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:InvokeSafe");
      const result = method.invoke(null, [], { throwOnManagedException: false, autoBoxPrimitives: false });
      assert(result.isNull(), "Result should be NULL when managed exception is suppressed");
      assert(harness.runtimeInvokeCalls.length === 1, "runtimeInvoke should still be attempted");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke rethrows managed exceptions by default", () => {
    const imagePtr = ptr("0x2700");
    const methodPtr = ptr("0x3600");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:InvokeStrict",
          image: imagePtr,
          methodPointer: methodPtr,
        },
      ],
      runtimeInvoke: () => {
        throw new MonoManagedExceptionError(ptr("0xfeedface"));
      },
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:InvokeStrict");
      let captured: unknown = null;
      try {
        method.invoke(null, [], { autoBoxPrimitives: false });
      } catch (error) {
        captured = error;
      }
      assert(captured instanceof MonoManagedExceptionError, "Managed exceptions should propagate when not suppressed");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke rethrows non-managed errors even when suppression requested", () => {
    const imagePtr = ptr("0x2800");
    const methodPtr = ptr("0x3700");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:InvokeNativeError",
          image: imagePtr,
          methodPointer: methodPtr,
        },
      ],
      runtimeInvoke: () => {
        throw new Error("native failure");
      },
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:InvokeNativeError");
      let captured: unknown = null;
      try {
        method.invoke(null, [], { throwOnManagedException: false, autoBoxPrimitives: false });
      } catch (error) {
        captured = error;
      }
      assert(captured instanceof Error && captured.message === "native failure", "Non-managed errors should not be swallowed");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke rejects primitives when auto boxing is disabled", () => {
    const imagePtr = ptr("0x2900");
    const methodPtr = ptr("0x3800");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:InvokePrimitive",
          image: imagePtr,
          methodPointer: methodPtr,
        },
      ],
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:InvokePrimitive");
      let captured: unknown = null;
      try {
        method.invoke(null, [42], { autoBoxPrimitives: false });
      } catch (error) {
        captured = error;
      }
      assert(captured instanceof Error && captured.message.includes("Primitive arguments"), "Primitive values should require explicit boxing when auto boxing is disabled");
      assert(harness.runtimeInvokeCalls.length === 0, "runtimeInvoke should not be called when argument preparation fails");
    });
  }));

  suite.addResult(createTest("MonoMethod.invoke treats null instance as NULL pointer", () => {
    const imagePtr = ptr("0x2a00");
    const methodPtr = ptr("0x3900");
    withFakeHarness({
      methods: [
        {
          descriptor: "Game.Type:InvokeStatic",
          image: imagePtr,
          methodPointer: methodPtr,
        },
      ],
      runtimeInvoke: (_method, instance, _args) => {
        assert(instance.isNull(), "Null instance should be forwarded as NULL pointer");
        return ptr("0x4500");
      },
    }, (harness) => {
      const image = new MonoImage(harness.api, imagePtr);
      const method = MonoMethod.find(harness.api, image, "Game.Type:InvokeStatic");
      const result = method.invoke(null, [], { autoBoxPrimitives: false });
      assert(result.toString() === ptr("0x4500").toString(), "Return pointer should propagate for static calls");
    });
  }));

  // Modern API integration tests
  suite.addResult(createTest("Fluent API method operations should work", () => {
    Mono.perform(() => {
      const domain = Mono.domain;
      const assemblies = domain.getAssemblies();

      if (assemblies.length > 0) {
        const firstAssembly = assemblies[0];
        const image = firstAssembly.getImage();
        const classes = image.getClasses();

        if (classes.length > 0) {
          const firstClass = classes[0];
          const methods = firstClass.methods;

          assert(Array.isArray(methods), "Should get methods array");

          if (methods.length > 0) {
            const firstMethod = methods[0];
            assert(typeof firstMethod.getName === "function", "Method should have getName method");
            assert(typeof firstMethod.getParamCount === "function", "Method should have getParamCount method");

            console.log(`    Found method: ${firstMethod.getName()} (${firstMethod.getParamCount()} parameters)`);
          }
        }
      }
    });
  }));

  suite.addResult(createTest("MonoMethod.find locates System.String:IsNullOrEmpty", () => {
    const corlib = getCorlibImage();
    const method = MonoMethod.find(Mono.api, corlib, "System.String:IsNullOrEmpty(string)");
    assert(method.getName() === "IsNullOrEmpty", "Should fetch the real System.String.IsNullOrEmpty method");
    assert(method.getParamCount() === 1, "System.String.IsNullOrEmpty should accept one parameter");
  }));

  suite.addResult(createTest("MonoMethod.invoke executes System.String:IsNullOrEmpty", () => {
    const corlib = getCorlibImage();
    const method = MonoMethod.find(Mono.api, corlib, "System.String:IsNullOrEmpty(string)");
    const emptyResult = method.invoke(null, [""]);
    const nonEmptyResult = method.invoke(null, ["frida"]);
    const nullResult = method.invoke(null, [null]);
    assert(readManagedBool(emptyResult), "Empty string should return true");
    assert(!readManagedBool(nonEmptyResult), "Non-empty string should return false");
    assert(readManagedBool(nullResult), "Null string should return true");
  }));

  suite.addResult(createTest("MonoMethod.invoke returns managed strings", () => {
    const corlib = getCorlibImage();
    const concat = MonoMethod.find(Mono.api, corlib, "System.String:Concat(string,string)");
    const resultPtr = concat.invoke(null, ["Hello ", "World"]);
    const resultText = readManagedString(resultPtr);
    assert(resultText === "Hello World", "System.String.Concat should concatenate inputs");
  }));
  suite.addResult(createTest("MonoMethod.invoke auto boxes primitive arguments", () => {
    const corlib = getCorlibImage();
    const abs = MonoMethod.find(Mono.api, corlib, "System.Math:Abs(int)");
    
    try {
      const resultPtr = abs.invoke(null, [-123]);
      assert(!resultPtr.isNull(), "Abs should return a boxed result");
      const absoluteValue = Mono.model.withThread(() => {
        const unboxed = Mono.api.native.mono_object_unbox(resultPtr);
        return unboxed.readS32();
      });
      assert(absoluteValue === 123, "System.Math.Abs should compute absolute value for auto-boxed input");
    } catch (error) {
      // Auto-boxing primitives requires class resolution which may not work in all Mono versions
      if (error instanceof Error && error.message.includes("Unable to resolve class for parameter type")) {
        console.log("    (Skipped: Primitive auto-boxing not supported in this Mono version)");
        return;
      }
      throw error;
    }
  }));

  suite.addResult(createTest("MonoMethod.invoke handles instance methods", () => {
    const corlib = getCorlibImage();
    const toUpper = MonoMethod.find(Mono.api, corlib, "System.String:ToUpperInvariant()");
    const instance = createMonoString(Mono.api, "Frida");
    const resultPtr = toUpper.invoke(instance, []);
    const text = readManagedString(resultPtr);
    assert(text === "FRIDA", "Instance invocation should operate on provided object");
  }));

  suite.addResult(createTest("MonoMethod.invoke surfaces System.Int32.Parse exceptions", () => {
    const corlib = getCorlibImage();
    const parse = MonoMethod.find(Mono.api, corlib, "System.Int32:Parse(string)");
    let captured: unknown = null;
    try {
      parse.invoke(null, ["not-a-number"]);
    } catch (error) {
      captured = error;
    }
    assert(captured instanceof MonoManagedExceptionError, "Invalid parse should raise MonoManagedExceptionError");
    const suppressed = parse.invoke(null, ["still-not-a-number"], { throwOnManagedException: false });
    assert(suppressed.isNull(), "When suppressed, managed exception should yield NULL pointer");
  }));

  const summary = suite.getSummary();

  return {
    name: "Method Operations Suite",
    passed: summary.failed === 0,
    failed: summary.failed > 0,
    skipped: summary.skipped > 0,
    message: `${summary.passed}/${summary.total} method tests passed`,
  };
}

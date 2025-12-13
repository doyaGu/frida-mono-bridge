import { MonoEnums } from "../runtime/enums";
import { lazy } from "../utils/cache";
import { pointerIsNull } from "../utils/memory";
import { readUtf8String } from "../utils/string";
import { MonoHandle } from "./base";
import { MonoType } from "./type";

export interface MonoParameterInfo {
  index: number;
  type: MonoType;
  isOut: boolean;
}

export const MonoCallConvention = MonoEnums.MonoCallConvention;

export type MonoCallConvention = (typeof MonoEnums.MonoCallConvention)[keyof typeof MonoEnums.MonoCallConvention];

export const MonoCallConventionModifiers = Object.freeze({
  Generic: 0x10,
  HasThis: 0x20,
  ExplicitThis: 0x40,
} as const);

export type MonoCallConventionModifier = (typeof MonoCallConventionModifiers)[keyof typeof MonoCallConventionModifiers];

export class MonoMethodSignature extends MonoHandle {
  /** Gets the number of parameters. */
  @lazy
  get parameterCount(): number {
    return this.native.mono_signature_get_param_count(this.pointer) as number;
  }

  /** Gets the return type. */
  @lazy
  get returnType(): MonoType {
    const typePtr = this.native.mono_signature_get_return_type(this.pointer);
    return new MonoType(this.api, typePtr);
  }

  /** Gets the parameter types. */
  @lazy
  get parameterTypes(): MonoType[] {
    return this.enumerateParameterTypes();
  }

  /** Gets the parameters. */
  @lazy
  get parameters(): MonoParameterInfo[] {
    const types = this.enumerateParameterTypes();
    return types.map((type, index) => ({
      index,
      type,
      isOut: this.isOutParameter(index),
    }));
  }

  /** Determines whether this is an instance method signature. */
  @lazy
  get isInstanceMethod(): boolean {
    return (this.native.mono_signature_is_instance(this.pointer) as number) !== 0;
  }

  /** Determines whether this signature has an explicit this parameter. */
  @lazy
  get hasExplicitThis(): boolean {
    return (this.native.mono_signature_explicit_this(this.pointer) as number) !== 0;
  }

  /** Gets the calling convention. */
  @lazy
  get callConvention(): number {
    return this.native.mono_signature_get_call_conv(this.pointer) as number;
  }

  /** Gets the hash of this signature. */
  @lazy
  get hash(): number {
    return this.native.mono_signature_hash(this.pointer) as number;
  }

  isOutParameter(index: number): boolean {
    return (this.native.mono_signature_param_is_out(this.pointer, index) as number) !== 0;
  }

  getDescription(includeNamespace = true): string {
    const descPtr = this.native.mono_signature_get_desc(this.pointer, includeNamespace ? 1 : 0);
    if (pointerIsNull(descPtr)) {
      return "";
    }
    try {
      return readUtf8String(descPtr);
    } finally {
      this.api.tryFree(descPtr);
    }
  }

  toString(): string {
    return this.getDescription();
  }

  private enumerateParameterTypes(): MonoType[] {
    const iterator = Memory.alloc(Process.pointerSize);
    iterator.writePointer(NULL);
    const parameters: MonoType[] = [];
    while (true) {
      const typePtr = this.native.mono_signature_get_params(this.pointer, iterator);
      if (pointerIsNull(typePtr)) {
        break;
      }
      parameters.push(new MonoType(this.api, typePtr));
    }
    return parameters;
  }
}

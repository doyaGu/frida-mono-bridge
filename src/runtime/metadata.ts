export const FieldAttribute = Object.freeze({
  FieldAccessMask: 0x0007,
  PrivateScope: 0x0000,
  Private: 0x0001,
  FamANDAssem: 0x0002,
  Assembly: 0x0003,
  Family: 0x0004,
  FamORAssem: 0x0005,
  Public: 0x0006,
  Static: 0x0010,
  InitOnly: 0x0020,
  Literal: 0x0040,
  NotSerialized: 0x0080,
  HasFieldRva: 0x0100,
  SpecialName: 0x0200,
  RTSpecialName: 0x0400,
  HasFieldMarshal: 0x1000,
  PInvokeImpl: 0x2000,
  HasDefault: 0x8000,
} as const);

export const MethodAttribute = Object.freeze({
  MemberAccessMask: 0x0007,
  PrivateScope: 0x0000,
  Private: 0x0001,
  FamANDAssem: 0x0002,
  Assembly: 0x0003,
  Family: 0x0004,
  FamORAssem: 0x0005,
  Public: 0x0006,
  UnmanagedExport: 0x0008,
  Static: 0x0010,
  Final: 0x0020,
  Virtual: 0x0040,
  HideBySig: 0x0080,
  NewSlot: 0x0100,
  Abstract: 0x0400,
  SpecialName: 0x0800,
  RTSpecialName: 0x1000,
  PInvokeImpl: 0x2000,
  HasSecurity: 0x4000,
  RequireSecObject: 0x8000,
} as const);

export const MethodImplAttribute = Object.freeze({
  CodeTypeMask: 0x0003,
  IL: 0x0000,
  Native: 0x0001,
  OPTIL: 0x0002,
  Runtime: 0x0003,
  ManagedMask: 0x0004,
  Managed: 0x0000,
  Unmanaged: 0x0004,
  NoInlining: 0x0008,
  ForwardRef: 0x0010,
  Synchronized: 0x0020,
  NoOptimization: 0x0040,
  PreserveSig: 0x0080,
  AggressiveInlining: 0x0100,
  AggressiveOptimization: 0x0200,
  InternalCall: 0x1000,
} as const);

export const TypeAttribute = Object.freeze({
  VisibilityMask: 0x00000007,
  NotPublic: 0x00000000,
  Public: 0x00000001,
  NestedPublic: 0x00000002,
  NestedPrivate: 0x00000003,
  NestedFamily: 0x00000004,
  NestedAssembly: 0x00000005,
  NestedFamANDAssem: 0x00000006,
  NestedFamORAssem: 0x00000007,
  LayoutMask: 0x00000018,
  AutoLayout: 0x00000000,
  SequentialLayout: 0x00000008,
  ExplicitLayout: 0x00000010,
  ClassSemanticsMask: 0x00000020,
  Class: 0x00000000,
  Interface: 0x00000020,
  Abstract: 0x00000080,
  Sealed: 0x00000100,
  SpecialName: 0x00000400,
  RTSpecialName: 0x00000800,
  Import: 0x00001000,
  Serializable: 0x00002000,
  WindowsRuntime: 0x00004000,
  StringFormatMask: 0x00030000,
  AnsiClass: 0x00000000,
  UnicodeClass: 0x00010000,
  AutoClass: 0x00020000,
  BeforeFieldInit: 0x00100000,
  HasSecurity: 0x00040000,
} as const);

type FlagDictionary = Record<string, number>;

export function hasFlag(flags: number, mask: number): boolean {
  return (flags & mask) === mask;
}

export function pickFlags<T extends FlagDictionary>(flags: number, map: T): string[] {
  const selected: string[] = [];
  for (const key of Object.keys(map)) {
    const value = map[key];
    if (value !== 0 && (flags & value) === value) {
      selected.push(key);
    }
  }
  return selected;
}

export function getMaskedValue(flags: number, mask: number): number {
  return flags & mask;
}

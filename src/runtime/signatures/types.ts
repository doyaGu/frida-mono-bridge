export interface MonoExportSignature {
  name: string;
  retType: NativeFunctionReturnType;
  argTypes: NativeFunctionArgumentType[];
  aliases?: string[];
}

export type MonoSignatureMap = Record<string, MonoExportSignature>;

export type MonoSignatureOverrides = Record<string, Partial<MonoExportSignature>>;

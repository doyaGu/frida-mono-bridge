import { MonoApi } from "../runtime/api";
import { readUtf16String } from "../utils/string";
import { MonoObject } from "./object";

/**
 * Represents a Mono string object (System.String)
 */
export class MonoString extends MonoObject {
  /**
   * Get the length of the string in characters
   */
  get length(): number {
    return this.getLength();
  }

  /**
   * Get the length of the string in characters
   */
  getLength(): number {
    return this.native.mono_string_length(this.pointer) as number;
  }

  /**
   * Get the character at a specific index
   * @param index Character index
   * @returns Character at the index
   */
  charAt(index: number): string {
    if (index < 0 || index >= this.length) {
      throw new RangeError(`Index ${index} out of range [0, ${this.length})`);
    }
    const chars = this.native.mono_string_chars(this.pointer);
    const charPtr = chars.add(index * 2);
    return String.fromCharCode(charPtr.readU16());
  }

  /**
   * Get a substring
   * @param start Start index
   * @param length Length (optional, defaults to end of string)
   * @returns Substring
   */
  substring(start: number, length?: number): string {
    const fullStr = this.toString();
    const actualLength = length ?? fullStr.length - start;
    return fullStr.substr(start, actualLength);
  }

  /**
   * Check if the string contains a substring
   * @param search Substring to search for
   * @returns True if found
   */
  contains(search: string): boolean {
    return this.toString().includes(search);
  }

  /**
   * Check if the string starts with a prefix
   * @param prefix Prefix to check
   * @returns True if starts with prefix
   */
  startsWith(prefix: string): boolean {
    return this.toString().startsWith(prefix);
  }

  /**
   * Check if the string ends with a suffix
   * @param suffix Suffix to check
   * @returns True if ends with suffix
   */
  endsWith(suffix: string): boolean {
    return this.toString().endsWith(suffix);
  }

  /**
   * Convert the Mono string to a JavaScript string
   */
  toString(): string {
    const chars = this.native.mono_string_chars(this.pointer);
    return readUtf16String(chars, this.length);
  }

  /**
   * Create a new Mono string from a JavaScript string
   * @param api Mono API instance
   * @param value String value
   * @returns New MonoString instance
   */
  static new(api: MonoApi, value: string): MonoString {
    const pointer = api.stringNew(value);
    return new MonoString(api, pointer);
  }
}
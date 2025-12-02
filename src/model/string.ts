import { MonoApi } from "../runtime/api";
import { readUtf16String, readUtf8String } from "../utils/string";
import { pointerIsNull } from "../utils/memory";
import { MonoObject } from "./object";

/**
 * Represents a Mono string object (System.String)
 */
export class MonoString extends MonoObject {
  private _cachedString: string | null = null;

  /**
   * Get the length of the string in characters
   */
  get length(): number {
    return this.getLength();
  }

  /**
   * Get the length of the string in characters
   * Uses mono_string_length if available, otherwise gets from converted string
   */
  getLength(): number {
    if (this.api.hasExport("mono_string_length")) {
      return this.native.mono_string_length(this.pointer) as number;
    }
    // Fallback: get length from string conversion
    return this.toString().length;
  }

  /**
   * Get the character at a specific index
   * @param index Character index
   * @returns Character at the index
   */
  charAt(index: number): string {
    const str = this.toString();
    if (index < 0 || index >= str.length) {
      throw new RangeError(`Index ${index} out of range [0, ${str.length})`);
    }
    return str.charAt(index);
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
   * Uses mono_string_to_utf8 or mono_string_to_utf16, with caching
   */
  toString(): string {
    if (this._cachedString !== null) {
      return this._cachedString;
    }
    
    // Try mono_string_to_utf8 first (most reliable for Unity Mono)
    if (this.api.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(this.pointer);
      if (!pointerIsNull(utf8Ptr)) {
        this._cachedString = readUtf8String(utf8Ptr);
        this.api.tryFree(utf8Ptr);
        return this._cachedString;
      }
    }
    
    // Fallback: Try mono_string_to_utf16
    if (this.api.hasExport("mono_string_to_utf16")) {
      const utf16Ptr = this.native.mono_string_to_utf16(this.pointer);
      if (!pointerIsNull(utf16Ptr)) {
        this._cachedString = readUtf16String(utf16Ptr);
        return this._cachedString;
      }
    }
    
    // Last resort: Try mono_string_chars + mono_string_length
    if (this.api.hasExport("mono_string_chars") && this.api.hasExport("mono_string_length")) {
      const chars = this.native.mono_string_chars(this.pointer);
      const length = this.native.mono_string_length(this.pointer) as number;
      this._cachedString = readUtf16String(chars, length);
      return this._cachedString;
    }
    
    return "";
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
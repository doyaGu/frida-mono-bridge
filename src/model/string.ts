import { MonoApi } from "../runtime/api";
import { readUtf16String, readUtf8String } from "../utils/string";
import { pointerIsNull } from "../utils/memory";
import { MonoObject } from "./object";

/**
 * Summary information about a MonoString instance.
 * Provides comprehensive metadata for inspection and debugging.
 * 
 * @example
 * ```typescript
 * const summary = str.getSummary();
 * console.log(`String "${summary.preview}" has ${summary.length} characters`);
 * ```
 */
export interface MonoStringSummary {
  /** Pointer address of this string in memory */
  pointer: string;
  /** Length of the string in characters */
  length: number;
  /** Preview of the string content (first 50 chars with ellipsis if truncated) */
  preview: string;
  /** Whether the string is empty */
  isEmpty: boolean;
  /** Whether the string contains only whitespace */
  isWhitespace: boolean;
  /** Full string value */
  value: string;
}

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

  // ===== NEW STRING METHODS =====

  /**
   * Find the index of the first occurrence of a substring
   * @param search Substring to search for
   * @param start Optional start index
   * @returns Index of first occurrence, or -1 if not found
   */
  indexOf(search: string, start?: number): number {
    return this.toString().indexOf(search, start);
  }

  /**
   * Find the index of the last occurrence of a substring
   * @param search Substring to search for
   * @param start Optional start index to search backwards from
   * @returns Index of last occurrence, or -1 if not found
   */
  lastIndexOf(search: string, start?: number): number {
    return this.toString().lastIndexOf(search, start);
  }

  /**
   * Convert the string to lowercase
   * @returns Lowercase string
   */
  toLowerCase(): string {
    return this.toString().toLowerCase();
  }

  /**
   * Convert the string to uppercase
   * @returns Uppercase string
   */
  toUpperCase(): string {
    return this.toString().toUpperCase();
  }

  /**
   * Remove whitespace from both ends of the string
   * @returns Trimmed string
   */
  trim(): string {
    return this.toString().trim();
  }

  /**
   * Remove whitespace from the start of the string
   * @returns String with leading whitespace removed
   */
  trimStart(): string {
    return this.toString().trimStart();
  }

  /**
   * Remove whitespace from the end of the string
   * @returns String with trailing whitespace removed
   */
  trimEnd(): string {
    return this.toString().trimEnd();
  }

  /**
   * Split the string by a separator
   * @param separator String or RegExp to split by
   * @param limit Maximum number of splits
   * @returns Array of substrings
   */
  split(separator: string | RegExp, limit?: number): string[] {
    return this.toString().split(separator, limit);
  }

  /**
   * Replace occurrences of a search string or pattern
   * @param search String or RegExp to search for
   * @param replacement Replacement string
   * @returns String with replacements made
   */
  replace(search: string | RegExp, replacement: string): string {
    return this.toString().replace(search, replacement);
  }

  /**
   * Replace all occurrences of a search string
   * @param search String to search for
   * @param replacement Replacement string
   * @returns String with all occurrences replaced
   */
  replaceAll(search: string, replacement: string): string {
    return this.toString().split(search).join(replacement);
  }

  /**
   * Pad the start of the string to reach a target length
   * @param targetLength Target length
   * @param padString String to pad with (default: space)
   * @returns Padded string
   */
  padStart(targetLength: number, padString?: string): string {
    return this.toString().padStart(targetLength, padString);
  }

  /**
   * Pad the end of the string to reach a target length
   * @param targetLength Target length
   * @param padString String to pad with (default: space)
   * @returns Padded string
   */
  padEnd(targetLength: number, padString?: string): string {
    return this.toString().padEnd(targetLength, padString);
  }

  /**
   * Repeat the string a specified number of times
   * @param count Number of times to repeat
   * @returns Repeated string
   */
  repeat(count: number): string {
    return this.toString().repeat(count);
  }

  /**
   * Normalize the string to a specified Unicode form
   * @param form Normalization form (NFC, NFD, NFKC, NFKD)
   * @returns Normalized string
   */
  normalize(form?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD'): string {
    return this.toString().normalize(form);
  }

  /**
   * Check if the string matches a regular expression
   * @param pattern RegExp pattern to match
   * @returns Match result or null
   */
  match(pattern: RegExp): RegExpMatchArray | null {
    return this.toString().match(pattern);
  }

  /**
   * Search for a match using a regular expression
   * @param pattern RegExp pattern to search for
   * @returns Index of first match, or -1 if not found
   */
  search(pattern: RegExp): number {
    return this.toString().search(pattern);
  }

  /**
   * Get the character code at a specific index
   * @param index Character index
   * @returns UTF-16 code unit
   */
  charCodeAt(index: number): number {
    return this.toString().charCodeAt(index);
  }

  /**
   * Get the Unicode code point at a specific index
   * @param index Character index
   * @returns Unicode code point
   */
  codePointAt(index: number): number | undefined {
    return this.toString().codePointAt(index);
  }

  /**
   * Compare this string with another for sorting
   * @param other String to compare with
   * @param locales Optional locale(s)
   * @param options Optional comparison options
   * @returns Negative if this < other, positive if this > other, 0 if equal
   */
  localeCompare(other: string, locales?: string | string[], options?: Intl.CollatorOptions): number {
    return this.toString().localeCompare(other, locales, options);
  }

  /**
   * Check if the string is empty
   * @returns True if the string has length 0
   */
  isEmpty(): boolean {
    return this.getLength() === 0;
  }

  /**
   * Check if the string is null or whitespace only
   * @returns True if the string is empty or contains only whitespace
   */
  isNullOrWhitespace(): boolean {
    return this.trim() === '';
  }

  // ===== SUMMARY AND DESCRIPTION METHODS =====

  /**
   * Get comprehensive summary information about this string.
   * 
   * @returns MonoStringSummary object with all string metadata
   * 
   * @example
   * ```typescript
   * const summary = str.getSummary();
   * if (summary.isEmpty) {
   *   console.log("String is empty");
   * } else {
   *   console.log(`Content: ${summary.preview}`);
   * }
   * ```
   */
  getSummary(): MonoStringSummary {
    const value = this.toString();
    const length = value.length;
    const isEmpty = length === 0;
    const isWhitespace = value.trim() === '';
    
    // Create a preview (first 50 chars with ellipsis)
    let preview = value;
    if (length > 50) {
      preview = value.substring(0, 50) + '...';
    }
    
    return {
      pointer: this.pointer.toString(),
      length,
      preview,
      isEmpty,
      isWhitespace,
      value
    };
  }

  /**
   * Get a human-readable description of this string.
   * 
   * @returns A multi-line string with detailed string information
   * 
   * @example
   * ```typescript
   * console.log(str.describe());
   * // Output:
   * // MonoString: "Hello World"
   * //   Length: 11 characters
   * //   Pointer: 0x12345678
   * ```
   */
  describe(): string {
    const value = this.toString();
    const length = value.length;
    
    // Escape special characters for display
    let displayValue = value;
    if (length > 100) {
      displayValue = value.substring(0, 100) + '...';
    }
    displayValue = displayValue
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    
    const lines = [
      `MonoString: "${displayValue}"`,
      `  Length: ${length} characters`,
      `  Pointer: ${this.pointer}`
    ];
    
    return lines.join('\n');
  }

  /**
   * Compare two strings for equality.
   * 
   * @param other Another MonoString to compare with
   * @returns true if both strings have the same content
   * 
   * @example
   * ```typescript
   * if (str1.equals(str2)) {
   *   console.log("Strings are equal");
   * }
   * ```
   */
  stringEquals(other: MonoString | null): boolean {
    if (!other) return false;
    return this.toString() === other.toString();
  }

  /**
   * Convert the Mono string to a JavaScript string
   * Uses mono_string_to_utf8 or mono_string_to_utf16, with caching
   */
  override toString(): string {
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
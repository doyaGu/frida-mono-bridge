import type { MonoApi } from "../runtime/api";
import { lazy } from "../utils/cache";
import { MonoErrorCodes, raise } from "../utils/errors";
import { pointerIsNull } from "../utils/memory";
import { readUtf16String, readUtf8String } from "../utils/string";
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
 * Represents a Mono string object (System.String).
 *
 * Implements `Iterable<string>` for character-by-character iteration,
 * enabling use with `for...of` loops and spread operator.
 *
 * @example
 * ```typescript
 * const str = MonoString.new(api, "Hello");
 *
 * // Basic usage
 * console.log(str.length);    // 5
 * console.log(str.content);   // "Hello"
 *
 * // Iterate over characters
 * for (const char of str) {
 *   console.log(char);
 * }
 *
 * // Use spread operator
 * const chars = [...str]; // ['H', 'e', 'l', 'l', 'o']
 *
 * // String manipulation
 * console.log(str.toUpperCase()); // "HELLO"
 * console.log(str.includes("ell")); // true
 * ```
 */
export class MonoString extends MonoObject implements Iterable<string> {
  // ===== CORE PROPERTIES =====

  /**
   * Get the length of the string in characters.
   * Uses mono_string_length if available, otherwise gets from converted string.
   * Value is cached on first access.
   */
  @lazy
  get length(): number {
    if (this.api.hasExport("mono_string_length")) {
      return this.native.mono_string_length(this.pointer) as number;
    }
    // Fallback: get length from string conversion
    return this.content.length;
  }

  /**
   * Get the string content as a JavaScript string.
   * Uses mono_string_to_utf8 or mono_string_to_utf16.
   * Value is cached on first access.
   *
   * Memory management:
   * - mono_string_to_utf8: returns heap-allocated buffer, freed after read
   * - mono_string_to_utf16: returns heap-allocated buffer, freed after read
   * - mono_string_chars: returns pointer into managed object, NOT freed
   */
  @lazy
  get content(): string {
    // Try mono_string_to_utf8 first (most reliable for Unity Mono)
    // Note: mono_string_to_utf8 allocates memory that must be freed
    if (this.api.hasExport("mono_string_to_utf8")) {
      const utf8Ptr = this.native.mono_string_to_utf8(this.pointer);
      if (!pointerIsNull(utf8Ptr)) {
        try {
          return readUtf8String(utf8Ptr);
        } finally {
          this.api.tryFree(utf8Ptr);
        }
      }
    }

    // Fallback: Try mono_string_to_utf16
    // Note: mono_string_to_utf16 allocates memory that must be freed
    if (this.api.hasExport("mono_string_to_utf16")) {
      const utf16Ptr = this.native.mono_string_to_utf16(this.pointer);
      if (!pointerIsNull(utf16Ptr)) {
        try {
          return readUtf16String(utf16Ptr);
        } finally {
          this.api.tryFree(utf16Ptr);
        }
      }
    }

    // Last resort: Try mono_string_chars + mono_string_length
    // Note: mono_string_chars returns a pointer INTO the managed string object
    // This is NOT heap-allocated, do NOT free it
    if (this.api.hasExport("mono_string_chars") && this.api.hasExport("mono_string_length")) {
      const chars = this.native.mono_string_chars(this.pointer);
      const len = this.native.mono_string_length(this.pointer) as number;
      return readUtf16String(chars, len);
    }

    return "";
  }

  // ===== TYPE CHECKS =====

  /**
   * Check if the string is empty (length === 0).
   */
  @lazy
  get isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Check if the string is not empty (length > 0).
   */
  @lazy
  get isNotEmpty(): boolean {
    return this.length > 0;
  }

  /**
   * Check if the string is null or whitespace only.
   */
  @lazy
  get isNullOrWhitespace(): boolean {
    return this.trim() === "";
  }

  // ===== CHARACTER ACCESS =====

  /**
   * Get the character at a specific index.
   * @param index Character index (0-based)
   * @returns Character at the index
   * @throws {MonoValidationError} If index is out of bounds
   *
   * @example
   * ```typescript
   * const str = MonoString.new(api, "Hello");
   * console.log(str.charAt(0)); // "H"
   * console.log(str.charAt(4)); // "o"
   * ```
   */
  charAt(index: number): string {
    const str = this.content;
    if (index < 0 || index >= str.length) {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Index ${index} out of range [0, ${str.length})`,
        "Use a valid index within the string bounds",
      );
    }
    return str.charAt(index);
  }

  /**
   * Try to get the character at a specific index without throwing.
   * @param index Character index (0-based)
   * @returns Character at the index, or undefined if out of bounds
   *
   * @example
   * ```typescript
   * const char = str.tryCharAt(10);
   * if (char !== undefined) {
   *   console.log(char);
   * }
   * ```
   */
  tryCharAt(index: number): string | undefined {
    const str = this.content;
    if (index < 0 || index >= str.length) {
      return undefined;
    }
    return str.charAt(index);
  }

  /**
   * Get the UTF-16 code unit at a specific index.
   * @param index Character index (0-based)
   * @returns UTF-16 code unit value
   *
   * @example
   * ```typescript
   * console.log(str.charCodeAt(0)); // 72 for 'H'
   * ```
   */
  charCodeAt(index: number): number {
    return this.content.charCodeAt(index);
  }

  /**
   * Get the Unicode code point at a specific index.
   * @param index Character index (0-based)
   * @returns Unicode code point, or undefined if out of bounds
   *
   * @example
   * ```typescript
   * console.log(str.codePointAt(0)); // 72 for 'H'
   * ```
   */
  codePointAt(index: number): number | undefined {
    return this.content.codePointAt(index);
  }

  // ===== SEARCH METHODS =====

  /**
   * Check if the string contains a substring.
   * @param search Substring to search for
   * @returns True if found
   *
   * @example
   * ```typescript
   * str.contains("ell"); // true for "Hello"
   * ```
   */
  contains(search: string): boolean {
    return this.content.includes(search);
  }

  /**
   * Alias for contains() - check if string includes a substring.
   * @param search Substring to search for
   * @param position Optional position to start searching from
   * @returns True if found
   */
  includes(search: string, position?: number): boolean {
    return this.content.includes(search, position);
  }

  /**
   * Check if the string starts with a prefix.
   * @param prefix Prefix to check
   * @param position Optional position to start checking from
   * @returns True if starts with prefix
   */
  startsWith(prefix: string, position?: number): boolean {
    return this.content.startsWith(prefix, position);
  }

  /**
   * Check if the string ends with a suffix.
   * @param suffix Suffix to check
   * @param endPosition Optional end position
   * @returns True if ends with suffix
   */
  endsWith(suffix: string, endPosition?: number): boolean {
    return this.content.endsWith(suffix, endPosition);
  }

  /**
   * Find the index of the first occurrence of a substring.
   * @param search Substring to search for
   * @param position Optional start position
   * @returns Index of first occurrence, or -1 if not found
   */
  indexOf(search: string, position?: number): number {
    return this.content.indexOf(search, position);
  }

  /**
   * Find the index of the last occurrence of a substring.
   * @param search Substring to search for
   * @param position Optional position to search backwards from
   * @returns Index of last occurrence, or -1 if not found
   */
  lastIndexOf(search: string, position?: number): number {
    return this.content.lastIndexOf(search, position);
  }

  /**
   * Check if the string matches a regular expression.
   * @param pattern RegExp pattern to match
   * @returns Match result or null
   */
  match(pattern: RegExp): RegExpMatchArray | null {
    return this.content.match(pattern);
  }

  /**
   * Match all occurrences of a regular expression.
   * @param pattern RegExp pattern with global flag
   * @returns Iterator of all matches
   */
  matchAll(pattern: RegExp): IterableIterator<RegExpMatchArray> {
    return this.content.matchAll(pattern);
  }

  /**
   * Search for a match using a regular expression.
   * @param pattern RegExp pattern to search for
   * @returns Index of first match, or -1 if not found
   */
  search(pattern: RegExp): number {
    return this.content.search(pattern);
  }

  // ===== TRANSFORMATION METHODS =====

  /**
   * Convert the string to lowercase.
   * @returns Lowercase string
   */
  toLowerCase(): string {
    return this.content.toLowerCase();
  }

  /**
   * Convert the string to uppercase.
   * @returns Uppercase string
   */
  toUpperCase(): string {
    return this.content.toUpperCase();
  }

  /**
   * Convert the string to locale-aware lowercase.
   * @param locales Optional locale(s)
   * @returns Lowercase string
   */
  toLocaleLowerCase(locales?: string | string[]): string {
    return this.content.toLocaleLowerCase(locales);
  }

  /**
   * Convert the string to locale-aware uppercase.
   * @param locales Optional locale(s)
   * @returns Uppercase string
   */
  toLocaleUpperCase(locales?: string | string[]): string {
    return this.content.toLocaleUpperCase(locales);
  }

  /**
   * Remove whitespace from both ends of the string.
   * @returns Trimmed string
   */
  trim(): string {
    return this.content.trim();
  }

  /**
   * Remove whitespace from the start of the string.
   * @returns String with leading whitespace removed
   */
  trimStart(): string {
    return this.content.trimStart();
  }

  /**
   * Remove whitespace from the end of the string.
   * @returns String with trailing whitespace removed
   */
  trimEnd(): string {
    return this.content.trimEnd();
  }

  /**
   * Pad the start of the string to reach a target length.
   * @param targetLength Target length
   * @param padString String to pad with (default: space)
   * @returns Padded string
   */
  padStart(targetLength: number, padString?: string): string {
    return this.content.padStart(targetLength, padString);
  }

  /**
   * Pad the end of the string to reach a target length.
   * @param targetLength Target length
   * @param padString String to pad with (default: space)
   * @returns Padded string
   */
  padEnd(targetLength: number, padString?: string): string {
    return this.content.padEnd(targetLength, padString);
  }

  /**
   * Repeat the string a specified number of times.
   * @param count Number of times to repeat
   * @returns Repeated string
   */
  repeat(count: number): string {
    return this.content.repeat(count);
  }

  /**
   * Normalize the string to a specified Unicode form.
   * @param form Normalization form (NFC, NFD, NFKC, NFKD)
   * @returns Normalized string
   */
  normalize(form?: "NFC" | "NFD" | "NFKC" | "NFKD"): string {
    return this.content.normalize(form);
  }

  // ===== EXTRACTION METHODS =====

  /**
   * Get a substring (C# semantics).
   * @param start Start index
   * @param length Length of substring (optional, defaults to end of string)
   * @returns Substring
   */
  substring(start: number, length?: number): string {
    if (length === undefined) {
      return this.content.substring(start);
    }
    return this.content.substring(start, start + length);
  }

  /**
   * Extract a section of the string (supports negative indices).
   * @param start Start index (can be negative)
   * @param end End index (optional, can be negative)
   * @returns Extracted section
   */
  slice(start?: number, end?: number): string {
    return this.content.slice(start, end);
  }

  /**
   * Split the string by a separator.
   * @param separator String or RegExp to split by
   * @param limit Maximum number of splits
   * @returns Array of substrings
   */
  split(separator: string | RegExp, limit?: number): string[] {
    return this.content.split(separator, limit);
  }

  // ===== REPLACEMENT METHODS =====

  /**
   * Replace the first occurrence of a search string or pattern.
   * @param search String or RegExp to search for
   * @param replacement Replacement string
   * @returns String with replacement made
   */
  replace(search: string | RegExp, replacement: string): string {
    return this.content.replace(search, replacement);
  }

  /**
   * Replace all occurrences of a search string.
   * @param search String to search for
   * @param replacement Replacement string
   * @returns String with all occurrences replaced
   */
  replaceAll(search: string, replacement: string): string {
    return this.content.split(search).join(replacement);
  }

  // ===== COMPARISON METHODS =====

  /**
   * Compare this string with another for sorting.
   * @param other String to compare with
   * @param locales Optional locale(s)
   * @param options Optional comparison options
   * @returns Negative if this < other, positive if this > other, 0 if equal
   */
  localeCompare(other: string, locales?: string | string[], options?: Intl.CollatorOptions): number {
    return this.content.localeCompare(other, locales, options);
  }

  /**
   * Compare two strings for equality.
   * @param other Another MonoString or JavaScript string to compare with
   * @returns true if both strings have the same content
   *
   * @example
   * ```typescript
   * if (str1.stringEquals(str2)) {
   *   console.log("Strings are equal");
   * }
   * ```
   */
  stringEquals(other: MonoString | string | null): boolean {
    if (other === null) return false;
    const otherContent = other instanceof MonoString ? other.content : other;
    return this.content === otherContent;
  }

  /**
   * Compare two strings for equality (case-insensitive).
   * @param other Another MonoString or JavaScript string to compare with
   * @returns true if both strings have the same content (ignoring case)
   */
  equalsIgnoreCase(other: MonoString | string | null): boolean {
    if (other === null) return false;
    const otherContent = other instanceof MonoString ? other.content : other;
    return this.content.toLowerCase() === otherContent.toLowerCase();
  }

  // ===== CONCATENATION =====

  /**
   * Concatenate this string with other strings.
   * @param strings Strings to concatenate
   * @returns Concatenated string
   */
  concat(...strings: string[]): string {
    return this.content.concat(...strings);
  }

  // ===== ITERATION SUPPORT =====

  /**
   * Make the string iterable character by character.
   *
   * Enables use with `for...of` loops and spread operator.
   *
   * @yields Each character in the string
   *
   * @example
   * ```typescript
   * // Iterate over characters
   * for (const char of str) {
   *   console.log(char);
   * }
   *
   * // Convert to character array
   * const chars = [...str];
   *
   * // Use with Array.from
   * const charArray = Array.from(str);
   * ```
   */
  *[Symbol.iterator](): IterableIterator<string> {
    const content = this.content;
    for (let i = 0; i < content.length; i++) {
      yield content[i];
    }
  }

  /**
   * Returns an iterator over the character indices.
   * @yields Each index in the string (0 to length-1)
   *
   * @example
   * ```typescript
   * for (const index of str.keys()) {
   *   console.log(index, str.charAt(index));
   * }
   * ```
   */
  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.length; i++) {
      yield i;
    }
  }

  /**
   * Returns an iterator over the characters.
   * @yields Each character in the string
   */
  *values(): IterableIterator<string> {
    yield* this[Symbol.iterator]();
  }

  /**
   * Returns an iterator over [index, character] pairs.
   * @yields Each [index, character] pair
   *
   * @example
   * ```typescript
   * for (const [index, char] of str.entries()) {
   *   console.log(`${index}: ${char}`);
   * }
   * ```
   */
  *entries(): IterableIterator<[number, string]> {
    const content = this.content;
    for (let i = 0; i < content.length; i++) {
      yield [i, content[i]];
    }
  }

  // ===== CONVERSION METHODS =====

  /**
   * Convert to a character array.
   * @returns Array of single characters
   *
   * @example
   * ```typescript
   * const chars = str.toCharArray(); // ['H', 'e', 'l', 'l', 'o']
   * ```
   */
  toCharArray(): string[] {
    return [...this];
  }

  /**
   * Returns the primitive string value.
   * Enables implicit string conversion.
   */
  valueOf(): string {
    return this.content;
  }

  /**
   * Get a JSON-friendly representation of this string.
   * @returns The string content
   */
  toJSON(): string {
    return this.content;
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
    const value = this.content;
    const length = value.length;
    const isEmpty = length === 0;
    const isWhitespace = value.trim() === "";

    // Create a preview (first 50 chars with ellipsis)
    let preview = value;
    if (length > 50) {
      preview = value.substring(0, 50) + "...";
    }

    return {
      pointer: this.pointer.toString(),
      length,
      preview,
      isEmpty,
      isWhitespace,
      value,
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
    const value = this.content;
    const length = value.length;

    // Escape special characters for display
    let displayValue = value;
    if (length > 100) {
      displayValue = value.substring(0, 100) + "...";
    }
    displayValue = displayValue
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    const lines = [`MonoString: "${displayValue}"`, `  Length: ${length} characters`, `  Pointer: ${this.pointer}`];

    return lines.join("\n");
  }

  // ===== UTILITY METHODS =====

  /**
   * Convert the Mono string to a JavaScript string.
   * Delegates to the cached content property.
   */
  override toString(): string {
    return this.content;
  }

  // ===== STATIC FACTORY METHODS =====

  /**
   * Create a new Mono string from a JavaScript string.
   * @param api Mono API instance
   * @param value String value
   * @returns New MonoString instance
   *
   * @example
   * ```typescript
   * const str = MonoString.new(api, "Hello World");
   * ```
   */
  static new(api: MonoApi, value: string): MonoString {
    const pointer = api.stringNew(value);
    return new MonoString(api, pointer);
  }
}

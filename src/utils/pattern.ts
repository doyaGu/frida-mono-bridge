import { MonoErrorCodes, raise } from "./errors";

/**
 * Options for converting wildcard/regex patterns into matchers.
 */
export interface PatternMatchOptions {
  /** Use regex pattern instead of wildcard */
  regex?: boolean;
  /** Case insensitive matching (default: true) */
  caseInsensitive?: boolean;
}

export function wildcardToRegex(pattern: string, caseInsensitive = true): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

export function createMatcher(pattern: string, options: PatternMatchOptions = {}): RegExp {
  const caseInsensitive = options.caseInsensitive !== false;

  if (options.regex) {
    try {
      return new RegExp(pattern, caseInsensitive ? "i" : "");
    } catch {
      raise(
        MonoErrorCodes.INVALID_ARGUMENT,
        `Invalid regex pattern: ${pattern}`,
        "Check the regex syntax and try again",
      );
    }
  }

  return wildcardToRegex(pattern, caseInsensitive);
}

export function matchesPattern(name: string, pattern: string, options: PatternMatchOptions = {}): boolean {
  if (pattern === "*" || pattern === "") {
    return true;
  }

  const regex = createMatcher(pattern, options);
  return regex.test(name);
}

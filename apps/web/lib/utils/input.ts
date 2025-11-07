/**
 * Helper function to escape regex special characters
 * This is used to safely test user input against regex patterns
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex pattern for valid numeric input (supports integers and decimals)
 * Matches escaped "." characters in a non-capturing group
 * After escaping, "1.5" becomes "1\.5", which this regex will match
 */
const NUMERIC_INPUT_REGEX = /^\d*(?:\\[.])?\d*$/;

/**
 * Check if input has more decimals than allowed
 */
function hasExcessDecimals(value: string, maxDecimals?: number): boolean {
  if (!maxDecimals) return false;
  const parts = value.split('.');
  return parts.length > 1 && parts[1].length > maxDecimals;
}

/**
 * Validates if a string is a valid numeric input for token amounts
 * Based on Uniswap's implementation with strict validation
 *
 * @param value - The input string to validate
 * @param options - Configuration options
 * @returns true if the input is valid, false otherwise
 */
export const isValidNumericInput = (
  value: string,
  options: { maxDecimals?: number } = {}
): boolean => {
  const { maxDecimals = 18 } = options;

  // Always allow empty string (clearing input)
  if (value === "") return true;

  // Always allow single decimal point (user is typing)
  if (value === ".") return true;

  // Test against regex pattern using escaped input
  if (!NUMERIC_INPUT_REGEX.test(escapeRegExp(value))) {
    return false;
  }

  // Check if decimals exceed maximum
  if (hasExcessDecimals(value, maxDecimals)) {
    return false;
  }

  return true;
};

/**
 * Normalizes numeric input by removing leading zeros and cleaning up the format
 * Based on Uniswap's approach to ensure consistent number formatting
 *
 * @param value - The input string to normalize
 * @returns normalized string
 */
export const normalizeNumericInput = (value: string): string => {
  // Handle empty string
  if (value === "" || value === ".") return value;

  // Handle decimal point at start (e.g., ".5" should remain ".5")
  if (value.startsWith(".")) {
    return value;
  }

  // Remove leading zeros, but preserve single "0" before decimal point
  // "007" -> "7", "0.5" -> "0.5", "00.5" -> "0.5", "0" -> "0"
  if (value.startsWith("0") && value.length > 1 && value[1] !== ".") {
    // Remove all leading zeros
    const withoutLeadingZeros = value.replace(/^0+/, "");
    // If everything was zeros, return "0"
    return withoutLeadingZeros === "" ? "0" : withoutLeadingZeros;
  }

  return value;
};

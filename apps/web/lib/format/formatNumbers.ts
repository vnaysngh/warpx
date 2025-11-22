/**
 * Number formatting utilities following Uniswap's approach
 * Uses native Intl.NumberFormat for locale-aware, consistent formatting
 */

export enum NumberType {
  // Token amounts in transactions (swaps, liquidity)
  TokenTx = 'token-tx',
  // Token amounts for display (balances, prices)
  TokenNonTx = 'token-non-tx',
  // LP token amounts
  LPToken = 'lp-token',
  // Fiat currency amounts
  FiatTokenPrice = 'fiat-token-price',
  // Percentages
  Percentage = 'percentage',
}

interface FormatterRule {
  exact?: number;
  upperBound?: number;
  hardCodedOutput?: string;
  formatter: Intl.NumberFormat;
  overrideValue?: number;
  prefix?: string;
}

// Intl.NumberFormat configurations
const configs = {
  // For very small numbers - show up to 8 decimals
  EightDecimals: {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  },
  // For small numbers - show up to 6 significant figures
  SixSigFigs: {
    minimumSignificantDigits: 1,
    maximumSignificantDigits: 6,
  },
  // For token amounts - 2-5 decimals
  TwoToFiveDecimals: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  },
  // For standard token display - up to 3 decimals
  ThreeDecimals: {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  },
  // For standard amounts - 2 decimals
  TwoDecimals: {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  },
  // For percentages - 2 decimals
  PercentageDecimals: {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    style: 'percent' as const,
  },
};

// Create formatters
const formatters: Record<string, Intl.NumberFormat> = {};
Object.entries(configs).forEach(([key, config]) => {
  formatters[key] = new Intl.NumberFormat('en-US', config);
});

// Formatting rules for each NumberType
const formattingRules: Record<NumberType, FormatterRule[]> = {
  [NumberType.TokenTx]: [
    { exact: 0, hardCodedOutput: '0', formatter: formatters.TwoDecimals },
    {
      upperBound: 0.00001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.00001,
      prefix: '< ',
    },
    { upperBound: 1, formatter: formatters.TwoToFiveDecimals },
    { upperBound: 1e6, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals }, // default
  ],
  [NumberType.TokenNonTx]: [
    { exact: 0, hardCodedOutput: '0', formatter: formatters.TwoDecimals },
    {
      upperBound: 0.001,
      formatter: formatters.ThreeDecimals,
      overrideValue: 0.001,
      prefix: '< ',
    },
    { upperBound: 1, formatter: formatters.ThreeDecimals },
    { upperBound: 1e6, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals }, // default
  ],
  [NumberType.LPToken]: [
    { exact: 0, hardCodedOutput: '0', formatter: formatters.TwoDecimals },
    {
      upperBound: 0.000001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.000001,
      prefix: '< ',
    },
    { upperBound: 0.01, formatter: formatters.EightDecimals },
    { upperBound: 1, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals }, // default
  ],
  [NumberType.FiatTokenPrice]: [
    { exact: 0, hardCodedOutput: '$0.00', formatter: formatters.TwoDecimals },
    {
      upperBound: 0.00000001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.00000001,
      prefix: '< $',
    },
    { upperBound: 0.1, formatter: formatters.SixSigFigs, prefix: '$' },
    { upperBound: 1e6, formatter: formatters.TwoDecimals, prefix: '$' },
    { formatter: formatters.TwoDecimals, prefix: '$' }, // default
  ],
  [NumberType.Percentage]: [
    { exact: 0, hardCodedOutput: '0%', formatter: formatters.PercentageDecimals },
    { formatter: formatters.PercentageDecimals },
  ],
};

function getRuleForValue(value: number, type: NumberType): FormatterRule {
  const rules = formattingRules[type];

  // Check for exact match
  const exactRule = rules.find((rule) => rule.exact === value);
  if (exactRule) return exactRule;

  // Find first rule where value is below upperBound
  const boundRule = rules.find((rule) => rule.upperBound && value < rule.upperBound);
  if (boundRule) return boundRule;

  // Return default rule (last one without upperBound)
  return rules[rules.length - 1];
}

export interface FormatNumberOptions {
  input: number | string | null | undefined;
  type?: NumberType;
  placeholder?: string;
}

/**
 * Format a number for display following Uniswap's patterns
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatNumber({
  input,
  type = NumberType.TokenNonTx,
  placeholder = '-',
}: FormatNumberOptions): string {
  if (input === null || input === undefined || input === '') {
    return placeholder;
  }

  const numericValue = typeof input === 'string' ? parseFloat(input) : input;

  if (isNaN(numericValue)) {
    return placeholder;
  }

  const rule = getRuleForValue(Math.abs(numericValue), type);

  // Handle hard-coded outputs (like exact 0)
  if (rule.hardCodedOutput !== undefined && numericValue === (rule.exact ?? 0)) {
    return rule.hardCodedOutput;
  }

  // Format the value (or override value for "< X" pattern)
  const valueToFormat = rule.overrideValue !== undefined ? rule.overrideValue : Math.abs(numericValue);
  let formattedValue = rule.formatter.format(valueToFormat);

  // Add prefix if needed (e.g., "< " or "$")
  if (rule.prefix) {
    formattedValue = rule.prefix + formattedValue;
  }

  // Handle negative numbers
  if (numericValue < 0 && !rule.prefix) {
    formattedValue = '-' + formattedValue;
  }

  return formattedValue;
}

/**
 * Format a token amount from wei/base units
 * @param value - Value in base units (wei)
 * @param decimals - Token decimals
 * @param type - Number type for formatting
 * @returns Formatted string
 */
export function formatTokenAmount(
  value: bigint | null | undefined,
  decimals: number,
  type: NumberType = NumberType.TokenNonTx
): string {
  if (value === null || value === undefined) {
    return '-';
  }

  // Convert to decimal string manually to preserve precision
  const valueStr = value.toString();
  const isNegative = valueStr.startsWith('-');
  const absStr = isNegative ? valueStr.slice(1) : valueStr;

  // Pad with zeros if needed
  const paddedStr = absStr.padStart(decimals + 1, '0');

  // Split into whole and fractional parts
  const whole = paddedStr.slice(0, -decimals) || '0';
  const fraction = paddedStr.slice(-decimals);

  // Construct decimal string
  const decimalStr = fraction ? `${whole}.${fraction}` : whole;
  const finalStr = isNegative ? `-${decimalStr}` : decimalStr;

  return formatNumber({ input: finalStr, type });
}

/**
 * Format a percentage value
 * @param value - Percentage value (0-100)
 * @returns Formatted string with % symbol
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  // Intl percentage formatter expects 0-1 range, so divide by 100
  return formatNumber({ input: value / 100, type: NumberType.Percentage });
}

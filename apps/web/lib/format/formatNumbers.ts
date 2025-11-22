/**
 * Number formatting utilities following Uniswap's approach
 * Uses native Intl.NumberFormat for locale-aware, consistent formatting
 */

export enum NumberType {
  // Token amounts in transactions (swaps, liquidity)
  TokenTx = "token-tx",
  // Token amounts for display (balances, prices)
  TokenNonTx = "token-non-tx",
  // LP token amounts
  LPToken = "lp-token",
  // Fiat currency amounts
  FiatTokenPrice = "fiat-token-price",
  // Percentages
  Percentage = "percentage"
}

type FormatCreator = (locale: string) => Intl.NumberFormat;

interface FormatterRule {
  exact?: number;
  upperBound?: number;
  hardCodedOutput?: string;
  formatter: FormatCreator;
  overrideValue?: number;
  prefix?: string;
}

const numberFormatCache: Record<string, Intl.NumberFormat> = {};

const createFormatter = (
  name: string,
  options: Intl.NumberFormatOptions
): FormatCreator => {
  return (locale: string) => {
    const cacheKey = `${locale}-${name}`;
    if (!numberFormatCache[cacheKey]) {
      numberFormatCache[cacheKey] = new Intl.NumberFormat(locale, options);
    }
    return numberFormatCache[cacheKey];
  };
};

// Intl.NumberFormat configurations
const formatters = {
  // For very small numbers - show up to 8 decimals
  EightDecimals: createFormatter("EightDecimals", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: false
  }),
  // For small numbers - show up to 6 significant figures
  SixSigFigs: createFormatter("SixSigFigs", {
    minimumSignificantDigits: 1,
    maximumSignificantDigits: 6,
    useGrouping: false
  }),
  // For token amounts - 2-5 decimals
  TwoToFiveDecimals: createFormatter("TwoToFiveDecimals", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
    useGrouping: false
  }),
  // For standard token display - up to 3 decimals
  ThreeDecimals: createFormatter("ThreeDecimals", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: false
  }),
  // For standard amounts - 2 decimals
  TwoDecimals: createFormatter("TwoDecimals", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false
  }),
  // For percentages - 2 decimals
  PercentageDecimals: createFormatter("PercentageDecimals", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    style: "percent"
  })
};

// Formatting rules for each NumberType
const formattingRules: Record<NumberType, FormatterRule[]> = {
  [NumberType.TokenTx]: [
    { exact: 0, hardCodedOutput: "0", formatter: formatters.TwoDecimals },
    {
      upperBound: 0.00001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.00001,
      prefix: "< "
    },
    { upperBound: 1, formatter: formatters.TwoToFiveDecimals },
    { upperBound: 1e6, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals } // default
  ],
  [NumberType.TokenNonTx]: [
    { exact: 0, hardCodedOutput: "0", formatter: formatters.TwoDecimals },
    {
      upperBound: 0.001,
      formatter: formatters.ThreeDecimals,
      overrideValue: 0.001,
      prefix: "< "
    },
    { upperBound: 1, formatter: formatters.ThreeDecimals },
    { upperBound: 1e6, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals } // default
  ],
  [NumberType.LPToken]: [
    { exact: 0, hardCodedOutput: "0", formatter: formatters.TwoDecimals },
    {
      upperBound: 0.000001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.000001,
      prefix: "< "
    },
    { upperBound: 0.01, formatter: formatters.EightDecimals },
    { upperBound: 1, formatter: formatters.SixSigFigs },
    { formatter: formatters.TwoDecimals } // default
  ],
  [NumberType.FiatTokenPrice]: [
    { exact: 0, hardCodedOutput: "$0.00", formatter: formatters.TwoDecimals },
    {
      upperBound: 0.00000001,
      formatter: formatters.EightDecimals,
      overrideValue: 0.00000001,
      prefix: "< $"
    },
    { upperBound: 0.1, formatter: formatters.SixSigFigs, prefix: "$" },
    { upperBound: 1e6, formatter: formatters.TwoDecimals, prefix: "$" },
    { formatter: formatters.TwoDecimals, prefix: "$" } // default
  ],
  [NumberType.Percentage]: [
    {
      exact: 0,
      hardCodedOutput: "0%",
      formatter: formatters.PercentageDecimals
    },
    { formatter: formatters.PercentageDecimals }
  ]
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
  locale?: string;
}

/**
 * Format a number for display following Uniswap's patterns
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatNumber({
  input,
  type = NumberType.TokenNonTx,
  placeholder = "-",
  locale = "en-US"
}: FormatNumberOptions): string {
  if (input === null || input === undefined || input === "") {
    return placeholder;
  }

  const numericValue = typeof input === "string" ? parseFloat(input) : input;

  if (Number.isNaN(numericValue)) {
    return placeholder;
  }

  const rule = getRuleForValue(Math.abs(numericValue), type);

  // Handle hard-coded outputs (like exact 0)
  if (rule.hardCodedOutput !== undefined && numericValue === (rule.exact ?? 0)) {
    return rule.prefix ? `${rule.prefix}${rule.hardCodedOutput}` : rule.hardCodedOutput;
  }

  // Format the value (or override value for "< X" pattern)
  const valueToFormat =
    rule.overrideValue !== undefined ? rule.overrideValue : Math.abs(numericValue);
  let formattedValue = rule.formatter(locale).format(valueToFormat);

  // Add prefix if needed (e.g., "< " or "$")
  if (rule.prefix) {
    formattedValue = rule.prefix + formattedValue;
  }

  // Handle negative numbers (prefixes already include sign semantics)
  if (numericValue < 0 && !rule.prefix) {
    formattedValue = `-${formattedValue}`;
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
  type: NumberType = NumberType.TokenNonTx,
  locale = "en-US"
): string {
  if (value === null || value === undefined) {
    return "-";
  }

  const valueStr = value.toString();
  const isNegative = valueStr.startsWith("-");
  const absStr = isNegative ? valueStr.slice(1) : valueStr;

  const paddedStr = absStr.padStart(decimals + 1, "0");

  const whole = paddedStr.slice(0, -decimals) || "0";
  const fraction = paddedStr.slice(-decimals);

  const decimalStr = fraction ? `${whole}.${fraction}` : whole;
  const finalStr = isNegative ? `-${decimalStr}` : decimalStr;

  return formatNumber({ input: finalStr, type, locale });
}

/**
 * Format a percentage value
 * @param value - Percentage value (0-100)
 * @returns Formatted string with % symbol
 */
export function formatPercent(
  value: number | null | undefined,
  locale = "en-US"
): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatNumber({
    input: value / 100,
    type: NumberType.Percentage,
    locale
  });
}

export function formatNumberWithGrouping(
  value: number | string | null | undefined,
  maxDecimals = 2,
  locale = "en-US"
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  }).format(numericValue);
}

export function formatCompactNumber(
  value: number | string | null | undefined,
  maxDecimals = 2,
  locale = "en-US"
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(numericValue)) {
    return "-";
  }

  return new Intl.NumberFormat(locale, {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  }).format(numericValue);
}

export function formatBalanceDisplay(value: string | null, locale = "en-US") {
  if (value === null) {
    return "—";
  }
  return formatNumber({ input: value, locale, placeholder: "—" });
}

export function formatTokenBalance(
  balance: bigint | null | undefined,
  decimals: number,
  locale = "en-US"
): string {
  if (!balance) {
    return "0";
  }

  return formatTokenAmount(balance, decimals, NumberType.TokenNonTx, locale);
}

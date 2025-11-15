import {
  DEFAULT_SLIPPAGE_BPS,
  FEES_DENOMINATOR,
  FEES_NUMERATOR,
  MINIMUM_LIQUIDITY,
  ONE_BIPS
} from "./constants";

const sqrtBigInt = (value: bigint): bigint => {
  if (value < 0n) {
    throw new Error("square root of negative numbers is not supported");
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value;
  let x1 = (x0 + value / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) >> 1n;
  }
  return x0;
};

/**
 * Format numbers with smart decimal handling (Warp AMM style)
 * - Strips trailing zeros
 * - Shows appropriate precision based on magnitude
 */
export const formatNumber = (
  value: string | number,
  maxDecimals: number = 6
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "0";

  // For very small numbers, show more decimals
  if (num > 0 && num < 0.0001) {
    return num.toFixed(8).replace(/\.?0+$/, "");
  }

  // For percentage values close to 100
  if (num >= 99.99 && num <= 100) {
    return "100";
  }

  // For regular numbers, use maxDecimals and strip trailing zeros
  return num.toFixed(maxDecimals).replace(/\.?0+$/, "");
};

export const formatNumberWithGrouping = (
  value: string | number,
  maxDecimals: number = 2
): string => {
  const raw = formatNumber(value, maxDecimals);
  if (raw.includes("e") || raw.includes("E")) {
    return raw;
  }

  const [integerPart, fractionalPart] = raw.split(".");
  const grouped = Number(integerPart).toLocaleString("en-US");
  return fractionalPart ? `${grouped}.${fractionalPart}` : grouped;
};

/**
 * Format large numbers with abbreviations (K, M, B, T)
 * Perfect for stat cards and compact displays
 */
export const formatCompactNumber = (
  value: string | number,
  maxDecimals: number = 2
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num) || num === 0) return "0";

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  // Billions
  if (absNum >= 1_000_000_000) {
    const billions = absNum / 1_000_000_000;
    return `${sign}${billions.toFixed(maxDecimals).replace(/\.?0+$/, "")}B`;
  }

  // Millions
  if (absNum >= 1_000_000) {
    const millions = absNum / 1_000_000;
    return `${sign}${millions.toFixed(maxDecimals).replace(/\.?0+$/, "")}M`;
  }

  // Thousands
  if (absNum >= 10_000) {
    const thousands = absNum / 1_000;
    return `${sign}${thousands.toFixed(maxDecimals).replace(/\.?0+$/, "")}K`;
  }

  // Regular numbers under 10K - use grouping
  return formatNumberWithGrouping(num, maxDecimals);
};

/**
 * Format percentage values (0-100)
 */
export const formatPercent = (
  value: string | number,
  maxDecimals: number = 4
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "0";

  // If it's 100 or very close, just show 100
  if (num >= 99.99) return "100";

  // If it's very small, show more precision
  if (num > 0 && num < 0.01) {
    return num.toFixed(6).replace(/\.?0+$/, "");
  }

  // Otherwise use provided decimals and strip trailing zeros
  return num.toFixed(maxDecimals).replace(/\.?0+$/, "");
};

/**
 * Calculate output amount for a swap using Warp V2 constant product formula
 * Formula: outputAmount = (inputAmount * FEES_NUMERATOR * reserveOut) /
 *          (FEES_DENOMINATOR * reserveIn + inputAmount * FEES_NUMERATOR)
 * This accounts for the 0.3% Warp fee applied to input
 */
export const getSwapOutputAmount = (
  inputAmountWei: bigint,
  reserveInWei: bigint,
  reserveOutWei: bigint
): bigint => {
  if (inputAmountWei <= 0n || reserveInWei <= 0n || reserveOutWei <= 0n) {
    return 0n;
  }

  const inputWithFee = inputAmountWei * FEES_NUMERATOR;
  const numerator = inputWithFee * reserveOutWei;
  const denominator = reserveInWei * FEES_DENOMINATOR + inputWithFee;

  return numerator / denominator;
};

/**
 * Calculate input amount needed to get desired output (reverse calculation)
 * Formula: inputAmount = (FEES_DENOMINATOR * reserveIn * outputAmount) /
 *          (FEES_NUMERATOR * (reserveOut - outputAmount)) + 1
 * The +1 ensures slippage protection by rounding up
 */
export const getSwapInputAmount = (
  outputAmountWei: bigint,
  reserveInWei: bigint,
  reserveOutWei: bigint
): bigint => {
  if (outputAmountWei <= 0n || reserveInWei <= 0n || reserveOutWei <= 0n) {
    return 0n;
  }

  if (outputAmountWei >= reserveOutWei) {
    return 0n; // Insufficient liquidity
  }

  const numerator = reserveInWei * outputAmountWei * FEES_DENOMINATOR;
  const denominator = (reserveOutWei - outputAmountWei) * FEES_NUMERATOR;

  return numerator / denominator + 1n;
};

/**
 * Calculate minimum output amount given slippage tolerance (in basis points)
 * For exact input trades: minOutput = outputAmount * (1 - slippageTolerance%)
 * Formula: minOutput = (outputAmount * (ONE_BIPS - slippageBips)) / ONE_BIPS
 */
export const getMinimumOutputAmount = (
  outputAmountWei: bigint,
  slippageBips: bigint = DEFAULT_SLIPPAGE_BPS
): bigint => {
  if (outputAmountWei <= 0n) return 0n;
  return (outputAmountWei * (ONE_BIPS - slippageBips)) / ONE_BIPS;
};

/**
 * Calculate maximum input amount given slippage tolerance (in basis points)
 * For exact output trades: maxInput = inputAmount * (1 + slippageTolerance%)
 * Formula: maxInput = (inputAmount * (ONE_BIPS + slippageBips)) / ONE_BIPS
 */
export const getMaximumInputAmount = (
  inputAmountWei: bigint,
  slippageBips: bigint = DEFAULT_SLIPPAGE_BPS
): bigint => {
  if (inputAmountWei <= 0n) return 0n;
  return (inputAmountWei * (ONE_BIPS + slippageBips)) / ONE_BIPS;
};

/**
 * Calculate liquidity tokens minted when adding liquidity (Warp V2 formula)
 * Initial liquidity: sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
 * Existing liquidity: min((amountA * totalSupply) / reserveA, (amountB * totalSupply) / reserveB)
 */
export const getLiquidityMinted = (
  amountAWei: bigint,
  amountBWei: bigint,
  reserveAWei: bigint,
  reserveBWei: bigint,
  totalSupplyWei: bigint
): bigint => {
  if (amountAWei <= 0n || amountBWei <= 0n) return 0n;

  if (totalSupplyWei === 0n) {
    // Initial liquidity: sqrt(amountA * amountB) - 1000
    const product = amountAWei * amountBWei;
    const sqrtProduct = sqrtBigInt(product);
    return sqrtProduct > MINIMUM_LIQUIDITY
      ? sqrtProduct - MINIMUM_LIQUIDITY
      : 0n;
  } else {
    // Existing liquidity: min of the two ratios
    if (reserveAWei === 0n || reserveBWei === 0n) return 0n;

    const liquidity1 = (amountAWei * totalSupplyWei) / reserveAWei;
    const liquidity2 = (amountBWei * totalSupplyWei) / reserveBWei;

    return liquidity1 < liquidity2 ? liquidity1 : liquidity2;
  }
};

/**
 * Calculate amounts received when removing liquidity
 * amountOut = (liquidityAmount * reserve) / totalSupply
 */
export const getLiquidityRemoveAmounts = (
  liquidityWei: bigint,
  reserveAWei: bigint,
  reserveBWei: bigint,
  totalSupplyWei: bigint
): { amountAWei: bigint; amountBWei: bigint } => {
  if (liquidityWei <= 0n || totalSupplyWei === 0n) {
    return { amountAWei: 0n, amountBWei: 0n };
  }

  const amountAWei = (liquidityWei * reserveAWei) / totalSupplyWei;
  const amountBWei = (liquidityWei * reserveBWei) / totalSupplyWei;

  return { amountAWei, amountBWei };
};

import { MEGAETH_EXPLORER_BASE_URL } from "./constants";

const MIN_DISPLAY_THRESHOLD = 1e-6;

export const formatBalanceDisplay = (value: string | null): string => {
  if (value === null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0 || Math.abs(numeric) < MIN_DISPLAY_THRESHOLD) return "0";
  if (Math.abs(numeric) >= 1) {
    return numeric.toFixed(4).replace(/\.?0+$/, "");
  }
  return numeric.toFixed(6).replace(/\.?0+$/, "");
};

export const buildExplorerTxUrl = (hash: string | `0x${string}`) =>
  `${MEGAETH_EXPLORER_BASE_URL}/tx/${hash}`;

/**
 * Format token balance for display in token lists
 * Shows compact notation for large numbers and precision for small numbers
 */
export const formatTokenBalance = (
  balance: bigint | null | undefined,
  decimals: number
): string => {
  if (!balance || balance === 0n) return "0";

  try {
    // Convert to float with proper decimals
    const divisor = 10 ** decimals;
    const value = Number(balance) / divisor;

    // For very small balances
    if (value < 0.000001) return "< 0.000001";

    // For balances < 1, show up to 6 decimals
    if (value < 1) {
      return value.toFixed(6).replace(/\.?0+$/, "");
    }

    // For balances 1-999, show up to 4 decimals
    if (value < 1000) {
      return value.toFixed(4).replace(/\.?0+$/, "");
    }

    // For balances 1000-999,999, show with commas and 2 decimals
    if (value < 1_000_000) {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }

    // For millions and above, use compact notation
    return value.toLocaleString("en-US", {
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch (error) {
    console.error("[formatTokenBalance] Error formatting balance:", error);
    return "0";
  }
};

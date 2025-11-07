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

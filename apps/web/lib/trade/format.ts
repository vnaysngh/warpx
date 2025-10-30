export const formatBalanceDisplay = (value: string | null): string => {
  if (value === null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0";
  if (numeric >= 1) {
    return numeric.toFixed(4).replace(/\.?0+$/, "");
  }
  return numeric.toPrecision(4);
};

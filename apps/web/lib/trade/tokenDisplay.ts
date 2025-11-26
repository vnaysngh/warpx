const NATIVE_SYMBOLS = ["ETH", "WETH", "WMETH", "WMEGAETH", "WMEGA"];

export function getDisplaySymbol(symbol?: string | null): string {
  if (!symbol) return "";
  const upper = symbol.toUpperCase();
  if (NATIVE_SYMBOLS.includes(upper)) {
    return "ETH";
  }
  return symbol;
}

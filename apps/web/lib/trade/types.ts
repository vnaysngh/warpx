export type TokenDescriptor = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isNative?: boolean;
  wrappedAddress?: string;
  logo?: string;
};

export type TokenManifest = {
  tokens?: Array<{
    symbol: string;
    name: string;
    address: string;
    decimals?: number;
    isNative?: boolean;
    logo?: string;
  }>;
};

export type SwapFormState = {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInExact: string | null;
  minOut: string;
  maxInput: string;
};

export type LiquidityFormState = {
  amountA: string;
  amountB: string;
  amountAExact: string | null;
  amountBExact: string | null;
};

export type Quote = { amount: string; symbol: string };

export type ReverseQuote = {
  amount: string;
  symbolIn: string;
  symbolOut: string;
};

export type TokenDialogSlot =
  | "swapIn"
  | "swapOut"
  | "liquidityA"
  | "liquidityB";

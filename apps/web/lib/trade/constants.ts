import type {
  LiquidityFormState,
  SwapFormState,
  TokenDescriptor
} from "./types";

export const MEGAETH_CHAIN_ID = 6342n;
export const DEFAULT_SLIPPAGE_BPS = 50n; // 0.50% default slippage tolerance
export const ONE_BIPS = 10000n; // 10000 basis points = 100%
export const MINIMUM_LIQUIDITY = 1000n; // Minimum liquidity burned
export const FEES_DENOMINATOR = 1000n; // Standard Warp fee = 0.3% = 3/1000
export const FEES_NUMERATOR = 997n; // 1000 - 3 fee
export const DEFAULT_TOKEN_DECIMALS = 18;

export const SWAP_DEFAULT: SwapFormState = {
  tokenIn: "",
  tokenOut: "",
  amountIn: "",
  minOut: "",
  maxInput: "" // For exact output swaps with slippage
};

export const LIQUIDITY_DEFAULT: LiquidityFormState = {
  amountA: "",
  amountB: ""
};
export const TOKEN_CATALOG: TokenDescriptor[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x03eCB2c43D04852c1919eAfFbc61560A05c89E66",
    decimals: 18,
    isNative: true,
    wrappedAddress: "0x03eCB2c43D04852c1919eAfFbc61560A05c89E66"
  },
  {
    symbol: "WARPX",
    name: "WarpX",
    address: "0xAf94EC793270d2FcF2Ad3700EBE3ba3488B266c3",
    decimals: 18
  },
  {
    symbol: "GTE",
    name: "GTE Token",
    address: "0x9629684df53db9e4484697d0a50c442b2bfa80a8",
    decimals: 18
  },
  {
    symbol: "MEGA",
    name: "MEGA",
    address: "0x10a6be7d23989d00d528e68cf8051d095f741145",
    decimals: 18
  },
  {
    symbol: "USD",
    name: "USD",
    address: "0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f",
    decimals: 18
  }
];

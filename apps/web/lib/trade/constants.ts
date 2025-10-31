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
    symbol: "MEGA",
    name: "MegaETH",
    address: "0x2Ea161D82Cf2D965819C45cdA2fDE0AF79161639",
    decimals: 18
  },
  {
    symbol: "MEGB",
    name: "MegaETH Beta",
    address: "0x96F01598fc45334bF2566614Fb046Cc7A8F132C8",
    decimals: 18
  },
  {
    symbol: "WMEGA",
    name: "Wrapped MegaETH",
    address: "0x88C1770353BD23f435F6F049cc26936009B27B69",
    decimals: 18
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x776401b9bc8aae31a685731b7147d4445fd9fb19",
    decimals: 18
  },
  {
    symbol: "USD",
    name: "USD Stablecoin",
    address: "0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f",
    decimals: 18
  }
];

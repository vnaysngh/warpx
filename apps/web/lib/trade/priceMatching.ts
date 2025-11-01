import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';

const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Calculate exact amounts to match another AMM's price
 * Uses on-chain reserves - NO floating point errors!
 */
export async function calculateMatchingLiquidity(params: {
  referencePairAddress: `0x${string}`;
  tokenAAddress: string;
  tokenBAddress: string;
  desiredAmountA: bigint;
  chainId: number;
}): Promise<{
  amountA: bigint;
  amountB: bigint;
  priceAPerB: string;
  priceBPerA: string;
  isExactMatch: boolean;
}> {
  const { referencePairAddress, tokenAAddress, tokenBAddress, desiredAmountA, chainId } = params;

  // Step 1: Get reserves from reference AMM
  const [reserves, token0Address] = await Promise.all([
    readContract(wagmiConfig, {
      address: referencePairAddress,
      abi: PAIR_ABI,
      functionName: 'getReserves',
      chainId
    }),
    readContract(wagmiConfig, {
      address: referencePairAddress,
      abi: PAIR_ABI,
      functionName: 'token0',
      chainId
    })
  ]);

  const [reserve0, reserve1] = reserves as readonly [bigint, bigint, number];

  // Step 2: Determine which reserve is which token
  const isTokenAToken0 = token0Address.toLowerCase() === tokenAAddress.toLowerCase();
  const reserveA = isTokenAToken0 ? reserve0 : reserve1;
  const reserveB = isTokenAToken0 ? reserve1 : reserve0;

  if (reserveA === 0n || reserveB === 0n) {
    throw new Error('Reference pair has no liquidity');
  }

  // Step 3: Calculate exact amount B using the ratio
  // This maintains EXACT price: amountA / amountB = reserveA / reserveB
  // Therefore: amountB = (amountA * reserveB) / reserveA
  const amountB = (desiredAmountA * reserveB) / reserveA;

  // Step 4: Verify the calculation
  // Check if: (amountA * reserveB) === (amountB * reserveA)
  const leftSide = desiredAmountA * reserveB;
  const rightSide = amountB * reserveA;
  const isExactMatch = leftSide === rightSide;

  // Calculate human-readable prices
  const priceAPerB = formatPrice(reserveB, reserveA);
  const priceBPerA = formatPrice(reserveA, reserveB);

  return {
    amountA: desiredAmountA,
    amountB,
    priceAPerB,
    priceBPerA,
    isExactMatch
  };
}

/**
 * Format price with high precision
 */
function formatPrice(numerator: bigint, denominator: bigint): string {
  // Use 18 decimals for precision
  const scaled = (numerator * 10n**18n) / denominator;
  const integer = scaled / 10n**18n;
  const fractional = scaled % 10n**18n;

  // Format with up to 18 decimals, removing trailing zeros
  const fractionalStr = fractional.toString().padStart(18, '0').replace(/0+$/, '');

  if (fractionalStr === '') {
    return integer.toString();
  }

  return `${integer}.${fractionalStr}`;
}

/**
 * Validate that your liquidity matches the reference price
 * Returns the maximum acceptable deviation in basis points
 */
export function validatePriceMatch(
  yourAmountA: bigint,
  yourAmountB: bigint,
  referenceReserveA: bigint,
  referenceReserveB: bigint,
  maxDeviationBps: number = 1 // 0.01% = 1 basis point
): { isValid: boolean; deviationBps: number } {
  // Calculate price ratios
  const yourRatio = (yourAmountA * 10000n) / yourAmountB;
  const referenceRatio = (referenceReserveA * 10000n) / referenceReserveB;

  // Calculate deviation in basis points
  const deviation = yourRatio > referenceRatio
    ? yourRatio - referenceRatio
    : referenceRatio - yourRatio;

  const deviationBps = Number((deviation * 10000n) / referenceRatio);

  return {
    isValid: deviationBps <= maxDeviationBps,
    deviationBps
  };
}

/**
 * Get the best liquidity amounts with safety checks
 */
export async function getSafeLiquidityAmounts(params: {
  referencePairAddress: `0x${string}`;
  tokenAAddress: string;
  tokenBAddress: string;
  desiredAmountA: bigint;
  chainId: number;
  maxDeviationBps?: number;
}): Promise<{
  amountA: bigint;
  amountB: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  priceInfo: {
    priceAPerB: string;
    priceBPerA: string;
  };
}> {
  const { maxDeviationBps = 50 } = params; // Default 0.5% tolerance

  // Calculate matching amounts
  const result = await calculateMatchingLiquidity(params);

  if (!result.isExactMatch) {
    console.warn('⚠️ Price match not exact due to integer division');
  }

  // Add slippage tolerance
  const slippageBps = 50n; // 0.5%
  const amountAMin = (result.amountA * (10000n - slippageBps)) / 10000n;
  const amountBMin = (result.amountB * (10000n - slippageBps)) / 10000n;

  return {
    amountA: result.amountA,
    amountB: result.amountB,
    amountAMin,
    amountBMin,
    priceInfo: {
      priceAPerB: result.priceAPerB,
      priceBPerA: result.priceBPerA
    }
  };
}

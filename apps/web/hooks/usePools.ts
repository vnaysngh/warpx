import { useQuery } from "@tanstack/react-query";
import { JsonRpcProvider, Contract, ZeroAddress, Interface } from "ethers";
import { useMemo } from "react";
import { CurrencyAmount, Token } from "@megaeth/warp-sdk-core";
import { Pair } from "@megaeth/warp-v2-sdk";
import { poolRegistry } from "@/lib/pools/registry";
import {
  multicall,
  createGetReservesCalls,
  createTotalSupplyCalls,
  decodeReserves,
  decodeTotalSupply
} from "@/lib/contracts/multicall";
import type { TokenDescriptor } from "@/lib/trade/types";
import { toSdkToken } from "@/lib/trade/warp";
import { formatNumber } from "@/lib/trade/math";

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

export interface PoolData {
  id: number;
  pairAddress: string;
  token0: TokenDescriptor;
  token1: TokenDescriptor;
  totalLiquidityFormatted: string;
  totalLiquidityValue: number;
  // Raw data for caching
  reserves?: {
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: number;
  };
  totalSupply?: bigint;
}

interface UsePoolsParams {
  tokenList: TokenDescriptor[];
  factoryAddress: string | null;
  wrappedNativeAddress: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}

/**
 * Fetch pool addresses from factory (with registry caching)
 */
async function fetchPoolAddresses(
  tokenList: TokenDescriptor[],
  factoryAddress: string,
  provider: JsonRpcProvider
): Promise<Map<string, string>> {
  const factory = new Contract(factoryAddress, FACTORY_ABI, provider);
  const poolAddresses = new Map<string, string>();

  // Generate all token pairs
  const pairs: Array<[TokenDescriptor, TokenDescriptor]> = [];
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = i + 1; j < tokenList.length; j++) {
      pairs.push([tokenList[i], tokenList[j]]);
    }
  }

  // Check registry first, only fetch unknown pairs
  const pairsToFetch: Array<[TokenDescriptor, TokenDescriptor]> = [];
  pairs.forEach(([tokenA, tokenB]) => {
    const cached = poolRegistry.getPool(tokenA.address, tokenB.address);
    if (cached) {
      const key = `${tokenA.address.toLowerCase()}:${tokenB.address.toLowerCase()}`;
      poolAddresses.set(key, cached);
    } else {
      pairsToFetch.push([tokenA, tokenB]);
    }
  });

  // Fetch unknown pairs from factory
  if (pairsToFetch.length > 0) {
    const getPairCalls = pairsToFetch.map(([tokenA, tokenB]) => {
      const factoryInterface = new Interface(FACTORY_ABI);
      return {
        target: factoryAddress,
        callData: factoryInterface.encodeFunctionData("getPair", [
          tokenA.address,
          tokenB.address
        ]),
        allowFailure: true
      };
    });

    const results = await multicall(provider, getPairCalls);
    const factoryInterface = new Interface(FACTORY_ABI);

    results.forEach((result, index) => {
      if (!result.success || !result.returnData) return;

      try {
        const [pairAddress] = factoryInterface.decodeFunctionResult(
          "getPair",
          result.returnData
        );
        if (pairAddress && pairAddress !== ZeroAddress) {
          const [tokenA, tokenB] = pairsToFetch[index];
          const key = `${tokenA.address.toLowerCase()}:${tokenB.address.toLowerCase()}`;
          poolAddresses.set(key, pairAddress);

          // Add to registry for future use
          poolRegistry.addPool(pairAddress, tokenA.address, tokenB.address);
        }
      } catch (error) {
        console.error("[usePools] Failed to decode getPair result:", error);
      }
    });
  }

  return poolAddresses;
}

/**
 * Fetch pool data using multicall for batching
 */
async function fetchPoolsData(params: UsePoolsParams): Promise<PoolData[]> {
  const { tokenList, factoryAddress, wrappedNativeAddress, provider } = params;

  if (!factoryAddress || tokenList.length < 2) {
    return [];
  }

  // Step 1: Get all pool addresses (with registry caching)
  const poolAddresses = await fetchPoolAddresses(
    tokenList,
    factoryAddress,
    provider
  );

  if (poolAddresses.size === 0) {
    return [];
  }

  const pairAddressList = Array.from(poolAddresses.values());

  // Step 2: Batch fetch reserves and total supply using multicall
  const [reservesResults, totalSupplyResults] = await Promise.all([
    multicall(provider, createGetReservesCalls(pairAddressList)),
    multicall(provider, createTotalSupplyCalls(pairAddressList))
  ]);

  // Step 3: Process results
  const pools: PoolData[] = [];
  const tokenMap = new Map(tokenList.map((t) => [t.address.toLowerCase(), t]));

  let poolId = 1;
  for (const [key, pairAddress] of poolAddresses.entries()) {
    const index = pairAddressList.indexOf(pairAddress);
    if (index === -1) continue;

    const reservesResult = reservesResults[index];
    const totalSupplyResult = totalSupplyResults[index];

    if (!reservesResult?.success || !totalSupplyResult?.success) {
      continue;
    }

    const reserves = decodeReserves(reservesResult.returnData);
    const totalSupply = decodeTotalSupply(totalSupplyResult.returnData);

    if (!reserves || !totalSupply) {
      continue;
    }

    // Get tokens from the key
    const [token0Address, token1Address] = key.split(":");
    const token0Descriptor = tokenMap.get(token0Address);
    const token1Descriptor = tokenMap.get(token1Address);

    if (!token0Descriptor || !token1Descriptor) continue;

    // Create SDK tokens and pair
    const token0 = toSdkToken(token0Descriptor);
    const token1 = toSdkToken(token1Descriptor);

    // Determine which token is token0 in the pair contract
    const [sdkToken0, sdkToken1] = token0.sortsBefore(token1)
      ? [token0, token1]
      : [token1, token0];
    const [displayToken0, displayToken1] = token0.sortsBefore(token1)
      ? [token0Descriptor, token1Descriptor]
      : [token1Descriptor, token0Descriptor];

    // Create pair instance
    const pair = new Pair(
      CurrencyAmount.fromRawAmount(sdkToken0, reserves.reserve0),
      CurrencyAmount.fromRawAmount(sdkToken1, reserves.reserve1),
      pairAddress,
      totalSupply
    );

    // Calculate TVL
    const reserve0Value = Number(pair.reserve0.toExact());
    const reserve1Value = Number(pair.reserve1.toExact());

    let totalLiquidityValue = 0;
    const token0Lower = sdkToken0.address.toLowerCase();
    const token1Lower = sdkToken1.address.toLowerCase();
    const wethLower = wrappedNativeAddress?.toLowerCase() ?? "";

    if (wethLower && token0Lower === wethLower) {
      totalLiquidityValue = reserve0Value * 2;
    } else if (wethLower && token1Lower === wethLower) {
      totalLiquidityValue = reserve1Value * 2;
    } else {
      totalLiquidityValue = reserve0Value + reserve1Value;
    }

    pools.push({
      id: poolId++,
      pairAddress,
      token0: displayToken0,
      token1: displayToken1,
      totalLiquidityFormatted: formatNumber(totalLiquidityValue),
      totalLiquidityValue,
      reserves,
      totalSupply
    });
  }

  // Sort by liquidity descending
  pools.sort((a, b) => b.totalLiquidityValue - a.totalLiquidityValue);

  // Reassign IDs after sorting
  pools.forEach((pool, index) => {
    pool.id = index + 1;
  });

  return pools;
}

/**
 * Hook to fetch all pools with caching and automatic refetching
 */
export function usePools(params: UsePoolsParams) {
  const queryKey = useMemo(
    () => ["pools", params.factoryAddress, params.tokenList.length],
    [params.factoryAddress, params.tokenList.length]
  );

  return useQuery({
    queryKey,
    queryFn: () => fetchPoolsData(params),
    enabled:
      params.enabled !== false &&
      !!params.factoryAddress &&
      params.tokenList.length >= 2,
    staleTime: 15 * 1000 // 15 seconds
  });
}

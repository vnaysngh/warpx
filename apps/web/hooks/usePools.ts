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

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

export interface PoolData {
  id: number;
  pairAddress: string;
  token0: TokenDescriptor;
  token1: TokenDescriptor;
  // Contract token addresses (for correct reserve mapping)
  contractToken0Address: string;
  contractToken1Address: string;
  totalLiquidityFormatted: string | null;
  totalLiquidityValue: number | null;
  reserve0Exact: number;
  reserve1Exact: number;
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
  const pendingPools: Array<{
    id: number;
    pairAddress: string;
    displayToken0: TokenDescriptor;
    displayToken1: TokenDescriptor;
    contractToken0Address: string;
    contractToken1Address: string;
    reserve0Exact: number;
    reserve1Exact: number;
    reserves?: {
      reserve0: bigint;
      reserve1: bigint;
      blockTimestampLast: number;
    };
    totalSupply?: bigint;
  }> = [];
  const tokenMap = new Map(tokenList.map((t) => [t.address.toLowerCase(), t]));

  const wethLower = wrappedNativeAddress?.toLowerCase() ?? "";
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

    // For display, always show ETH as the quote (second) token: TOKEN/ETH format
    const token0IsEth = wethLower && token0Descriptor.address.toLowerCase() === wethLower;
    const token1IsEth = wethLower && token1Descriptor.address.toLowerCase() === wethLower;

    let displayToken0: TokenDescriptor;
    let displayToken1: TokenDescriptor;

    // ETH should always be the quote (second) token in the pair display
    if (token0IsEth && !token1IsEth) {
      // Swap: make ETH the quote token (second position)
      displayToken0 = token1Descriptor;
      displayToken1 = token0Descriptor;
    } else {
      // Either token1 is ETH (correct order), or neither is ETH (use sortsBefore)
      [displayToken0, displayToken1] = token0.sortsBefore(token1)
        ? [token0Descriptor, token1Descriptor]
        : [token1Descriptor, token0Descriptor];
    }

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

    pendingPools.push({
      id: poolId++,
      pairAddress,
      displayToken0,
      displayToken1,
      contractToken0Address: sdkToken0.address,
      contractToken1Address: sdkToken1.address,
      reserve0Exact: reserve0Value,
      reserve1Exact: reserve1Value,
      reserves,
      totalSupply
    });
  }

  const uniqueTokenAddresses = Array.from(
    new Set(
      pendingPools.flatMap((pool) => [
        pool.contractToken0Address.toLowerCase(),
        pool.contractToken1Address.toLowerCase()
      ])
    )
  );

  let priceMap: Record<string, number> = {};
  if (uniqueTokenAddresses.length > 0) {
    try {
      priceMap = await fetchTokenUsdPrices(uniqueTokenAddresses);
    } catch (error) {
      console.warn("[usePools] failed to fetch token USD prices", error);
    }
  }

  const pools: PoolData[] = pendingPools.map((pool) => {
    return {
      id: pool.id,
      pairAddress: pool.pairAddress,
      token0: pool.displayToken0,
      token1: pool.displayToken1,
      contractToken0Address: pool.contractToken0Address,
      contractToken1Address: pool.contractToken1Address,
      totalLiquidityFormatted: null,
      totalLiquidityValue: null,
      reserve0Exact: pool.reserve0Exact,
      reserve1Exact: pool.reserve1Exact,
      reserves: pool.reserves,
      totalSupply: pool.totalSupply
    };
  });

  // Sort by liquidity descending
  pools.sort(
    (a, b) =>
      (b.totalLiquidityValue ?? 0) - (a.totalLiquidityValue ?? 0)
  );

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

async function fetchTokenUsdPrices(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams({
    addresses: addresses.join(",")
  });

  const response = await fetch(`/api/token-prices?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token prices: ${response.status}`);
  }

  const payload = (await response.json()) as {
    prices?: Record<string, string | number | null>;
  };

  const parsed: Record<string, number> = {};
  if (payload?.prices) {
    Object.entries(payload.prices).forEach(([address, value]) => {
      const numericValue =
        typeof value === "string" ? Number(value) : typeof value === "number" ? value : null;
      if (numericValue !== null && Number.isFinite(numericValue)) {
        parsed[address.toLowerCase()] = numericValue;
      }
    });
  }

  return parsed;
}

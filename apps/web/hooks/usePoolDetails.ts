import { useQuery } from "@tanstack/react-query";
import { JsonRpcProvider, Interface } from "ethers";
import { useMemo } from "react";
import {
  multicall,
  decodeReserves,
  decodeTotalSupply,
  decodeBalance
} from "@/lib/contracts/multicall";
import type { MulticallCall } from "@/lib/contracts/multicall";
import type { TokenDescriptor } from "@/lib/trade/types";
import { DEFAULT_TOKEN_DECIMALS } from "@/lib/trade/constants";

const PAIR_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)"
];

export interface PoolDetailsData {
  token0Address: string;
  token1Address: string;
  reserves: {
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: number;
  };
  totalSupply: bigint;
  userLpBalance: bigint | null;
}

interface UsePoolDetailsParams {
  pairAddress: string | null;
  account: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}

/**
 * Fetch pool details using a single multicall for optimal performance
 * Batches: token0, token1, reserves, totalSupply, and optionally userLpBalance
 */
/**
 * Fetch static pool data (token addresses) - rarely changes
 */
export function usePoolStaticData({
  pairAddress,
  provider,
  enabled = true
}: {
  pairAddress: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}) {
  const queryKey = useMemo(
    () => ["pool-static", pairAddress],
    [pairAddress]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!pairAddress) throw new Error("Pair address is required");
      const pairInterface = new Interface(PAIR_ABI);
      const calls: MulticallCall[] = [
        { target: pairAddress, callData: pairInterface.encodeFunctionData("token0"), allowFailure: false },
        { target: pairAddress, callData: pairInterface.encodeFunctionData("token1"), allowFailure: false }
      ];
      const results = await multicall(provider, calls);
      const [token0] = pairInterface.decodeFunctionResult("token0", results[0].returnData);
      const [token1] = pairInterface.decodeFunctionResult("token1", results[1].returnData);
      return { token0Address: token0 as string, token1Address: token1 as string };
    },
    enabled: enabled && !!pairAddress,
    staleTime: Infinity, // Static data never changes
    gcTime: 24 * 60 * 60 * 1000 // Keep in cache for 24h
  });
}

/**
 * Fetch dynamic pool data (reserves, supply, balance) - changes frequently
 */
export function usePoolDynamicData({
  pairAddress,
  account,
  provider,
  enabled = true
}: {
  pairAddress: string | null;
  account: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}) {
  const queryKey = useMemo(
    () => ["pool-dynamic", pairAddress, account],
    [pairAddress, account]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!pairAddress) throw new Error("Pair address is required");
      const pairInterface = new Interface(PAIR_ABI);
      const calls: MulticallCall[] = [
        { target: pairAddress, callData: pairInterface.encodeFunctionData("getReserves"), allowFailure: false },
        { target: pairAddress, callData: pairInterface.encodeFunctionData("totalSupply"), allowFailure: false }
      ];

      if (account) {
        calls.push({
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("balanceOf", [account]),
          allowFailure: true
        });
      }

      const results = await multicall(provider, calls);
      const reserves = decodeReserves(results[0].returnData);
      const totalSupply = decodeTotalSupply(results[1].returnData);

      let userLpBalance: bigint | null = null;
      if (account && results[2]?.success) {
        userLpBalance = decodeBalance(results[2].returnData);
      }

      if (!reserves || !totalSupply) throw new Error("Failed to decode pool data");

      return { reserves, totalSupply, userLpBalance };
    },
    enabled: enabled && !!pairAddress,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000 // Poll every 30s
  });
}

/**
 * @deprecated Use usePoolStaticData and usePoolDynamicData instead
 */
export function usePoolDetails(params: UsePoolDetailsParams) {
  const staticData = usePoolStaticData(params);
  const dynamicData = usePoolDynamicData(params);

  return {
    ...staticData,
    ...dynamicData,
    data: staticData.data && dynamicData.data ? {
      ...staticData.data,
      ...dynamicData.data
    } : undefined,
    isLoading: staticData.isLoading || dynamicData.isLoading,
    error: staticData.error || dynamicData.error
  };
}

/**
 * Helper to create token descriptors from addresses
 * Can be expanded to fetch token metadata if needed
 */
export function createTokenDescriptor(
  address: string,
  wrappedNativeAddress?: string
): TokenDescriptor {
  const isWrappedNative =
    wrappedNativeAddress?.toLowerCase() === address.toLowerCase();

  if (isWrappedNative) {
    return {
      symbol: "ETH",
      name: "Ethereum",
      address,
      decimals: DEFAULT_TOKEN_DECIMALS,
      isNative: true,
      wrappedAddress: address
    };
  }

  // Create placeholder descriptor - will be enriched by token list
  const suffix = address.slice(2, 6).toUpperCase();
  return {
    symbol: `TOK${suffix}`,
    name: `Token ${suffix}`,
    address,
    decimals: DEFAULT_TOKEN_DECIMALS,
    isNative: false
  };
}

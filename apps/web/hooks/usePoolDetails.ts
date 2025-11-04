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
export function usePoolDetails({
  pairAddress,
  account,
  provider,
  enabled = true
}: UsePoolDetailsParams) {
  const queryKey = useMemo(
    () => ["pool-details", pairAddress, account],
    [pairAddress, account]
  );

  return useQuery({
    queryKey,
    queryFn: async (): Promise<PoolDetailsData> => {
      if (!pairAddress) {
        throw new Error("Pair address is required");
      }

      const pairInterface = new Interface(PAIR_ABI);

      // Build multicall requests
      const calls: MulticallCall[] = [
        // 0: token0
        {
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("token0"),
          allowFailure: false
        },
        // 1: token1
        {
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("token1"),
          allowFailure: false
        },
        // 2: getReserves
        {
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("getReserves"),
          allowFailure: false
        },
        // 3: totalSupply
        {
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("totalSupply"),
          allowFailure: false
        }
      ];

      // Add user balance call if account is connected
      if (account) {
        calls.push({
          target: pairAddress,
          callData: pairInterface.encodeFunctionData("balanceOf", [account]),
          allowFailure: true
        });
      }

      // Execute single multicall
      const results = await multicall(provider, calls);

      // Decode results
      const [token0Result] = pairInterface.decodeFunctionResult(
        "token0",
        results[0].returnData
      );
      const [token1Result] = pairInterface.decodeFunctionResult(
        "token1",
        results[1].returnData
      );

      const reserves = decodeReserves(results[2].returnData);
      const totalSupply = decodeTotalSupply(results[3].returnData);

      if (!reserves || !totalSupply) {
        throw new Error("Failed to decode pool data");
      }

      let userLpBalance: bigint | null = null;
      if (account && results[4]?.success) {
        userLpBalance = decodeBalance(results[4].returnData);
      }

      return {
        token0Address: token0Result as string,
        token1Address: token1Result as string,
        reserves,
        totalSupply,
        userLpBalance
      };
    },
    enabled: enabled && !!pairAddress,
    staleTime: 15 * 1000, // 15 seconds
    retry: 2
  });
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

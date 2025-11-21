import { useQuery } from '@tanstack/react-query';
import { JsonRpcProvider, Interface } from 'ethers';
import { useMemo } from 'react';
import {
  multicall,
  decodeBalance,
  type MulticallCall,
} from '@/lib/contracts/multicall';
import type { TokenDescriptor } from '@/lib/trade/types';

export interface TokenBalance {
  address: string;
  balance: bigint;
}

interface UseTokenBalancesParams {
  tokens: TokenDescriptor[];
  account: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}

/**
 * Helper to create multicall calls for token balances
 * Handles both native ETH (via getBalance) and ERC20 tokens (via balanceOf)
 */
function createTokenBalanceCalls(
  tokens: TokenDescriptor[],
  account: string
): MulticallCall[] {
  const erc20Interface = new Interface([
    'function balanceOf(address) external view returns (uint256)',
  ]);

  return tokens.map((token) => ({
    target: token.address,
    callData: erc20Interface.encodeFunctionData('balanceOf', [account]),
    allowFailure: true,
  }));
}

/**
 * Fetch token balances for multiple tokens efficiently using multicall
 */
async function fetchTokenBalances(
  tokens: TokenDescriptor[],
  account: string,
  provider: JsonRpcProvider
): Promise<Map<string, bigint>> {
  if (tokens.length === 0) {
    return new Map();
  }

  // Separate native tokens from ERC20 tokens
  const nativeTokens = tokens.filter((t) => t.isNative);
  const erc20Tokens = tokens.filter((t) => !t.isNative);

  const balances = new Map<string, bigint>();

  // Fetch native ETH balance separately
  if (nativeTokens.length > 0) {
    try {
      const ethBalance = await provider.getBalance(account);
      nativeTokens.forEach((token) => {
        balances.set(token.address.toLowerCase(), ethBalance);
      });
    } catch (error) {
      console.error('[useTokenBalances] Failed to fetch native balance:', error);
    }
  }

  // Fetch ERC20 balances using multicall
  if (erc20Tokens.length > 0) {
    try {
      const balanceCalls = createTokenBalanceCalls(erc20Tokens, account);
      const results = await multicall(provider, balanceCalls);

      results.forEach((result, index) => {
        if (!result.success) return;

        const balance = decodeBalance(result.returnData);
        if (balance !== null) {
          balances.set(erc20Tokens[index].address.toLowerCase(), balance);
        }
      });
    } catch (error) {
      console.error('[useTokenBalances] Failed to fetch ERC20 balances:', error);
    }
  }

  return balances;
}

/**
 * Hook to fetch balances for multiple tokens efficiently
 * Uses react-query for caching and automatic refetching
 * Optimized for performance with short stale times
 */
export function useTokenBalances(params: UseTokenBalancesParams) {
  const { tokens, account, provider, enabled = true } = params;

  const queryKey = useMemo(
    () => ['token-balances', account, tokens.length],
    [account, tokens.length]
  );

  return useQuery({
    queryKey,
    queryFn: () => fetchTokenBalances(tokens, account!, provider),
    enabled: enabled && !!account && tokens.length > 0,
    staleTime: 10 * 1000, // 10 seconds - balances are considered fresh for 10s
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to window
    refetchOnMount: false, // Don't refetch on every mount, use cache
  });
}

import { useQuery } from '@tanstack/react-query';
import { JsonRpcProvider } from 'ethers';
import { useMemo } from 'react';
import {
  multicall,
  createBalanceOfCalls,
  decodeBalance,
} from '@/lib/contracts/multicall';

export interface PoolBalance {
  pairAddress: string;
  balance: bigint;
}

interface UsePoolBalancesParams {
  pairAddresses: string[];
  account: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}

/**
 * Fetch user LP token balances for multiple pools
 */
async function fetchPoolBalances(
  pairAddresses: string[],
  account: string,
  provider: JsonRpcProvider
): Promise<Map<string, bigint>> {
  if (pairAddresses.length === 0) {
    return new Map();
  }

  const balanceCalls = createBalanceOfCalls(pairAddresses, account);
  const results = await multicall(provider, balanceCalls);

  const balances = new Map<string, bigint>();

  results.forEach((result, index) => {
    if (!result.success) return;

    const balance = decodeBalance(result.returnData);
    if (balance && balance > 0n) {
      balances.set(pairAddresses[index].toLowerCase(), balance);
    }
  });

  return balances;
}

/**
 * Hook to fetch user LP balances for all pools
 * Runs in the background and doesn't block pool list rendering
 */
export function usePoolBalances(params: UsePoolBalancesParams) {
  const { pairAddresses, account, provider, enabled = true } = params;

  const queryKey = useMemo(
    () => ['user-lp-balance', account, pairAddresses.length],
    [account, pairAddresses.length]
  );

  return useQuery({
    queryKey,
    queryFn: () => fetchPoolBalances(pairAddresses, account!, provider),
    enabled: enabled && !!account && pairAddresses.length > 0,
    staleTime: 10 * 1000, // 10 seconds
  });
}

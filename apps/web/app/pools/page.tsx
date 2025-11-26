"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
import { useAccount, useSwitchChain } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { ToastContainer } from "@/components/Toast";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { PoolsTable, type PoolsTableRow } from "@/components/pools/PoolsTable";
import { useToasts } from "@/hooks/useToasts";
import { usePools } from "@/hooks/usePools";
import { usePoolBalances } from "@/hooks/usePoolBalances";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { megaethTestnet } from "@/lib/chains";
import {
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID,
  TOKEN_CATALOG
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import {
  formatNumberWithGrouping,
  formatCompactNumber
} from "@/lib/trade/math";
import type { TokenDescriptor, TokenManifest } from "@/lib/trade/types";
import { usePoolsChartData } from "@/hooks/usePoolsChartData";

export default function PoolsPage() {
  const { address, chain, status } = useAccount();
  const router = useRouter();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const queryClient = useQueryClient();

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const { toasts, removeToast, showError, showSuccess } = useToasts();
  const { deployment } = useDeploymentManifest();
  const wrappedNativeAddress = deployment?.wmegaeth ?? null;

  // Fetch chart data to get latest 24h volume
  const { data: chartData } = usePoolsChartData({ days: 30 });

  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showMyPositionsOnly, setShowMyPositionsOnly] = useState(false);
  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(TOKEN_CATALOG);
  const [hasMounted, setHasMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  useEffect(() => {
    if (!isWalletConnected && showMyPositionsOnly) {
      setShowMyPositionsOnly(false);
    }
  }, [isWalletConnected, showMyPositionsOnly]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!chain) {
      setNetworkError(null);
      return;
    }
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      setNetworkError(
        `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`
      );
    } else {
      setNetworkError(null);
    }
  }, [chain]);

  // Load token manifest
  useEffect(() => {
    const network = deployment?.network;
    if (!network) return;

    let cancelled = false;
    const loadTokenManifest = async () => {
      try {
        const manifestPaths = [
          `/deployments/${network}.tokens.json`,
          `/deployments/${network.toLowerCase()}.tokens.json`,
          `/deployments/${network}.json`
        ];

        let manifest: TokenManifest | null = null;

        for (const manifestPath of manifestPaths) {
          try {
            const response = await fetch(manifestPath, { cache: "no-store" });
            if (response.ok) {
              manifest = (await response.json()) as TokenManifest;
              break;
            }
          } catch (innerError) {
            console.warn(
              "[pools] token manifest fetch failed",
              manifestPath,
              innerError
            );
          }
        }

        if (cancelled || !manifest?.tokens?.length) return;

        const manifestTokens: TokenDescriptor[] = manifest.tokens.map(
          (token) => ({
            symbol: token.symbol,
            name: token.name,
            address: token.address,
            decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS,
            isNative: Boolean(token.isNative),
            wrappedAddress: token.isNative ? deployment?.wmegaeth : undefined,
            logo: token.logo
          })
        );

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();
          const addToken = (token: TokenDescriptor) => {
            if (!token.address) return;
            const key = token.address.toLowerCase();
            if (!merged.has(key)) {
              merged.set(key, {
                ...token,
                decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
              });
            }
          };

          [...TOKEN_CATALOG, ...prev, ...manifestTokens].forEach(addToken);
          return Array.from(merged.values());
        });
      } catch (err) {
        console.warn("[pools] failed to load token manifest", err);
      }
    };

    loadTokenManifest();
    return () => {
      cancelled = true;
    };
  }, [deployment?.network, deployment?.wmegaeth]);

  // Fetch pools using optimized hook with multicall and caching
  const {
    data: poolsData,
    isLoading: poolsLoading,
    error: poolsQueryError,
    refetch: refetchPools
  } = usePools({
    tokenList,
    factoryAddress: deployment?.factory ?? null,
    wrappedNativeAddress,
    provider: readProvider
  });

  // Fetch user balances in background (doesn't block pool list)
  const pairAddresses = useMemo(
    () => (poolsData || []).map((pool) => pool.pairAddress),
    [poolsData]
  );

  const { data: balancesData } = usePoolBalances({
    pairAddresses,
    account: walletAccount,
    provider: readProvider
  });

  // Merge pools with balance data
  const pools: PoolsTableRow[] = useMemo(() => {
    if (!poolsData) return [];

    return poolsData.map((pool) => {
      const balance = balancesData?.get(pool.pairAddress.toLowerCase());

      return {
        ...pool,
        userLpBalance: balance && balance > 0n ? balance.toString() : undefined,
        userLpBalanceRaw: balance && balance > 0n ? balance : undefined
      };
    });
  }, [poolsData, balancesData]);

  const poolsError = poolsQueryError
    ? poolsQueryError instanceof Error
      ? poolsQueryError.message
      : "Failed to load pools."
    : null;

  const switchToMegaEth = useCallback(async () => {
    if (!switchChainAsync) {
      showError("Wallet does not support programmatic chain switching.");
      return;
    }
    try {
      await switchChainAsync({ chainId: Number(MEGAETH_CHAIN_ID) });
      showSuccess("Network switched successfully.");
    } catch (switchError) {
      console.error("[network] switch failed", switchError);
      showError(parseErrorMessage(switchError));
    }
  }, [switchChainAsync, showError, showSuccess]);

  const handleRefreshPools = useCallback(() => {
    refetchPools();
  }, [refetchPools]);

  const handleCreatePool = useCallback(() => {
    router.push("/pools/create");
  }, [router]);

  const handlePoolSelect = useCallback(
    (pool: PoolsTableRow) => {
      // Cache pool data for instant details page load
      // Use contractToken0Address and contractToken1Address for correct reserve mapping
      if (
        pool.reserves &&
        pool.totalSupply &&
        pool.contractToken0Address &&
        pool.contractToken1Address
      ) {
        queryClient.setQueryData(
          ["pool-details", pool.pairAddress.toLowerCase(), walletAccount],
          {
            token0Address: pool.contractToken0Address,
            token1Address: pool.contractToken1Address,
            reserves: pool.reserves,
            totalSupply: pool.totalSupply,
            userLpBalance: pool.userLpBalanceRaw || null
          }
        );
      }
      router.push(`/pools/${pool.pairAddress.toLowerCase()}`);
    },
    [router, queryClient, walletAccount]
  );

  const tvlLoading = pools.some((pool) => pool.isTvlLoading);
  const volumeLoading = pools.some((pool) => pool.isVolumeLoading);

  const filteredPools = useMemo(() => {
    if (!pools.length) {
      return [];
    }

    let filtered = pools;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((pool) => {
        const token0Symbol = pool.token0.symbol.toLowerCase();
        const token1Symbol = pool.token1.symbol.toLowerCase();
        const pairName = `${token0Symbol}-${token1Symbol}`;
        const reversePairName = `${token1Symbol}-${token0Symbol}`;

        return (
          pairName.includes(query) ||
          reversePairName.includes(query) ||
          token0Symbol.includes(query) ||
          token1Symbol.includes(query)
        );
      });
    }

    // Filter by user positions
    if (showMyPositionsOnly) {
      filtered = filtered.filter(
        (pool) => pool.userLpBalanceRaw && pool.userLpBalanceRaw > 0n
      );
    }

    return filtered;
  }, [pools, showMyPositionsOnly, searchQuery]);

  const totalTvlSummary = useMemo(() => {
    if (pools.length === 0) {
      return { value: null as string | null, loading: tvlLoading };
    }

    const poolsWithValues = pools.filter(
      (pool) =>
        typeof pool.totalLiquidityValue === "number" &&
        pool.totalLiquidityValue !== null &&
        pool.totalLiquidityValue > 0
    );

    if (poolsWithValues.length === 0) {
      const anyLoading = pools.some((pool) => pool.isTvlLoading);
      return { value: null, loading: tvlLoading || anyLoading };
    }

    const totalValue = poolsWithValues.reduce(
      (acc, pool) => acc + (pool.totalLiquidityValue ?? 0),
      0
    );

    if (totalValue <= 0) {
      return { value: null, loading: false };
    }

    const othersLoading = pools.some(
      (pool) =>
        (!pool.totalLiquidityValue || pool.totalLiquidityValue <= 0) &&
        pool.isTvlLoading
    );

    return {
      value: `$${formatCompactNumber(totalValue, 2)}`,
      loading: tvlLoading || othersLoading
    };
  }, [pools, tvlLoading]);

  const totalVolumeSummary = useMemo(() => {
    // Use latest day's volume from chart data (24h volume)
    if (!chartData || chartData.length === 0) {
      return { value: null as string | null, loading: volumeLoading };
    }

    // Get the most recent day's volume
    const latestDayVolume = chartData[chartData.length - 1]?.volume ?? 0;

    if (latestDayVolume <= 0) {
      return { value: null, loading: false };
    }

    return {
      value: `$${formatCompactNumber(latestDayVolume, 2)}`,
      loading: false
    };
  }, [chartData, volumeLoading]);

  useEffect(() => {
    if (!pools.length) {
      return;
    }

    const poolSnapshots = pools.map((pool) => ({
      pair: `${pool.token0.symbol}/${pool.token1.symbol}`,
      address: pool.pairAddress,
      usdValue: pool.totalLiquidityValue ?? 0,
      loading: pool.isTvlLoading
    }));

    const totalUsd = poolSnapshots.reduce(
      (acc, snapshot) => acc + (snapshot.usdValue ?? 0),
      0
    );

    console.info("[tvl] snapshot", {
      totalUsd,
      pools: poolSnapshots
    });
  }, [pools]);

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12 max-w-7xl">
      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <div className="flex flex-col md:flex-row justify-between items-end mb-8 sm:mb-12 gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-display font-bold mb-2 uppercase">
            LIQUIDITY MATRIX
          </h1>
          <p className="font-mono text-muted-foreground text-xs sm:text-sm">
            DEPLOY CAPITAL. EARN YIELD.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="SEARCH_POOLS"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border border-border font-mono text-sm h-10 rounded-none w-full px-3 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          {hasMounted && isWalletConnected && (
            <button
              onClick={handleCreatePool}
              className="h-10 px-4 bg-primary text-black font-mono font-bold rounded-none hover:bg-primary/90 flex items-center gap-2 whitespace-nowrap"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              DEPLOY
            </button>
          )}
        </div>
      </div>

      <PoolsTable
        pools={filteredPools}
        loading={poolsLoading}
        error={poolsError}
        onRetry={handleRefreshPools}
        onSelectPool={handlePoolSelect}
        showUserPositions={showMyPositionsOnly}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

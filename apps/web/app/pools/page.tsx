"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
import { useAccount, useSwitchChain } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";
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
import { AnimatedBackground } from "@/components/background/AnimatedBackground";
import { PoolsCharts } from "@/components/pools/PoolsCharts";
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
    if (!showMyPositionsOnly) {
      return pools;
    }
    return pools.filter(
      (pool) => pool.userLpBalanceRaw && pool.userLpBalanceRaw > 0n
    );
  }, [pools, showMyPositionsOnly]);

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
    <>
      <AnimatedBackground variant="pools" />

      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <section className={styles.pageShell}>
        <div className={styles.statsChartsContainer} suppressHydrationWarning>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>
                <span className={styles.statLabelFull}>Total Value Locked</span>
                <span className={styles.statLabelShort}>TVL</span>
              </div>
              {totalTvlSummary.loading ? (
                <div className={styles.statValue}>
                  <span className={styles.statLoader}>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ) : (
                <div className={`${styles.statValue} ${styles.statValueTvl}`}>
                  {totalTvlSummary.value || "$0.00"}
                </div>
              )}
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>
                <span className={styles.statLabelFull}>24h Trading Volume</span>
                <span className={styles.statLabelShort}>24h Volume</span>
              </div>
              {totalVolumeSummary.loading ? (
                <div className={styles.statValue}>
                  <span className={styles.statLoader}>
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ) : (
                <div className={`${styles.statValue} ${styles.statValueVolume}`}>
                  {totalVolumeSummary.value || "$0.00"}
                </div>
              )}
            </div>
          </div>

          <PoolsCharts />
        </div>

        <div className={styles.toolbarRow} suppressHydrationWarning>
          {hasMounted && isWalletConnected ? (
            <div
              className={`${pageStyles.segmented} ${styles.toolbarSegmented}`}
            >
              <button
                type="button"
                className={`${pageStyles.segment} ${
                  !showMyPositionsOnly ? pageStyles.segmentActive : ""
                }`}
                onClick={() => setShowMyPositionsOnly(false)}
              >
                All Pools
              </button>
              <button
                type="button"
                className={`${pageStyles.segment} ${
                  showMyPositionsOnly ? pageStyles.segmentActive : ""
                }`}
                onClick={() => setShowMyPositionsOnly(true)}
              >
                My Positions
              </button>
            </div>
          ) : (
            <div />
          )}
          {hasMounted && isWalletConnected && (
            <button
              type="button"
              className={`${styles.primaryButton} ${styles.createButton}`}
              onClick={handleCreatePool}
            >
              Launch Pool
            </button>
          )}
        </div>

        <div className={styles.tableSection}>
          <PoolsTable
            pools={filteredPools}
            loading={poolsLoading}
            error={poolsError}
            onRetry={handleRefreshPools}
            onSelectPool={handlePoolSelect}
            showUserPositions={showMyPositionsOnly}
          />
        </div>
      </section>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

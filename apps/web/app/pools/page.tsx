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
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { megaethTestnet } from "@/lib/chains";
import {
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID,
  TOKEN_CATALOG
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import { formatNumberWithGrouping } from "@/lib/trade/math";
import type { TokenDescriptor, TokenManifest } from "@/lib/trade/types";

export default function PoolsPage() {
  const { address, chain, status } = useAccount();
  const router = useRouter();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const queryClient = useQueryClient();

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected ? (address?.toLowerCase() ?? null) : null;

  const { toasts, removeToast, showError, showSuccess } = useToasts();
  const { deployment } = useDeploymentManifest();
  const wrappedNativeAddress = deployment?.wmegaeth ?? null;

  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showMyPositionsOnly, setShowMyPositionsOnly] = useState(false);
  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(TOKEN_CATALOG);
  const [hasMounted, setHasMounted] = useState(false);

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

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
          `/deployments/${network}.json`,
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

        const manifestTokens: TokenDescriptor[] = manifest.tokens.map((token) => ({
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS,
          isNative: Boolean(token.isNative),
          wrappedAddress: token.isNative ? deployment?.wmegaeth : undefined,
          logo: token.logo,
        }));

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();
          const addToken = (token: TokenDescriptor) => {
            if (!token.address) return;
            const key = token.address.toLowerCase();
            if (!merged.has(key)) {
              merged.set(key, {
                ...token,
                decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS,
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
    refetch: refetchPools,
  } = usePools({
    tokenList,
    factoryAddress: deployment?.factory ?? null,
    wrappedNativeAddress,
    provider: readProvider,
  });

  // Fetch user balances in background (doesn't block pool list)
  const pairAddresses = useMemo(
    () => (poolsData || []).map((pool) => pool.pairAddress),
    [poolsData]
  );

  const { data: balancesData } = usePoolBalances({
    pairAddresses,
    account: walletAccount,
    provider: readProvider,
  });

  // Merge pools with balance data
  const pools: PoolsTableRow[] = useMemo(() => {
    if (!poolsData) return [];

    return poolsData.map((pool) => {
      const balance = balancesData?.get(pool.pairAddress.toLowerCase());
      return {
        ...pool,
        userLpBalance: balance && balance > 0n ? balance.toString() : undefined,
        userLpBalanceRaw: balance && balance > 0n ? balance : undefined,
        reserves: pool.reserves,
        totalSupply: pool.totalSupply,
        reserve0Exact: pool.reserve0Exact,
        reserve1Exact: pool.reserve1Exact,
        totalLiquidityValue: null,
        totalLiquidityFormatted: null,
        isTvlLoading: true
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
      if (pool.reserves && pool.totalSupply && pool.contractToken0Address && pool.contractToken1Address) {
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

  const tokenPriceAddresses = useMemo(() => {
    if (!poolsData?.length) return [];
    const addresses = new Set<string>();

    poolsData.forEach((pool) => {
      if (pool.contractToken0Address) {
        addresses.add(pool.contractToken0Address.toLowerCase());
      }
      if (pool.contractToken1Address) {
        addresses.add(pool.contractToken1Address.toLowerCase());
      }
    });

    if (wrappedNativeAddress) {
      addresses.add(wrappedNativeAddress.toLowerCase());
    }

    return Array.from(addresses);
  }, [poolsData, wrappedNativeAddress]);

  const {
    data: usdPriceMapData,
    isPending: tokenPricesPending,
    isFetching: tokenPricesFetching
  } = useTokenPrices(tokenPriceAddresses);

  const [usdPriceCache, setUsdPriceCache] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (tokenPriceAddresses.length === 0) {
      setUsdPriceCache(new Map());
      return;
    }
    if (!usdPriceMapData) {
      return;
    }

    const entries = Object.entries(usdPriceMapData ?? {});
    if (entries.length === 0) {
      // Keep previous prices if we received no data (e.g., upstream failure)
      return;
    }

    setUsdPriceCache((prev) => {
      const next = new Map(prev);
      const requested = new Set(tokenPriceAddresses.map((addr) => addr.toLowerCase()));

      entries.forEach(([address, value]) => {
        const lower = address.toLowerCase();
        if (Number.isFinite(value)) {
          const numeric = Number(value);
          next.set(lower, numeric);
        }
      });

      next.forEach((_, key) => {
        if (!requested.has(key)) {
          next.delete(key);
        }
      });

      return next;
    });
  }, [usdPriceMapData, tokenPriceAddresses]);

  const usdPriceMap = usdPriceCache;
  const hasTokenPriceQuery = tokenPriceAddresses.length > 0;
  const tvlLoading =
    hasTokenPriceQuery &&
    (tokenPricesPending || (tokenPricesFetching && usdPriceMap.size === 0));

  const derivedPriceMap = useMemo(() => {
    if (!pools.length) return usdPriceMap;

    const priceMap = new Map(usdPriceMap);
    let updated = true;
    let iterations = 0;
    const maxIterations = pools.length * 2;

    while (updated && iterations < maxIterations) {
      updated = false;
      iterations += 1;

      for (const pool of pools) {
        const token0Lower = pool.contractToken0Address?.toLowerCase();
        const token1Lower = pool.contractToken1Address?.toLowerCase();
        const reserve0 = pool.reserve0Exact ?? 0;
        const reserve1 = pool.reserve1Exact ?? 0;

        if (!token0Lower || !token1Lower || reserve0 <= 0 || reserve1 <= 0) {
          continue;
        }

        const price0 = priceMap.get(token0Lower);
        const price1 = priceMap.get(token1Lower);

        if (
          (price0 === undefined || price0 === null || price0 <= 0) &&
          price1 !== undefined &&
          price1 !== null &&
          price1 > 0
        ) {
          const derivedPrice0 = (price1 * reserve1) / reserve0;
          if (Number.isFinite(derivedPrice0) && derivedPrice0 > 0) {
            priceMap.set(token0Lower, derivedPrice0);
            updated = true;
          }
        } else if (
          (price1 === undefined || price1 === null || price1 <= 0) &&
          price0 !== undefined &&
          price0 !== null &&
          price0 > 0
        ) {
          const derivedPrice1 = (price0 * reserve0) / reserve1;
          if (Number.isFinite(derivedPrice1) && derivedPrice1 > 0) {
            priceMap.set(token1Lower, derivedPrice1);
            updated = true;
          }
        }
      }
    }

    return priceMap;
  }, [pools, usdPriceMap]);

  const poolsWithUsd: PoolsTableRow[] = useMemo(() => {
    if (!pools.length) return [];
    const wethLower = wrappedNativeAddress?.toLowerCase() ?? "";

    const enriched = pools.map((pool) => {
      const token0Lower = pool.contractToken0Address?.toLowerCase() ?? "";
      const token1Lower = pool.contractToken1Address?.toLowerCase() ?? "";
      const price0 = token0Lower ? derivedPriceMap.get(token0Lower) ?? null : null;
      const price1 = token1Lower ? derivedPriceMap.get(token1Lower) ?? null : null;

      let totalUsd = 0;

      if (price0 !== null && Number.isFinite(price0)) {
        totalUsd += (pool.reserve0Exact ?? 0) * price0;
      }
      if (price1 !== null && Number.isFinite(price1)) {
        totalUsd += (pool.reserve1Exact ?? 0) * price1;
      }

      if (totalUsd <= 0 && wethLower) {
        const ethPrice = derivedPriceMap.get(wethLower);
        if (ethPrice && Number.isFinite(ethPrice)) {
          const token0IsWeth = token0Lower === wethLower;
          const token1IsWeth = token1Lower === wethLower;

          if (token0IsWeth) {
            totalUsd = (pool.reserve0Exact ?? 0) * ethPrice * 2;
          } else if (token1IsWeth) {
            totalUsd = (pool.reserve1Exact ?? 0) * ethPrice * 2;
          }
        }
      }

      const hasUsdValue = totalUsd > 0;
      const formatted = hasUsdValue ? formatNumberWithGrouping(totalUsd, 2) : null;

      return {
        ...pool,
        totalLiquidityValue: hasUsdValue ? totalUsd : null,
        totalLiquidityFormatted: formatted,
        isTvlLoading: !hasUsdValue && tvlLoading
      };
    });

    const sorted = [...enriched].sort((a, b) => {
      const tvlA = a.totalLiquidityValue ?? 0;
      const tvlB = b.totalLiquidityValue ?? 0;
      if (tvlA === tvlB) {
        return a.id - b.id;
      }
      return tvlB - tvlA;
    });

    return sorted.map((pool, index) => ({
      ...pool,
      id: index + 1
    }));
  }, [pools, derivedPriceMap, tvlLoading, wrappedNativeAddress]);

  const filteredPools = useMemo(() => {
    if (!showMyPositionsOnly) {
      return poolsWithUsd;
    }
    return poolsWithUsd.filter(
      (pool) => pool.userLpBalanceRaw && pool.userLpBalanceRaw > 0n
    );
  }, [poolsWithUsd, showMyPositionsOnly]);

  const totalTvlSummary = useMemo(() => {
    if (filteredPools.length === 0) {
      return { value: null as string | null, loading: tvlLoading && hasTokenPriceQuery };
    }

    const poolsWithValues = filteredPools.filter(
      (pool) =>
        typeof pool.totalLiquidityValue === "number" &&
        pool.totalLiquidityValue !== null &&
        pool.totalLiquidityValue > 0
    );

    if (poolsWithValues.length === 0) {
      const anyLoading = filteredPools.some((pool) => pool.isTvlLoading);
      return { value: null, loading: anyLoading && tvlLoading };
    }

    const totalValue = poolsWithValues.reduce(
      (acc, pool) => acc + (pool.totalLiquidityValue ?? 0),
      0
    );

    if (totalValue <= 0) {
      return { value: null, loading: false };
    }

    const othersLoading = filteredPools.some(
      (pool) =>
        (!pool.totalLiquidityValue || pool.totalLiquidityValue <= 0) &&
        pool.isTvlLoading
    );

    return {
      value: `$${formatNumberWithGrouping(totalValue, 2)}`,
      loading: othersLoading && tvlLoading
    };
  }, [filteredPools, tvlLoading, hasTokenPriceQuery]);

  return (
    <>
      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <section className={styles.pageShell}>
        <div className={styles.pageHeader}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>Pools</h1>
          </div>
          <p className={styles.description}>
            Provide liquidity to trading pairs and earn fees from every swap.
          </p>
        </div>

        <div className={styles.toolbarRow}>
          {hasMounted && isWalletConnected ? (
            <div className={pageStyles.segmented}>
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
            <span />
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleCreatePool}
          >
            Create
          </button>
        </div>

        <div className={styles.tableSection}>
          <PoolsTable
            pools={filteredPools}
            loading={poolsLoading}
            error={poolsError}
            onRetry={handleRefreshPools}
            onSelectPool={handlePoolSelect}
            totalTvl={totalTvlSummary.value}
            totalTvlLoading={totalTvlSummary.loading}
          />
        </div>
      </section>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

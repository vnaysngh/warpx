"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
import {
  useAccount,
  useSwitchChain,
  useWalletClient
} from "wagmi";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";
import { ToastContainer } from "@/components/Toast";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { PoolsTable, type PoolsTableRow } from "@/components/pools/PoolsTable";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useWalletProvider } from "@/hooks/useWalletProvider";
import { megaethTestnet } from "@/lib/chains";
import {
  DEFAULT_TOKEN_DECIMALS,
  MINIMUM_LIQUIDITY,
  MEGAETH_CHAIN_ID,
  TOKEN_CATALOG
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import type { TokenDescriptor, TokenManifest } from "@/lib/trade/types";
import { formatNumber } from "@/lib/trade/math";
import { fetchPair, toSdkToken } from "@/lib/trade/warp";
import { getToken } from "@/lib/contracts";

export default function PoolsPage() {
  const {
    address,
    chain,
    status
  } = useAccount();
  const router = useRouter();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { walletProvider, walletSigner } = useWalletProvider(walletClient);

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const { toasts, removeToast, showError, showLoading, showSuccess } =
    useToasts();
  const { deployment } = useDeploymentManifest();

  const [networkError, setNetworkError] = useState<string | null>(null);
  const [showMyPositionsOnly, setShowMyPositionsOnly] = useState(false);

  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(TOKEN_CATALOG);
  const [pools, setPools] = useState<PoolsTableRow[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [poolsRefreshNonce, setPoolsRefreshNonce] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
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
            decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
          })
        );

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();
          const addToken = (token: TokenDescriptor) => {
            if (!token.address) return;
            merged.set(token.address.toLowerCase(), {
              ...token,
              decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
            });
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
  }, [deployment?.network]);

  useEffect(() => {
    const factoryAddress = deployment?.factory;
    if (!factoryAddress || tokenList.length < 2) return;

    let cancelled = false;

    const fetchPools = async () => {
      setPoolsLoading(true);
      setPoolsError(null);

      try {
        const descriptorMap = new Map<string, TokenDescriptor>();
        tokenList.forEach((token) =>
          descriptorMap.set(token.address.toLowerCase(), token)
        );
        const sdkTokenCache = new Map<string, ReturnType<typeof toSdkToken>>();
        const ensureSdkToken = (descriptor: TokenDescriptor) => {
          const key = descriptor.address.toLowerCase();
          const cached = sdkTokenCache.get(key);
          if (cached) return cached;
          const sdkToken = toSdkToken(descriptor);
          sdkTokenCache.set(key, sdkToken);
          return sdkToken;
        };
        const fallbackDescriptor = (token: ReturnType<typeof toSdkToken>): TokenDescriptor => {
          const suffix = token.address.slice(2, 6).toUpperCase();
          return {
            address: token.address,
            symbol: token.symbol ?? `TOK${suffix}`,
            name: token.name ?? `Token ${suffix}`,
            decimals: token.decimals
          };
        };

        const pairsToCheck: Array<{
          tokenA: TokenDescriptor;
          tokenB: TokenDescriptor;
        }> = [];

        for (let i = 0; i < tokenList.length; i++) {
          for (let j = i + 1; j < tokenList.length; j++) {
            const tokenA = tokenList[i];
            const tokenB = tokenList[j];
            if (!tokenA?.address || !tokenB?.address) continue;
            pairsToCheck.push({ tokenA, tokenB });
          }
        }

        const poolResults: Array<Omit<PoolsTableRow, "id">> = [];
        const CONCURRENCY = 5;

        const processPair = async (
          pair: (typeof pairsToCheck)[number]
        ): Promise<Omit<PoolsTableRow, "id"> | null> => {
          if (cancelled) return null;

          try {
            const tokenA = ensureSdkToken(pair.tokenA);
            const tokenB = ensureSdkToken(pair.tokenB);
            const sdkPair = await fetchPair(
              tokenA,
              tokenB,
              readProvider,
              factoryAddress
            );

            if (!sdkPair) {
              return null;
            }

            if (cancelled) return null;

            const totalSupplyWei = sdkPair.liquidityTokenTotalSupply ?? null;
            if (
              totalSupplyWei !== null &&
              typeof totalSupplyWei === "bigint" &&
              totalSupplyWei <= MINIMUM_LIQUIDITY
            ) {
              return null;
            }

            const token0Descriptor =
              descriptorMap.get(sdkPair.token0.address.toLowerCase()) ??
              fallbackDescriptor(sdkPair.token0);
            const token1Descriptor =
              descriptorMap.get(sdkPair.token1.address.toLowerCase()) ??
              fallbackDescriptor(sdkPair.token1);

            const reserve0Value = Number(sdkPair.reserve0.toExact(6));
            const reserve1Value = Number(sdkPair.reserve1.toExact(6));

            const totalLiquidityValue =
              (Number.isFinite(reserve0Value) ? reserve0Value : 0) +
              (Number.isFinite(reserve1Value) ? reserve1Value : 0);

            // Fetch user LP balance if wallet is connected
            let userLpBalance: string | undefined;
            let userLpBalanceRaw: bigint | undefined;

            if (walletAccount) {
              try {
                const lpToken = getToken(sdkPair.address, readProvider);
                const balance = await lpToken.balanceOf(walletAccount);
                userLpBalanceRaw = balance;
                userLpBalance = balance > 0n ? balance.toString() : undefined;
              } catch (balanceError) {
                console.warn(
                  "[pools] failed to fetch LP balance",
                  sdkPair.address,
                  balanceError
                );
              }
            }

            return {
              pairAddress: sdkPair.address,
              token0: token0Descriptor,
              token1: token1Descriptor,
              totalLiquidityFormatted: formatNumber(totalLiquidityValue, 2),
              totalLiquidityValue,
              userLpBalance,
              userLpBalanceRaw
            };
          } catch (pairDataError) {
            console.warn(
              "[pools] failed to load pair data",
              `${pair.tokenA.symbol}/${pair.tokenB.symbol}`,
              pairDataError
            );
            return null;
          }
        };

        for (
          let i = 0;
          i < pairsToCheck.length && !cancelled;
          i += CONCURRENCY
        ) {
          const batch = pairsToCheck.slice(i, i + CONCURRENCY);
          // eslint-disable-next-line no-await-in-loop
          const batchResults = await Promise.all(
            batch.map((pair) => processPair(pair))
          );

          batchResults.forEach((result) => {
            if (result) {
              poolResults.push(result);
            }
          });
        }

        if (cancelled) return;

        const ranked = poolResults
          .sort((a, b) => b.totalLiquidityValue - a.totalLiquidityValue)
          .map((pool, index) => ({
            ...pool,
            id: index + 1
          }));

        setPools(ranked);
        setLastUpdated(Date.now());
      } catch (error) {
        if (cancelled) return;
        console.error("[pools] failed to fetch pools", error);
        setPools([]);
        setPoolsError(
          error instanceof Error ? error.message : "Failed to load pools."
        );
      } finally {
        if (!cancelled) {
          setPoolsLoading(false);
        }
      }
    };

    fetchPools();

    return () => {
      cancelled = true;
    };
  }, [deployment?.factory, tokenList, readProvider, poolsRefreshNonce, walletAccount]);

  const switchToMegaEth = useCallback(async () => {
    if (!switchChainAsync) {
      showError("Wallet does not support programmatic chain switching.");
      return;
    }
    try {
      showLoading("Switching network...");
      await switchChainAsync({ chainId: Number(MEGAETH_CHAIN_ID) });
      showSuccess("Network switched successfully.");
    } catch (switchError) {
      console.error("[network] switch failed", switchError);
      showError(parseErrorMessage(switchError));
    }
  }, [switchChainAsync, showError, showLoading, showSuccess]);

  const handleRefreshPools = useCallback(() => {
    setPoolsError(null);
    setPoolsRefreshNonce((nonce) => nonce + 1);
  }, []);

  const handlePoolSelect = useCallback(
    (pool: PoolsTableRow) => {
      router.push(`/pools/${pool.pairAddress.toLowerCase()}`);
    },
    [router]
  );

  // Filter pools based on toggle state
  const filteredPools = useMemo(() => {
    if (!showMyPositionsOnly) {
      return pools;
    }
    return pools.filter((pool) => pool.userLpBalanceRaw && pool.userLpBalanceRaw > 0n);
  }, [pools, showMyPositionsOnly]);

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
            Explore every pool derived from the current MegaETH deployment.
          </p>
        </div>

        {hasMounted && isWalletConnected && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
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
          </div>
        )}

        <div className={styles.tableSection}>
          <PoolsTable
            pools={filteredPools}
            loading={poolsLoading}
            error={poolsError}
            onRetry={handleRefreshPools}
            onSelectPool={handlePoolSelect}
          />
        </div>
      </section>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

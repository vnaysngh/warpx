"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
import {
  useAccount,
  useSwitchChain
} from "wagmi";
import pageStyles from "../page.module.css";
import styles from "./page.module.css";
import { ToastContainer } from "@/components/Toast";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { PoolsTable, type PoolsTableRow } from "@/components/pools/PoolsTable";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
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

const NATIVE_SYMBOL = (process.env.NEXT_PUBLIC_NATIVE_SYMBOL ?? "ETH").toUpperCase();

const isNativeToken = (token?: TokenDescriptor | null) =>
  Boolean(token?.isNative) || token?.symbol?.toUpperCase() === NATIVE_SYMBOL;

const orderTokensForDisplay = <T extends TokenDescriptor>(
  tokenA: T,
  tokenB: T
): [T, T] => {
  const aNative = isNativeToken(tokenA);
  const bNative = isNativeToken(tokenB);
  if (aNative && !bNative) {
    return [tokenB, tokenA];
  }
  if (bNative && !aNative) {
    return [tokenA, tokenB];
  }
  return [tokenA, tokenB];
};

export default function PoolsPage() {
  const {
    address,
    chain,
    status
  } = useAccount();
  const router = useRouter();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const { toasts, removeToast, showError, showLoading, showSuccess } =
    useToasts();
  const { deployment } = useDeploymentManifest();
  const wrappedNativeAddress = deployment?.wmegaeth ?? null;

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

        const manifestTokens: TokenDescriptor[] = manifest.tokens.map((token) => ({
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS,
          isNative: Boolean(token.isNative),
          wrappedAddress: token.isNative ? deployment?.wmegaeth : undefined,
          logo: token.logo
        }));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const symbol = token.symbol ?? `TOK${suffix}`;
          const isNative = symbol.toUpperCase() === NATIVE_SYMBOL;
          return {
            address: isNative && wrappedNativeAddress ? wrappedNativeAddress : token.address,
            symbol,
            name: token.name ?? `Token ${suffix}`,
            decimals: token.decimals,
            isNative,
            wrappedAddress: isNative ? wrappedNativeAddress ?? token.address : undefined
          };
        };

        const pairsToCheck: Array<{
          tokenA: TokenDescriptor;
          tokenB: TokenDescriptor;
        }> = [];

        for (let i = 0; i < tokenList.length; i++) {
          for (let j = i + 1; j < tokenList.length; j++) {
            const [tokenA, tokenB] = orderTokensForDisplay(
              tokenList[i],
              tokenList[j]
            );
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

            // Only skip if pair doesn't exist at all
            if (!sdkPair) {
              return null;
            }

            if (cancelled) return null;

            // Show all initialized pools, including those with only MINIMUM_LIQUIDITY
            // This allows new users to discover pools they can add liquidity to

            const token0Descriptor =
              descriptorMap.get(sdkPair.token0.address.toLowerCase()) ??
              fallbackDescriptor(sdkPair.token0);
            const token1Descriptor =
              descriptorMap.get(sdkPair.token1.address.toLowerCase()) ??
              fallbackDescriptor(sdkPair.token1);

            const [displayToken0, displayToken1] = orderTokensForDisplay(
              token0Descriptor,
              token1Descriptor
            );

            const reserve0Value = Number(sdkPair.reserve0.toExact(6));
            const reserve1Value = Number(sdkPair.reserve1.toExact(6));

            // Calculate TVL in ETH
            // Check which token is ETH/WETH
            const token0Lower = sdkPair.token0.address.toLowerCase();
            const token1Lower = sdkPair.token1.address.toLowerCase();
            const wethLower = wrappedNativeAddress?.toLowerCase() ?? "";

            let totalLiquidityValue = 0;

            if (wethLower && token0Lower === wethLower) {
              // Token0 is WETH, so TVL = reserve0 * 2
              totalLiquidityValue = (Number.isFinite(reserve0Value) ? reserve0Value : 0) * 2;
            } else if (wethLower && token1Lower === wethLower) {
              // Token1 is WETH, so TVL = reserve1 * 2
              totalLiquidityValue = (Number.isFinite(reserve1Value) ? reserve1Value : 0) * 2;
            } else {
              // No ETH in pair, sum both reserves as fallback
              totalLiquidityValue =
                (Number.isFinite(reserve0Value) ? reserve0Value : 0) +
                (Number.isFinite(reserve1Value) ? reserve1Value : 0);
            }

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
              token0: displayToken0,
              token1: displayToken1,
              totalLiquidityFormatted: formatNumber(
                totalLiquidityValue,
                totalLiquidityValue < 1 ? 6 : 2
              ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Provide liquidity to trading pairs and earn fees from every swap.
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

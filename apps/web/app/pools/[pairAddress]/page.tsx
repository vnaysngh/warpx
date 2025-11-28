"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
import { useAccount, useSwitchChain } from "wagmi";
import { ArrowLeft } from "lucide-react";
import styles from "../page.module.css";
import { ToastContainer } from "@/components/Toast";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { LiquidityContainer } from "@/components/trade/LiquidityContainer";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { TokenLogo } from "@/components/TokenLogo";
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useTokenManager } from "@/hooks/useTokenManager";
import { usePoolStaticData, usePoolDynamicData } from "@/hooks/usePoolDetails";
import { usePools } from "@/hooks/usePools";
import { megaethTestnet } from "@/lib/chains";
import {
  MEGAETH_CHAIN_ID,
  DEFAULT_TOKEN_DECIMALS,
  FEES_DENOMINATOR,
  FEES_NUMERATOR
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import type { TokenDescriptor } from "@/lib/trade/types";
import { appKit } from "@/lib/wagmi";

const NATIVE_SYMBOL = (
  process.env.NEXT_PUBLIC_NATIVE_SYMBOL ?? "ETH"
).toUpperCase();

const isNativeToken = (token?: TokenDescriptor | null) =>
  Boolean(token?.isNative) || token?.symbol?.toUpperCase() === NATIVE_SYMBOL;

// Helper to display "ETH" instead of wrapped token symbol
const getDisplaySymbol = (token: TokenDescriptor): string => {
  if (token.isNative || token.symbol.toUpperCase() === "WMETH") {
    return "ETH";
  }
  if (
    token.symbol.length > 1 &&
    token.symbol[0] === "X" &&
    token.symbol[1] === token.symbol[1].toUpperCase()
  ) {
    return `x${token.symbol.slice(1)}`;
  }
  return token.symbol;
};

const FEE_PERCENT = (
  (Number(FEES_DENOMINATOR - FEES_NUMERATOR) / Number(FEES_DENOMINATOR)) *
  100
).toFixed(2);

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

const normalizeParam = (
  value: string | string[] | undefined
): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.toLowerCase() ?? null;
  return value.toLowerCase();
};

const formatAddress = (address?: string | null) => {
  if (!address) return null;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

export default function PoolLiquidityPage() {
  const params = useParams<{ pairAddress?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const pairAddress = normalizeParam(params?.pairAddress);

  const {
    address,
    isConnecting: isAccountConnecting,
    chain,
    status
  } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const { toasts, removeToast, showLoading, showSuccess, showError } =
    useToasts();
  const { deployment } = useDeploymentManifest();

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const wrappedNativeAddress = deployment?.wmegaeth ?? null;
  const wrappedNativeLower = wrappedNativeAddress?.toLowerCase() ?? null;
  const [pairTokenAddresses, setPairTokenAddresses] = useState<{
    token0: string | null;
    token1: string | null;
  }>({
    token0: null,
    token1: null
  });

  const {
    tokenList,
    setTokenList,
    liquidityTokenA,
    setLiquidityTokenA,
    liquidityTokenB,
    setLiquidityTokenB,
    tokenDialogOpen,
    tokenDialogSide,
    tokenSearch,
    setTokenSearch,
    openTokenDialog,
    closeTokenDialog,
    handleSelectToken,
    handleSelectCustomToken,
    filteredTokens,
    showCustomOption,
    activeAddress,
    isFetchingCustomToken,
    prefetchedTokenDetails
  } = useTokenManager(deployment, {
    provider: readProvider,
    initialLiquidityA: null,
    initialLiquidityB: null
  });

  const tokenListMap = useMemo(() => {
    const map = new Map<string, TokenDescriptor>();
    tokenList.forEach((token) => {
      if (token.address) {
        map.set(token.address.toLowerCase(), token);
      }
    });
    return map;
  }, [tokenList]);

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const pairTargetRef = useRef<{
    token0: string | null;
    token1: string | null;
  }>({
    token0: null,
    token1: null
  });

  const [hasMounted, setHasMounted] = useState(false);

  // Fetch pools data from indexer for TVL and other metrics
  const { data: poolsData } = usePools({
    tokenList,
    factoryAddress: deployment?.factory ?? null,
    wrappedNativeAddress: wrappedNativeAddress,
    provider: readProvider
  });

  // Find the current pool from the pools data
  const currentPoolData = useMemo(() => {
    if (!poolsData || !pairAddress) return null;
    return poolsData.find(
      (pool) => pool.pairAddress.toLowerCase() === pairAddress.toLowerCase()
    );
  }, [poolsData, pairAddress]);

  // Use optimized multicall hook to fetch pool details
  const {
    data: staticData,
    isLoading: staticLoading,
    error: staticError
  } = usePoolStaticData({
    pairAddress,
    provider: readProvider,
    enabled: !!pairAddress && tokenList.length > 0
  });

  const {
    data: dynamicData,
    isLoading: dynamicLoading,
    error: dynamicError
  } = usePoolDynamicData({
    pairAddress,
    account: walletAccount,
    provider: readProvider,
    enabled: !!pairAddress && tokenList.length > 0
  });

  const poolDetails = useMemo(() => {
    if (!staticData || !dynamicData) return undefined;
    return {
      ...staticData,
      ...dynamicData
    };
  }, [staticData, dynamicData]);

  const poolDetailsLoading = staticLoading || dynamicLoading;
  const poolDetailsError = staticError || dynamicError;

  // Derive network error from chain state
  const networkError = useMemo(() => {
    if (!chain) return null;
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      return `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`;
    }
    return null;
  }, [chain]);

  // Derive pair resolution error
  const pairResolutionError = useMemo(() => {
    if (!pairAddress) return "Pool address missing from URL.";
    if (poolDetailsError)
      return "Unable to load pool data. Verify the pool address.";
    return null;
  }, [pairAddress, poolDetailsError]);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  // Track mount state for hydration
  useEffect(() => {
    // This effect only runs once on mount, which is its intended purpose
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!tokenDialogOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTokenDialog();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [tokenDialogOpen, closeTokenDialog]);

  useEffect(() => {
    if (!tokenDialogOpen) return;
    if (pairAddress) {
      closeTokenDialog();
    }
  }, [tokenDialogOpen, pairAddress, closeTokenDialog]);

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

  // Use poolDetails to set tokens when data is available
  useEffect(() => {
    if (!poolDetails || !tokenList.length) return;

    const token0Lower = poolDetails.token0Address.toLowerCase();
    const token1Lower = poolDetails.token1Address.toLowerCase();

    // Helper to find or generate token descriptor
    const ensureDescriptor = (address: string): TokenDescriptor | null => {
      const lower = address.toLowerCase();
      const fromList = tokenListMap.get(lower);
      if (fromList) return fromList;

      if (wrappedNativeLower && lower === wrappedNativeLower) {
        const nativeDescriptor: TokenDescriptor = {
          symbol: NATIVE_SYMBOL,
          name: NATIVE_SYMBOL,
          address: wrappedNativeAddress!,
          decimals: DEFAULT_TOKEN_DECIMALS,
          isNative: true,
          wrappedAddress: wrappedNativeAddress!
        };
        // We don't update tokenList here to avoid side-effects during render calculation
        // The missing token will be added via the setTokenList call below if needed
        return nativeDescriptor;
      }

      // Return null instead of fallback to show loading state
      return null;
    };

    const descriptor0 = ensureDescriptor(poolDetails.token0Address);
    const descriptor1 = ensureDescriptor(poolDetails.token1Address);

    if (!descriptor0 || !descriptor1) {
      return;
    }

    // Apply display ordering (non-native tokens first)
    const [targetTokenA, targetTokenB] = orderTokensForDisplay(
      descriptor0,
      descriptor1
    );

    // Check if we need to update the state
    // We update if:
    // 1. Addresses don't match
    // 2. Symbols don't match (e.g. upgraded from TOKxxxx to MONKS)
    // 3. Current tokens are null
    const needsUpdate =
      !liquidityTokenA ||
      !liquidityTokenB ||
      liquidityTokenA.address.toLowerCase() !== targetTokenA.address.toLowerCase() ||
      liquidityTokenB.address.toLowerCase() !== targetTokenB.address.toLowerCase() ||
      liquidityTokenA.symbol !== targetTokenA.symbol ||
      liquidityTokenB.symbol !== targetTokenB.symbol;


    if (!needsUpdate) {
      return;
    }

    // Batch state updates
    pairTargetRef.current = {
      token0: token0Lower,
      token1: token1Lower
    };

    // Use a microtask to batch setState calls
    Promise.resolve().then(() => {
      // pairTokenAddresses keeps the POOL's actual token0/token1 order (for reserve mapping)
      setPairTokenAddresses({ token0: token0Lower, token1: token1Lower });
      // liquidityTokenA/B use the DISPLAY order (non-native first)
      setLiquidityTokenA(targetTokenA);
      setLiquidityTokenB(targetTokenB);

    });
  }, [
    poolDetails,
    tokenList.length,
    tokenListMap,
    wrappedNativeLower,
    wrappedNativeAddress,
    liquidityTokenA,
    liquidityTokenB,
    setLiquidityTokenA,
    setLiquidityTokenB,
    setTokenList
  ]);

  // Separate effect to fetch missing token details via RPC
  useEffect(() => {
    if (!poolDetails) return;

    const checkAndFetch = async (address: string) => {
      const lower = address.toLowerCase();
      // If already in list (and not a fallback), skip
      const existing = tokenListMap.get(lower);
      if (existing && !existing.symbol.startsWith("TOK")) return;

      // If we have subgraph data, we might not need to fetch, but if ensureDescriptor
      // fell back to TOK..., it means subgraph data was missing or insufficient.
      
      // Check if we are already fetching this token to avoid spam
      // (Simple implementation: just let the fetch happen, useTokenManager might handle some caching or we rely on browser cache)
      
      try {
        // Dynamic import to avoid circular dependencies if any, though fetchTokenDetails is a util
        const { fetchTokenDetails } = await import("@/lib/utils/tokenFetch");
        const details = await fetchTokenDetails(address, readProvider);
        
        if (details) {
           setTokenList((prev) => {
            // Check again if added
            if (prev.some(t => t.address.toLowerCase() === lower && !t.symbol.startsWith("TOK"))) return prev;
            
            const newToken: TokenDescriptor = {
              symbol: details.symbol,
              name: details.name,
              address: details.address,
              decimals: details.decimals,
              isNative: false
            };

            // Replace existing fallback or add new
            const filtered = prev.filter(t => t.address.toLowerCase() !== lower);
            return [...filtered, newToken];
           });
        }
      } catch (err) {
        console.warn("[pool] failed to fetch token details", address, err);
      }
    };

    checkAndFetch(poolDetails.token0Address);
    checkAndFetch(poolDetails.token1Address);
  }, [poolDetails, tokenListMap, readProvider, setTokenList]);

  // Log poolDetails errors
  useEffect(() => {
    if (poolDetailsError) {
      console.error("[pool] failed to load pool details", poolDetailsError);
    }
  }, [poolDetailsError]);

  useEffect(() => {
    if (!pairAddress || !pathname) return;
    const canonicalPath = `/pools/${pairAddress}`;
    if (pathname.toLowerCase() !== canonicalPath.toLowerCase()) {
      router.replace(canonicalPath);
    }
  }, [pairAddress, pathname, router]);

  const chainId = chain?.id ?? null;
  const handleSwapRefresh = useCallback(() => {
    // Liquidity updates do not need to trigger external side effects yet.
  }, []);

  const handleBackToPools = useCallback(() => {
    router.push("/pools");
  }, [router]);

  const handleConnectWallet = useCallback(() => {
    appKit.open();
  }, []);

  const breadcrumbPairLabel = useMemo(() => {
    if (liquidityTokenA && liquidityTokenB) {
      const [displayA, displayB] = orderTokensForDisplay(
        liquidityTokenA,
        liquidityTokenB
      );
      return `${getDisplaySymbol(displayA)}/${getDisplaySymbol(displayB)}`;
    }

    const token0 =
      pairTokenAddresses.token0 &&
      tokenListMap.get(pairTokenAddresses.token0.toLowerCase());
    const token1 =
      pairTokenAddresses.token1 &&
      tokenListMap.get(pairTokenAddresses.token1.toLowerCase());

    if (token0 && token1) {
      const [displayA, displayB] = orderTokensForDisplay(token0, token1);
      return `${getDisplaySymbol(displayA)}/${getDisplaySymbol(displayB)}`;
    }

    return null;
  }, [
    liquidityTokenA,
    liquidityTokenB,
    pairTokenAddresses.token0,
    pairTokenAddresses.token1,
    tokenListMap
  ]);

  const breadcrumbAddress = useMemo(
    () => formatAddress(pairAddress),
    [pairAddress]
  );

  const tvlDisplay = useMemo(() => {
    // Use indexed pool data for TVL (already formatted)
    if (currentPoolData?.totalLiquidityFormatted) {
      return `$${currentPoolData.totalLiquidityFormatted}`;
    }
    return "—";
  }, [currentPoolData]);

  const isLoading = !liquidityTokenA || !liquidityTokenB;

  return (
    <>
      <NetworkBanner
        error={networkError ?? pairResolutionError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain || poolDetailsLoading}
      />

      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {/* Header */}
        <div className="mb-12 flex items-center gap-8 pb-8 border-b border-border">
          <button
            onClick={handleBackToPools}
            className="rounded-none h-10 w-10 hover:bg-white/5 text-foreground flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1">
            {isLoading ? (
               <div className="flex items-center gap-4 mb-3 animate-pulse">
                 <div className="flex -space-x-3">
                   <div className="w-10 h-10 rounded-full bg-white/10"></div>
                   <div className="w-10 h-10 rounded-full bg-white/10"></div>
                 </div>
                 <div className="h-10 w-48 bg-white/10 rounded"></div>
               </div>
            ) : (
            <div className="flex items-center gap-4 mb-3">
              <div className="flex -space-x-3">
                {liquidityTokenA && (
                  <TokenLogo
                    logo={liquidityTokenA.logo}
                    symbol={getDisplaySymbol(liquidityTokenA)}
                    size={40}
                  />
                )}
                {liquidityTokenB && (
                  <TokenLogo
                    logo={liquidityTokenB.logo}
                    symbol={getDisplaySymbol(liquidityTokenB)}
                    size={40}
                  />
                )}
              </div>
              <h1 className="text-4xl font-display font-bold uppercase">
                {breadcrumbPairLabel ?? "Pool"}
              </h1>
              {/* <span className="text-xs bg-primary text-black px-3 py-1 font-mono font-bold">
                LIVE
              </span> */}
            </div>
            )}

            <div className="flex gap-8 text-xs font-mono text-muted-foreground">
              <div>
                <span className="text-muted-foreground">TVL</span>{" "}
                <span className="text-foreground ml-2">{tvlDisplay}</span>
              </div>
              {/* <div>
                <span className="text-muted-foreground">APR</span>{" "}
                <span className="text-primary ml-2">{FEE_PERCENT}%</span>
              </div> */}
              <div>
                <span className="text-muted-foreground">FEE</span>{" "}
                <span className="text-foreground ml-2">{FEE_PERCENT}%</span>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="w-full h-[400px] bg-white/5 animate-pulse rounded-lg"></div>
        ) : (
        <LiquidityContainer
          key={`liquidity-${deployment?.router ?? "default"}-${pairAddress ?? "unknown"}`}
          liquidityTokenA={liquidityTokenA}
          liquidityTokenB={liquidityTokenB}
          onOpenTokenDialog={openTokenDialog}
          routerAddress={deployment?.router ?? ""}
          wrappedNativeAddress={deployment?.wmegaeth}
          pairAddress={pairAddress ?? ""}
          pairToken0={pairTokenAddresses.token0}
          pairToken1={pairTokenAddresses.token1}
          readProvider={readProvider}
          walletAccount={walletAccount}
          chainId={chainId}
          hasMounted={hasMounted}
          isWalletConnected={isWalletConnected}
          isAccountConnecting={isAccountConnecting}
          ready={ready}
          showError={showError}
          showSuccess={showSuccess}
          showLoading={showLoading}
          onSwapRefresh={handleSwapRefresh}
          allowTokenSelection={false}
          poolDetails={poolDetails}
          onConnect={handleConnectWallet}
        />
        )}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      <TokenDialog
        open={tokenDialogOpen}
        onClose={closeTokenDialog}
        tokenDialogSide={tokenDialogSide}
        tokenSearch={tokenSearch}
        onSearchChange={(value) => setTokenSearch(value)}
        filteredTokens={filteredTokens}
        showCustomOption={showCustomOption}
        activeAddress={activeAddress}
        onSelectToken={handleSelectToken}
        onSelectCustomToken={handleSelectCustomToken}
        isFetchingCustomToken={isFetchingCustomToken}
        prefetchedTokenDetails={prefetchedTokenDetails}
        walletAccount={walletAccount}
        provider={readProvider}
      />
    </>
  );
}

function CopyAddressButton({
  value,
  displayValue,
  className
}: {
  value: string;
  displayValue: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!value || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("[clipboard] failed to copy value", error);
    }
  }, [value]);

  return (
    <button
      type="button"
      className={`${styles.copyTrigger} ${className ?? ""}`}
      onClick={handleCopy}
    >
      <span>{displayValue}</span>
      {copied ? (
        <CopySuccessIcon
          className={`${styles.copyIcon} ${styles.copyIconSuccess}`}
        />
      ) : (
        <CopyIcon className={styles.copyIcon} />
      )}
    </button>
  );
}

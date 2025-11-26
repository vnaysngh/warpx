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
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useTokenManager } from "@/hooks/useTokenManager";
import { usePoolDetails } from "@/hooks/usePoolDetails";
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
  } = useTokenManager(deployment, { provider: readProvider });

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
    data: poolDetails,
    isLoading: poolDetailsLoading,
    error: poolDetailsError
  } = usePoolDetails({
    pairAddress,
    account: walletAccount,
    provider: readProvider,
    enabled: !!pairAddress && tokenList.length > 0
  });

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

    const target = pairTargetRef.current;
    const token0Lower = poolDetails.token0Address.toLowerCase();
    const token1Lower = poolDetails.token1Address.toLowerCase();

    // Skip only if both tokens AND pairTokenAddresses are correctly set
    if (
      target.token0 === token0Lower &&
      target.token1 === token1Lower &&
      pairTokenAddresses.token0 === token0Lower &&
      pairTokenAddresses.token1 === token1Lower &&
      liquidityTokenA?.address.toLowerCase() &&
      liquidityTokenB?.address.toLowerCase()
    ) {
      // Check if display tokens match (regardless of order)
      const currentAddresses = new Set([
        liquidityTokenA.address.toLowerCase(),
        liquidityTokenB.address.toLowerCase()
      ]);
      const targetAddresses = new Set([token0Lower, token1Lower]);

      if (
        currentAddresses.size === targetAddresses.size &&
        [...currentAddresses].every((addr) => targetAddresses.has(addr))
      ) {
        return;
      }
    }

    const ensureDescriptor = (address: string): TokenDescriptor => {
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
        setTokenList((prev) => {
          if (prev.some((token) => token.address.toLowerCase() === lower)) {
            return prev;
          }
          return [...prev, nativeDescriptor];
        });
        return nativeDescriptor;
      }

      const suffix = lower.slice(2, 6).toUpperCase();
      const fallback: TokenDescriptor = {
        symbol: `TOK${suffix}`,
        name: `Token ${suffix}`,
        address,
        decimals: DEFAULT_TOKEN_DECIMALS,
        isNative: false
      };

      setTokenList((prev) => {
        if (prev.some((token) => token.address.toLowerCase() === lower)) {
          return prev;
        }
        return [...prev, fallback];
      });

      return fallback;
    };

    const descriptor0 = ensureDescriptor(poolDetails.token0Address);
    const descriptor1 = ensureDescriptor(poolDetails.token1Address);

    // Apply display ordering (non-native tokens first)
    const [orderedTokenA, orderedTokenB] = orderTokensForDisplay(
      descriptor0,
      descriptor1
    );

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
      setLiquidityTokenA(orderedTokenA);
      setLiquidityTokenB(orderedTokenB);
    });
  }, [
    poolDetails,
    tokenList.length,
    tokenListMap,
    wrappedNativeLower,
    wrappedNativeAddress,
    pairTokenAddresses.token0,
    pairTokenAddresses.token1,
    liquidityTokenA,
    liquidityTokenB,
    setLiquidityTokenA,
    setLiquidityTokenB,
    setTokenList
  ]);

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

  return (
    <>
      <NetworkBanner
        error={networkError ?? pairResolutionError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain || poolDetailsLoading}
      />

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-12 flex items-center gap-8 pb-8 border-b border-border">
          <button
            onClick={handleBackToPools}
            className="rounded-none h-10 w-10 hover:bg-white/5 text-foreground flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex -space-x-3">
                {liquidityTokenA?.logo && (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={liquidityTokenA.logo}
                      alt={getDisplaySymbol(liquidityTokenA)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {liquidityTokenB?.logo && (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={liquidityTokenB.logo}
                      alt={getDisplaySymbol(liquidityTokenB)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <h1 className="text-4xl font-display font-bold uppercase">
                {breadcrumbPairLabel ?? "Pool"}
              </h1>
              {/* <span className="text-xs bg-primary text-black px-3 py-1 font-mono font-bold">
                LIVE
              </span> */}
            </div>

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

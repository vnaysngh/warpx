"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { JsonRpcProvider } from "ethers";
import { useAccount, useSwitchChain } from "wagmi";
import { megaethTestnet } from "@/lib/chains";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { SwapContainer } from "@/components/trade/SwapContainer";
import { PriceChart } from "@/components/trade/PriceChart";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useTokenManager } from "@/hooks/useTokenManager";
import { usePools } from "@/hooks/usePools";
import { usePairChartData } from "@/hooks/usePairChartData";
import { MEGAETH_CHAIN_ID, TOKEN_CATALOG } from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import { appKit } from "@/lib/wagmi";
import { findPairInPools } from "@/lib/trade/pairUtils";
import { useLocalization } from "@/lib/format/LocalizationContext";
import { NumberType } from "@/lib/format/formatNumbers";
import { getDisplaySymbol } from "@/lib/trade/tokenDisplay";

export default function Page() {
  const { formatNumber: formatLocalizedNumber, formatCompactNumber: formatCompactNumberLocalized } =
    useLocalization();
  const {
    address,
    isConnecting: isAccountConnecting,
    chain,
    status
  } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const { toasts, removeToast, showLoading, showSuccess, showError } =
    useToasts();
  const { deployment } = useDeploymentManifest();

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const {
    selectedIn,
    selectedOut,
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
    swapTokens,
    isFetchingCustomToken,
    prefetchedTokenDetails
  } = useTokenManager(deployment, { provider: readProvider });

  const [hasMounted, setHasMounted] = useState(false);
  const [swapRefreshNonce, setSwapRefreshNonce] = useState(0);

  const selectedInAddress = useMemo(() => {
    if (!selectedIn) return null;
    if (selectedIn.isNative && selectedIn.wrappedAddress) {
      return selectedIn.wrappedAddress;
    }
    return selectedIn.address;
  }, [selectedIn]);

  const selectedOutAddress = useMemo(() => {
    if (!selectedOut) return null;
    if (selectedOut.isNative && selectedOut.wrappedAddress) {
      return selectedOut.wrappedAddress;
    }
    return selectedOut.address;
  }, [selectedOut]);

  // Fetch pools data for finding pair address
  const { data: poolsData } = usePools({
    tokenList: TOKEN_CATALOG,
    factoryAddress: deployment?.factory ?? null,
    wrappedNativeAddress: deployment?.wmegaeth ?? null,
    provider: readProvider
  });

  // Find pair address for selected tokens
  const pairAddress = useMemo(() => {
    if (!selectedIn || !selectedOut || !poolsData) {
      console.log("[swap] No pair address - missing data:", {
        hasSelectedIn: !!selectedIn,
        hasSelectedOut: !!selectedOut,
        hasPoolsData: !!poolsData,
        poolsCount: poolsData?.length ?? 0
      });
      return null;
    }
    const foundPair = findPairInPools(selectedIn, selectedOut, poolsData);
    console.log("[swap] Looking for pair:", {
      tokenIn: selectedIn.symbol,
      tokenOut: selectedOut.symbol,
      foundPair,
      availablePairs: poolsData.map(p => `${p.token0.symbol}-${p.token1.symbol}`)
    });
    return foundPair;
  }, [selectedIn, selectedOut, poolsData]);

  const currentPoolData = useMemo(() => {
    if (!poolsData || !pairAddress) {
      return null;
    }
    const target = pairAddress.toLowerCase();
    return poolsData.find(
      (pool) => pool.pairAddress.toLowerCase() === target
    );
  }, [poolsData, pairAddress]);

  // Fetch chart data for the selected pair
  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError
  } = usePairChartData({
    pairAddress,
    days: 7,
    tokenInAddress: selectedInAddress,
    tokenOutAddress: selectedOutAddress,
    enabled: Boolean(pairAddress && selectedInAddress && selectedOutAddress)
  });

  const pairSymbols = useMemo(() => {
    if (!selectedIn || !selectedOut) {
      return {
        label: "Select Tokens",
        tokenInSymbol: selectedIn?.symbol ?? null,
        tokenOutSymbol: selectedOut?.symbol ?? null
      };
    }
    const symbol0 = selectedIn.isNative
      ? "ETH"
      : getDisplaySymbol(selectedIn.symbol);
    const symbol1 = selectedOut.isNative
      ? "ETH"
      : getDisplaySymbol(selectedOut.symbol);
    return {
      label: `${symbol0} / ${symbol1}`,
      tokenInSymbol: symbol0,
      tokenOutSymbol: symbol1
    };
  }, [selectedIn, selectedOut]);

  const pairName = pairSymbols.label;

  // Calculate market stats from chart data
  const marketStats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        currentPrice: null,
        priceChange24h: null,
        priceChangePercent24h: null,
        volume24hUsd: null,
        priceDisplay: null,
        tokenInSymbol: pairSymbols.tokenInSymbol,
        tokenOutSymbol: pairSymbols.tokenOutSymbol
      };
    }

    const latestData = chartData[chartData.length - 1];
    const currentPrice = latestData.price;
    const tokenInSymbol = latestData.tokenInSymbol || pairSymbols.tokenInSymbol;
    const tokenOutSymbol =
      latestData.tokenOutSymbol || pairSymbols.tokenOutSymbol;

    const volume24hUsd = currentPoolData?.totalVolumeValue ?? null;

    // Calculate 24h price change (comparing with data from ~24h ago)
    // Look for data point closest to 24h ago (1 day = 86400 seconds)
    const currentTimestamp = latestData.date;
    const targetTimestamp = currentTimestamp - 86400; // 24h ago

    // Find the data point closest to 24h ago
    let closestDataPoint = chartData[0];
    let smallestDiff = Math.abs(closestDataPoint.date - targetTimestamp);

    for (const dataPoint of chartData) {
      const diff = Math.abs(dataPoint.date - targetTimestamp);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestDataPoint = dataPoint;
      }
    }

    const priceChange24h = currentPrice - closestDataPoint.price;
    const priceChangePercent24h =
      closestDataPoint.price > 0
        ? (priceChange24h / closestDataPoint.price) * 100
        : null;

    const priceDisplay =
      currentPrice !== null && tokenOutSymbol
        ? `${formatLocalizedNumber({
            input: currentPrice,
            type: NumberType.TokenTx
          })} ${tokenOutSymbol}`
        : null;

    return {
      currentPrice,
      priceChange24h,
      priceChangePercent24h,
      volume24hUsd,
      tokenInSymbol,
      tokenOutSymbol,
      priceDisplay
    };
  }, [
    chartData,
    pairSymbols.tokenInSymbol,
    pairSymbols.tokenOutSymbol,
    currentPoolData
  ]);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  // Compute network error as derived state instead of in effect
  const networkError = useMemo(() => {
    if (!walletAccount || !chain) {
      return null;
    }
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      return `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`;
    }
    return null;
  }, [walletAccount, chain]);

  useEffect(() => {
    // Client-side hydration flag - intentional setState on mount
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

  const chainId = chain?.id ?? null;
  const bumpSwapRefresh = useCallback(
    () => setSwapRefreshNonce((nonce) => nonce + 1),
    []
  );

  const handleConnectWallet = useCallback(() => {
    appKit.open();
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <div className="grid lg:grid-cols-12 gap-8 items-end">
        {/* LEFT: Market Data Module */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Stats */}
          <div className="flex flex-wrap items-end gap-8 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold">{pairName}</h1>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] bg-primary text-black px-2 py-0.5">
                LIVE
              </span>
            </div>
            <div className="flex gap-8 font-mono text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide">
                  Price
                </div>
                <div className="text-2xl font-bold text-foreground tracking-tight">
                  {marketStats.priceDisplay ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide">
                  24h Chg
                </div>
                <div
                  className={`text-xl font-bold ${
                    marketStats.priceChangePercent24h !== null
                      ? marketStats.priceChangePercent24h >= 0
                        ? "text-primary"
                        : "text-red-500"
                      : "text-foreground"
                  }`}
                >
                  {marketStats.priceChangePercent24h !== null
                    ? `${marketStats.priceChangePercent24h >= 0 ? "+" : ""}${marketStats.priceChangePercent24h.toFixed(2)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide">
              Vol (24h)
            </div>
            <div className="text-xl font-bold text-foreground">
              {marketStats.volume24hUsd !== null
                ? `$${formatCompactNumberLocalized(marketStats.volume24hUsd, 2)}`
                : "—"}
            </div>
              </div>
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-[450px] bg-card/50 border border-border relative p-4 group overflow-hidden">
            {/* Technical grid overlay */}
            <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary" />
            <div className="absolute inset-4">
              <PriceChart
                data={chartData ?? []}
                isLoading={chartLoading}
                error={chartError}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Execution Module */}
        <div className="lg:col-span-4">
          <div className="bg-card border border-border p-6 relative sticky top-24">
            <div className="absolute top-0 inset-x-0 h-1 bg-primary/20" />
            <SwapContainer
              key={`swap-${deployment?.router ?? "default"}`}
              selectedIn={selectedIn}
              selectedOut={selectedOut}
              onOpenTokenDialog={openTokenDialog}
              onSwapTokens={swapTokens}
              routerAddress={deployment?.router ?? ""}
              wrappedNativeAddress={deployment?.wmegaeth}
              readProvider={readProvider}
              walletAccount={walletAccount}
              chainId={chainId}
              hasMounted={hasMounted}
              isWalletConnected={isWalletConnected}
              isAccountConnecting={isAccountConnecting}
              ready={ready}
              showError={showError}
              refreshNonce={swapRefreshNonce}
              onRequestRefresh={bumpSwapRefresh}
              onConnect={handleConnectWallet}
            />
          </div>
        </div>
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
    </div>
  );
}

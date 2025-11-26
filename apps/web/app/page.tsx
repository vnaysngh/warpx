"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { JsonRpcProvider } from "ethers";
import {
  useAccount,
  useSwitchChain
} from "wagmi";
import { megaethTestnet } from "@/lib/chains";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { SwapContainer } from "@/components/trade/SwapContainer";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useTokenManager } from "@/hooks/useTokenManager";
import { MEGAETH_CHAIN_ID } from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import { appKit } from "@/lib/wagmi";

const MARKET_STATS = [
  { label: "Price", value: "$3,245.80", accent: "" },
  { label: "24h Chg", value: "+2.45%", accent: "text-primary" },
  { label: "Vol (24h)", value: "$1.2B", accent: "" }
];

export default function Page() {
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

  const {
    toasts,
    removeToast,
    showLoading,
    showSuccess,
    showError
  } = useToasts();
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

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Market Data Module */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Stats */}
          <div className="flex flex-wrap items-end gap-8 pb-6 border-b border-border">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                ETH / USDC
                <span className="text-xs bg-primary text-black px-2 py-0.5 font-mono font-bold rounded-sm">
                  LIVE
                </span>
              </h1>
            </div>
            <div className="flex gap-8 font-mono text-sm">
              {MARKET_STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-muted-foreground text-xs mb-1 uppercase tracking-wide">
                    {stat.label}
                  </div>
                  <div className={`text-xl font-bold ${stat.accent || 'text-foreground'}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
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
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
              Market feed
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

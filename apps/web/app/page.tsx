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
    <>
      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

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
        showSuccess={showSuccess}
        showLoading={showLoading}
        refreshNonce={swapRefreshNonce}
        onRequestRefresh={bumpSwapRefresh}
        onConnect={handleConnectWallet}
      />

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
      />
    </>
  );
}

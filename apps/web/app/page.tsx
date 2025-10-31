"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer } from "@/components/Toast";
import { JsonRpcProvider } from "ethers";
import {
  useAccount,
  useSwitchChain,
  useWalletClient
} from "wagmi";
import { megaethTestnet } from "@/lib/chains";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { SwapContainer } from "@/components/trade/SwapContainer";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useWalletProvider } from "@/hooks/useWalletProvider";
import { useTokenManager } from "@/hooks/useTokenManager";
import { MEGAETH_CHAIN_ID } from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";

export default function Page() {
  const {
    address,
    isConnecting: isAccountConnecting,
    chain,
    status
  } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { walletProvider, walletSigner } = useWalletProvider(walletClient);

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
    swapTokens
  } = useTokenManager(deployment?.network);

  const [hasMounted, setHasMounted] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [swapRefreshNonce, setSwapRefreshNonce] = useState(0);

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!walletAccount || !chain) {
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
  }, [walletAccount, chain]);

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
        factoryAddress={deployment?.factory ?? ""}
        readProvider={readProvider}
        walletAccount={walletAccount}
        walletProvider={walletProvider}
        walletSigner={walletSigner}
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
      />
    </>
  );
}

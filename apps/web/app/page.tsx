"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ToastContainer } from "@/components/Toast";
import { JsonRpcProvider } from "ethers";
import styles from "./page.module.css";
import { shortAddress } from "@/lib/utils/format";
import {
  useAccount,
  useDisconnect,
  useSwitchChain,
  useWalletClient
} from "wagmi";
import { megaethTestnet } from "@/lib/chains";
import { appKit } from "@/lib/wagmi";
import { TradeHeader } from "@/components/trade/TradeHeader";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { SwapContainer } from "@/components/trade/SwapContainer";
import { LiquidityContainer } from "@/components/trade/LiquidityContainer";
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
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { walletProvider, walletSigner } = useWalletProvider(walletClient);

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;
  const accountDisplayAddress = address ?? walletAccount ?? "";
  const shortAccountAddress = accountDisplayAddress
    ? shortAddress(accountDisplayAddress)
    : "";

  const copyTimeoutRef = useRef<number | null>(null);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    toasts,
    removeToast,
    showLoading,
    showSuccess,
    showError
  } = useToasts();
  const { deployment, loadingDeployment } = useDeploymentManifest();
  const {
    selectedIn,
    selectedOut,
    liquidityTokenA,
    liquidityTokenB,
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
    activeAddress
  } = useTokenManager(deployment?.network);

  const [hasMounted, setHasMounted] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [isWalletMenuOpen, setWalletMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeView =
    searchParams?.get("view") === "liquidity" ? "liquidity" : "swap";
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletMenuOpen(false);
      }
    };
    if (isWalletMenuOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isWalletMenuOpen]);

  useEffect(() => {
    if (!address) {
      setCopyStatus("idle");
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    }
  }, [address]);

  const handleConnectClick = useCallback(() => {
    (window as any).__appKitManualOpen = true;
    appKit.open();
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("copied");
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus("idle");
        copyTimeoutRef.current = null;
        setWalletMenuOpen(false);
      }, 1500);
    } catch (copyError) {
      console.error("[wallet] Failed to copy address", copyError);
    }
  }, [address]);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) return;
    try {
      if (typeof (window as any).__setDisconnecting === "function") {
        (window as any).__setDisconnecting(true);
      }

      await disconnectAsync();
      setWalletMenuOpen(false);
      showSuccess("Wallet disconnected.");
    } catch (disconnectError) {
      console.error("[wallet] Failed to disconnect", disconnectError);
      showError("Failed to disconnect wallet. Please try again.");
    } finally {
      if (typeof (window as any).__setDisconnecting === "function") {
        setTimeout(() => {
          (window as any).__setDisconnecting(false);
        }, 500);
      }
    }
  }, [disconnectAsync, isDisconnecting, showError, showSuccess]);

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

  const manifestTag = loadingDeployment
    ? "Loading manifest..."
    : (deployment?.network ?? "No manifest loaded");

  const chainId = chain?.id ?? null;
  const showWalletActions = hasMounted && isWalletConnected;
  const bumpSwapRefresh = useCallback(
    () => setSwapRefreshNonce((nonce) => nonce + 1),
    []
  );

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <TradeHeader
          manifestTag={manifestTag}
          showWalletActions={showWalletActions}
          walletMenuRef={walletMenuRef}
          isWalletMenuOpen={isWalletMenuOpen}
          onWalletButtonClick={() => setWalletMenuOpen((prev) => !prev)}
          shortAccountAddress={shortAccountAddress}
          onCopyAddress={handleCopyAddress}
          copyStatus={copyStatus}
          address={address}
          onDisconnect={handleDisconnect}
          isDisconnecting={isDisconnecting}
          onConnect={handleConnectClick}
          isAccountConnecting={isAccountConnecting}
          hasMounted={hasMounted}
        />

        <NetworkBanner
          error={networkError}
          onSwitch={switchToMegaEth}
          isSwitching={isSwitchingChain}
        />

        {activeView === "swap" && (
          <SwapContainer
            key={`swap-${deployment?.router ?? "default"}`}
            selectedIn={selectedIn}
            selectedOut={selectedOut}
            onOpenTokenDialog={openTokenDialog}
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
        )}

        {activeView === "liquidity" && (
          <LiquidityContainer
            key={`liquidity-${deployment?.router ?? "default"}`}
            liquidityTokenA={liquidityTokenA}
            liquidityTokenB={liquidityTokenB}
            onOpenTokenDialog={openTokenDialog}
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
            onSwapRefresh={bumpSwapRefresh}
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
      />
    </main>
  );
}

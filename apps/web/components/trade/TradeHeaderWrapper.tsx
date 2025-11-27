"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { TradeHeader } from "./TradeHeader";
import { shortAddress } from "@/lib/utils/format";
import { appKit } from "@/lib/wagmi";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useToasts } from "@/hooks/useToasts";

export function TradeHeaderWrapper() {
  const pathname = usePathname();
  const { address, isConnecting: isAccountConnecting, status } = useAccount();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { deployment, loadingDeployment } = useDeploymentManifest();
  const { showSuccess, showError } = useToasts();

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

  const [hasMounted, setHasMounted] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [isWalletMenuOpen, setWalletMenuOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!isWalletMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
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

  const manifestTag = loadingDeployment
    ? "Loading manifest..."
    : (deployment?.network ?? "No manifest loaded");

  const showWalletActions = hasMounted && isWalletConnected;

  const activeNav = pathname?.startsWith("/pools")
    ? "pools"
    : pathname?.startsWith("/analytics")
      ? "analytics"
      : "swap";

  return (
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
      activeNav={activeNav}
    />
  );
}

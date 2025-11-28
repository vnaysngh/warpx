"use client";

import { useCallback, useState } from "react";
import { useToasts } from "@/hooks/useToasts";
import styles from "./AddNetworkButton.module.css";

const MEGAETH_TESTNET = {
  chainId: "0x18C7", // 6343 in hex
  chainName: "MegaETH Testnet 2",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: [`https://timothy.megaeth.com/rpc`],
  blockExplorerUrls: ["https://megaeth-testnet-v2.blockscout.com/"]
};

export function AddNetworkButton() {
  const [isAdding, setIsAdding] = useState(false);
  const { showError, showSuccess } = useToasts();

  const addNetwork = useCallback(async () => {
    if (!window.ethereum) {
      showError("No wallet detected. Please install MetaMask or another Web3 wallet.");
      return;
    }

    setIsAdding(true);

    try {
      await (window.ethereum.request as any)({
        method: "wallet_addEthereumChain",
        params: [MEGAETH_TESTNET]
      });
      showSuccess("MegaETH Testnet added to your wallet!");
    } catch (error: any) {
      console.error("[AddNetworkButton] Failed to add network", error);

      // User rejected the request
      if (error.code === 4001) {
        showError("Request rejected. Please try again.");
      } else {
        showError(error.message || "Failed to add network");
      }
    } finally {
      setIsAdding(false);
    }
  }, [showError, showSuccess]);

  return (
    <button
      type="button"
      onClick={addNetwork}
      disabled={isAdding}
      className={styles.addNetworkButton}
      title="Add MegaETH Testnet to your wallet"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <span>{isAdding ? "Adding..." : "Add Network"}</span>
    </button>
  );
}

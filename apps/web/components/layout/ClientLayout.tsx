"use client";

import { TradeHeaderWrapper } from "@/components/trade/TradeHeaderWrapper";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { useToasts } from "@/hooks/useToasts";
import { useCallback } from "react";

const MEGAETH_TESTNET = {
  chainId: "0x18C7", // 6343 in hex
  chainName: "MegaETH Testnet 2",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["https://timothy.megaeth.com/rpc"],
  blockExplorerUrls: ["https://megaeth-testnet-v2.blockscout.com/"]
};

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { showError, showSuccess } = useToasts();

  const addNetwork = useCallback(async () => {
    if (!window.ethereum) {
      showError(
        "No wallet detected. Please install MetaMask or another Web3 wallet."
      );
      return;
    }

    try {
      await (window.ethereum.request as any)({
        method: "wallet_addEthereumChain",
        params: [MEGAETH_TESTNET]
      });
      showSuccess("MegaETH Testnet added to your wallet!");
    } catch (error: any) {
      console.error("[ClientLayout] Failed to add network", error);

      if (error.code === 4001) {
        showError("Request rejected. Please try again.");
      } else {
        showError(error.message || "Failed to add network");
      }
    }
  }, [showError, showSuccess]);

  return (
    <main className="relative min-h-screen bg-background grid-bg text-foreground">
      <div className="relative z-10 flex min-h-screen flex-col">
        <TradeHeaderWrapper />
        <div className="flex-1 pt-24">
          <div className="mx-auto w-full max-w-[1200px] px-4 pb-16">
            {children}
          </div>
        </div>
        <footer className="border-t border-border/30 bg-background/90">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span className="font-mono uppercase tracking-[0.35em]">
              Built on MegaETH Testnet
            </span>
            <div className="flex flex-wrap gap-4 text-[12px]">
              <button
                type="button"
                onClick={addNetwork}
                className="text-primary underline-offset-4 hover:underline"
              >
                Add Network
              </button>
              <a
                href="https://docs.warpx.exchange/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary"
              >
                Docs
              </a>
            </div>
          </div>
        </footer>
      </div>
      <DisclaimerModal />
    </main>
  );
}

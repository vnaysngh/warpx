"use client";

import { useCallback } from "react";
import { Twitter, MessageCircle, Send } from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { useToasts } from "@/hooks/useToasts";

const MEGAETH_TESTNET = {
  chainId: "0x18C7",
  chainName: "MegaETH Testnet 2",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["https://timothy.megaeth.com/rpc"],
  blockExplorerUrls: ["https://megaeth-testnet-v2.blockscout.com/"]
};

const socialLinks = [
  {
    href: "https://discord.gg/E7sZCw2gMS",
    label: "Discord",
    icon: DiscordIcon
  },
  {
    href: "https://x.com/warpexchange",
    label: "Twitter",
    icon: Twitter
  },
  {
    href: "https://t.me/+_300oWZNXkdjNzhl",
    label: "Telegram",
    icon: Send
  }
];

export function SiteFooter() {
  const { showError, showSuccess } = useToasts();

  const addNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
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
      console.error("[SiteFooter] Failed to add network", error);
      if (error?.code === 4001) {
        showError("Request rejected. Please try again.");
      } else {
        showError(error?.message || "Failed to add network");
      }
    }
  }, [showError, showSuccess]);

  return (
    <footer className="border-t border-border/60 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 text-xs font-mono text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
          <span>Built on MegaETH Testnet</span>
          <span className="hidden sm:inline text-border">•</span>
          <button
            type="button"
            onClick={addNetwork}
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
          >
            Add Network
          </button>
          <span className="hidden sm:inline text-border">•</span>
          <a
            href="https://docs.warpx.exchange/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
          >
            Docs
          </a>
        </div>
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="p-2 rounded-full border border-border/40 hover:border-primary/60 hover:text-primary transition-colors"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

"use client";

import { useCallback } from "react";
import { Twitter, Send } from "lucide-react";
import { DiscordIcon } from "./DiscordIcon";

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
  { href: "https://discord.gg/E7sZCw2gMS", label: "Discord", icon: DiscordIcon },
  { href: "https://x.com/warpexchange", label: "Twitter", icon: Twitter },
  { href: "https://t.me/+_300oWZNXkdjNzhl", label: "Telegram", icon: Send }
];

export function Footer() {
  const addNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      window.alert(
        "No wallet detected. Please install MetaMask or another Web3 wallet."
      );
      return;
    }

    try {
      await ((window as any).ethereum.request as any)({
        method: "wallet_addEthereumChain",
        params: [MEGAETH_TESTNET]
      });
      window.alert("MegaETH Testnet added to your wallet!");
    } catch (error: any) {
      console.error("[LandingFooter] Failed to add network", error);
      if (error?.code === 4001) {
        window.alert("Request rejected. Please try again.");
      } else {
        window.alert(error?.message || "Failed to add network.");
      }
    }
  }, []);

  return (
    <footer className="border-t border-white/10 bg-black/60 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-xs font-mono text-white/60 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
          <span>Built on MegaETH Testnet</span>
          <span className="hidden sm:inline text-white/20">•</span>
          <button
            type="button"
            onClick={addNetwork}
            className="text-[hsl(var(--primary))] hover:text-white underline-offset-4 hover:underline transition-colors"
          >
            Add Network
          </button>
          <span className="hidden sm:inline text-white/20">•</span>
          <a
            href="https://docs.warpx.exchange/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--primary))] hover:text-white underline-offset-4 hover:underline transition-colors"
          >
            Docs
          </a>
        </div>
        <div className="flex items-center justify-center gap-3 text-white/70">
          {socialLinks.map(({ href, label, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="p-2 rounded-full border border-white/20 hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

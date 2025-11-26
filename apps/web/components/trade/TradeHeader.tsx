"use client";

import Link from "next/link";
import { type RefObject, useState } from "react";
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";
import { Radio, Activity } from "lucide-react";

type NavKey = "swap" | "pools" | "analytics";

const NAV_ITEMS: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "swap", label: "Swap", href: "/" },
  { key: "pools", label: "Liquidity", href: "/pools" },
  { key: "analytics", label: "Data", href: "/stake" }
];

type TradeHeaderProps = {
  manifestTag: string;
  showWalletActions: boolean;
  walletMenuRef: RefObject<HTMLDivElement | null>;
  isWalletMenuOpen: boolean;
  onWalletButtonClick: () => void;
  shortAccountAddress: string;
  onCopyAddress: () => void;
  copyStatus: "idle" | "copied";
  address?: string | null;
  onDisconnect: () => void;
  isDisconnecting: boolean;
  onConnect: () => void;
  isAccountConnecting: boolean;
  hasMounted: boolean;
  activeNav?: NavKey;
};

export function TradeHeader({
  manifestTag,
  showWalletActions,
  walletMenuRef,
  isWalletMenuOpen,
  onWalletButtonClick,
  shortAccountAddress,
  onCopyAddress,
  copyStatus,
  address,
  onDisconnect,
  isDisconnecting,
  onConnect,
  isAccountConnecting,
  hasMounted,
  activeNav = "swap"
}: TradeHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const renderNavLink = (
    item: (typeof NAV_ITEMS)[number],
    isMobile = false
  ) => {
    const isActive = activeNav === item.key;
    const baseClass = isMobile
      ? "block py-3 text-lg font-display uppercase tracking-[0.3em]"
      : "px-6 py-2 text-sm font-mono uppercase tracking-wider transition-colors";
    const activeClass = isActive
      ? "text-primary"
      : "text-muted-foreground hover:text-primary";
    return (
      <Link
        key={`${item.key}-${isMobile ? "mobile" : "desktop"}`}
        href={item.href}
        className={`${baseClass} ${activeClass}`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md h-16 flex items-center px-6 justify-between">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-primary text-black flex items-center justify-center font-bold font-display text-xl skew-x-[-10deg] group-hover:skew-x-0 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-black.png" alt="WarpX" className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-none tracking-tight">
                WARP<span className="text-primary">X</span>
              </span>
              <span className="text-[10px] font-mono text-muted-foreground leading-none tracking-widest">
                PROTOCOL
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 border-l border-border pl-6 h-8">
            {NAV_ITEMS.map((item) => renderNavLink(item))}
          </nav>
        </div>

        {/* Right: Status & Wallet */}
        <div className="hidden md:flex items-center gap-6">
          {/* Status Indicators */}
          {/*    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground border-r border-border pr-6 h-8">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-accent animate-pulse" />
              <span>MEGA_NET: ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>LATENCY: 0.8ms</span>
            </div>
          </div> */}

          {/* Wallet Button */}
          {showWalletActions ? (
            <div ref={walletMenuRef} className="relative">
              <button
                type="button"
                onClick={onWalletButtonClick}
                className="font-mono text-xs h-9 px-4 border-2 border-primary/50 text-primary hover:bg-primary hover:text-black transition-all uppercase tracking-wide rounded-none flex items-center justify-center"
              >
                [ {shortAccountAddress} ]
              </button>
              {isWalletMenuOpen && (
                <div className="absolute right-0 top-12 w-56 rounded border border-border bg-surface-alt p-4 text-sm shadow-hud">
                  <button
                    type="button"
                    onClick={onCopyAddress}
                    className="flex w-full items-center justify-between rounded border border-border px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span>{shortAccountAddress}</span>
                    {copyStatus === "copied" ? (
                      <CopySuccessIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <CopyIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {address && (
                    <a
                      href={`https://megaeth-testnet-v2.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-xs text-primary underline-offset-4 hover:underline"
                    >
                      View on explorer
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onDisconnect}
                    disabled={isDisconnecting}
                    className="mt-4 w-full border border-border px-3 py-2 text-xs text-white/80 transition hover:border-primary"
                  >
                    {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={isAccountConnecting && hasMounted}
              className="font-mono text-xs h-9 px-4 border-2 border-primary/50 text-primary hover:bg-primary hover:text-black transition-all uppercase tracking-wide rounded-none flex items-center justify-center"
            >
              [ CONNECT_WALLET ]
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden p-2 text-foreground hover:text-primary"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isMobileMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-background/95 p-6 md:hidden pt-20">
          <nav className="space-y-4 mb-8">
            {NAV_ITEMS.map((item) => renderNavLink(item, true))}
          </nav>
          <div className="border-t border-border/40 pt-6 space-y-4">
            {/*  <div className="text-xs font-mono text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <Radio className="w-3 h-3 text-accent animate-pulse" />
                <span>MEGA_NET: ONLINE</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3" />
                <span>LATENCY: 0.8ms</span>
              </div>
            </div> */}
            {showWalletActions ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onWalletButtonClick}
                  className="w-full border border-border px-4 py-2 text-left font-mono text-xs uppercase tracking-[0.3em]"
                >
                  {shortAccountAddress}
                </button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className="w-full border border-border px-4 py-2 text-left text-xs"
                >
                  {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onConnect();
                }}
                disabled={isAccountConnecting && hasMounted}
                className="w-full border-2 border-primary/50 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-primary hover:bg-primary hover:text-black transition-all"
              >
                [ CONNECT_WALLET ]
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

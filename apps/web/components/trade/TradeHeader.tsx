"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type RefObject } from "react";
import styles from "@/app/page.module.css";

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
  hasMounted
}: TradeHeaderProps) {
  const pathname = usePathname();
  const navItems = [
    { label: "Swap", href: "/" },
    { label: "Pools", href: "/pools" }
  ];

  const linkIsActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>
        <img src="/logo.png" alt="WarpX" className={styles.logo} />
        <span className={styles.brandMain}>WarpX</span>
        {/* <span className={styles.brandSub}>Built on MegaETH</span> */}
      </div>

      <nav className={styles.navCenter} aria-label="Main navigation">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${
              linkIsActive(item.href) ? styles.navLinkActive : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.navRight}>
        <span className={styles.networkBadge}>{manifestTag}</span>
        {showWalletActions ? (
          <div ref={walletMenuRef} className={styles.walletMenuContainer}>
            <button
              className={styles.walletButton}
              onClick={onWalletButtonClick}
              type="button"
            >
              {shortAccountAddress ? `${shortAccountAddress}` : "Wallet"}
            </button>

            {isWalletMenuOpen && (
              <div className={styles.walletDropdown}>
                <div className={styles.walletDropdownHeader}>
                  <div className={styles.walletDropdownLabel}>Wallet</div>
                  <div className={styles.walletDropdownAddress}>
                    {shortAccountAddress}
                  </div>
                </div>

                <button
                  onClick={onCopyAddress}
                  className={styles.walletDropdownItem}
                  type="button"
                >
                  <span>Copy address</span>
                  {copyStatus === "copied" && (
                    <span className={styles.walletDropdownCopied}>Copied!</span>
                  )}
                </button>

                {address && (
                  <a
                    href={`https://www.mtrkr.xyz/wallet/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.walletDropdownItem}
                  >
                    View on Explorer
                  </a>
                )}

                <div className={styles.walletDropdownDivider} />

                <button
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                  className={`${styles.walletDropdownItem} ${styles.walletDropdownDisconnect}`}
                  type="button"
                >
                  {isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className={styles.walletButton}
            onClick={onConnect}
            disabled={isAccountConnecting && hasMounted}
            type="button"
          >
            {isAccountConnecting && hasMounted ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}

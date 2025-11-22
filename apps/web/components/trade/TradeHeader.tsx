"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type RefObject, useEffect, useMemo, useState } from "react";
import styles from "@/app/page.module.css";
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";

type NavKey = "swap" | "pools" | "faucet" | "stake";

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

const NAV_ITEMS: Array<{
  key: NavKey;
  label: string;
  href: string;
  external?: boolean;
}> = [
  { key: "swap", label: "Swap", href: "/" },
  { key: "pools", label: "Pools", href: "/pools" },
  {
    key: "faucet",
    label: "Faucet",
    href: "https://docs.megaeth.com/faucet",
    external: true
  }
  // { key: "stake", label: "Stake", href: "/stake" }
];

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
  activeNav
}: TradeHeaderProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const resolvedActiveNav = useMemo<NavKey>(() => {
    if (activeNav) return activeNav;
    if (!pathname) return "swap";
    if (pathname.startsWith("/pools")) return "pools";
    if (pathname.startsWith("/stake")) return "stake";
    return "swap";
  }, [activeNav, pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const { body } = document;
    const originalOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    // Intentionally close mobile menu on navigation
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen || !isWalletMenuOpen) return;
    onWalletButtonClick();
  }, [isMobileMenuOpen, isWalletMenuOpen, onWalletButtonClick]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className={styles.navbar}>
        <div className={styles.brandArea}>
          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-label={
              isMobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-controls="mobile-menu"
            aria-expanded={isMobileMenuOpen}
            onClick={toggleMobileMenu}
          >
            <span className={styles.mobileMenuIcon} aria-hidden="true" />
          </button>
          <Link href="/" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="WarpX" className={styles.logo} />
            <span className={styles.brandMain}>WarpX</span>
          </Link>
        </div>

        <nav className={styles.navCenter} aria-label="Main navigation">
          {NAV_ITEMS.map((item) =>
            item.external ? (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.navLink} ${
                  resolvedActiveNav === item.key ? styles.navLinkActive : ""
                }`}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navLink} ${
                  resolvedActiveNav === item.key ? styles.navLinkActive : ""
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className={styles.navRight}>
          {showWalletActions ? (
            <div ref={walletMenuRef} className={styles.walletMenuContainer}>
              <button
                className={styles.walletButton}
                onClick={onWalletButtonClick}
                type="button"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
                <span className={styles.walletButtonText}>
                  {shortAccountAddress ? `${shortAccountAddress}` : "Wallet"}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                  className={styles.walletButtonChevron}
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isWalletMenuOpen && (
                <div className={styles.walletDropdown}>
                  <div className={styles.walletDropdownHeader}>
                    {/* <div className={styles.walletDropdownLabel}>Wallet</div> */}
                    <button
                      onClick={onCopyAddress}
                      className={styles.walletDropdownAddressWithCopy}
                      type="button"
                      title={
                        copyStatus === "copied" ? "Copied!" : "Copy address"
                      }
                    >
                      <span className={styles.walletDropdownAddress}>
                        {shortAccountAddress}
                      </span>
                      {copyStatus === "copied" ? (
                        <CopySuccessIcon className={styles.walletCopyIcon} />
                      ) : (
                        <CopyIcon className={styles.walletCopyIcon} />
                      )}
                    </button>
                  </div>

                  {address && (
                    <a
                      href={`https://megaeth-testnet-v2.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.walletDropdownItem}
                    >
                      View on Explorer
                    </a>
                  )}

                  <a
                    href="https://x.com/warpexchange"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.walletDropdownItem}
                  >
                    Follow on X
                  </a>

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
              className={styles.connectWalletButton}
              onClick={onConnect}
              disabled={isAccountConnecting && hasMounted}
              type="button"
            >
              {isAccountConnecting && hasMounted
                ? "Connecting…"
                : "Connect Wallet"}
            </button>
          )}
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className={styles.mobileMenuOverlay}
          role="presentation"
          onClick={closeMobileMenu}
        >
          <div
            className={styles.mobileMenu}
            role="dialog"
            aria-modal="true"
            id="mobile-menu"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.mobileMenuHeader}>
              <Link href="/" className={styles.mobileMenuBrand} onClick={closeMobileMenu}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="WarpX" className={styles.logo} />
                <div className={styles.mobileMenuTitle}>
                  <span className={styles.brandMain}>WarpX</span>
                </div>
              </Link>
              <button
                type="button"
                className={styles.mobileMenuClose}
                aria-label="Close navigation menu"
                onClick={closeMobileMenu}
              >
                ×
              </button>
            </div>

            <nav className={styles.mobileNav} aria-label="Mobile navigation">
              {NAV_ITEMS.map((item) =>
                item.external ? (
                  <a
                    key={`mobile-${item.key}`}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.mobileNavLink} ${
                      resolvedActiveNav === item.key
                        ? styles.mobileNavLinkActive
                        : ""
                    }`}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={`mobile-${item.key}`}
                    href={item.href}
                    className={`${styles.mobileNavLink} ${
                      resolvedActiveNav === item.key
                        ? styles.mobileNavLinkActive
                        : ""
                    }`}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </nav>

            <div className={styles.mobileMenuDivider} />

            <div className={styles.mobileMenuFooter}>
              {showWalletActions ? (
                <div className={styles.mobileWalletSection}>
                  <div className={styles.mobileWalletMeta}>
                    <span className={styles.mobileWalletLabel}>
                      Connected wallet
                    </span>
                    <span className={styles.mobileWalletAccount}>
                      {shortAccountAddress}
                    </span>
                  </div>

                  {/*  <div className={styles.mobileWalletActions}>
                    <button
                      type="button"
                      className={styles.mobileWalletAction}
                      onClick={onCopyAddress}
                    >
                      Copy address
                    </button>
                    {copyStatus === "copied" && (
                      <span className={styles.mobileWalletStatus}>Copied!</span>
                    )}
                  </div> */}

                  {address && (
                    <a
                      href={`https://megaeth-testnet-v2.blockscout.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.mobileWalletActionLink}
                    >
                      View on Explorer
                    </a>
                  )}

                  <a
                    href="https://x.com/warpexchange"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mobileWalletActionLink}
                  >
                    Follow on X
                  </a>

                  <button
                    type="button"
                    className={styles.mobileWalletDisconnect}
                    onClick={onDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}
                  </button>
                </div>
              ) : (
                <button
                  className={styles.connectWalletButton}
                  onClick={() => {
                    closeMobileMenu();
                    onConnect();
                  }}
                  disabled={isAccountConnecting && hasMounted}
                  type="button"
                >
                  {isAccountConnecting && hasMounted
                    ? "Connecting…"
                    : "Connect Wallet"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

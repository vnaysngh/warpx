"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info" | "loading";

export type ToastVisualVariant = "default" | "swap" | "addLiquidity" | "removeLiquidity" | "stake" | "unstake";

export type ToastVisualToken = {
  symbol: string;
  logo?: string | null;
};

export type ToastVisuals = {
  variant?: ToastVisualVariant;
  leftToken?: ToastVisualToken | null;
  rightToken?: ToastVisualToken | null;
};

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  link?: {
    href: string;
    label?: string;
  };
  visuals?: ToastVisuals;
}

const TYPE_META: Record<
  ToastType,
  { label: string; subtitle: string; icon: string; accent: string }
> = {
  loading: {
    label: "Confirm in wallet",
    subtitle: "Review and approve the transaction in your wallet to continue.",
    icon: "🚀",
    accent: styles.loadingAccent
  },
  success: {
    label: "Transaction confirmed",
    subtitle: "Your transaction has been successfully executed on MegaETH.",
    icon: "✨",
    accent: styles.successAccent
  },
  error: {
    label: "Transaction failed",
    subtitle: "The transaction was rejected or failed. Please try again.",
    icon: "⚠️",
    accent: styles.errorAccent
  },
  info: {
    label: "Heads up",
    subtitle: "Keep an eye on your wallet for the next prompt.",
    icon: "💡",
    accent: styles.infoAccent
  }
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

type TokenBubbleProps = {
  token?: ToastVisualToken | null;
  position: "left" | "right";
};

const TokenBubble = ({ token, position }: TokenBubbleProps) => {
  const className = `${styles.tokenBubble} ${
    styles[`token${capitalize(position)}`]
  }`;

  if (token?.logo) {
    return (
      <div className={className}>
        <img
          src={token.logo}
          alt={`${token.symbol} logo`}
          className={styles.tokenLogo}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (token?.symbol) {
    return (
      <div className={className}>
        <span className={styles.tokenSymbol}>
          {token.symbol.slice(0, 4).toUpperCase()}
        </span>
      </div>
    );
  }

  // Return null instead of fallback when no token data is provided
  return null;
};

type TokenPairStackProps = {
  leftToken?: ToastVisualToken | null;
  rightToken?: ToastVisualToken | null;
};

const TokenPairStack = ({ leftToken, rightToken }: TokenPairStackProps) => {
  const renderToken = (token: ToastVisualToken | null | undefined, isPrimary: boolean) => {
    const className = `${styles.tokenStackBadge} ${
      isPrimary ? styles.tokenStackPrimary : styles.tokenStackSecondary
    }`;

    if (token?.logo) {
      return (
        <img
          key={token.symbol}
          src={token.logo}
          alt={`${token.symbol} logo`}
          className={className}
          loading="lazy"
          decoding="async"
        />
      );
    }

    if (token?.symbol) {
      return (
        <span key={token.symbol} className={className}>
          {token.symbol.slice(0, 3).toUpperCase()}
        </span>
      );
    }

    return null;
  };

  return (
    <div className={styles.tokenPairStack}>
      {renderToken(leftToken, true)}
      {renderToken(rightToken, false)}
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  const activeToast = useMemo(() => {
    if (toasts.length === 0) return null;
    return toasts[toasts.length - 1];
  }, [toasts]);

  useEffect(() => {
    if (!activeToast || activeToast.type === "loading") return;

    const duration = activeToast.duration ?? 5000;
    const timer = setTimeout(() => {
      onClose(activeToast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeToast, onClose]);

  const queueIndicators = useMemo(() => toasts.slice(-4), [toasts]);

  if (!activeToast) return null;

  const meta = TYPE_META[activeToast.type];
  const variant = activeToast.visuals?.variant ?? "default";
  const sceneClass =
    styles[`scene${capitalize(variant)}` as keyof typeof styles] ?? "";

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={`${styles.accent} ${meta.accent}`} />
        <div className={styles.header}>
          <span className={styles.badge}>
            <span className={styles.badgeIcon}>{meta.icon}</span>
            {meta.label}
          </span>
          {activeToast.type !== "loading" && (
            <button
              type="button"
              className={styles.close}
              onClick={() => onClose(activeToast.id)}
            >
              Close
            </button>
          )}
        </div>

        <div className={styles.copyBlock}>
          <h3 className={styles.title}>{activeToast.message}</h3>
          <p className={styles.subtitle}>{meta.subtitle}</p>
        </div>

        <div className={`${styles.scene} ${sceneClass}`}>
          {variant === "addLiquidity" ? (
            <TokenPairStack
              leftToken={activeToast.visuals?.leftToken}
              rightToken={activeToast.visuals?.rightToken}
            />
          ) : variant === "removeLiquidity" ? null : (
            <TokenBubble token={activeToast.visuals?.leftToken} position="left" />
          )}
          <div className={styles.brandOrb}>
            <div className={styles.brandGlow} />
            <Image
              src="/logo.png"
              alt="WarpX mascot"
              width={72}
              height={72}
              className={styles.brandLogo}
              priority
            />
          </div>
          {variant === "removeLiquidity" ? (
            <TokenPairStack
              leftToken={activeToast.visuals?.leftToken}
              rightToken={activeToast.visuals?.rightToken}
            />
          ) : variant !== "addLiquidity" && (
            <TokenBubble
              token={activeToast.visuals?.rightToken}
              position="right"
            />
          )}
        </div>

        <div className={styles.progress}>
          <div
            className={`${styles.progressFill} ${styles[`${activeToast.type}Fill`] ?? ""}`}
          />
        </div>

        <div className={styles.etaRow}>
          <span className={styles.etaLabel}>
            {activeToast.type === "loading"
              ? "Estimated time"
              : activeToast.type === "success"
                ? "Status"
                : "Status"}
          </span>
          <span className={styles.etaValue}>
            {activeToast.type === "loading"
              ? "~5s"
              : activeToast.type === "success"
                ? "Confirmed"
                : activeToast.type === "error"
                  ? "Failed"
                  : "Pending"}
          </span>
        </div>

        {activeToast.link && (
          <a
            href={activeToast.link.href}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.explorerButton}
          >
            View on explorer
          </a>
        )}

        {queueIndicators.length > 1 && (
          <div className={styles.queue}>
            {queueIndicators.map((toast) => (
              <span
                key={toast.id}
                className={`${styles.queueDot} ${
                  toast.id === activeToast.id ? styles.activeDot : ""
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

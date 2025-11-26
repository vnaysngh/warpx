import { useEffect, useMemo } from "react";
import Image from "next/image";

export type ToastType = "success" | "error" | "info" | "loading";

export type ToastVisualVariant =
  | "default"
  | "swap"
  | "addLiquidity"
  | "removeLiquidity"
  | "stake"
  | "unstake";

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
    accent: "border-cyan text-cyan"
  },
  success: {
    label: "Transaction confirmed",
    subtitle: "Your transaction has been successfully executed on MegaETH.",
    icon: "✨",
    accent: "border-primary text-primary"
  },
  error: {
    label: "Transaction failed",
    subtitle: "The transaction was rejected or failed. Please try again.",
    icon: "⚠️",
    accent: "border-danger text-danger"
  },
  info: {
    label: "Heads up",
    subtitle: "Keep an eye on your wallet for the next prompt.",
    icon: "💡",
    accent: "border-white/40 text-white"
  }
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

type TokenBubbleProps = {
  token?: ToastVisualToken | null;
  position: "left" | "right";
};

const TokenBubble = ({ token, position }: TokenBubbleProps) => {
  const baseClass =
    "flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/40 text-xs font-display tracking-[0.3em]";
  const translateClass =
    position === "left" ? "-translate-x-4" : "translate-x-4";

  if (!token) return null;

  if (token.logo) {
    return (
      <div className={`${baseClass} ${translateClass} overflow-hidden`}>
        <img
          src={token.logo}
          alt={`${token.symbol} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div className={`${baseClass} ${translateClass}`}>{token.symbol}</div>
  );
};

type TokenPairStackProps = {
  leftToken?: ToastVisualToken | null;
  rightToken?: ToastVisualToken | null;
};

const TokenPairStack = ({ leftToken, rightToken }: TokenPairStackProps) => (
  <div className="relative flex items-center">
    {leftToken && (
      <TokenBubble token={leftToken} position="left" key={leftToken.symbol} />
    )}
    {rightToken && (
      <TokenBubble token={rightToken} position="right" key={rightToken.symbol} />
    )}
  </div>
);

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

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000] flex items-end justify-end p-6">
      <div className="pointer-events-auto w-full max-w-md rounded border border-white/15 bg-black/80 p-5 text-white shadow-[0_20px_80px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span
            className={`inline-flex items-center gap-2 rounded border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.3em] ${meta.accent}`}
          >
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          {activeToast.type !== "loading" && (
            <button
              type="button"
              className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-primary"
              onClick={() => onClose(activeToast.id)}
            >
              Close
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="font-display text-lg tracking-[0.3em] text-white">
            {activeToast.message}
          </h3>
          <p className="text-sm text-white/60">{meta.subtitle}</p>
        </div>

        <div className="relative mt-6 flex items-center justify-between rounded border border-white/10 bg-black/40 px-4 py-5">
          {variant === "addLiquidity" || variant === "removeLiquidity" ? (
            <TokenPairStack
              leftToken={activeToast.visuals?.leftToken}
              rightToken={activeToast.visuals?.rightToken}
            />
          ) : (
            <>
              <TokenBubble
                token={activeToast.visuals?.leftToken}
                position="left"
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-black/80">
                <div className="absolute inset-0 rounded-full border border-primary/40 blur-xl" />
                <Image
                  src="/logo.png"
                  alt="WarpX mascot"
                  width={48}
                  height={48}
                  className="relative z-10"
                  priority
                />
              </div>
              <TokenBubble
                token={activeToast.visuals?.rightToken}
                position="right"
              />
            </>
          )}
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded bg-white/10">
          <div
            className={`h-full ${
              activeToast.type === "success"
                ? "bg-primary"
                : activeToast.type === "error"
                  ? "bg-danger"
                  : activeToast.type === "loading"
                    ? "bg-cyan"
                    : "bg-white"
            } animate-toastProgress`}
            style={{
              // default 5s (5000ms)
              animationDuration: `${(activeToast.duration ?? 5000) / 1000}s`
            }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
          <span>
            {activeToast.type === "loading"
              ? "Estimated time"
              : activeToast.type === "success"
                ? "Status"
                : "Status"}
          </span>
          <span>
            {activeToast.type === "loading"
              ? "~1s"
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
            className="mt-4 inline-flex items-center justify-center rounded border border-primary px-3 py-2 text-xs uppercase tracking-[0.3em] text-primary transition hover:bg-primary hover:text-black"
          >
            {activeToast.link.label ?? "View on explorer"}
          </a>
        )}

        {queueIndicators.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {queueIndicators.map((toast) => (
              <span
                key={toast.id}
                className={`h-1 w-6 rounded ${
                  toast.id === activeToast.id ? "bg-primary" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

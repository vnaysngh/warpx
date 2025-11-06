"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  link?: {
    href: string;
    label?: string;
  };
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.type === "loading") return;

    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "loading":
        return (
          <span className={styles.dots}>
            <span />
            <span />
            <span />
          </span>
        );
      default:
        return "ℹ";
    }
  };

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`}>
      <span className={styles.icon}>{getIcon()}</span>
      <span className={styles.message}>
        {toast.message}
        {toast.link && (
          <a
            className={styles.link}
            href={toast.link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {toast.link.label ?? "View on explorer"}
          </a>
        )}
      </span>
      {toast.type !== "loading" && (
        <button
          className={styles.close}
          onClick={() => onClose(toast.id)}
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

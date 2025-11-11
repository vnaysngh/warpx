import { useCallback, useRef, useState } from "react";
import type { Toast } from "@/components/Toast";

export type ToastOptions = Pick<Toast, "duration" | "link" | "visuals">;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadingToastRef = useRef<string | null>(null);

  const addToast = useCallback(
    (message: string, type: Toast["type"], options: ToastOptions = {}) => {
      const id = `${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type,
        duration: options.duration,
        link: options.link,
        visuals: options.visuals
      };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showLoading = useCallback(
    (message: string, options?: ToastOptions) => {
      if (loadingToastRef.current) {
        removeToast(loadingToastRef.current);
      }
      const id = addToast(message, "loading", options);
      loadingToastRef.current = id;
      return id;
    },
    [addToast, removeToast]
  );

  const hideLoading = useCallback(() => {
    if (loadingToastRef.current) {
      removeToast(loadingToastRef.current);
      loadingToastRef.current = null;
    }
  }, [removeToast]);

  const showSuccess = useCallback(
    (message: string, options?: ToastOptions) => {
      hideLoading();
      addToast(message, "success", options);
    },
    [addToast, hideLoading]
  );

  const showError = useCallback(
    (message: string, options?: ToastOptions) => {
      hideLoading();
      addToast(message, "error", options);
    },
    [addToast, hideLoading]
  );

  return {
    toasts,
    addToast,
    removeToast,
    showLoading,
    hideLoading,
    showSuccess,
    showError,
    loadingToastRef
  };
}

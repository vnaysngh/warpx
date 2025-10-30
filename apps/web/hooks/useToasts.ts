import { useCallback, useRef, useState } from "react";
import type { Toast } from "@/components/Toast";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadingToastRef = useRef<string | null>(null);

  const addToast = useCallback(
    (message: string, type: Toast["type"], duration?: number) => {
      const id = `${Date.now()}-${Math.random()}`;
      const newToast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showLoading = useCallback(
    (message: string) => {
      if (loadingToastRef.current) {
        removeToast(loadingToastRef.current);
      }
      const id = addToast(message, "loading");
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
    (message: string) => {
      hideLoading();
      addToast(message, "success");
    },
    [addToast, hideLoading]
  );

  const showError = useCallback(
    (message: string) => {
      hideLoading();
      addToast(message, "error");
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

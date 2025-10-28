"use client";

import { PropsWithChildren, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig, appKit } from "@/lib/wagmi";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  const isDisconnectingRef = useRef(false);

  useEffect(() => {
    // Subscribe to modal state changes and close automatic network switch modals
    const unsubscribe = appKit.subscribeState((state) => {
      // Don't interfere with modal during disconnect
      if (isDisconnectingRef.current) {
        return;
      }

      // Prevent automatic modal opening for network switches
      if (state.open && state.selectedNetworkId) {
        // Only allow manual opens, not automatic ones
        const isManualOpen = (window as any).__appKitManualOpen;
        if (!isManualOpen) {
          appKit.close();
        }
        delete (window as any).__appKitManualOpen;
      }
    });

    // Expose disconnect state reference globally
    (window as any).__setDisconnecting = (value: boolean) => {
      isDisconnectingRef.current = value;
    };

    return () => {
      unsubscribe();
      delete (window as any).__setDisconnecting;
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

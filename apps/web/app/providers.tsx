"use client";

import { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { QueryProvider } from "@/components/QueryProvider";
import { LocalizationProvider } from "@/lib/format/LocalizationContext";

export function Providers({ children }: PropsWithChildren) {
  return (
    <LocalizationProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryProvider>{children}</QueryProvider>
      </WagmiProvider>
    </LocalizationProvider>
  );
}

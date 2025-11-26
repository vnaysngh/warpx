"use client";

import { TradeHeaderWrapper } from "@/components/trade/TradeHeaderWrapper";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { SiteFooter } from "@/components/layout/SiteFooter";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen bg-background grid-bg text-foreground">
      <div className="relative z-10 flex min-h-screen flex-col">
        <TradeHeaderWrapper />
        <div className="flex-1 pt-24">
          <div className="mx-auto w-full max-w-[1200px] px-4 pb-16">
            {children}
          </div>
        </div>
        <SiteFooter />
      </div>
      <DisclaimerModal />
    </main>
  );
}

"use client";

import { TradeHeaderWrapper } from "@/components/trade/TradeHeaderWrapper";
import styles from "@/app/page.module.css";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <TradeHeaderWrapper />
        {children}
      </div>
    </main>
  );
}

import styles from "@/app/page.module.css";

type ActiveView = "swap" | "liquidity";

type ViewTabsProps = {
  activeView: ActiveView;
  onChange: (view: ActiveView) => void;
};

export function ViewTabs({ activeView, onChange }: ViewTabsProps) {
  return (
    <div className={styles.tabs}>
      <button
        type="button"
        className={`${styles.tab} ${activeView === "swap" ? styles.tabActive : ""}`}
        onClick={() => onChange("swap")}
      >
        Swap
      </button>
      <button
        type="button"
        className={`${styles.tab} ${activeView === "liquidity" ? styles.tabActive : ""}`}
        onClick={() => onChange("liquidity")}
      >
        Liquidity
      </button>
    </div>
  );
}

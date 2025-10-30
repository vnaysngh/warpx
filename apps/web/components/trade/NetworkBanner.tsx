import styles from "@/app/page.module.css";

type NetworkBannerProps = {
  error: string | null;
  onSwitch: () => void;
  isSwitching: boolean;
};

export function NetworkBanner({
  error,
  onSwitch,
  isSwitching
}: NetworkBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div className={styles.statusStack}>
      <div className={`${styles.status} ${styles.statusWarn}`}>
        <div className={styles.statusContent}>
          <span className={styles.statusLabel}>Network</span>
          {error}
        </div>
        <button
          className={styles.statusAction}
          type="button"
          onClick={onSwitch}
          disabled={isSwitching}
        >
          {isSwitching ? "Switching…" : "Switch"}
        </button>
      </div>
    </div>
  );
}

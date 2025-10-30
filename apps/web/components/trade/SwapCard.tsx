import type {
  Quote,
  ReverseQuote,
  SwapFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import styles from "@/app/page.module.css";

type SwapCardProps = {
  swapForm: SwapFormState;
  swapQuote: Quote | null;
  reverseQuote: ReverseQuote | null;
  selectedIn: TokenDescriptor | null;
  selectedOut: TokenDescriptor | null;
  onOpenTokenDialog: (slot: TokenDialogSlot) => void;
  onAmountInChange: (value: string) => void;
  onMinOutChange: (value: string) => void;
  formatBalance: (value: string | null) => string;
  swapInBalanceFormatted: string | null;
  swapInSymbol: string | null;
  onSetMaxSwapAmount: () => void;
  summaryMessage: string | null;
  buttonLabel: string;
  buttonDisabled: boolean;
  onButtonClick: (() => void) | null;
};

export function SwapCard({
  swapForm,
  swapQuote,
  reverseQuote,
  selectedIn,
  selectedOut,
  onOpenTokenDialog,
  onAmountInChange,
  onMinOutChange,
  formatBalance,
  swapInBalanceFormatted,
  swapInSymbol,
  onSetMaxSwapAmount,
  summaryMessage,
  buttonLabel,
  buttonDisabled,
  onButtonClick
}: SwapCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.swapPanel}>
        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Sell</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("swapIn")}
            >
              <span className={styles.assetSelectorSymbol}>
                {selectedIn?.symbol ?? "Select"}
              </span>
            </button>
          </div>
          <div className={styles.assetAmountRow}>
            <input
              className={styles.amountInput}
              placeholder="0.0"
              value={swapForm.amountIn}
              onChange={(event) => onAmountInChange(event.target.value)}
            />
          </div>
          {selectedIn && (
            <div className={styles.assetBalance}>
              <span className={styles.helper}>
                Balance: {formatBalance(swapInBalanceFormatted)} {swapInSymbol}
              </span>
              {swapInBalanceFormatted && (
                <button
                  type="button"
                  className={styles.maxButton}
                  onClick={onSetMaxSwapAmount}
                >
                  MAX
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.swapDivider}>v</div>

        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Receive</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("swapOut")}
            >
              <span className={styles.assetSelectorSymbol}>
                {selectedOut?.symbol ?? "Select"}
              </span>
            </button>
          </div>
          <div className={styles.assetAmountRow}>
            <input
              className={styles.amountInput}
              placeholder={swapQuote ? swapQuote.amount : "0.0"}
              value={swapForm.minOut}
              onChange={(event) => onMinOutChange(event.target.value)}
            />
          </div>
          {reverseQuote && (
            <span className={styles.helper}>
              Needs ≈ {reverseQuote.amount} {reverseQuote.symbolIn}
            </span>
          )}
        </div>
      </div>

      <div className={styles.summary}>
        <button
          className={`${styles.primaryButton} ${styles.primaryFull}`}
          onClick={() => onButtonClick?.()}
          disabled={buttonDisabled}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
      {summaryMessage && (
        <span className={styles.summaryPrimary}>{summaryMessage}</span>
      )}
    </section>
  );
}

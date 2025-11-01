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
  onSwapTokens: () => void;
  onAmountInChange: (value: string) => void;
  onMinOutChange: (value: string) => void;
  formatBalance: (value: string | null) => string;
  swapInBalanceFormatted: string | null;
  swapInSymbol: string | null;
  onSetMaxSwapAmount: () => void;
  receiveValue: string;
  minReceived: string | null;
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
  onSwapTokens,
  onAmountInChange,
  onMinOutChange,
  formatBalance,
  swapInBalanceFormatted,
  swapInSymbol,
  onSetMaxSwapAmount,
  receiveValue,
  minReceived,
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
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selectedIn?.logo && (
                  <img
                    src={selectedIn.logo}
                    alt={selectedIn.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
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

        <button
          type="button"
          className={styles.swapDivider}
          onClick={onSwapTokens}
          aria-label="Swap tokens"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.5 5.5L2 3L4.5 0.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 3H11C12.6569 3 14 4.34315 14 6V7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11.5 10.5L14 13L11.5 15.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 13H5C3.34315 13 2 11.6569 2 10V9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Receive</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("swapOut")}
            >
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {selectedOut?.logo && (
                  <img
                    src={selectedOut.logo}
                    alt={selectedOut.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
                {selectedOut?.symbol ?? "Select"}
              </span>
            </button>
          </div>
          <div className={styles.assetAmountRow}>
            <input
              className={styles.amountInput}
              placeholder={swapQuote ? swapQuote.amount : "0.0"}
              value={receiveValue}
              onChange={(event) => onMinOutChange(event.target.value)}
            />
          </div>
          {minReceived && (
            <span className={styles.helper}>
              Min received: {minReceived} {selectedOut?.symbol ?? ""}
            </span>
          )}
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

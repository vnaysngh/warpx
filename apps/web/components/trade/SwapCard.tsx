import { useState } from "react";
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
  priceImpact: number | null;
  slippage: string | null;
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
  priceImpact,
  slippage,
  buttonLabel,
  buttonDisabled,
  onButtonClick
}: SwapCardProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

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
              <span
                className={styles.assetSelectorSymbol}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {selectedIn?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedIn.logo}
                    alt={selectedIn.symbol}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      objectFit: "cover",
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
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder="0.0"
              minLength={1}
              maxLength={79}
              spellCheck="false"
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
              <span
                className={styles.assetSelectorSymbol}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {selectedOut?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedOut.logo}
                    alt={selectedOut.symbol}
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      objectFit: "cover",
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
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder={swapQuote ? swapQuote.amount : "0.0"}
              minLength={1}
              maxLength={79}
              spellCheck="false"
              value={receiveValue}
              onChange={(event) => onMinOutChange(event.target.value)}
            />
          </div>
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

        {summaryMessage && minReceived && selectedOut && (
          <>
            <button
              type="button"
              className={styles.swapSummaryToggle}
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            >
              <div className={styles.swapSummaryRow}>
                <span className={styles.swapSummaryText}>{summaryMessage}</span>
                <div className={styles.swapSummaryRight}>
                  <span className={styles.swapSummaryNetworkCost}>~$0.01</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={styles.swapSummaryChevron}
                    style={{
                      transform: isDetailsExpanded ? "rotate(180deg)" : "rotate(0deg)"
                    }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </button>

            {isDetailsExpanded && (
              <div className={styles.swapDetails}>
                <div className={styles.swapDetailRow}>
                  <span className={styles.swapDetailLabel}>Min received</span>
                  <span className={styles.swapDetailValue}>
                    {minReceived} {selectedOut.symbol}
                  </span>
                </div>
                {slippage && (
                  <div className={styles.swapDetailRow}>
                    <span className={styles.swapDetailLabel}>Slippage</span>
                    <span className={styles.swapDetailValue}>{slippage}%</span>
                  </div>
                )}
                <div className={styles.swapDetailRow}>
                  <span className={styles.swapDetailLabel}>Network cost</span>
                  <span className={styles.swapDetailValue}>~$0.01</span>
                </div>
              </div>
            )}
          </>
        )}

        {priceImpact !== null && priceImpact > 0.01 && (
          <div
            className={styles.exchangeRate}
            style={{
              color:
                priceImpact >= 5
                  ? "#ff4d4d"
                  : priceImpact >= 3
                    ? "#ff9500"
                    : "#888",
              fontWeight: priceImpact >= 3 ? "500" : "400"
            }}
          >
            Price impact: {priceImpact.toFixed(2)}%{priceImpact >= 5 && " ⚠️"}
          </div>
        )}
      </div>
    </section>
  );
}

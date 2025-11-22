import type {
  LiquidityFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import { formatNumber, formatPercent } from "@/lib/trade/math";
import styles from "@/app/page.module.css";

type LiquidityMode = "add" | "remove";

type ReserveInfo = {
  reserveA: string;
  reserveB: string;
  pairAddress: string;
  totalSupply: string;
  reserveAWei: bigint;
  reserveBWei: bigint;
  totalSupplyWei: bigint;
};

type LiquidityAddProps = {
  liquidityTokenA: TokenDescriptor | null;
  liquidityTokenB: TokenDescriptor | null;
  liquidityForm: LiquidityFormState;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  onOpenTokenDialog: (slot: TokenDialogSlot) => void;
  formatBalance: (value: string | null) => string;
  tokenABalanceFormatted: string | null;
  tokenBBalanceFormatted: string | null;
  tokenASymbol: string | null;
  tokenBSymbol: string | null;
  onSetMaxAmountA: () => void;
  onSetMaxAmountB: () => void;
  onPrimary: () => void;
  buttonLabel: string;
  buttonDisabled: boolean;
  buttonVariant?: "default" | "highlight";
  transactionStatus: {
    message: string;
    type: "idle" | "pending" | "success" | "error";
  };
};

type LiquidityRemoveProps = {
  liquidityTokenA: TokenDescriptor | null;
  liquidityTokenB: TokenDescriptor | null;
  liquidityPairReserves: ReserveInfo | null;
  lpTokenInfo: { balance: string; poolShare: string } | null;
  userPooledAmounts: { amountA: string; amountB: string } | null;
  expectedRemoveAmounts: { amountA: string; amountB: string } | null;
  removeLiquidityPercent: string;
  onRemoveLiquidityPercentChange: (value: string) => void;
  onOpenTokenDialog: (slot: TokenDialogSlot) => void;
  onRemoveLiquidity: () => void;
  isSubmitting: boolean;
  ready: boolean;
  transactionStatus: {
    message: string;
    type: "idle" | "pending" | "success" | "error";
  };
};

type LiquiditySectionProps = {
  mode: LiquidityMode;
  onModeChange: (mode: LiquidityMode) => void;
  addProps: LiquidityAddProps;
  removeProps: LiquidityRemoveProps;
  tokenSelectionEnabled: boolean;
  allowRemove: boolean;
  addButtonVariant?: "default" | "highlight";
};

export function LiquiditySection({
  mode,
  onModeChange,
  addProps,
  removeProps,
  tokenSelectionEnabled,
  allowRemove,
  addButtonVariant = "default"
}: LiquiditySectionProps) {
  const effectiveMode = allowRemove ? mode : "add";
  const handleModeChange = (next: LiquidityMode) => {
    if (!allowRemove && next === "remove") {
      return;
    }
    onModeChange(next);
  };

  return (
    <section className={styles.card}>
      {allowRemove ? (
        <div className={styles.cardHeader}>
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segment} ${effectiveMode === "add" ? styles.segmentActive : ""}`}
              onClick={() => handleModeChange("add")}
            >
              Add
            </button>
            <button
              type="button"
              className={`${styles.segment} ${effectiveMode === "remove" ? styles.segmentActive : ""}`}
              onClick={() => handleModeChange("remove")}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {effectiveMode === "add" ? (
        <LiquidityAddForm
          {...addProps}
          tokenSelectionEnabled={tokenSelectionEnabled}
          buttonVariant={addButtonVariant}
        />
      ) : (
        <LiquidityRemoveForm
          {...removeProps}
          tokenSelectionEnabled={tokenSelectionEnabled}
        />
      )}
    </section>
  );
}

function LiquidityAddForm({
  liquidityTokenA,
  liquidityTokenB,
  liquidityForm,
  onAmountAChange,
  onAmountBChange,
  onOpenTokenDialog,
  formatBalance,
  tokenABalanceFormatted,
  tokenBBalanceFormatted,
  tokenASymbol,
  tokenBSymbol,
  onSetMaxAmountA,
  onSetMaxAmountB,
  onPrimary,
  buttonLabel,
  buttonDisabled,
  tokenSelectionEnabled,
  buttonVariant = "default",
  transactionStatus
}: LiquidityAddProps & { tokenSelectionEnabled: boolean; buttonVariant?: "default" | "highlight" }) {
  // Check transaction status FIRST - override button label and disabled state
  let finalButtonLabel = buttonLabel;
  let finalButtonDisabled = buttonDisabled;

  if (transactionStatus.type === "pending") {
    finalButtonLabel = transactionStatus.message;
    finalButtonDisabled = true;
  } else if (transactionStatus.type === "success") {
    finalButtonLabel = transactionStatus.message;
    finalButtonDisabled = true;
  } else if (transactionStatus.type === "error") {
    finalButtonLabel = transactionStatus.message;
    finalButtonDisabled = true;
  }

  const primaryButtonClass = [
    styles.primaryButton,
    styles.primaryFull,
    buttonVariant === "highlight" ? styles.primaryButtonHighlight : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={styles.swapPanel}>
        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Deposit A</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={
                tokenSelectionEnabled
                  ? () => onOpenTokenDialog("liquidityA")
                  : undefined
              }
              disabled={!tokenSelectionEnabled}
            >
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {liquidityTokenA?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liquidityTokenA.logo}
                    alt={liquidityTokenA.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
                {liquidityTokenA?.symbol ?? "Select"}
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
              value={liquidityForm.amountA}
              onChange={(event) => onAmountAChange(event.target.value)}
            />
          </div>
          <div className={styles.assetBalance}>
            <span className={styles.helper}>
              Balance:{" "}
              {liquidityTokenA
                ? formatBalance(tokenABalanceFormatted)
                : "—"}
            </span>
            {liquidityTokenA && tokenABalanceFormatted && (
              <button
                type="button"
                className={styles.maxButton}
                onClick={onSetMaxAmountA}
              >
                MAX
              </button>
            )}
          </div>
        </div>

        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Deposit B</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={
                tokenSelectionEnabled
                  ? () => onOpenTokenDialog("liquidityB")
                  : undefined
              }
              disabled={!tokenSelectionEnabled}
            >
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {liquidityTokenB?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liquidityTokenB.logo}
                    alt={liquidityTokenB.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
                {liquidityTokenB?.symbol ?? "Select"}
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
              value={liquidityForm.amountB}
              onChange={(event) => onAmountBChange(event.target.value)}
            />
          </div>
          <div className={styles.assetBalance}>
            <span className={styles.helper}>
              Balance:{" "}
              {liquidityTokenB
                ? formatBalance(tokenBBalanceFormatted)
                : "—"}
            </span>
            {liquidityTokenB && tokenBBalanceFormatted && (
              <button
                type="button"
                className={styles.maxButton}
                onClick={onSetMaxAmountB}
              >
                MAX
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.summary}>
        <button
          className={primaryButtonClass}
          onClick={onPrimary}
          disabled={finalButtonDisabled}
          type="button"
          style={
            transactionStatus.type === "error"
              ? {
                  background: "rgba(255, 92, 92, 0.9)",
                  borderColor: "rgba(255, 92, 92, 1)",
                  color: "#ffffff",
                  opacity: 1,
                  cursor: "not-allowed",
                  pointerEvents: "none"
                }
              : transactionStatus.type === "success"
                ? {
                    background: "var(--accent)",
                    borderColor: "var(--accent)",
                    color: "#000000",
                    opacity: 1,
                    cursor: "not-allowed",
                    pointerEvents: "none"
                  }
                : undefined
          }
        >
          {finalButtonLabel}
        </button>
      </div>
    </>
  );
}

function LiquidityRemoveForm({
  liquidityTokenA,
  liquidityTokenB,
  liquidityPairReserves,
  lpTokenInfo,
  userPooledAmounts,
  expectedRemoveAmounts,
  removeLiquidityPercent,
  onRemoveLiquidityPercentChange,
  onOpenTokenDialog,
  onRemoveLiquidity,
  isSubmitting,
  ready,
  tokenSelectionEnabled,
  transactionStatus
}: LiquidityRemoveProps & { tokenSelectionEnabled: boolean }) {
  // Check transaction status FIRST - override button label and disabled state
  let buttonLabel = isSubmitting ? "Removing..." : "Remove Liquidity";
  let buttonDisabled = !ready ||
    isSubmitting ||
    !liquidityPairReserves ||
    !lpTokenInfo ||
    Number(lpTokenInfo.balance) === 0;

  if (transactionStatus.type === "pending") {
    buttonLabel = transactionStatus.message;
    buttonDisabled = true;
  } else if (transactionStatus.type === "success") {
    buttonLabel = transactionStatus.message;
    buttonDisabled = true;
  } else if (transactionStatus.type === "error") {
    buttonLabel = transactionStatus.message;
    buttonDisabled = true;
  }

  return (
    <>
      <div className={styles.swapPanel}>
        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Select Pair</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "0.75rem"
            }}
          >
            <button
              type="button"
              className={styles.assetSelector}
              onClick={
                tokenSelectionEnabled
                  ? () => onOpenTokenDialog("liquidityA")
                  : undefined
              }
              disabled={!tokenSelectionEnabled}
              style={{ flex: 1 }}
            >
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {liquidityTokenA?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liquidityTokenA.logo}
                    alt={liquidityTokenA.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
                {liquidityTokenA?.symbol ?? "Select"}
              </span>
            </button>
            <span style={{ opacity: 0.5 }}>+</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={
                tokenSelectionEnabled
                  ? () => onOpenTokenDialog("liquidityB")
                  : undefined
              }
              disabled={!tokenSelectionEnabled}
              style={{ flex: 1 }}
            >
              <span className={styles.assetSelectorSymbol} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {liquidityTokenB?.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liquidityTokenB.logo}
                    alt={liquidityTokenB.symbol}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                )}
                {liquidityTokenB?.symbol ?? "Select"}
              </span>
            </button>
          </div>

          {liquidityPairReserves && lpTokenInfo && (
            <div
              style={{
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                paddingTop: "0.75rem",
                marginTop: "0.5rem"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem"
                }}
              >
                <span style={{ opacity: 0.7 }}>Your LP Tokens</span>
                <span style={{ fontWeight: 500 }}>
                  {formatNumber(lpTokenInfo.balance)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem"
                }}
              >
                <span style={{ opacity: 0.7 }}>Your Pool Share</span>
                <span style={{ fontWeight: 500 }}>
                  {formatPercent(lpTokenInfo.poolShare)}%
                </span>
              </div>
              {userPooledAmounts && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                    fontSize: "0.875rem",
                    marginTop: "0.5rem"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span className={styles.helper}>
                      {liquidityTokenA?.symbol ?? "Token A"}
                    </span>
                    <span>{userPooledAmounts.amountA}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span className={styles.helper}>
                      {liquidityTokenB?.symbol ?? "Token B"}
                    </span>
                    <span>{userPooledAmounts.amountB}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Amount</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>
              {removeLiquidityPercent}%
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={removeLiquidityPercent}
            onChange={(event) =>
              onRemoveLiquidityPercentChange(event.target.value)
            }
            style={{
              width: "100%",
              marginBottom: "0.75rem",
              accentColor: "#6b7280"
            }}
          />
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "0.75rem"
            }}
          >
            {["25", "50", "75", "100"].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onRemoveLiquidityPercentChange(pct)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  border:
                    removeLiquidityPercent === pct
                      ? "1px solid #6b7280"
                      : "1px solid rgba(255,255,255,0.1)",
                  background:
                    removeLiquidityPercent === pct
                      ? "rgba(107, 114, 128, 0.15)"
                      : "transparent",
                  color: removeLiquidityPercent === pct ? "#d1d5db" : "inherit",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  transition: "all 0.15s ease"
                }}
              >
                {pct}%
              </button>
            ))}
          </div>

          {expectedRemoveAmounts && (
            <div
              style={{
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                paddingTop: "0.75rem"
              }}
            >
              <div
                style={{
                  fontSize: "0.875rem",
                  opacity: 0.7,
                  marginBottom: "0.5rem"
                }}
              >
                You will receive:
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                  fontSize: "0.875rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between"
                  }}
                >
                  <span>{liquidityTokenA?.symbol ?? "Token A"}</span>
                  <span style={{ fontWeight: 600 }}>
                    {expectedRemoveAmounts.amountA}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between"
                  }}
                >
                  <span>{liquidityTokenB?.symbol ?? "Token B"}</span>
                  <span style={{ fontWeight: 600 }}>
                    {expectedRemoveAmounts.amountB}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.summary}>
        <button
          className={`${styles.primaryButton} ${styles.primaryFull}`}
          onClick={onRemoveLiquidity}
          disabled={buttonDisabled}
          type="button"
          style={
            transactionStatus.type === "error"
              ? {
                  background: "rgba(255, 92, 92, 0.9)",
                  borderColor: "rgba(255, 92, 92, 1)",
                  color: "#ffffff",
                  opacity: 1,
                  cursor: "not-allowed",
                  pointerEvents: "none"
                }
              : transactionStatus.type === "success"
                ? {
                    background: "var(--accent)",
                    borderColor: "var(--accent)",
                    color: "#000000",
                    opacity: 1,
                    cursor: "not-allowed",
                    pointerEvents: "none"
                  }
                : undefined
          }
        >
          {buttonLabel}
        </button>
      </div>
    </>
  );
}

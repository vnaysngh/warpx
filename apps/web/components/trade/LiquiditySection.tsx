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
  onPrimary: () => void;
  buttonLabel: string;
  buttonDisabled: boolean;
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
};

type LiquiditySectionProps = {
  mode: LiquidityMode;
  onModeChange: (mode: LiquidityMode) => void;
  addProps: LiquidityAddProps;
  removeProps: LiquidityRemoveProps;
};

export function LiquiditySection({
  mode,
  onModeChange,
  addProps,
  removeProps
}: LiquiditySectionProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.segmented}>
          <button
            type="button"
            className={`${styles.segment} ${mode === "add" ? styles.segmentActive : ""}`}
            onClick={() => onModeChange("add")}
          >
            Add
          </button>
          <button
            type="button"
            className={`${styles.segment} ${mode === "remove" ? styles.segmentActive : ""}`}
            onClick={() => onModeChange("remove")}
          >
            Remove
          </button>
        </div>
      </div>

      {mode === "add" ? (
        <LiquidityAddForm {...addProps} />
      ) : (
        <LiquidityRemoveForm {...removeProps} />
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
  onPrimary,
  buttonLabel,
  buttonDisabled
}: LiquidityAddProps) {
  return (
    <>
      <div className={styles.swapPanel}>
        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Deposit A</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("liquidityA")}
            >
              <span className={styles.assetSelectorSymbol}>
                {liquidityTokenA?.symbol ?? "Select"}
              </span>
            </button>
          </div>
          <div className={styles.assetAmountRow}>
            <input
              className={styles.amountInput}
              placeholder="0.0"
              value={liquidityForm.amountA}
              onChange={(event) => onAmountAChange(event.target.value)}
            />
          </div>
          <span className={styles.helper}>
            Balance:{" "}
            {liquidityTokenA
              ? `${formatBalance(tokenABalanceFormatted)} ${tokenASymbol ?? liquidityTokenA.symbol}`
              : "—"}
          </span>
        </div>

        <div className={styles.assetCard}>
          <div className={styles.assetHeader}>
            <span>Deposit B</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("liquidityB")}
            >
              <span className={styles.assetSelectorSymbol}>
                {liquidityTokenB?.symbol ?? "Select"}
              </span>
            </button>
          </div>
          <div className={styles.assetAmountRow}>
            <input
              className={styles.amountInput}
              placeholder="0.0"
              value={liquidityForm.amountB}
              onChange={(event) => onAmountBChange(event.target.value)}
            />
          </div>
          <span className={styles.helper}>
            Balance:{" "}
            {liquidityTokenB
              ? `${formatBalance(tokenBBalanceFormatted)} ${tokenBSymbol ?? liquidityTokenB.symbol}`
              : "—"}
          </span>
        </div>
      </div>

      <div className={styles.summary}>
        <button
          className={`${styles.primaryButton} ${styles.primaryFull}`}
          onClick={onPrimary}
          disabled={buttonDisabled}
          type="button"
        >
          {buttonLabel}
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
  ready
}: LiquidityRemoveProps) {
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
              onClick={() => onOpenTokenDialog("liquidityA")}
              style={{ flex: 1 }}
            >
              <span className={styles.assetSelectorSymbol}>
                {liquidityTokenA?.symbol ?? "Select"}
              </span>
            </button>
            <span style={{ opacity: 0.5 }}>+</span>
            <button
              type="button"
              className={styles.assetSelector}
              onClick={() => onOpenTokenDialog("liquidityB")}
              style={{ flex: 1 }}
            >
              <span className={styles.assetSelectorSymbol}>
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
            onChange={(event) => onRemoveLiquidityPercentChange(event.target.value)}
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
                  color:
                    removeLiquidityPercent === pct ? "#d1d5db" : "inherit",
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
          disabled={!ready || isSubmitting || !liquidityPairReserves}
          type="button"
        >
          {isSubmitting ? "Removing..." : "Remove Liquidity"}
        </button>
      </div>
    </>
  );
}

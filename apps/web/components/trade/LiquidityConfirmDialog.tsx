import { formatUnits, parseUnits } from "ethers";
import type {
  LiquidityFormState,
  TokenDescriptor
} from "@/lib/trade/types";
import {
  formatNumber,
  getLiquidityMinted
} from "@/lib/trade/math";
import styles from "@/app/page.module.css";

type ReserveInfo = {
  reserveA: string;
  reserveB: string;
  pairAddress: string;
  totalSupply: string;
  reserveAWei: bigint;
  reserveBWei: bigint;
  totalSupplyWei: bigint;
};

type LiquidityConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  liquidityPairReserves: ReserveInfo | null;
  liquidityForm: LiquidityFormState;
  liquidityTokenA: TokenDescriptor | null;
  liquidityTokenB: TokenDescriptor | null;
};

export function LiquidityConfirmDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  liquidityPairReserves,
  liquidityForm,
  liquidityTokenA,
  liquidityTokenB
}: LiquidityConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const lpTokensDisplay =
    liquidityPairReserves &&
    liquidityTokenA?.decimals &&
    liquidityTokenB?.decimals
      ? (() => {
          try {
            const amountAWei = parseUnits(
              liquidityForm.amountA || "0",
              liquidityTokenA.decimals
            );
            const amountBWei = parseUnits(
              liquidityForm.amountB || "0",
              liquidityTokenB.decimals
            );

            const lpTokensWei = getLiquidityMinted(
              amountAWei,
              amountBWei,
              liquidityPairReserves.reserveAWei,
              liquidityPairReserves.reserveBWei,
              liquidityPairReserves.totalSupplyWei
            );

            const lpTokensFormatted = formatUnits(lpTokensWei, 18);
            return lpTokensWei > 0n
              ? formatNumber(lpTokensFormatted, 6)
              : "0";
          } catch (err) {
            console.warn("[liquidity] LP calculation failed", err);
            return "0";
          }
        })()
      : "0";

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "420px" }}
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>YOU WILL RECEIVE</span>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "0" }}>
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(10, 255, 157, 0.08) 0%, rgba(10, 255, 157, 0.04) 100%)",
              borderBottom: "1px solid rgba(10, 255, 157, 0.15)",
              padding: "2rem 1.5rem",
              textAlign: "center"
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "0.75rem"
              }}
            >
              LP Tokens
            </div>
            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
                color: "var(--accent)"
              }}
            >
              {lpTokensDisplay}
            </div>
            <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>
              {liquidityTokenA?.symbol ?? "A"}-
              {liquidityTokenB?.symbol ?? "B"}
            </div>
          </div>

          <div style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  opacity: 0.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "0.75rem"
                }}
              >
                YOU&apos;RE PROVIDING
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }}
                >
                  <span style={{ fontSize: "0.9rem" }}>
                    {liquidityTokenA?.symbol ?? "Token A"}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {formatNumber(liquidityForm.amountA, 6)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)"
                  }}
                >
                  <span style={{ fontSize: "0.9rem" }}>
                    {liquidityTokenB?.symbol ?? "Token B"}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {formatNumber(liquidityForm.amountB, 6)}
                  </span>
                </div>
              </div>
            </div>

            {liquidityPairReserves && (
              <div
                style={{
                  marginBottom: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)"
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.75rem"
                  }}
                >
                  Exchange Rate
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    opacity: 0.8
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>1 {liquidityTokenA?.symbol} =</span>
                    <span>
                      {liquidityTokenA?.decimals && liquidityTokenB?.decimals
                        ? (() => {
                            const oneTokenAWei = parseUnits(
                              "1",
                              liquidityTokenA.decimals
                            );
                            const rateWei =
                              (oneTokenAWei * liquidityPairReserves.reserveBWei) /
                              liquidityPairReserves.reserveAWei;
                            const rateFormatted = formatUnits(
                              rateWei,
                              liquidityTokenB.decimals
                            );
                            return formatNumber(
                              rateFormatted,
                              Math.min(6, liquidityTokenB.decimals)
                            );
                          })()
                        : "—"}{" "}
                      {liquidityTokenB?.symbol}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>1 {liquidityTokenB?.symbol} =</span>
                    <span>
                      {liquidityTokenA?.decimals && liquidityTokenB?.decimals
                        ? (() => {
                            const oneTokenBWei = parseUnits(
                              "1",
                              liquidityTokenB.decimals
                            );
                            const rateWei =
                              (oneTokenBWei * liquidityPairReserves.reserveAWei) /
                              liquidityPairReserves.reserveBWei;
                            const rateFormatted = formatUnits(
                              rateWei,
                              liquidityTokenA.decimals
                            );
                            return formatNumber(
                              rateFormatted,
                              Math.min(6, liquidityTokenA.decimals)
                            );
                          })()
                        : "—"}{" "}
                      {liquidityTokenA?.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              className={`${styles.primaryButton} ${styles.primaryFull}`}
              onClick={onConfirm}
              disabled={isSubmitting}
              type="button"
              style={{ marginTop: "0.5rem" }}
            >
              {liquidityPairReserves &&
              parseFloat(liquidityPairReserves.reserveA) > 0 &&
              parseFloat(liquidityPairReserves.reserveB) > 0
                ? "Confirm Supply"
                : "Create Pair & Supply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

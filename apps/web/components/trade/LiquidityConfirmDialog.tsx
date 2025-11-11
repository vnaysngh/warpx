import { formatUnits, parseUnits } from "ethers";
import type { LiquidityFormState, TokenDescriptor } from "@/lib/trade/types";
import { formatNumber, getLiquidityMinted } from "@/lib/trade/math";
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

const computeLpTokens = (
  form: LiquidityFormState,
  tokenA: TokenDescriptor | null,
  tokenB: TokenDescriptor | null,
  reserves: ReserveInfo | null
) => {
  if (!reserves || !tokenA?.decimals || !tokenB?.decimals) return null;
  try {
    const amountAInput =
      form.amountAExact && form.amountAExact.length > 0
        ? form.amountAExact
        : form.amountA || "0";
    const amountBInput =
      form.amountBExact && form.amountBExact.length > 0
        ? form.amountBExact
        : form.amountB || "0";

    const amountAWei = parseUnits(amountAInput, tokenA.decimals);
    const amountBWei = parseUnits(amountBInput, tokenB.decimals);

    const lpTokensWei = getLiquidityMinted(
      amountAWei,
      amountBWei,
      reserves.reserveAWei,
      reserves.reserveBWei,
      reserves.totalSupplyWei
    );

    const lpTokensFormatted = formatUnits(lpTokensWei, 18);
    return lpTokensWei > 0n ? formatNumber(lpTokensFormatted, 6) : "0";
  } catch (error) {
    console.warn("[liquidity] failed to compute LP tokens", error);
    return "0";
  }
};

const computeRate = (
  numerator: TokenDescriptor | null,
  denominator: TokenDescriptor | null,
  numeratorReserve: bigint,
  denominatorReserve: bigint
) => {
  if (!numerator?.decimals || !denominator?.decimals) return "—";
  if (denominatorReserve === 0n || numeratorReserve === 0n) return "—";

  const oneUnit = parseUnits("1", numerator.decimals);
  const rateWei = (oneUnit * denominatorReserve) / numeratorReserve;
  const formatted = formatUnits(rateWei, denominator.decimals);
  return formatNumber(formatted, Math.min(6, denominator.decimals));
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
  if (!open) return null;

  const lpTokensDisplay = computeLpTokens(
    liquidityForm,
    liquidityTokenA,
    liquidityTokenB,
    liquidityPairReserves
  );

  const oneTokenAToB =
    liquidityPairReserves && liquidityTokenA && liquidityTokenB
      ? computeRate(
          liquidityTokenA,
          liquidityTokenB,
          liquidityPairReserves.reserveAWei,
          liquidityPairReserves.reserveBWei
        )
      : "—";

  const oneTokenBToA =
    liquidityPairReserves && liquidityTokenA && liquidityTokenB
      ? computeRate(
          liquidityTokenB,
          liquidityTokenA,
          liquidityPairReserves.reserveBWei,
          liquidityPairReserves.reserveAWei
        )
      : "—";

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "440px" }}
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>You will receive</span>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "0" }}>
          {lpTokensDisplay && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(107, 91, 149, 0.3) 0%, rgba(74, 58, 117, 0.2) 100%)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "2rem 1.5rem",
                textAlign: "center",
                borderRadius: "16px 16px 0 0"
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.7,
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
                  color: "#00d4ff"
                }}
              >
                {lpTokensDisplay}
              </div>
              <div style={{ fontSize: "0.875rem", opacity: 0.8 }}>
                {liquidityTokenA?.symbol ?? "A"}-
                {liquidityTokenB?.symbol ?? "B"}
              </div>
            </div>
          )}

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
                You&apos;re providing
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.9rem 1rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                  }}
                >
                  <span style={{ opacity: 0.8 }}>
                    {liquidityTokenA?.symbol ?? "Token A"}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {formatNumber(liquidityForm.amountA, 6)}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.9rem 1rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                  }}
                >
                  <span style={{ opacity: 0.8 }}>
                    {liquidityTokenB?.symbol ?? "Token B"}
                  </span>
                  <span style={{ fontWeight: 600 }}>
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
                  Exchange rate
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
                    <span>1 {liquidityTokenA?.symbol ?? "A"} =</span>
                    <span>
                      {oneTokenAToB} {liquidityTokenB?.symbol ?? "B"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>1 {liquidityTokenB?.symbol ?? "B"} =</span>
                    <span>
                      {oneTokenBToA} {liquidityTokenA?.symbol ?? "A"}
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
              (parseFloat(liquidityPairReserves.reserveA) > 0 ||
                parseFloat(liquidityPairReserves.reserveB) > 0)
                ? "Confirm Supply"
                : "Create Pair & Supply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

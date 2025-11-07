import { useMemo } from "react";
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

export type LiquidityFlowStage =
  | "review"
  | "approveA"
  | "approveB"
  | "supplying"
  | "success"
  | "error";

export type LiquidityFlowStep = "approveA" | "approveB" | "supply";

type LiquidityConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onRetry?: () => void;
  disableClose?: boolean;
  isSubmitting: boolean;
  liquidityPairReserves: ReserveInfo | null;
  liquidityForm: LiquidityFormState;
  liquidityTokenA: TokenDescriptor | null;
  liquidityTokenB: TokenDescriptor | null;
  flowStage: LiquidityFlowStage;
  flowActiveStep: LiquidityFlowStep | null;
  flowRequirements: { tokenA: boolean; tokenB: boolean };
  flowError?: string | null;
};

const STEP_LABELS: Record<LiquidityFlowStep, string> = {
  approveA: "Approve Token A",
  approveB: "Approve Token B",
  supply: "Supply liquidity"
};

export function LiquidityConfirmDialog({
  open,
  onClose,
  onConfirm,
  onRetry,
  disableClose = false,
  isSubmitting,
  liquidityPairReserves,
  liquidityForm,
  liquidityTokenA,
  liquidityTokenB,
  flowStage,
  flowActiveStep,
  flowRequirements,
  flowError
}: LiquidityConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const handleBackdropClick = () => {
    if (disableClose) return;
    onClose();
  };

  const handleClose = () => {
    if (disableClose) return;
    onClose();
  };

  const showLpTokensSection =
    flowStage === "review" &&
    liquidityPairReserves &&
    liquidityTokenA?.decimals &&
    liquidityTokenB?.decimals;

  const lpTokensDisplay = showLpTokensSection
    ? (() => {
        try {
          const amountAInput =
            liquidityForm.amountAExact && liquidityForm.amountAExact.length > 0
              ? liquidityForm.amountAExact
              : liquidityForm.amountA || "0";
          const amountBInput =
            liquidityForm.amountBExact && liquidityForm.amountBExact.length > 0
              ? liquidityForm.amountBExact
              : liquidityForm.amountB || "0";

          const amountAWei = parseUnits(
            amountAInput,
            liquidityTokenA.decimals
          );
          const amountBWei = parseUnits(
            amountBInput,
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
    : null;

  const stepConfigs = useMemo(() => {
    const steps: Array<{ key: LiquidityFlowStep; label: string }> = [];
    if (flowRequirements.tokenA) {
      steps.push({
        key: "approveA",
        label: `Approve ${liquidityTokenA?.symbol ?? "Token A"}`
      });
    }
    if (flowRequirements.tokenB) {
      steps.push({
        key: "approveB",
        label: `Approve ${liquidityTokenB?.symbol ?? "Token B"}`
      });
    }

    // Check if pair already exists (has reserves)
    const pairExists =
      liquidityPairReserves &&
      (liquidityPairReserves.reserveAWei > 0n ||
        liquidityPairReserves.reserveBWei > 0n);

    steps.push({
      key: "supply",
      label: pairExists ? "Supply liquidity" : "Create pair & supply"
    });
    return steps;
  }, [flowRequirements, liquidityTokenA?.symbol, liquidityTokenB?.symbol, liquidityPairReserves]);

  const stepKeys = stepConfigs.map((step) => step.key);
  const activeIndex = (() => {
    switch (flowStage) {
      case "approveA":
        return stepKeys.indexOf("approveA");
      case "approveB":
        return stepKeys.indexOf("approveB");
      case "supplying":
        return stepKeys.indexOf("supply");
      case "success":
        return stepKeys.length;
      case "error":
        return flowActiveStep ? stepKeys.indexOf(flowActiveStep) : -1;
      default:
        return -1;
    }
  })();

  const getStepStatus = (step: LiquidityFlowStep, index: number) => {
    if (flowStage === "success") {
      return "completed";
    }
    if (flowStage === "error") {
      if (flowActiveStep && step === flowActiveStep) {
        return "error";
      }
      if (flowActiveStep) {
        const failedIndex = stepKeys.indexOf(flowActiveStep);
        if (failedIndex > index) {
          return "completed";
        }
      }
    }
    if (activeIndex === -1) {
      return "pending";
    }
    if (index < activeIndex) {
      return "completed";
    }
    if (index === activeIndex) {
      if (flowStage === "error") {
        return "error";
      }
      return "active";
    }
    return "pending";
  };

  const StepList = () => (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {stepConfigs.map((step, index) => {
        const status = getStepStatus(step.key, index);
        return (
          <div
            key={step.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              opacity: status === "pending" ? 0.6 : 1
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.4)",
                background:
                  status === "completed"
                    ? "var(--accent)"
                    : status === "active"
                      ? "rgba(255,255,255,0.8)"
                      : status === "error"
                        ? "#ff6b6b"
                        : "transparent"
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.9rem" }}>{step.label}</div>
              {status === "active" && (
                <div className={styles.loaderDots} style={{ justifyContent: "flex-start", marginTop: "0.15rem" }}>
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {status === "completed" && (
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>Completed</div>
              )}
              {status === "error" && (
                <div style={{ fontSize: "0.75rem", color: "#ff6b6b" }}>Failed</div>
              )}
            </div>
          </div>
        );
      })}
      {flowStage === "error" && (
        <div style={{ marginTop: "0.5rem" }}>
          <div style={{ color: "#ff9e9e", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            {flowError ?? "Transaction failed. Please try again."}
          </div>
          {onRetry && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onRetry}
              style={{ width: "100%" }}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {flowStage === "success" && (
        <div style={{ color: "var(--accent)", fontSize: "0.85rem" }}>Supply confirmed. Finalizing…</div>
      )}
    </div>
  );

  const showProgress = flowStage !== "review";

  return (
    <div className={styles.dialogBackdrop} onClick={handleBackdropClick}>
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "440px" }}
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>
            {showProgress ? "Supplying liquidity" : "You will receive"}
          </span>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={handleClose}
            disabled={disableClose}
            aria-disabled={disableClose}
          >
            Close
          </button>
        </div>

        {showProgress ? (
          <StepList />
        ) : (
          <div style={{ padding: "0" }}>
            {showLpTokensSection && lpTokensDisplay !== null ? (
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
            ) : null}

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
        )}
      </div>
    </div>
  );
}

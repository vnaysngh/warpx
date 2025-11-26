import type {
  LiquidityFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import styles from "@/app/page.module.css";
import { useLocalization } from "@/lib/format/LocalizationContext";
import { NumberType, formatTokenAmount } from "@/lib/format/formatNumbers";
import { parseUnits } from "ethers";
import { getLiquidityMinted } from "@/lib/trade/math";

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
  liquidityPairReserves: ReserveInfo | null;
  lpTokenInfo: { balance: string; poolShare: string } | null;
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
    <section>
      {allowRemove ? (
        <div className="mb-12">
          <div className="flex gap-1 border-b border-border pb-4">
            <button
              type="button"
              className={`px-6 py-2 font-mono text-sm uppercase tracking-wider font-bold transition-all border border-transparent ${
                effectiveMode === "add"
                  ? "bg-primary text-black"
                  : "bg-card hover:bg-card/80 text-muted-foreground"
              }`}
              onClick={() => handleModeChange("add")}
            >
              <svg
                className="w-4 h-4 inline mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" />
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" />
              </svg>
              Add Liquidity
            </button>
            <button
              type="button"
              className={`px-6 py-2 font-mono text-sm uppercase tracking-wider font-bold transition-all border border-transparent ${
                effectiveMode === "remove"
                  ? "bg-primary text-black"
                  : "bg-card hover:bg-card/80 text-muted-foreground"
              }`}
              onClick={() => handleModeChange("remove")}
            >
              <svg
                className="w-4 h-4 inline mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" />
              </svg>
              Remove Liquidity
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
  liquidityPairReserves,
  lpTokenInfo,
  transactionStatus
}: LiquidityAddProps & { tokenSelectionEnabled: boolean; buttonVariant?: "default" | "highlight" }) {
  const { formatNumber: formatDisplayNumber, formatPercent } = useLocalization();

  // Calculate exchange rate (reserveB / reserveA)
  const exchangeRate =
    liquidityPairReserves &&
    liquidityPairReserves.reserveAWei > 0n &&
    liquidityPairReserves.reserveBWei > 0n
      ? formatDisplayNumber({
          input: (
            Number(liquidityPairReserves.reserveBWei) /
            Number(liquidityPairReserves.reserveAWei)
          ).toString(),
          type: NumberType.TokenNonTx
        })
      : "—";

  // Calculate LP tokens to be minted
  const lpTokensDisplay = (() => {
    if (!liquidityPairReserves || !liquidityTokenA || !liquidityTokenB) {
      return "—";
    }

    try {
      const amountAInput =
        liquidityForm.amountAExact && liquidityForm.amountAExact.length > 0
          ? liquidityForm.amountAExact
          : liquidityForm.amountA || "0";
      const amountBInput =
        liquidityForm.amountBExact && liquidityForm.amountBExact.length > 0
          ? liquidityForm.amountBExact
          : liquidityForm.amountB || "0";

      if (
        !amountAInput ||
        amountAInput === "0" ||
        !amountBInput ||
        amountBInput === "0"
      ) {
        return "—";
      }

      const amountAWei = parseUnits(amountAInput, liquidityTokenA.decimals);
      const amountBWei = parseUnits(amountBInput, liquidityTokenB.decimals);

      const lpTokensWei = getLiquidityMinted(
        amountAWei,
        amountBWei,
        liquidityPairReserves.reserveAWei,
        liquidityPairReserves.reserveBWei,
        liquidityPairReserves.totalSupplyWei
      );

      return formatTokenAmount(lpTokensWei, 18, NumberType.LPToken);
    } catch (error) {
      console.warn("[liquidity] failed to compute LP tokens", error);
      return "—";
    }
  })();

  // Calculate TVL (reserveA + reserveB values - placeholder, needs price data)
  const tvlDisplay = liquidityPairReserves
    ? `${formatDisplayNumber({
        input: liquidityPairReserves.reserveA,
        type: NumberType.TokenNonTx
      })} ${tokenASymbol} + ${formatDisplayNumber({
        input: liquidityPairReserves.reserveB,
        type: NumberType.TokenNonTx
      })} ${tokenBSymbol}`
    : "—";

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
    <div className="space-y-4">
      {/* Token Inputs - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Token A */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {tokenASymbol ?? "TOKEN A"}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder="0"
              value={liquidityForm.amountA}
              onChange={(event) => onAmountAChange(event.target.value)}
              className="h-14 w-full bg-background border border-border rounded-none text-2xl font-mono font-bold focus-visible:ring-1 focus-visible:ring-primary/50 px-3 focus:outline-none"
            />
            {liquidityTokenA && tokenABalanceFormatted && (
              <button
                type="button"
                onClick={onSetMaxAmountA}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-primary hover:text-primary/80"
              >
                MAX
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Bal: {liquidityTokenA ? formatBalance(tokenABalanceFormatted) : "0"}
          </div>
        </div>

        {/* Token B */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {tokenBSymbol ?? "TOKEN B"}
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder="0"
              value={liquidityForm.amountB}
              onChange={(event) => onAmountBChange(event.target.value)}
              className="h-14 w-full bg-background border border-border rounded-none text-2xl font-mono font-bold focus-visible:ring-1 focus-visible:ring-primary/50 px-3 text-primary focus:outline-none"
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Bal: {liquidityTokenB ? formatBalance(tokenBBalanceFormatted) : "0"}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div className="bg-card p-3 border border-border">
          <div className="text-xs text-muted-foreground font-mono mb-1">
            RATE
          </div>
          <div className="text-sm font-mono font-bold">
            1 {tokenASymbol}
          </div>
          <div className="text-xs text-foreground font-mono">
            {exchangeRate} {tokenBSymbol}
          </div>
        </div>
        <div className="bg-card p-3 border border-border">
          <div className="text-xs text-muted-foreground font-mono mb-1">
            LP TOKENS
          </div>
          <div className="text-sm font-mono font-bold text-primary">
            {lpTokensDisplay}
          </div>
          <div className="text-xs text-foreground font-mono">
            to receive
          </div>
        </div>
        <div className="bg-card p-3 border border-border">
          <div className="text-xs text-muted-foreground font-mono mb-1">
            GAS
          </div>
          <div className="text-sm font-mono font-bold">&lt; $0.01</div>
          <div className="text-xs text-foreground font-mono">
            on MegaETH
          </div>
        </div>
      </div>

      <button
        onClick={onPrimary}
        disabled={finalButtonDisabled}
        type="button"
        className={`w-full h-14 text-lg font-bold font-mono uppercase tracking-wider rounded-none transition-all ${
          finalButtonDisabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-black hover:bg-primary/90"
        } ${
          transactionStatus.type === "error"
            ? "!bg-red-500 !text-white"
            : transactionStatus.type === "success"
              ? "!bg-accent !text-black"
              : ""
        }`}
      >
        {finalButtonLabel}
      </button>
    </div>
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
  const {
    formatNumber: formatDisplayNumber,
    formatPercent
  } = useLocalization();
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
    <div className="space-y-4">
      {/* Position Display */}
      {liquidityPairReserves && lpTokenInfo && userPooledAmounts && (
        <div className="border border-border bg-card/50 p-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
            CURRENT POSITION
          </div>
          <div className="text-3xl font-mono font-bold mb-4">
            {formatDisplayNumber({
              input: lpTokenInfo.balance,
              type: NumberType.TokenNonTx
            })} LP
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <div className="text-muted-foreground text-xs mb-1">
                Token 0
              </div>
              <div className="font-bold">
                {userPooledAmounts.amountA} {liquidityTokenA?.symbol}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">
                Token 1
              </div>
              <div className="font-bold">
                {userPooledAmounts.amountB} {liquidityTokenB?.symbol}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Percentage */}
      <div className="border border-border bg-card/50 p-4">
        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-4">
          WITHDRAW {removeLiquidityPercent}%
        </label>

        {/* Slider */}
        <input
          type="range"
          min="1"
          max="100"
          value={removeLiquidityPercent}
          onChange={(event) => onRemoveLiquidityPercentChange(event.target.value)}
          className="w-full h-2 mb-4 appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(336 70% 65%) 0%, hsl(336 70% 65%) ${removeLiquidityPercent}%, hsl(0 0% 16%) ${removeLiquidityPercent}%, hsl(0 0% 16%) 100%)`
          }}
        />

        {/* Quick Select Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {["25", "50", "75", "100"].map((percent) => (
            <button
              key={percent}
              onClick={() => onRemoveLiquidityPercentChange(percent)}
              className={`py-2 text-xs font-mono font-bold border border-border rounded-none transition-all ${
                removeLiquidityPercent === percent
                  ? "bg-primary text-black"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* You Will Receive */}
      {expectedRemoveAmounts && (
        <div className="border border-border bg-card/50 p-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            YOU WILL RECEIVE
          </div>
          <div className="space-y-2 font-mono text-sm">
            <div className="flex justify-between items-center">
              <span>
                {expectedRemoveAmounts.amountA} {liquidityTokenA?.symbol}
              </span>
              <span className="text-muted-foreground">—</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span>
                {expectedRemoveAmounts.amountB} {liquidityTokenB?.symbol}
              </span>
              <span className="text-muted-foreground">—</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onRemoveLiquidity}
        disabled={buttonDisabled}
        type="button"
        className={`w-full h-14 text-lg font-bold font-mono uppercase tracking-wider rounded-none transition-all ${
          buttonDisabled
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-black hover:bg-primary/90"
        } ${
          transactionStatus.type === "error"
            ? "!bg-red-500 !text-white"
            : transactionStatus.type === "success"
              ? "!bg-accent !text-black"
              : ""
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

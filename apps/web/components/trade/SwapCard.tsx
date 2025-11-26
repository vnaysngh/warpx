import type {
  Quote,
  SwapFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import { formatValueWithLocale } from "@/lib/utils/input";

type SwapCardProps = {
  swapForm: SwapFormState;
  swapQuote: Quote | null;
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
  priceImpactDisplay: string | null;
  slippage: string | null;
  buttonLabel: string;
  buttonDisabled: boolean;
  onButtonClick: (() => void) | null;
  transactionStatus: {
    message: string;
    type: "idle" | "pending" | "success" | "error";
  } | null;
  locale: string;
};

export function SwapCard({
  swapForm,
  swapQuote,
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
  priceImpactDisplay,
  slippage,
  buttonLabel,
  buttonDisabled,
  onButtonClick,
  transactionStatus,
  locale
}: SwapCardProps) {
  const displayAmountIn = formatValueWithLocale(swapForm.amountIn, locale);
  const displayReceiveValue = formatValueWithLocale(receiveValue, locale);

  const TokenButton = ({
    token,
    slot
  }: {
    token: TokenDescriptor | null;
    slot: TokenDialogSlot;
  }) => (
    <button
      type="button"
      onClick={() => onOpenTokenDialog(slot)}
      className="flex items-center gap-2 bg-card border border-border px-2 py-1 cursor-pointer hover:border-primary/50 transition-colors"
    >
      {token?.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={token.logo}
          alt={token.symbol}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="h-4 w-4 rounded-full bg-muted" />
      )}
      <span className="font-bold text-sm">{token?.symbol ?? "SELECT"}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  return (
    <section className="space-y-6">
      <header className="flex justify-between items-center mb-6">
        <h2 className="font-display font-bold text-xl uppercase">EXECUTE</h2>
        <button
          type="button"
          className="h-8 w-8 rounded-none hover:bg-white/5 text-muted-foreground flex items-center justify-center"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <div className="space-y-1 mb-8">
        <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
          <span>PAY</span>
          {selectedIn && (
            <button
              type="button"
              onClick={onSetMaxSwapAmount}
              className="hover:text-primary transition-colors"
            >
              BAL: {formatBalance(swapInBalanceFormatted)}
            </button>
          )}
        </div>
        <div className="relative group">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            pattern="^[0-9]*[.,]?[0-9]*$"
            placeholder="0.00"
            value={displayAmountIn}
            onChange={(event) => onAmountInChange(event.target.value)}
            className="h-16 w-full bg-background border border-border rounded-none text-3xl font-mono pl-4 pr-24 focus-visible:ring-1 focus-visible:ring-primary/50 focus:outline-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <TokenButton token={selectedIn} slot="swapIn" />
          </div>
        </div>
      </div>

      <div className="flex justify-center -my-4 relative z-10">
        <button
          type="button"
          onClick={onSwapTokens}
          className="rounded-none h-8 w-8 border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center"
          aria-label="Swap tokens"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 16V4m0 0L3 8m4-4l4 4" />
            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      <div className="space-y-1 mb-8">
        <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
          <span>RECEIVE</span>
          {selectedOut && <span>BAL: {formatBalance(null)}</span>}
        </div>
        <div className="relative group">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            pattern="^[0-9]*[.,]?[0-9]*$"
            placeholder={
              swapQuote
                ? formatValueWithLocale(swapQuote.amount, locale)
                : "0.00"
            }
            value={displayReceiveValue}
            onChange={(event) => onMinOutChange(event.target.value)}
            className="h-16 w-full bg-background border border-border rounded-none text-3xl font-mono pl-4 pr-24 focus-visible:ring-1 focus-visible:ring-primary/50 focus:outline-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <TokenButton token={selectedOut} slot="swapOut" />
          </div>
        </div>
      </div>

      {/* {transactionStatus && transactionStatus.type !== "idle" && (
        <div className="rounded border border-border/60 bg-surface-alt/70 p-3 text-xs text-foreground mb-6">
          {transactionStatus.message}
        </div>
      )} */}

      <div className="space-y-3 mb-6 border-t border-border pt-4">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">SLIPPAGE</span>
          <span>{slippage ?? "—"}</span>
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">NETWORK FEE</span>
          <span className="text-primary">$0.02</span>
        </div>
        {summaryMessage && (
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">ROUTE</span>
            <span>ETH &gt; MEGA &gt; USDC</span>
          </div>
        )}
        {minReceived && selectedOut && (
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">MIN RECEIVED</span>
            <span>
              {minReceived} {selectedOut.symbol}
            </span>
          </div>
        )}
        {priceImpact !== null && (
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">PRICE IMPACT</span>
            <span className={priceImpact > 3 ? "text-warning" : ""}>
              {priceImpactDisplay}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onButtonClick?.()}
        disabled={buttonDisabled}
        className={`w-full h-14 font-bold font-mono text-lg uppercase tracking-wider rounded-none transition ${
          buttonDisabled
            ? "cursor-not-allowed border border-border bg-muted text-muted-foreground"
            : "bg-primary text-black hover:bg-primary/90"
        }`}
      >
        {buttonLabel}
      </button>

      <div className="mt-4 text-center">
        <span className="text-[10px] text-muted-foreground font-mono flex items-center justify-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          POWERED BY MEGA_ETH
        </span>
      </div>
    </section>
  );
}

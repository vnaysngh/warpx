import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import { shortAddress } from "@/lib/utils/format";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useLocalization } from "@/lib/format/LocalizationContext";

type TokenDialogProps = {
  open: boolean;
  onClose: () => void;
  tokenDialogSide: TokenDialogSlot;
  tokenSearch: string;
  onSearchChange: (value: string) => void;
  filteredTokens: TokenDescriptor[];
  showCustomOption: boolean;
  activeAddress: string | null;
  onSelectToken: (token: TokenDescriptor) => void;
  onSelectCustomToken: (address: string) => void;
  isFetchingCustomToken?: boolean;
  prefetchedTokenDetails?: {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
  } | null;
  walletAccount?: string | null;
  provider?: JsonRpcProvider;
};

export function TokenDialog({
  open,
  onClose,
  tokenDialogSide,
  tokenSearch,
  onSearchChange,
  filteredTokens,
  showCustomOption,
  activeAddress,
  onSelectToken,
  onSelectCustomToken,
  isFetchingCustomToken = false,
  prefetchedTokenDetails = null,
  walletAccount = null,
  provider
}: TokenDialogProps) {
  const { formatTokenBalance } = useLocalization();

  const tokensToFetch = useMemo(() => {
    const tokens = [...filteredTokens];
    if (showCustomOption && prefetchedTokenDetails) {
      const customAddress = tokenSearch.trim().toLowerCase();
      const alreadyInList = tokens.some(
        (token) => token.address.toLowerCase() === customAddress
      );
      if (!alreadyInList) {
        tokens.push({
          symbol: prefetchedTokenDetails.symbol,
          name: prefetchedTokenDetails.name,
          address: tokenSearch.trim(),
          decimals: prefetchedTokenDetails.decimals,
          isNative: false
        });
      }
    }
    return tokens;
  }, [filteredTokens, showCustomOption, prefetchedTokenDetails, tokenSearch]);

  const { data: balancesMap } = useTokenBalances({
    tokens: tokensToFetch,
    account: walletAccount,
    provider: provider!,
    enabled: open && Boolean(walletAccount) && Boolean(provider)
  });

  if (!open) {
    return null;
  }

  const dialogLabel =
    tokenDialogSide === "swapIn"
      ? "Sell"
      : tokenDialogSide === "swapOut"
        ? "Receive"
        : tokenDialogSide === "liquidityA"
          ? "Deposit A"
          : "Deposit B";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4 py-10 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded border border-white/10 bg-black/80 p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.75)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="font-display text-lg uppercase tracking-[0.4em]">
              Select {dialogLabel} token
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/40">
              Search by symbol or contract
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-white/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.3em] text-white/60 transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <input
            className="w-full rounded border border-white/10 bg-black/50 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:border-primary focus:outline-none"
            placeholder="Search name or paste address"
            value={tokenSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            autoFocus
          />
        </div>

        <div className="mt-5 max-h-[420px] space-y-2 overflow-y-auto pr-2">
          {filteredTokens.length === 0 && !showCustomOption ? (
            <div className="rounded border border-white/10 bg-black/40 px-4 py-10 text-center font-mono text-xs uppercase tracking-[0.3em] text-white/40">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => {
              const balance = balancesMap?.get(token.address.toLowerCase());
              const formattedBalance = formatTokenBalance(
                balance,
                token.decimals
              );
              const isActive =
                activeAddress === token.address.toLowerCase() ||
                (!activeAddress && token.isNative);

              return (
                <button
                  type="button"
                  key={token.address}
                  className={`flex w-full items-center justify-between rounded border px-5 py-4 transition ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-white/10 bg-black/40 text-white hover:border-primary/60 hover:text-primary"
                  }`}
                  onClick={() => onSelectToken(token)}
                >
                  <div className="flex items-center gap-4 text-left">
                    {token.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        className="h-10 w-10 rounded-full border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-bold">
                        {token.symbol.slice(0, 3)}
                      </div>
                    )}
                    <div className="flex flex-col text-sm">
                      <div className="flex items-center gap-3 font-display text-base tracking-[0.2em]">
                        <span>{token.symbol}</span>
                        <CopyAddressButton
                          value={token.address}
                          displayValue={shortAddress(token.address)}
                        />
                      </div>
                      <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                        {token.name}
                      </span>
                    </div>
                  </div>
                  {walletAccount && (
                    <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
                      {formattedBalance}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {showCustomOption && prefetchedTokenDetails && (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded border border-dashed border-primary/40 bg-black/40 px-5 py-4 text-white hover:border-primary"
              onClick={() => onSelectCustomToken(tokenSearch)}
              disabled={isFetchingCustomToken}
            >
              <div className="flex items-center gap-4 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-base">
                  ?
                </div>
                <div className="flex flex-col text-sm">
                  <div className="flex items-center gap-3 font-display text-base tracking-[0.2em]">
                    <span>
                      {isFetchingCustomToken
                        ? "Loading..."
                        : prefetchedTokenDetails.symbol}
                    </span>
                    <CopyAddressButton
                      value={tokenSearch.trim()}
                      displayValue={shortAddress(tokenSearch.trim())}
                    />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
                    {isFetchingCustomToken
                      ? "Fetching token details..."
                      : prefetchedTokenDetails.name}
                  </span>
                </div>
              </div>
              {walletAccount && !isFetchingCustomToken && (() => {
                const customTokenBalance = balancesMap?.get(
                  tokenSearch.trim().toLowerCase()
                );
                const formattedCustomBalance = formatTokenBalance(
                  customTokenBalance,
                  prefetchedTokenDetails.decimals
                );
                return (
                  <span className="font-mono text-xs uppercase tracking-[0.3em] text-white/60">
                    {formattedCustomBalance}
                  </span>
                );
              })()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyAddressButton({
  value,
  displayValue
}: {
  value: string;
  displayValue: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!value || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
      resetTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("[clipboard] failed to copy value", error);
    }
  }, [value]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      handleCopy();
    },
    [handleCopy]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCopy();
      }
    },
    [handleCopy]
  );

  return (
    <span
      role="button"
      tabIndex={0}
      className="inline-flex items-center gap-2 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/50 transition hover:border-primary hover:text-primary"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span>{displayValue}</span>
      {copied ? (
        <CopySuccessIcon className="h-3 w-3 text-primary" />
      ) : (
        <CopyIcon className="h-3 w-3 text-white/60" />
      )}
    </span>
  );
}

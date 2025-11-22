import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import { shortAddress } from "@/lib/utils/format";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import styles from "@/app/page.module.css";
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
  // Create a list that includes both filtered tokens and the custom token (if any)
  const tokensToFetch = useMemo(() => {
    const tokens = [...filteredTokens];

    // Add custom token if it exists and is not already in the list
    if (showCustomOption && prefetchedTokenDetails) {
      const customAddress = tokenSearch.trim().toLowerCase();
      const alreadyInList = tokens.some(t => t.address.toLowerCase() === customAddress);

      if (!alreadyInList) {
        tokens.push({
          symbol: prefetchedTokenDetails.symbol,
          name: prefetchedTokenDetails.name,
          address: tokenSearch.trim(),
          decimals: prefetchedTokenDetails.decimals,
          isNative: false,
        });
      }
    }

    return tokens;
  }, [filteredTokens, showCustomOption, prefetchedTokenDetails, tokenSearch]);

  // Fetch token balances for all tokens including custom token
  const { data: balancesMap } = useTokenBalances({
    tokens: tokensToFetch,
    account: walletAccount,
    provider: provider!,
    enabled: open && !!walletAccount && !!provider,
  });

  if (!open) {
    return null;
  }

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <span className={styles.dialogTitle}>
            Select{" "}
            {tokenDialogSide === "swapIn"
              ? "sell"
              : tokenDialogSide === "swapOut"
                ? "receive"
                : tokenDialogSide === "liquidityA"
                  ? "deposit A"
                  : "deposit B"}{" "}
            token
          </span>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <input
          className={styles.dialogSearch}
          placeholder="Search name or paste address"
          value={tokenSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          autoFocus
        />
        <div className={styles.dialogList}>
          {filteredTokens.length === 0 && !showCustomOption ? (
            <div className={styles.dialogEmpty}>No tokens found</div>
          ) : (
            filteredTokens.map((token) => {
              const balance = balancesMap?.get(token.address.toLowerCase());
              const formattedBalance = formatTokenBalance(balance, token.decimals);

              return (
                <button
                  type="button"
                  key={token.address}
                  className={`${styles.dialogItem} ${
                    activeAddress === token.address.toLowerCase()
                      ? styles.dialogSelected
                      : ""
                  }`.trim()}
                  onClick={() => onSelectToken(token)}
                >
                  <div className={styles.dialogLeft}>
                    {token.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        className={styles.dialogLogo}
                      />
                    )}
                    <div className={styles.dialogMeta}>
                      <div className={styles.dialogTokenInfo}>
                        <span className={styles.dialogSymbol}>{token.symbol}</span>
                        <CopyAddressButton
                          value={token.address}
                          displayValue={shortAddress(token.address)}
                        />
                      </div>
                      <span className={styles.dialogName}>{token.name}</span>
                    </div>
                  </div>
                  {walletAccount && (
                    <span className={styles.dialogBalance}>
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
              className={styles.dialogItem}
              onClick={() => onSelectCustomToken(tokenSearch)}
              disabled={isFetchingCustomToken}
            >
              <div className={styles.dialogLeft}>
                <div className={styles.dialogLogo} style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  ?
                </div>
                <div className={styles.dialogMeta}>
                  <div className={styles.dialogTokenInfo}>
                    <span className={styles.dialogSymbol}>
                      {isFetchingCustomToken ? "Loading..." : prefetchedTokenDetails.symbol}
                    </span>
                    <CopyAddressButton
                      value={tokenSearch.trim()}
                      displayValue={shortAddress(tokenSearch.trim())}
                    />
                  </div>
                  <span className={styles.dialogName}>
                    {isFetchingCustomToken ? "Fetching token details..." : prefetchedTokenDetails.name}
                  </span>
                </div>
              </div>
              {walletAccount && !isFetchingCustomToken && (() => {
                const customTokenBalance = balancesMap?.get(tokenSearch.trim().toLowerCase());
                const formattedCustomBalance = formatTokenBalance(customTokenBalance, prefetchedTokenDetails.decimals);
                return (
                  <span className={styles.dialogBalance}>
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
      className={`${styles.dialogAddress} ${styles.copyTrigger}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span>{displayValue}</span>
      {copied ? (
        <CopySuccessIcon className={`${styles.copyIcon} ${styles.copyIconSuccess}`} />
      ) : (
        <CopyIcon className={styles.copyIcon} />
      )}
    </span>
  );
}

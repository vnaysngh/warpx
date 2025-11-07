import { useCallback, useEffect, useRef, useState } from "react";
import { shortAddress } from "@/lib/utils/format";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import styles from "@/app/page.module.css";
import { CopyIcon, CopySuccessIcon } from "@/components/icons/CopyIcon";

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
  prefetchedTokenDetails = null
}: TokenDialogProps) {
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
            filteredTokens.map((token) => (
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
                <div className={styles.dialogMeta}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    {token.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.logo}
                        alt={token.symbol}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0
                        }}
                      />
                    )}
                    <span className={styles.dialogSymbol}>{token.symbol}</span>
                  </div>
                  {/* <span className={styles.dialogAddress}>{token.name}</span> */}
                </div>
                <CopyAddressButton
                  value={token.address}
                  displayValue={shortAddress(token.address)}
                />
              </button>
            ))
          )}
          {showCustomOption && (
            <button
              type="button"
              className={styles.dialogItem}
              onClick={() => onSelectCustomToken(tokenSearch)}
              disabled={isFetchingCustomToken || !prefetchedTokenDetails}
            >
              <div className={styles.dialogMeta}>
                <span className={styles.dialogSymbol}>
                  {isFetchingCustomToken
                    ? "Loading..."
                    : prefetchedTokenDetails
                      ? `Import ${prefetchedTokenDetails.symbol}`
                      : "Import"}
                </span>
                <span className={styles.dialogAddress}>
                  {isFetchingCustomToken
                    ? "Fetching token details..."
                    : prefetchedTokenDetails
                      ? prefetchedTokenDetails.name
                      : "Unknown token"}
                </span>
              </div>
              <CopyAddressButton
                value={tokenSearch.trim()}
                displayValue={shortAddress(tokenSearch.trim())}
              />
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

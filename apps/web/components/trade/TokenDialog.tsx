import { shortAddress } from "@/lib/utils/format";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import styles from "@/app/page.module.css";

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
  onSelectCustomToken
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
                <span className={styles.dialogAddress}>
                  {shortAddress(token.address)}
                </span>
              </button>
            ))
          )}
          {showCustomOption && (
            <button
              type="button"
              className={styles.dialogItem}
              onClick={() => onSelectCustomToken(tokenSearch)}
            >
              <div className={styles.dialogMeta}>
                <span className={styles.dialogSymbol}>Custom</span>
                <span className={styles.dialogAddress}>
                  Use provided address
                </span>
              </div>
              <span className={styles.dialogAddress}>
                {shortAddress(tokenSearch.trim())}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

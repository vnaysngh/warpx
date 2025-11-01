"use client";

import type { TokenDescriptor } from "@/lib/trade/types";
import styles from "./PoolsTable.module.css";

export type PoolsTableRow = {
  id: number;
  pairAddress: string;
  token0: TokenDescriptor;
  token1: TokenDescriptor;
  totalLiquidityFormatted: string;
  totalLiquidityValue: number;
  userLpBalance?: string;
  userLpBalanceRaw?: bigint;
};

type PoolsTableProps = {
  pools: PoolsTableRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectPool?: (pool: PoolsTableRow) => void;
};

export function PoolsTable({
  pools,
  loading,
  error,
  onRetry,
  onSelectPool
}: PoolsTableProps) {
  const showSkeleton = loading && pools.length === 0 && !error;
  const showEmpty = !loading && pools.length === 0 && !error;
  const showError = Boolean(error);

  return (
    <div
      className={styles.tableContainer}
      data-loading={loading ? "true" : "false"}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Pool</th>
            <th>Protocol</th>
            <th>Fee tier</th>
            <th>TVL in ETH</th>
          </tr>
        </thead>
        <tbody>
          {showSkeleton &&
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                <td colSpan={5}>
                  <div className={styles.skeletonLine} />
                </td>
              </tr>
            ))}

          {!showSkeleton &&
            !showError &&
            pools.map((pool) => (
              <tr
                key={pool.pairAddress}
                className={styles.dataRow}
                onClick={() => onSelectPool?.(pool)}
                role={onSelectPool ? "button" : undefined}
                tabIndex={onSelectPool ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!onSelectPool) return;
                  if (
                    event.key === "Enter" ||
                    event.key === " " ||
                    event.key === "Spacebar"
                  ) {
                    event.preventDefault();
                    onSelectPool(pool);
                  }
                }}
              >
                <td className={styles.indexCell}>{pool.id}</td>
                <td className={styles.poolCell}>
                  <div className={styles.poolStack}>
                    <div className={styles.tokenStack}>
                      {pool.token0.logo ? (
                        <img
                          src={pool.token0.logo}
                          alt={pool.token0.symbol}
                          className={`${styles.tokenBadge} ${styles.tokenBadgePrimary}`}
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <span
                          className={`${styles.tokenBadge} ${styles.tokenBadgePrimary}`}
                        >
                          {pool.token0.symbol.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                      {pool.token1.logo ? (
                        <img
                          src={pool.token1.logo}
                          alt={pool.token1.symbol}
                          className={`${styles.tokenBadge} ${styles.tokenBadgeSecondary}`}
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <span
                          className={`${styles.tokenBadge} ${styles.tokenBadgeSecondary}`}
                        >
                          {pool.token1.symbol.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className={styles.poolMeta}>
                      <div className={styles.poolLabel}>
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </div>
                      <div className={styles.poolAddress}>
                        {pool.pairAddress.slice(0, 6)}…
                        {pool.pairAddress.slice(-4)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={styles.protocolCell}>v2</td>
                <td className={styles.feeCell}>0.20%</td>
                <td className={styles.tvlCell}>
                  {pool.totalLiquidityFormatted} ETH
                </td>
              </tr>
            ))}

          {!showSkeleton && showEmpty && (
            <tr>
              <td colSpan={5} className={styles.stateCell}>
                No liquidity pools found. Check back soon or create one to get
                started!
              </td>
            </tr>
          )}

          {showError && (
            <tr>
              <td colSpan={5} className={styles.stateCell}>
                <div className={styles.stateContent}>
                  <span>{error}</span>
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={onRetry}
                  >
                    Try again
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import type { TokenDescriptor } from "@/lib/trade/types";
import { FEES_DENOMINATOR, FEES_NUMERATOR } from "@/lib/trade/constants";
import { formatCompactNumber } from "@/lib/trade/math";

const DEFAULT_FEE_PERCENT_DISPLAY = (
  (Number(FEES_DENOMINATOR - FEES_NUMERATOR) / Number(FEES_DENOMINATOR)) *
  100
).toFixed(2);

const getDisplaySymbol = (token: TokenDescriptor): string => {
  if (token.isNative || token.symbol.toUpperCase() === "WMETH") {
    return "ETH";
  }
  if (
    token.symbol.length > 1 &&
    token.symbol[0] === "X" &&
    token.symbol[1] === token.symbol[1].toUpperCase()
  ) {
    return `x${token.symbol.slice(1)}`;
  }
  return token.symbol;
};

export type PoolsTableRow = {
  id: number;
  pairAddress: string;
  token0: TokenDescriptor;
  token1: TokenDescriptor;
  contractToken0Address?: string;
  contractToken1Address?: string;
  totalLiquidityFormatted: string | null;
  totalLiquidityValue: number | null;
  totalVolumeFormatted?: string | null;
  totalVolumeValue?: number | null;
  userLpBalance?: string;
  userLpBalanceRaw?: bigint;
  reserves?: {
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: number;
  };
  totalSupply?: bigint;
  reserve0Exact?: number;
  reserve1Exact?: number;
  isTvlLoading?: boolean;
  isVolumeLoading?: boolean;
};

type PoolsTableProps = {
  pools: PoolsTableRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectPool?: (pool: PoolsTableRow) => void;
  totalTvl?: string | null;
  totalTvlLoading?: boolean;
  totalVolume?: string | null;
  totalVolumeLoading?: boolean;
  showUserPositions?: boolean;
};

export function PoolsTable({
  pools,
  loading,
  error,
  onRetry,
  onSelectPool,
  totalTvl,
  totalTvlLoading,
  totalVolume,
  totalVolumeLoading,
  showUserPositions = false
}: PoolsTableProps) {
  const showSkeleton = loading && pools.length === 0 && !error;
  const showEmpty = !loading && pools.length === 0 && !error;

  return (
    <div className="rounded border border-white/10 bg-black/30 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/5 text-xs font-mono uppercase tracking-[0.3em] text-white/60">
              <th className="px-4 py-3 text-left">Asset Pair</th>
              <th className="px-4 py-3 text-left">Protocol</th>
              <th className="px-4 py-3 text-left">Fee tier</th>
              {showUserPositions ? (
                <th className="px-4 py-3 text-right">Your Position</th>
              ) : (
                <>
                  <th className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span>TVL</span>
                      <span className="rounded border border-cyan/60 px-2 py-0.5 text-cyan">
                        {totalTvlLoading ? "…" : totalTvl ?? "-"}
                      </span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span>Volume</span>
                      <span className="rounded border border-primary/60 px-2 py-0.5 text-primary">
                        {totalVolumeLoading ? "…" : totalVolume ?? "-"}
                      </span>
                    </div>
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-right">APR</th>
              <th className="px-4 py-3 text-right">Risk</th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-t border-white/5">
                  <td colSpan={7} className="px-4 py-6">
                    <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                  </td>
                </tr>
              ))}

            {!showSkeleton &&
              !error &&
              pools.map((pool) => {
                let userPositionValue: string | null = null;
                if (
                  showUserPositions &&
                  pool.userLpBalanceRaw &&
                  pool.userLpBalanceRaw > 0n &&
                  pool.totalSupply &&
                  pool.totalSupply > 0n &&
                  pool.totalLiquidityValue &&
                  pool.totalLiquidityValue > 0
                ) {
                  const userShare =
                    Number(pool.userLpBalanceRaw) / Number(pool.totalSupply);
                  const positionValueUSD = userShare * pool.totalLiquidityValue;
                  userPositionValue = formatCompactNumber(positionValueUSD, 2);
                }

                return (
                  <tr
                    key={pool.pairAddress}
                    className="border-t border-white/10 text-sm transition hover:bg-white/5"
                    onClick={() => onSelectPool?.(pool)}
                    role={onSelectPool ? "button" : undefined}
                    tabIndex={onSelectPool ? 0 : undefined}
                    onKeyDown={(event) => {
                      if (!onSelectPool) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectPool(pool);
                      }
                    }}
                  >
                    <td className="px-4 py-4 text-left">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {[pool.token0, pool.token1].map((token, index) => (
                            <div
                              key={`${pool.pairAddress}-${token.symbol}-${index}`}
                              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-xs font-bold"
                            >
                              {token.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={token.logo}
                                  alt={token.symbol}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                token.symbol.slice(0, 3).toUpperCase()
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-white">
                          <div className="flex items-center gap-2 text-base">
                            {getDisplaySymbol(pool.token0)}/
                            {getDisplaySymbol(pool.token1)}
                            {pool.userLpBalanceRaw &&
                              pool.userLpBalanceRaw > 0n && (
                                <span
                                  className="text-xs text-primary"
                                  title="You have a position in this pool"
                                >
                                  ●
                                </span>
                              )}
                          </div>
                          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">
                            {pool.pairAddress.slice(0, 6)}…
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-left text-white/70">
                      WarpX
                    </td>
                    <td className="px-4 py-4 text-left text-white/60">
                      {DEFAULT_FEE_PERCENT_DISPLAY}%
                    </td>
                    {showUserPositions ? (
                      <td className="px-4 py-4 text-right text-white">
                        {userPositionValue ?? "-"}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-4 text-right text-white">
                          {pool.totalLiquidityFormatted ?? "—"}
                        </td>
                        <td className="px-4 py-4 text-right text-white">
                          {pool.totalVolumeFormatted ?? "—"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-4 text-right text-primary">
                      12.4%
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="rounded border border-white/20 px-2 py-1 text-xs uppercase tracking-[0.3em]">
                        LOW
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {showEmpty && (
        <div className="px-4 py-10 text-center text-sm text-white/60">
          No pools found.
        </div>
      )}

      {error && (
        <div className="space-y-4 border-t border-white/10 px-4 py-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            className="rounded border border-primary px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

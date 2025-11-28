import type { TokenDescriptor } from "@/lib/trade/types";
import { FEES_DENOMINATOR, FEES_NUMERATOR } from "@/lib/trade/constants";
import { formatCompactNumber } from "@/lib/trade/math";
import { TokenLogo } from "@/components/TokenLogo";

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
  showUserPositions = false
}: PoolsTableProps) {
  const showSkeleton = loading && pools.length === 0 && !error;
  const showEmpty = !loading && pools.length === 0 && !error;

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden lg:block border border-border bg-card/30">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border text-xs font-mono text-muted-foreground uppercase tracking-wider bg-card/50">
          <div className="col-span-4">ASSET PAIR</div>
          <div className="col-span-2 text-right">TVL</div>
          <div className="col-span-2 text-right">VOL (24H)</div>
          <div className="col-span-2 text-right">Fee Tier</div>
          <div className="col-span-2 text-right">Protocol</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border">
          {showSkeleton &&
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="grid grid-cols-12 gap-4 p-4 items-center"
              >
                <div className="col-span-12">
                  <div className="h-8 w-full animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}

          {!showSkeleton &&
            !error &&
            pools.map((pool) => (
              <div
                key={pool.pairAddress}
                onClick={() => onSelectPool?.(pool)}
                role={onSelectPool ? "button" : undefined}
                tabIndex={onSelectPool ? 0 : undefined}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors cursor-pointer group"
                onKeyDown={(event) => {
                  if (!onSelectPool) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectPool(pool);
                  }
                }}
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-primary/20 group-hover:bg-primary transition-colors" />
                    <div className="flex items-center -space-x-2">
                      <TokenLogo
                        logo={pool.token0.logo}
                        symbol={getDisplaySymbol(pool.token0)}
                        size={32}
                        className="border-2 border-card bg-card"
                      />
                      <TokenLogo
                        logo={pool.token1.logo}
                        symbol={getDisplaySymbol(pool.token1)}
                        size={32}
                        className="border-2 border-card bg-card"
                      />
                    </div>
                    <span className="font-bold font-display text-lg">
                      {getDisplaySymbol(pool.token0)}/
                      {getDisplaySymbol(pool.token1)}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-right font-mono">
                  {pool.totalLiquidityFormatted
                    ? `$${pool.totalLiquidityFormatted}`
                    : "—"}
                </div>
                <div className="col-span-2 text-right font-mono">
                  {pool.totalVolumeFormatted
                    ? `$${pool.totalVolumeFormatted}`
                    : "—"}
                </div>
                <div className="col-span-2 text-right font-mono text-primary">
                  {DEFAULT_FEE_PERCENT_DISPLAY}%
                </div>
                <div className="col-span-2 text-right flex justify-end">
                  <span className="px-2 py-1 bg-white/5 border border-border text-[10px] font-mono">
                    V2
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {showSkeleton &&
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`mobile-skeleton-${index}`}
              className="border border-border bg-card/30 p-4"
            >
              <div className="h-6 w-32 mb-4 animate-pulse rounded bg-white/10" />
              <div className="grid grid-cols-2 gap-3 mb-4">
                {Array.from({ length: 4 }).map((__, idx) => (
                  <div key={idx}>
                    <div className="h-3 w-16 mb-1 animate-pulse rounded bg-white/10" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">TAP TO VIEW</span>
              </div>
            </div>
          ))}

        {!showSkeleton &&
          !error &&
          pools.map((pool) => (
            <div
              key={pool.pairAddress}
              onClick={() => onSelectPool?.(pool)}
              role={onSelectPool ? "button" : undefined}
              tabIndex={onSelectPool ? 0 : undefined}
              className="border border-border bg-card/30 p-4 hover:bg-card/50 transition-colors cursor-pointer group"
              onKeyDown={(event) => {
                if (!onSelectPool) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPool(pool);
                }
              }}
            >
              {/* Pool Name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-6 bg-primary/20 group-hover:bg-primary transition-colors" />
                <div className="flex items-center -space-x-2">
                  <TokenLogo
                    logo={pool.token0.logo}
                    symbol={getDisplaySymbol(pool.token0)}
                    size={24}
                    className="border-2 border-card bg-card"
                  />
                  <TokenLogo
                    logo={pool.token1.logo}
                    symbol={getDisplaySymbol(pool.token1)}
                    size={24}
                    className="border-2 border-card bg-card"
                  />
                </div>
                <span className="font-bold font-display text-lg uppercase">
                  {getDisplaySymbol(pool.token0)}/
                  {getDisplaySymbol(pool.token1)}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm font-mono">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">TVL</div>
                  <div className="font-bold">
                    {pool.totalLiquidityFormatted
                      ? `$${pool.totalLiquidityFormatted}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    VOL (24H)
                  </div>
                  <div className="font-bold">
                    {pool.totalVolumeFormatted
                      ? `$${pool.totalVolumeFormatted}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">APR</div>
                  <div className="font-bold text-primary">
                    {DEFAULT_FEE_PERCENT_DISPLAY}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">RISK</div>
                  <span className="inline-block px-2 py-0.5 text-xs border border-border bg-green-500/10 text-green-400">
                    LOW
                  </span>
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between text-xs text-muted-foreground group-hover:text-primary transition-colors">
                <span className="font-mono">TAP TO VIEW</span>
                <span aria-hidden="true" className="font-mono text-base">
                  ↗
                </span>
              </div>
            </div>
          ))}
      </div>

      {showEmpty && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No pools found.
        </div>
      )}

      {error && (
        <div className="space-y-4 border border-border bg-card/30 px-4 py-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-none border border-primary px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary hover:bg-primary hover:text-black transition-colors"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

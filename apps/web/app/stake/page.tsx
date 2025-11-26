"use client";

import { useMemo } from "react";
import { usePoolsChartData } from "@/hooks/usePoolsChartData";
import { usePools } from "@/hooks/usePools";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { JsonRpcProvider } from "ethers";
import { megaethTestnet } from "@/lib/chains";
import { TOKEN_CATALOG } from "@/lib/trade/constants";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompactNumber } from "@/lib/trade/math";

export default function AnalyticsPage() {
  const { data: chartData, isLoading: chartLoading } = usePoolsChartData({
    days: 30
  });
  const { deployment } = useDeploymentManifest();

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const { data: poolsData } = usePools({
    tokenList: TOKEN_CATALOG,
    factoryAddress: deployment?.factory ?? null,
    wrappedNativeAddress: deployment?.wmegaeth ?? null,
    provider: readProvider
  });

  // Calculate top pairs by TVL
  const topPairs = useMemo(() => {
    if (!poolsData || poolsData.length === 0) return [];

    const sorted = [...poolsData]
      .filter(
        (pool) => pool.totalLiquidityValue && pool.totalLiquidityValue > 0
      )
      .sort(
        (a, b) => (b.totalLiquidityValue ?? 0) - (a.totalLiquidityValue ?? 0)
      )
      .slice(0, 4);

    const total = sorted.reduce(
      (sum, pool) => sum + (pool.totalLiquidityValue ?? 0),
      0
    );

    return sorted.map((pool) => ({
      name: `${pool.token0.symbol}-${pool.token1.symbol}`,
      value: pool.totalLiquidityValue ?? 0,
      percentage:
        total > 0 ? ((pool.totalLiquidityValue ?? 0) / total) * 100 : 0
    }));
  }, [poolsData]);

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      <div className="mb-12">
        <h1 className="text-4xl font-display font-bold mb-2 uppercase">
          ANALYTICS
        </h1>
        <p className="font-mono text-muted-foreground text-sm">
          NETWORK STATISTICS & PROTOCOL DATA
        </p>
      </div>

      <div className="space-y-6">
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TVL Chart */}
          <div className="border border-border bg-card/30 p-6">
            <div className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-wide">
              TOTAL VALUE LOCKED
            </div>
            <div className="h-[280px]">
              {chartLoading || !chartData || chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Loading chart data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="tvlGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="hsl(336, 70%, 65%)"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(336, 70%, 65%)"
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric"
                        })
                      }
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        `$${formatCompactNumber(value, 1)}`
                      }
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)"
                      }}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric"
                        })
                      }
                      formatter={(value: number) => [
                        `$${formatCompactNumber(value, 2)}`,
                        "TVL"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="tvl"
                      stroke="hsl(336, 70%, 65%)"
                      strokeWidth={2}
                      fill="url(#tvlGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Volume Chart */}
          <div className="border border-border bg-card/30 p-6">
            <div className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-wide">
              VOLUME (24H)
            </div>
            <div className="h-[280px]">
              {chartLoading || !chartData || chartData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Loading chart data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric"
                        })
                      }
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        `$${formatCompactNumber(value, 1)}`
                      }
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0",
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)"
                      }}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric"
                        })
                      }
                      formatter={(value: number) => [
                        `$${formatCompactNumber(value, 2)}`,
                        "Volume"
                      ]}
                      cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    />
                    <Bar dataKey="volume" fill="hsl(336, 70%, 65%)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Top Pairs Breakdown */}
        <div className="border border-border bg-card/30 p-6">
          <div className="text-xs font-mono text-muted-foreground mb-6 uppercase tracking-wide">
            TOP PAIRS BREAKDOWN
          </div>
          <div className="space-y-4">
            {topPairs.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center py-8">
                Loading pairs data...
              </div>
            ) : (
              topPairs.map((pair, index) => (
                <div key={pair.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold font-display">{pair.name}</span>
                    <span className="font-mono text-primary">
                      {pair.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="relative h-2 bg-muted/20">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary transition-all"
                      style={{ width: `${pair.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

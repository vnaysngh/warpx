"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { PairChartDataPoint } from "@/hooks/usePairChartData";
import { useLocalization } from "@/lib/format/LocalizationContext";
import { NumberType } from "@/lib/format/formatNumbers";
import { getDisplaySymbol } from "@/lib/trade/tokenDisplay";

type PriceChartProps = {
  data: PairChartDataPoint[];
  isLoading: boolean;
  error?: Error | null;
};

export function PriceChart({ data, isLoading, error }: PriceChartProps) {
  const { formatNumber } = useLocalization();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground gap-2">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading chart data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
        <div className="text-red-500 mb-2">⚠</div>
        Failed to load chart
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="text-muted-foreground text-xs font-mono uppercase tracking-[0.3em] mb-2">
          No chart data available
        </div>
        <div className="text-muted-foreground/60 text-[10px] font-mono normal-case tracking-normal max-w-xs">
          This trading pair may not have liquidity yet or historical data hasn't been indexed.
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(336, 70%, 65%)" stopOpacity={0.8} />
            <stop
              offset="100%"
              stopColor="hsl(336, 70%, 65%)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="timestamp"
          hide={true}
        />
        <YAxis
          hide={true}
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
          formatter={(value: number, _name, props) => {
            const payload = props?.payload as PairChartDataPoint | undefined;
            const tokenIn = getDisplaySymbol(payload?.tokenInSymbol);
            const tokenOut = getDisplaySymbol(payload?.tokenOutSymbol);
            const formatted = formatNumber({
              input: value,
              type: NumberType.TokenTx
            });
            return [`${formatted} ${tokenOut}`, `1 ${tokenIn}`];
          }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="hsl(336, 70%, 65%)"
          strokeWidth={2}
          fill="url(#priceGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

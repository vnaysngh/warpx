"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { usePoolsChartData } from "@/hooks/usePoolsChartData";
import { formatCompactNumber } from "@/lib/trade/math";

type ChartType = "tvl" | "volume";

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
  }>;
  label?: string;
  chartType: ChartType;
}

function CustomTooltip({
  active,
  payload,
  label,
  chartType
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0].value;
  const date = new Date(Number(label) * 1000);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="rounded border border-white/20 bg-black/80 px-3 py-2 text-xs text-white shadow-lg">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/60">
        {formattedDate}
      </div>
      <div className="mt-1 font-bold text-white">
        {chartType === "tvl" ? "TVL" : "Volume"} ${formatCompactNumber(value, 2)}
      </div>
    </div>
  );
}

export function PoolsCharts() {
  const [hasMounted, setHasMounted] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartType>("tvl");
  const { data: chartData, isLoading, error } = usePoolsChartData({ days: 30 });

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const formattedData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    return chartData;
  }, [chartData]);

  const hasData = formattedData.length > 0;
  const chartKey = activeChart === "tvl" ? "tvl" : "volume";

  const yAxisConfig = useMemo(() => {
    if (!hasData) {
      return { domain: [0, 100] as [number, number], ticks: [0, 25, 50, 75, 100] };
    }
    const values = formattedData.map((d) => d[chartKey]);
    const maxValue = Math.max(...values);
    const max = Math.ceil(maxValue * 1.1);
    const tickCount = 5;
    const tickInterval = max / (tickCount - 1);
    const ticks = Array.from({ length: tickCount }, (_, i) =>
      Math.round(i * tickInterval)
    );
    return { domain: [0, max] as [number, number], ticks };
  }, [formattedData, chartKey, hasData]);

  if (!hasMounted) {
    return (
      <div className="rounded border border-white/10 bg-black/40 p-6 text-white">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded border border-primary px-3 py-1 text-primary">
            Loading
          </span>
          <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        </div>
        <div className="mt-6 h-56 w-full animate-pulse rounded bg-white/5" />
      </div>
    );
  }

  if (error || isLoading || !hasData) {
    return null;
  }

  return (
    <div className="rounded border border-white/10 bg-black/40 p-6 text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex gap-2 text-xs font-mono uppercase tracking-[0.3em]">
          <button
            type="button"
            className={`rounded border px-4 py-1 ${
              activeChart === "tvl"
                ? "border-primary text-primary"
                : "border-white/10 text-white/40"
            }`}
            onClick={() => setActiveChart("tvl")}
          >
            TVL
          </button>
          <button
            type="button"
            className={`rounded border px-4 py-1 ${
              activeChart === "volume"
                ? "border-primary text-primary"
                : "border-white/10 text-white/40"
            }`}
            onClick={() => setActiveChart("volume")}
          >
            Volume
          </button>
        </div>
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-white/50">
          30 Days
        </div>
      </div>

      <div className="mt-6 h-72 w-full">
        {activeChart === "tvl" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
              <defs>
                <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="rgba(123, 97, 255, 0.8)"
                    stopOpacity={0.7}
                  />
                  <stop
                    offset="100%"
                    stopColor="rgba(123, 97, 255, 0)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                stroke="rgba(255, 255, 255, 0.4)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  new Date(value * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  })
                }
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.4)"
                tickLine={false}
                axisLine={false}
                domain={yAxisConfig.domain}
                ticks={yAxisConfig.ticks}
                tickFormatter={(value) => `$${formatCompactNumber(value, 1)}`}
              />
              <Tooltip
                content={<CustomTooltip chartType="tvl" />}
                cursor={{ stroke: "rgba(235, 104, 150, 0.35)", strokeWidth: 2 }}
              />
              <Area
                dataKey="tvl"
                stroke="#a48bff"
                strokeWidth={2}
                fill="url(#tvlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                stroke="rgba(255, 255, 255, 0.4)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  new Date(value * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                  })
                }
              />
              <YAxis
                stroke="rgba(255, 255, 255, 0.4)"
                tickLine={false}
                axisLine={false}
                domain={yAxisConfig.domain}
                ticks={yAxisConfig.ticks}
                tickFormatter={(value) => `$${formatCompactNumber(value, 1)}`}
              />
              <Tooltip
                content={<CustomTooltip chartType="volume" />}
                cursor={{ fill: "rgba(0, 255, 255, 0.15)" }}
              />
              <Bar dataKey="volume" fill="#00FFFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

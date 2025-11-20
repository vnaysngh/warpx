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
import styles from "./PoolsCharts.module.css";

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
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{formattedDate}</div>
      <div className={styles.tooltipValue}>
        <span className={styles.tooltipLabel}>
          {chartType === "tvl" ? "TVL" : "Volume"}:
        </span>{" "}
        ${formatCompactNumber(value, 2)}
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

  // Prevent hydration mismatch by only rendering after mount
  if (!hasMounted) {
    return (
      <div className={styles.chartsContainer}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTabs}>
              <button className={`${styles.chartTab} ${styles.chartTabActive}`}>
                TVL
              </button>
              <button className={styles.chartTab}>Volume</button>
            </div>
          </div>
          <div className={styles.chartContent}>
            <div className={styles.chartLoader}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail - charts are supplementary
  }

  if (isLoading) {
    return (
      <div className={styles.chartsContainer}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTabs}>
              <button className={`${styles.chartTab} ${styles.chartTabActive}`}>
                TVL
              </button>
              <button className={styles.chartTab}>Volume</button>
            </div>
          </div>
          <div className={styles.chartContent}>
            <div className={styles.chartLoader}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return null; // Don't show charts if no data
  }

  return (
    <div className={styles.chartsContainer}>
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTabs}>
            <button
              className={`${styles.chartTab} ${
                activeChart === "tvl" ? styles.chartTabActive : ""
              }`}
              onClick={() => setActiveChart("tvl")}
            >
              TVL
            </button>
            <button
              className={`${styles.chartTab} ${
                activeChart === "volume" ? styles.chartTabActive : ""
              }`}
              onClick={() => setActiveChart("volume")}
            >
              Volume
            </button>
          </div>
          <div className={styles.chartPeriod}>30 Days</div>
        </div>

        <div className={styles.chartContent}>
          {activeChart === "tvl" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData}>
                <defs>
                  <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="rgb(123, 97, 255)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(123, 97, 255)"
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
                  dataKey="date"
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp * 1000);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric"
                    });
                  }}
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `$${formatCompactNumber(value, 0)}`}
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  content={<CustomTooltip chartType="tvl" />}
                  cursor={{ stroke: "rgba(123, 97, 255, 0.3)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey={chartKey}
                  stroke="rgb(123, 97, 255)"
                  strokeWidth={2}
                  fill="url(#tvlGradient)"
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedData}>
                <defs>
                  <linearGradient
                    id="volumeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgb(138, 116, 249)"
                      stopOpacity={0.9}
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(123, 97, 255)"
                      stopOpacity={0.4}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255, 255, 255, 0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp * 1000);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric"
                    });
                  }}
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => `$${formatCompactNumber(value, 0)}`}
                  stroke="rgba(255, 255, 255, 0.3)"
                  tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  content={<CustomTooltip chartType="volume" />}
                  cursor={{ fill: "rgba(123, 97, 255, 0.15)" }}
                />
                <Bar
                  dataKey={chartKey}
                  fill="url(#volumeGradient)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={500}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

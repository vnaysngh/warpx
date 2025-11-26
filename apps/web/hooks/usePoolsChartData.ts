import { useQuery } from "@tanstack/react-query";
import { fetchEthUsdPrice } from "@/lib/utils/ethPrice";

const POOLS_CHART_DATA_QUERY = `
  query GetPoolsChartData($days: Int!) {
    warpDayDatas(
      first: $days
      orderBy: date
      orderDirection: desc
    ) {
      id
      date
      dailyVolumeETH
      totalLiquidityETH
    }
  }
`;

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
  process.env.NEXT_PUBLIC_WARP_SUBGRAPH_URL ??
  "";

const SUBGRAPH_AUTH_TOKEN =
  process.env.SUBGRAPH_AUTH_TOKEN ??
  process.env.NEXT_PUBLIC_GRAPH_API_KEY ??
  "";

export interface ChartDataPoint {
  date: number;
  timestamp: number;
  tvl: number;
  volume: number;
}

interface SubgraphDayData {
  id: string;
  date: number;
  dailyVolumeETH: string;
  totalLiquidityETH: string;
}

async function fetchPoolsChartData(days: number): Promise<ChartDataPoint[]> {
  if (!SUBGRAPH_URL) {
    throw new Error("Subgraph URL is not configured");
  }

  // Fetch ETH price from Moralis (same as pools page)
  const ethPriceUsd = await fetchEthUsdPrice();
  if (!ethPriceUsd || ethPriceUsd <= 0) {
    throw new Error("Failed to fetch ETH price for chart calculation");
  }

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SUBGRAPH_AUTH_TOKEN
        ? {
            Authorization: SUBGRAPH_AUTH_TOKEN.startsWith("Bearer ")
              ? SUBGRAPH_AUTH_TOKEN
              : `Bearer ${SUBGRAPH_AUTH_TOKEN}`
          }
        : {})
    },
    body: JSON.stringify({
      query: POOLS_CHART_DATA_QUERY,
      variables: { days }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { warpDayDatas?: SubgraphDayData[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    const message = payload.errors.map((err) => err.message).join(", ");
    throw new Error(`Subgraph error: ${message}`);
  }

  const dayDatas = payload.data?.warpDayDatas ?? [];

  return dayDatas
    .map((data) => {
      try {
        // Use ETH values and multiply by Moralis ETH price (same as pools page)
        const tvlEth = Number.parseFloat(data.totalLiquidityETH);
        const volumeEth = Number.parseFloat(data.dailyVolumeETH);

        const tvlUsd = Number.isFinite(tvlEth) ? tvlEth * ethPriceUsd : 0;
        const volumeUsd = Number.isFinite(volumeEth) ? volumeEth * ethPriceUsd : 0;

        return {
          date: data.date,
          timestamp: data.date * 1000, // Convert to milliseconds
          tvl: tvlUsd,
          volume: volumeUsd
        };
      } catch (err) {
        console.warn("[usePoolsChartData] failed to parse day data", data.id, err);
        return null;
      }
    })
    .filter((data): data is ChartDataPoint => data !== null)
    .reverse(); // Reverse to get chronological order
}

interface UsePoolsChartDataParams {
  days?: number;
  enabled?: boolean;
}

export function usePoolsChartData({
  days = 30,
  enabled = true
}: UsePoolsChartDataParams = {}) {
  return useQuery({
    queryKey: ["pools-chart-data", days],
    queryFn: () => fetchPoolsChartData(days),
    enabled: enabled && Boolean(SUBGRAPH_URL),
    staleTime: 60000, // 1 minute
    gcTime: 300000 // 5 minutes
  });
}

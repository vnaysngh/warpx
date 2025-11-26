import { useQuery } from "@tanstack/react-query";
import { getDisplaySymbol } from "@/lib/trade/tokenDisplay";

const PAIR_DAY_DATA_QUERY = `
  query GetPairDayData($pairAddress: String!, $days: Int!) {
    pairDayDatas(
      first: $days
      orderBy: date
      orderDirection: desc
      where: { pair: $pairAddress }
    ) {
      id
      date
      pair {
        id
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      reserve0
      reserve1
      dailyVolumeToken0
      dailyVolumeToken1
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

export interface PairChartDataPoint {
  date: number;
  timestamp: number;
  price: number; // selectedOut per 1 selectedIn
  volumeIn: number;
  volumeOut: number;
  tokenInSymbol: string;
  tokenOutSymbol: string;
}

interface SubgraphPairDayData {
  id: string;
  date: number;
  pair: {
    id: string;
    token0: { id: string; symbol: string | null };
    token1: { id: string; symbol: string | null };
  };
  reserve0: string;
  reserve1: string;
  dailyVolumeToken0: string;
  dailyVolumeToken1: string;
}

type PairOrientation = {
  tokenInIsToken0: boolean;
};

function normalizeAddress(address?: string | null): string | null {
  return address ? address.toLowerCase() : null;
}

function resolveOrientation(
  data: SubgraphPairDayData,
  tokenInLower: string,
  tokenOutLower: string
): PairOrientation | null {
  const token0Lower = data.pair.token0.id.toLowerCase();
  const token1Lower = data.pair.token1.id.toLowerCase();

  if (tokenInLower === token0Lower && tokenOutLower === token1Lower) {
    return { tokenInIsToken0: true };
  }

  if (tokenInLower === token1Lower && tokenOutLower === token0Lower) {
    return { tokenInIsToken0: false };
  }

  return null;
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function transformPairDayData(
  data: SubgraphPairDayData,
  orientation: PairOrientation
): PairChartDataPoint | null {
  const reserve0 = toNumber(data.reserve0);
  const reserve1 = toNumber(data.reserve1);
  const volumeToken0 = toNumber(data.dailyVolumeToken0);
  const volumeToken1 = toNumber(data.dailyVolumeToken1);

  const reserveIn = orientation.tokenInIsToken0 ? reserve0 : reserve1;
  const reserveOut = orientation.tokenInIsToken0 ? reserve1 : reserve0;

  if (reserveIn <= 0 || reserveOut <= 0) {
    return null;
  }

  const price = reserveOut / reserveIn;
  const volumeIn = orientation.tokenInIsToken0 ? volumeToken0 : volumeToken1;
  const volumeOut = orientation.tokenInIsToken0 ? volumeToken1 : volumeToken0;

  const rawTokenInSymbol = orientation.tokenInIsToken0
    ? data.pair.token0.symbol ?? ""
    : data.pair.token1.symbol ?? "";
  const rawTokenOutSymbol = orientation.tokenInIsToken0
    ? data.pair.token1.symbol ?? ""
    : data.pair.token0.symbol ?? "";

  const tokenInSymbol = getDisplaySymbol(rawTokenInSymbol);
  const tokenOutSymbol = getDisplaySymbol(rawTokenOutSymbol);

  return {
    date: data.date,
    timestamp: data.date * 1000,
    price,
    volumeIn,
    volumeOut,
    tokenInSymbol,
    tokenOutSymbol
  };
}

async function fetchPairChartData(
  pairAddress: string,
  days: number,
  tokenInAddress: string,
  tokenOutAddress: string
): Promise<PairChartDataPoint[]> {
  if (!SUBGRAPH_URL) {
    throw new Error("Subgraph URL is not configured");
  }

  if (!pairAddress) {
    return [];
  }

  const tokenInLower = normalizeAddress(tokenInAddress);
  const tokenOutLower = normalizeAddress(tokenOutAddress);

  if (!tokenInLower || !tokenOutLower) {
    return [];
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
      query: PAIR_DAY_DATA_QUERY,
      variables: { pairAddress: pairAddress.toLowerCase(), days }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { pairDayDatas?: SubgraphPairDayData[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    const message = payload.errors.map((err) => err.message).join(", ");
    throw new Error(`Subgraph error: ${message}`);
  }

  const dayDatas = payload.data?.pairDayDatas ?? [];

  return dayDatas
    .map((data) => {
      const orientation = resolveOrientation(data, tokenInLower, tokenOutLower);
      if (!orientation) {
        console.warn(
          "[usePairChartData] orientation mismatch for pair day data",
          data.id
        );
        return null;
      }

      return transformPairDayData(data, orientation);
    })
    .filter((data): data is PairChartDataPoint => data !== null)
    .reverse();
}

interface UsePairChartDataParams {
  pairAddress?: string | null;
  days?: number;
  enabled?: boolean;
  tokenInAddress?: string | null;
  tokenOutAddress?: string | null;
}

export function usePairChartData({
  pairAddress,
  tokenInAddress,
  tokenOutAddress,
  days = 30,
  enabled = true
}: UsePairChartDataParams = {}) {
  const normalizedPair = pairAddress?.toLowerCase();
  const normalizedTokenIn = normalizeAddress(tokenInAddress);
  const normalizedTokenOut = normalizeAddress(tokenOutAddress);

  return useQuery({
    queryKey: [
      "pair-chart-data",
      normalizedPair,
      days,
      normalizedTokenIn,
      normalizedTokenOut
    ],
    queryFn: () =>
      fetchPairChartData(pairAddress!, days, tokenInAddress!, tokenOutAddress!),
    enabled:
      enabled &&
      Boolean(SUBGRAPH_URL) &&
      Boolean(pairAddress) &&
      Boolean(tokenInAddress) &&
      Boolean(tokenOutAddress),
    staleTime: 60000, // 1 minute
    gcTime: 300000 // 5 minutes
  });
}

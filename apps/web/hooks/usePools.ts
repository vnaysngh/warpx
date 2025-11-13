import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { JsonRpcProvider } from "ethers";
import type { TokenDescriptor } from "@/lib/trade/types";
import { formatNumberWithGrouping } from "@/lib/trade/math";
import { DEFAULT_TOKEN_DECIMALS } from "@/lib/trade/constants";

const MAX_PAIRS = 100;

const SUBGRAPH_QUERY = `
  query Pools($first: Int!) {
    pairs(first: $first, orderBy: reserveUSD, orderDirection: desc) {
      id
      reserve0
      reserve1
      reserveETH
      totalSupply
      token0Price
      token1Price
      volumeToken0
      volumeToken1
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
    }
  }
`;

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ??
  process.env.NEXT_PUBLIC_WARP_SUBGRAPH_URL ??
  "";

const SUBGRAPH_AUTH_TOKEN =
  process.env.NEXT_PUBLIC_SUBGRAPH_AUTH_TOKEN ??
  process.env.NEXT_PUBLIC_GRAPH_API_KEY ??
  "";

type SubgraphToken = {
  id: string;
  symbol?: string | null;
  name?: string | null;
  decimals?: string | null;
};

type SubgraphPair = {
  id: string;
  reserve0?: string | null;
  reserve1?: string | null;
  reserveETH?: string | null;
  totalSupply?: string | null;
  token0Price?: string | null;
  token1Price?: string | null;
  volumeToken0?: string | null;
  volumeToken1?: string | null;
  token0: SubgraphToken;
  token1: SubgraphToken;
};

export interface PoolData {
  id: number;
  pairAddress: string;
  token0: TokenDescriptor;
  token1: TokenDescriptor;
  contractToken0Address: string;
  contractToken1Address: string;
  totalLiquidityFormatted: string | null;
  totalLiquidityValue: number | null;
  totalVolumeFormatted: string | null;
  totalVolumeValue: number | null;
  isTvlLoading: boolean;
  isVolumeLoading: boolean;
  reserve0Exact: number;
  reserve1Exact: number;
  reserves?: {
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: number;
  };
  totalSupply?: bigint;
}

type PendingPool = {
  id: number;
  pairAddress: string;
  displayToken0: TokenDescriptor;
  displayToken1: TokenDescriptor;
  contractToken0Address: string;
  contractToken1Address: string;
  reserve0Exact: number;
  reserve1Exact: number;
  reserveEthEstimate?: number;
  volume0Exact: number;
  volume1Exact: number;
};

interface UsePoolsParams {
  tokenList: TokenDescriptor[];
  factoryAddress: string | null;
  wrappedNativeAddress: string | null;
  provider: JsonRpcProvider;
  enabled?: boolean;
}

async function fetchPairsFromSubgraph(): Promise<SubgraphPair[]> {
  if (!SUBGRAPH_URL) {
    throw new Error("Subgraph URL is not configured");
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
      query: SUBGRAPH_QUERY,
      variables: { first: MAX_PAIRS }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { pairs?: SubgraphPair[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    const message = payload.errors.map((err) => err.message).join(", ");
    throw new Error(`Subgraph error: ${message}`);
  }

  return payload.data?.pairs ?? [];
}

function toNumber(value?: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAddress(address: string): string {
  return address?.toLowerCase() ?? "";
}

function buildTokenDescriptor(
  token: SubgraphToken,
  fallback: TokenDescriptor | undefined
): TokenDescriptor {
  const decimalsRaw = token.decimals ?? String(fallback?.decimals ?? "");
  const decimalsParsed = Number.parseInt(decimalsRaw || "", 10);

  return {
    symbol: token.symbol || fallback?.symbol || token.id.slice(2, 6).toUpperCase(),
    name: token.name || fallback?.name || token.symbol || token.id,
    address: token.id,
    decimals: Number.isFinite(decimalsParsed)
      ? decimalsParsed
      : fallback?.decimals ?? DEFAULT_TOKEN_DECIMALS,
    isNative: fallback?.isNative,
    wrappedAddress: fallback?.wrappedAddress,
    logo: fallback?.logo
  };
}

async function fetchPoolsData(params: UsePoolsParams): Promise<PoolData[]> {
  const { tokenList, factoryAddress, wrappedNativeAddress } = params;

  if (!factoryAddress) {
    return [];
  }

  const pairs = await fetchPairsFromSubgraph();
  if (!pairs.length) {
    return [];
  }

  const tokenFallbackMap = new Map(
    tokenList.map((token) => [token.address.toLowerCase(), token])
  );

  const pendingPools: PendingPool[] = [];
  const wethLower = wrappedNativeAddress?.toLowerCase() ?? "";

  pairs.forEach((pair, index) => {
    if (!pair?.token0?.id || !pair?.token1?.id) {
      return;
    }

    const token0Fallback = tokenFallbackMap.get(pair.token0.id.toLowerCase());
    const token1Fallback = tokenFallbackMap.get(pair.token1.id.toLowerCase());
    const token0Descriptor = buildTokenDescriptor(pair.token0, token0Fallback);
    const token1Descriptor = buildTokenDescriptor(pair.token1, token1Fallback);

    const token0IsEth =
      wethLower && token0Descriptor.address.toLowerCase() === wethLower;
    const token1IsEth =
      wethLower && token1Descriptor.address.toLowerCase() === wethLower;

    let displayToken0: TokenDescriptor;
    let displayToken1: TokenDescriptor;

    if (token0IsEth && !token1IsEth) {
      displayToken0 = token1Descriptor;
      displayToken1 = token0Descriptor;
    } else if (!token0IsEth && token1IsEth) {
      displayToken0 = token0Descriptor;
      displayToken1 = token1Descriptor;
    } else {
      const token0Lower = token0Descriptor.address.toLowerCase();
      const token1Lower = token1Descriptor.address.toLowerCase();
      [displayToken0, displayToken1] =
        token0Lower < token1Lower
          ? [token0Descriptor, token1Descriptor]
          : [token1Descriptor, token0Descriptor];
    }

    pendingPools.push({
      id: index + 1,
      pairAddress: pair.id,
      displayToken0,
      displayToken1,
      contractToken0Address: token0Descriptor.address,
      contractToken1Address: token1Descriptor.address,
      reserve0Exact: toNumber(pair.reserve0),
      reserve1Exact: toNumber(pair.reserve1),
      reserveEthEstimate: toNumber(pair.reserveETH),
      volume0Exact: toNumber(pair.volumeToken0),
      volume1Exact: toNumber(pair.volumeToken1)
    });
  });

  if (pendingPools.length === 0) {
    return [];
  }

  const needsEthPrice = Boolean(wethLower);
  let ethPriceUsd: number | null = null;
  let priceFetchFailed = false;

  if (needsEthPrice) {
    try {
      ethPriceUsd = await fetchEthUsdPrice();
    } catch (error) {
      console.warn("[usePools] failed to fetch ETH price", error);
      priceFetchFailed = true;
    }
  }

  const basePrices: Record<string, number> = {};
  if (
    wethLower &&
    typeof ethPriceUsd === "number" &&
    Number.isFinite(ethPriceUsd) &&
    ethPriceUsd > 0
  ) {
    basePrices[wethLower] = ethPriceUsd;
  }

  const derivedPriceMap = deriveTokenPrices(basePrices, pendingPools);
  const hasDerivedPrices = derivedPriceMap.size > 0;
  const wethLowerAddress = wrappedNativeAddress?.toLowerCase() ?? "";
  const showGlobalPriceLoading =
    needsEthPrice && !priceFetchFailed && !hasDerivedPrices;

  const pools: PoolData[] = pendingPools.map((pool) => {
    const token0Lower = pool.contractToken0Address.toLowerCase();
    const token1Lower = pool.contractToken1Address.toLowerCase();
    const price0 = derivedPriceMap.get(token0Lower) ?? null;
    const price1 = derivedPriceMap.get(token1Lower) ?? null;

    let totalUsd = 0;
    if (price0 !== null && Number.isFinite(price0)) {
      totalUsd += pool.reserve0Exact * price0;
    }
    if (price1 !== null && Number.isFinite(price1)) {
      totalUsd += pool.reserve1Exact * price1;
    }

    if (totalUsd <= 0 && wethLowerAddress) {
      const ethPrice = derivedPriceMap.get(wethLowerAddress);
      if (ethPrice && Number.isFinite(ethPrice) && pool.reserveEthEstimate) {
        totalUsd = pool.reserveEthEstimate * ethPrice;
      }
    }

    const volume0 = pool.volume0Exact ?? 0;
    const volume1 = pool.volume1Exact ?? 0;
    let volumeUsd = 0;
    if (price0 !== null && Number.isFinite(price0) && volume0 > 0) {
      volumeUsd = volume0 * price0;
    } else if (price1 !== null && Number.isFinite(price1) && volume1 > 0) {
      volumeUsd = volume1 * price1;
    }

    if (volumeUsd <= 0 && wethLowerAddress) {
      const ethPrice = derivedPriceMap.get(wethLowerAddress);
      if (ethPrice && Number.isFinite(ethPrice)) {
        if (token0Lower === wethLowerAddress && volume0 > 0) {
          volumeUsd = volume0 * ethPrice;
        } else if (token1Lower === wethLowerAddress && volume1 > 0) {
          volumeUsd = volume1 * ethPrice;
        }
      }
    }

    const hasUsdValue = Number.isFinite(totalUsd) && totalUsd > 0;
    const totalLiquidityValue = hasUsdValue ? totalUsd : null;
    const hasVolumeValue = Number.isFinite(volumeUsd) && volumeUsd > 0;
    const totalVolumeValue = hasVolumeValue ? volumeUsd : null;

    return {
      id: pool.id,
      pairAddress: pool.pairAddress,
      token0: pool.displayToken0,
      token1: pool.displayToken1,
      contractToken0Address: pool.contractToken0Address,
      contractToken1Address: pool.contractToken1Address,
      totalLiquidityFormatted: hasUsdValue
        ? formatNumberWithGrouping(totalUsd, 2)
        : null,
      totalLiquidityValue,
      totalVolumeFormatted: hasVolumeValue
        ? formatNumberWithGrouping(volumeUsd, 2)
        : null,
      totalVolumeValue,
      isTvlLoading: !hasUsdValue && showGlobalPriceLoading,
      isVolumeLoading: !hasVolumeValue && showGlobalPriceLoading,
      reserve0Exact: pool.reserve0Exact,
      reserve1Exact: pool.reserve1Exact
    };
  });

  pools.sort(
    (a, b) =>
      (b.totalLiquidityValue ?? 0) - (a.totalLiquidityValue ?? 0)
  );

  pools.forEach((pool, index) => {
    pool.id = index + 1;
  });

  return pools;
}

export function usePools(params: UsePoolsParams) {
  const queryKey = useMemo(
    () => ["pools", params.factoryAddress],
    [params.factoryAddress]
  );

  return useQuery({
    queryKey,
    queryFn: () => fetchPoolsData(params),
    enabled:
      params.enabled !== false &&
      !!params.factoryAddress,
    staleTime: 15 * 1000
  });
}

function deriveTokenPrices(
  basePrices: Record<string, number>,
  pools: PendingPool[]
): Map<string, number> {
  const priceMap = new Map<string, number>();
  Object.entries(basePrices).forEach(([address, value]) => {
    if (Number.isFinite(value) && value > 0) {
      priceMap.set(address.toLowerCase(), value);
    }
  });

  let updated = true;
  let iterations = 0;
  const maxIterations = pools.length * 2;

  while (updated && iterations < maxIterations) {
    updated = false;
    iterations += 1;

    for (const pool of pools) {
      const token0Lower = pool.contractToken0Address.toLowerCase();
      const token1Lower = pool.contractToken1Address.toLowerCase();
      const reserve0 = pool.reserve0Exact;
      const reserve1 = pool.reserve1Exact;
      if (reserve0 <= 0 || reserve1 <= 0) continue;

      const price0 = priceMap.get(token0Lower);
      const price1 = priceMap.get(token1Lower);

      if ((!price0 || price0 <= 0) && price1 && price1 > 0) {
        const derivedPrice0 = (price1 * reserve1) / reserve0;
        if (Number.isFinite(derivedPrice0) && derivedPrice0 > 0) {
          priceMap.set(token0Lower, derivedPrice0);
          updated = true;
        }
      } else if ((!price1 || price1 <= 0) && price0 && price0 > 0) {
        const derivedPrice1 = (price0 * reserve0) / reserve1;
        if (Number.isFinite(derivedPrice1) && derivedPrice1 > 0) {
          priceMap.set(token1Lower, derivedPrice1);
          updated = true;
        }
      }
    }
  }

  return priceMap;
}

async function fetchEthUsdPrice(): Promise<number | null> {
  if (typeof window === "undefined") return null;

  const response = await fetch("/api/eth-price", {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ETH price: ${response.status}`);
  }

  const payload = (await response.json()) as {
    priceUsd?: number | string | null;
  };

  if (typeof payload?.priceUsd === "number" && Number.isFinite(payload.priceUsd)) {
    return payload.priceUsd;
  }

  if (typeof payload?.priceUsd === "string") {
    const parsed = Number.parseFloat(payload.priceUsd);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

import { useQuery } from "@tanstack/react-query";

const USER_POSITIONS_QUERY = `
  query GetUserPositions($userAddress: Bytes!) {
    liquidityPositions(
      where: { user: $userAddress }
      orderBy: liquidityTokenBalance
      orderDirection: desc
    ) {
      id
      liquidityTokenBalance
      pair {
        id
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
        reserve0
        reserve1
        totalSupply
        reserveUSD
      }
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

type SubgraphToken = {
  id: string;
  symbol?: string | null;
  name?: string | null;
  decimals?: string | null;
};

type SubgraphPair = {
  id: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  reserve0?: string | null;
  reserve1?: string | null;
  totalSupply?: string | null;
  reserveUSD?: string | null;
};

type LiquidityPosition = {
  id: string;
  liquidityTokenBalance: string;
  pair: SubgraphPair;
};

export interface UserPositionData {
  pairAddress: string;
  liquidityTokenBalance: bigint;
  totalSupply: bigint;
  reserveUSD: number;
  userPositionValueUSD: number;
}

async function fetchUserPositions(
  userAddress: string
): Promise<UserPositionData[]> {
  if (!SUBGRAPH_URL) {
    throw new Error("Subgraph URL is not configured");
  }

  if (!userAddress) {
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
      query: USER_POSITIONS_QUERY,
      variables: { userAddress: userAddress.toLowerCase() }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { liquidityPositions?: LiquidityPosition[] };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    const message = payload.errors.map((err) => err.message).join(", ");
    throw new Error(`Subgraph error: ${message}`);
  }

  const positions = payload.data?.liquidityPositions ?? [];

  return positions
    .map((pos) => {
      try {
        // Parse as floats since subgraph returns decimal strings
        const liquidityTokenBalance = Number.parseFloat(pos.liquidityTokenBalance);
        const totalSupply = Number.parseFloat(pos.pair.totalSupply ?? "0");
        const reserveUSD = Number.parseFloat(pos.pair.reserveUSD ?? "0");

        if (liquidityTokenBalance === 0 || totalSupply === 0 || reserveUSD === 0) {
          return null;
        }

        // Calculate user's position value
        const userShare = liquidityTokenBalance / totalSupply;
        const userPositionValueUSD = userShare * reserveUSD;

        return {
          pairAddress: pos.pair.id.toLowerCase(),
          liquidityTokenBalance: BigInt(Math.floor(liquidityTokenBalance)),
          totalSupply: BigInt(Math.floor(totalSupply)),
          reserveUSD,
          userPositionValueUSD
        };
      } catch (err) {
        console.warn("[useUserPositions] failed to parse position", pos.id, err);
        return null;
      }
    })
    .filter((pos): pos is UserPositionData => pos !== null);
}

interface UseUserPositionsParams {
  userAddress: string | null;
  enabled?: boolean;
}

export function useUserPositions({
  userAddress,
  enabled = true
}: UseUserPositionsParams) {
  return useQuery({
    queryKey: ["user-positions", userAddress?.toLowerCase()],
    queryFn: () => fetchUserPositions(userAddress!),
    enabled: enabled && Boolean(userAddress) && Boolean(SUBGRAPH_URL),
    staleTime: 30000, // 30 seconds
    gcTime: 60000 // 1 minute
  });
}

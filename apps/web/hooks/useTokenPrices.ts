import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function normalizeAddresses(addresses: string[]): string[] {
  if (!addresses.length) return [];

  const seen = new Set<string>();
  addresses.forEach((address) => {
    if (!address) return;
    const trimmed = address.trim().toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(trimmed)) {
      seen.add(trimmed);
    }
  });

  return Array.from(seen).sort();
}

type TokenPriceMap = Record<string, number>;

async function fetchTokenPrices(addresses: string[]): Promise<TokenPriceMap> {
  if (addresses.length === 0) {
    return {};
  }

  const params = new URLSearchParams({
    addresses: addresses.join(",")
  });

  const response = await fetch(`/api/token-prices?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch token prices: ${response.status}`);
  }

  const payload = (await response.json()) as { prices?: Record<string, string | number | null> };

  const result: TokenPriceMap = {};
  if (payload?.prices) {
    Object.entries(payload.prices).forEach(([address, value]) => {
      const numericValue =
        typeof value === "string"
          ? Number(value)
          : typeof value === "number"
            ? value
            : null;

      if (numericValue !== null && Number.isFinite(numericValue)) {
        result[address.toLowerCase()] = numericValue;
      }
    });
  }

  return result;
}

export function useTokenPrices(addresses: string[]) {
  const normalizedAddresses = useMemo(
    () => normalizeAddresses(addresses),
    [addresses]
  );

  const addressesKey = useMemo(
    () => normalizedAddresses.join(","),
    [normalizedAddresses]
  );

  return useQuery({
    queryKey: ["token-prices", addressesKey],
    queryFn: () => fetchTokenPrices(normalizedAddresses),
    enabled: normalizedAddresses.length > 0,
    staleTime: ONE_MINUTE_MS,
    gcTime: TEN_MINUTES_MS,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    initialData: () => ({})
  });
}

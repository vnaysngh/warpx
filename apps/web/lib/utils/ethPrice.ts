const ETH_PRICE_API_PATH = "/api/eth-price";

type EthPriceResponse = {
  priceUsd?: number | string | null;
};

/**
 * Fetches the latest ETH/USD price from the local API route.
 * Returns null if price cannot be determined so callers can decide how to handle it.
 */
export async function fetchEthUsdPrice(): Promise<number | null> {
  try {
    if (typeof fetch === "undefined") {
      return null;
    }

    const response = await fetch(ETH_PRICE_API_PATH, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ETH price: ${response.status}`);
    }

    const payload = (await response.json()) as EthPriceResponse;
    const value = payload?.priceUsd;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  } catch (error) {
    console.error("[ethPrice] failed to fetch ETH price", error);
    return null;
  }
}

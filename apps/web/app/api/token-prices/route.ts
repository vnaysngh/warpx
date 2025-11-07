import { NextResponse } from "next/server";

const GTE_API_BASE =
  process.env.GTE_API_BASE_URL ??
  process.env.GTE_API_BASE ??
  "https://api-testnet.gte.xyz/v1";

type TokenResponse = {
  address: string;
  priceUsd?: string | number | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const addressesParam = url.searchParams.get("addresses");

  if (!addressesParam) {
    return NextResponse.json(
      { error: "Missing addresses query parameter" },
      { status: 400 }
    );
  }

  const addresses = Array.from(
    new Set(
      addressesParam
        .split(",")
        .map((addr) => addr.trim())
        .filter((addr) => /^0x[a-fA-F0-9]{40}$/.test(addr))
    )
  );

  if (addresses.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const results = await Promise.all(
      addresses.map(async (address) => {
        try {
          const response = await fetch(
            `${GTE_API_BASE.replace(/\/$/, "")}/tokens/${address}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json"
              },
              cache: "no-store",
              signal: controller.signal
            }
          );

          if (!response.ok) {
            console.warn(
              `[token-prices] Failed to fetch ${address}: ${response.status}`
            );
            return { address, priceUsd: null };
          }

          const data = (await response.json()) as TokenResponse;
          const rawPrice = data?.priceUsd;
          let priceValue: number | null = null;
          if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
            priceValue = rawPrice;
          } else if (typeof rawPrice === "string") {
            const sanitized = rawPrice.replace(/,/g, "").trim();
            const parsed = Number.parseFloat(sanitized);
            if (Number.isFinite(parsed)) {
              priceValue = parsed;
            }
          }
          return {
            address,
            priceUsd: priceValue
          };
        } catch (error) {
          console.error(`[token-prices] Error fetching ${address}:`, error);
          return { address, priceUsd: null };
        }
      })
    );

    clearTimeout(timeout);

    const prices: Record<string, number | null> = {};
    results.forEach(({ address, priceUsd }) => {
      prices[address.toLowerCase()] = priceUsd ?? null;
    });

    return NextResponse.json({ prices });
  } catch (error) {
    console.error("[token-prices] Failed to fetch token prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch token prices" },
      { status: 500 }
    );
  }
}

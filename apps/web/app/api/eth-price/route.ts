import { NextResponse } from "next/server";

const DEFAULT_ENDPOINT =
  "https://deep-index.moralis.io/api/v2.2/erc20/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/price?chain=eth";

type MoralisPriceResponse = {
  usdPrice?: number | string | null;
  result?: {
    usdPrice?: number | string | null;
  };
};

function parseUsdPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const sanitized = value.replace(/,/g, "").trim();
    const parsed = Number.parseFloat(sanitized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export async function GET() {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Moralis API key is not configured" },
      { status: 500 }
    );
  }

  const endpoint =
    process.env.MORALIS_ETH_PRICE_URL?.trim() || DEFAULT_ENDPOINT;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        "X-API-Key": apiKey
      },
      cache: "no-store"
    });

    if (!response.ok) {
      console.error(
        `[eth-price] Upstream error (${response.status}): ${await response.text()}`
      );
      return NextResponse.json(
        { error: "Failed to fetch ETH price" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as MoralisPriceResponse;
    const priceUsd =
      parseUsdPrice(data.usdPrice) ??
      parseUsdPrice(data.result?.usdPrice) ??
      null;

    return NextResponse.json({ priceUsd });
  } catch (error) {
    console.error("[eth-price] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ETH price" },
      { status: 500 }
    );
  }
}

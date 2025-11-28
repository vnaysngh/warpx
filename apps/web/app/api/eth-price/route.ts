import { NextResponse } from "next/server";
import { getDataFeedValues } from "@redstone-finance/sdk";

export async function GET() {
  try {
    // Fetch all data feed values from RedStone Oracle
    const prices = await getDataFeedValues();
    const ethPrice = prices["ETH"];
    
    if (typeof ethPrice !== "number") {
      throw new Error("ETH price not found in RedStone response");
    }

    return NextResponse.json({ priceUsd: ethPrice });
  } catch (error) {
    console.error("[eth-price] RedStone fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch ETH price" },
      { status: 500 }
    );
  }
}

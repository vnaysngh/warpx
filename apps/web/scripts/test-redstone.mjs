import { getDataFeedValues } from "@redstone-finance/sdk";

async function test() {
  try {
    console.log("Fetching ETH price from RedStone...");
    const prices = await getDataFeedValues();
    const ethPrice = prices["ETH"];
    console.log("ETH Price:", ethPrice);
    
    if (typeof ethPrice === "number") {
      console.log("SUCCESS: Fetched valid number");
    } else {
      console.error("FAILURE: ETH price is not a number", ethPrice);
      process.exit(1);
    }
  } catch (error) {
    console.error("FAILURE: Exception thrown", error);
    process.exit(1);
  }
}

test();

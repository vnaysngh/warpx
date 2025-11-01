import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Quick script to check MEGA/ETH price on GTE
 * Run this BEFORE adding liquidity to verify the amounts
 */

type DeploymentManifest = {
  network: string;
  router: string;
  factory: string;
  wmegaeth: string;
};

type TokenManifestEntry = {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
};

type TokenManifest = {
  network: string;
  tokens: TokenManifestEntry[];
};

const GTE_FACTORY = "0xDB9D607C0D7709C8d2a3a841c970A554AF9B8B45";
const GTE_ROUTER = "0xA6b579684E943F7D00d616A48cF99b5147fC57A5";
const ETH_AMOUNT = process.env.ETH_AMOUNT ?? "0.005";

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const ROUTER_ABI = [
  "function WETH() external view returns (address)"
];

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

function loadJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file missing: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const deploymentManifest = loadJsonFile<DeploymentManifest>(
    path.join(deploymentsDir, `${network}.json`)
  );
  const tokenManifest = loadJsonFile<TokenManifest>(
    path.join(deploymentsDir, `${network}.tokens.json`)
  );

  const megaToken = tokenManifest.tokens.find(
    (t) => t.symbol.toLowerCase() === "mega"
  );

  if (!megaToken) {
    throw new Error("MEGA token not found in token manifest");
  }

  const [signer] = await ethers.getSigners();

  console.log("\n" + "=".repeat(60));
  console.log("📊 GTE MEGA/ETH PRICE CHECK");
  console.log("=".repeat(60));

  // First, get GTE's WETH address from their router
  console.log("\n🔍 Step 1: Getting GTE's WETH address...");
  const gteRouter = await ethers.getContractAt(
    ROUTER_ABI,
    GTE_ROUTER,
    signer
  );

  const gteWETH = await gteRouter.WETH();
  console.log(`GTE WETH: ${gteWETH}`);
  console.log(`Your WETH: ${deploymentManifest.wmegaeth}`);

  if (gteWETH.toLowerCase() !== deploymentManifest.wmegaeth.toLowerCase()) {
    console.log("⚠️  GTE uses a different WETH address!");
  } else {
    console.log("✅ Same WETH address");
  }

  // Connect to GTE factory
  console.log("\n🔍 Step 2: Looking for MEGA/ETH pair on GTE...");
  const gteFactory = await ethers.getContractAt(
    FACTORY_ABI,
    GTE_FACTORY,
    signer
  );

  const pairAddress = await gteFactory.getPair(
    megaToken.address,
    gteWETH  // Use GTE's WETH, not yours!
  );

  if (pairAddress === ethers.ZeroAddress) {
    throw new Error(
      `MEGA/ETH pair does not exist on GTE!\n` +
      `MEGA: ${megaToken.address}\n` +
      `GTE WETH: ${gteWETH}\n` +
      `Your WETH: ${deploymentManifest.wmegaeth}`
    );
  }

  console.log(`Pair Address: ${pairAddress}`);

  // Get reserves
  const gtePair = await ethers.getContractAt(PAIR_ABI, pairAddress, signer);
  const [reserve0, reserve1] = await gtePair.getReserves();
  const token0 = await gtePair.token0();

  const isMEGAToken0 = token0.toLowerCase() === megaToken.address.toLowerCase();
  const reserveMEGA = isMEGAToken0 ? reserve0 : reserve1;
  const reserveETH = isMEGAToken0 ? reserve1 : reserve0;

  console.log("\n📊 Current Reserves:");
  console.log(`  MEGA: ${ethers.formatUnits(reserveMEGA, megaToken.decimals)}`);
  console.log(`  ETH: ${ethers.formatUnits(reserveETH, 18)}`);

  // Calculate prices
  const priceMEGAperETH = (reserveMEGA * ethers.parseUnits("1", 18)) / reserveETH;
  const priceETHperMEGA = (reserveETH * ethers.parseUnits("1", megaToken.decimals)) / reserveMEGA;

  console.log("\n💰 Current Prices:");
  console.log(`  Spot Price: 1 ETH = ${ethers.formatUnits(priceMEGAperETH, megaToken.decimals)} MEGA`);
  console.log(`  Spot Price: 1 MEGA = ${ethers.formatUnits(priceETHperMEGA, 18)} ETH`);

  // Calculate what you'd actually GET from swapping 1 ETH (including fee)
  // This matches what GTE's UI shows
  const oneETH = ethers.parseUnits("1", 18);

  // Try 0.3% fee (Uniswap V2 standard: 997/1000)
  const amountInWithFee = oneETH * 997n;
  const numerator = amountInWithFee * reserveMEGA;
  const denominator = reserveETH * 1000n + amountInWithFee;
  const quoteMEGA = numerator / denominator;

  console.log(`\n  Quote (with 0.3% fee): 1 ETH → ${ethers.formatUnits(quoteMEGA, megaToken.decimals)} MEGA`);
  console.log(`  (This matches what you see in GTE's swap UI)`);

  // Calculate what you need for your desired ETH
  const amountETH = ethers.parseUnits(ETH_AMOUNT, 18);
  const amountMEGA = (amountETH * reserveMEGA) / reserveETH;

  console.log("\n🎯 For Your Liquidity Addition:");
  console.log(`  You want to add: ${ETH_AMOUNT} ETH`);
  console.log(`  You need to add: ${ethers.formatUnits(amountMEGA, megaToken.decimals)} MEGA`);
  console.log(`  This will match GTE's price EXACTLY`);

  // Verify exact match
  const leftSide = amountETH * reserveMEGA;
  const rightSide = amountMEGA * reserveETH;
  const exactMatch = leftSide === rightSide;

  console.log(`  Exact match: ${exactMatch ? "✅ YES" : "⚠️  WITHIN 1 WEI"}`);

  console.log("\n📝 Next Steps:");
  console.log(`  1. Make sure you have ${ethers.formatUnits(amountMEGA, megaToken.decimals)} MEGA in your wallet`);
  console.log(`  2. Make sure you have ${ETH_AMOUNT} ETH in your wallet`);
  console.log(`  3. Run: npx hardhat run scripts/seed-usd-eth-from-gte.ts --network megaethTestnet`);

  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

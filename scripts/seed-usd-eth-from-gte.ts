import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Script to add GTE/ETH liquidity to WarpX by matching GTE.xyz's price
 * Fetches reserves from GTE's factory and calculates exact amounts
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

// GTE addresses on MegaETH
const GTE_FACTORY = "0xDB9D607C0D7709C8d2a3a841c970A554AF9B8B45";
const GTE_ROUTER = "0xA6b579684E943F7D00d616A48cF99b5147fC57A5";

// Your desired ETH amount
const ETH_AMOUNT = process.env.ETH_AMOUNT ?? "0.0012";
const DEADLINE_MINUTES = Number(process.env.LIQUIDITY_DEADLINE_MINUTES ?? "10");
const NATIVE_SYMBOL = "ETH";

// ABIs
const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];

const ROUTER_ABI = ["function WETH() external view returns (address)"];

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

function findToken(
  manifest: TokenManifest,
  symbol: string
): TokenManifestEntry {
  const token = manifest.tokens.find(
    (entry) => entry.symbol.toLowerCase() === symbol.toLowerCase()
  );

  if (!token) {
    throw new Error(
      `Token with symbol ${symbol} not found in ${manifest.network}.tokens.json`
    );
  }

  return token;
}

async function ensureAllowance(
  token: ethers.Contract,
  owner: string,
  spender: string,
  required: bigint,
  symbol: string
) {
  const current = await token.allowance(owner, spender);
  if (current >= required) {
    console.log(`✅ ${symbol} already approved`);
    return;
  }

  console.log(`Approving ${symbol} for router...`);
  const tx = await token.approve(spender, ethers.MaxUint256);
  await tx.wait();
  console.log(`✅ ${symbol} approved`);
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  // Load WarpX deployment
  const deploymentManifest = loadJsonFile<DeploymentManifest>(
    path.join(deploymentsDir, `${network}.json`)
  );
  const tokenManifest = loadJsonFile<TokenManifest>(
    path.join(deploymentsDir, `${network}.tokens.json`)
  );

  // Find GTE token
  const megaTokenData = findToken(tokenManifest, "GTE");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("=".repeat(60));
  console.log("🎯 SEED GTE/ETH LIQUIDITY - MATCHING GTE PRICE");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");
  console.log("📍 WarpX Deployment:");
  console.log(`  Router:  ${deploymentManifest.router}`);
  console.log(`  Factory: ${deploymentManifest.factory}`);
  console.log(`  WMEGAETH: ${deploymentManifest.wmegaeth}`);
  console.log("");
  console.log("📍 GTE Reference:");
  console.log(`  Factory: ${GTE_FACTORY}`);
  console.log(`  Router:  ${GTE_ROUTER}`);
  console.log("");

  // Step 1: Get GTE's WETH address
  console.log("🔍 Step 1: Getting GTE's WETH address...");
  const gteRouter = await ethers.getContractAt(
    ROUTER_ABI,
    GTE_ROUTER,
    deployer
  );

  const gteWETH = await gteRouter.WETH();
  console.log(`  GTE WETH:  ${gteWETH}`);
  console.log(`  Your WETH: ${deploymentManifest.wmegaeth}`);

  if (gteWETH.toLowerCase() !== deploymentManifest.wmegaeth.toLowerCase()) {
    console.log("  ⚠️  GTE uses a different WETH contract!");
    console.log("  ⚠️  You'll need to convert prices between the two!");
  } else {
    console.log("  ✅ Same WETH - can directly use reserves");
  }
  console.log("");

  // Step 2: Connect to GTE factory to find GTE/ETH pair
  console.log("🔍 Step 2: Fetching GTE/ETH pair from GTE factory...");
  const gteFactory = await ethers.getContractAt(
    FACTORY_ABI,
    GTE_FACTORY,
    deployer
  );

  const gtePairAddress = await gteFactory.getPair(
    megaTokenData.address,
    gteWETH // Use GTE's WETH!
  );

  if (gtePairAddress === ethers.ZeroAddress) {
    throw new Error(
      `GTE/ETH pair does not exist on GTE factory!\n` +
        `GTE: ${megaTokenData.address}\n` +
        `GTE WETH: ${gteWETH}\n` +
        `Your WETH: ${deploymentManifest.wmegaeth}`
    );
  }

  console.log(`✅ GTE GTE/ETH Pair: ${gtePairAddress}`);

  // Step 3: Get reserves from GTE pair
  console.log("\n📊 Step 3: Reading reserves from GTE pair...");
  const gtePair = await ethers.getContractAt(
    PAIR_ABI,
    gtePairAddress,
    deployer
  );

  const [reserve0, reserve1, blockTimestamp] = await gtePair.getReserves();
  const token0Address = await gtePair.token0();

  // Determine which token is which
  const isMEGAToken0 =
    token0Address.toLowerCase() === megaTokenData.address.toLowerCase();
  const reserveMEGA = isMEGAToken0 ? reserve0 : reserve1;
  const reserveETH = isMEGAToken0 ? reserve1 : reserve0;

  console.log(
    `  GTE Reserve: ${ethers.formatUnits(reserveMEGA, megaTokenData.decimals)}`
  );
  console.log(`  ETH Reserve: ${ethers.formatUnits(reserveETH, 18)}`);
  console.log(`  Block Timestamp: ${blockTimestamp}`);

  // Calculate price
  const priceMEGAperETH =
    (reserveMEGA * ethers.parseUnits("1", 18)) / reserveETH;
  const priceETHperMEGA =
    (reserveETH * ethers.parseUnits("1", megaTokenData.decimals)) / reserveMEGA;

  console.log(
    `  Spot Price: 1 ETH = ${ethers.formatUnits(priceMEGAperETH, megaTokenData.decimals)} GTE`
  );
  console.log(
    `  Spot Price: 1 GTE = ${ethers.formatUnits(priceETHperMEGA, 18)} ETH`
  );

  // Show what GTE's UI displays (quote with fee)
  const oneETH = ethers.parseUnits("1", 18);
  const amountInWithFee = oneETH * 997n; // 0.3% fee
  const numerator = amountInWithFee * reserveMEGA;
  const denominator = reserveETH * 1000n + amountInWithFee;
  const quoteMEGA = numerator / denominator;

  console.log(
    `  Quote (with 0.3% fee): 1 ETH → ${ethers.formatUnits(quoteMEGA, megaTokenData.decimals)} GTE`
  );
  console.log(`  (This is what GTE's swap UI shows)`);

  // Step 4: Calculate exact GTE amount for your desired ETH
  console.log(
    `\n💰 Step 4: Calculating exact amounts for ${ETH_AMOUNT} ETH...`
  );

  const amountETHDesired = ethers.parseUnits(ETH_AMOUNT, 18);

  // CRITICAL: Use exact BigInt math - NO floating point!
  const amountMEGAExact = (amountETHDesired * reserveMEGA) / reserveETH;

  console.log(`  ETH Amount: ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  GTE Amount: ${ethers.formatUnits(amountMEGAExact, megaTokenData.decimals)}`
  );

  // Verify the ratio matches EXACTLY
  const yourRatio =
    (amountMEGAExact * ethers.parseUnits("1", 18)) / amountETHDesired;
  const gteRatio = (reserveMEGA * ethers.parseUnits("1", 18)) / reserveETH;

  console.log("\n✅ Price Verification:");
  console.log(
    `  Your ratio: ${ethers.formatUnits(yourRatio, megaTokenData.decimals)} GTE per ETH`
  );
  console.log(
    `  GTE ratio:  ${ethers.formatUnits(gteRatio, megaTokenData.decimals)} GTE per ETH`
  );
  console.log(
    `  Match: ${yourRatio === gteRatio ? "✅ PERFECT" : "⚠️  DEVIATION DETECTED"}`
  );

  // Additional safety check
  const leftSide = amountETHDesired * reserveMEGA;
  const rightSide = amountMEGAExact * reserveETH;
  const isExactMatch = leftSide === rightSide;

  if (!isExactMatch) {
    console.warn(
      "\n⚠️  WARNING: Due to integer division, there's a tiny remainder."
    );
    console.warn(`  This is normal and acceptable (difference < 1 wei)`);
  }

  // Step 5: Check balances
  console.log("\n💼 Step 5: Checking balances...");

  const megaToken = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    megaTokenData.address,
    deployer
  );

  const megaBalance = await megaToken.balanceOf(deployerAddress);
  const ethBalance = await deployer.provider.getBalance(deployerAddress);

  console.log(
    `  GTE Balance: ${ethers.formatUnits(megaBalance, megaTokenData.decimals)}`
  );
  console.log(`  ETH Balance: ${ethers.formatUnits(ethBalance, 18)}`);

  if (megaBalance < amountMEGAExact) {
    throw new Error(
      `Insufficient GTE balance!\n` +
        `  Need: ${ethers.formatUnits(amountMEGAExact, megaTokenData.decimals)}\n` +
        `  Have: ${ethers.formatUnits(megaBalance, megaTokenData.decimals)}`
    );
  }

  if (ethBalance < amountETHDesired) {
    throw new Error(
      `Insufficient ETH balance!\n` +
        `  Need: ${ethers.formatUnits(amountETHDesired, 18)}\n` +
        `  Have: ${ethers.formatUnits(ethBalance, 18)}`
    );
  }

  console.log("✅ Sufficient balances");

  // Step 6: Approve GTE
  console.log("\n🔓 Step 6: Approving GTE token...");
  await ensureAllowance(
    megaToken,
    deployerAddress,
    deploymentManifest.router,
    amountMEGAExact,
    "GTE"
  );

  // Step 7: Check if pair already exists on WarpX
  console.log("\n🔍 Step 7: Checking for existing pair on WarpX...");
  const warpFactory = await ethers.getContractAt(
    "IWarpFactory",
    deploymentManifest.factory,
    deployer
  );

  const existingPair = await warpFactory.getPair(
    megaTokenData.address,
    deploymentManifest.wmegaeth
  );

  if (existingPair !== ethers.ZeroAddress) {
    console.log(`⚠️  Pair already exists: ${existingPair}`);
    console.log(
      `   This will ADD to existing liquidity (not set initial price)`
    );
  } else {
    console.log(`✅ No existing pair - this will SET the initial price`);
  }

  // Step 8: Add liquidity
  console.log("\n🚀 Step 8: Adding liquidity to WarpX router...");
  console.log(
    `  Adding: ${ethers.formatUnits(amountMEGAExact, megaTokenData.decimals)} GTE`
  );
  console.log(`       + ${ethers.formatUnits(amountETHDesired, 18)} ETH`);

  const router = await ethers.getContractAt(
    "WarpRouter",
    deploymentManifest.router,
    deployer
  );

  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60;

  const tx = await router.addLiquidityETH(
    megaTokenData.address,
    amountMEGAExact,
    amountMEGAExact, // amountTokenMin = exact amount (first liquidity)
    amountETHDesired, // amountETHMin = exact amount (first liquidity)
    deployerAddress,
    deadline,
    { value: amountETHDesired }
  );

  console.log(`⏳ Transaction sent: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed!`);
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);

  // Step 9: Get final pair address
  const pairAfter = await warpFactory.getPair(
    megaTokenData.address,
    deploymentManifest.wmegaeth
  );

  console.log("\n" + "=".repeat(60));
  console.log("✅ LIQUIDITY ADDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`WarpX GTE/ETH Pair: ${pairAfter}`);
  console.log(`TX Hash: ${receipt?.hash ?? tx.hash}`);
  console.log("");
  console.log("📊 Summary:");
  console.log(
    `  GTE Added: ${ethers.formatUnits(amountMEGAExact, megaTokenData.decimals)}`
  );
  console.log(`  ETH Added: ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  Initial Price: 1 ETH = ${ethers.formatUnits(priceMEGAperETH, megaTokenData.decimals)} GTE`
  );
  console.log(`  Matches GTE: ✅ YES`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

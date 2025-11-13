import hardhat from "hardhat";
const { ethers } = hardhat;
import * as fs from "fs";
import * as path from "path";

/**
 * Script to add wUSD/ETH liquidity at real USDC/ETH market price
 * Fetches current ETH/USD price from Moralis API
 * Seeds 1 ETH equivalent of wUSD (e.g., if ETH = $3000, seeds 1 ETH + 3000 wUSD)
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

// Configuration
const ETH_AMOUNT = process.env.ETH_AMOUNT ?? "1"; // Amount of ETH to add
const DEADLINE_MINUTES = Number(process.env.LIQUIDITY_DEADLINE_MINUTES ?? "10");
const SLIPPAGE_PERCENT = Number(process.env.SLIPPAGE_PERCENT ?? "1"); // 1% slippage tolerance

// Moralis API configuration
const MORALIS_API_KEY = process.env.MORALIS_API_KEY ?? "";
const MORALIS_ENDPOINT =
  "https://deep-index.moralis.io/api/v2.2/erc20/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/price?chain=eth";

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

function applySlippage(amount: bigint, slippagePercent: number): bigint {
  const slippageBps = BigInt(slippagePercent * 100); // Convert to basis points
  const bpsDenominator = 10000n;
  return (amount * (bpsDenominator - slippageBps)) / bpsDenominator;
}

async function ensureAllowance(
  token: ethers.Contract,
  owner: string,
  spender: string,
  required: bigint,
  symbol: string,
  gasLimitOverride?: bigint
) {
  const current = await token.allowance(owner, spender);
  if (current >= required) {
    console.log(`✅ ${symbol} already approved`);
    return;
  }

  console.log(`Approving ${symbol} for router...`);
  const txOptions = gasLimitOverride ? { gasLimit: gasLimitOverride } : {};
  const tx = await token.approve(spender, ethers.MaxUint256, txOptions);
  await tx.wait();
  console.log(`✅ ${symbol} approved`);
}

async function fetchEthUsdPrice(): Promise<number> {
  if (!MORALIS_API_KEY) {
    throw new Error(
      "MORALIS_API_KEY environment variable is required. Set it in your .env file."
    );
  }

  console.log("📡 Fetching ETH/USD price from Moralis...");

  const response = await fetch(MORALIS_ENDPOINT, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": MORALIS_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    usdPrice?: number;
    usdPriceFormatted?: string;
  };

  const price = data.usdPrice ?? Number.parseFloat(data.usdPriceFormatted ?? "0");

  if (!price || price <= 0) {
    throw new Error(`Invalid ETH price received from Moralis: ${price}`);
  }

  console.log(`✅ Current ETH price: $${price.toFixed(2)}`);
  return price;
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const gasLimitOverride = process.env.MEGAETH_DEPLOY_GAS_LIMIT
    ? BigInt(process.env.MEGAETH_DEPLOY_GAS_LIMIT)
    : undefined;

  // Load WarpX deployment
  const deploymentManifest = loadJsonFile<DeploymentManifest>(
    path.join(deploymentsDir, `${network}.json`)
  );
  const tokenManifest = loadJsonFile<TokenManifest>(
    path.join(deploymentsDir, `${network}.tokens.json`)
  );

  // Find wUSD token
  const wusdTokenData = findToken(tokenManifest, "wUSD");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("=".repeat(60));
  console.log("🪙  ADD wUSD/ETH LIQUIDITY AT MARKET PRICE");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");
  console.log("📍 WarpX Deployment:");
  console.log(`  Router:   ${deploymentManifest.router}`);
  console.log(`  Factory:  ${deploymentManifest.factory}`);
  console.log(`  WMEGAETH: ${deploymentManifest.wmegaeth}`);
  console.log(`  wUSD:     ${wusdTokenData.address}`);
  console.log("");

  // Fetch current ETH/USD price from Moralis
  const ethUsdPrice = await fetchEthUsdPrice();

  // Calculate wUSD amount based on ETH amount and price
  const amountETHDesired = ethers.parseUnits(ETH_AMOUNT, 18);
  const ethAmountFloat = Number.parseFloat(ETH_AMOUNT);
  const wusdAmountFloat = ethAmountFloat * ethUsdPrice;
  const amountWUSDDesired = ethers.parseUnits(
    wusdAmountFloat.toFixed(wusdTokenData.decimals),
    wusdTokenData.decimals
  );

  console.log("");
  console.log("💰 Liquidity Amounts:");
  console.log(`  ETH:  ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  wUSD: ${ethers.formatUnits(amountWUSDDesired, wusdTokenData.decimals)}`
  );
  console.log("");

  // Calculate price
  const priceWUSDperETH =
    (amountWUSDDesired * ethers.parseUnits("1", 18)) / amountETHDesired;
  const priceETHperWUSD =
    (amountETHDesired * ethers.parseUnits("1", wusdTokenData.decimals)) /
    amountWUSDDesired;

  console.log("💵 Initial Price Ratio:");
  console.log(
    `  1 ETH = ${ethers.formatUnits(priceWUSDperETH, wusdTokenData.decimals)} wUSD`
  );
  console.log(`  1 wUSD = ${ethers.formatUnits(priceETHperWUSD, 18)} ETH`);
  console.log(`  (Mirroring real ETH/USDC market price: $${ethUsdPrice.toFixed(2)})`);
  console.log("");

  // Check balances
  console.log("💼 Step 1: Checking balances...");

  const wusdToken = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    wusdTokenData.address,
    deployer
  );

  const wusdBalance = await wusdToken.balanceOf(deployerAddress);
  const ethBalance = await deployer.provider.getBalance(deployerAddress);

  console.log(
    `  wUSD Balance: ${ethers.formatUnits(wusdBalance, wusdTokenData.decimals)}`
  );
  console.log(`  ETH Balance:  ${ethers.formatUnits(ethBalance, 18)}`);

  if (wusdBalance < amountWUSDDesired) {
    throw new Error(
      `Insufficient wUSD balance!\n` +
        `  Need: ${ethers.formatUnits(amountWUSDDesired, wusdTokenData.decimals)}\n` +
        `  Have: ${ethers.formatUnits(wusdBalance, wusdTokenData.decimals)}`
    );
  }

  // Add buffer for gas
  const minEthRequired = amountETHDesired + ethers.parseEther("0.01"); // 0.01 ETH for gas
  if (ethBalance < minEthRequired) {
    throw new Error(
      `Insufficient ETH balance!\n` +
        `  Need: ${ethers.formatUnits(minEthRequired, 18)} (including gas)\n` +
        `  Have: ${ethers.formatUnits(ethBalance, 18)}`
    );
  }

  console.log("✅ Sufficient balances");
  console.log("");

  // Approve wUSD
  console.log("🔓 Step 2: Approving wUSD token...");
  await ensureAllowance(
    wusdToken,
    deployerAddress,
    deploymentManifest.router,
    amountWUSDDesired,
    "wUSD",
    gasLimitOverride
  );
  console.log("");

  // Check if pair already exists
  console.log("🔍 Step 3: Checking for existing wUSD/ETH pair...");
  const warpFactory = await ethers.getContractAt(
    "packages/core/contracts/WarpFactory.sol:WarpFactory",
    deploymentManifest.factory,
    deployer
  );

  const existingPair = await warpFactory.getPair(
    wusdTokenData.address,
    deploymentManifest.wmegaeth
  );

  if (existingPair !== ethers.ZeroAddress) {
    console.log(`⚠️  Pair already exists: ${existingPair}`);

    // Get existing reserves
    const pair = await ethers.getContractAt(
      "packages/core/contracts/WarpPair.sol:WarpPair",
      existingPair,
      deployer
    );

    const [reserve0, reserve1] = await pair.getReserves();
    const token0 = await pair.token0();
    const isWUSDToken0 =
      token0.toLowerCase() === wusdTokenData.address.toLowerCase();
    const reserveWUSD = isWUSDToken0 ? reserve0 : reserve1;
    const reserveETH = isWUSDToken0 ? reserve1 : reserve0;

    console.log(`   Current reserves:`);
    console.log(
      `     wUSD: ${ethers.formatUnits(reserveWUSD, wusdTokenData.decimals)}`
    );
    console.log(`     ETH:  ${ethers.formatUnits(reserveETH, 18)}`);

    const currentPrice =
      (reserveWUSD * ethers.parseUnits("1", 18)) / reserveETH;
    console.log(
      `   Current price: 1 ETH = ${ethers.formatUnits(currentPrice, wusdTokenData.decimals)} wUSD`
    );
    console.log(
      `   This will ADD to existing liquidity (price may adjust slightly)`
    );
  } else {
    console.log(
      `✅ No existing pair - this will CREATE the pair and SET the initial price`
    );
  }
  console.log("");

  // Calculate minimum amounts with slippage
  const amountWUSDMin = applySlippage(amountWUSDDesired, SLIPPAGE_PERCENT);
  const amountETHMin = applySlippage(amountETHDesired, SLIPPAGE_PERCENT);

  console.log("🚀 Step 4: Adding liquidity via WarpRouter...");
  console.log(
    `  wUSD Desired: ${ethers.formatUnits(amountWUSDDesired, wusdTokenData.decimals)}`
  );
  console.log(
    `  wUSD Min:     ${ethers.formatUnits(amountWUSDMin, wusdTokenData.decimals)} (${SLIPPAGE_PERCENT}% slippage)`
  );
  console.log(`  ETH Desired:  ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  ETH Min:      ${ethers.formatUnits(amountETHMin, 18)} (${SLIPPAGE_PERCENT}% slippage)`
  );
  console.log("");

  const router = await ethers.getContractAt(
    "packages/periphery/contracts/WarpRouter.sol:WarpRouter",
    deploymentManifest.router,
    deployer
  );

  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60;

  const txOptions: any = { value: amountETHDesired };
  if (gasLimitOverride) {
    txOptions.gasLimit = gasLimitOverride;
  }

  const tx = await router.addLiquidityETH(
    wusdTokenData.address,
    amountWUSDDesired,
    amountWUSDMin,
    amountETHMin,
    deployerAddress,
    deadline,
    txOptions
  );

  console.log(`⏳ Transaction sent: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed!`);
  console.log(`   Block: ${receipt?.blockNumber}`);
  console.log(`   Gas used: ${receipt?.gasUsed.toString()}`);
  console.log("");

  // Get final pair address
  const pairAfter = await warpFactory.getPair(
    wusdTokenData.address,
    deploymentManifest.wmegaeth
  );

  // Get final reserves
  const pair = await ethers.getContractAt(
    "packages/core/contracts/WarpPair.sol:WarpPair",
    pairAfter,
    deployer
  );

  const [reserve0, reserve1] = await pair.getReserves();
  const token0 = await pair.token0();
  const isWUSDToken0 =
    token0.toLowerCase() === wusdTokenData.address.toLowerCase();
  const finalReserveWUSD = isWUSDToken0 ? reserve0 : reserve1;
  const finalReserveETH = isWUSDToken0 ? reserve1 : reserve0;

  const finalPrice =
    (finalReserveWUSD * ethers.parseUnits("1", 18)) / finalReserveETH;

  console.log("=".repeat(60));
  console.log("✅ LIQUIDITY ADDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`wUSD/ETH Pair: ${pairAfter}`);
  console.log(`TX Hash: ${receipt?.hash ?? tx.hash}`);
  console.log("");
  console.log("📊 Summary:");
  console.log(
    `  wUSD Added: ${ethers.formatUnits(amountWUSDDesired, wusdTokenData.decimals)}`
  );
  console.log(`  ETH Added:  ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log("");
  console.log("📊 Final Pool State:");
  console.log(
    `  Total wUSD: ${ethers.formatUnits(finalReserveWUSD, wusdTokenData.decimals)}`
  );
  console.log(`  Total ETH:  ${ethers.formatUnits(finalReserveETH, 18)}`);
  console.log(
    `  Price: 1 ETH = ${ethers.formatUnits(finalPrice, wusdTokenData.decimals)} wUSD`
  );
  console.log(`  (Target was: $${ethUsdPrice.toFixed(2)} per ETH)`);
  console.log("=".repeat(60));
  console.log("");
  console.log("🎯 Next: Test swaps on your frontend with wUSD/ETH pair!");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

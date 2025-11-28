import hardhat from "hardhat";
const { ethers } = hardhat;
import * as fs from "fs";
import * as path from "path";

/**
 * Script to initialize and add MSI/ETH liquidity
 * MSI (MegaSpeed Inu) - setting initial price
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

// Configuration - adjust these values as needed
const MSI_AMOUNT = process.env.MSI_AMOUNT ?? "10000"; // Amount of MSI tokens to add
const ETH_AMOUNT = process.env.ETH_AMOUNT ?? "1"; // Amount of ETH to add
const DEADLINE_MINUTES = Number(process.env.LIQUIDITY_DEADLINE_MINUTES ?? "10");
const SLIPPAGE_PERCENT = Number(process.env.SLIPPAGE_PERCENT ?? "1"); // 1% slippage tolerance

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

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const gasLimitOverride = process.env.MEGAETH_DEPLOY_GAS_LIMIT
    ? BigInt(process.env.MEGAETH_DEPLOY_GAS_LIMIT)
    : undefined;

  // Load deployment manifests
  const deploymentManifest = loadJsonFile<DeploymentManifest>(
    path.join(deploymentsDir, `${network}.json`)
  );
  const tokenManifest = loadJsonFile<TokenManifest>(
    path.join(deploymentsDir, `${network}.tokens.json`)
  );

  // Find MSI token
  const msiTokenData = findToken(tokenManifest, "MSI");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("=".repeat(60));
  console.log("🐕 ADD MSI/ETH LIQUIDITY");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");
  console.log("📍 Deployment Info:");
  console.log(`  Router:   ${deploymentManifest.router}`);
  console.log(`  Factory:  ${deploymentManifest.factory}`);
  console.log(`  WMEGAETH: ${deploymentManifest.wmegaeth}`);
  console.log(`  MSI:      ${msiTokenData.address}`);
  console.log("");

  // Parse amounts
  const amountMSIDesired = ethers.parseUnits(
    MSI_AMOUNT,
    msiTokenData.decimals
  );
  const amountETHDesired = ethers.parseUnits(ETH_AMOUNT, 18);

  console.log("💰 Liquidity Amounts:");
  console.log(
    `  MSI: ${ethers.formatUnits(amountMSIDesired, msiTokenData.decimals)}`
  );
  console.log(`  ETH: ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log("");

  // Calculate price
  const priceMSIperETH =
    (amountMSIDesired * ethers.parseUnits("1", 18)) / amountETHDesired;
  const priceETHperMSI =
    (amountETHDesired * ethers.parseUnits("1", msiTokenData.decimals)) /
    amountMSIDesired;

  console.log("💵 Price Ratio:");
  console.log(
    `  1 ETH = ${ethers.formatUnits(priceMSIperETH, msiTokenData.decimals)} MSI`
  );
  console.log(`  1 MSI = ${ethers.formatUnits(priceETHperMSI, 18)} ETH`);
  console.log("");

  // Check balances
  console.log("💼 Step 1: Checking balances...");

  const msiToken = await ethers.getContractAt(
    "packages/periphery/contracts/test/ERC20Decimals.sol:ERC20Decimals",
    msiTokenData.address,
    deployer
  );

  const msiBalance = await msiToken.balanceOf(deployerAddress);
  const ethBalance = await deployer.provider.getBalance(deployerAddress);

  console.log(
    `  MSI Balance: ${ethers.formatUnits(msiBalance, msiTokenData.decimals)}`
  );
  console.log(`  ETH Balance: ${ethers.formatUnits(ethBalance, 18)}`);

  if (msiBalance < amountMSIDesired) {
    throw new Error(
      `Insufficient MSI balance!\n` +
        `  Need: ${ethers.formatUnits(amountMSIDesired, msiTokenData.decimals)}\n` +
        `  Have: ${ethers.formatUnits(msiBalance, msiTokenData.decimals)}`
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

  // Approve MSI
  console.log("🔓 Step 2: Approving MSI token...");
  await ensureAllowance(
    msiToken,
    deployerAddress,
    deploymentManifest.router,
    amountMSIDesired,
    "MSI",
    gasLimitOverride
  );
  console.log("");

  // Check if pair already exists
  console.log("🔍 Step 3: Checking for existing MSI/ETH pair...");
  const warpFactory = await ethers.getContractAt(
    "packages/core/contracts/WarpFactory.sol:WarpFactory",
    deploymentManifest.factory,
    deployer
  );

  const existingPair = await warpFactory.getPair(
    msiTokenData.address,
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
    const isMSIToken0 =
      token0.toLowerCase() === msiTokenData.address.toLowerCase();
    const reserveMSI = isMSIToken0 ? reserve0 : reserve1;
    const reserveETH = isMSIToken0 ? reserve1 : reserve0;

    console.log(`   Current reserves:`);
    console.log(
      `     MSI: ${ethers.formatUnits(reserveMSI, msiTokenData.decimals)}`
    );
    console.log(`     ETH: ${ethers.formatUnits(reserveETH, 18)}`);

    const currentPrice =
      (reserveMSI * ethers.parseUnits("1", 18)) / reserveETH;
    console.log(
      `   Current price: 1 ETH = ${ethers.formatUnits(currentPrice, msiTokenData.decimals)} MSI`
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
  const amountMSIMin = applySlippage(amountMSIDesired, SLIPPAGE_PERCENT);
  const amountETHMin = applySlippage(amountETHDesired, SLIPPAGE_PERCENT);

  console.log("🚀 Step 4: Adding liquidity via WarpRouter...");
  console.log(
    `  MSI Desired: ${ethers.formatUnits(amountMSIDesired, msiTokenData.decimals)}`
  );
  console.log(
    `  MSI Min:     ${ethers.formatUnits(amountMSIMin, msiTokenData.decimals)} (${SLIPPAGE_PERCENT}% slippage)`
  );
  console.log(`  ETH Desired: ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  ETH Min:     ${ethers.formatUnits(amountETHMin, 18)} (${SLIPPAGE_PERCENT}% slippage)`
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

  console.log("📋 Transaction details:");
  console.log(`  Token: ${msiTokenData.address}`);
  console.log(`  Amount Token Desired: ${amountMSIDesired.toString()}`);
  console.log(`  Amount Token Min: ${amountMSIMin.toString()}`);
  console.log(`  Amount ETH Min: ${amountETHMin.toString()}`);
  console.log(`  To: ${deployerAddress}`);
  console.log(`  Deadline: ${deadline}`);
  console.log(`  Value: ${amountETHDesired.toString()}`);
  console.log("");

  const tx = await router.addLiquidityETH(
    msiTokenData.address,
    amountMSIDesired,
    amountMSIMin,
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
    msiTokenData.address,
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
  const isMSIToken0 =
    token0.toLowerCase() === msiTokenData.address.toLowerCase();
  const finalReserveMSI = isMSIToken0 ? reserve0 : reserve1;
  const finalReserveETH = isMSIToken0 ? reserve1 : reserve0;

  const finalPrice =
    (finalReserveMSI * ethers.parseUnits("1", 18)) / finalReserveETH;

  console.log("=".repeat(60));
  console.log("✅ LIQUIDITY ADDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`MSI/ETH Pair: ${pairAfter}`);
  console.log(`TX Hash: ${receipt?.hash ?? tx.hash}`);
  console.log("");
  console.log("📊 Summary:");
  console.log(
    `  MSI Added: ${ethers.formatUnits(amountMSIDesired, msiTokenData.decimals)}`
  );
  console.log(`  ETH Added: ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log("");
  console.log("📊 Final Pool State:");
  console.log(
    `  Total MSI: ${ethers.formatUnits(finalReserveMSI, msiTokenData.decimals)}`
  );
  console.log(`  Total ETH: ${ethers.formatUnits(finalReserveETH, 18)}`);
  console.log(
    `  Price: 1 ETH = ${ethers.formatUnits(finalPrice, msiTokenData.decimals)} MSI`
  );
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  if (error.error) {
    console.error("Error details:", error.error);
  }
  if (error.data) {
    console.error("Error data:", error.data);
  }
  console.error("\nFull error:", error);
  process.exitCode = 1;
});

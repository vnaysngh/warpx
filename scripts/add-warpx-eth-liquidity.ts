import hardhat from "hardhat";
const { ethers } = hardhat;
import * as fs from "fs";
import * as path from "path";

/**
 * Script to initialize and add WARPX/ETH liquidity
 * WARPX is the platform token - you set your own price ratio
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
const WARPX_AMOUNT = process.env.WARPX_AMOUNT ?? "1000"; // Amount of WARPX tokens to add
const ETH_AMOUNT = process.env.ETH_AMOUNT ?? "0.001"; // Amount of ETH to add
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

  // Find WARPX token
  const warpxTokenData = findToken(tokenManifest, "WARPX");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("=".repeat(60));
  console.log("🎯 ADD WARPX/ETH LIQUIDITY");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");
  console.log("📍 WarpX Deployment:");
  console.log(`  Router:   ${deploymentManifest.router}`);
  console.log(`  Factory:  ${deploymentManifest.factory}`);
  console.log(`  WMEGAETH: ${deploymentManifest.wmegaeth}`);
  console.log(`  WARPX:    ${warpxTokenData.address}`);
  console.log("");

  // Parse amounts
  const amountWARPXDesired = ethers.parseUnits(
    WARPX_AMOUNT,
    warpxTokenData.decimals
  );
  const amountETHDesired = ethers.parseUnits(ETH_AMOUNT, 18);

  console.log("💰 Liquidity Amounts:");
  console.log(
    `  WARPX: ${ethers.formatUnits(amountWARPXDesired, warpxTokenData.decimals)}`
  );
  console.log(`  ETH:   ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log("");

  // Calculate price
  const priceWARPXperETH =
    (amountWARPXDesired * ethers.parseUnits("1", 18)) / amountETHDesired;
  const priceETHperWARPX =
    (amountETHDesired * ethers.parseUnits("1", warpxTokenData.decimals)) /
    amountWARPXDesired;

  console.log("💵 Price Ratio:");
  console.log(
    `  1 ETH = ${ethers.formatUnits(priceWARPXperETH, warpxTokenData.decimals)} WARPX`
  );
  console.log(`  1 WARPX = ${ethers.formatUnits(priceETHperWARPX, 18)} ETH`);
  console.log("");

  // Check balances
  console.log("💼 Step 1: Checking balances...");

  const warpxToken = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    warpxTokenData.address,
    deployer
  );

  const warpxBalance = await warpxToken.balanceOf(deployerAddress);
  const ethBalance = await deployer.provider.getBalance(deployerAddress);

  console.log(
    `  WARPX Balance: ${ethers.formatUnits(warpxBalance, warpxTokenData.decimals)}`
  );
  console.log(`  ETH Balance:   ${ethers.formatUnits(ethBalance, 18)}`);

  if (warpxBalance < amountWARPXDesired) {
    throw new Error(
      `Insufficient WARPX balance!\n` +
        `  Need: ${ethers.formatUnits(amountWARPXDesired, warpxTokenData.decimals)}\n` +
        `  Have: ${ethers.formatUnits(warpxBalance, warpxTokenData.decimals)}`
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

  // Approve WARPX
  console.log("🔓 Step 2: Approving WARPX token...");
  await ensureAllowance(
    warpxToken,
    deployerAddress,
    deploymentManifest.router,
    amountWARPXDesired,
    "WARPX"
  );
  console.log("");

  // Check if pair already exists
  console.log("🔍 Step 3: Checking for existing WARPX/ETH pair...");
  const warpFactory = await ethers.getContractAt(
    "packages/core/contracts/WarpFactory.sol:WarpFactory",
    deploymentManifest.factory,
    deployer
  );

  const existingPair = await warpFactory.getPair(
    warpxTokenData.address,
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
    const isWARPXToken0 =
      token0.toLowerCase() === warpxTokenData.address.toLowerCase();
    const reserveWARPX = isWARPXToken0 ? reserve0 : reserve1;
    const reserveETH = isWARPXToken0 ? reserve1 : reserve0;

    console.log(`   Current reserves:`);
    console.log(
      `     WARPX: ${ethers.formatUnits(reserveWARPX, warpxTokenData.decimals)}`
    );
    console.log(`     ETH:   ${ethers.formatUnits(reserveETH, 18)}`);

    const currentPrice =
      (reserveWARPX * ethers.parseUnits("1", 18)) / reserveETH;
    console.log(
      `   Current price: 1 ETH = ${ethers.formatUnits(currentPrice, warpxTokenData.decimals)} WARPX`
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
  const amountWARPXMin = applySlippage(amountWARPXDesired, SLIPPAGE_PERCENT);
  const amountETHMin = applySlippage(amountETHDesired, SLIPPAGE_PERCENT);

  console.log("🚀 Step 4: Adding liquidity via WarpRouter...");
  console.log(
    `  WARPX Desired: ${ethers.formatUnits(amountWARPXDesired, warpxTokenData.decimals)}`
  );
  console.log(
    `  WARPX Min:     ${ethers.formatUnits(amountWARPXMin, warpxTokenData.decimals)} (${SLIPPAGE_PERCENT}% slippage)`
  );
  console.log(`  ETH Desired:   ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log(
    `  ETH Min:       ${ethers.formatUnits(amountETHMin, 18)} (${SLIPPAGE_PERCENT}% slippage)`
  );
  console.log("");

  const router = await ethers.getContractAt(
    "packages/periphery/contracts/WarpRouter.sol:WarpRouter",
    deploymentManifest.router,
    deployer
  );

  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60;

  const tx = await router.addLiquidityETH(
    warpxTokenData.address,
    amountWARPXDesired,
    amountWARPXMin,
    amountETHMin,
    deployerAddress,
    deadline,
    { value: amountETHDesired }
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
    warpxTokenData.address,
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
  const isWARPXToken0 =
    token0.toLowerCase() === warpxTokenData.address.toLowerCase();
  const finalReserveWARPX = isWARPXToken0 ? reserve0 : reserve1;
  const finalReserveETH = isWARPXToken0 ? reserve1 : reserve0;

  const finalPrice =
    (finalReserveWARPX * ethers.parseUnits("1", 18)) / finalReserveETH;

  console.log("=".repeat(60));
  console.log("✅ LIQUIDITY ADDED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log(`WARPX/ETH Pair: ${pairAfter}`);
  console.log(`TX Hash: ${receipt?.hash ?? tx.hash}`);
  console.log("");
  console.log("📊 Summary:");
  console.log(
    `  WARPX Added: ${ethers.formatUnits(amountWARPXDesired, warpxTokenData.decimals)}`
  );
  console.log(`  ETH Added:   ${ethers.formatUnits(amountETHDesired, 18)}`);
  console.log("");
  console.log("📊 Final Pool State:");
  console.log(
    `  Total WARPX: ${ethers.formatUnits(finalReserveWARPX, warpxTokenData.decimals)}`
  );
  console.log(`  Total ETH:   ${ethers.formatUnits(finalReserveETH, 18)}`);
  console.log(
    `  Price: 1 ETH = ${ethers.formatUnits(finalPrice, warpxTokenData.decimals)} WARPX`
  );
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

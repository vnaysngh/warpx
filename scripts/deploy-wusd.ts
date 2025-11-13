import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy wUSD - a dummy stablecoin pegged to USDC
 * Total Supply: 100 billion
 * Decimals: 6 (same as USDC)
 */

type TokenConfig = {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: bigint;
};

const TOKENS: TokenConfig[] = [
  {
    name: "Wrapped USD",
    symbol: "wUSD",
    decimals: 6, // Same as USDC
    initialSupply: ethers.parseUnits("100000000000", 6) // 100 billion
  }
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("=".repeat(60));
  console.log("🪙  DEPLOY wUSD STABLECOIN");
  console.log("=".repeat(60));
  console.log(`Deployer: ${deployerAddress}`);
  console.log("");

  const gasLimitOverride = process.env.MEGAETH_DEPLOY_GAS_LIMIT
    ? BigInt(process.env.MEGAETH_DEPLOY_GAS_LIMIT)
    : undefined;

  if (gasLimitOverride) {
    console.log(`Using gas limit override: ${gasLimitOverride.toString()}`);
  }

  const deployOverrides = gasLimitOverride ? { gasLimit: gasLimitOverride } : {};

  const ERC20 = await ethers.getContractFactory(
    "packages/periphery/contracts/test/ERC20Decimals.sol:ERC20Decimals"
  );

  const deployments: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  }[] = [];

  // Load existing tokens if they exist
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const normalizedNetwork = network.toLowerCase();
  const deploymentsDir = path.resolve(__dirname, "..", "deployments");

  const resolveExistingFile = (dir: string) => {
    const candidates = [
      path.join(dir, `${network}.tokens.json`),
      path.join(dir, `${normalizedNetwork}.tokens.json`)
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  };

  // Prefer loading from frontend directory as it has complete token info (logos, etc.)
  const frontendDir = path.resolve(
    __dirname,
    "..",
    "apps/web/public/deployments"
  );
  const existingFrontendPath = resolveExistingFile(frontendDir);

  let existingDeployments: any = { tokens: [] };

  // Try frontend first (has more complete data with logos, isNative, etc.)
  if (existingFrontendPath) {
    try {
      existingDeployments = JSON.parse(
        fs.readFileSync(existingFrontendPath, "utf-8")
      );
      console.log(`Loaded existing deployments from ${existingFrontendPath}`);
    } catch (error) {
      console.warn("Could not load frontend deployments");
    }
  }

  // Fallback to root deployments if frontend has no tokens
  if (existingDeployments.tokens.length === 0) {
    const existingDeploymentPath = resolveExistingFile(deploymentsDir);
    if (existingDeploymentPath) {
      try {
        existingDeployments = JSON.parse(
          fs.readFileSync(existingDeploymentPath, "utf-8")
        );
        console.log(`Loaded existing deployments from ${existingDeploymentPath}`);
      } catch (error) {
        console.warn("Could not load existing deployments, starting fresh");
      }
    }
  }

  for (const token of TOKENS) {
    console.log(`Deploying ${token.symbol}…`);
    const contract = deployOverrides.gasLimit
      ? await ERC20.deploy(
          token.name,
          token.symbol,
          token.decimals,
          token.initialSupply,
          deployOverrides
        )
      : await ERC20.deploy(
          token.name,
          token.symbol,
          token.decimals,
          token.initialSupply
        );
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    deployments.push({
      name: token.name,
      symbol: token.symbol,
      address,
      decimals: token.decimals
    });
    console.log(`  → ${token.symbol} deployed at ${address}`);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("✅ wUSD DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  deployments.forEach((t) => {
    const supply = TOKENS.find((token) => token.symbol === t.symbol)?.initialSupply;
    console.log(`Token: ${t.name} (${t.symbol})`);
    console.log(`Address: ${t.address}`);
    console.log(`Decimals: ${t.decimals}`);
    if (supply) {
      console.log(`Total Supply: ${ethers.formatUnits(supply, t.decimals)}`);
    }
    console.log("");
  });

  // Replace token addresses in existing tokens by matching symbol, or add new token
  const existingTokens = Array.isArray(existingDeployments.tokens)
    ? existingDeployments.tokens
    : [];

  // Create a map of newly deployed tokens by symbol
  const deploymentMap = new Map(
    deployments.map((t) => [t.symbol, t])
  );

  // Update addresses for matching tokens
  let updatedTokens = existingTokens.map((existingToken: any) => {
    const newDeployment = deploymentMap.get(existingToken.symbol);
    if (newDeployment) {
      console.log(
        `Updating ${existingToken.symbol}: ${existingToken.address} → ${newDeployment.address}`
      );
      // Remove from deployment map since we've updated it
      deploymentMap.delete(existingToken.symbol);
      // Preserve all existing fields, only update the address
      return {
        ...existingToken,
        address: newDeployment.address
      };
    }
    return existingToken;
  });

  // Add any new tokens that weren't in the existing list
  for (const [symbol, deployment] of deploymentMap) {
    console.log(`Adding new token ${symbol} to manifest`);
    updatedTokens.push({
      name: deployment.name,
      symbol: deployment.symbol,
      address: deployment.address,
      decimals: deployment.decimals
    });
  }

  console.log("\n📋 All tokens in manifest:");
  updatedTokens.forEach((t: any) => {
    console.log(
      `- ${t.symbol} (${t.name}) [decimals: ${t.decimals}] → ${t.address}`
    );
  });

  const manifest = {
    network,
    tokens: updatedTokens
  };

  // Save to deployments directory using the canonical network filename
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputFilePath = path.join(deploymentsDir, `${network}.tokens.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Token manifest written to ${outputFilePath}`);

  // Also sync to frontend using the canonical network filename
  const frontendOutputDir = path.resolve(
    __dirname,
    "..",
    "apps/web/public/deployments"
  );
  try {
    fs.mkdirSync(frontendOutputDir, { recursive: true });
    const frontendPath = path.join(frontendOutputDir, `${network}.tokens.json`);
    fs.writeFileSync(frontendPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Frontend token manifest synced to ${frontendPath}`);
  } catch (error) {
    console.warn("Unable to sync frontend token manifest:", error);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("🎯 NEXT STEPS:");
  console.log("=".repeat(60));
  console.log("1. Update the wUSD address in constants file:");
  console.log("");
  deployments.forEach((t) => {
    console.log(`   File: apps/web/lib/trade/constants.ts`);
    console.log(`   Find: address: "0x0000000000000000000000000000000000000000"`);
    console.log(`   Replace with: address: "${t.address}"`);
  });
  console.log("");
  console.log("2. Run the liquidity seeding script to create wUSD/ETH pool:");
  console.log("");
  console.log("  yarn add-wusd-eth-liquidity");
  console.log("");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exitCode = 1;
});

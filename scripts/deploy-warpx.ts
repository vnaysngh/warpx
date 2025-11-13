import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

type TokenConfig = {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: bigint;
};

const TOKENS: TokenConfig[] = [
  {
    name: "WarpX",
    symbol: "WARPX",
    decimals: 18,
    initialSupply: ethers.parseUnits("1000000000", 18)
  }
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`Deployer: ${deployerAddress}`);

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

  console.log("\nNew token summary:");
  deployments.forEach((t) => {
    console.log(
      `- ${t.symbol} (${t.name}) [decimals: ${t.decimals}] → ${t.address}`
    );
  });

  // Replace token addresses in existing tokens by matching symbol
  const existingTokens = Array.isArray(existingDeployments.tokens)
    ? existingDeployments.tokens
    : [];

  // Create a map of newly deployed tokens by symbol
  const deploymentMap = new Map(
    deployments.map((t) => [t.symbol, t])
  );

  // Update addresses for matching tokens
  const updatedTokens = existingTokens.map((existingToken: any) => {
    const newDeployment = deploymentMap.get(existingToken.symbol);
    if (newDeployment) {
      console.log(
        `\nUpdating ${existingToken.symbol}: ${existingToken.address} → ${newDeployment.address}`
      );
      // Preserve all existing fields, only update the address
      return {
        ...existingToken,
        address: newDeployment.address
      };
    }
    return existingToken;
  });

  console.log("\nAll tokens after update:");
  updatedTokens.forEach((t: any) => {
    console.log(
      `- ${t.symbol} (${t.name}) [decimals: ${t.decimals}] → ${t.address}`
    );
  });

  console.log(
    "\nFund your frontend wallet by transferring from the deployer as needed."
  );

  const manifest = {
    network,
    tokens: updatedTokens
  };

  // Save to deployments directory using the canonical network filename
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outputFilePath = path.join(deploymentsDir, `${network}.tokens.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify(manifest, null, 2));
  console.log(`\nToken manifest written to ${outputFilePath}`);

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
    console.log(`Frontend token manifest synced to ${frontendPath}`);
  } catch (error) {
    console.warn("Unable to sync frontend token manifest:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

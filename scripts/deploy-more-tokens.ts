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
// const TOKENS: TokenConfig[] = [
//   {
//     name: 'MegaETH Token C',
//     symbol: 'MEGC',
//     decimals: 18,
//     initialSupply: ethers.parseUnits('1000000', 18)
//   },
//   {
//     name: 'MegaETH Token D',
//     symbol: 'MEGD',
//     decimals: 18,
//     initialSupply: ethers.parseUnits('1000000', 18)
//   },
//   {
//     name: 'MegaETH Token E',
//     symbol: 'MEGE',
//     decimals: 18,
//     initialSupply: ethers.parseUnits('1000000', 18)
//   },
//   {
//     name: 'MegaETH Token F',
//     symbol: 'MEGF',
//     decimals: 18,
//     initialSupply: ethers.parseUnits('1000000', 18)
//   },
//   {
//     name: 'MegaETH Token G',
//     symbol: 'MEGG',
//     decimals: 18,
//     initialSupply: ethers.parseUnits('1000000', 18)
//   }
// ]

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`Deployer: ${deployerAddress}`);

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

  const existingDeploymentPath = resolveExistingFile(deploymentsDir);

  let existingDeployments: any = { tokens: [] };
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

  // Also try to load from apps/web frontend directory
  const frontendDir = path.resolve(
    __dirname,
    "..",
    "apps/web/public/deployments"
  );
  const existingFrontendPath = resolveExistingFile(frontendDir);
  if (existingFrontendPath && existingDeployments.tokens.length === 0) {
    try {
      existingDeployments = JSON.parse(
        fs.readFileSync(existingFrontendPath, "utf-8")
      );
      console.log(`Loaded existing deployments from ${existingFrontendPath}`);
    } catch (error) {
      console.warn("Could not load frontend deployments");
    }
  }

  for (const token of TOKENS) {
    console.log(`Deploying ${token.symbol}…`);
    const contract = await ERC20.deploy(
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

  // Merge with existing tokens
  const mergedTokens = [
    ...(Array.isArray(existingDeployments.tokens)
      ? existingDeployments.tokens
      : []),
    ...deployments
  ];
  const allTokens: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  }[] = [];
  const seen = new Set<string>();

  for (const token of mergedTokens) {
    if (!token?.address) continue;
    const key = String(token.address).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    allTokens.push({
      name: token.name,
      symbol: token.symbol,
      address: token.address,
      decimals: Number(token.decimals ?? 18)
    });
  }

  console.log("\nAll tokens (existing + new):");
  allTokens.forEach((t) => {
    console.log(
      `- ${t.symbol} (${t.name}) [decimals: ${t.decimals}] → ${t.address}`
    );
  });

  console.log(
    "\nFund your frontend wallet by transferring from the deployer as needed."
  );

  const manifest = {
    network,
    tokens: allTokens
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

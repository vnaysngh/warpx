import { ethers } from "hardhat";
import * as path from "path";
import * as fs from "fs";

type DeploymentManifest = {
  network: string;
  factory: string;
  wmegaeth: string;
};

async function main() {
  const pairAddress = process.env.PAIR_ADDRESS;
  if (!pairAddress) {
    throw new Error("Please provide PAIR_ADDRESS environment variable");
  }

  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const deploymentPath = path.join(deploymentsDir, `${network}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentManifest;

  console.log(`Network: ${network}`);
  console.log(`Checking pair: ${pairAddress}`);
  console.log("");

  const pair = await ethers.getContractAt(
    "packages/core/contracts/WarpPair.sol:WarpPair",
    pairAddress
  );

  const token0Address = await pair.token0();
  const token1Address = await pair.token1();

  console.log(`Token0 Address: ${token0Address}`);
  console.log(`Token1 Address: ${token1Address}`);
  console.log("");

  const token0 = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    token0Address
  );

  const token1 = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    token1Address
  );

  const token0Symbol = await token0.symbol();
  const token0Name = await token0.name();
  const token0Decimals = await token0.decimals();

  const token1Symbol = await token1.symbol();
  const token1Name = await token1.name();
  const token1Decimals = await token1.decimals();

  console.log(`Token0:`);
  console.log(`  Symbol: ${token0Symbol}`);
  console.log(`  Name: ${token0Name}`);
  console.log(`  Decimals: ${token0Decimals}`);
  console.log("");

  console.log(`Token1:`);
  console.log(`  Symbol: ${token1Symbol}`);
  console.log(`  Name: ${token1Name}`);
  console.log(`  Decimals: ${token1Decimals}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

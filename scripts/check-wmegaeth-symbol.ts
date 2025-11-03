import { ethers } from "hardhat";
import * as path from "path";
import * as fs from "fs";

type DeploymentManifest = {
  network: string;
  wmegaeth: string;
};

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const deploymentPath = path.join(deploymentsDir, `${network}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentManifest;

  console.log(`Network: ${network}`);
  console.log(`WMEGAETH Address: ${deployment.wmegaeth}`);

  const wmegaeth = await ethers.getContractAt(
    "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
    deployment.wmegaeth
  );

  const symbol = await wmegaeth.symbol();
  const name = await wmegaeth.name();
  const decimals = await wmegaeth.decimals();

  console.log(`Symbol: ${symbol}`);
  console.log(`Name: ${name}`);
  console.log(`Decimals: ${decimals}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";

async function main() {
  const oldWarpxAddress = "0xAf94EC793270d2FcF2Ad3700EBE3ba3488B266c3";

  console.log(`Checking old WARPX address: ${oldWarpxAddress}`);

  try {
    const token = await ethers.getContractAt(
      "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
      oldWarpxAddress
    );

    const symbol = await token.symbol();
    const name = await token.name();
    const decimals = await token.decimals();

    console.log(`Symbol: ${symbol}`);
    console.log(`Name: ${name}`);
    console.log(`Decimals: ${decimals}`);
  } catch (error) {
    console.error("Error fetching token:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

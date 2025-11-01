import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

const TOKEN_A_SYMBOL = process.env.LIQUIDITY_TOKEN_A ?? "WARPX";
const TOKEN_B_SYMBOL = process.env.LIQUIDITY_TOKEN_B ?? "ETH";
const TOKEN_A_AMOUNT = process.env.LIQUIDITY_TOKEN_A_AMOUNT ?? "27.5";
const TOKEN_B_AMOUNT = process.env.LIQUIDITY_TOKEN_B_AMOUNT ?? "0.005";
const DEADLINE_MINUTES = Number(process.env.LIQUIDITY_DEADLINE_MINUTES ?? "10");
const NATIVE_SYMBOL = (
  process.env.LIQUIDITY_NATIVE_SYMBOL ?? "ETH"
).toUpperCase();

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
    return;
  }

  console.log(`Approving ${symbol} allowance for router…`);
  const tx = await token.approve(spender, ethers.MaxUint256);
  await tx.wait();
}

async function main() {
  const network = process.env.HARDHAT_NETWORK ?? "megaethTestnet";
  const root = path.resolve(__dirname, "..");
  const deploymentsDir = path.join(root, "deployments");

  const deploymentManifest = loadJsonFile<DeploymentManifest>(
    path.join(deploymentsDir, `${network}.json`)
  );
  const tokenManifest = loadJsonFile<TokenManifest>(
    path.join(deploymentsDir, `${network}.tokens.json`)
  );

  // Handle native token (ETH) - it won't be in tokens.json
  const tokenAData = TOKEN_A_SYMBOL.toUpperCase() === NATIVE_SYMBOL
    ? {
        name: "Ethereum",
        symbol: NATIVE_SYMBOL,
        address: deploymentManifest.wmegaeth,
        decimals: 18
      }
    : findToken(tokenManifest, TOKEN_A_SYMBOL);

  const tokenBData = TOKEN_B_SYMBOL.toUpperCase() === NATIVE_SYMBOL
    ? {
        name: "Ethereum",
        symbol: NATIVE_SYMBOL,
        address: deploymentManifest.wmegaeth,
        decimals: 18
      }
    : findToken(tokenManifest, TOKEN_B_SYMBOL);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log(`Network: ${network}`);
  console.log(`Router: ${deploymentManifest.router}`);
  console.log(`Factory: ${deploymentManifest.factory}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Token A (${tokenAData.symbol}): ${tokenAData.address}`);
  console.log(`Token B (${tokenBData.symbol}): ${tokenBData.address}`);

  const router = await ethers.getContractAt(
    "WarpRouter",
    deploymentManifest.router,
    deployer
  );
  const factory = await ethers.getContractAt(
    "IWarpFactory",
    deploymentManifest.factory,
    deployer
  );
  const isTokenANative = tokenAData.symbol.toUpperCase() === NATIVE_SYMBOL;
  const isTokenBNative = tokenBData.symbol.toUpperCase() === NATIVE_SYMBOL;

  if (isTokenANative && isTokenBNative) {
    throw new Error(
      "Both tokens cannot be native. Please select one ERC20 token and one native token."
    );
  }

  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_MINUTES * 60;

  if (isTokenANative || isTokenBNative) {
    const nativeAmountConfig = isTokenANative ? TOKEN_A_AMOUNT : TOKEN_B_AMOUNT;
    const erc20AmountConfig = isTokenANative ? TOKEN_B_AMOUNT : TOKEN_A_AMOUNT;
    const erc20TokenData = isTokenANative ? tokenBData : tokenAData;

    console.log(
      "Detected native MegaETH liquidity pair. Using router.addLiquidityETH flow."
    );
    console.log(
      `Wrapped native token (wMEGAETH) address: ${deploymentManifest.wmegaeth}`
    );

    const erc20Token = await ethers.getContractAt(
      "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
      erc20TokenData.address,
      deployer
    );
    const wrappedNativeContract = await ethers.getContractAt(
      "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
      deploymentManifest.wmegaeth,
      deployer
    );

    const erc20Decimals = erc20TokenData.decimals ?? 18;
    const wrappedNativeDecimals = Number(
      await wrappedNativeContract.decimals()
    );

    const amountTokenDesired = ethers.parseUnits(
      erc20AmountConfig,
      erc20Decimals
    );
    const amountNativeDesired = ethers.parseUnits(
      nativeAmountConfig,
      wrappedNativeDecimals
    );

    const erc20Balance = await erc20Token.balanceOf(deployerAddress);
    if (erc20Balance < amountTokenDesired) {
      throw new Error(
        `Insufficient ${erc20TokenData.symbol} balance. Need ${erc20AmountConfig}, have ${ethers.formatUnits(
          erc20Balance,
          erc20Decimals
        )}`
      );
    }

    const nativeBalance = await deployer.provider.getBalance(deployerAddress);
    if (nativeBalance < amountNativeDesired) {
      throw new Error(
        `Insufficient native ETH balance. Need ${nativeAmountConfig}, have ${ethers.formatUnits(
          nativeBalance,
          wrappedNativeDecimals
        )}`
      );
    }

    await ensureAllowance(
      erc20Token,
      deployerAddress,
      deploymentManifest.router,
      amountTokenDesired,
      erc20TokenData.symbol
    );

    const existingPair = await factory.getPair(
      erc20TokenData.address,
      deploymentManifest.wmegaeth
    );
    if (existingPair !== ethers.ZeroAddress) {
      console.log(`Existing pair detected at ${existingPair}`);
    } else {
      console.log(
        "No existing pair found. Router will create it when adding liquidity."
      );
    }

    console.log(
      `Adding liquidity ${erc20AmountConfig} ${erc20TokenData.symbol} + ${nativeAmountConfig} ${NATIVE_SYMBOL} (native)`
    );

    const tx = await router.addLiquidityETH(
      erc20TokenData.address,
      amountTokenDesired,
      amountTokenDesired,
      amountNativeDesired,
      deployerAddress,
      deadline,
      { value: amountNativeDesired }
    );

    const receipt = await tx.wait();
    console.log(`Liquidity added. Tx hash: ${receipt?.hash ?? tx.hash}`);

    const pairAfter = await factory.getPair(
      erc20TokenData.address,
      deploymentManifest.wmegaeth
    );
    if (pairAfter === ethers.ZeroAddress) {
      console.warn(
        "Pair address unknown after addLiquidity. Check the transaction manually."
      );
    } else {
      console.log(`Pair address: ${pairAfter}`);
    }
  } else {
    const tokenA = await ethers.getContractAt(
      "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
      tokenAData.address,
      deployer
    );
    const tokenB = await ethers.getContractAt(
      "packages/periphery/contracts/interfaces/IERC20.sol:IERC20",
      tokenBData.address,
      deployer
    );

    const amountADesired = ethers.parseUnits(
      TOKEN_A_AMOUNT,
      tokenAData.decimals ?? 18
    );
    const amountBDesired = ethers.parseUnits(
      TOKEN_B_AMOUNT,
      tokenBData.decimals ?? 18
    );

    const balanceA = await tokenA.balanceOf(deployerAddress);
    if (balanceA < amountADesired) {
      throw new Error(
        `Insufficient ${tokenAData.symbol} balance. Need ${TOKEN_A_AMOUNT}, have ${ethers.formatUnits(
          balanceA,
          tokenAData.decimals ?? 18
        )}`
      );
    }

    const balanceB = await tokenB.balanceOf(deployerAddress);
    if (balanceB < amountBDesired) {
      throw new Error(
        `Insufficient ${tokenBData.symbol} balance. Need ${TOKEN_B_AMOUNT}, have ${ethers.formatUnits(
          balanceB,
          tokenBData.decimals ?? 18
        )}`
      );
    }

    await ensureAllowance(
      tokenA,
      deployerAddress,
      deploymentManifest.router,
      amountADesired,
      tokenAData.symbol
    );
    await ensureAllowance(
      tokenB,
      deployerAddress,
      deploymentManifest.router,
      amountBDesired,
      tokenBData.symbol
    );

    const existingPair = await factory.getPair(
      tokenAData.address,
      tokenBData.address
    );
    if (existingPair !== ethers.ZeroAddress) {
      console.log(`Existing pair detected at ${existingPair}`);
    } else {
      console.log(
        "No existing pair found. Router will create it when adding liquidity."
      );
    }

    console.log(
      `Adding liquidity ${TOKEN_A_AMOUNT} ${tokenAData.symbol} + ${TOKEN_B_AMOUNT} ${tokenBData.symbol}`
    );
    const tx = await router.addLiquidity(
      tokenAData.address,
      tokenBData.address,
      amountADesired,
      amountBDesired,
      amountADesired,
      amountBDesired,
      deployerAddress,
      deadline
    );

    const receipt = await tx.wait();
    console.log(`Liquidity added. Tx hash: ${receipt?.hash ?? tx.hash}`);

    const pairAfter = await factory.getPair(
      tokenAData.address,
      tokenBData.address
    );
    if (pairAfter === ethers.ZeroAddress) {
      console.warn(
        "Pair address unknown after addLiquidity. Check the transaction manually."
      );
    } else {
      console.log(`Pair address: ${pairAfter}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

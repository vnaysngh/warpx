#!/usr/bin/env node

import { createPublicClient, http, getContract, formatUnits } from "viem";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const TOKEN_A_SYMBOL = (process.env.PAIR_TOKEN_A ?? "MEGA").toUpperCase();
const TOKEN_B_SYMBOL = (process.env.PAIR_TOKEN_B ?? "ETH").toUpperCase();
const NETWORK = process.env.PAIR_NETWORK ?? "megaethTestnet";
const NATIVE_SYMBOL = (process.env.PAIR_NATIVE_SYMBOL ?? "ETH").toUpperCase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MegaETH Testnet configuration
const MEGAETH_TESTNET_RPC = "https://timothy.megaeth.com/rpc";

// ABIs
const FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    name: "getPair",
    outputs: [{ name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token0",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "token1",
    outputs: [{ type: "address" }],
    stateMutability: "view",
    type: "function"
  }
];

async function fetchPairReserves() {
  try {
    const deploymentsPath = join(
      __dirname,
      "../public/deployments",
      `${NETWORK}.json`
    );
    const tokensPath = join(
      __dirname,
      "../public/deployments",
      `${NETWORK}.tokens.json`
    );

    if (!existsSync(deploymentsPath)) {
      throw new Error(`Deployment file not found: ${deploymentsPath}`);
    }
    if (!existsSync(tokensPath)) {
      throw new Error(`Token manifest not found: ${tokensPath}`);
    }

    const deployments = JSON.parse(readFileSync(deploymentsPath, "utf-8"));
    const tokensData = JSON.parse(readFileSync(tokensPath, "utf-8"));

    const { factory, wmegaeth } = deployments;
    const tokens = tokensData.tokens ?? [];

    const findToken = (symbol) =>
      tokens.find((token) => token.symbol?.toUpperCase() === symbol);

    const rawTokenA = findToken(TOKEN_A_SYMBOL);
    const rawTokenB = findToken(TOKEN_B_SYMBOL);

    if (!rawTokenA && TOKEN_A_SYMBOL !== NATIVE_SYMBOL) {
      throw new Error(`Token ${TOKEN_A_SYMBOL} not found in token manifest`);
    }

    if (!rawTokenB && TOKEN_B_SYMBOL !== NATIVE_SYMBOL) {
      throw new Error(`Token ${TOKEN_B_SYMBOL} not found in token manifest`);
    }

    const resolveToken = (symbol, tokenData) => {
      if (symbol === NATIVE_SYMBOL) {
        if (!wmegaeth) {
          throw new Error(
            `Wrapped native address (wmegaeth) missing from ${NETWORK}.json`
          );
        }
        return {
          symbol,
          address: wmegaeth,
          decimals: 18,
          isNative: true
        };
      }
      return {
        symbol: tokenData.symbol,
        address: tokenData.address,
        decimals: tokenData.decimals ?? 18,
        isNative: false
      };
    };

    const tokenA = resolveToken(TOKEN_A_SYMBOL, rawTokenA);
    const tokenB = resolveToken(TOKEN_B_SYMBOL, rawTokenB);

    // Create public client
    const client = createPublicClient({
      transport: http(MEGAETH_TESTNET_RPC)
    });

    // Get pair address from factory
    const factoryContract = getContract({
      address: factory,
      abi: FACTORY_ABI,
      client
    });

    const pairAddress = await factoryContract.read.getPair([
      tokenA.address,
      tokenB.address
    ]);

    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Pair does not exist in factory");
    }

    // Get reserves from pair
    const pairContract = getContract({
      address: pairAddress,
      abi: PAIR_ABI,
      client
    });

    const reserves = await pairContract.read.getReserves();
    const token0Address = await pairContract.read.token0();

    // Format reserves
    const reserve0 = reserves[0];
    const reserve1 = reserves[1];
    const blockTimestamp = reserves[2];

    // Determine which token is token0
    const isTokenAToken0 =
      token0Address.toLowerCase() === tokenA.address.toLowerCase();
    const reserveA = isTokenAToken0 ? reserve0 : reserve1;
    const reserveB = isTokenAToken0 ? reserve1 : reserve0;

    // Format with decimals
    const reserveAFormatted = parseFloat(
      formatUnits(reserveA, tokenA.decimals)
    );
    const reserveBFormatted = parseFloat(
      formatUnits(reserveB, tokenB.decimals)
    );

    // Smart formatting function - no scientific notation
    const formatReserve = (value) => {
      if (value === 0) return "0";
      // For very small numbers, show up to 18 decimals
      if (value < 0.0001) {
        const str = value.toFixed(18);
        return str.replace(/\.?0+$/, ""); // Remove trailing zeros
      }
      return value.toFixed(
        Math.min(6, Math.max(2, -Math.floor(Math.log10(value))))
      );
    };

    // Calculate price
    const priceAInB = reserveBFormatted / reserveAFormatted;
    const priceBInA = reserveAFormatted / reserveBFormatted;

    return {
      pair: `${tokenA.symbol}/${tokenB.symbol}`,
      pairAddress,
      tokenA: {
        symbol: tokenA.symbol,
        address: tokenA.address,
        reserve: reserveAFormatted,
        rawReserve: reserveA.toString()
      },
      tokenB: {
        symbol: tokenB.symbol,
        address: tokenB.address,
        reserve: reserveBFormatted,
        rawReserve: reserveB.toString()
      },
      prices: {
        [`${tokenA.symbol}/${tokenB.symbol}`]: priceAInB,
        [`${tokenB.symbol}/${tokenA.symbol}`]: priceBInA
      },
      blockTimestamp
    };
  } catch (error) {
    console.error("Error fetching pair reserves:", error.message);
    process.exit(1);
  }
}

// Run the script
fetchPairReserves().then(() => {
  process.exit(0);
});

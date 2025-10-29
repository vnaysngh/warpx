#!/usr/bin/env node

import { createPublicClient, http, getContract, keccak256, encodePacked } from 'viem';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MegaETH Testnet configuration
const MEGAETH_TESTNET_RPC = 'https://carrot.megaeth.com/rpc';

// ABIs
const FACTORY_ABI = [
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function fetchPairReserves() {
  try {
    // Read deployments
    const deploymentsPath = join(__dirname, '../public/deployments/megaethTestnet.sample.json');
    const tokensPath = join(__dirname, '../public/deployments/megaethtestnet.tokens.json');

    const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf-8'));
    const tokensData = JSON.parse(readFileSync(tokensPath, 'utf-8'));

    const factory = deployments.factory;
    const tokens = tokensData.tokens;

    if (!tokens || tokens.length < 2) {
      throw new Error('Not enough tokens in deployment file');
    }

    const tokenA = tokens[0];
    const tokenB = tokens[1];

    console.log(`Fetching reserves for pair: ${tokenA.symbol} / ${tokenB.symbol}`);
    console.log(`TokenA: ${tokenA.address}`);
    console.log(`TokenB: ${tokenB.address}`);
    console.log(`Factory: ${factory}`);
    console.log('');

    // Create public client
    const client = createPublicClient({
      transport: http(MEGAETH_TESTNET_RPC),
    });

    // Get pair address from factory
    const factoryContract = getContract({
      address: factory,
      abi: FACTORY_ABI,
      client,
    });

    const pairAddress = await factoryContract.read.getPair([tokenA.address, tokenB.address]);

    if (pairAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Pair does not exist in factory');
    }

    console.log(`Pair address: ${pairAddress}`);
    console.log('');

    // Get reserves from pair
    const pairContract = getContract({
      address: pairAddress,
      abi: PAIR_ABI,
      client,
    });

    const reserves = await pairContract.read.getReserves();
    const token0Address = await pairContract.read.token0();

    // Format reserves
    const reserve0 = reserves[0];
    const reserve1 = reserves[1];
    const blockTimestamp = reserves[2];

    // Determine which token is token0
    const isTokenAToken0 = token0Address.toLowerCase() === tokenA.address.toLowerCase();
    const reserveA = isTokenAToken0 ? reserve0 : reserve1;
    const reserveB = isTokenAToken0 ? reserve1 : reserve0;

    // Format with decimals
    const reserveAFormatted = Number(reserveA) / Math.pow(10, tokenA.decimals);
    const reserveBFormatted = Number(reserveB) / Math.pow(10, tokenB.decimals);

    // Smart formatting function - no scientific notation
    const formatReserve = (value) => {
      if (value === 0) return '0';
      // For very small numbers, show up to 18 decimals
      if (value < 0.0001) {
        const str = value.toFixed(18);
        return str.replace(/\.?0+$/, ''); // Remove trailing zeros
      }
      return value.toFixed(Math.min(6, Math.max(2, -Math.floor(Math.log10(value)))));
    };

    console.log('=== PAIR RESERVES ===');
    console.log(`${tokenA.symbol} Reserve: ${formatReserve(reserveAFormatted)} (raw: ${reserveA})`);
    console.log(`${tokenB.symbol} Reserve: ${formatReserve(reserveBFormatted)} (raw: ${reserveB})`);
    console.log(`Block Timestamp Last: ${blockTimestamp} (${new Date(Number(blockTimestamp) * 1000).toLocaleString()})`);
    console.log('');

    // Calculate price
    const priceAInB = reserveBFormatted / reserveAFormatted;
    const priceBInA = reserveAFormatted / reserveBFormatted;

    console.log('=== PRICES ===');
    console.log(`1 ${tokenA.symbol} = ${formatReserve(priceAInB)} ${tokenB.symbol}`);
    console.log(`1 ${tokenB.symbol} = ${formatReserve(priceBInA)} ${tokenA.symbol}`);

    return {
      pair: `${tokenA.symbol}/${tokenB.symbol}`,
      pairAddress,
      tokenA: {
        symbol: tokenA.symbol,
        address: tokenA.address,
        reserve: reserveAFormatted,
        rawReserve: reserveA.toString(),
      },
      tokenB: {
        symbol: tokenB.symbol,
        address: tokenB.address,
        reserve: reserveBFormatted,
        rawReserve: reserveB.toString(),
      },
      prices: {
        [`${tokenA.symbol}/${tokenB.symbol}`]: priceAInB,
        [`${tokenB.symbol}/${tokenA.symbol}`]: priceBInA,
      },
      blockTimestamp,
    };
  } catch (error) {
    console.error('Error fetching pair reserves:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchPairReserves().then(() => {
  process.exit(0);
});

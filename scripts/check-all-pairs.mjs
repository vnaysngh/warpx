import { createPublicClient, http, getContract } from 'viem';

const FACTORY_ADDRESS = '0x57A9156f9b3fFa1b603F188f0f64FF93f51C62F8';
const RPC_URL = 'https://carrot.megaeth.com/rpc';

const factoryABI = [
  {
    inputs: [],
    name: 'allPairsLength',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'allPairs',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const pairABI = [
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const erc20ABI = [
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
];

const client = createPublicClient({
  transport: http(RPC_URL)
});

async function main() {
  const factory = getContract({
    address: FACTORY_ADDRESS,
    abi: factoryABI,
    client
  });

  const pairCount = await factory.read.allPairsLength();
  console.log(`Total pairs in factory: ${pairCount}\n`);

  for (let i = 0; i < pairCount; i++) {
    const pairAddress = await factory.read.allPairs([BigInt(i)]);

    const pair = getContract({
      address: pairAddress,
      abi: pairABI,
      client
    });

    const token0Address = await pair.read.token0();
    const token1Address = await pair.read.token1();

    const token0 = getContract({
      address: token0Address,
      abi: erc20ABI,
      client
    });

    const token1 = getContract({
      address: token1Address,
      abi: erc20ABI,
      client
    });

    const [symbol0, name0] = await Promise.all([
      token0.read.symbol(),
      token0.read.name()
    ]);

    const [symbol1, name1] = await Promise.all([
      token1.read.symbol(),
      token1.read.name()
    ]);

    console.log(`Pair ${i}: ${pairAddress}`);
    console.log(`  Token0: ${symbol0} (${name0}) - ${token0Address}`);
    console.log(`  Token1: ${symbol1} (${name1}) - ${token1Address}`);
    console.log('');
  }
}

main().catch(console.error);

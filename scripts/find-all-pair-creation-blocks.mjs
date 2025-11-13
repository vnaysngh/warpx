import { createPublicClient, http, getContract } from "viem";

const FACTORY_ADDRESS = "0x57A9156f9b3fFa1b603F188f0f64FF93f51C62F8";
const RPC_URL = "https://timothy.megaeth.com/rpc";

const client = createPublicClient({
  transport: http(RPC_URL)
});

// Try to find creation block by binary searching for when the pair started existing
async function findPairCreationBlock(pairAddress) {
  const codeABI = [
    {
      inputs: [],
      name: "token0",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  // Try some known block ranges
  const ranges = [
    { start: 18000000, end: 19000000, name: "18M-19M" },
    { start: 19000000, end: 20000000, name: "19M-20M" },
    { start: 20000000, end: 21000000, name: "20M-21M" },
    { start: 21000000, end: 21684900, name: "21M-21.684M (before startBlock)" },
    { start: 21684900, end: 22000000, name: "21.684M-22M (after startBlock)" }
  ];

  for (const range of ranges) {
    try {
      const pair = getContract({
        address: pairAddress,
        abi: codeABI,
        client
      });

      const token0 = await pair.read.token0({ blockNumber: BigInt(range.end) });
      if (token0 && token0 !== "0x0000000000000000000000000000000000000000") {
        console.log(`  ✓ Pair existed at block ${range.end} (${range.name})`);
        return range;
      }
    } catch (e) {
      console.log(
        `  ✗ Pair did NOT exist at block ${range.end} (${range.name})`
      );
    }
  }

  return null;
}

async function main() {
  const factoryABI = [
    {
      inputs: [],
      name: "allPairsLength",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ name: "", type: "uint256" }],
      name: "allPairs",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  const pairABI = [
    {
      inputs: [],
      name: "token0",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "token1",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  const erc20ABI = [
    {
      inputs: [],
      name: "symbol",
      outputs: [{ name: "", type: "string" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  const factory = getContract({
    address: FACTORY_ADDRESS,
    abi: factoryABI,
    client
  });

  const pairCount = await factory.read.allPairsLength();
  console.log(`\nChecking ${pairCount} pairs from factory...\n`);
  console.log(`Subgraph startBlock: 21,684,900`);
  console.log(`Current sync block: ~21,695,331\n`);

  for (let i = 0; i < pairCount; i++) {
    const pairAddress = await factory.read.allPairs([BigInt(i)]);

    const pair = getContract({
      address: pairAddress,
      abi: pairABI,
      client
    });

    const [token0Address, token1Address] = await Promise.all([
      pair.read.token0(),
      pair.read.token1()
    ]);

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

    const [symbol0, symbol1] = await Promise.all([
      token0.read.symbol(),
      token1.read.symbol()
    ]);

    console.log(`\nPair ${i}: ${symbol0}/${symbol1}`);
    console.log(`  Address: ${pairAddress}`);

    const range = await findPairCreationBlock(pairAddress);
    if (range) {
      if (range.start < 21684900) {
        console.log(
          `  ⚠️  CREATED BEFORE STARTBLOCK - Will NOT be indexed by subgraph!`
        );
      } else {
        console.log(`  ✓ Created after startBlock - Should be indexed`);
      }
    }
  }
}

main().catch(console.error);

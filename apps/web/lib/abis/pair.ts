export const pairAbi = [
  {
    "type": "function",
    "name": "getReserves",
    "inputs": [],
    "outputs": [
      { "type": "uint112", "name": "_reserve0" },
      { "type": "uint112", "name": "_reserve1" },
      { "type": "uint32", "name": "_blockTimestampLast" }
    ],
    "stateMutability": "view"
  },
  { "type": "function", "name": "token0", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "token1", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "balanceOf", "inputs": [{ "type": "address", "name": "owner" }], "outputs": [{ "type": "uint256" }], "stateMutability": "view" }
] as const

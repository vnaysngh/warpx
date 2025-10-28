export const factoryAbi = [
  { "type": "function", "name": "getPair", "inputs": [{ "type": "address", "name": "tokenA" }, { "type": "address", "name": "tokenB" }], "outputs": [{ "type": "address" }], "stateMutability": "view" },
  { "type": "function", "name": "createPair", "inputs": [{ "type": "address", "name": "tokenA" }, { "type": "address", "name": "tokenB" }], "outputs": [{ "type": "address" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "feeTo", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view" }
] as const

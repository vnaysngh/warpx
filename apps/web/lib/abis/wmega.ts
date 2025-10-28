export const wmegaAbi = [
  { "type": "function", "name": "deposit", "inputs": [], "outputs": [], "stateMutability": "payable" },
  { "type": "function", "name": "withdraw", "inputs": [{ "type": "uint256", "name": "wad" }], "outputs": [], "stateMutability": "nonpayable" },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{ "type": "address", "name": "account" }],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      { "type": "address", "name": "owner" },
      { "type": "address", "name": "spender" }
    ],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "type": "address", "name": "spender" },
      { "type": "uint256", "name": "value" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "nonpayable"
  }
] as const

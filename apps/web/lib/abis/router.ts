export const warpRouterAbi = [
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [{ "type": "address", "name": "" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "WETH",
    "inputs": [],
    "outputs": [{ "type": "address", "name": "" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addLiquidity",
    "inputs": [
      { "type": "address", "name": "tokenA" },
      { "type": "address", "name": "tokenB" },
      { "type": "uint256", "name": "amountADesired" },
      { "type": "uint256", "name": "amountBDesired" },
      { "type": "uint256", "name": "amountAMin" },
      { "type": "uint256", "name": "amountBMin" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [
      { "type": "uint256", "name": "amountA" },
      { "type": "uint256", "name": "amountB" },
      { "type": "uint256", "name": "liquidity" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "addLiquidityETH",
    "inputs": [
      { "type": "address", "name": "token" },
      { "type": "uint256", "name": "amountTokenDesired" },
      { "type": "uint256", "name": "amountTokenMin" },
      { "type": "uint256", "name": "amountETHMin" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [
      { "type": "uint256", "name": "amountToken" },
      { "type": "uint256", "name": "amountETH" },
      { "type": "uint256", "name": "liquidity" }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "removeLiquidity",
    "inputs": [
      { "type": "address", "name": "tokenA" },
      { "type": "address", "name": "tokenB" },
      { "type": "uint256", "name": "liquidity" },
      { "type": "uint256", "name": "amountAMin" },
      { "type": "uint256", "name": "amountBMin" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [
      { "type": "uint256", "name": "amountA" },
      { "type": "uint256", "name": "amountB" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeLiquidityETH",
    "inputs": [
      { "type": "address", "name": "token" },
      { "type": "uint256", "name": "liquidity" },
      { "type": "uint256", "name": "amountTokenMin" },
      { "type": "uint256", "name": "amountETHMin" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [
      { "type": "uint256", "name": "amountToken" },
      { "type": "uint256", "name": "amountETH" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapExactTokensForTokens",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAmountsOut",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "address[]", "name": "path" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAmountsIn",
    "inputs": [
      { "type": "uint256", "name": "amountOut" },
      { "type": "address[]", "name": "path" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "swapExactETHForTokens",
    "inputs": [
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "swapExactTokensForETH",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapTokensForExactTokens",
    "inputs": [
      { "type": "uint256", "name": "amountOut" },
      { "type": "uint256", "name": "amountInMax" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapETHForExactTokens",
    "inputs": [
      { "type": "uint256", "name": "amountOut" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "swapTokensForExactETH",
    "inputs": [
      { "type": "uint256", "name": "amountOut" },
      { "type": "uint256", "name": "amountInMax" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "stateMutability": "nonpayable"
  }
] as const

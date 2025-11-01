import { ethers } from 'ethers';

/**
 * Script to add liquidity matching another AMM's exact price
 * NO decimal rounding errors - uses exact on-chain reserves
 */

// ABIs
const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

const ROUTER_ABI = [
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)'
];

async function matchAMMPrice() {
  // Setup provider
  const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
  const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

  // Addresses
  const UNISWAP_BNB_ETH_PAIR = '0x...'; // The pair you want to match
  const YOUR_ROUTER = '0x...';
  const BNB_TOKEN = '0x...';
  const ETH_TOKEN = '0x...'; // or use WETH

  // Step 1: Read EXACT reserves from the other AMM
  console.log('📊 Fetching reserves from Uniswap pair...');
  const uniswapPair = new ethers.Contract(UNISWAP_BNB_ETH_PAIR, PAIR_ABI, provider);

  const [reserve0, reserve1] = await uniswapPair.getReserves();
  const token0 = await uniswapPair.token0();

  // Determine which token is which
  const isBNBToken0 = token0.toLowerCase() === BNB_TOKEN.toLowerCase();
  const reserveBNB = isBNBToken0 ? reserve0 : reserve1;
  const reserveETH = isBNBToken0 ? reserve1 : reserve0;

  console.log(`Reserve BNB: ${ethers.formatEther(reserveBNB)}`);
  console.log(`Reserve ETH: ${ethers.formatEther(reserveETH)}`);
  console.log(`Price: 1 BNB = ${ethers.formatEther(reserveETH * 10n**18n / reserveBNB)} ETH`);

  // Step 2: Decide how much liquidity YOU want to add
  // Choose ONE token amount, calculate the other
  const yourBNBAmount = ethers.parseEther('100'); // You decide this

  // Step 3: Calculate EXACT ETH needed using the ratio
  // This is PRECISE - no floating point errors!
  const yourETHAmount = (yourBNBAmount * reserveETH) / reserveBNB;

  console.log('\n💰 You will add:');
  console.log(`BNB: ${ethers.formatEther(yourBNBAmount)}`);
  console.log(`ETH: ${ethers.formatEther(yourETHAmount)}`);

  // Verify the price matches EXACTLY
  const yourPrice = (yourETHAmount * 10n**18n) / yourBNBAmount;
  const uniswapPrice = (reserveETH * 10n**18n) / reserveBNB;
  console.log('\n✅ Price verification:');
  console.log(`Your price:     ${ethers.formatEther(yourPrice)} ETH per BNB`);
  console.log(`Uniswap price:  ${ethers.formatEther(uniswapPrice)} ETH per BNB`);
  console.log(`Match: ${yourPrice === uniswapPrice ? '✅ PERFECT' : '❌ MISMATCH'}`);

  // Step 4: Add liquidity with 0.5% slippage tolerance
  const router = new ethers.Contract(YOUR_ROUTER, ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

  console.log('\n🚀 Adding liquidity...');

  const tx = await router.addLiquidity(
    BNB_TOKEN,
    ETH_TOKEN,
    yourBNBAmount,
    yourETHAmount,
    (yourBNBAmount * 995n) / 1000n, // 0.5% slippage
    (yourETHAmount * 995n) / 1000n,  // 0.5% slippage
    wallet.address,
    deadline,
    { gasLimit: 500000 }
  );

  console.log('Transaction hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Liquidity added successfully!');
  console.log('Gas used:', receipt.gasUsed.toString());
}

// Run it
matchAMMPrice().catch(console.error);

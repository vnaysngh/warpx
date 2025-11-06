import { ethers } from 'ethers';

// WarpX getAmountOut formula (0.3% fee)
function getAmountOut(amountIn, reserveIn, reserveOut) {
  if (amountIn <= 0n) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');

  const amountInWithFee = amountIn * 997n; // apply 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  const amountOut = numerator / denominator;

  return amountOut;
}

console.log('=== VERIFYING SWAP MATH ===\n');

// Step 2: Before swap
const ethReserveBefore = ethers.parseEther('0.006'); // 6,000,000,000,000,000 wei
const megaReserveBefore = ethers.parseEther('33'); // 33,000,000,000,000,000,000 wei

console.log('BEFORE SWAP:');
console.log(`ETH Reserve: ${ethers.formatEther(ethReserveBefore)} ETH`);
console.log(`MEGA Reserve: ${ethers.formatEther(megaReserveBefore)} MEGA`);
console.log(`Constant k = ${ethers.formatEther(ethReserveBefore * megaReserveBefore / BigInt(1e18))}\n`);

// Swap input
const swapAmountIn = ethers.parseEther('0.0001'); // 100,000,000,000,000 wei
console.log(`SWAP INPUT: ${ethers.formatEther(swapAmountIn)} ETH\n`);

// Calculate expected output
const expectedMegaOut = getAmountOut(swapAmountIn, ethReserveBefore, megaReserveBefore);
console.log('EXPECTED OUTPUT:');
console.log(`MEGA out: ${ethers.formatEther(expectedMegaOut)} MEGA`);
console.log(`MEGA out (raw): ${expectedMegaOut.toString()}\n`);

// Calculate expected reserves after swap
const expectedEthReserve = ethReserveBefore + swapAmountIn;
const expectedMegaReserve = megaReserveBefore - expectedMegaOut;

console.log('EXPECTED RESERVES AFTER SWAP:');
console.log(`ETH Reserve: ${ethers.formatEther(expectedEthReserve)} ETH (raw: ${expectedEthReserve.toString()})`);
console.log(`MEGA Reserve: ${ethers.formatEther(expectedMegaReserve)} MEGA (raw: ${expectedMegaReserve.toString()})`);
console.log(`Constant k = ${ethers.formatEther(expectedEthReserve * expectedMegaReserve / BigInt(1e18))}\n`);

// Step 3: Actual reserves from script
const actualEthReserve = 6100000000000000n;
const actualMegaReserve = 32460080658382242041n;

console.log('ACTUAL RESERVES FROM SCRIPT:');
console.log(`ETH Reserve: ${ethers.formatEther(actualEthReserve)} ETH (raw: ${actualEthReserve.toString()})`);
console.log(`MEGA Reserve: ${ethers.formatEther(actualMegaReserve)} MEGA (raw: ${actualMegaReserve.toString()})`);
console.log(`Constant k = ${ethers.formatEther(actualEthReserve * actualMegaReserve / BigInt(1e18))}\n`);

// Calculate actual MEGA received
const actualMegaOut = megaReserveBefore - actualMegaReserve;
console.log('ACTUAL MEGA RECEIVED:');
console.log(`${ethers.formatEther(actualMegaOut)} MEGA (raw: ${actualMegaOut.toString()})\n`);

// Compare
console.log('=== COMPARISON ===');
console.log(`ETH Reserve Match: ${expectedEthReserve === actualEthReserve ? '✓' : '✗'}`);
console.log(`MEGA Reserve Match: ${expectedMegaReserve === actualMegaReserve ? '✓' : '✗'}`);

if (expectedMegaReserve !== actualMegaReserve) {
  const diff = expectedMegaReserve - actualMegaReserve;
  console.log(`\nMEGA Reserve Difference: ${ethers.formatEther(diff > 0n ? diff : -diff)} MEGA`);
  console.log(`Difference in wei: ${diff.toString()}`);

  const percentDiff = (Number(diff) / Number(megaReserveBefore)) * 100;
  console.log(`Percentage: ${percentDiff.toFixed(6)}%`);
}

import { ethers } from 'ethers';

function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}

console.log('=== SWAP DISCREPANCY DIAGNOSIS ===\n');

const reserveEthBefore = ethers.parseEther('0.006');
const reserveMegaBefore = ethers.parseEther('33');
const reserveEthAfter = 6100000000000000n;
const reserveMegaAfter = 32460080658382242041n;

const actualEthAdded = reserveEthAfter - reserveEthBefore;
const actualMegaRemoved = reserveMegaBefore - reserveMegaAfter;

console.log('CONFIRMED VALUES:');
console.log(`Reserves before: ${ethers.formatEther(reserveEthBefore)} ETH + ${ethers.formatEther(reserveMegaBefore)} MEGA`);
console.log(`Reserves after: ${ethers.formatEther(reserveEthAfter)} ETH + ${ethers.formatEther(reserveMegaAfter)} MEGA`);
console.log(`\nReserve changes:`);
console.log(`  ETH added: ${ethers.formatEther(actualEthAdded)} ETH (${actualEthAdded.toString()} wei)`);
console.log(`  MEGA removed: ${ethers.formatEther(actualMegaRemoved)} MEGA (${actualMegaRemoved.toString()} wei)\n`);

// Calculate what MEGA out should be for 0.0001 ETH in
const normalInput = ethers.parseEther('0.0001');
const expectedOut = getAmountOut(normalInput, reserveEthBefore, reserveMegaBefore);

console.log('EXPECTED (Uniswap V2 formula):');
console.log(`  Input: ${ethers.formatEther(normalInput)} ETH`);
console.log(`  Output: ${ethers.formatEther(expectedOut)} MEGA`);
console.log(`  Output (raw): ${expectedOut.toString()}\n`);

console.log('ACTUAL:');
console.log(`  Input: ${ethers.formatEther(actualEthAdded)} ETH`);
console.log(`  Output: ${ethers.formatEther(actualMegaRemoved)} MEGA`);
console.log(`  Output (raw): ${actualMegaRemoved.toString()}\n`);

const difference = actualMegaRemoved - expectedOut;
console.log('DISCREPANCY:');
console.log(`  Extra MEGA received: ${ethers.formatEther(difference)} MEGA`);
console.log(`  Extra in wei: ${difference.toString()}`);
console.log(`  Percentage: ${(Number(difference) / Number(expectedOut) * 100).toFixed(4)}%\n`);

// Check if constant product is maintained
const kBefore = reserveEthBefore * reserveMegaBefore / BigInt(1e18);
const kAfter = reserveEthAfter * reserveMegaAfter / BigInt(1e18);

console.log('CONSTANT PRODUCT CHECK:');
console.log(`  k before: ${ethers.formatEther(kBefore)}`);
console.log(`  k after: ${ethers.formatEther(kAfter)}`);
console.log(`  k should increase by ~0.03% due to 0.3% fee`);

const kIncrease = ((Number(kAfter) - Number(kBefore)) / Number(kBefore)) * 100;
console.log(`  k increased by: ${kIncrease.toFixed(4)}%`);

if (kIncrease < 0.02 || kIncrease > 0.04) {
  console.log(`  ⚠️  WARNING: k increase is outside expected range!\n`);
} else {
  console.log(`  ✓ k increase is within expected range\n`);
}

// Calculate what the reserves SHOULD be after the swap
const expectedReserveEth = reserveEthBefore + normalInput;
const expectedReserveMega = reserveMegaBefore - expectedOut;

console.log('WHAT RESERVES SHOULD BE:');
console.log(`  ETH: ${ethers.formatEther(expectedReserveEth)} (${expectedReserveEth.toString()})`);
console.log(`  MEGA: ${ethers.formatEther(expectedReserveMega)} (${expectedReserveMega.toString()})\n`);

console.log('=== POSSIBLE CAUSES ===');
console.log('1. Bug in swap function giving too many tokens');
console.log('2. Reserves between step 2 and step 3 weren\'t exactly as reported');
console.log('3. Different swap amount or multiple swaps combined');
console.log('4. Fee calculation error');
console.log('\nRECOMMENDATION: Check the actual swap transaction on block explorer');
console.log('Look for:');
console.log('  - Exact amount of ETH sent');
console.log('  - Exact amount of MEGA received');
console.log('  - Any other transfers in the same transaction');

import { ethers } from 'ethers';

// Given reserves before and after, calculate the actual input amount
const ethReserveBefore = ethers.parseEther('0.006');
const megaReserveBefore = ethers.parseEther('33');

const ethReserveAfter = 6100000000000000n;
const megaReserveAfter = 32460080658382242041n;

const actualEthAdded = ethReserveAfter - ethReserveBefore;
const actualMegaRemoved = megaReserveBefore - megaReserveAfter;

console.log('=== REVERSE CALCULATION ===\n');
console.log('ACTUAL CHANGES:');
console.log(`ETH added: ${ethers.formatEther(actualEthAdded)} ETH`);
console.log(`MEGA removed: ${ethers.formatEther(actualMegaRemoved)} MEGA\n`);

// Verify with getAmountOut
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000n) + amountInWithFee;
  return numerator / denominator;
}

// Test if 0.0001 ETH gives us the actual MEGA removed
const testAmount = ethers.parseEther('0.0001');
const calculatedOut = getAmountOut(testAmount, ethReserveBefore, megaReserveBefore);

console.log('TESTING 0.0001 ETH INPUT:');
console.log(`Calculated MEGA out: ${ethers.formatEther(calculatedOut)} MEGA`);
console.log(`Actual MEGA out: ${ethers.formatEther(actualMegaRemoved)} MEGA`);
console.log(`Match: ${calculatedOut === actualMegaRemoved ? '✓' : '✗'}\n`);

// Try to find what input amount would give the actual output
// Using binary search
let low = 0n;
let high = ethers.parseEther('1');
let found = false;
let iterations = 0;
const maxIterations = 100;

console.log('SEARCHING FOR ACTUAL INPUT AMOUNT...\n');

while (iterations < maxIterations && high - low > 1n) {
  iterations++;
  const mid = (low + high) / 2n;
  const out = getAmountOut(mid, ethReserveBefore, megaReserveBefore);

  if (out === actualMegaRemoved) {
    console.log(`✓ FOUND! Actual input: ${ethers.formatEther(mid)} ETH`);
    console.log(`  In wei: ${mid.toString()}`);
    found = true;
    break;
  } else if (out < actualMegaRemoved) {
    low = mid;
  } else {
    high = mid;
  }
}

if (!found) {
  console.log(`After ${iterations} iterations:`);
  console.log(`Input range: ${ethers.formatEther(low)} - ${ethers.formatEther(high)} ETH`);

  const outLow = getAmountOut(low, ethReserveBefore, megaReserveBefore);
  const outHigh = getAmountOut(high, ethReserveBefore, megaReserveBefore);

  console.log(`Output for low: ${ethers.formatEther(outLow)} MEGA`);
  console.log(`Output for high: ${ethers.formatEther(outHigh)} MEGA`);
  console.log(`Target output: ${ethers.formatEther(actualMegaRemoved)} MEGA\n`);
}

// Check if maybe the reserves before weren't exactly what we think
console.log('=== ALTERNATIVE: CHECK IF RESERVES BEFORE WERE DIFFERENT ===\n');

// If actual input was 0.0001 ETH, what would reserves before need to be?
// We know: amountOut = 539919341617757959
// We know: amountIn = 100000000000000
// reserveOut = ?

// Formula: amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997)
// Solving for reserveOut when we know reserveIn changed by exactly 0.0001 ETH...

const inputAmount = ethers.parseEther('0.0001');
const outputAmount = actualMegaRemoved;

// reserveOut = (amountOut * (reserveIn * 1000 + amountIn * 997)) / (amountIn * 997)
const amountInWithFee = inputAmount * 997n;
const denominator = amountInWithFee;
const numerator = outputAmount * (ethReserveBefore * 1000n + amountInWithFee);

const calculatedReserveOut = numerator / denominator;

console.log(`If input was 0.0001 ETH and output was ${ethers.formatEther(outputAmount)} MEGA:`);
console.log(`MEGA reserve before would need to be: ${ethers.formatEther(calculatedReserveOut)} MEGA`);
console.log(`But we know it was: ${ethers.formatEther(megaReserveBefore)} MEGA`);
console.log(`Difference: ${ethers.formatEther(calculatedReserveOut - megaReserveBefore)} MEGA`);

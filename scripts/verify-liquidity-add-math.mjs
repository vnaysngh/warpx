import { ethers } from 'ethers';

console.log('=== VERIFYING ADD LIQUIDITY MATH ===\n');

// Step 1: Initial liquidity
const initialEth = ethers.parseEther('0.005');
const initialMega = ethers.parseEther('27.5');

console.log('STEP 1: INITIAL LIQUIDITY');
console.log(`ETH: ${ethers.formatEther(initialEth)} ETH`);
console.log(`MEGA: ${ethers.formatEther(initialMega)} MEGA`);
console.log(`Ratio: 1 ETH = ${Number(initialMega) / Number(initialEth)} MEGA\n`);

// Step 2: Add more liquidity
const addEth = ethers.parseEther('0.001');
const addMega = ethers.parseEther('5.5');

console.log('STEP 2: ADDING LIQUIDITY');
console.log(`Adding ETH: ${ethers.formatEther(addEth)} ETH`);
console.log(`Adding MEGA: ${ethers.formatEther(addMega)} MEGA`);
console.log(`Ratio: 1 ETH = ${Number(addMega) / Number(addEth)} MEGA\n`);

// When adding liquidity, the amounts must match the pool ratio
// The contract will accept the amounts but may consume less to maintain ratio
const existingRatio = initialMega * BigInt(1e18) / initialEth; // MEGA per ETH in wei
console.log(`Existing pool ratio: 1 ETH = ${ethers.formatEther(existingRatio)} MEGA`);

const addRatio = addMega * BigInt(1e18) / addEth;
console.log(`Add ratio: 1 ETH = ${ethers.formatEther(addRatio)} MEGA`);
console.log(`Ratios match: ${existingRatio === addRatio ? '✓' : '✗'}\n`);

if (existingRatio === addRatio) {
  console.log('SIMPLE CASE: Ratios match perfectly\n');
  const finalEth = initialEth + addEth;
  const finalMega = initialMega + addMega;

  console.log('EXPECTED RESERVES AFTER STEP 2:');
  console.log(`ETH: ${ethers.formatEther(finalEth)} ETH`);
  console.log(`MEGA: ${ethers.formatEther(finalMega)} MEGA`);
} else {
  console.log('COMPLEX CASE: Ratios differ\n');

  // When ratios differ, the contract will:
  // 1. Calculate optimal amounts based on existing reserves
  // 2. Use the minimum ratio to ensure no price manipulation

  // amountB_optimal = (amountA * reserveB) / reserveA
  const optimalMega = (addEth * initialMega) / initialEth;
  const optimalEth = (addMega * initialEth) / initialMega;

  console.log('ROUTER CALCULATION:');
  console.log(`If adding ${ethers.formatEther(addEth)} ETH:`);
  console.log(`  Optimal MEGA = ${ethers.formatEther(optimalMega)} MEGA`);
  console.log(`  Provided MEGA = ${ethers.formatEther(addMega)} MEGA`);

  console.log(`\nIf adding ${ethers.formatEther(addMega)} MEGA:`);
  console.log(`  Optimal ETH = ${ethers.formatEther(optimalEth)} ETH`);
  console.log(`  Provided ETH = ${ethers.formatEther(addEth)} ETH`);

  // The router will use whichever requires LESS of the second token
  let actualEthAdded, actualMegaAdded;

  if (optimalMega <= addMega) {
    // Use all ETH, less MEGA
    actualEthAdded = addEth;
    actualMegaAdded = optimalMega;
    console.log(`\n→ Will use: ${ethers.formatEther(actualEthAdded)} ETH + ${ethers.formatEther(actualMegaAdded)} MEGA`);
  } else {
    // Use all MEGA, less ETH
    actualEthAdded = optimalEth;
    actualMegaAdded = addMega;
    console.log(`\n→ Will use: ${ethers.formatEther(actualEthAdded)} ETH + ${ethers.formatEther(actualMegaAdded)} MEGA`);
  }

  const finalEth = initialEth + actualEthAdded;
  const finalMega = initialMega + actualMegaAdded;

  console.log('\nEXPECTED RESERVES AFTER STEP 2:');
  console.log(`ETH: ${ethers.formatEther(finalEth)} ETH (raw: ${finalEth.toString()})`);
  console.log(`MEGA: ${ethers.formatEther(finalMega)} MEGA (raw: ${finalMega.toString()})`);
}

console.log('\n=== ACTUAL RESERVES FROM YOUR STEP 2 ===');
console.log('ETH: 0.006 ETH (raw: 6000000000000000)');
console.log('MEGA: 33.0 MEGA (raw: 33000000000000000000)');

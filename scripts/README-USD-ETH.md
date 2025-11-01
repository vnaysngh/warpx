# Add USD/ETH Liquidity Matching GTE Price

This guide shows you how to add USD/ETH liquidity to your WarpX router while matching the exact price from GTE.xyz.

## 📋 Prerequisites

1. **USD token** is already in your token list ✅
   - Address: `0xe9b6e75c243b6100ffcb1c66e8f78f96feea727f`
   - Decimals: 18

2. **You need in your wallet:**
   - USD tokens (amount calculated from GTE reserves)
   - ETH for liquidity (default: 0.0001 ETH)
   - ETH for gas fees

## 🔍 Step 1: Check GTE Price First

Before adding liquidity, check what USD amount you need:

```bash
npx hardhat run scripts/check-gte-price.ts --network megaethTestnet
```

This will show you:
- Current USD/ETH price on GTE
- Exact USD amount needed for your desired ETH
- Verification that the ratio matches

**Example Output:**
```
📊 Current Reserves:
  USD: 2000.0
  ETH: 1.0

💰 Current Prices:
  1 ETH = 2000.0 USD
  1 USD = 0.0005 ETH

🎯 For Your Liquidity Addition:
  You want to add: 0.0001 ETH
  You need to add: 0.2 USD
  This will match GTE's price EXACTLY
```

## 🚀 Step 2: Add Liquidity

Once you confirm you have enough tokens, run:

```bash
npx hardhat run scripts/seed-usd-eth-from-gte.ts --network megaethTestnet
```

### Customize the ETH Amount

```bash
ETH_AMOUNT=0.001 npx hardhat run scripts/seed-usd-eth-from-gte.ts --network megaethTestnet
```

## 🔒 How It Works (Zero Decimal Errors)

The script uses **BigInt math** to ensure perfect precision:

```typescript
// 1. Fetch reserves from GTE's USD/ETH pair
const reserveUSD = await gtePair.getReserves();
const reserveETH = await gtePair.getReserves();

// 2. Calculate EXACT USD needed for your ETH
const yourETH = parseUnits("0.0001", 18);
const yourUSD = (yourETH * reserveUSD) / reserveETH;  // ✨ EXACT!

// 3. Verify the ratio matches
assert((yourETH * reserveUSD) === (yourUSD * reserveETH));

// 4. Add liquidity with exact amounts
await router.addLiquidityETH(
  usdAddress,
  yourUSD,    // Calculated from GTE ratio
  yourUSD,    // Min = exact (first liquidity)
  yourETH,    // Your desired amount
  yourAddress,
  deadline,
  { value: yourETH }
);
```

## ✅ Safety Checks

The script includes multiple safety checks:

1. ✅ **Fetches live reserves** from GTE factory
2. ✅ **Calculates exact ratio** using BigInt (no floating point)
3. ✅ **Verifies balance** before attempting transaction
4. ✅ **Checks for existing pair** on WarpX
5. ✅ **Validates constant product** formula
6. ✅ **Shows price comparison** before and after

## 📊 What Happens

```
Before (GTE):
  USD/ETH Price: 1 ETH = 2000 USD

After (WarpX):
  USD/ETH Price: 1 ETH = 2000 USD  ✅ EXACT MATCH

Result:
  ✅ No arbitrage opportunity
  ✅ Same price across AMMs
  ✅ Zero decimal errors
```

## 🐛 Troubleshooting

### Error: "Insufficient USD balance"
**Solution:** Get more USD tokens or reduce ETH_AMOUNT

### Error: "USD/ETH pair does not exist on GTE"
**Solution:** Verify GTE has this pair, or use different reference

### Error: "Pair already exists"
**Warning:** This adds to existing liquidity. The price will be determined by current reserves, not your input.

## 📝 Script Details

### `check-gte-price.ts`
- **Purpose:** Preview price and amounts
- **Does NOT:** Execute any transactions
- **Use when:** You want to see the price first

### `seed-usd-eth-from-gte.ts`
- **Purpose:** Add liquidity to WarpX
- **Does:** Approves USD + Adds liquidity
- **Use when:** You're ready to add liquidity

## 🎯 Example Workflow

```bash
# 1. Check what you need
npx hardhat run scripts/check-gte-price.ts --network megaethTestnet

# Output shows: "You need to add: 0.2 USD"

# 2. Make sure you have 0.2 USD + 0.0001 ETH

# 3. Add liquidity
npx hardhat run scripts/seed-usd-eth-from-gte.ts --network megaethTestnet

# Output shows: "✅ LIQUIDITY ADDED SUCCESSFULLY!"
```

## 🔗 GTE Reference Addresses

The scripts use these GTE addresses to fetch reserves:

- **GTE Factory:** `0xDB9D607C0D7709C8d2a3a841c970A554AF9B8B45`
- **GTE Router:** `0xA6b579684E943F7D00d616A48cF99b5147fC57A5`

These are hardcoded in the scripts and point to GTE.xyz on MegaETH.

## ⚠️ Important Notes

1. **First liquidity sets the price** - If you're the first LP, your ratio IS the price
2. **Subsequent liquidity must match** - If pair exists, you must add at current ratio
3. **No slippage for first LP** - Use exact amounts as min amounts
4. **Gas fees** - Keep extra ETH for transaction costs (~0.001 ETH should be enough)

## 🎓 Why This Matters

Using this method ensures:
- ✅ Your price matches established AMMs
- ✅ No immediate arbitrage losses
- ✅ Fair initial liquidity for traders
- ✅ Professional deployment standards

---

**Made with ❤️ for perfect price matching**

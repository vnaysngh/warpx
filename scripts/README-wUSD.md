# wUSD Stablecoin Deployment Guide

This guide explains how to deploy wUSD (a dummy stablecoin pegged to USDC) and seed liquidity at real market prices.

## Overview

**wUSD** is a test stablecoin with:
- **Total Supply**: 100 billion tokens
- **Decimals**: 6 (same as USDC)
- **Peg**: 1 wUSD = 1 USD (matches USDC)

The liquidity is seeded at the **current ETH/USDC market price** using Moralis API, so your test pool will have realistic pricing.

---

## Prerequisites

1. **Moralis API Key** - Get one from https://moralis.io
2. **Funded deployer wallet** - Make sure you have enough ETH for:
   - Gas fees (~0.01 ETH)
   - Liquidity seeding (default: 1 ETH)

---

## Step 1: Set Environment Variables

Add to your `.env` file:

```bash
# Required for fetching ETH price
MORALIS_API_KEY=your_moralis_api_key_here

# Optional: Customize liquidity amounts
ETH_AMOUNT=1                    # Amount of ETH to seed (default: 1)
SLIPPAGE_PERCENT=1              # Slippage tolerance (default: 1%)
LIQUIDITY_DEADLINE_MINUTES=10   # Transaction deadline (default: 10 min)

# Optional: Override gas limit for MegaETH
MEGAETH_DEPLOY_GAS_LIMIT=5000000
```

---

## Step 2: Deploy wUSD Token

Run the deployment script:

```bash
yarn deploy-wusd
```

**What this does:**
- Deploys wUSD token with 100 billion supply
- Adds wUSD to your token manifest (`deployments/megaethTestnet.tokens.json`)
- Syncs to frontend (`apps/web/public/deployments/megaethTestnet.tokens.json`)

**Expected output:**
```
==========================================================
🪙  DEPLOY wUSD STABLECOIN
==========================================================
Deployer: 0x...
Deploying wUSD…
  → wUSD deployed at 0x...

==========================================================
✅ wUSD DEPLOYMENT SUMMARY
==========================================================
Token: Wrapped USD (wUSD)
Address: 0x...
Decimals: 6
Total Supply: 100000000000
```

**Important:** After deployment, update the wUSD address in:
- `apps/web/lib/trade/constants.ts` - Replace the zero address with your deployed wUSD address

---

## Step 3: Seed wUSD/ETH Liquidity

Run the liquidity script:

```bash
yarn add-wusd-eth-liquidity
```

**What this does:**
1. Fetches current ETH/USD price from Moralis API (e.g., $3,000)
2. Calculates wUSD amount needed for 1 ETH (e.g., 3,000 wUSD)
3. Creates wUSD/ETH pair on WarpX
4. Seeds liquidity at exact market price

**Expected output:**
```
==========================================================
🪙  ADD wUSD/ETH LIQUIDITY AT MARKET PRICE
==========================================================
📡 Fetching ETH/USD price from Moralis...
✅ Current ETH price: $3000.00

💰 Liquidity Amounts:
  ETH:  1.0
  wUSD: 3000.0

💵 Initial Price Ratio:
  1 ETH = 3000.0 wUSD
  1 wUSD = 0.000333333333 ETH
  (Mirroring real ETH/USDC market price: $3000.00)

...

==========================================================
✅ LIQUIDITY ADDED SUCCESSFULLY!
==========================================================
wUSD/ETH Pair: 0x...
TX Hash: 0x...

📊 Final Pool State:
  Total wUSD: 3000.0
  Total ETH:  1.0
  Price: 1 ETH = 3000.0 wUSD
  (Target was: $3000.00 per ETH)
```

---

## Customizing Amounts

### Seed more liquidity:

```bash
ETH_AMOUNT=5 yarn add-wusd-eth-liquidity
```

This will seed 5 ETH + equivalent wUSD at current market price.

---

## Troubleshooting

### Error: "MORALIS_API_KEY environment variable is required"
- Add your Moralis API key to `.env` file
- Make sure `.env` is in the project root
- Restart your terminal after adding the key

### Error: "Insufficient wUSD balance"
- The deployment gives all 100B wUSD to the deployer
- Make sure you're using the same wallet that deployed wUSD

### Error: "Insufficient ETH balance"
- Get more testnet ETH from the MegaETH faucet
- Reduce `ETH_AMOUNT` if needed

### Error: "Pair already exists"
- The script will add to existing liquidity
- Price may adjust slightly based on existing reserves
- To start fresh, redeploy wUSD with `yarn deploy-wusd`

---

## Testing Swaps

After deploying and seeding liquidity:

1. **Frontend will auto-detect** the new wUSD token
2. **Select wUSD** in the token picker
3. **Try swaps** like:
   - ETH → wUSD (should get ~$3000 worth of wUSD per ETH)
   - wUSD → ETH (should get ~1 ETH per 3000 wUSD)

The pricing should match real-world ETH/USDC rates!

---

## Advanced: Manual Price Configuration

If you want a custom price instead of market price, you can modify `scripts/add-wusd-eth-liquidity.ts`:

```typescript
// Comment out the Moralis API call
// const ethUsdPrice = await fetchEthUsdPrice();

// Set your custom price
const ethUsdPrice = 2500; // $2500 per ETH
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `yarn deploy-wusd` | Deploy wUSD token (100B supply) |
| `yarn add-wusd-eth-liquidity` | Seed wUSD/ETH liquidity at market price |
| `ETH_AMOUNT=5 yarn add-wusd-eth-liquidity` | Seed with custom ETH amount |

---

## Files Created

- `scripts/deploy-wusd.ts` - Token deployment script
- `scripts/add-wusd-eth-liquidity.ts` - Liquidity seeding script
- `deployments/megaethTestnet.tokens.json` - Updated with wUSD
- `apps/web/public/deployments/megaethTestnet.tokens.json` - Frontend token list

---

## Notes

- **wUSD is NOT a real stablecoin** - it's just an ERC20 token for testing
- **No price oracle** - the peg is established by initial liquidity only
- **Price can drift** - as users trade, the price will move based on AMM mechanics
- **For testing only** - don't use in production

Happy testing! 🚀

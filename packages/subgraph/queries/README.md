# WarpX Subgraph Queries

This folder contains all the GraphQL queries for the WarpX subgraph.

## Usage

You can use these queries in:
- The Graph Studio playground
- Your frontend application
- GraphQL clients like Apollo or urql

## Query Files

1. **01-get-all-pairs.graphql** - Get all trading pairs sorted by liquidity
2. **02-get-factory-stats.graphql** - Get protocol-wide statistics
3. **03-get-specific-pair.graphql** - Get detailed info for a specific pair
4. **04-get-recent-swaps.graphql** - Get recent swaps across all pairs
5. **05-get-pair-swaps.graphql** - Get swaps for a specific pair
6. **06-get-recent-mints.graphql** - Get recent liquidity additions
7. **07-get-recent-burns.graphql** - Get recent liquidity removals
8. **08-get-all-tokens.graphql** - Get all tokens sorted by volume
9. **09-get-specific-token.graphql** - Get detailed info for a specific token
10. **10-get-user-positions.graphql** - Get user's liquidity positions
11. **11-get-protocol-daily-stats.graphql** - Get daily protocol statistics
12. **12-get-pair-daily-stats.graphql** - Get daily statistics for a pair
13. **13-get-token-daily-stats.graphql** - Get daily statistics for a token
14. **14-get-recent-transactions.graphql** - Get recent transactions
15. **15-search-pairs-by-token.graphql** - Search pairs containing a token
16. **16-get-top-pairs-by-volume.graphql** - Get top pairs by trading volume
17. **17-get-pair-hourly-stats.graphql** - Get hourly statistics for a pair

## Important Notes

### Address Format
All addresses in queries must be **lowercase**:
- ✅ `0x57a9156f9b3ffa1b603f188f0f64ff93f51c62f8`
- ❌ `0x57A9156f9b3fFa1b603F188f0f64FF93f51C62F8`

### Factory Address
Your factory address: `0x57a9156f9b3ffa1b603f188f0f64ff93f51c62f8`

### Example Pair Addresses
- WARPX/ETH: `0x4787c40081af04395318e2e804f87ca14298317f`
- GTE/ETH: `0xad2667a6781d256aed04984d0797eb7df740318e`
- MEGA/ETH: `0xfbeaa525665d22605179d917e85fb2ba8928f241`

### USD Values
Note: USD values in the subgraph use a 1:1 ratio (1 ETH = $1) as a placeholder. Your frontend should use the GTE API to get real USD prices and calculate actual TVL values.

### What Your Frontend Should Use
From the subgraph queries, your frontend should primarily use:
- ✅ `reserve0`, `reserve1` - Actual token reserves
- ✅ `token0Price`, `token1Price` - Token price ratios
- ✅ `txCount` - Transaction counts
- ✅ Token metadata (symbol, name, decimals)
- ❌ `reserveUSD`, `volumeUSD` - Use GTE API for real USD values instead

## Subgraph Endpoint

After deployment, your subgraph will be available at:
```
https://api.studio.thegraph.com/query/<DEPLOY_KEY>/warpx-testnet/version/latest
```

Replace `<DEPLOY_KEY>` with your actual deployment key from The Graph Studio.

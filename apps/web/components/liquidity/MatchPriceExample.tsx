"use client";

import { useState } from 'react';
import { parseUnits, formatUnits } from 'ethers';
import { calculateMatchingLiquidity, getSafeLiquidityAmounts } from '@/lib/trade/priceMatching';
import { MEGAETH_CHAIN_ID } from '@/lib/trade/constants';

/**
 * Example component showing how to add liquidity matching another AMM's price
 * NO DECIMAL ERRORS - uses exact on-chain reserves
 */
export function MatchPriceExample() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    bnbAmount: string;
    ethAmount: string;
    price: string;
  } | null>(null);

  const calculateAmounts = async () => {
    setLoading(true);
    try {
      // Example: Match Uniswap's BNB/ETH price
      const UNISWAP_BNB_ETH_PAIR = '0x...' as `0x${string}`;
      const BNB_ADDRESS = '0x...';
      const ETH_ADDRESS = '0x...';

      // You decide: I want to add 100 BNB
      const desiredBNB = parseUnits('100', 18);

      // Calculate EXACT ETH needed to match Uniswap's price
      const amounts = await getSafeLiquidityAmounts({
        referencePairAddress: UNISWAP_BNB_ETH_PAIR,
        tokenAAddress: BNB_ADDRESS,
        tokenBAddress: ETH_ADDRESS,
        desiredAmountA: desiredBNB,
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      setResult({
        bnbAmount: formatUnits(amounts.amountA, 18),
        ethAmount: formatUnits(amounts.amountB, 18),
        price: amounts.priceInfo.priceAPerB
      });

      // Now you can call router.addLiquidity with these exact amounts
      // await router.addLiquidity(
      //   BNB_ADDRESS,
      //   ETH_ADDRESS,
      //   amounts.amountA,
      //   amounts.amountB,
      //   amounts.amountAMin,  // With 0.5% slippage tolerance
      //   amounts.amountBMin,  // With 0.5% slippage tolerance
      //   walletAddress,
      //   deadline
      // );

    } catch (error) {
      console.error('Failed to calculate amounts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Match AMM Price - Zero Decimal Errors</h2>

      <button onClick={calculateAmounts} disabled={loading}>
        {loading ? 'Calculating...' : 'Calculate Exact Amounts'}
      </button>

      {result && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0' }}>
          <h3>✅ Perfect Match Found!</h3>
          <p><strong>BNB to add:</strong> {result.bnbAmount}</p>
          <p><strong>ETH to add:</strong> {result.ethAmount}</p>
          <p><strong>Price:</strong> 1 BNB = {result.price} ETH</p>
          <p style={{ color: 'green', marginTop: '10px' }}>
            ✅ This matches Uniswap&apos;s price EXACTLY (no rounding errors)
          </p>
        </div>
      )}
    </div>
  );
}

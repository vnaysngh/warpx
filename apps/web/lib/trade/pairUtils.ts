import type { TokenDescriptor } from "./types";
import type { JsonRpcProvider } from "ethers";
import { getFactory } from "../contracts";

/**
 * Get the pair address for two tokens from the factory contract
 */
export async function getPairAddress(
  tokenA: TokenDescriptor,
  tokenB: TokenDescriptor,
  factoryAddress: string,
  provider: JsonRpcProvider
): Promise<string | null> {
  if (!tokenA || !tokenB || !factoryAddress) {
    return null;
  }

  try {
    const factory = getFactory(factoryAddress, provider);
    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);

    // Check if pair exists (non-zero address)
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    return pairAddress;
  } catch (error) {
    console.error("[pairUtils] failed to get pair address", error);
    return null;
  }
}

/**
 * Find pair address from pools data by token addresses
 * Handles native ETH by using its wrapped address
 */
export function findPairInPools(
  tokenA: TokenDescriptor | null,
  tokenB: TokenDescriptor | null,
  pools: Array<{
    pairAddress: string;
    contractToken0Address: string;
    contractToken1Address: string;
  }>
): string | null {
  if (!tokenA || !tokenB || !pools || pools.length === 0) {
    return null;
  }

  // Use wrapped address for native tokens
  const addressA = (tokenA.isNative && tokenA.wrappedAddress
    ? tokenA.wrappedAddress
    : tokenA.address
  ).toLowerCase();

  const addressB = (tokenB.isNative && tokenB.wrappedAddress
    ? tokenB.wrappedAddress
    : tokenB.address
  ).toLowerCase();

  const pair = pools.find((pool) => {
    const token0 = pool.contractToken0Address.toLowerCase();
    const token1 = pool.contractToken1Address.toLowerCase();

    return (
      (token0 === addressA && token1 === addressB) ||
      (token0 === addressB && token1 === addressA)
    );
  });

  return pair ? pair.pairAddress : null;
}

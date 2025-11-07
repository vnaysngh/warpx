import { Contract, JsonRpcProvider } from "ethers";
import { DEFAULT_TOKEN_DECIMALS } from "@/lib/trade/constants";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export type TokenDetails = {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
};

/**
 * Fetch token details (name, symbol, decimals) from blockchain via RPC
 * @param address Token contract address
 * @param provider JsonRpcProvider instance
 * @returns Token details or null if fetch fails
 */
export async function fetchTokenDetails(
  address: string,
  provider: JsonRpcProvider
): Promise<TokenDetails | null> {
  try {
    const contract = new Contract(address, ERC20_ABI, provider);

    // Fetch all details in parallel for speed
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => "Unknown Token"),
      contract.symbol().catch(() => null),
      contract.decimals().catch(() => DEFAULT_TOKEN_DECIMALS)
    ]);

    // Symbol is required for a valid token
    if (!symbol) {
      console.warn(`[tokenFetch] No symbol for address ${address}`);
      return null;
    }

    return {
      name: String(name || symbol),
      symbol: String(symbol),
      decimals: Number(decimals),
      address
    };
  } catch (error) {
    console.error(`[tokenFetch] Failed to fetch token details for ${address}:`, error);
    return null;
  }
}

/**
 * Check if a string is a valid Ethereum address
 */
export function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

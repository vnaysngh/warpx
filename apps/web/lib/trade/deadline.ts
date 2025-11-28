import type { JsonRpcProvider } from "ethers";

/**
 * Returns a deadline that is guaranteed to be ahead of both the
 * user's local clock and the chain's timestamp. MegaETH's clock can
 * drift ahead of real time, so relying solely on Date.now() causes
 * Router deadline checks to fail with `WarpRouter: EXPIRED`.
 */
export const getSafeDeadline = async (
  provider: JsonRpcProvider | null | undefined,
  minutesAhead: number
): Promise<bigint> => {
  const localNowSeconds = Math.floor(Date.now() / 1000);
  const bufferSeconds = minutesAhead * 60;

  if (!provider) {
    return BigInt(localNowSeconds + bufferSeconds);
  }

  try {
    const latestBlock = await provider.getBlock("latest");
    const chainTimestamp =
      typeof latestBlock?.timestamp === "number"
        ? latestBlock.timestamp
        : Number(latestBlock?.timestamp ?? 0);
    const baseTimestamp =
      chainTimestamp > 0
        ? Math.max(chainTimestamp, localNowSeconds)
        : localNowSeconds;
    return BigInt(baseTimestamp + bufferSeconds);
  } catch (error) {
    console.warn("[deadline] failed to fetch block timestamp", error);
    return BigInt(localNowSeconds + bufferSeconds);
  }
};

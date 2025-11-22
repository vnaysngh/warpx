import { MEGAETH_EXPLORER_BASE_URL } from "./constants";

export const buildExplorerTxUrl = (hash: string | `0x${string}`) =>
  `${MEGAETH_EXPLORER_BASE_URL}/tx/${hash}`;

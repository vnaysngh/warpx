import { Contract, Interface, JsonRpcProvider } from 'ethers';

// Multicall3 ABI - deployed on most chains including testnets
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
];

// Standard Multicall3 address (same on most chains)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

export interface MulticallCall {
  target: string;
  callData: string;
  allowFailure?: boolean;
}

export interface MulticallResult {
  success: boolean;
  returnData: string;
}

/**
 * Execute multiple contract calls in a single transaction using Multicall3
 */
export async function multicall(
  provider: JsonRpcProvider,
  calls: MulticallCall[]
): Promise<MulticallResult[]> {
  if (calls.length === 0) {
    return [];
  }

  const multicall3 = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

  const formattedCalls = calls.map((call) => ({
    target: call.target,
    allowFailure: call.allowFailure ?? true,
    callData: call.callData,
  }));

  try {
    const results = await multicall3.aggregate3.staticCall(formattedCalls);
    return results.map((result: any) => ({
      success: result.success,
      returnData: result.returnData,
    }));
  } catch (error) {
    console.error('[Multicall] Failed to execute multicall:', error);
    throw error;
  }
}

/**
 * Helper to create a multicall for getting reserves from multiple pairs
 */
export function createGetReservesCalls(pairAddresses: string[]): MulticallCall[] {
  const pairInterface = new Interface([
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  ]);

  return pairAddresses.map((address) => ({
    target: address,
    callData: pairInterface.encodeFunctionData('getReserves'),
    allowFailure: true,
  }));
}

/**
 * Helper to create a multicall for getting total supply from multiple pairs
 */
export function createTotalSupplyCalls(pairAddresses: string[]): MulticallCall[] {
  const pairInterface = new Interface(['function totalSupply() external view returns (uint256)']);

  return pairAddresses.map((address) => ({
    target: address,
    callData: pairInterface.encodeFunctionData('totalSupply'),
    allowFailure: true,
  }));
}

/**
 * Helper to create a multicall for getting LP token balances
 */
export function createBalanceOfCalls(
  pairAddresses: string[],
  account: string
): MulticallCall[] {
  const pairInterface = new Interface([
    'function balanceOf(address) external view returns (uint256)',
  ]);

  return pairAddresses.map((address) => ({
    target: address,
    callData: pairInterface.encodeFunctionData('balanceOf', [account]),
    allowFailure: true,
  }));
}

/**
 * Decode reserves from multicall result
 */
export function decodeReserves(returnData: string): {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
} | null {
  if (!returnData || returnData === '0x') return null;

  try {
    const pairInterface = new Interface([
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    ]);
    const decoded = pairInterface.decodeFunctionResult('getReserves', returnData);
    return {
      reserve0: decoded.reserve0,
      reserve1: decoded.reserve1,
      blockTimestampLast: Number(decoded.blockTimestampLast),
    };
  } catch (error) {
    console.error('[Multicall] Failed to decode reserves:', error);
    return null;
  }
}

/**
 * Decode total supply from multicall result
 */
export function decodeTotalSupply(returnData: string): bigint | null {
  if (!returnData || returnData === '0x') return null;

  try {
    const pairInterface = new Interface(['function totalSupply() external view returns (uint256)']);
    const decoded = pairInterface.decodeFunctionResult('totalSupply', returnData);
    return decoded[0];
  } catch (error) {
    console.error('[Multicall] Failed to decode totalSupply:', error);
    return null;
  }
}

/**
 * Decode balance from multicall result
 */
export function decodeBalance(returnData: string): bigint | null {
  if (!returnData || returnData === '0x') return null;

  try {
    const pairInterface = new Interface([
      'function balanceOf(address) external view returns (uint256)',
    ]);
    const decoded = pairInterface.decodeFunctionResult('balanceOf', returnData);
    return decoded[0];
  } catch (error) {
    console.error('[Multicall] Failed to decode balance:', error);
    return null;
  }
}

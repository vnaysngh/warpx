import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  JsonRpcSigner,
} from "ethers";
import { warpRouterAbi } from "./abis/router";
import { erc20Abi } from "./abis/erc20";
import { wmegaAbi } from "./abis/wmega";
import { factoryAbi } from "./abis/factory";
import { pairAbi } from "./abis/pair";

export type RouterContract = Contract & {
  addLiquidity: (...args: any[]) => Promise<any>;
  addLiquidityETH: (...args: any[]) => Promise<any>;
  removeLiquidity: (...args: any[]) => Promise<any>;
  swapExactTokensForTokens: (...args: any[]) => Promise<any>;
  swapExactTokensForTokensSupportingFeeOnTransferTokens: (
    ...args: any[]
  ) => Promise<any>;
  swapExactETHForTokens: (...args: any[]) => Promise<any>;
};

export type FactoryContract = Contract & {
  getPair: (tokenA: string, tokenB: string) => Promise<string>;
};

export type PairContract = Contract & {
  getReserves: () => Promise<[bigint, bigint, bigint]>;
  token0: () => Promise<string>;
  token1: () => Promise<string>;
};

export type ERC20Contract = Contract & {
  decimals: () => Promise<number>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
  approve: (spender: string, amount: bigint) => Promise<any>;
  balanceOf: (owner: string) => Promise<bigint>;
  symbol: () => Promise<string>;
  name: () => Promise<string>;
};

export type WMegaContract = Contract & {
  deposit: (overrides?: { value: bigint; gasLimit?: bigint }) => Promise<any>;
  withdraw: (
    amount: bigint,
    overrides?: { gasLimit?: bigint },
  ) => Promise<any>;
  allowance: (owner: string, spender: string) => Promise<bigint>;
  approve: (spender: string, amount: bigint) => Promise<any>;
};

type SignerOrProvider = JsonRpcSigner | BrowserProvider | JsonRpcProvider;

export const getRouter = (
  address: string,
  signerOrProvider: SignerOrProvider,
) => new Contract(address, warpRouterAbi, signerOrProvider) as RouterContract;

export const getToken = (
  address: string,
  signerOrProvider: SignerOrProvider,
) => new Contract(address, erc20Abi, signerOrProvider) as ERC20Contract;

export const getFactory = (
  address: string,
  signerOrProvider: SignerOrProvider,
) => new Contract(address, factoryAbi, signerOrProvider) as FactoryContract;

export const getPair = (
  address: string,
  signerOrProvider: SignerOrProvider,
) => new Contract(address, pairAbi, signerOrProvider) as PairContract;

export const getWrappedMega = (
  address: string,
  signerOrProvider: SignerOrProvider,
) =>
  new Contract(address, wmegaAbi, signerOrProvider) as WMegaContract;

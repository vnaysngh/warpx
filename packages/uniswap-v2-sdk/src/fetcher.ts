import { Contract, JsonRpcProvider, ZeroAddress } from "ethers";
import { CurrencyAmount, Token } from "@megaeth/uniswap-sdk-core";
import { Pair } from "./pair";

const FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    name: "getPair",
    outputs: [{ name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

const PAIR_ABI = [
  {
    inputs: [],
    name: "getReserves",
    outputs: [
      { name: "_reserve0", type: "uint112" },
      { name: "_reserve1", type: "uint112" },
      { name: "_blockTimestampLast", type: "uint32" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export type FetchPairOptions = {
  factoryAddress: string;
};

export class Fetcher {
  static async fetchPairData(
    tokenA: Token,
    tokenB: Token,
    provider: JsonRpcProvider,
    options: FetchPairOptions
  ): Promise<Pair | null> {
    if (tokenA.equals(tokenB)) {
      throw new Error("Tokens must be different");
    }
    const factory = new Contract(options.factoryAddress, FACTORY_ABI, provider);
    const [token0, token1] = tokenA.sortsBefore(tokenB)
      ? [tokenA, tokenB]
      : [tokenB, tokenA];

    const pairAddress = await factory.getPair(token0.address, token1.address);
    if (pairAddress === ZeroAddress) {
      return null;
    }

    const pairContract = new Contract(pairAddress, PAIR_ABI, provider);
    const [reserves, totalSupply] = await Promise.all([
      pairContract.getReserves(),
      pairContract.totalSupply()
    ]);

    return new Pair(
      CurrencyAmount.fromRawAmount(token0, reserves._reserve0 ?? reserves[0]),
      CurrencyAmount.fromRawAmount(token1, reserves._reserve1 ?? reserves[1]),
      pairAddress,
      BigInt(totalSupply)
    );
  }
}

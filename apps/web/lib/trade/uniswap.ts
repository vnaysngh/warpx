"use client";

import type { JsonRpcProvider } from "ethers";
import {
  ChainId,
  CurrencyAmount,
  Percent,
  Token
} from "@megaeth/uniswap-sdk-core";
import {
  Fetcher,
  Pair,
  Route,
  Trade,
  TradeType
} from "@megaeth/uniswap-v2-sdk";
import type { TokenDescriptor } from "./types";
import { MEGAETH_CHAIN_ID } from "./constants";

const MEGAETH_NUMERIC_CHAIN_ID = Number(MEGAETH_CHAIN_ID);

export const MEGAETH_CHAIN_ID_ENUM =
  MEGAETH_NUMERIC_CHAIN_ID === ChainId.MEGAETH_TESTNET
    ? ChainId.MEGAETH_TESTNET
    : (MEGAETH_NUMERIC_CHAIN_ID as ChainId);

export const toSdkToken = (token: TokenDescriptor): Token =>
  new Token(
    MEGAETH_CHAIN_ID_ENUM,
    token.address,
    token.decimals,
    token.symbol,
    token.name
  );

export const fetchPair = async (
  tokenA: Token,
  tokenB: Token,
  provider: JsonRpcProvider,
  factoryAddress: string
): Promise<Pair | null> => {
  return Fetcher.fetchPairData(tokenA, tokenB, provider, {
    factoryAddress
  });
};

export const buildRoute = (pair: Pair, input: Token, output: Token): Route =>
  new Route([pair], input, output);

export const createTradeExactIn = (
  pair: Pair,
  input: Token,
  output: Token,
  amountInRaw: bigint
): Trade => {
  const route = buildRoute(pair, input, output);
  const inputAmount = CurrencyAmount.fromRawAmount(input, amountInRaw);
  return Trade.exactIn(route, inputAmount);
};

export const createTradeExactOut = (
  pair: Pair,
  input: Token,
  output: Token,
  amountOutRaw: bigint
): Trade => {
  const route = buildRoute(pair, input, output);
  const outputAmount = CurrencyAmount.fromRawAmount(output, amountOutRaw);
  return Trade.exactOut(route, outputAmount);
};

export const bpsToPercent = (bps: bigint | number): Percent =>
  new Percent(BigInt(bps), 10000n);

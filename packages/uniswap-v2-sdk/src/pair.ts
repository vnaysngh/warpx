import { CurrencyAmount, Price, Token } from "@megaeth/uniswap-sdk-core";

const ZERO = 0n;
const FEE_NUMERATOR = 997n;
const FEE_DENOMINATOR = 1000n;

export class Pair {
  readonly token0: Token;
  readonly token1: Token;
  readonly reserve0: CurrencyAmount;
  readonly reserve1: CurrencyAmount;
  readonly address: string;
  readonly liquidityTokenTotalSupply?: bigint;

  constructor(
    tokenAmountA: CurrencyAmount,
    tokenAmountB: CurrencyAmount,
    address: string,
    liquidityTokenTotalSupply?: bigint
  ) {
    const tokenA = tokenAmountA.token;
    const tokenB = tokenAmountB.token;
    if (tokenA.equals(tokenB)) {
      throw new Error("Token amounts must have different tokens");
    }

    const { token0, token1, reserve0, reserve1 } = tokenA.sortsBefore(tokenB)
      ? {
          token0: tokenA,
          token1: tokenB,
          reserve0: tokenAmountA,
          reserve1: tokenAmountB
        }
      : {
          token0: tokenB,
          token1: tokenA,
          reserve0: tokenAmountB,
          reserve1: tokenAmountA
        };

    this.token0 = token0;
    this.token1 = token1;
    this.reserve0 = reserve0;
    this.reserve1 = reserve1;
    this.address = address.toLowerCase();
    this.liquidityTokenTotalSupply = liquidityTokenTotalSupply;
  }

  involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1);
  }

  reserveOf(token: Token): CurrencyAmount {
    if (token.equals(this.token0)) return this.reserve0;
    if (token.equals(this.token1)) return this.reserve1;
    throw new Error("Token does not belong to this pair");
  }

  priceOf(token: Token): Price {
    if (token.equals(this.token0)) {
      return new Price(this.token0, this.token1, this.reserve0.raw, this.reserve1.raw).invert();
    }
    if (token.equals(this.token1)) {
      return new Price(this.token1, this.token0, this.reserve1.raw, this.reserve0.raw).invert();
    }
    throw new Error("Token does not belong to this pair");
  }

  get token0Price(): Price {
    return new Price(this.token0, this.token1, this.reserve0.raw, this.reserve1.raw).invert();
  }

  get token1Price(): Price {
    return new Price(this.token1, this.token0, this.reserve1.raw, this.reserve0.raw).invert();
  }

  getOutputAmount(inputAmount: CurrencyAmount): [CurrencyAmount, Pair] {
    if (!this.involvesToken(inputAmount.token)) {
      throw new Error("Input token not in pair");
    }

    if (this.reserve0.raw <= ZERO || this.reserve1.raw <= ZERO) {
      throw new Error("Insufficient reserves");
    }

    const outputToken = inputAmount.token.equals(this.token0)
      ? this.token1
      : this.token0;
    const inputReserve = this.reserveOf(inputAmount.token).raw;
    const outputReserve = this.reserveOf(outputToken).raw;

    const inputAmountWithFee =
      BigInt(inputAmount.raw) * FEE_NUMERATOR;
    const numerator = inputAmountWithFee * BigInt(outputReserve);
    const denominator =
      BigInt(inputReserve) * FEE_DENOMINATOR + inputAmountWithFee;
    const outputRaw = numerator / denominator;

    if (outputRaw <= ZERO) {
      throw new Error("Insufficient output amount");
    }

    const newInputReserve = inputReserve + inputAmount.raw;
    const newOutputReserve = outputReserve - outputRaw;

    const newReserve0 = inputAmount.token.equals(this.token0)
      ? newInputReserve
      : newOutputReserve;
    const newReserve1 = inputAmount.token.equals(this.token0)
      ? newOutputReserve
      : newInputReserve;

    return [
      CurrencyAmount.fromRawAmount(outputToken, outputRaw),
      new Pair(
        CurrencyAmount.fromRawAmount(this.token0, newReserve0),
        CurrencyAmount.fromRawAmount(this.token1, newReserve1),
        this.address,
        this.liquidityTokenTotalSupply
      )
    ];
  }

  getInputAmount(outputAmount: CurrencyAmount): [CurrencyAmount, Pair] {
    if (!this.involvesToken(outputAmount.token)) {
      throw new Error("Output token not in pair");
    }

    if (this.reserve0.raw <= ZERO || this.reserve1.raw <= ZERO) {
      throw new Error("Insufficient reserves");
    }

    const inputToken = outputAmount.token.equals(this.token0)
      ? this.token1
      : this.token0;
    const outputReserve = this.reserveOf(outputAmount.token).raw;
    const inputReserve = this.reserveOf(inputToken).raw;

    if (outputAmount.raw >= outputReserve) {
      throw new Error("Insufficient liquidity");
    }

    const numerator =
      BigInt(inputReserve) * BigInt(outputAmount.raw) * FEE_DENOMINATOR;
    const denominator =
      (BigInt(outputReserve) - BigInt(outputAmount.raw)) * FEE_NUMERATOR;
    const inputRaw = numerator / denominator + 1n;

    const newInputReserve = inputReserve + inputRaw;
    const newOutputReserve = outputReserve - outputAmount.raw;

    const newReserve0 = outputAmount.token.equals(this.token1)
      ? newInputReserve
      : newOutputReserve;
    const newReserve1 = outputAmount.token.equals(this.token1)
      ? newOutputReserve
      : newInputReserve;

    return [
      CurrencyAmount.fromRawAmount(inputToken, inputRaw),
      new Pair(
        CurrencyAmount.fromRawAmount(this.token0, newReserve0),
        CurrencyAmount.fromRawAmount(this.token1, newReserve1),
        this.address,
        this.liquidityTokenTotalSupply
      )
    ];
  }
}

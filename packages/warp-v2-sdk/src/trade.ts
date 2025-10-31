import {
  CurrencyAmount,
  Fraction,
  Percent,
  Price,
  Token
} from "@megaeth/warp-sdk-core";
import { Pair } from "./pair";
import { Route } from "./route";

export enum TradeType {
  EXACT_INPUT,
  EXACT_OUTPUT
}

export class Trade {
  readonly route: Route;
  readonly tradeType: TradeType;
  readonly inputAmount: CurrencyAmount;
  readonly outputAmount: CurrencyAmount;
  readonly executionPrice: Price;
  readonly nextMidPrice: Price;
  readonly priceImpact: Percent;

  private constructor(
    route: Route,
    tradeType: TradeType,
    inputAmount: CurrencyAmount,
    outputAmount: CurrencyAmount,
    nextPairs: Pair[]
  ) {
    this.route = route;
    this.tradeType = tradeType;
    this.inputAmount = inputAmount;
    this.outputAmount = outputAmount;
    this.executionPrice = new Price(
      inputAmount.token,
      outputAmount.token,
      inputAmount.raw,
      outputAmount.raw
    ).invert();

    const nextRoute = new Route(nextPairs, route.input, route.output);
    this.nextMidPrice = nextRoute.midPrice;

    const priceRatio = new Fraction(
      this.executionPrice.numerator,
      this.executionPrice.denominator
    ).divide(
      new Fraction(route.midPrice.numerator, route.midPrice.denominator)
    );
    const impactFraction = priceRatio.subtract(1);
    this.priceImpact = new Percent(impactFraction.numerator, impactFraction.denominator);
  }

  static exactIn(route: Route, amountIn: CurrencyAmount): Trade {
    let currentAmount = amountIn;
    const outputPairs: Pair[] = [];

    for (const pair of route.pairs) {
      const [outputAmount, nextPair] = pair.getOutputAmount(currentAmount);
      currentAmount = outputAmount;
      outputPairs.push(nextPair);
    }

    const lastOutput = currentAmount;
    return new Trade(
      route,
      TradeType.EXACT_INPUT,
      amountIn,
      lastOutput,
      outputPairs
    );
  }

  static exactOut(route: Route, amountOut: CurrencyAmount): Trade {
    let currentAmount = amountOut;
    const outputPairs: Pair[] = [];

    for (let i = route.pairs.length - 1; i >= 0; i -= 1) {
      const pair = route.pairs[i];
      const [inputAmount, nextPair] = pair.getInputAmount(currentAmount);
      currentAmount = inputAmount;
      outputPairs.unshift(nextPair);
    }

    const firstInput = currentAmount;
    return new Trade(
      route,
      TradeType.EXACT_OUTPUT,
      firstInput,
      amountOut,
      outputPairs
    );
  }

  minimumAmountOut(slippageTolerance: Percent): CurrencyAmount {
    if (this.tradeType !== TradeType.EXACT_INPUT) {
      throw new Error("minimumAmountOut only meaningful for exact input trades");
    }
    const slippageFraction = new Fraction(
      slippageTolerance.denominator - slippageTolerance.numerator,
      slippageTolerance.denominator
    );
    const amount = this.outputAmount.raw * slippageFraction.numerator / slippageFraction.denominator;
    return CurrencyAmount.fromRawAmount(this.outputAmount.token, amount);
  }

  maximumAmountIn(slippageTolerance: Percent): CurrencyAmount {
    if (this.tradeType !== TradeType.EXACT_OUTPUT) {
      throw new Error("maximumAmountIn only meaningful for exact output trades");
    }
    const slippageFraction = new Fraction(
      slippageTolerance.denominator + slippageTolerance.numerator,
      slippageTolerance.denominator
    );
    const amount = this.inputAmount.raw * slippageFraction.numerator / slippageFraction.denominator;
    return CurrencyAmount.fromRawAmount(this.inputAmount.token, amount);
  }
}

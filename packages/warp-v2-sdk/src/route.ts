import { Price, Token } from "@megaeth/warp-sdk-core";
import { Pair } from "./pair";

export class Route {
  readonly pairs: Pair[];
  readonly path: Token[];
  readonly input: Token;
  readonly output: Token;

  constructor(pairs: Pair[], input: Token, output?: Token) {
    if (pairs.length === 0) {
      throw new Error("Route must have at least one pair");
    }
    this.pairs = pairs;
    this.input = input;

    const tokens: Token[] = [input];
    for (const [index, pair] of pairs.entries()) {
      const currentInput = tokens[index];
      if (!pair.involvesToken(currentInput)) {
        throw new Error("Route pair does not involve input token");
      }
      const nextToken = pair.token0.equals(currentInput)
        ? pair.token1
        : pair.token0;
      tokens.push(nextToken);
    }

    this.path = tokens;
    this.output = output ?? tokens[tokens.length - 1];
  }

  get midPrice(): Price {
    const prices = this.pairs.map((pair, index) =>
      pair.priceOf(this.path[index])
    );
    const [first, ...rest] = prices;
    return rest.reduce((acc, price) => acc.multiply(price), first);
  }

  get midPriceInverted(): Price {
    return this.midPrice.invert();
  }
}

import { Fraction } from "./fraction";
import { Token } from "./token";

export class Price extends Fraction {
  readonly baseToken: Token;
  readonly quoteToken: Token;

  constructor(baseToken: Token, quoteToken: Token, numerator: bigint, denominator: bigint) {
    super(numerator, denominator);
    this.baseToken = baseToken;
    this.quoteToken = quoteToken;
  }

  invert(): Price {
    return new Price(this.quoteToken, this.baseToken, this.denominator, this.numerator);
  }

  multiply(other: Price): Price {
    if (!this.quoteToken.equals(other.baseToken)) {
      throw new Error("Price multiplication token mismatch");
    }
    const fraction = super.multiply(other);
    return new Price(this.baseToken, other.quoteToken, fraction.numerator, fraction.denominator);
  }
}

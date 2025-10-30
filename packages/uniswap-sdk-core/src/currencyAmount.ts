import { formatUnits, parseUnits } from "ethers";
import { Fraction } from "./fraction";
import { Token } from "./token";

export class CurrencyAmount {
  readonly token: Token;
  readonly raw: bigint;

  private constructor(token: Token, raw: bigint) {
    this.token = token;
    this.raw = raw;
  }

  static fromRawAmount(token: Token, rawAmount: bigint | number | string): CurrencyAmount {
    return new CurrencyAmount(token, BigInt(rawAmount));
  }

  static fromDecimal(token: Token, value: string | number): CurrencyAmount {
    const formatted = typeof value === "number" ? value.toString() : value;
    const parsed = parseUnits(formatted, token.decimals);
    return new CurrencyAmount(token, parsed);
  }

  get quotient(): bigint {
    return this.raw;
  }

  toExact(precision = 6): string {
    const value = formatUnits(this.raw, this.token.decimals);
    if (precision === undefined) {
      return value;
    }
    const [integer, fraction = ""] = value.split(".");
    if (!fraction.length) return integer;
    const trimmed = fraction.slice(0, precision).replace(/0+$/, "");
    return trimmed.length ? `${integer}.${trimmed}` : integer;
  }

  toFraction(): Fraction {
    const denominator = 10n ** BigInt(this.token.decimals);
    return new Fraction(this.raw, denominator);
  }

  add(other: CurrencyAmount): CurrencyAmount {
    if (!this.token.equals(other.token)) {
      throw new Error("Currency amounts must have the same token");
    }
    return new CurrencyAmount(this.token, this.raw + other.raw);
  }

  subtract(other: CurrencyAmount): CurrencyAmount {
    if (!this.token.equals(other.token)) {
      throw new Error("Currency amounts must have the same token");
    }
    if (other.raw > this.raw) {
      throw new Error("Resulting currency amount would be negative");
    }
    return new CurrencyAmount(this.token, this.raw - other.raw);
  }
}

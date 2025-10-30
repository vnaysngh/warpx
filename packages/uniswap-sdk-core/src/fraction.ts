export class Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;

  constructor(numerator: bigint | number | string, denominator: bigint | number | string = 1n) {
    const num = BigInt(numerator);
    const den = BigInt(denominator);
    if (den === 0n) {
      throw new Error("Denominator cannot be zero");
    }
    const sign = den < 0n ? -1n : 1n;
    this.numerator = num * sign;
    this.denominator = den * sign;
  }

  protected operate(other: Fraction | bigint | number | string, operator: "add" | "sub" | "mul" | "div"): Fraction {
    const rhs = other instanceof Fraction ? other : new Fraction(other);
    switch (operator) {
      case "add":
        return new Fraction(
          this.numerator * rhs.denominator + rhs.numerator * this.denominator,
          this.denominator * rhs.denominator
        );
      case "sub":
        return new Fraction(
          this.numerator * rhs.denominator - rhs.numerator * this.denominator,
          this.denominator * rhs.denominator
        );
      case "mul":
        return new Fraction(this.numerator * rhs.numerator, this.denominator * rhs.denominator);
      case "div":
        if (rhs.numerator === 0n) {
          throw new Error("Division by zero");
        }
        return new Fraction(this.numerator * rhs.denominator, this.denominator * rhs.numerator);
      default:
        throw new Error(`Unsupported operator ${operator as string}`);
    }
  }

  add(other: Fraction | bigint | number | string): Fraction {
    return this.operate(other, "add");
  }

  subtract(other: Fraction | bigint | number | string): Fraction {
    return this.operate(other, "sub");
  }

  multiply(other: Fraction | bigint | number | string): Fraction {
    return this.operate(other, "mul");
  }

  divide(other: Fraction | bigint | number | string): Fraction {
    return this.operate(other, "div");
  }

  invert(): Fraction {
    if (this.numerator === 0n) {
      throw new Error("Cannot invert zero");
    }
    return new Fraction(this.denominator, this.numerator);
  }

  quotient(): bigint {
    return this.numerator / this.denominator;
  }

  remainder(): bigint {
    return this.numerator % this.denominator;
  }

  toFixed(decimalPlaces: number): string {
    if (decimalPlaces < 0) {
      throw new Error("decimalPlaces must be non-negative");
    }

    const scale = 10n ** BigInt(decimalPlaces);
    const isNegative = this.numerator < 0n;
    const absNumerator = isNegative ? -this.numerator : this.numerator;

    const scaled = (absNumerator * scale) / this.denominator;
    const integerPart = scaled / scale;
    const fractionPart = scaled % scale;

    const integerString = integerPart.toString();

    if (decimalPlaces === 0) {
      if (integerPart === 0n) {
        return "0";
      }
      return isNegative ? `-${integerString}` : integerString;
    }

    const fractionString = fractionPart
      .toString()
      .padStart(decimalPlaces, "0")
      .replace(/0+$/, "");

    const base =
      fractionString.length > 0 ? `${integerString}.${fractionString}` : integerString;

    if (base === "0") {
      return "0";
    }

    return isNegative ? `-${base}` : base;
  }

  toSignificant(significantDigits: number): string {
    if (significantDigits <= 0) {
      throw new Error("significantDigits must be positive");
    }
    // Approximate by using fixed decimals slightly above requested significant digits
    const decimals = Math.max(significantDigits, 6);
    const fixed = this.toFixed(decimals);
    const trimmed = fixed.replace(/(?:\.0+|(?:(\.\d*[1-9]))0+)$/, "$1");
    const [intPart, fracPart = ""] = trimmed.split(".");
    if (intPart !== "0") {
      if (intPart.length >= significantDigits) {
        return intPart;
      }
      return [
        intPart,
        fracPart.slice(0, Math.max(0, significantDigits - intPart.length))
      ]
        .filter(Boolean)
        .join(".");
    }
    const trimmedFrac = fracPart.replace(/^0+/, "");
    return trimmedFrac.length > significantDigits
      ? `0.${trimmedFrac.slice(0, significantDigits)}`
      : trimmedFrac
      ? `0.${trimmedFrac}`
      : "0";
  }
}

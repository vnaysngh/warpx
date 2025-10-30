import { Fraction } from "./fraction";

export class Percent extends Fraction {
  constructor(
    numerator: bigint | number | string,
    denominator: bigint | number | string = 100n
  ) {
    super(numerator, denominator);
  }
}

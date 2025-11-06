import { expect } from "chai";

describe("Fee configuration", () => {
  it("uses a 0.3% swap fee", async () => {
    const { FEES_DENOMINATOR, FEES_NUMERATOR } = await import(
      "../apps/web/lib/trade/constants.ts"
    );
    expect(FEES_DENOMINATOR).to.equal(1000n);
    expect(FEES_NUMERATOR).to.equal(997n);
    const feeFraction =
      Number(FEES_DENOMINATOR - FEES_NUMERATOR) / Number(FEES_DENOMINATOR);
    expect(feeFraction).to.equal(0.003);
  });
});

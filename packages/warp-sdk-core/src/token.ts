import { ChainId } from "./chainId";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export class Token {
  readonly chainId: ChainId | number;
  readonly address: string;
  readonly decimals: number;
  readonly symbol?: string;
  readonly name?: string;

  constructor(
    chainId: ChainId | number,
    address: string,
    decimals: number,
    symbol?: string,
    name?: string
  ) {
    if (!ADDRESS_REGEX.test(address)) {
      throw new Error(`Invalid token address: ${address}`);
    }
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error(`Invalid token decimals: ${decimals}`);
    }
    this.chainId = chainId;
    this.address = address.toLowerCase();
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
  }

  equals(other: Token): boolean {
    return (
      this === other ||
      (this.chainId === other.chainId && this.address === other.address)
    );
  }

  sortsBefore(other: Token): boolean {
    if (this.chainId !== other.chainId) {
      throw new Error("Tokens must be on the same chain to compare");
    }
    if (this.address === other.address) {
      throw new Error("Addresses should be distinct");
    }
    return this.address.toLowerCase() < other.address.toLowerCase();
  }
}

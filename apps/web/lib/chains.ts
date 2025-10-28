import type { Chain } from "wagmi/chains";

export const megaethTestnet: Chain = {
  id: 6342,
  name: "MegaETH Testnet",
  nativeCurrency: {
    name: "MegaETH",
    symbol: "MEGA",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://carrot.megaeth.com/rpc"],
    },
    public: {
      http: ["https://carrot.megaeth.com/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "MegaETH Explorer",
      url: "https://explorer.megaeth.com",
    },
  },
  testnet: true,
};

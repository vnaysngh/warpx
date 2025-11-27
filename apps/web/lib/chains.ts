import type { Chain } from "wagmi/chains";

export const megaethTestnet: Chain = {
  id: 6343,
  name: "MegaETH Testnet V2",
  nativeCurrency: {
    name: "MegaETH",
    symbol: "MEGA",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [`https://6343.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}`]
    },
    public: {
      http: [`https://6343.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}`]
    }
  },
  blockExplorers: {
    default: {
      name: "MegaETH Explorer",
      url: "https://megaeth-testnet-v2.blockscout.com"
    }
  },
  testnet: true
};

import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit-common";
import { megaethTestnet } from "./chains";

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for WalletConnect AppKit."
  );
}

const metadata = {
  name: "WarpX Terminal",
  description: "MegaETH v2 AMM desk",
  url: "https://megaeth.example",
  icons: ["https://assets.walletconnect.com/icon.png"]
};

const megaethNetwork: AppKitNetwork = {
  ...megaethTestnet,
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${megaethTestnet.id}`
};

const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: [megaethNetwork]
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appKit = createAppKit({
  projectId: PROJECT_ID,
  metadata,
  themeMode: "dark",
  networks: [megaethNetwork],
  defaultNetwork: megaethNetwork,
  adapters: [wagmiAdapter],
  features: {
    email: false,
    socials: false,
    emailShowWallets: false,
    swaps: false,
    onramp: false
  },
  enableWalletConnect: true,
  enableInjected: true,
  enableCoinbase: true,
  allowUnsupportedChain: true
});

export const walletProjectId = PROJECT_ID;

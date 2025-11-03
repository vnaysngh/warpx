import { useEffect, useMemo, useState } from "react";
import type { Eip1193Provider, JsonRpcSigner, BrowserProvider } from "ethers";
import { BrowserProvider as EthersBrowserProvider } from "ethers";
import type { UseWalletClientReturnType } from "wagmi";
import { MEGAETH_CHAIN_ID } from "@/lib/trade/constants";

type Transport = {
  type?: string;
  value?: Eip1193Provider;
  request?: Eip1193Provider["request"];
};

type WalletClientData = UseWalletClientReturnType["data"];

export function useWalletProvider(
  walletClient: WalletClientData
): {
  walletProvider: BrowserProvider | null;
  walletSigner: JsonRpcSigner | null;
} {
  const walletProvider = useMemo(() => {
    if (!walletClient) return null;

    const transport = walletClient.transport as unknown as Transport;
    const provider: Eip1193Provider | undefined =
      transport?.type === "custom"
        ? transport.value
        : (transport as unknown as Eip1193Provider);

    if (!provider || typeof provider.request !== "function") {
      console.warn(
        "[wallet] Unsupported wallet transport, cannot create provider."
      );
      return null;
    }

    return new EthersBrowserProvider(
      provider,
      walletClient.chain?.id ?? Number(MEGAETH_CHAIN_ID)
    );
  }, [walletClient]);

  const [walletSigner, setWalletSigner] = useState<JsonRpcSigner | null>(null);

  useEffect(() => {
    let cancelled = false;

    const updateSigner = async () => {
      if (!walletProvider) {
        if (!cancelled) {
          setWalletSigner(null);
        }
        return;
      }

      try {
        const resolvedSigner = await walletProvider.getSigner();
        if (!cancelled) {
          setWalletSigner(resolvedSigner);
        }
      } catch (err) {
        console.error("[wallet] Failed to resolve signer", err);
        if (!cancelled) {
          setWalletSigner(null);
        }
      }
    };

    updateSigner();

    return () => {
      cancelled = true;
    };
  }, [walletProvider]);

  return { walletProvider, walletSigner };
}

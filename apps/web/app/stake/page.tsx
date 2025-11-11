"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import styles from "./page.module.css";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { ToastContainer } from "@/components/Toast";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useStakingManifest } from "@/hooks/useStakingManifest";
import {
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID,
  TOKEN_CATALOG
} from "@/lib/trade/constants";
import type { TokenManifest } from "@/lib/trade/types";
import { appKit } from "@/lib/wagmi";
import { parseErrorMessage } from "@/lib/trade/errors";
import { StakingCard } from "@/components/staking/StakingCard";
import { AnimatedBackground } from "@/components/background/AnimatedBackground";

type TokenMeta = {
  symbol: string;
  name: string;
  decimals: number;
};

type TokenMap = Record<string, TokenMeta>;

export default function StakePage() {
  const { address, chain, status } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { deployment } = useDeploymentManifest();
  const { toasts, removeToast, showError, showSuccess, showLoading } =
    useToasts();
  const { programs, loading } = useStakingManifest(deployment?.network ?? null);

  const initialMap = useMemo(() => {
    const map: TokenMap = {};
    TOKEN_CATALOG.forEach((token) => {
      if (!token.address) return;
      map[token.address.toLowerCase()] = {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals
      };
    });
    return map;
  }, []);

  const [tokenMap, setTokenMap] = useState<TokenMap>(initialMap);

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const networkError = useMemo(() => {
    if (!walletAccount || !chain) return null;
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      return `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`;
    }
    return null;
  }, [walletAccount, chain]);

  const ready = Boolean(
    walletAccount && chain && chain.id === Number(MEGAETH_CHAIN_ID)
  );

  const switchToMegaEth = useCallback(async () => {
    if (!switchChainAsync) {
      showError("Wallet does not support programmatic chain switching.");
      return;
    }
    try {
      showLoading("Switching network...");
      await switchChainAsync({ chainId: Number(MEGAETH_CHAIN_ID) });
      showSuccess("Network switched successfully.");
    } catch (switchError) {
      console.error("[stake] network switch failed", switchError);
      showError(parseErrorMessage(switchError));
    }
  }, [switchChainAsync, showError, showLoading, showSuccess]);

  const handleConnectWallet = useCallback(() => {
    appKit.open();
  }, []);

  useEffect(() => {
    if (!deployment?.network) return;
    let cancelled = false;

    const fetchTokens = async () => {
      const manifestPaths = [
        `/deployments/${deployment.network}.tokens.json`,
        `/deployments/${deployment.network.toLowerCase()}.tokens.json`
      ];

      for (const manifestPath of manifestPaths) {
        try {
          const response = await fetch(manifestPath, { cache: "no-store" });
          if (!response.ok) continue;
          const manifest = (await response.json()) as TokenManifest;
          if (cancelled) return;
          const map: TokenMap = { ...initialMap };
          manifest.tokens?.forEach((token) => {
            if (!token.address) return;
            map[token.address.toLowerCase()] = {
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
            };
          });
          setTokenMap(map);
          return;
        } catch (error) {
          console.warn(
            "[stake] token manifest fetch failed",
            manifestPath,
            error
          );
        }
      }
    };

    fetchTokens();
    return () => {
      cancelled = true;
    };
  }, [deployment?.network, initialMap]);

  return (
    <>
      <AnimatedBackground variant="stake" />

      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <div className={styles.page}>
        {/* <section className={styles.intro}>
          <h1 className={styles.title}>Stake WarpX LP tokens</h1>
          <p className={styles.subtitle}>
            Stake your WarpX LP positions, withdraw, or claim in a couple of
            clicks—no extra dashboards required.
          </p>
        </section> */}

        <div className={styles.grid}>
          {loading && (
            <div className={styles.emptyState}>
              <strong>Loading staking programs…</strong>
              Hang tight while we fetch the latest emissions data.
            </div>
          )}

          {!loading && programs.length === 0 && (
            <div className={styles.emptyState}>
              <strong>No staking programs configured</strong>
              Deploy a WarpStakingRewards contract and sync the manifest to make
              it appear here.
            </div>
          )}

          {programs.map((program) => (
            <StakingCard
              key={program.contract}
              program={program}
              tokenMap={tokenMap}
              walletAccount={walletAccount}
              ready={ready}
              onConnectWallet={handleConnectWallet}
              showError={showError}
              showSuccess={showSuccess}
              showLoading={showLoading}
            />
          ))}
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

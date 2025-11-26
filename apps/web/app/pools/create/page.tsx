"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { JsonRpcProvider, ZeroAddress } from "ethers";
import { useAccount, useSwitchChain } from "wagmi";
import styles from "../page.module.css";
import { ToastContainer } from "@/components/Toast";
import { NetworkBanner } from "@/components/trade/NetworkBanner";
import { LiquidityContainer } from "@/components/trade/LiquidityContainer";
import { TokenDialog } from "@/components/trade/TokenDialog";
import { useToasts } from "@/hooks/useToasts";
import { useDeploymentManifest } from "@/hooks/useDeploymentManifest";
import { useTokenManager } from "@/hooks/useTokenManager";
import { megaethTestnet } from "@/lib/chains";
import { MEGAETH_CHAIN_ID } from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import { appKit } from "@/lib/wagmi";
import { getFactory } from "@/lib/contracts";

type PairOrder = {
  token0: string | null;
  token1: string | null;
};

export default function CreatePoolPage() {
  const router = useRouter();

  const {
    address,
    isConnecting: isAccountConnecting,
    chain,
    status
  } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const { toasts, removeToast, showLoading, showSuccess, showError } =
    useToasts();
  const { deployment } = useDeploymentManifest();

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const {
    liquidityTokenA,
    liquidityTokenB,
    tokenDialogOpen,
    tokenDialogSide,
    tokenSearch,
    setTokenSearch,
    openTokenDialog,
    closeTokenDialog,
    handleSelectToken,
    handleSelectCustomToken,
    filteredTokens,
    showCustomOption,
    activeAddress,
    setLiquidityTokenB,
    isFetchingCustomToken,
    prefetchedTokenDetails
  } = useTokenManager(deployment, {
    initialLiquidityB: null,
    provider: readProvider
  });

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const [hasMounted, setHasMounted] = useState(false);
  const [pairTokenAddresses, setPairTokenAddresses] = useState<PairOrder>({
    token0: null,
    token1: null
  });
  const [existingPairAddress, setExistingPairAddress] = useState<string | null>(
    null
  );
  const [pairCheckPending, setPairCheckPending] = useState(false);
  const [pairCheckError, setPairCheckError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hasClearedTokenB, setHasClearedTokenB] = useState(false);

  useEffect(() => {
    if (hasClearedTokenB) return;
    if (liquidityTokenB !== null) {
      setLiquidityTokenB(null);
    }
    setHasClearedTokenB(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liquidityTokenB, hasClearedTokenB]);

  useEffect(() => {
    if (!tokenDialogOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTokenDialog();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [tokenDialogOpen, closeTokenDialog]);

  const chainId = chain?.id ?? null;

  const networkError = useMemo(() => {
    if (!chain) return null;
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      return `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`;
    }
    return null;
  }, [chain]);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  const duplicateTokenSelection = useMemo(() => {
    if (!liquidityTokenA?.address || !liquidityTokenB?.address) return false;
    return (
      liquidityTokenA.address.toLowerCase() ===
      liquidityTokenB.address.toLowerCase()
    );
  }, [liquidityTokenA?.address, liquidityTokenB?.address]);

  useEffect(() => {
    if (!liquidityTokenA?.address || !liquidityTokenB?.address) {
      setPairTokenAddresses({ token0: null, token1: null });
      setExistingPairAddress(null);
      setPairCheckError(null);
      return;
    }

    if (duplicateTokenSelection) {
      setPairTokenAddresses({ token0: null, token1: null });
      setExistingPairAddress(null);
      setPairCheckError(null);
      return;
    }

    const addressALower = liquidityTokenA.address.toLowerCase();
    const addressBLower = liquidityTokenB.address.toLowerCase();
    const [token0, token1] =
      addressALower < addressBLower
        ? [addressALower, addressBLower]
        : [addressBLower, addressALower];
    setPairTokenAddresses({ token0, token1 });
  }, [
    duplicateTokenSelection,
    liquidityTokenA?.address,
    liquidityTokenB?.address
  ]);

  useEffect(() => {
    if (
      !deployment?.factory ||
      !liquidityTokenA?.address ||
      !liquidityTokenB?.address ||
      duplicateTokenSelection
    ) {
      setExistingPairAddress(null);
      setPairCheckPending(false);
      return;
    }

    let cancelled = false;
    const factory = getFactory(deployment.factory, readProvider);

    const checkExistingPair = async () => {
      setPairCheckPending(true);
      setPairCheckError(null);

      try {
        const result = await factory.getPair(
          liquidityTokenA.address,
          liquidityTokenB.address
        );
        if (cancelled) return;

        // Convert result to string and lowercase
        const resultStr = String(result || "");
        const normalized = resultStr.toLowerCase();

        // Check if pair exists (not zero address)
        const zeroAddr = ZeroAddress.toLowerCase();
        const isZeroAddress =
          normalized === zeroAddr ||
          normalized === "0x0000000000000000000000000000000000000000";

        if (normalized && !isZeroAddress) {
          setExistingPairAddress(normalized);
        } else {
          setExistingPairAddress(null);
        }
      } catch (error) {
        console.error("[liquidity] pair lookup failed", error);
        if (!cancelled) {
          setPairCheckError(
            "Unable to verify existing pool. You can still attempt to create one."
          );
          setExistingPairAddress(null);
        }
      } finally {
        if (!cancelled) {
          setPairCheckPending(false);
        }
      }
    };

    checkExistingPair();

    return () => {
      cancelled = true;
    };
  }, [
    deployment?.factory,
    duplicateTokenSelection,
    liquidityTokenA?.address,
    liquidityTokenB?.address,
    readProvider
  ]);

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
      console.error("[network] switch failed", switchError);
      showError(parseErrorMessage(switchError));
    }
  }, [switchChainAsync, showError, showLoading, showSuccess]);

  const handleBackToPools = useCallback(() => {
    router.push("/pools");
  }, [router]);

  const handleConnectWallet = useCallback(() => {
    appKit.open();
  }, []);

  const addOverride = useMemo(() => {
    if (pairCheckPending) {
      return {
        label: "Checking…",
        disabled: true
      } as const;
    }
    if (duplicateTokenSelection) {
      return {
        label: "Select two different tokens",
        disabled: true
      } as const;
    }
    if (existingPairAddress) {
      return {
        label: "Pool already exists, Go to the pool",
        onClick: () => router.push(`/pools/${existingPairAddress}`),
        disabled: false,
        variant: "highlight"
      } as const;
    }
    return null;
  }, [pairCheckPending, duplicateTokenSelection, existingPairAddress, router]);

  const inlineNotice = useMemo(() => {
    if (pairCheckPending) return null;
    if (duplicateTokenSelection) {
      return "Select two different tokens to seed a new liquidity pool.";
    }
    if (existingPairAddress) {
      return "This pool already exists. Click the button below to view and add liquidity.";
    }
    if (pairCheckError) {
      return pairCheckError;
    }
    return null;
  }, [
    pairCheckPending,
    duplicateTokenSelection,
    existingPairAddress,
    pairCheckError
  ]);

  const pairAddressForContainer = existingPairAddress || "";

  const handleSwapRefresh = useCallback(() => {
    // Liquidity updates do not need to trigger external side effects yet.
  }, []);

  return (
    <>
      <NetworkBanner
        error={networkError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain}
      />

      <section className={styles.pageShell}>
        <div className={styles.pageHeader}>
          <div className={styles.headerTop}>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={handleBackToPools}
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {inlineNotice && <p className={styles.inlineNotice}>{inlineNotice}</p>}

        <div className={styles.detailSection}>
          <LiquidityContainer
            key={`create-liquidity-${deployment?.router ?? "default"}-${pairAddressForContainer || "new"}`}
            liquidityTokenA={liquidityTokenA}
            liquidityTokenB={liquidityTokenB}
            onOpenTokenDialog={openTokenDialog}
            routerAddress={deployment?.router ?? ""}
            wrappedNativeAddress={deployment?.wmegaeth}
            pairAddress={pairAddressForContainer}
            pairToken0={pairTokenAddresses.token0}
            pairToken1={pairTokenAddresses.token1}
            readProvider={readProvider}
            walletAccount={walletAccount}
            chainId={chainId}
            hasMounted={hasMounted}
            isWalletConnected={isWalletConnected}
            isAccountConnecting={isAccountConnecting}
            ready={ready}
            showError={showError}
            showSuccess={showSuccess}
            showLoading={showLoading}
            onSwapRefresh={handleSwapRefresh}
            allowTokenSelection
            poolDetails={null}
            onConnect={handleConnectWallet}
            enableRemoveLiquidity={false}
            addLiquidityOverride={addOverride}
          />
        </div>
      </section>

      <TokenDialog
        open={tokenDialogOpen}
        onClose={closeTokenDialog}
        tokenDialogSide={tokenDialogSide}
        tokenSearch={tokenSearch}
        onSearchChange={(value) => setTokenSearch(value)}
        filteredTokens={filteredTokens}
        showCustomOption={showCustomOption}
        activeAddress={activeAddress}
        onSelectToken={handleSelectToken}
        onSelectCustomToken={handleSelectCustomToken}
        isFetchingCustomToken={isFetchingCustomToken}
        prefetchedTokenDetails={prefetchedTokenDetails}
        walletAccount={walletAccount}
        provider={readProvider}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

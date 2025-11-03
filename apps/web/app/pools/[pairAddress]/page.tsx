"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { JsonRpcProvider } from "ethers";
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
import {
  MEGAETH_CHAIN_ID,
  DEFAULT_TOKEN_DECIMALS
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import { getPair } from "@/lib/contracts";
import type { TokenDescriptor } from "@/lib/trade/types";

const NATIVE_SYMBOL = (
  process.env.NEXT_PUBLIC_NATIVE_SYMBOL ?? "ETH"
).toUpperCase();

const isNativeToken = (token?: TokenDescriptor | null) =>
  Boolean(token?.isNative) || token?.symbol?.toUpperCase() === NATIVE_SYMBOL;

const orderTokensForDisplay = <T extends TokenDescriptor>(
  tokenA: T,
  tokenB: T
): [T, T] => {
  const aNative = isNativeToken(tokenA);
  const bNative = isNativeToken(tokenB);
  if (aNative && !bNative) {
    return [tokenB, tokenA];
  }
  if (bNative && !aNative) {
    return [tokenA, tokenB];
  }
  return [tokenA, tokenB];
};

const normalizeParam = (
  value: string | string[] | undefined
): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.toLowerCase() ?? null;
  return value.toLowerCase();
};

export default function PoolLiquidityPage() {
  const params = useParams<{ pairAddress?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const pairAddress = normalizeParam(params?.pairAddress);

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

  const wrappedNativeAddress = deployment?.wmegaeth ?? null;
  const wrappedNativeLower = wrappedNativeAddress?.toLowerCase() ?? null;
  const [pairTokenAddresses, setPairTokenAddresses] = useState<{
    token0: string | null;
    token1: string | null;
  }>({
    token0: null,
    token1: null
  });

  const {
    tokenList,
    setTokenList,
    liquidityTokenA,
    setLiquidityTokenA,
    liquidityTokenB,
    setLiquidityTokenB,
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
    activeAddress
  } = useTokenManager(deployment);

  const tokenListMap = useMemo(() => {
    const map = new Map<string, TokenDescriptor>();
    tokenList.forEach((token) => {
      if (token.address) {
        map.set(token.address.toLowerCase(), token);
      }
    });
    return map;
  }, [tokenList]);

  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;

  const pairTargetRef = useRef<{
    token0: string | null;
    token1: string | null;
  }>({
    token0: null,
    token1: null
  });

  const [hasMounted, setHasMounted] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [pairResolutionError, setPairResolutionError] = useState<string | null>(
    null
  );
  const [resolvingPair, setResolvingPair] = useState(false);

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!chain) {
      setNetworkError(null);
      return;
    }
    if (chain.id !== Number(MEGAETH_CHAIN_ID)) {
      setNetworkError(
        `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`
      );
    } else {
      setNetworkError(null);
    }
  }, [chain]);

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

  useEffect(() => {
    if (!tokenDialogOpen) return;
    if (pairAddress) {
      closeTokenDialog();
    }
  }, [tokenDialogOpen, pairAddress, closeTokenDialog]);

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

  useEffect(() => {
    if (!pairAddress) {
      setPairResolutionError("Pool address missing from URL.");
      return;
    }
    setPairResolutionError(null);
  }, [pairAddress]);

  useEffect(() => {
    if (!pairAddress || !readProvider) return;
    if (!tokenList.length) return;

    const target = pairTargetRef.current;
    if (
      target.token0 &&
      target.token1 &&
      liquidityTokenA?.address.toLowerCase() === target.token0 &&
      liquidityTokenB?.address.toLowerCase() === target.token1
    ) {
      return;
    }

    let cancelled = false;

    const ensureDescriptor = async (
      address: string
    ): Promise<TokenDescriptor | null> => {
      const lower = address.toLowerCase();
      const fromList = tokenListMap.get(lower);
      if (fromList) return fromList;

      if (wrappedNativeLower && lower === wrappedNativeLower) {
        const nativeDescriptor: TokenDescriptor = {
          symbol: NATIVE_SYMBOL,
          name: NATIVE_SYMBOL,
          address: wrappedNativeAddress!,
          decimals: DEFAULT_TOKEN_DECIMALS,
          isNative: true,
          wrappedAddress: wrappedNativeAddress!
        };
        if (!cancelled) {
          setTokenList((prev) => {
            if (prev.some((token) => token.address.toLowerCase() === lower)) {
              return prev;
            }
            return [...prev, nativeDescriptor];
          });
        }
        return nativeDescriptor;
      }

      const suffix = lower.slice(2, 6).toUpperCase();
      const fallback: TokenDescriptor = {
        symbol: `TOK${suffix}`,
        name: `Token ${suffix}`,
        address,
        decimals: DEFAULT_TOKEN_DECIMALS,
        isNative: false
      };

      if (!cancelled) {
        setTokenList((prev) => {
          if (prev.some((token) => token.address.toLowerCase() === lower)) {
            return prev;
          }
          return [...prev, fallback];
        });
      }

      return fallback;
    };

    const resolvePairTokens = async () => {
      setResolvingPair(true);
      setPairResolutionError(null);
      try {
        const pairContract = getPair(pairAddress, readProvider);
        let token0Address: string;
        let token1Address: string;
        try {
          [token0Address, token1Address] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);
        } catch (contractError) {
          console.error("[pool] failed to read pair tokens", contractError);
          if (!cancelled) {
            setPairResolutionError(
              "Unable to load pool tokens. Verify the pool address."
            );
          }
          return;
        }

        if (cancelled) return;

        const [descriptor0, descriptor1] = await Promise.all([
          ensureDescriptor(token0Address),
          ensureDescriptor(token1Address)
        ]);

        if (cancelled) return;

        const token0Lower = token0Address.toLowerCase();
        const token1Lower = token1Address.toLowerCase();

        pairTargetRef.current = {
          token0: token0Lower,
          token1: token1Lower
        };
        setPairTokenAddresses({ token0: token0Lower, token1: token1Lower });

        if (descriptor0) {
          setLiquidityTokenA(descriptor0);
        }
        if (descriptor1) {
          setLiquidityTokenB(descriptor1);
        }
      } catch (resolveError) {
        console.error("[pool] failed to resolve pair tokens", resolveError);
        if (!cancelled) {
          setPairResolutionError(
            "Unable to load pool tokens. Verify the pool address."
          );
        }
      } finally {
        if (!cancelled) {
          setResolvingPair(false);
        }
      }
    };

    resolvePairTokens();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pairAddress,
    tokenList,
    readProvider,
    tokenListMap,
    wrappedNativeLower,
    wrappedNativeAddress,
    setLiquidityTokenA,
    setLiquidityTokenB,
    setTokenList
  ]);

  useEffect(() => {
    if (!pairAddress || !pathname) return;
    const canonicalPath = `/pools/${pairAddress}`;
    if (pathname.toLowerCase() !== canonicalPath.toLowerCase()) {
      router.replace(canonicalPath);
    }
  }, [pairAddress, pathname, router]);

  const chainId = chain?.id ?? null;
  const handleSwapRefresh = useCallback(() => {
    // Liquidity updates do not need to trigger external side effects yet.
  }, []);

  const handleBackToPools = useCallback(() => {
    router.push("/pools");
  }, [router]);

  return (
    <>
      <NetworkBanner
        error={networkError ?? pairResolutionError}
        onSwitch={switchToMegaEth}
        isSwitching={isSwitchingChain || resolvingPair}
      />

      <section className={styles.pageShell}>
        <div className={styles.pageHeader}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>Pools</h1>
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
          <p className={styles.description}>
            Provide liquidity to trading pairs and earn fees from every swap..
          </p>
        </div>

        <div className={styles.detailSection}>
          <LiquidityContainer
            key={`liquidity-${deployment?.router ?? "default"}-${pairAddress ?? "unknown"}`}
            liquidityTokenA={liquidityTokenA}
            liquidityTokenB={liquidityTokenB}
            onOpenTokenDialog={openTokenDialog}
            routerAddress={deployment?.router ?? ""}
            wrappedNativeAddress={deployment?.wmegaeth}
            pairAddress={pairAddress ?? ""}
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
            allowTokenSelection={false}
          />
        </div>
      </section>

      <ToastContainer toasts={toasts} onClose={removeToast} />

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
      />
    </>
  );
}

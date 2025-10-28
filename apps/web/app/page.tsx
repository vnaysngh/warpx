"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ToastContainer, type Toast } from "@/components/Toast";
import {
  BrowserProvider,
  Interface,
  JsonRpcProvider,
  ZeroAddress,
  formatUnits,
  parseUnits
} from "ethers";
import type { Eip1193Provider, JsonRpcSigner } from "ethers";
import type { Address } from "viem";
import styles from "./page.module.css";
import { DeploymentManifest, loadDeployment } from "@/lib/config/deployment";
import { shortAddress } from "@/lib/utils/format";
import { toBigInt } from "@/lib/utils/math";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useSwitchChain,
  useWalletClient
} from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract
} from "wagmi/actions";
import { erc20Abi } from "@/lib/abis/erc20";
import { pancakeRouterAbi } from "@/lib/abis/router";
import { getFactory, getPair, getRouter, getToken } from "@/lib/contracts";
import { megaethTestnet } from "@/lib/chains";
import { appKit, wagmiConfig } from "@/lib/wagmi";

const MEGAETH_CHAIN_ID = 6342n;
const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const parseErrorMessage = (error: any): string => {
  // User rejected transaction
  if (
    error?.message?.toLowerCase().includes("user rejected") ||
    error?.message?.toLowerCase().includes("user denied") ||
    error?.shortMessage?.toLowerCase().includes("user rejected") ||
    error?.shortMessage?.toLowerCase().includes("user denied") ||
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED"
  ) {
    return "Transaction rejected by user.";
  }

  // Insufficient funds
  if (
    error?.message?.toLowerCase().includes("insufficient funds") ||
    error?.shortMessage?.toLowerCase().includes("insufficient funds")
  ) {
    return "Insufficient funds to complete transaction.";
  }

  // Network issues
  if (
    error?.message?.toLowerCase().includes("network") ||
    error?.message?.toLowerCase().includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Contract revert with reason
  if (error?.reason) {
    return `Transaction failed: ${error.reason}`;
  }

  // Use shortMessage if available (wagmi/viem provides these)
  if (error?.shortMessage && typeof error.shortMessage === "string") {
    // Clean up the short message
    const msg = error.shortMessage.replace(/\n.*$/, ""); // Remove everything after first newline
    if (msg.length < 100) {
      return msg;
    }
  }

  // Generic message for unknown errors
  return "Transaction failed. Please try again.";
};

type TokenDescriptor = {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
};

const TOKEN_CATALOG: TokenDescriptor[] = [
  {
    symbol: "MEGA",
    name: "MegaETH",
    address: "0x2Ea161D82Cf2D965819C45cdA2fDE0AF79161639",
    decimals: 18
  },
  {
    symbol: "MEGB",
    name: "MegaETH Beta",
    address: "0x96F01598fc45334bF2566614Fb046Cc7A8F132C8",
    decimals: 18
  },
  {
    symbol: "WMEGA",
    name: "Wrapped MegaETH",
    address: "0x88C1770353BD23f435F6F049cc26936009B27B69",
    decimals: 18
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x1F6D0EF24eE896E3Fe81F6dB5b563F40b36199b1",
    decimals: 6
  },
  {
    symbol: "BNB",
    name: "Binance Coin",
    address: "0x91A2D3F68cCf3DB6A74FdAc851Fc2bB50a5F7523",
    decimals: 18
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    decimals: 18
  }
];

const DEFAULT_TOKEN_DECIMALS = 18;

const SWAP_DEFAULT = {
  tokenIn: "",
  tokenOut: "",
  amountIn: "",
  minOut: ""
};

const LIQUIDITY_DEFAULT = {
  amountA: "",
  amountB: ""
};

const REMOVE_DEFAULT = {
  tokenA: "",
  tokenB: "",
  liquidity: "",
  expectedTokenA: "",
  expectedTokenB: ""
};

type Quote = { amount: string; symbol: string };
type ReverseQuote = { amount: string; symbolIn: string; symbolOut: string };
type LpInfo = {
  pair: string | null;
  balance: string | null;
  symbol: string | null;
};

type TokenDialogSlot = "swapIn" | "swapOut" | "liquidityA" | "liquidityB";

export default function Page() {
  const {
    address,
    isConnecting: isAccountConnecting,
    chain,
    status
  } = useAccount();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const copyTimeoutRef = useRef<number | null>(null);
  const isWalletConnected = Boolean(address) && status !== "disconnected";
  const walletAccount = isWalletConnected
    ? (address?.toLowerCase() ?? null)
    : null;
  const accountDisplayAddress = address ?? walletAccount ?? "";
  const shortAccountAddress = accountDisplayAddress
    ? shortAddress(accountDisplayAddress)
    : "";

  const [deployment, setDeployment] = useState<DeploymentManifest | null>(null);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const [swapForm, setSwapForm] = useState(SWAP_DEFAULT);
  const [liquidityForm, setLiquidityForm] = useState(LIQUIDITY_DEFAULT);
  const [removeForm, setRemoveForm] = useState(REMOVE_DEFAULT);
  const [pairInspection, setPairInspection] = useState({
    tokenA: "",
    tokenB: "",
    result: ""
  });

  const [networkError, setNetworkError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const loadingToastRef = useRef<string | null>(null);

  const addToast = useCallback(
    (message: string, type: Toast["type"], duration?: number) => {
      const id = `${Date.now()}-${Math.random()}`;
      const newToast: Toast = { id, message, type, duration };
      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showLoading = useCallback(
    (message: string) => {
      const id = addToast(message, "loading");
      loadingToastRef.current = id;
      return id;
    },
    [addToast]
  );

  const hideLoading = useCallback(() => {
    if (loadingToastRef.current) {
      removeToast(loadingToastRef.current);
      loadingToastRef.current = null;
    }
  }, [removeToast]);

  const showSuccess = useCallback(
    (message: string) => {
      hideLoading();
      addToast(message, "success");
    },
    [addToast, hideLoading]
  );

  const showError = useCallback(
    (message: string) => {
      hideLoading();
      addToast(message, "error");
    },
    [addToast, hideLoading]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [swapQuote, setSwapQuote] = useState<Quote | null>(null);
  const [reverseQuote, setReverseQuote] = useState<ReverseQuote | null>(null);
  const [removeResult, setRemoveResult] = useState<string | null>(null);
  const [lpInfo, setLpInfo] = useState<LpInfo>({
    pair: null,
    balance: null,
    symbol: null
  });
  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(TOKEN_CATALOG);
  const [selectedIn, setSelectedIn] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[0] ?? null
  );
  const [selectedOut, setSelectedOut] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[1] ?? TOKEN_CATALOG[0] ?? null
  );
  const [liquidityTokenA, setLiquidityTokenA] =
    useState<TokenDescriptor | null>(TOKEN_CATALOG[0] ?? null);
  const [liquidityTokenB, setLiquidityTokenB] =
    useState<TokenDescriptor | null>(
      TOKEN_CATALOG[1] ?? TOKEN_CATALOG[0] ?? null
    );

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogSide, setTokenDialogSide] =
    useState<TokenDialogSlot>("swapIn");
  const [tokenSearch, setTokenSearch] = useState("");
  const [activeView, setActiveView] = useState<"swap" | "liquidity">("swap");
  const [liquidityMode, setLiquidityMode] = useState<"add" | "remove">("add");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowanceNonce, setAllowanceNonce] = useState(0);
  const [needsApprovalA, setNeedsApprovalA] = useState(false);
  const [needsApprovalB, setNeedsApprovalB] = useState(false);
  const [checkingLiquidityAllowances, setCheckingLiquidityAllowances] =
    useState(false);
  const [liquidityAllowanceNonce, setLiquidityAllowanceNonce] = useState(0);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [hasMounted, setHasMounted] = useState(false);
  const [isWalletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const showWalletActions = hasMounted && isWalletConnected;

  // Derive token addresses from token objects (single source of truth)
  const liquidityTokenAAddress = liquidityTokenA?.address ?? "";
  const liquidityTokenBAddress = liquidityTokenB?.address ?? "";

  const balanceQueryEnabled =
    hasMounted && isWalletConnected && chain?.id === Number(MEGAETH_CHAIN_ID);

  const tokenAIsAddress = isAddress(liquidityTokenAAddress);
  const tokenBIsAddress = isAddress(liquidityTokenBAddress);

  const { data: balanceAData } = useBalance({
    address: balanceQueryEnabled ? (address as Address) : undefined,
    token:
      balanceQueryEnabled && tokenAIsAddress
        ? (liquidityTokenAAddress as Address)
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        balanceQueryEnabled && tokenAIsAddress && Boolean(liquidityTokenAAddress)
    }
  });

  const { data: balanceBData } = useBalance({
    address: balanceQueryEnabled ? (address as Address) : undefined,
    token:
      balanceQueryEnabled && tokenBIsAddress
        ? (liquidityTokenBAddress as Address)
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        balanceQueryEnabled && tokenBIsAddress && Boolean(liquidityTokenBAddress)
    }
  });

  const tokenABalanceFormatted = balanceAData?.formatted ?? null;
  const tokenBBalanceFormatted = balanceBData?.formatted ?? null;
  const tokenASymbol = balanceAData?.symbol ?? liquidityTokenA?.symbol ?? null;
  const tokenBSymbol = balanceBData?.symbol ?? liquidityTokenB?.symbol ?? null;

  // Debug: Log balance query state in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[balance] Query state:", {
        enabled: balanceQueryEnabled,
        tokenA: liquidityTokenAAddress,
        tokenB: liquidityTokenBAddress,
        balanceA: tokenABalanceFormatted,
        balanceB: tokenBBalanceFormatted
      });
    }
  }, [
    balanceQueryEnabled,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    tokenABalanceFormatted,
    tokenBBalanceFormatted
  ]);

  const formatBalance = useCallback((value: string | null) => {
    if (value === null) return "—";
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    if (numeric === 0) return "0";
    if (numeric >= 1) return numeric.toFixed(4);
    return numeric.toPrecision(4);
  }, []);

  const readProvider = useMemo(() => {
    const rpcUrl = megaethTestnet.rpcUrls.default.http[0];
    return new JsonRpcProvider(rpcUrl);
  }, []);

  const walletProvider = useMemo(() => {
    if (!walletClient) return null;

    const transport = walletClient.transport as unknown as {
      type?: string;
      value?: Eip1193Provider;
      request?: Eip1193Provider["request"];
    };

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

    return new BrowserProvider(
      provider,
      walletClient.chain?.id ?? Number(MEGAETH_CHAIN_ID)
    );
  }, [walletClient]);

  const [walletSigner, setWalletSigner] = useState<JsonRpcSigner | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!walletProvider) {
      setWalletSigner(null);
      return;
    }

    walletProvider
      .getSigner()
      .then((resolvedSigner) => {
        if (!cancelled) {
          setWalletSigner(resolvedSigner);
        }
      })
      .catch((err) => {
        console.error("[wallet] Failed to resolve signer", err);
        if (!cancelled) {
          setWalletSigner(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [walletProvider]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (address) return;
    setCopyStatus("idle");
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }, [address]);

  const handleConnectClick = useCallback(() => {
    (window as any).__appKitManualOpen = true;
    appKit.open();
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("copied");
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus("idle");
        copyTimeoutRef.current = null;
        setWalletMenuOpen(false);
      }, 1500);
    } catch (copyError) {
      console.error("[wallet] Failed to copy address", copyError);
    }
  }, [address]);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) return;
    try {
      // Signal that we're disconnecting to prevent modal interference
      if (typeof (window as any).__setDisconnecting === "function") {
        (window as any).__setDisconnecting(true);
      }

      await disconnectAsync();

      // Reset all state after successful disconnect
      setSwapForm(SWAP_DEFAULT);
      setLiquidityForm(LIQUIDITY_DEFAULT);
      setRemoveForm(REMOVE_DEFAULT);
      setSwapQuote(null);
      setReverseQuote(null);
      setNeedsApproval(false);
      setNeedsApprovalA(false);
      setNeedsApprovalB(false);
      setLpInfo({ pair: null, balance: null, symbol: null });
      setWalletMenuOpen(false);
    } catch (disconnectError) {
      console.error("[wallet] Failed to disconnect", disconnectError);
      showError("Failed to disconnect wallet. Please try again.");
    } finally {
      // Re-enable modal management after disconnect completes
      if (typeof (window as any).__setDisconnecting === "function") {
        setTimeout(() => {
          (window as any).__setDisconnecting(false);
        }, 500);
      }
    }
  }, [disconnectAsync, isDisconnecting]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        setLoadingDeployment(true);
        const manifest = await loadDeployment();
        if (mounted) setDeployment(manifest);
      } catch (err) {
        console.warn("[manifest] failed to load deployment", err);
      } finally {
        if (mounted) setLoadingDeployment(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const routerAddress = deployment?.router ?? "";
  const factoryAddress = deployment?.factory ?? "";
  const wmegaAddress = deployment?.wmegaeth ?? "";

  // Reset UI state when deployment changes (router address or token list updates)
  // NOTE: liquidityForm only stores amounts (amountA/amountB). Token addresses
  // are derived directly from liquidityTokenA/B state (see lines 292-293).
  // This eliminates the need for sync logic and prevents state inconsistencies.
  useEffect(() => {
    setSwapForm(SWAP_DEFAULT);
    setRemoveForm(REMOVE_DEFAULT);
    setLpInfo({ pair: null, balance: null, symbol: null });
    setSwapQuote(null);
    setReverseQuote(null);
    setNeedsApproval(false);
    setCheckingAllowance(false);
    setSelectedIn((prev) => {
      if (prev && tokenList.some((token) => token.address === prev.address)) {
        return prev;
      }
      return tokenList[0] ?? null;
    });
    setSelectedOut((prev) => {
      if (prev && tokenList.some((token) => token.address === prev.address)) {
        return prev;
      }
      return tokenList[1] ?? tokenList[0] ?? null;
    });
    setLiquidityTokenA((prev) => {
      if (prev && tokenList.some((token) => token.address === prev.address)) {
        return prev;
      }
      return tokenList[0] ?? null;
    });
    setLiquidityTokenB((prev) => {
      if (prev && tokenList.some((token) => token.address === prev.address)) {
        return prev;
      }
      return tokenList[1] ?? tokenList[0] ?? null;
    });
  }, [routerAddress, tokenList]);

  useEffect(() => {
    if (!walletAccount || !chain) {
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
  }, [walletAccount, chain]);

  useEffect(() => {
    if (!tokenDialogOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTokenDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [tokenDialogOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletMenuOpen(false);
      }
    };
    if (isWalletMenuOpen) {
      window.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isWalletMenuOpen]);

  const ready = useMemo(() => {
    const onMegaEth = chain && chain.id === Number(MEGAETH_CHAIN_ID);
    return Boolean(walletAccount && deployment && onMegaEth);
  }, [chain, walletAccount, deployment]);

  useEffect(() => {
    if (!selectedIn) return;
    if (swapForm.tokenIn?.toLowerCase() === selectedIn.address.toLowerCase()) {
      return;
    }
    setSwapForm((prev) => ({ ...prev, tokenIn: selectedIn.address }));
  }, [selectedIn, swapForm.tokenIn]);

  useEffect(() => {
    if (!selectedOut) return;
    if (
      swapForm.tokenOut?.toLowerCase() === selectedOut.address.toLowerCase()
    ) {
      return;
    }
    setSwapForm((prev) => ({ ...prev, tokenOut: selectedOut.address }));
  }, [selectedOut, swapForm.tokenOut]);

  // Allowance check for liquidity operations
  useEffect(() => {
    let cancelled = false;
    if (
      !ready ||
      !walletProvider ||
      !walletAccount ||
      !routerAddress ||
      !isAddress(liquidityTokenAAddress) ||
      !isAddress(liquidityTokenBAddress) ||
      !liquidityForm.amountA ||
      !liquidityForm.amountB
    ) {
      if (!cancelled) {
        setNeedsApprovalA(false);
        setNeedsApprovalB(false);
        setCheckingLiquidityAllowances(false);
      }
      return;
    }

    const evaluate = async () => {
      try {
        if (!cancelled) setCheckingLiquidityAllowances(true);
        const owner = walletAccount!;
        const tokenAContract = getToken(liquidityTokenAAddress, readProvider);
        const tokenBContract = getToken(liquidityTokenBAddress, readProvider);

        let decimalsA = liquidityTokenA?.decimals ?? DEFAULT_TOKEN_DECIMALS;
        let decimalsB = liquidityTokenB?.decimals ?? DEFAULT_TOKEN_DECIMALS;

        if (!liquidityTokenA?.decimals) {
          try {
            decimalsA = Number(await tokenAContract.decimals());
          } catch (decimalsError) {
            console.warn(
              "[liquidity] falling back to default decimals for tokenA",
              decimalsError
            );
          }
        }

        if (!liquidityTokenB?.decimals) {
          try {
            decimalsB = Number(await tokenBContract.decimals());
          } catch (decimalsError) {
            console.warn(
              "[liquidity] falling back to default decimals for tokenB",
              decimalsError
            );
          }
        }

        const desiredA = parseUnits(liquidityForm.amountA, decimalsA);
        const desiredB = parseUnits(liquidityForm.amountB, decimalsB);

        const [allowanceA, allowanceB] = await Promise.all([
          tokenAContract.allowance(owner, routerAddress),
          tokenBContract.allowance(owner, routerAddress)
        ]);

        if (!cancelled) {
          setNeedsApprovalA(toBigInt(allowanceA) < desiredA);
          setNeedsApprovalB(toBigInt(allowanceB) < desiredB);
        }
      } catch (err) {
        console.error("liquidity allowance check failed", err);
        if (!cancelled) {
          setNeedsApprovalA(true);
          setNeedsApprovalB(true);
        }
      } finally {
        if (!cancelled) setCheckingLiquidityAllowances(false);
      }
    };

    evaluate();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    walletProvider,
    walletAccount,
    routerAddress,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    liquidityForm.amountA,
    liquidityForm.amountB,
    liquidityTokenA?.decimals,
    liquidityTokenB?.decimals,
    liquidityAllowanceNonce,
    readProvider
  ]);

  const ensureWallet = (options?: {
    requireSigner?: boolean;
  }): {
    account: string;
    provider: JsonRpcProvider;
    walletProvider: BrowserProvider | null;
    signer: JsonRpcSigner | null;
  } | null => {
    if (!walletAccount) {
      showError("Connect your wallet to continue.");
      return null;
    }
    if (!ready) {
      showError(
        "Switch to the MegaETH Testnet to interact with the contracts."
      );
      return null;
    }
    if (options?.requireSigner && (!walletProvider || !walletSigner)) {
      showError("Unlock your wallet to sign this transaction and try again.");
      return null;
    }
    return {
      account: walletAccount,
      provider: readProvider,
      walletProvider,
      signer: walletSigner
    };
  };

  const switchToMegaEth = async () => {
    if (!switchChainAsync) {
      showError("Wallet does not support programmatic chain switching.");
      return;
    }
    try {
      showLoading("Switching network...");
      await switchChainAsync({ chainId: Number(MEGAETH_CHAIN_ID) });
      showSuccess("Network switched successfully.");
    } catch (switchError: any) {
      console.error("[network] switch failed", switchError);
      showError(parseErrorMessage(switchError));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const computeQuote = async () => {
      setSwapQuote(null);

      if (!routerAddress) return;
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) return;
      if (!swapForm.amountIn || Number(swapForm.amountIn) <= 0) return;

      try {
        const routerRead = getRouter(routerAddress, readProvider);
        const tokenInContract = getToken(swapForm.tokenIn, readProvider);
        const tokenOutContract = getToken(swapForm.tokenOut, readProvider);

        const decimalsIn = await tokenInContract
          .decimals()
          .then((value) => Number(value))
          .catch((decimalsError) => {
            console.warn(
              "[swap] falling back to default decimals for tokenIn",
              decimalsError
            );
            return DEFAULT_TOKEN_DECIMALS;
          });
        const decimalsOut = await tokenOutContract
          .decimals()
          .then((value) => Number(value))
          .catch((decimalsError) => {
            console.warn(
              "[swap] falling back to default decimals for tokenOut",
              decimalsError
            );
            return DEFAULT_TOKEN_DECIMALS;
          });
        const symbolOut = await tokenOutContract
          .symbol()
          .catch((symbolError) => {
            console.warn(
              "[swap] falling back to generic symbol for tokenOut",
              symbolError
            );
            return "TOKEN";
          });

        const amountInWei = parseUnits(swapForm.amountIn, decimalsIn);
        if (amountInWei <= 0n) return;

        const path = [swapForm.tokenIn, swapForm.tokenOut];
        const amounts = await routerRead.getAmountsOut!(amountInWei, path);
        const amountOutWei = amounts[amounts.length - 1];
        const formattedOut = formatUnits(amountOutWei, decimalsOut);

        if (!cancelled) {
          setSwapQuote({ amount: formattedOut, symbol: symbolOut });
          setSwapForm((prev) => ({ ...prev, minOut: formattedOut }));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[quote] calculation error", err);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));

          // Show error for insufficient liquidity or other issues
          if (
            err?.message?.toLowerCase().includes("insufficient") ||
            err?.reason?.toLowerCase().includes("insufficient")
          ) {
            showError("Insufficient liquidity for this trade.");
          } else if (err?.message || err?.reason) {
            showError(`Unable to calculate swap: ${err.reason || err.message}`);
          }
        }
      }
    };

    computeQuote();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    walletProvider,
    routerAddress,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.amountIn,
    swapForm.minOut,
    readProvider
  ]);

  useEffect(() => {
    let cancelled = false;
    const computeReverseQuote = async () => {
      setReverseQuote(null);
      if (!routerAddress) return;
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) return;
      if (!swapForm.minOut || Number(swapForm.minOut) <= 0) return;

      try {
        const routerRead = getRouter(routerAddress, readProvider);
        const tokenInContract = getToken(swapForm.tokenIn, readProvider);
        const tokenOutContract = getToken(swapForm.tokenOut, readProvider);

        const decimalsIn = await tokenInContract
          .decimals()
          .then((value) => Number(value))
          .catch((decimalsError) => {
            console.warn(
              "[swap] reverse quote fallback decimals for tokenIn",
              decimalsError
            );
            return DEFAULT_TOKEN_DECIMALS;
          });
        const decimalsOut = await tokenOutContract
          .decimals()
          .then((value) => Number(value))
          .catch((decimalsError) => {
            console.warn(
              "[swap] reverse quote fallback decimals for tokenOut",
              decimalsError
            );
            return DEFAULT_TOKEN_DECIMALS;
          });
        const symbolIn = await tokenInContract.symbol().catch((symbolError) => {
          console.warn(
            "[swap] reverse quote fallback symbol for tokenIn",
            symbolError
          );
          return "TOKEN";
        });
        const symbolOut = await tokenOutContract
          .symbol()
          .catch((symbolError) => {
            console.warn(
              "[swap] reverse quote fallback symbol for tokenOut",
              symbolError
            );
            return "TOKEN";
          });

        const desiredOutWei = parseUnits(swapForm.minOut, decimalsOut);
        if (desiredOutWei <= 0n) return;

        const path = [swapForm.tokenIn, swapForm.tokenOut];
        const amounts = await routerRead.getAmountsIn!(desiredOutWei, path);
        const amountNeeded = amounts[0];
        const formattedIn = formatUnits(amountNeeded, decimalsIn);

        if (!cancelled) {
          setReverseQuote({ amount: formattedIn, symbolIn, symbolOut });
          if (!swapForm.amountIn) {
            setSwapForm((prev) => ({ ...prev, amountIn: formattedIn }));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[reverse quote] calculation error", err);
          setReverseQuote(null);
        }
      }
    };

    computeReverseQuote();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    walletProvider,
    routerAddress,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.minOut,
    swapForm.amountIn,
    readProvider
  ]);

  useEffect(() => {
    let active = true;
    const fetchLp = async () => {
      if (!routerAddress || !walletAccount) {
        if (active) setLpInfo({ pair: null, balance: null, symbol: null });
        return;
      }
      const { tokenA, tokenB } = removeForm;
      if (!isAddress(tokenA) || !isAddress(tokenB)) {
        if (active) setLpInfo({ pair: null, balance: null, symbol: null });
        return;
      }

      try {
        const factory = getFactory(factoryAddress, readProvider);
        const pairAddress = await factory.getPair!(tokenA, tokenB);
        if (pairAddress === ZeroAddress) {
          if (active) setLpInfo({ pair: null, balance: null, symbol: null });
          return;
        }
        const lpToken = getToken(pairAddress, readProvider);
        const [symbol, balanceWei] = await Promise.all([
          lpToken.symbol().catch(() => "LP"),
          lpToken.balanceOf(walletAccount)
        ]);
        const balance = formatUnits(balanceWei, 18);
        if (active) setLpInfo({ pair: pairAddress, balance, symbol });
      } catch (err) {
        console.error("fetch lp info", err);
        if (active) setLpInfo({ pair: null, balance: null, symbol: null });
      }
    };

    fetchLp();
    return () => {
      active = false;
    };
  }, [
    ready,
    walletProvider,
    walletAccount,
    routerAddress,
    factoryAddress,
    removeForm.tokenA,
    removeForm.tokenB,
    readProvider
  ]);

  // Removed manual balance polling; wagmi's useBalance handles watching balances.

  useEffect(() => {
    let cancelled = false;
    const evaluateAllowance = async () => {
      if (
        !walletAccount ||
        !routerAddress ||
        !isAddress(swapForm.tokenIn) ||
        !swapForm.amountIn ||
        Number(swapForm.amountIn) <= 0
      ) {
        if (!cancelled) {
          setNeedsApproval(false);
          setCheckingAllowance(false);
        }
        return;
      }
      try {
        if (!cancelled) setCheckingAllowance(true);
        const token = getToken(swapForm.tokenIn, readProvider);
        const decimals = await token
          .decimals()
          .then((value) => Number(value))
          .catch((decimalsError) => {
            console.warn(
              "[swap] allowance fallback decimals for tokenIn",
              decimalsError
            );
            return DEFAULT_TOKEN_DECIMALS;
          });
        const desired = parseUnits(swapForm.amountIn, decimals);
        if (desired <= 0n) {
          if (!cancelled) setNeedsApproval(false);
          return;
        }
        const allowance = await token.allowance(walletAccount, routerAddress);
        if (!cancelled) setNeedsApproval(toBigInt(allowance) < desired);
      } catch (err) {
        console.error("allowance check failed", err);
        if (!cancelled) setNeedsApproval(true);
      } finally {
        if (!cancelled) setCheckingAllowance(false);
      }
    };
    evaluateAllowance();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    walletProvider,
    walletAccount,
    routerAddress,
    swapForm.tokenIn,
    swapForm.amountIn,
    allowanceNonce,
    readProvider
  ]);

  const handleApprove = async (
    tokenAddress: string,
    spender: string,
    amount: string
  ) => {
    const ctx = ensureWallet();
    if (!ctx) return;
    if (!isAddress(tokenAddress) || !isAddress(spender)) {
      showError("Provide valid token and spender addresses.");
      return;
    }
    try {
      setIsSubmitting(true);
      showLoading("Approving token...");
      const decimals = await readContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn(
            "[approval] fallback to default decimals",
            decimalsError
          );
          return DEFAULT_TOKEN_DECIMALS;
        });
      const parsedAmount = parseUnits(
        amount && amount.length ? amount : "1000000",
        decimals
      );
      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, parsedAmount],
        chainId: Number(MEGAETH_CHAIN_ID)
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash
      });
      const isSwapToken =
        isAddress(swapForm.tokenIn) &&
        tokenAddress.toLowerCase() === swapForm.tokenIn.toLowerCase() &&
        spender.toLowerCase() === routerAddress.toLowerCase();
      const isLiquidityAToken =
        liquidityTokenA &&
        tokenAddress.toLowerCase() === liquidityTokenA.address.toLowerCase() &&
        spender.toLowerCase() === routerAddress.toLowerCase();
      const isLiquidityBToken =
        liquidityTokenB &&
        tokenAddress.toLowerCase() === liquidityTokenB.address.toLowerCase() &&
        spender.toLowerCase() === routerAddress.toLowerCase();

      if (isSwapToken) {
        setNeedsApproval(false);
        setAllowanceNonce((n) => n + 1);
      }
      if (isLiquidityAToken) {
        setNeedsApprovalA(false);
        setLiquidityAllowanceNonce((n) => n + 1);
      }
      if (isLiquidityBToken) {
        setNeedsApprovalB(false);
        setLiquidityAllowanceNonce((n) => n + 1);
      }
      showSuccess("Token approved successfully.");
    } catch (err: any) {
      console.error("[approval] failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwap = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenIn, tokenOut, amountIn, minOut } = swapForm;
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      showError("Enter valid ERC-20 token addresses for the swap.");
      return;
    }
    if (!amountIn) {
      showError("Provide an amount to swap.");
      return;
    }
    try {
      setIsSubmitting(true);
      showLoading("Executing swap...");

      const decimalsIn = await readContract(wagmiConfig, {
        address: tokenIn as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn("[swap] fallback decimals for tokenIn", decimalsError);
          return DEFAULT_TOKEN_DECIMALS;
        });
      const decimalsOut = await readContract(wagmiConfig, {
        address: tokenOut as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn("[swap] fallback decimals for tokenOut", decimalsError);
          return DEFAULT_TOKEN_DECIMALS;
        });

      const amountInWei = parseUnits(amountIn, decimalsIn);
      const minOutWei = minOut ? parseUnits(minOut, decimalsOut) : 0n;

      const allowance = await readContract(wagmiConfig, {
        address: tokenIn as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(allowance) < amountInWei) {
        const approveHash = await writeContract(wagmiConfig, {
          address: tokenIn as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, amountInWei],
          chainId: Number(MEGAETH_CHAIN_ID)
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      const txHash = await writeContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: pancakeRouterAbi,
        functionName: "swapExactTokensForTokens",
        args: [
          amountInWei,
          minOutWei,
          [tokenIn, tokenOut] as [`0x${string}`, `0x${string}`],
          ctx.account as `0x${string}`,
          BigInt(nowPlusMinutes(10))
        ],
        chainId: Number(MEGAETH_CHAIN_ID)
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      setAllowanceNonce((n) => n + 1);
      setNeedsApproval(false);
      showSuccess("Swap executed successfully.");
    } catch (err: any) {
      console.error("[swap] failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLiquidity = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const tokenA = liquidityTokenAAddress;
    const tokenB = liquidityTokenBAddress;
    const { amountA, amountB } = liquidityForm;
    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      showError("Enter valid token addresses for liquidity provision.");
      return;
    }
    if (!amountA || !amountB) {
      showError("Provide both token amounts for liquidity.");
      return;
    }
    try {
      setIsSubmitting(true);
      showLoading("Adding liquidity...");

      const decimalsA = await readContract(wagmiConfig, {
        address: tokenA as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn(
            "[liquidity] fallback decimals for tokenA",
            decimalsError
          );
          return DEFAULT_TOKEN_DECIMALS;
        });
      const decimalsB = await readContract(wagmiConfig, {
        address: tokenB as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn(
            "[liquidity] fallback decimals for tokenB",
            decimalsError
          );
          return DEFAULT_TOKEN_DECIMALS;
        });

      const amountAWei = parseUnits(amountA, decimalsA);
      const amountBWei = parseUnits(amountB, decimalsB);

      const txHash = await writeContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: pancakeRouterAbi,
        functionName: "addLiquidity",
        args: [
          tokenA as `0x${string}`,
          tokenB as `0x${string}`,
          amountAWei,
          amountBWei,
          0n,
          0n,
          ctx.account as `0x${string}`,
          BigInt(nowPlusMinutes(10))
        ],
        chainId: Number(MEGAETH_CHAIN_ID)
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      setLiquidityAllowanceNonce((n) => n + 1);
      showSuccess("Liquidity added successfully.");
    } catch (err: any) {
      console.error("[liquidity] add failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    const ctx = ensureWallet({ requireSigner: true });
    if (!ctx || !ctx.signer) return;
    const { signer, provider } = ctx;
    const { tokenA, tokenB, liquidity } = removeForm;

    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      setRemoveResult("Provide valid token addresses.");
      return;
    }
    if (!liquidity || Number(liquidity) <= 0) {
      setRemoveResult("Enter the LP token amount to burn.");
      return;
    }

    try {
      setIsSubmitting(true);
      setRemoveResult(null);
      setRemoveForm((prev) => ({
        ...prev,
        expectedTokenA: "",
        expectedTokenB: ""
      }));
      showLoading("Removing liquidity...");

      const router = getRouter(routerAddress, signer);
      const factory = getFactory(factoryAddress, provider);
      const pairAddress =
        lpInfo.pair ?? (await factory.getPair!(tokenA, tokenB));
      if (!pairAddress || pairAddress === ZeroAddress) {
        setRemoveResult("Pair does not exist.");
        return;
      }

      const pairRead = getPair(pairAddress, provider);
      const lpTokenRead = getToken(pairAddress, provider);
      const lpTokenWrite = getToken(pairAddress, signer);
      const lpSymbol =
        lpInfo.symbol || (await lpTokenRead.symbol().catch(() => "LP"));
      const owner = await signer.getAddress();
      const liquidityWei = parseUnits(liquidity, 18);

      const lpBalance = toBigInt(await lpTokenRead.balanceOf(owner));
      if (lpBalance < liquidityWei) {
        setRemoveResult("Insufficient LP balance.");
        return;
      }

      const allowance = toBigInt(
        await lpTokenRead.allowance(owner, routerAddress)
      );
      if (allowance < liquidityWei) {
        const approveTx = await lpTokenWrite.approve(
          routerAddress,
          liquidityWei
        );
        await approveTx.wait();
      }

      const token0 = await pairRead.token0!();
      const token1 = await pairRead.token1!();
      const decimals0 = await getToken(token0, provider)
        .decimals()
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn(
            "[liquidity] fallback decimals for token0",
            decimalsError
          );
          return DEFAULT_TOKEN_DECIMALS;
        });
      const decimals1 = await getToken(token1, provider)
        .decimals()
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn(
            "[liquidity] fallback decimals for token1",
            decimalsError
          );
          return DEFAULT_TOKEN_DECIMALS;
        });

      const tx = await router.removeLiquidity(
        tokenA,
        tokenB,
        liquidityWei,
        0n,
        0n,
        owner,
        BigInt(nowPlusMinutes(10))
      );
      const receipt = await tx.wait();

      const iface = new Interface([
        "event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)"
      ]);
      const burnLog = receipt.logs
        .map((log: any) => {
          try {
            return iface.parseLog(log);
          } catch (err) {
            return null;
          }
        })
        .find(Boolean) as { args: { amount0: bigint; amount1: bigint } } | null;

      if (burnLog) {
        const amount0 = formatUnits(burnLog.args.amount0, decimals0);
        const amount1 = formatUnits(burnLog.args.amount1, decimals1);
        setRemoveForm((prev) => ({
          ...prev,
          expectedTokenA: amount0,
          expectedTokenB: amount1
        }));
        setRemoveResult(
          `Removed liquidity. Received ≈ ${amount0} token0 and ≈ ${amount1} token1. Tx: ${receipt.hash}`
        );
      } else {
        setRemoveResult(`Removed liquidity. Tx: ${receipt.hash}`);
      }

      const newBalance = formatUnits(await lpTokenRead.balanceOf(owner), 18);
      setLpInfo({ pair: pairAddress, balance: newBalance, symbol: lpSymbol });
      showSuccess("Liquidity removed successfully.");
    } catch (err: any) {
      console.error("[liquidity] remove failed", err);
      setRemoveResult(parseErrorMessage(err));
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inspectPair = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenA, tokenB } = pairInspection;
    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      setPairInspection((prev) => ({
        ...prev,
        result: "Enter valid token addresses to inspect a pair."
      }));
      return;
    }
    try {
      const { provider } = ctx;
      const factory = getFactory(factoryAddress, provider);
      const pairAddress = await factory.getPair!(tokenA, tokenB);
      if (pairAddress === ZeroAddress) {
        setPairInspection((prev) => ({
          ...prev,
          result: "Pair not yet created."
        }));
        return;
      }
      const pair = getPair(pairAddress, provider);
      const reserves = await pair.getReserves!();
      const token0 = await pair.token0!();
      const token1 = await pair.token1!();

      const decimals0 = await getToken(token0, provider)
        .decimals()
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn("[inspect] fallback decimals for token0", decimalsError);
          return DEFAULT_TOKEN_DECIMALS;
        });
      const decimals1 = await getToken(token1, provider)
        .decimals()
        .then((value) => Number(value))
        .catch((decimalsError) => {
          console.warn("[inspect] fallback decimals for token1", decimalsError);
          return DEFAULT_TOKEN_DECIMALS;
        });

      const formatted = `Pair ${pairAddress}\nReserves:\n  • ${formatUnits(
        reserves[0],
        decimals0
      )} (${token0})\n  • ${formatUnits(reserves[1], decimals1)} (${token1})`;
      setPairInspection((prev) => ({ ...prev, result: formatted }));
    } catch (err: any) {
      console.error("[pair] inspection failed", err);
      setPairInspection((prev) => ({
        ...prev,
        result: parseErrorMessage(err)
      }));
    }
  };

  const manifestTag = loadingDeployment
    ? "Loading manifest…"
    : (deployment?.network ?? "No manifest loaded");

  const swapFormReady =
    isAddress(swapForm.tokenIn) &&
    isAddress(swapForm.tokenOut) &&
    !!swapForm.amountIn &&
    Number(swapForm.amountIn) > 0;

  let swapButtonLabel = "Swap";
  let swapButtonDisabled = false;
  let swapButtonAction: (() => void) | null = null;

  if (!hasMounted) {
    // Show consistent state during SSR and initial hydration
    swapButtonLabel = "Connect Wallet";
    swapButtonDisabled = false;
    swapButtonAction = handleConnectClick;
  } else if (!isWalletConnected) {
    swapButtonLabel = isAccountConnecting ? "Connecting..." : "Connect Wallet";
    swapButtonAction = handleConnectClick;
    swapButtonDisabled = isAccountConnecting;
  } else if (!chain || chain.id !== Number(MEGAETH_CHAIN_ID)) {
    swapButtonLabel = "Wrong Network";
    swapButtonAction = null;
    swapButtonDisabled = true;
  } else if (!swapFormReady) {
    swapButtonLabel = "Enter Amount";
    swapButtonDisabled = true;
  } else if (checkingAllowance) {
    swapButtonLabel = "Checking...";
    swapButtonDisabled = true;
  } else if (needsApproval) {
    swapButtonLabel = isSubmitting ? "Approving..." : "Approve";
    swapButtonAction = () =>
      handleApprove(swapForm.tokenIn, routerAddress, swapForm.amountIn || "0");
    swapButtonDisabled = isSubmitting;
  } else {
    swapButtonLabel = isSubmitting ? "Swapping..." : "Swap";
    swapButtonAction = handleSwap;
    swapButtonDisabled = isSubmitting;
  }

  const swapSummaryMessage = swapQuote
    ? `Quote ≈ ${swapQuote.amount} ${swapQuote.symbol}`
    : null;

  const liquidityTokensReady =
    isAddress(liquidityTokenAAddress) &&
    isAddress(liquidityTokenBAddress) &&
    liquidityTokenAAddress.toLowerCase() !== liquidityTokenBAddress.toLowerCase();

  const liquidityAmountsReady =
    !!liquidityForm.amountA && !!liquidityForm.amountB;

  let liquidityButtonLabel = "Add Liquidity";
  let liquidityButtonDisabled = false;
  let liquidityButtonAction: () => void = () => {};

  if (!hasMounted) {
    // Show consistent state during SSR and initial hydration
    liquidityButtonLabel = "Connect Wallet";
    liquidityButtonDisabled = false;
    liquidityButtonAction = handleConnectClick;
  } else if (!isWalletConnected) {
    liquidityButtonLabel = isAccountConnecting
      ? "Connecting..."
      : "Connect Wallet";
    liquidityButtonAction = handleConnectClick;
    liquidityButtonDisabled = isAccountConnecting;
  } else if (!chain || chain.id !== Number(MEGAETH_CHAIN_ID)) {
    liquidityButtonLabel = "Wrong Network";
    liquidityButtonAction = () => {};
    liquidityButtonDisabled = true;
  } else if (!liquidityTokensReady) {
    liquidityButtonLabel = "Select Tokens";
    liquidityButtonDisabled = true;
  } else if (!liquidityAmountsReady) {
    liquidityButtonLabel = "Enter Amounts";
    liquidityButtonDisabled = true;
  } else if (checkingLiquidityAllowances) {
    liquidityButtonLabel = "Checking...";
    liquidityButtonDisabled = true;
  } else if (needsApprovalA) {
    liquidityButtonLabel = `Approve ${liquidityTokenA?.symbol ?? "Token A"}`;
    liquidityButtonAction = () =>
      handleApprove(
        liquidityTokenAAddress,
        routerAddress,
        liquidityForm.amountA || "0"
      );
    liquidityButtonDisabled = isSubmitting;
  } else if (needsApprovalB) {
    liquidityButtonLabel = `Approve ${liquidityTokenB?.symbol ?? "Token B"}`;
    liquidityButtonAction = () =>
      handleApprove(
        liquidityTokenBAddress,
        routerAddress,
        liquidityForm.amountB || "0"
      );
    liquidityButtonDisabled = isSubmitting;
  } else {
    liquidityButtonLabel = isSubmitting ? "Supplying..." : "Add Liquidity";
    liquidityButtonAction = handleAddLiquidity;
    liquidityButtonDisabled = isSubmitting;
  }

  const handleLiquidityPrimary = () => {
    if (liquidityButtonDisabled) return;
    liquidityButtonAction();
  };

  const openTokenDialog = (slot: TokenDialogSlot) => {
    setTokenDialogSide(slot);
    setTokenSearch("");
    setTokenDialogOpen(true);
  };

  const closeTokenDialog = () => {
    setTokenDialogOpen(false);
    setTokenSearch("");
  };

  const commitSelection = (token: TokenDescriptor) => {
    switch (tokenDialogSide) {
      case "swapIn":
        setSelectedIn(token);
        break;
      case "swapOut":
        setSelectedOut(token);
        break;
      case "liquidityA":
        setLiquidityTokenA(token);
        break;
      case "liquidityB":
        setLiquidityTokenB(token);
        break;
    }
    closeTokenDialog();
  };

  const handleSelectToken = (token: TokenDescriptor) => {
    commitSelection(token);
  };

  const handleSelectCustomToken = (address: string) => {
    const sanitized = address.trim().toLowerCase();
    if (!isAddress(sanitized)) return;
    const derivedSymbol = `CUST-${sanitized.slice(2, 6).toUpperCase()}`;
    const customToken: TokenDescriptor = {
      symbol: derivedSymbol,
      name: "Custom Token",
      address: sanitized,
      decimals: 18
    };
    setTokenList((prev) => {
      if (prev.some((token) => token.address.toLowerCase() === sanitized)) {
        return prev;
      }
      return [...prev, customToken];
    });
    commitSelection(customToken);
  };

  const normalizedSearch = tokenSearch.trim().toLowerCase();
  const filteredTokens = useMemo(() => {
    if (!normalizedSearch) return tokenList;
    return tokenList.filter((token) => {
      const haystack =
        `${token.symbol} ${token.name} ${token.address}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [tokenList, normalizedSearch]);
  const searchIsAddress = isAddress(tokenSearch.trim());
  const hasAddressInList = tokenList.some(
    (token) => token.address.toLowerCase() === tokenSearch.trim().toLowerCase()
  );
  const showCustomOption = searchIsAddress && !hasAddressInList;
  const activeAddress = useMemo(() => {
    switch (tokenDialogSide) {
      case "swapIn":
        return selectedIn?.address?.toLowerCase() ?? null;
      case "swapOut":
        return selectedOut?.address?.toLowerCase() ?? null;
      case "liquidityA":
        return liquidityTokenA?.address?.toLowerCase() ?? null;
      case "liquidityB":
        return liquidityTokenB?.address?.toLowerCase() ?? null;
      default:
        return null;
    }
  }, [
    tokenDialogSide,
    selectedIn,
    selectedOut,
    liquidityTokenA,
    liquidityTokenB
  ]);

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.navbar}>
          <div className={styles.brand}>
            <span className={styles.brandMain}>MegaSwap</span>
            <span className={styles.brandSub}>
              MegaETH V2 · Automated Market Maker
            </span>
          </div>
          <div className={styles.navRight}>
            <span className={styles.networkBadge}>{manifestTag}</span>
            {showWalletActions ? (
              <div ref={walletMenuRef} className={styles.walletMenuContainer}>
                <button
                  className={styles.walletButton}
                  onClick={() => setWalletMenuOpen((prev) => !prev)}
                  type="button"
                >
                  {shortAccountAddress ? `${shortAccountAddress}` : "Wallet"}
                </button>

                {isWalletMenuOpen && (
                  <div className={styles.walletDropdown}>
                    <div className={styles.walletDropdownHeader}>
                      <div className={styles.walletDropdownLabel}>Wallet</div>
                      <div className={styles.walletDropdownAddress}>
                        {shortAccountAddress}
                      </div>
                    </div>

                    <button
                      onClick={handleCopyAddress}
                      className={styles.walletDropdownItem}
                      type="button"
                    >
                      <span>Copy address</span>
                      {copyStatus === "copied" && (
                        <span className={styles.walletDropdownCopied}>
                          Copied!
                        </span>
                      )}
                    </button>

                    {address && (
                      <a
                        href={`https://www.mtrkr.xyz/wallet/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.walletDropdownItem}
                      >
                        View on Explorer
                      </a>
                    )}

                    <div className={styles.walletDropdownDivider} />

                    <button
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className={`${styles.walletDropdownItem} ${styles.walletDropdownDisconnect}`}
                      type="button"
                    >
                      {isDisconnecting ? "Disconnecting…" : "Disconnect wallet"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                className={styles.walletButton}
                onClick={handleConnectClick}
                disabled={isAccountConnecting && hasMounted}
                type="button"
              >
                {isAccountConnecting && hasMounted
                  ? "Connecting…"
                  : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {networkError && (
          <div className={styles.statusStack}>
            <div className={`${styles.status} ${styles.statusWarn}`}>
              <div className={styles.statusContent}>
                <span className={styles.statusLabel}>Network</span>
                {networkError}
              </div>
              <button
                className={styles.statusAction}
                type="button"
                onClick={switchToMegaEth}
                disabled={isSwitchingChain}
              >
                {isSwitchingChain ? "Switching…" : "Switch"}
              </button>
            </div>
          </div>
        )}

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeView === "swap" ? styles.tabActive : ""}`}
            onClick={() => setActiveView("swap")}
          >
            Swap
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeView === "liquidity" ? styles.tabActive : ""}`}
            onClick={() => setActiveView("liquidity")}
          >
            Liquidity
          </button>
        </div>

        {activeView === "swap" && (
          <section className={styles.card}>
            {/*    <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Swap</h2>
                <p className={styles.cardSubtitle}>
                  Trade tokens through the MegaSwap router with live routing
                  quotes and automatic approvals.
                </p>
              </div>
            </div> */}

            <div className={styles.swapPanel}>
              <div className={styles.assetCard}>
                <div className={styles.assetHeader}>
                  <span>Pay</span>
                  <button
                    type="button"
                    className={styles.assetSelector}
                    onClick={() => openTokenDialog("swapIn")}
                  >
                    <span className={styles.assetSelectorSymbol}>
                      {selectedIn?.symbol ?? "Select"}
                    </span>
                    <span className={styles.assetSelectorChevron}>v</span>
                  </button>
                </div>
                <div className={styles.assetAmountRow}>
                  <input
                    className={styles.amountInput}
                    placeholder="0.0"
                    value={swapForm.amountIn}
                    onChange={(event) =>
                      setSwapForm((prev) => ({
                        ...prev,
                        amountIn: event.target.value
                      }))
                    }
                  />
                </div>
              </div>

              <div className={styles.swapDivider}>v</div>

              <div className={styles.assetCard}>
                <div className={styles.assetHeader}>
                  <span>Receive</span>
                  <button
                    type="button"
                    className={styles.assetSelector}
                    onClick={() => openTokenDialog("swapOut")}
                  >
                    <span className={styles.assetSelectorSymbol}>
                      {selectedOut?.symbol ?? "Select"}
                    </span>
                    <span className={styles.assetSelectorChevron}>v</span>
                  </button>
                </div>
                <div className={styles.assetAmountRow}>
                  <input
                    className={styles.amountInput}
                    placeholder={swapQuote ? swapQuote.amount : "0.0"}
                    value={swapForm.minOut}
                    onChange={(event) =>
                      setSwapForm((prev) => ({
                        ...prev,
                        minOut: event.target.value
                      }))
                    }
                  />
                </div>
                {reverseQuote && (
                  <span className={styles.helper}>
                    Needs ≈ {reverseQuote.amount} {reverseQuote.symbolIn}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.summary}>
              <button
                className={`${styles.primaryButton} ${styles.primaryFull}`}
                onClick={() => swapButtonAction?.()}
                disabled={swapButtonDisabled}
                type="button"
              >
                {swapButtonLabel}
              </button>
            </div>
            {swapSummaryMessage && (
              <span className={styles.summaryPrimary}>
                {swapSummaryMessage}
              </span>
            )}
          </section>
        )}

        {activeView === "liquidity" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              {/*  <div>
                <h2 className={styles.cardTitle}>Liquidity</h2>
                <p className={styles.cardSubtitle}>
                  Provide or withdraw liquidity from MegaSwap pairs. Approvals
                  are handled inline before execution.
                </p>
              </div> */}
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segment} ${liquidityMode === "add" ? styles.segmentActive : ""}`}
                  onClick={() => setLiquidityMode("add")}
                >
                  Add
                </button>
                <button
                  type="button"
                  className={`${styles.segment} ${liquidityMode === "remove" ? styles.segmentActive : ""}`}
                  onClick={() => setLiquidityMode("remove")}
                >
                  Remove
                </button>
              </div>
            </div>

            {liquidityMode === "add" ? (
              <>
                <div className={styles.swapPanel}>
                  <div className={styles.assetCard}>
                    <div className={styles.assetHeader}>
                      <span>Deposit A</span>
                      <button
                        type="button"
                        className={styles.assetSelector}
                        onClick={() => openTokenDialog("liquidityA")}
                      >
                        <span className={styles.assetSelectorSymbol}>
                          {liquidityTokenA?.symbol ?? "Select"}
                        </span>
                        <span className={styles.assetSelectorChevron}>v</span>
                      </button>
                    </div>
                    <div className={styles.assetAmountRow}>
                      <input
                        className={styles.amountInput}
                        placeholder="0.0"
                        value={liquidityForm.amountA}
                        onChange={(event) =>
                          setLiquidityForm((prev) => ({
                            ...prev,
                            amountA: event.target.value
                          }))
                        }
                      />
                    </div>
                    <span className={styles.helper}>
                      Balance:{" "}
                      {liquidityTokenA
                        ? `${formatBalance(tokenABalanceFormatted)} ${tokenASymbol ?? liquidityTokenA.symbol}`
                        : "—"}
                    </span>
                  </div>

                  <div className={styles.assetCard}>
                    <div className={styles.assetHeader}>
                      <span>Deposit B</span>
                      <button
                        type="button"
                        className={styles.assetSelector}
                        onClick={() => openTokenDialog("liquidityB")}
                      >
                        <span className={styles.assetSelectorSymbol}>
                          {liquidityTokenB?.symbol ?? "Select"}
                        </span>
                        <span className={styles.assetSelectorChevron}>v</span>
                      </button>
                    </div>
                    <div className={styles.assetAmountRow}>
                      <input
                        className={styles.amountInput}
                        placeholder="0.0"
                        value={liquidityForm.amountB}
                        onChange={(event) =>
                          setLiquidityForm((prev) => ({
                            ...prev,
                            amountB: event.target.value
                          }))
                        }
                      />
                    </div>
                    <span className={styles.helper}>
                      Balance:{" "}
                      {liquidityTokenB
                        ? `${formatBalance(tokenBBalanceFormatted)} ${tokenBSymbol ?? liquidityTokenB.symbol}`
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className={styles.summary}>
                  <button
                    className={`${styles.primaryButton} ${styles.primaryFull}`}
                    onClick={handleLiquidityPrimary}
                    disabled={liquidityButtonDisabled}
                    type="button"
                  >
                    {liquidityButtonLabel}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.form}>
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Token A Address</label>
                    <input
                      className={styles.input}
                      placeholder="0x…"
                      value={removeForm.tokenA}
                      onChange={(event) =>
                        setRemoveForm((prev) => ({
                          ...prev,
                          tokenA: event.target.value.trim()
                        }))
                      }
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Token B Address</label>
                    <input
                      className={styles.input}
                      placeholder="0x…"
                      value={removeForm.tokenB}
                      onChange={(event) =>
                        setRemoveForm((prev) => ({
                          ...prev,
                          tokenB: event.target.value.trim()
                        }))
                      }
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>LP Tokens to Burn</label>
                  <input
                    className={styles.input}
                    placeholder="0.0"
                    value={removeForm.liquidity}
                    onChange={(event) =>
                      setRemoveForm((prev) => ({
                        ...prev,
                        liquidity: event.target.value
                      }))
                    }
                  />
                  {lpInfo.balance && (
                    <span
                      className={styles.helper}
                      style={{ marginTop: "0.5rem", display: "block" }}
                    >
                      Balance: {parseFloat(lpInfo.balance).toFixed(4)}{" "}
                      {lpInfo.symbol ?? "LP"}
                    </span>
                  )}
                </div>

                <div className={styles.buttonRow}>
                  <button
                    className={styles.primaryButton}
                    onClick={handleRemoveLiquidity}
                    disabled={!ready || isSubmitting}
                    type="button"
                  >
                    Remove Liquidity
                  </button>
                </div>

                {removeResult && (
                  <div
                    className={`${styles.callout} ${
                      removeResult.startsWith("Removed")
                        ? ""
                        : styles.calloutError
                    }`}
                  >
                    {removeResult}
                  </div>
                )}

                {(removeForm.expectedTokenA || removeForm.expectedTokenB) && (
                  <span className={styles.helper}>
                    Expected totals: {removeForm.expectedTokenA || "—"} token0 /{" "}
                    {removeForm.expectedTokenB || "—"} token1
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        <footer className={styles.footnote}>
          MegaSwap Router {shortAddress(routerAddress)} · WMegaETH{" "}
          {shortAddress(wmegaAddress)}
        </footer>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {tokenDialogOpen && (
        <div className={styles.dialogBackdrop} onClick={closeTokenDialog}>
          <div
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <span className={styles.dialogTitle}>
                Select{" "}
                {tokenDialogSide === "swapIn"
                  ? "pay"
                  : tokenDialogSide === "swapOut"
                    ? "receive"
                    : tokenDialogSide === "liquidityA"
                      ? "deposit A"
                      : "deposit B"}{" "}
                token
              </span>
              <button
                type="button"
                className={styles.dialogClose}
                onClick={closeTokenDialog}
              >
                Close
              </button>
            </div>
            <input
              className={styles.dialogSearch}
              placeholder="Search name or paste address"
              value={tokenSearch}
              onChange={(event) => setTokenSearch(event.target.value)}
              autoFocus
            />
            <div className={styles.dialogList}>
              {filteredTokens.length === 0 && !showCustomOption ? (
                <div className={styles.dialogEmpty}>No tokens found</div>
              ) : (
                filteredTokens.map((token) => (
                  <button
                    type="button"
                    key={token.address}
                    className={`${styles.dialogItem} ${
                      activeAddress === token.address.toLowerCase()
                        ? styles.dialogSelected
                        : ""
                    }`.trim()}
                    onClick={() => handleSelectToken(token)}
                  >
                    <div className={styles.dialogMeta}>
                      <span className={styles.dialogSymbol}>
                        {token.symbol}
                      </span>
                      <span className={styles.dialogAddress}>{token.name}</span>
                    </div>
                    <span className={styles.dialogAddress}>
                      {shortAddress(token.address)}
                    </span>
                  </button>
                ))
              )}
              {showCustomOption && (
                <button
                  type="button"
                  className={styles.dialogItem}
                  onClick={() => handleSelectCustomToken(tokenSearch)}
                >
                  <div className={styles.dialogMeta}>
                    <span className={styles.dialogSymbol}>Custom</span>
                    <span className={styles.dialogAddress}>
                      Use provided address
                    </span>
                  </div>
                  <span className={styles.dialogAddress}>
                    {shortAddress(tokenSearch.trim())}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

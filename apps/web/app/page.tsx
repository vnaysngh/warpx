"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ToastContainer, type Toast } from "@/components/Toast";
import {
  BrowserProvider,
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
const DEFAULT_SLIPPAGE_BPS = 50n; // 0.50% default slippage tolerance
const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

/**
 * Format numbers with smart decimal handling (Uniswap/PancakeSwap style)
 * - Strips trailing zeros
 * - Shows appropriate precision based on magnitude
 */
const formatNumber = (
  value: string | number,
  maxDecimals: number = 6
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "0";

  // For very small numbers, show more decimals
  if (num > 0 && num < 0.0001) {
    return num.toFixed(8).replace(/\.?0+$/, "");
  }

  // For percentage values close to 100
  if (num >= 99.99 && num <= 100) {
    return "100";
  }

  // For regular numbers, use maxDecimals and strip trailing zeros
  return num.toFixed(maxDecimals).replace(/\.?0+$/, "");
};

/**
 * Format percentage values (0-100)
 */
const formatPercent = (
  value: string | number,
  maxDecimals: number = 4
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "0";

  // If it's 100 or very close, just show 100
  if (num >= 99.99) return "100";

  // If it's very small, show more precision
  if (num > 0 && num < 0.01) {
    return num.toFixed(6).replace(/\.?0+$/, "");
  }

  // Otherwise use provided decimals and strip trailing zeros
  return num.toFixed(maxDecimals).replace(/\.?0+$/, "");
};

/**
 * Uniswap V2 Style Swap Calculations
 * Uses BigInt for exact precision (no floating point errors)
 */

// Constants
const ONE_BIPS = 10000n; // 10000 basis points = 100%
const MINIMUM_LIQUIDITY = 1000n; // Minimum liquidity burned
const FEES_DENOMINATOR = 1000n; // Standard Uniswap fee = 0.3% = 3/1000
const FEES_NUMERATOR = 997n; // 1000 - 3 fee

/**
 * Calculate output amount for a swap using Uniswap V2 constant product formula
 * Formula: outputAmount = (inputAmount * 997 * reserveOut) / (1000 * reserveIn + inputAmount * 997)
 * This accounts for the 0.3% Uniswap fee applied to input
 */
const getSwapOutputAmount = (
  inputAmountWei: bigint,
  reserveInWei: bigint,
  reserveOutWei: bigint
): bigint => {
  if (inputAmountWei <= 0n || reserveInWei <= 0n || reserveOutWei <= 0n) {
    return 0n;
  }

  const inputWithFee = inputAmountWei * FEES_NUMERATOR;
  const numerator = inputWithFee * reserveOutWei;
  const denominator = reserveInWei * FEES_DENOMINATOR + inputWithFee;

  return numerator / denominator;
};

/**
 * Calculate input amount needed to get desired output (reverse calculation)
 * Formula: inputAmount = (1000 * reserveIn * outputAmount) / (997 * (reserveOut - outputAmount)) + 1
 * The +1 ensures slippage protection by rounding up
 */
const getSwapInputAmount = (
  outputAmountWei: bigint,
  reserveInWei: bigint,
  reserveOutWei: bigint
): bigint => {
  if (outputAmountWei <= 0n || reserveInWei <= 0n || reserveOutWei <= 0n) {
    return 0n;
  }

  if (outputAmountWei >= reserveOutWei) {
    return 0n; // Insufficient liquidity
  }

  const numerator = reserveInWei * outputAmountWei * FEES_DENOMINATOR;
  const denominator = (reserveOutWei - outputAmountWei) * FEES_NUMERATOR;

  return numerator / denominator + 1n;
};

/**
 * Calculate minimum output amount given slippage tolerance (in basis points)
 * For exact input trades: minOutput = outputAmount * (1 - slippageTolerance%)
 * Formula: minOutput = (outputAmount * (ONE_BIPS - slippageBips)) / ONE_BIPS
 */
const getMinimumOutputAmount = (
  outputAmountWei: bigint,
  slippageBips: bigint
): bigint => {
  if (outputAmountWei <= 0n) return 0n;
  return (outputAmountWei * (ONE_BIPS - slippageBips)) / ONE_BIPS;
};

/**
 * Calculate maximum input amount given slippage tolerance (in basis points)
 * For exact output trades: maxInput = inputAmount * (1 + slippageTolerance%)
 * Formula: maxInput = (inputAmount * (ONE_BIPS + slippageBips)) / ONE_BIPS
 */
const getMaximumInputAmount = (
  inputAmountWei: bigint,
  slippageBips: bigint
): bigint => {
  if (inputAmountWei <= 0n) return 0n;
  return (inputAmountWei * (ONE_BIPS + slippageBips)) / ONE_BIPS;
};

/**
 * Calculate liquidity tokens minted when adding liquidity (Uniswap V2 formula)
 * Initial liquidity: sqrt(amountA * amountB) - MINIMUM_LIQUIDITY
 * Existing liquidity: min((amountA * totalSupply) / reserveA, (amountB * totalSupply) / reserveB)
 */
const getLiquidityMinted = (
  amountAWei: bigint,
  amountBWei: bigint,
  reserveAWei: bigint,
  reserveBWei: bigint,
  totalSupplyWei: bigint
): bigint => {
  if (amountAWei <= 0n || amountBWei <= 0n) return 0n;

  if (totalSupplyWei === 0n) {
    // Initial liquidity: sqrt(amountA * amountB) - 1000
    const product = amountAWei * amountBWei;
    const sqrtProduct = BigInt(Math.floor(Math.sqrt(Number(product))));
    return sqrtProduct > MINIMUM_LIQUIDITY
      ? sqrtProduct - MINIMUM_LIQUIDITY
      : 0n;
  } else {
    // Existing liquidity: min of the two ratios
    if (reserveAWei === 0n || reserveBWei === 0n) return 0n;

    const liquidity1 = (amountAWei * totalSupplyWei) / reserveAWei;
    const liquidity2 = (amountBWei * totalSupplyWei) / reserveBWei;

    return liquidity1 < liquidity2 ? liquidity1 : liquidity2;
  }
};

/**
 * Calculate amounts received when removing liquidity
 * amountOut = (liquidityAmount * reserve) / totalSupply
 */
const getLiquidityRemoveAmounts = (
  liquidityWei: bigint,
  reserveAWei: bigint,
  reserveBWei: bigint,
  totalSupplyWei: bigint
): { amountAWei: bigint; amountBWei: bigint } => {
  if (liquidityWei <= 0n || totalSupplyWei === 0n) {
    return { amountAWei: 0n, amountBWei: 0n };
  }

  const amountAWei = (liquidityWei * reserveAWei) / totalSupplyWei;
  const amountBWei = (liquidityWei * reserveBWei) / totalSupplyWei;

  return { amountAWei, amountBWei };
};

const parseErrorMessage = (error: any): string => {
  const toLower = (value: unknown) =>
    typeof value === "string" ? value.toLowerCase() : "";
  const message = toLower(error?.message);
  const shortMessage = toLower(error?.shortMessage);
  const reason = toLower(error?.reason);

  // User rejected transaction
  if (
    message.includes("user rejected") ||
    message.includes("user denied") ||
    shortMessage.includes("user rejected") ||
    shortMessage.includes("user denied") ||
    error?.code === 4001 ||
    error?.code === "ACTION_REJECTED"
  ) {
    return "Transaction rejected by user.";
  }

  // Insufficient funds
  if (
    message.includes("insufficient funds") ||
    shortMessage.includes("insufficient funds")
  ) {
    return "Insufficient funds to complete transaction.";
  }

  if (
    message.includes("insufficient output amount") ||
    shortMessage.includes("insufficient output amount") ||
    reason.includes("insufficient_output_amount")
  ) {
    return "Swap failed: received less than the minimum amount. Increase slippage or reduce the trade size.";
  }

  // Network issues
  if (message.includes("network") || message.includes("timeout")) {
    return "Network error. Please check your connection and try again.";
  }

  // Contract revert with reason
  if (typeof error?.reason === "string") {
    return `Transaction failed: ${error.reason}`;
  }

  // Use shortMessage if available (wagmi/viem provides these)
  if (typeof error?.shortMessage === "string") {
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

type TokenManifest = {
  tokens?: Array<{
    symbol: string;
    name: string;
    address: string;
    decimals?: number;
  }>;
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
  }
];

const DEFAULT_TOKEN_DECIMALS = 18;

const SWAP_DEFAULT = {
  tokenIn: "",
  tokenOut: "",
  amountIn: "",
  minOut: "",
  maxInput: "" // For exact output swaps with slippage
};

const LIQUIDITY_DEFAULT = {
  amountA: "",
  amountB: ""
};

type Quote = { amount: string; symbol: string };
type ReverseQuote = { amount: string; symbolIn: string; symbolOut: string };

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
      if (loadingToastRef.current) {
        removeToast(loadingToastRef.current);
      }
      const id = addToast(message, "loading");
      loadingToastRef.current = id;
      return id;
    },
    [addToast, removeToast]
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
  const [swapPairReserves, setSwapPairReserves] = useState<{
    reserveIn: bigint;
    reserveOut: bigint;
    pairAddress: string;
  } | null>(null);
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
  useEffect(() => {
    let cancelled = false;

    const loadTokenManifest = async () => {
      const network = deployment?.network;
      if (!network) return;
      try {
        const manifestPaths = [
          `/deployments/${network}.tokens.json`,
          `/deployments/${network.toLowerCase()}.tokens.json`
        ];
        let manifest: TokenManifest | null = null;

        for (const manifestPath of manifestPaths) {
          try {
            const response = await fetch(manifestPath, {
              cache: "no-store"
            });
            if (response.ok) {
              manifest = (await response.json()) as TokenManifest;
              break;
            }
          } catch (innerError) {
            console.warn(
              "[tokens] manifest fetch failed",
              manifestPath,
              innerError
            );
          }
        }

        if (!manifest) {
          throw new Error(`Token manifest for ${network} not found`);
        }
        if (cancelled) return;

        const manifestTokens = Array.isArray(manifest.tokens)
          ? manifest.tokens
          : [];

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();
          const addToken = (token: TokenDescriptor) => {
            if (!token.address || !isAddress(token.address)) return;
            const key = token.address.toLowerCase();
            merged.set(key, {
              ...token,
              address: token.address,
              decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
            });
          };

          [...TOKEN_CATALOG, ...prev].forEach(addToken);
          manifestTokens.forEach((token) =>
            addToken({
              symbol: token.symbol,
              name: token.name,
              address: token.address,
              decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
            })
          );

          return Array.from(merged.values());
        });
      } catch (err) {
        console.warn("[tokens] failed to load manifest tokens", err);
      }
    };

    loadTokenManifest();
    return () => {
      cancelled = true;
    };
  }, [deployment?.network]);
  const [liquidityPairReserves, setLiquidityPairReserves] = useState<{
    reserveA: string;
    reserveB: string;
    pairAddress: string;
    totalSupply: string;
    // Raw BigInt values for exact calculations
    reserveAWei: bigint;
    reserveBWei: bigint;
    totalSupplyWei: bigint;
  } | null>(null);
  const liquidityEditingFieldRef = useRef<"A" | "B" | null>(null);
  const swapEditingFieldRef = useRef<"amountIn" | "minOut" | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reverseQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [showLiquidityConfirm, setShowLiquidityConfirm] = useState(false);
  const [removeLiquidityPercent, setRemoveLiquidityPercent] = useState("25");
  const [expectedRemoveAmounts, setExpectedRemoveAmounts] = useState<{
    amountA: string;
    amountB: string;
  } | null>(null);
  const [userPooledAmounts, setUserPooledAmounts] = useState<{
    amountA: string;
    amountB: string;
  } | null>(null);
  const [lpTokenInfo, setLpTokenInfo] = useState<{
    balance: string;
    poolShare: string;
  } | null>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const showWalletActions = hasMounted && isWalletConnected;

  useEffect(() => {
    if (!tokenList.length) return;

    const normalizeAddress = (value?: string | null) =>
      value ? value.toLowerCase() : null;

    const findByAddress = (address?: string | null) => {
      const normalized = normalizeAddress(address);
      if (!normalized) return null;
      return (
        tokenList.find((token) => token.address.toLowerCase() === normalized) ??
        null
      );
    };

    const nextSelectedIn =
      findByAddress(selectedIn?.address) ?? tokenList[0] ?? null;
    const nextSelectedOut =
      findByAddress(selectedOut?.address) ??
      tokenList.find(
        (token) =>
          token.address.toLowerCase() !==
          normalizeAddress(nextSelectedIn?.address)
      ) ??
      nextSelectedIn;
    const nextTokenA =
      findByAddress(liquidityTokenA?.address) ?? nextSelectedIn;
    const nextTokenB =
      findByAddress(liquidityTokenB?.address) ??
      tokenList.find(
        (token) =>
          token.address.toLowerCase() !== normalizeAddress(nextTokenA?.address)
      ) ??
      nextTokenA;

    if (nextSelectedIn !== selectedIn) {
      setSelectedIn(nextSelectedIn);
    }
    if (nextSelectedOut !== selectedOut) {
      setSelectedOut(nextSelectedOut);
    }
    if (nextTokenA !== liquidityTokenA) {
      setLiquidityTokenA(nextTokenA);
    }
    if (nextTokenB !== liquidityTokenB) {
      setLiquidityTokenB(nextTokenB);
    }
  }, [tokenList, selectedIn, selectedOut, liquidityTokenA, liquidityTokenB]);

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
        balanceQueryEnabled &&
        tokenAIsAddress &&
        Boolean(liquidityTokenAAddress)
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
        balanceQueryEnabled &&
        tokenBIsAddress &&
        Boolean(liquidityTokenBAddress)
    }
  });

  const tokenABalanceFormatted = balanceAData?.formatted ?? null;
  const tokenBBalanceFormatted = balanceBData?.formatted ?? null;
  const tokenASymbol = balanceAData?.symbol ?? liquidityTokenA?.symbol ?? null;
  const tokenBSymbol = balanceBData?.symbol ?? liquidityTokenB?.symbol ?? null;

  // Fetch balance for swap "selectedIn" token
  const swapInTokenAddress = selectedIn?.address ?? "";
  const swapInIsAddress = isAddress(swapInTokenAddress);
  const { data: swapInBalanceData } = useBalance({
    address: balanceQueryEnabled ? (address as Address) : undefined,
    token:
      balanceQueryEnabled && swapInIsAddress
        ? (swapInTokenAddress as Address)
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        balanceQueryEnabled && swapInIsAddress && Boolean(swapInTokenAddress)
    }
  });
  const swapInBalanceFormatted = swapInBalanceData?.formatted ?? null;
  const swapInSymbol = swapInBalanceData?.symbol ?? selectedIn?.symbol ?? null;

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
      setSwapQuote(null);
      setReverseQuote(null);
      setNeedsApproval(false);
      setNeedsApprovalA(false);
      setNeedsApprovalB(false);
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
    // Clear any existing timer
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    // Only run this effect when user is editing amountIn
    if (swapEditingFieldRef.current !== "amountIn") {
      return;
    }

    // If amountIn is empty, clear minOut immediately (no debounce)
    if (!swapForm.amountIn || swapForm.amountIn.trim() === "") {
      setSwapQuote(null);
      setSwapForm((prev) => ({ ...prev, minOut: "" }));
      setIsCalculatingQuote(false);
      return;
    }

    // Debounce the quote calculation
    quoteDebounceTimerRef.current = setTimeout(async () => {
      // Start calculating (moved inside timeout to avoid hydration issues)
      setIsCalculatingQuote(true);

      if (!routerAddress) {
        setIsCalculatingQuote(false);
        return;
      }
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) {
        setIsCalculatingQuote(false);
        return;
      }
      if (Number(swapForm.amountIn) <= 0) {
        setIsCalculatingQuote(false);
        return;
      }

      try {
        const tokenInContract = getToken(swapForm.tokenIn, readProvider);
        const tokenOutContract = getToken(swapForm.tokenOut, readProvider);

        const decimalsIn = await tokenInContract
          .decimals()
          .then((value) => Number(value))
          .catch(() => DEFAULT_TOKEN_DECIMALS);

        const decimalsOut = await tokenOutContract
          .decimals()
          .then((value) => Number(value))
          .catch(() => DEFAULT_TOKEN_DECIMALS);

        const symbolOut = await tokenOutContract.symbol().catch(() => "TOKEN");

        const amountInWei = parseUnits(swapForm.amountIn, decimalsIn);
        if (amountInWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        // Use exact Uniswap V2 formula for swap calculation
        if (!swapPairReserves) {
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        // Debug: log swap calculation inputs
        console.log("[swap] quote calculation inputs:", {
          amountIn: swapForm.amountIn,
          amountInWei: amountInWei.toString(),
          reserveIn: swapPairReserves.reserveIn.toString(),
          reserveOut: swapPairReserves.reserveOut.toString(),
          decimalsIn,
          decimalsOut,
          symbolOut
        });

        // Calculate output using exact Uniswap V2 constant product formula
        const amountOutWei = getSwapOutputAmount(
          amountInWei,
          swapPairReserves.reserveIn,
          swapPairReserves.reserveOut
        );

        console.log("[swap] quote calculation output:", {
          amountOutWei: amountOutWei.toString(),
          isZero: amountOutWei === 0n
        });

        if (amountOutWei === 0n) {
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        // Format output amount
        const formattedOut = formatUnits(amountOutWei, decimalsOut);
        const limitedOut = formatNumber(formattedOut, Math.min(6, decimalsOut));

        // Calculate minimum output with exact slippage formula
        const minOutWei = getMinimumOutputAmount(
          amountOutWei,
          DEFAULT_SLIPPAGE_BPS
        );
        const minOutWeiAdjusted = minOutWei > 0n ? minOutWei : 1n;
        const formattedMinOut = formatUnits(minOutWeiAdjusted, decimalsOut);
        const limitedMinOut = formatNumber(
          formattedMinOut,
          Math.min(6, decimalsOut)
        );

        // Only update minOut if user is still editing amountIn
        if (swapEditingFieldRef.current === "amountIn") {
          setSwapQuote({ amount: limitedOut, symbol: symbolOut });
          setSwapForm((prev) => ({ ...prev, minOut: limitedMinOut }));
        }
        setIsCalculatingQuote(false);
      } catch (err: any) {
        console.error("[quote] calculation error", err);
        setSwapQuote(null);
        setSwapForm((prev) => ({ ...prev, minOut: "" }));
        setIsCalculatingQuote(false);

        // Handle specific error for insufficient liquidity
        if (
          err?.reason?.includes("ds-math-sub-underflow") ||
          err?.message?.includes("ds-math-sub-underflow")
        ) {
          showError("Insufficient liquidity in pool for this amount.");
        } else if (
          err?.message?.toLowerCase().includes("insufficient") ||
          err?.reason?.toLowerCase().includes("insufficient")
        ) {
          showError("Insufficient liquidity for this trade.");
        } else if (err?.message || err?.reason) {
          showError(`Unable to calculate swap: ${err.reason || err.message}`);
        }
      }
    }, 500);

    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.amountIn,
    swapPairReserves
  ]);

  useEffect(() => {
    // Clear any existing timer
    if (reverseQuoteDebounceTimerRef.current) {
      clearTimeout(reverseQuoteDebounceTimerRef.current);
    }

    // Only run this effect when user is editing minOut
    if (swapEditingFieldRef.current !== "minOut") {
      return;
    }

    // If minOut is empty, clear amountIn immediately (no debounce)
    if (!swapForm.minOut || swapForm.minOut.trim() === "") {
      setReverseQuote(null);
      setSwapForm((prev) => ({ ...prev, amountIn: "" }));
      setIsCalculatingQuote(false);
      return;
    }

    // Debounce the reverse quote calculation
    reverseQuoteDebounceTimerRef.current = setTimeout(async () => {
      // Start calculating (moved inside timeout to avoid hydration issues)
      setIsCalculatingQuote(true);

      if (!routerAddress) {
        setIsCalculatingQuote(false);
        return;
      }
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) {
        setIsCalculatingQuote(false);
        return;
      }
      if (Number(swapForm.minOut) <= 0) {
        setIsCalculatingQuote(false);
        return;
      }

      try {
        const tokenInContract = getToken(swapForm.tokenIn, readProvider);
        const tokenOutContract = getToken(swapForm.tokenOut, readProvider);

        const decimalsIn = await tokenInContract
          .decimals()
          .then((value) => Number(value))
          .catch(() => DEFAULT_TOKEN_DECIMALS);

        const decimalsOut = await tokenOutContract
          .decimals()
          .then((value) => Number(value))
          .catch(() => DEFAULT_TOKEN_DECIMALS);

        const symbolIn = await tokenInContract.symbol().catch(() => "TOKEN");
        const symbolOut = await tokenOutContract.symbol().catch(() => "TOKEN");

        const desiredOutWei = parseUnits(swapForm.minOut, decimalsOut);
        if (desiredOutWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        // Use exact Uniswap V2 formula for reverse calculation
        if (!swapPairReserves) {
          setReverseQuote(null);
          setSwapForm((prev) => ({ ...prev, amountIn: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        // Calculate input needed to get desired output using exact Uniswap V2 formula
        const amountNeeded = getSwapInputAmount(
          desiredOutWei,
          swapPairReserves.reserveIn,
          swapPairReserves.reserveOut
        );

        if (amountNeeded === 0n) {
          setReverseQuote(null);
          setSwapForm((prev) => ({ ...prev, amountIn: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        // Format input amount
        const formattedIn = formatUnits(amountNeeded, decimalsIn);
        const limitedIn = formatNumber(formattedIn, Math.min(6, decimalsIn));

        // Calculate maximum input with exact slippage formula (for exact output trades)
        const maxInputWei = getMaximumInputAmount(
          amountNeeded,
          DEFAULT_SLIPPAGE_BPS
        );
        const maxInputFormatted = formatUnits(maxInputWei, decimalsIn);
        const limitedMaxInput = formatNumber(
          maxInputFormatted,
          Math.min(6, decimalsIn)
        );

        // Only update amountIn if user is still editing minOut
        if (swapEditingFieldRef.current === "minOut") {
          setReverseQuote({ amount: limitedIn, symbolIn, symbolOut });
          setSwapForm((prev) => ({
            ...prev,
            amountIn: limitedIn,
            maxInput: limitedMaxInput // Store max input for transaction
          }));
        }
        setIsCalculatingQuote(false);
      } catch (err: any) {
        console.error("[reverse quote] calculation error", err);
        setReverseQuote(null);
        setIsCalculatingQuote(false);

        // Handle specific error for insufficient liquidity
        if (
          err?.reason?.includes("ds-math-sub-underflow") ||
          err?.message?.includes("ds-math-sub-underflow")
        ) {
          showError("Insufficient liquidity in pool for this amount.");
        } else if (
          err?.message?.toLowerCase().includes("insufficient") ||
          err?.reason?.toLowerCase().includes("insufficient")
        ) {
          showError("Insufficient liquidity for this trade.");
        } else if (err?.message || err?.reason) {
          showError(
            `Unable to calculate reverse quote: ${err.reason || err.message}`
          );
        }
      }
    }, 500);

    return () => {
      if (reverseQuoteDebounceTimerRef.current) {
        clearTimeout(reverseQuoteDebounceTimerRef.current);
      }
    };
  }, [swapForm.tokenIn, swapForm.tokenOut, swapForm.minOut, swapPairReserves]);

  // Fetch liquidity pair reserves for auto-calculation
  useEffect(() => {
    let active = true;
    const fetchPairReserves = async () => {
      if (
        !factoryAddress ||
        !liquidityTokenAAddress ||
        !liquidityTokenBAddress
      ) {
        if (active) setLiquidityPairReserves(null);
        return;
      }

      try {
        const factory = getFactory(factoryAddress, readProvider);
        const pairAddress = await factory.getPair(
          liquidityTokenAAddress,
          liquidityTokenBAddress
        );
        if (pairAddress === ZeroAddress) {
          if (active) setLiquidityPairReserves(null);
          return;
        }

        // Get reserves from pair contract and total supply from ERC20 interface
        const pairContract = getPair(pairAddress, readProvider);
        const lpTokenContract = getToken(pairAddress, readProvider);
        const [reserves, totalSupply] = await Promise.all([
          pairContract.getReserves(),
          lpTokenContract.totalSupply()
        ]);

        // Determine which reserve corresponds to which token
        const token0 = await pairContract.token0();
        const isToken0A =
          token0.toLowerCase() === liquidityTokenAAddress.toLowerCase();

        const reserveA = isToken0A ? reserves[0] : reserves[1];
        const reserveB = isToken0A ? reserves[1] : reserves[0];
        const reserveAWei = toBigInt(reserveA);
        const reserveBWei = toBigInt(reserveB);
        const totalSupplyWei = toBigInt(totalSupply);

        if (active) {
          setLiquidityPairReserves({
            reserveA: formatUnits(reserveA, liquidityTokenA?.decimals ?? 18),
            reserveB: formatUnits(reserveB, liquidityTokenB?.decimals ?? 18),
            pairAddress,
            totalSupply: formatUnits(totalSupply, 18),
            reserveAWei,
            reserveBWei,
            totalSupplyWei
          });
        }
      } catch (err) {
        console.error("[liquidity] fetch pair reserves failed", err);
        if (active) setLiquidityPairReserves(null);
      }
    };

    fetchPairReserves();
    return () => {
      active = false;
    };
  }, [
    factoryAddress,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    liquidityTokenA?.decimals,
    liquidityTokenB?.decimals,
    readProvider
  ]);

  // Fetch swap pair reserves for exact calculation
  useEffect(() => {
    let active = true;

    const fetchSwapReserves = async () => {
      // Clear reserves if tokens not properly selected or factory not available
      if (!selectedIn?.address || !selectedOut?.address || !factoryAddress) {
        if (active) setSwapPairReserves(null);
        return;
      }

      if (selectedIn.address === selectedOut.address) {
        if (active) setSwapPairReserves(null);
        return;
      }

      try {
        const factory = getFactory(factoryAddress, readProvider);
        const pairAddress = await factory.getPair(
          selectedIn.address,
          selectedOut.address
        );

        if (pairAddress === ZeroAddress) {
          if (active) setSwapPairReserves(null);
          return;
        }

        // Get reserves from pair
        const pairContract = getPair(pairAddress, readProvider);
        const reserves = await pairContract.getReserves();

        // Determine which reserve is which
        const token0 = await pairContract.token0();
        const isToken0In =
          token0.toLowerCase() === selectedIn.address.toLowerCase();

        const reserveIn = isToken0In ? reserves[0] : reserves[1];
        const reserveOut = isToken0In ? reserves[1] : reserves[0];

        console.log("[swap] pair reserves fetched:", {
          pairAddress,
          token0,
          selectedIn: selectedIn.address,
          selectedOut: selectedOut.address,
          isToken0In,
          reserve0: reserves[0].toString(),
          reserve1: reserves[1].toString(),
          reserveIn: reserveIn.toString(),
          reserveOut: reserveOut.toString()
        });

        if (active) {
          setSwapPairReserves({
            reserveIn,
            reserveOut,
            pairAddress
          });
        }
      } catch (err) {
        console.error("[swap] fetch pair reserves failed", err);
        if (active) setSwapPairReserves(null);
      }
    };

    fetchSwapReserves();
    return () => {
      active = false;
    };
  }, [selectedIn?.address, selectedOut?.address, factoryAddress, readProvider]);

  // Calculate expected removal amounts for remove liquidity
  useEffect(() => {
    let active = true;
    const calculateRemovalAmounts = async () => {
      if (
        !liquidityPairReserves ||
        !walletAccount ||
        !liquidityPairReserves.pairAddress ||
        liquidityMode !== "remove"
      ) {
        if (active) {
          setExpectedRemoveAmounts(null);
          setUserPooledAmounts(null);
        }
        return;
      }

      try {
        const lpToken = getToken(
          liquidityPairReserves.pairAddress,
          readProvider
        );
        const [userBalance, totalSupply] = await Promise.all([
          lpToken.balanceOf(walletAccount),
          lpToken.totalSupply()
        ]);

        const percent = Number(removeLiquidityPercent) / 100;
        const liquidityToRemove =
          (toBigInt(userBalance) * BigInt(Math.floor(percent * 100))) / 100n;

        // Format LP token balance
        const lpBalanceFormatted = formatUnits(userBalance, 18);

        // Calculate pool share percentage: (userBalance / totalSupply) * 100
        const poolSharePercent =
          totalSupply > 0n
            ? (Number(userBalance) / Number(totalSupply)) * 100
            : 0;

        if (liquidityToRemove === 0n || totalSupply === 0n) {
          if (active) {
            setExpectedRemoveAmounts(null);
            setUserPooledAmounts(null);
            setLpTokenInfo({
              balance: lpBalanceFormatted,
              poolShare: poolSharePercent.toString()
            });
          }
          return;
        }

        // Calculate expected amounts using exact BigInt precision: (liquidity * reserve) / totalSupply

        // Calculate user's total pooled amounts (100% of their position)
        const { amountAWei: pooledAWei, amountBWei: pooledBWei } =
          getLiquidityRemoveAmounts(
            userBalance,
            liquidityPairReserves.reserveAWei,
            liquidityPairReserves.reserveBWei,
            totalSupply
          );

        // Calculate amounts to be removed based on percentage using BigInt
        const liquidityToRemoveForCalc =
          (userBalance * BigInt(Math.floor(percent * 100))) / 100n;
        const { amountAWei: expectedAWei, amountBWei: expectedBWei } =
          getLiquidityRemoveAmounts(
            liquidityToRemoveForCalc,
            liquidityPairReserves.reserveAWei,
            liquidityPairReserves.reserveBWei,
            totalSupply
          );

        if (active) {
          setLpTokenInfo({
            balance: lpBalanceFormatted,
            poolShare: poolSharePercent.toString()
          });

          // Format pooled amounts using exact token decimals
          const pooledAFormatted = formatUnits(
            pooledAWei,
            liquidityTokenA?.decimals ?? 18
          );
          const pooledBFormatted = formatUnits(
            pooledBWei,
            liquidityTokenB?.decimals ?? 18
          );
          setUserPooledAmounts({
            amountA: formatNumber(
              pooledAFormatted,
              Math.min(6, liquidityTokenA?.decimals ?? 18)
            ),
            amountB: formatNumber(
              pooledBFormatted,
              Math.min(6, liquidityTokenB?.decimals ?? 18)
            )
          });

          // Format expected removal amounts using exact token decimals
          const expectedAFormatted = formatUnits(
            expectedAWei,
            liquidityTokenA?.decimals ?? 18
          );
          const expectedBFormatted = formatUnits(
            expectedBWei,
            liquidityTokenB?.decimals ?? 18
          );
          setExpectedRemoveAmounts({
            amountA: formatNumber(
              expectedAFormatted,
              Math.min(6, liquidityTokenA?.decimals ?? 18)
            ),
            amountB: formatNumber(
              expectedBFormatted,
              Math.min(6, liquidityTokenB?.decimals ?? 18)
            )
          });
        }
      } catch (err) {
        console.error("[liquidity] calculate removal amounts failed", err);
        if (active) {
          setExpectedRemoveAmounts(null);
          setUserPooledAmounts(null);
          setLpTokenInfo(null);
        }
      }
    };

    calculateRemovalAmounts();
    return () => {
      active = false;
    };
  }, [
    liquidityPairReserves,
    walletAccount,
    removeLiquidityPercent,
    liquidityMode,
    readProvider,
    liquidityTokenA?.decimals,
    liquidityTokenB?.decimals
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

      showLoading("Confirm transaction in your wallet...");
      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as `0x${string}`, parsedAmount],
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: 100000n
      });
      showLoading("Approval pending...");
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

  const handleSetMaxSwapAmount = () => {
    if (!swapInBalanceFormatted) return;
    setSwapForm((prev) => ({
      ...prev,
      amountIn: swapInBalanceFormatted
    }));
  };

  const handleSwap = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenIn, tokenOut, amountIn, minOut, maxInput } = swapForm;
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      showError("Enter valid ERC-20 token addresses for the swap.");
      return;
    }
    if (!amountIn || !minOut) {
      showError("Provide both swap amount and expected output.");
      return;
    }
    try {
      setIsSubmitting(true);

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
      if (amountInWei <= 0n) {
        showError("Swap amount is too small.");
        return;
      }
      const minOutWei = parseUnits(minOut, decimalsOut);
      if (minOutWei <= 0n) {
        showError("Minimum received amount must be greater than zero.");
        return;
      }

      // Determine swap type based on which field user edited
      // Exact input: user specified amountIn
      // Exact output: user specified minOut as desired output, maxInput was calculated
      const isExactInput = swapEditingFieldRef.current === "amountIn";
      const amountToApprove = isExactInput
        ? amountInWei
        : parseUnits(maxInput || amountIn, decimalsIn);

      const allowance = await readContract(wagmiConfig, {
        address: tokenIn as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(allowance) < amountToApprove) {
        showLoading("Confirm transaction in your wallet...");
        const approveHash = await writeContract(wagmiConfig, {
          address: tokenIn as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, amountToApprove],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 100000n
        });
        showLoading("Approval pending...");
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      showLoading("Confirm transaction in your wallet...");

      // Execute exact input swap: swapExactTokensForTokens(amountIn, minOut, path, to, deadline)
      // Router only supports exact input swaps
      // For exact output mode: maxInput was calculated for UI feedback, but we execute with exact input + calculated minOut
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
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: 300000n
      });

      showLoading("Swap pending...");
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

      // Check and handle approvals for both tokens
      const allowanceA = await readContract(wagmiConfig, {
        address: tokenA as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(allowanceA) < amountAWei) {
        showLoading("Confirm transaction in your wallet...");
        const approveAHash = await writeContract(wagmiConfig, {
          address: tokenA as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, amountAWei],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 100000n
        });
        showLoading(
          `${liquidityTokenA?.symbol || "Token A"} approval pending...`
        );
        await waitForTransactionReceipt(wagmiConfig, { hash: approveAHash });
        setNeedsApprovalA(false);
      }

      const allowanceB = await readContract(wagmiConfig, {
        address: tokenB as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(allowanceB) < amountBWei) {
        showLoading("Confirm transaction in your wallet...");
        const approveBHash = await writeContract(wagmiConfig, {
          address: tokenB as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, amountBWei],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 100000n
        });
        showLoading(
          `${liquidityTokenB?.symbol || "Token B"} approval pending...`
        );
        await waitForTransactionReceipt(wagmiConfig, { hash: approveBHash });
        setNeedsApprovalB(false);
      }

      showLoading("Confirm transaction in your wallet...");
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
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: 5000000n
      });
      showLoading("Adding liquidity...");
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
    const ctx = ensureWallet();
    if (!ctx) return;

    if (!liquidityPairReserves?.pairAddress) {
      showError("Please select a valid liquidity pair.");
      return;
    }

    const percent = Number(removeLiquidityPercent) / 100;
    if (percent <= 0 || percent > 1) {
      showError("Please enter a valid percentage (1-100).");
      return;
    }

    try {
      setIsSubmitting(true);

      const pairAddress = liquidityPairReserves.pairAddress;
      const tokenA = liquidityTokenAAddress;
      const tokenB = liquidityTokenBAddress;

      // Get user's LP balance
      const userBalance = await readContract(wagmiConfig, {
        address: pairAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [ctx.account as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      const liquidityToRemove =
        (toBigInt(userBalance) * BigInt(Math.floor(percent * 100))) / 100n;

      if (liquidityToRemove === 0n) {
        showError("Insufficient LP balance to remove.");
        return;
      }

      // Check and handle LP token approval
      const allowance = await readContract(wagmiConfig, {
        address: pairAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(allowance) < liquidityToRemove) {
        showLoading("Confirm transaction in your wallet...");
        const approveHash = await writeContract(wagmiConfig, {
          address: pairAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, liquidityToRemove],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 100000n
        });
        showLoading("LP approval pending...");
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      showLoading("Confirm transaction in your wallet...");
      const txHash = await writeContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: pancakeRouterAbi,
        functionName: "removeLiquidity",
        args: [
          tokenA as `0x${string}`,
          tokenB as `0x${string}`,
          liquidityToRemove,
          0n,
          0n,
          ctx.account as `0x${string}`,
          BigInt(nowPlusMinutes(10))
        ],
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: 500000n
      });

      showLoading("Removing liquidity...");
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });

      showSuccess(
        `Liquidity removed successfully. Removed ${removeLiquidityPercent}% of your position.`
      );

      // Reset percentage to 25%
      setRemoveLiquidityPercent("25");
    } catch (err: any) {
      console.error("[liquidity] remove failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
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
  } else if (isCalculatingQuote) {
    swapButtonLabel = "Calculating...";
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

  const slippagePercentDisplay = (Number(DEFAULT_SLIPPAGE_BPS) / 100)
    .toFixed(2)
    .replace(/\.?0+$/, "");
  const swapSummaryMessage = swapQuote
    ? `Quote ≈ ${swapQuote.amount} ${swapQuote.symbol} (min received with ${slippagePercentDisplay}% slippage: ${swapForm.minOut || "0"})`
    : null;

  const liquidityTokensReady =
    isAddress(liquidityTokenAAddress) &&
    isAddress(liquidityTokenBAddress) &&
    liquidityTokenAAddress.toLowerCase() !==
      liquidityTokenBAddress.toLowerCase();

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

  const handleLiquidityAmountAChange = (value: string) => {
    // Mark that user is editing field A
    liquidityEditingFieldRef.current = "A";

    setLiquidityForm((prev) => {
      // If we're not editing A (another handler changed this), ignore
      if (liquidityEditingFieldRef.current !== "A") {
        return prev;
      }

      const updated = { ...prev, amountA: value };

      // If value is empty, clear both fields
      if (!value || value.trim() === "") {
        updated.amountB = "";
        liquidityEditingFieldRef.current = null;
        return updated;
      }

      // Auto-calculate amountB based on reserves using exact Uniswap precision
      if (
        liquidityPairReserves &&
        liquidityTokenA?.decimals &&
        liquidityTokenB?.decimals
      ) {
        try {
          const amountAWei = parseUnits(value, liquidityTokenA.decimals);
          if (amountAWei <= 0n) {
            updated.amountB = "";
            return updated;
          }

          // Calculate B using exact formula: amountB = (amountA * reserveB) / reserveA
          if (liquidityPairReserves.reserveAWei > 0n) {
            const amountBWei =
              (amountAWei * liquidityPairReserves.reserveBWei) /
              liquidityPairReserves.reserveAWei;
            const amountBFormatted = formatUnits(
              amountBWei,
              liquidityTokenB.decimals
            );
            updated.amountB = formatNumber(
              amountBFormatted,
              Math.min(6, liquidityTokenB.decimals)
            );
          }
        } catch (err) {
          console.warn("[liquidity] amountA calculation failed", err);
          updated.amountB = "";
        }
      }

      return updated;
    });
  };

  const handleLiquidityAmountBChange = (value: string) => {
    // Mark that user is editing field B
    liquidityEditingFieldRef.current = "B";

    setLiquidityForm((prev) => {
      // If we're not editing B (another handler changed this), ignore
      if (liquidityEditingFieldRef.current !== "B") {
        return prev;
      }

      const updated = { ...prev, amountB: value };

      // If value is empty, clear both fields
      if (!value || value.trim() === "") {
        updated.amountA = "";
        liquidityEditingFieldRef.current = null;
        return updated;
      }

      // Auto-calculate amountA based on reserves using exact Uniswap precision
      if (
        liquidityPairReserves &&
        liquidityTokenA?.decimals &&
        liquidityTokenB?.decimals
      ) {
        try {
          const amountBWei = parseUnits(value, liquidityTokenB.decimals);
          if (amountBWei <= 0n) {
            updated.amountA = "";
            return updated;
          }

          // Calculate A using exact formula: amountA = (amountB * reserveA) / reserveB
          if (liquidityPairReserves.reserveBWei > 0n) {
            const amountAWei =
              (amountBWei * liquidityPairReserves.reserveAWei) /
              liquidityPairReserves.reserveBWei;
            const amountAFormatted = formatUnits(
              amountAWei,
              liquidityTokenA.decimals
            );
            updated.amountA = formatNumber(
              amountAFormatted,
              Math.min(6, liquidityTokenA.decimals)
            );
          }
        } catch (err) {
          console.warn("[liquidity] amountB calculation failed", err);
          updated.amountA = "";
        }
      }

      return updated;
    });
  };

  const handleLiquidityPrimary = () => {
    if (liquidityButtonDisabled) return;

    // For add liquidity, show confirmation dialog first
    if (
      liquidityMode === "add" &&
      liquidityTokensReady &&
      liquidityAmountsReady
    ) {
      setShowLiquidityConfirm(true);
    } else {
      liquidityButtonAction();
    }
  };

  const handleConfirmAddLiquidity = () => {
    setShowLiquidityConfirm(false);
    handleAddLiquidity();
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
            <img src="/logo.png" alt="WarpX" className={styles.logo} />
            <span className={styles.brandMain}>WarpX</span>
            {/* <span className={styles.brandSub}>Built on MegaETH</span> */}
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
                  Trade tokens through the WarpX router with live routing
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
                    onChange={(event) => {
                      const value = event.target.value;
                      // Mark that user is editing Pay field
                      swapEditingFieldRef.current = "amountIn";
                      // Update ONLY amountIn - don't touch minOut
                      setSwapForm((prev) => ({
                        ...prev,
                        amountIn: value
                      }));
                    }}
                  />
                </div>
                {selectedIn && (
                  <div className={styles.assetBalance}>
                    <span className={styles.helper}>
                      Balance: {formatBalance(swapInBalanceFormatted)}{" "}
                      {swapInSymbol}
                    </span>
                    {swapInBalanceFormatted && (
                      <button
                        type="button"
                        className={styles.maxButton}
                        onClick={handleSetMaxSwapAmount}
                      >
                        MAX
                      </button>
                    )}
                  </div>
                )}
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
                    onChange={(event) => {
                      const value = event.target.value;
                      // Mark that user is editing Receive field
                      swapEditingFieldRef.current = "minOut";
                      // Update ONLY minOut - don't touch amountIn
                      setSwapForm((prev) => ({
                        ...prev,
                        minOut: value
                      }));
                    }}
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
                  Provide or withdraw liquidity from WarpX pairs. Approvals
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
                          handleLiquidityAmountAChange(event.target.value)
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
                          handleLiquidityAmountBChange(event.target.value)
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
              <>
                <div className={styles.swapPanel}>
                  <div className={styles.assetCard}>
                    <div className={styles.assetHeader}>
                      <span>Select Pair</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        marginBottom: "0.75rem"
                      }}
                    >
                      <button
                        type="button"
                        className={styles.assetSelector}
                        onClick={() => openTokenDialog("liquidityA")}
                        style={{ flex: 1 }}
                      >
                        <span className={styles.assetSelectorSymbol}>
                          {liquidityTokenA?.symbol ?? "Select"}
                        </span>
                        <span className={styles.assetSelectorChevron}>v</span>
                      </button>
                      <span style={{ opacity: 0.5 }}>+</span>
                      <button
                        type="button"
                        className={styles.assetSelector}
                        onClick={() => openTokenDialog("liquidityB")}
                        style={{ flex: 1 }}
                      >
                        <span className={styles.assetSelectorSymbol}>
                          {liquidityTokenB?.symbol ?? "Select"}
                        </span>
                        <span className={styles.assetSelectorChevron}>v</span>
                      </button>
                    </div>

                    {liquidityPairReserves && lpTokenInfo && (
                      <div
                        style={{
                          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                          paddingTop: "0.75rem",
                          marginTop: "0.5rem"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "0.5rem",
                            fontSize: "0.875rem"
                          }}
                        >
                          <span style={{ opacity: 0.7 }}>Your LP Tokens</span>
                          <span style={{ fontWeight: 500 }}>
                            {formatNumber(lpTokenInfo.balance)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "0.5rem",
                            fontSize: "0.875rem"
                          }}
                        >
                          <span style={{ opacity: 0.7 }}>Your Pool Share</span>
                          <span style={{ fontWeight: 500 }}>
                            {formatPercent(lpTokenInfo.poolShare)}%
                          </span>
                        </div>
                        {userPooledAmounts && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.375rem",
                              fontSize: "0.875rem",
                              marginTop: "0.5rem"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between"
                              }}
                            >
                              <span className={styles.helper}>
                                {liquidityTokenA?.symbol ?? "Token A"}
                              </span>
                              <span>{userPooledAmounts.amountA}</span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between"
                              }}
                            >
                              <span className={styles.helper}>
                                {liquidityTokenB?.symbol ?? "Token B"}
                              </span>
                              <span>{userPooledAmounts.amountB}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.assetCard}>
                    <div className={styles.assetHeader}>
                      <span>Amount</span>
                      <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>
                        {removeLiquidityPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={removeLiquidityPercent}
                      onChange={(e) =>
                        setRemoveLiquidityPercent(e.target.value)
                      }
                      style={{
                        width: "100%",
                        marginBottom: "0.75rem",
                        accentColor: "#6b7280"
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginBottom: "0.75rem"
                      }}
                    >
                      {["25", "50", "75", "100"].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setRemoveLiquidityPercent(pct)}
                          style={{
                            flex: 1,
                            padding: "0.5rem",
                            borderRadius: "0.5rem",
                            border:
                              removeLiquidityPercent === pct
                                ? "1px solid #6b7280"
                                : "1px solid rgba(255,255,255,0.1)",
                            background:
                              removeLiquidityPercent === pct
                                ? "rgba(107, 114, 128, 0.15)"
                                : "transparent",
                            color:
                              removeLiquidityPercent === pct
                                ? "#d1d5db"
                                : "inherit",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    {expectedRemoveAmounts && (
                      <div
                        style={{
                          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                          paddingTop: "0.75rem"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.875rem",
                            opacity: 0.7,
                            marginBottom: "0.5rem"
                          }}
                        >
                          You will receive:
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.375rem",
                            fontSize: "0.875rem"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between"
                            }}
                          >
                            <span>{liquidityTokenA?.symbol ?? "Token A"}</span>
                            <span style={{ fontWeight: 600 }}>
                              {expectedRemoveAmounts.amountA}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between"
                            }}
                          >
                            <span>{liquidityTokenB?.symbol ?? "Token B"}</span>
                            <span style={{ fontWeight: 600 }}>
                              {expectedRemoveAmounts.amountB}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.summary}>
                  <button
                    className={`${styles.primaryButton} ${styles.primaryFull}`}
                    onClick={handleRemoveLiquidity}
                    disabled={!ready || isSubmitting || !liquidityPairReserves}
                    type="button"
                  >
                    {isSubmitting ? "Removing..." : "Remove Liquidity"}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/*  <footer className={styles.footnote}>
          WarpX Router {shortAddress(routerAddress)} · WMegaETH{" "}
          {shortAddress(wmegaAddress)}
        </footer> */}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {showLiquidityConfirm && (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setShowLiquidityConfirm(false)}
        >
          <div
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: "420px" }}
          >
            <div className={styles.dialogHeader}>
              <span className={styles.dialogTitle}>YOU WILL RECEIVE</span>
              <button
                type="button"
                className={styles.dialogClose}
                onClick={() => setShowLiquidityConfirm(false)}
              >
                Close
              </button>
            </div>

            <div style={{ padding: "0" }}>
              {/* Hero Section - LP Token Output */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(10, 255, 157, 0.08) 0%, rgba(10, 255, 157, 0.04) 100%)",
                  borderBottom: "1px solid rgba(10, 255, 157, 0.15)",
                  padding: "2rem 1.5rem",
                  textAlign: "center"
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    opacity: 0.6,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "0.75rem"
                  }}
                >
                  LP Tokens
                </div>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 700,
                    marginBottom: "0.5rem",
                    color: "var(--accent)"
                  }}
                >
                  {liquidityPairReserves &&
                  liquidityTokenA?.decimals &&
                  liquidityTokenB?.decimals
                    ? (() => {
                        try {
                          // Parse amounts using exact token decimals
                          const amountAWei = parseUnits(
                            liquidityForm.amountA || "0",
                            liquidityTokenA.decimals
                          );
                          const amountBWei = parseUnits(
                            liquidityForm.amountB || "0",
                            liquidityTokenB.decimals
                          );

                          // Debug: log the reserves and calculation details
                          console.log("[liquidity] LP calculation inputs:", {
                            amountA: liquidityForm.amountA,
                            amountB: liquidityForm.amountB,
                            reserveA: formatUnits(
                              liquidityPairReserves.reserveAWei,
                              liquidityTokenA.decimals
                            ),
                            reserveB: formatUnits(
                              liquidityPairReserves.reserveBWei,
                              liquidityTokenB.decimals
                            ),
                            totalSupply: formatUnits(
                              liquidityPairReserves.totalSupplyWei,
                              18
                            ),
                            isNewPair:
                              liquidityPairReserves.totalSupplyWei === 0n
                          });

                          // Calculate LP tokens using exact Uniswap V2 formula with BigInt
                          const lpTokensWei = getLiquidityMinted(
                            amountAWei,
                            amountBWei,
                            liquidityPairReserves.reserveAWei,
                            liquidityPairReserves.reserveBWei,
                            liquidityPairReserves.totalSupplyWei
                          );

                          console.log("[liquidity] LP tokens calculated:", {
                            lpTokensWei: lpTokensWei.toString(),
                            lpTokensFormatted: formatUnits(lpTokensWei, 18)
                          });

                          // LP tokens have 18 decimals per Uniswap V2 spec
                          const lpTokensFormatted = formatUnits(
                            lpTokensWei,
                            18
                          );
                          return lpTokensWei > 0n
                            ? formatNumber(lpTokensFormatted, 6)
                            : "0";
                        } catch (err) {
                          console.warn(
                            "[liquidity] LP calculation failed",
                            err
                          );
                          return "0";
                        }
                      })()
                    : "0"}
                </div>
                <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>
                  {liquidityTokenA?.symbol ?? "A"}-
                  {liquidityTokenB?.symbol ?? "B"}
                </div>
              </div>

              {/* Content Section */}
              <div style={{ padding: "1.5rem" }}>
                {/* Input Details */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      opacity: 0.5,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "0.75rem"
                    }}
                  >
                    YOU'RE PROVIDING
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        background: "rgba(255, 255, 255, 0.04)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.06)"
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>
                        {liquidityTokenA?.symbol ?? "Token A"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {formatNumber(liquidityForm.amountA, 6)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        background: "rgba(255, 255, 255, 0.04)",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.06)"
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>
                        {liquidityTokenB?.symbol ?? "Token B"}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {formatNumber(liquidityForm.amountB, 6)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rates Section */}
                {liquidityPairReserves && (
                  <div
                    style={{
                      marginBottom: "1.5rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: "0.75rem"
                      }}
                    >
                      Exchange Rate
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        fontSize: "0.85rem",
                        opacity: 0.8
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>1 {liquidityTokenA?.symbol} =</span>
                        <span>
                          {liquidityTokenA?.decimals &&
                          liquidityTokenB?.decimals
                            ? (() => {
                                // Calculate 1 token A in terms of token B using BigInt precision
                                const oneTokenAWei = parseUnits(
                                  "1",
                                  liquidityTokenA.decimals
                                );
                                const rateWei =
                                  (oneTokenAWei *
                                    liquidityPairReserves.reserveBWei) /
                                  liquidityPairReserves.reserveAWei;
                                const rateFormatted = formatUnits(
                                  rateWei,
                                  liquidityTokenB.decimals
                                );
                                return formatNumber(
                                  rateFormatted,
                                  Math.min(6, liquidityTokenB.decimals)
                                );
                              })()
                            : "—"}{" "}
                          {liquidityTokenB?.symbol}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between"
                        }}
                      >
                        <span>1 {liquidityTokenB?.symbol} =</span>
                        <span>
                          {liquidityTokenA?.decimals &&
                          liquidityTokenB?.decimals
                            ? (() => {
                                // Calculate 1 token B in terms of token A using BigInt precision
                                const oneTokenBWei = parseUnits(
                                  "1",
                                  liquidityTokenB.decimals
                                );
                                const rateWei =
                                  (oneTokenBWei *
                                    liquidityPairReserves.reserveAWei) /
                                  liquidityPairReserves.reserveBWei;
                                const rateFormatted = formatUnits(
                                  rateWei,
                                  liquidityTokenA.decimals
                                );
                                return formatNumber(
                                  rateFormatted,
                                  Math.min(6, liquidityTokenA.decimals)
                                );
                              })()
                            : "—"}{" "}
                          {liquidityTokenA?.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  className={`${styles.primaryButton} ${styles.primaryFull}`}
                  onClick={handleConfirmAddLiquidity}
                  disabled={isSubmitting}
                  type="button"
                  style={{ marginTop: "0.5rem" }}
                >
                  {liquidityPairReserves &&
                  parseFloat(liquidityPairReserves.reserveA) > 0 &&
                  parseFloat(liquidityPairReserves.reserveB) > 0
                    ? "Confirm Supply"
                    : "Create Pair & Supply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrowserProvider, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { parseUnits } from "ethers";
import type { Pair } from "@megaeth/uniswap-v2-sdk";
import type { Address } from "viem";
import { useBalance } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract
} from "wagmi/actions";
import { erc20Abi } from "@/lib/abis/erc20";
import { warpRouterAbi } from "@/lib/abis/router";
import { getRouter, getToken } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { toBigInt } from "@/lib/utils/math";
import { SwapCard } from "./SwapCard";
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID,
  MINIMUM_LIQUIDITY
} from "@/lib/trade/constants";
import { formatNumber } from "@/lib/trade/math";
import { parseErrorMessage } from "@/lib/trade/errors";
import type {
  Quote,
  ReverseQuote,
  SwapFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import { formatBalanceDisplay } from "@/lib/trade/format";
import {
  bpsToPercent,
  createTradeExactIn,
  createTradeExactOut,
  fetchPair,
  toSdkToken
} from "@/lib/trade/uniswap";

type EnsureWalletContext = {
  walletAccount: string | null;
  walletProvider: BrowserProvider | null;
  walletSigner: JsonRpcSigner | null;
  readProvider: JsonRpcProvider;
  ready: boolean;
  showError: (message: string) => void;
};

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

type SwapContainerProps = {
  selectedIn: TokenDescriptor | null;
  selectedOut: TokenDescriptor | null;
  onOpenTokenDialog: (slot: TokenDialogSlot) => void;
  onSwapTokens: () => void;
  routerAddress: string;
  factoryAddress: string;
  readProvider: JsonRpcProvider;
  walletAccount: string | null;
  walletProvider: BrowserProvider | null;
  walletSigner: JsonRpcSigner | null;
  chainId: number | null | undefined;
  hasMounted: boolean;
  isWalletConnected: boolean;
  isAccountConnecting: boolean;
  ready: boolean;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showLoading: (message: string) => void;
  refreshNonce: number;
  onRequestRefresh: () => void;
};

const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const createEnsureWallet =
  ({
    walletAccount,
    walletProvider,
    walletSigner,
    readProvider,
    ready,
    showError
  }: EnsureWalletContext) =>
  (options?: { requireSigner?: boolean }) => {
    if (!walletAccount) {
      showError("Connect your wallet to continue.");
      return null;
    }
    if (!ready) {
      showError("Switch to the MegaETH Testnet to interact with the contracts.");
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

export function SwapContainer({
  selectedIn,
  selectedOut,
  onOpenTokenDialog,
  onSwapTokens,
  routerAddress,
  factoryAddress,
  readProvider,
  walletAccount,
  walletProvider,
  walletSigner,
  chainId,
  hasMounted,
  isWalletConnected,
  isAccountConnecting,
  ready,
  showError,
  showSuccess,
  showLoading,
  refreshNonce,
  onRequestRefresh
}: SwapContainerProps) {
  const [swapForm, setSwapForm] = useState<SwapFormState>({
    tokenIn: selectedIn?.address ?? "",
    tokenOut: selectedOut?.address ?? "",
    amountIn: "",
    minOut: "",
    maxInput: ""
  });
  const [swapQuote, setSwapQuote] = useState<Quote | null>(null);
  const [reverseQuote, setReverseQuote] = useState<ReverseQuote | null>(null);
  const [swapPair, setSwapPair] = useState<Pair | null>(null);
  const [swapHasLiquidity, setSwapHasLiquidity] = useState<boolean | null>(
    null
  );
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowanceNonce, setAllowanceNonce] = useState(0);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const swapEditingFieldRef = useRef<"amountIn" | "minOut" | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reverseQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSwapSelectionRef = useRef<{
    in: string | null;
    out: string | null;
  }>({ in: null, out: null });

  const ensureWallet = useMemo(
    () =>
      createEnsureWallet({
        walletAccount,
        walletProvider,
        walletSigner,
        readProvider,
        ready,
        showError
      }),
    [walletAccount, walletProvider, walletSigner, readProvider, ready, showError]
  );

  const swapInTokenAddress = selectedIn?.address ?? "";
  const swapInIsAddress = isAddress(swapInTokenAddress);

  const { data: swapInBalanceData, refetch: refetchSwapInBalance } = useBalance({
    address:
      walletAccount &&
      chainId === Number(MEGAETH_CHAIN_ID) &&
      swapInIsAddress &&
      hasMounted &&
      isWalletConnected
        ? (walletAccount as Address)
        : undefined,
    token:
      walletAccount &&
      chainId === Number(MEGAETH_CHAIN_ID) &&
      swapInIsAddress &&
      swapInTokenAddress
        ? (swapInTokenAddress as Address)
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        Boolean(walletAccount) &&
        Boolean(swapInTokenAddress) &&
        hasMounted &&
        isWalletConnected &&
        chainId === Number(MEGAETH_CHAIN_ID) &&
        swapInIsAddress
    }
  });

  const swapInBalanceFormatted = swapInBalanceData?.formatted ?? null;
  const swapInSymbol = swapInBalanceData?.symbol ?? selectedIn?.symbol ?? null;

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

  useEffect(() => {
    const currentIn = selectedIn?.address
      ? selectedIn.address.toLowerCase()
      : null;
    const currentOut = selectedOut?.address
      ? selectedOut.address.toLowerCase()
      : null;
    const previous = previousSwapSelectionRef.current;

    if (previous.in === currentIn && previous.out === currentOut) {
      return;
    }

    previousSwapSelectionRef.current = { in: currentIn, out: currentOut };

    swapEditingFieldRef.current = null;
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
      quoteDebounceTimerRef.current = null;
    }
    if (reverseQuoteDebounceTimerRef.current) {
      clearTimeout(reverseQuoteDebounceTimerRef.current);
      reverseQuoteDebounceTimerRef.current = null;
    }

    setSwapForm((prev) => ({
      ...prev,
      amountIn: "",
      minOut: "",
      maxInput: ""
    }));
    setSwapQuote(null);
    setReverseQuote(null);
    setSwapPair(null);
    setNeedsApproval(false);
    setCheckingAllowance(false);
    setIsCalculatingQuote(false);
  }, [selectedIn?.address, selectedOut?.address]);

  useEffect(() => {
    let active = true;

    const fetchSwapReserves = async () => {
      if (!selectedIn?.address || !selectedOut?.address || !factoryAddress) {
        if (active) {
          setSwapPair(null);
          setSwapHasLiquidity(null);
        }
        return;
      }

      if (selectedIn.address === selectedOut.address) {
        if (active) {
          setSwapPair(null);
          setSwapHasLiquidity(null);
        }
        return;
      }

      try {
        if (active) {
          setSwapHasLiquidity(null);
        }
        const tokenIn = toSdkToken(selectedIn);
        const tokenOut = toSdkToken(selectedOut);
        const pair = await fetchPair(
          tokenIn,
          tokenOut,
          readProvider,
          factoryAddress
        );

        if (!pair) {
          if (active) {
            setSwapPair(null);
            setSwapHasLiquidity(false);
          }
          return;
        }

        if (!active) return;

        const reserveIn = pair.reserveOf(tokenIn).raw;
        const reserveOut = pair.reserveOf(tokenOut).raw;
        const hasLiquidity = reserveIn > 0n && reserveOut > 0n;

        setSwapPair(pair);
        setSwapHasLiquidity(hasLiquidity);
      } catch (err) {
        console.error("[swap] fetch pair failed", err);
        if (active) {
          setSwapPair(null);
          setSwapHasLiquidity(false);
        }
      }
    };

    fetchSwapReserves();
    return () => {
      active = false;
    };
  }, [
    factoryAddress,
    readProvider,
    selectedIn?.address,
    selectedOut?.address,
    refreshNonce
  ]);

  useEffect(() => {
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    if (swapEditingFieldRef.current !== "amountIn") {
      return;
    }

    if (!swapForm.amountIn || swapForm.amountIn.trim() === "") {
      setSwapHasLiquidity(null);
      setSwapQuote(null);
      setSwapForm((prev) => ({ ...prev, minOut: "" }));
      setIsCalculatingQuote(false);
      return;
    }

    quoteDebounceTimerRef.current = setTimeout(async () => {
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
        if (!selectedIn || !selectedOut || !swapPair) {
          setIsCalculatingQuote(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          return;
        }

        const decimalsIn = selectedIn.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const decimalsOut = selectedOut.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const symbolOut = selectedOut.symbol ?? "TOKEN";

        const amountInWei = parseUnits(swapForm.amountIn, decimalsIn);
        if (amountInWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        if (!swapPair) {
          setSwapHasLiquidity(null);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        const tokenIn = toSdkToken(selectedIn);
        const tokenOut = toSdkToken(selectedOut);
        const trade = createTradeExactIn(
          swapPair,
          tokenIn,
          tokenOut,
          amountInWei
        );

        const outputAmount = trade.outputAmount;
        if (outputAmount.raw === 0n) {
          setSwapHasLiquidity(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        const reserveOutRaw = swapPair.reserveOf(tokenOut).raw;
        const maxOutput =
          reserveOutRaw > MINIMUM_LIQUIDITY
            ? reserveOutRaw - MINIMUM_LIQUIDITY
            : reserveOutRaw;

        const priceImpactValue = Math.abs(
          Number(trade.priceImpact.toFixed(4))
        );
        const drainsPool = outputAmount.raw >= maxOutput;
        const severeImpact = Number.isFinite(priceImpactValue)
          ? priceImpactValue >= 0.5
          : false;

        if (drainsPool || severeImpact) {
          setSwapHasLiquidity(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        setSwapHasLiquidity(true);

        const outputExact = trade.outputAmount.toExact(
          Math.min(6, decimalsOut)
        );
        const limitedOut = formatNumber(outputExact, Math.min(6, decimalsOut));

        const minOutAmount = trade.minimumAmountOut(
          bpsToPercent(DEFAULT_SLIPPAGE_BPS)
        );
        const minOutExact = minOutAmount.toExact(Math.min(6, decimalsOut));
        const limitedMinOut = formatNumber(
          minOutExact,
          Math.min(6, decimalsOut)
        );

        setSwapQuote({ amount: limitedOut, symbol: symbolOut });
        setSwapForm((prev) => ({
          ...prev,
          minOut: limitedMinOut,
          maxInput: ""
        }));
        setIsCalculatingQuote(false);
      } catch (err) {
        console.error("[swap] quote calculation failed", err);
        setIsCalculatingQuote(false);
        setSwapQuote(null);
        setSwapForm((prev) => ({ ...prev, minOut: "" }));
      }
    }, 500);

    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [
    routerAddress,
    readProvider,
    swapForm.amountIn,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapPair,
    selectedIn,
    selectedOut
  ]);

  useEffect(() => {
    if (reverseQuoteDebounceTimerRef.current) {
      clearTimeout(reverseQuoteDebounceTimerRef.current);
    }

    if (swapEditingFieldRef.current !== "minOut") {
      return;
    }

    if (!swapForm.minOut || swapForm.minOut.trim() === "") {
      setReverseQuote(null);
      setIsCalculatingQuote(false);
      return;
    }

    reverseQuoteDebounceTimerRef.current = setTimeout(async () => {
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
        if (!selectedIn || !selectedOut || !swapPair) {
          setIsCalculatingQuote(false);
          setReverseQuote(null);
          return;
        }

        const decimalsIn = selectedIn.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const decimalsOut = selectedOut.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const symbolIn = selectedIn.symbol ?? "TOKEN";
        const symbolOut = selectedOut.symbol ?? "TOKEN";

        const desiredOutWei = parseUnits(swapForm.minOut, decimalsOut);
        if (desiredOutWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        if (!swapPair) {
          setReverseQuote(null);
          setSwapForm((prev) => ({ ...prev, amountIn: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        const tokenIn = toSdkToken(selectedIn);
        const tokenOut = toSdkToken(selectedOut);
        const trade = createTradeExactOut(
          swapPair,
          tokenIn,
          tokenOut,
          desiredOutWei
        );

        const amountNeeded = trade.inputAmount.raw;

        if (amountNeeded === 0n) {
          setReverseQuote(null);
          setSwapForm((prev) => ({ ...prev, amountIn: "" }));
          setIsCalculatingQuote(false);
          return;
        }

        const formattedIn = trade.inputAmount.toExact(Math.min(6, decimalsIn));
        const limitedIn = formatNumber(formattedIn, Math.min(6, decimalsIn));

        const maxInputAmount = trade.maximumAmountIn(
          bpsToPercent(DEFAULT_SLIPPAGE_BPS)
        );
        const maxInputFormatted = maxInputAmount.toExact(
          Math.min(6, decimalsIn)
        );
        const limitedMaxInput = formatNumber(
          maxInputFormatted,
          Math.min(6, decimalsIn)
        );

        if (swapEditingFieldRef.current === "minOut") {
          setReverseQuote({ amount: limitedIn, symbolIn, symbolOut });
          setSwapForm((prev) => ({
            ...prev,
            amountIn: limitedIn,
            maxInput: limitedMaxInput
          }));
        }
        setIsCalculatingQuote(false);
      } catch (err: any) {
        console.error("[reverse quote] calculation error", err);
        setReverseQuote(null);
        setIsCalculatingQuote(false);

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
  }, [
    routerAddress,
    readProvider,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.minOut,
    swapPair,
    selectedIn,
    selectedOut,
    showError
  ]);

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
          .catch(() => DEFAULT_TOKEN_DECIMALS);
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
    walletAccount,
    routerAddress,
    swapForm.tokenIn,
    swapForm.amountIn,
    allowanceNonce,
    readProvider
  ]);

  const handleSetMaxSwapAmount = useCallback(() => {
    if (!swapInBalanceFormatted) return;
    setSwapForm((prev) => ({
      ...prev,
      amountIn: swapInBalanceFormatted
    }));
    swapEditingFieldRef.current = "amountIn";
  }, [swapInBalanceFormatted]);

  const handleSwapAmountInChange = useCallback((value: string) => {
    swapEditingFieldRef.current = "amountIn";
    setSwapForm((prev) => ({
      ...prev,
      amountIn: value
    }));
  }, []);

  const handleSwapMinOutChange = useCallback((value: string) => {
    swapEditingFieldRef.current = "minOut";
    setSwapForm((prev) => ({
      ...prev,
      minOut: value
    }));
  }, []);

  const handleApprove = useCallback(async () => {
    const tokenAddress = swapForm.tokenIn;
    const amount = swapForm.amountIn || "0";
    const ctx = ensureWallet();
    if (!ctx) return;
    if (!isAddress(tokenAddress) || !isAddress(routerAddress)) {
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
        .catch(() => DEFAULT_TOKEN_DECIMALS);
      const parsedAmount = parseUnits(
        amount && amount.length ? amount : "1000000",
        decimals
      );

      showLoading("Confirm transaction in your wallet...");
      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, parsedAmount],
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: 100000n
      });
      showLoading("Approval pending...");
      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash
      });

      setNeedsApproval(false);
      setAllowanceNonce((n) => n + 1);
      showSuccess("Token approved successfully.");
    } catch (err) {
      console.error("[swap] approval failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    routerAddress,
    showError,
    showLoading,
    showSuccess,
    swapForm.amountIn,
    swapForm.tokenIn
  ]);

  const handleSwap = useCallback(async () => {
    const ctx = ensureWallet({ requireSigner: true });
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
        .catch(() => DEFAULT_TOKEN_DECIMALS);
      const decimalsOut = await readContract(wagmiConfig, {
        address: tokenOut as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
        chainId: Number(MEGAETH_CHAIN_ID)
      })
        .then((value) => Number(value))
        .catch(() => DEFAULT_TOKEN_DECIMALS);

      const amountInWei = parseUnits(amountIn, decimalsIn);
      if (amountInWei <= 0n) {
        showError("Enter a valid swap amount.");
        setIsSubmitting(false);
        return;
      }

      const minOutWei = parseUnits(minOut, decimalsOut);
      if (minOutWei <= 0n) {
        showError("Enter a valid minimum output amount.");
        setIsSubmitting(false);
        return;
      }

      showLoading("Confirm transaction in your wallet...");

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

      const txHash = await writeContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: warpRouterAbi,
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
      await refetchSwapInBalance();
      setSwapForm((prev) => ({
        ...prev,
        amountIn: "",
        minOut: "",
        maxInput: ""
      }));
      swapEditingFieldRef.current = null;
      setSwapQuote(null);
      setReverseQuote(null);
      setIsCalculatingQuote(false);
      setSwapPair(null);
      setSwapHasLiquidity(null);
      onRequestRefresh();
      setAllowanceNonce((n) => n + 1);
      setNeedsApproval(false);
      setCheckingAllowance(false);
      showSuccess("Swap executed successfully.");
    } catch (err) {
      console.error("[swap] failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    onRequestRefresh,
    refetchSwapInBalance,
    routerAddress,
    showError,
    showLoading,
    showSuccess,
    swapForm
  ]);

  const slippagePercentDisplay = useMemo(
    () => (Number(DEFAULT_SLIPPAGE_BPS) / 100).toFixed(2).replace(/\.?0+$/, ""),
    []
  );

  const swapFormReady =
    isAddress(swapForm.tokenIn) &&
    isAddress(swapForm.tokenOut) &&
    !!swapForm.amountIn &&
    Number(swapForm.amountIn) > 0;

  let swapButtonLabel = "Swap";
  let swapButtonDisabled = false;
  let swapButtonAction: (() => void) | null = null;

  if (!hasMounted) {
    swapButtonLabel = "Connect Wallet";
    swapButtonDisabled = false;
    swapButtonAction = null;
  } else if (!isWalletConnected) {
    swapButtonLabel = isAccountConnecting ? "Connecting..." : "Connect Wallet";
    swapButtonAction = null;
    swapButtonDisabled = isAccountConnecting;
  } else if (!chainId || chainId !== Number(MEGAETH_CHAIN_ID)) {
    swapButtonLabel = "Wrong Network";
    swapButtonAction = null;
    swapButtonDisabled = true;
  } else if (!swapFormReady) {
    swapButtonLabel = "Enter Amount";
    swapButtonDisabled = true;
  } else if (swapHasLiquidity === false) {
    swapButtonLabel = "Insufficient liquidity";
    swapButtonAction = null;
    swapButtonDisabled = true;
  } else if (isCalculatingQuote) {
    swapButtonLabel = "Calculating...";
    swapButtonDisabled = true;
  } else if (checkingAllowance) {
    swapButtonLabel = "Checking...";
    swapButtonDisabled = true;
  } else if (needsApproval) {
    swapButtonLabel = isSubmitting ? "Approving..." : "Approve";
    swapButtonAction = handleApprove;
    swapButtonDisabled = isSubmitting;
  } else {
    swapButtonLabel = isSubmitting ? "Swapping..." : "Swap";
    swapButtonAction = handleSwap;
    swapButtonDisabled = isSubmitting;
  }

  const swapSummaryMessage = swapQuote
    ? `Quote ≈ ${swapQuote.amount} ${swapQuote.symbol} (min received with ${slippagePercentDisplay}% slippage: ${swapForm.minOut || "0"})`
    : null;

  return (
    <SwapCard
      swapForm={swapForm}
      swapQuote={swapQuote}
      reverseQuote={reverseQuote}
      selectedIn={selectedIn}
      selectedOut={selectedOut}
      onOpenTokenDialog={onOpenTokenDialog}
      onSwapTokens={onSwapTokens}
      onAmountInChange={handleSwapAmountInChange}
      onMinOutChange={handleSwapMinOutChange}
      formatBalance={formatBalanceDisplay}
      swapInBalanceFormatted={swapInBalanceFormatted}
      swapInSymbol={swapInSymbol}
      onSetMaxSwapAmount={handleSetMaxSwapAmount}
      summaryMessage={swapSummaryMessage}
      buttonLabel={swapButtonLabel}
      buttonDisabled={swapButtonDisabled}
      onButtonClick={swapButtonAction}
    />
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import { formatUnits, parseUnits, MaxUint256 } from "ethers";
import type { Address } from "viem";
import { useBalance } from "wagmi";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract
} from "wagmi/actions";
import { erc20Abi } from "@/lib/abis/erc20";
import { warpRouterAbi } from "@/lib/abis/router";
import { getToken } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { toBigInt } from "@/lib/utils/math";
import { SwapCard } from "./SwapCard";
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID
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
type EnsureWalletContext = {
  walletAccount: string | null;
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
  wrappedNativeAddress?: string;
  readProvider: JsonRpcProvider;
  walletAccount: string | null;
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
    ready,
    showError
  }: EnsureWalletContext) =>
  () => {
    if (!walletAccount) {
      showError("Connect your wallet to continue.");
      return null;
    }
    if (!ready) {
      showError("Switch to the MegaETH Testnet to interact with the contracts.");
      return null;
    }
    return {
      account: walletAccount
    };
  };

export function SwapContainer({
  selectedIn,
  selectedOut,
  onOpenTokenDialog,
  onSwapTokens,
  routerAddress,
  wrappedNativeAddress,
  readProvider,
  walletAccount,
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
  const [swapHasLiquidity, setSwapHasLiquidity] = useState<boolean | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowanceNonce, setAllowanceNonce] = useState(0);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const swapEditingFieldRef = useRef<"amountIn" | "minOut" | null>(null);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reverseQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allowanceDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSwapSelectionRef = useRef<{
    in: string | null;
    out: string | null;
  }>({ in: null, out: null });

  const ensureWallet = useMemo(
    () =>
      createEnsureWallet({
        walletAccount,
        ready,
        showError
      }),
    [walletAccount, ready, showError]
  );

  const swapInDescriptor = selectedIn;
  const swapOutDescriptor = selectedOut;

  const swapInTokenAddress = swapInDescriptor?.address ?? "";
  const swapOutTokenAddress = swapOutDescriptor?.address ?? "";
  const swapInIsNative = Boolean(swapInDescriptor?.isNative);
  const swapOutIsNative = Boolean(swapOutDescriptor?.isNative);
  const swapInIsAddress = isAddress(swapInTokenAddress);

  const { data: swapInBalanceData, refetch: refetchSwapInBalance } = useBalance({
    address:
      walletAccount &&
      chainId === Number(MEGAETH_CHAIN_ID) &&
      hasMounted &&
      isWalletConnected
        ? (walletAccount as Address)
        : undefined,
    token:
      walletAccount &&
      chainId === Number(MEGAETH_CHAIN_ID) &&
      (swapInIsNative || swapInIsAddress) &&
      swapInTokenAddress
        ? (swapInIsNative ? undefined : (swapInTokenAddress as Address))
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        Boolean(walletAccount) &&
        Boolean(swapInTokenAddress) &&
        hasMounted &&
        isWalletConnected &&
        chainId === Number(MEGAETH_CHAIN_ID) &&
        (swapInIsNative || swapInIsAddress)
    }
  });

  const swapInBalanceFormatted = swapInBalanceData?.formatted ?? null;
  const swapInSymbol = swapInDescriptor?.symbol ?? swapInBalanceData?.symbol ?? null;

  const swapInBalanceValue = swapInBalanceData?.value ?? null;
  const swapInDecimals = swapInDescriptor?.decimals ?? DEFAULT_TOKEN_DECIMALS;

  const parsedSwapAmountWei = useMemo(() => {
    if (!swapForm.amountIn) return null;
    try {
      return parseUnits(swapForm.amountIn, swapInDecimals);
    } catch (error) {
      return null;
    }
  }, [swapForm.amountIn, swapInDecimals]);

  const insufficientSwapBalance = useMemo(() => {
    if (!parsedSwapAmountWei || swapInBalanceValue === null) return false;
    return parsedSwapAmountWei > swapInBalanceValue;
  }, [parsedSwapAmountWei, swapInBalanceValue]);

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
    if (allowanceDebounceTimerRef.current) {
      clearTimeout(allowanceDebounceTimerRef.current);
      allowanceDebounceTimerRef.current = null;
    }

    setSwapForm((prev) => ({
      ...prev,
      amountIn: "",
      minOut: "",
      maxInput: ""
    }));
    setSwapQuote(null);
    setReverseQuote(null);
    setSwapHasLiquidity(null);
    setNeedsApproval(false);
    setCheckingAllowance(false);
    setIsCalculatingQuote(false);
  }, [selectedIn?.address, selectedOut?.address]);

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

      if (!swapForm.amountIn || Number(swapForm.amountIn) <= 0) {
        setIsCalculatingQuote(false);
        return;
      }

      const decimalsIn = selectedIn?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsOut = selectedOut?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const symbolOut = selectedOut?.symbol ?? "TOKEN";

      try {
        const amountInWei = parseUnits(swapForm.amountIn, decimalsIn);
        if (amountInWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        if (!routerAddress || !selectedIn || !selectedOut) {
          setIsCalculatingQuote(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          return;
        }

        const inputAddress = swapInIsNative
          ? wrappedNativeAddress
          : selectedIn?.address;
        const outputAddress = swapOutIsNative
          ? wrappedNativeAddress
          : selectedOut?.address;

        if (!inputAddress || !outputAddress) {
          setIsCalculatingQuote(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setSwapHasLiquidity(false);
          return;
        }

        const path = [
          inputAddress as `0x${string}`,
          outputAddress as `0x${string}`
        ];

        const amounts = (await readContract(wagmiConfig, {
          address: routerAddress as `0x${string}`,
          abi: warpRouterAbi,
          functionName: "getAmountsOut",
          args: [amountInWei, path],
          chainId: Number(MEGAETH_CHAIN_ID)
        })) as readonly bigint[];

        const amountOutWei = amounts[amounts.length - 1];

        if (amountOutWei <= 0n) {
          setIsCalculatingQuote(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setSwapHasLiquidity(false);
          return;
        }

        setSwapHasLiquidity(true);

        const outputExact = formatUnits(amountOutWei, decimalsOut);
        const limitedOut = formatNumber(outputExact, Math.min(6, decimalsOut));

        const minOutWei = (amountOutWei * (10000n - DEFAULT_SLIPPAGE_BPS)) / 10000n;
        const limitedMinOut = formatNumber(
          formatUnits(minOutWei, decimalsOut),
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
        setSwapHasLiquidity(false);
      }
    }, 500);

    return () => {
      if (quoteDebounceTimerRef.current) {
        clearTimeout(quoteDebounceTimerRef.current);
      }
    };
  }, [
    routerAddress,
    swapForm.amountIn,
    selectedIn,
    selectedOut,
    swapInIsNative,
    swapOutIsNative,
    wrappedNativeAddress
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

      if (!swapForm.minOut || Number(swapForm.minOut) <= 0) {
        setIsCalculatingQuote(false);
        return;
      }

      const decimalsIn = selectedIn?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsOut = selectedOut?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const symbolIn = selectedIn?.symbol ?? "TOKEN";
      const symbolOut = selectedOut?.symbol ?? "TOKEN";

      try {
        const desiredOutWei = parseUnits(swapForm.minOut, decimalsOut);
        if (desiredOutWei <= 0n) {
          setIsCalculatingQuote(false);
          return;
        }

        if (!routerAddress || !selectedIn || !selectedOut) {
          setIsCalculatingQuote(false);
          setReverseQuote(null);
          return;
        }

        const inputAddress = swapInIsNative
          ? wrappedNativeAddress
          : selectedIn?.address;
        const outputAddress = swapOutIsNative
          ? wrappedNativeAddress
          : selectedOut?.address;

        if (!inputAddress || !outputAddress) {
          setIsCalculatingQuote(false);
          setReverseQuote(null);
          return;
        }

        const path = [
          inputAddress as `0x${string}`,
          outputAddress as `0x${string}`
        ];

        const amounts = (await readContract(wagmiConfig, {
          address: routerAddress as `0x${string}`,
          abi: warpRouterAbi,
          functionName: "getAmountsIn",
          args: [desiredOutWei, path],
          chainId: Number(MEGAETH_CHAIN_ID)
        })) as readonly bigint[];

        const amountNeededWei = amounts[0];

        if (amountNeededWei <= 0n) {
          setIsCalculatingQuote(false);
          setReverseQuote(null);
          setSwapForm((prev) => ({ ...prev, amountIn: "" }));
          return;
        }

        const maxInputWei = (amountNeededWei * (10000n + DEFAULT_SLIPPAGE_BPS)) / 10000n;

        const limitedIn = formatNumber(
          formatUnits(amountNeededWei, decimalsIn),
          Math.min(6, decimalsIn)
        );
        const limitedMaxInput = formatNumber(
          formatUnits(maxInputWei, decimalsIn),
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
      } catch (err) {
        console.error("[reverse quote] calculation error", err);
        setReverseQuote(null);
        setIsCalculatingQuote(false);
        showError("Unable to calculate reverse quote.");
      }
    }, 500);

    return () => {
      if (reverseQuoteDebounceTimerRef.current) {
        clearTimeout(reverseQuoteDebounceTimerRef.current);
      }
    };
  }, [
    routerAddress,
    swapForm.minOut,
    selectedIn,
    selectedOut,
    swapInIsNative,
    swapOutIsNative,
    wrappedNativeAddress,
    showError
  ]);

  useEffect(() => {
    // Clear previous debounce timer
    if (allowanceDebounceTimerRef.current) {
      clearTimeout(allowanceDebounceTimerRef.current);
    }

    // Reset immediately if conditions aren't met
    if (
      !walletAccount ||
      !routerAddress ||
      !isAddress(swapForm.tokenIn) ||
      !swapForm.amountIn ||
      Number(swapForm.amountIn) <= 0 ||
      swapInIsNative
    ) {
      setNeedsApproval(false);
      setCheckingAllowance(false);
      return;
    }

    // Debounce the allowance check to avoid rate limiting
    allowanceDebounceTimerRef.current = setTimeout(async () => {
      let cancelled = false;

      try {
        setCheckingAllowance(true);
        // Use descriptor decimals instead of fetching from contract
        const decimals = swapInDecimals;
        const desired = parseUnits(swapForm.amountIn, decimals);

        if (desired <= 0n) {
          if (!cancelled) setNeedsApproval(false);
          return;
        }

        const token = getToken(swapForm.tokenIn, readProvider);
        const allowance = await token.allowance(walletAccount, routerAddress);

        if (!cancelled) setNeedsApproval(toBigInt(allowance) < desired);
      } catch (err) {
        console.error("allowance check failed", err);
        if (!cancelled) setNeedsApproval(true);
      } finally {
        if (!cancelled) setCheckingAllowance(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (allowanceDebounceTimerRef.current) {
        clearTimeout(allowanceDebounceTimerRef.current);
      }
    };
  }, [
    walletAccount,
    routerAddress,
    swapForm.tokenIn,
    swapForm.amountIn,
    allowanceNonce,
    readProvider,
    swapInIsNative,
    swapInDecimals
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
    if (swapInIsNative) {
      showError("Native MegaETH does not require approval.");
      return;
    }
    if (!isAddress(tokenAddress) || !isAddress(routerAddress)) {
      showError("Provide valid token and spender addresses.");
      return;
    }
    try {
      setIsSubmitting(true);

      showLoading("Confirm transaction in your wallet...");
      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, MaxUint256],
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
    swapForm.tokenIn,
    swapInIsNative
  ]);

  const handleSwap = useCallback(async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenIn, tokenOut, amountIn, minOut, maxInput } = swapForm;
    if (!amountIn || !minOut) {
      showError("Provide both swap amount and expected output.");
      return;
    }
    try {
      setIsSubmitting(true);

      if (!swapInDescriptor || !swapOutDescriptor) {
        showError("Select tokens to swap.");
        setIsSubmitting(false);
        return;
      }

      if (swapInIsNative && swapOutIsNative) {
        showError("Cannot swap native ETH to native ETH directly.");
        setIsSubmitting(false);
        return;
      }

      if (!swapInIsNative && !isAddress(swapInTokenAddress)) {
        showError("Invalid input token address.");
        setIsSubmitting(false);
        return;
      }
      if (!swapOutIsNative && !isAddress(swapOutTokenAddress)) {
        showError("Invalid output token address.");
        setIsSubmitting(false);
        return;
      }

      const decimalsIn = swapInDescriptor.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsOut = swapOutDescriptor.decimals ?? DEFAULT_TOKEN_DECIMALS;

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

      const deadline = BigInt(nowPlusMinutes(10));
      const isExactInput = swapEditingFieldRef.current === "amountIn";
      const maxAmountInputWei = parseUnits(maxInput || amountIn, decimalsIn);
      const amountToApprove = isExactInput ? amountInWei : maxAmountInputWei;

      const wrappedNative =
        wrappedNativeAddress ??
        swapInDescriptor.wrappedAddress ??
        swapOutDescriptor.wrappedAddress;

      let functionName:
        | "swapExactTokensForTokens"
        | "swapExactETHForTokens"
        | "swapExactTokensForETH";
      let args: unknown[];
      let txValue: bigint | undefined;
      let path: `0x${string}`[];

      if (swapInIsNative) {
        if (!wrappedNative || !isAddress(wrappedNative)) {
          showError("Wrapped native address unavailable.");
          setIsSubmitting(false);
          return;
        }
        path = [
          wrappedNative as `0x${string}`,
          swapOutTokenAddress as `0x${string}`
        ];
        functionName = "swapExactETHForTokens";
        args = [
          minOutWei,
          path,
          ctx.account as `0x${string}`,
          deadline
        ];
        txValue = amountInWei;
      } else if (swapOutIsNative) {
        if (!wrappedNative || !isAddress(wrappedNative)) {
          showError("Wrapped native address unavailable.");
          setIsSubmitting(false);
          return;
        }
        path = [
          swapInTokenAddress as `0x${string}`,
          wrappedNative as `0x${string}`
        ];
        functionName = "swapExactTokensForETH";
        args = [
          amountInWei,
          minOutWei,
          path,
          ctx.account as `0x${string}`,
          deadline
        ];
      } else {
        path = [
          swapInTokenAddress as `0x${string}`,
          swapOutTokenAddress as `0x${string}`
        ];
        functionName = "swapExactTokensForTokens";
        args = [
          amountInWei,
          minOutWei,
          path,
          ctx.account as `0x${string}`,
          deadline
        ];
      }

      if (!swapInIsNative) {
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
            args: [routerAddress as `0x${string}`, MaxUint256],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 100000n
          });
          showLoading("Approval pending...");
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }
      }

      showLoading("Confirm transaction in your wallet...");

      const txRequest: Record<string, unknown> = {
        address: routerAddress as `0x${string}`,
        abi: warpRouterAbi,
        functionName,
        args,
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID),
        gas: swapInIsNative || swapOutIsNative ? 400000n : 300000n
      };

      if (txValue && txValue > 0n) {
        txRequest.value = txValue;
      }

      const txHash = await writeContract(
        wagmiConfig,
        txRequest as Parameters<typeof writeContract>[1]
      );

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
      setSwapHasLiquidity(null);
      onRequestRefresh();
      if (!swapInIsNative) {
        setAllowanceNonce((n) => n + 1);
      }
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
    swapForm,
    swapInDescriptor,
    swapOutDescriptor,
    swapInIsNative,
    swapOutIsNative,
    swapInTokenAddress,
    swapOutTokenAddress,
    wrappedNativeAddress
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
  } else if (insufficientSwapBalance) {
    swapButtonLabel = "Insufficient balance";
    swapButtonAction = null;
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

  const swapSummaryMessage = useMemo(() => {
    if (!swapQuote || !swapForm.amountIn || !selectedIn || !selectedOut) {
      return null;
    }

    try {
      const amountInNum = Number(swapForm.amountIn);
      const amountOutNum = Number(swapQuote.amount);

      if (amountInNum <= 0 || amountOutNum <= 0) {
        return null;
      }

      // Calculate exchange rate (1 unit of input = X units of output)
      const rate = amountOutNum / amountInNum;

      // Format rate based on magnitude
      let formattedRate: string;
      if (rate >= 1) {
        // For rates >= 1, show 2-4 decimal places
        formattedRate = rate.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        });
      } else {
        // For rates < 1, show more precision
        formattedRate = rate.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      }

      return `1 ${selectedIn.symbol} = ${formattedRate} ${selectedOut.symbol}`;
    } catch (err) {
      return null;
    }
  }, [swapQuote, swapForm.amountIn, selectedIn, selectedOut]);

  const receiveAmountValue =
    swapEditingFieldRef.current === "minOut"
      ? swapForm.minOut
      : swapQuote?.amount ?? "";
  const minReceivedDisplay = swapForm.minOut || null;

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
      receiveValue={receiveAmountValue}
      minReceived={minReceivedDisplay}
      summaryMessage={swapSummaryMessage}
      buttonLabel={swapButtonLabel}
      buttonDisabled={swapButtonDisabled}
      onButtonClick={swapButtonAction}
    />
  );
}

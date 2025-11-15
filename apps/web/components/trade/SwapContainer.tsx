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
  MEGAETH_CHAIN_ID,
  SWAP_DEFAULT
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
import { formatBalanceDisplay, buildExplorerTxUrl } from "@/lib/trade/format";
import { isValidNumericInput, normalizeNumericInput } from "@/lib/utils/input";
import type { ToastOptions } from "@/hooks/useToasts";
import { buildToastVisuals } from "@/lib/toastVisuals";
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
  showError: (message: string, options?: ToastOptions) => void;
  showSuccess: (message: string, options?: ToastOptions) => void;
  showLoading: (message: string, options?: ToastOptions) => string;
  refreshNonce: number;
  onRequestRefresh: () => void;
  onConnect?: () => void;
};

const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const createEnsureWallet =
  ({ walletAccount, ready, showError }: EnsureWalletContext) =>
  () => {
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
  onRequestRefresh,
  onConnect
}: SwapContainerProps) {
  const [swapForm, setSwapForm] = useState<SwapFormState>({
    ...SWAP_DEFAULT,
    tokenIn: selectedIn?.address ?? "",
    tokenOut: selectedOut?.address ?? ""
  });
  const [swapQuote, setSwapQuote] = useState<Quote | null>(null);
  const [reverseQuote, setReverseQuote] = useState<ReverseQuote | null>(null);
  const [swapHasLiquidity, setSwapHasLiquidity] = useState<boolean | null>(
    null
  );
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowanceNonce, setAllowanceNonce] = useState(0);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const swapEditingFieldRef = useRef<"amountIn" | "minOut" | null>(null);
  const [isExactOutput, setIsExactOutput] = useState(false);
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
  const swapOutDecimals = swapOutDescriptor?.decimals ?? DEFAULT_TOKEN_DECIMALS;

  const { data: swapInBalanceData, refetch: refetchSwapInBalance } = useBalance(
    {
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
          ? swapInIsNative
            ? undefined
            : (swapInTokenAddress as Address)
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
    }
  );

  const swapInBalanceFormatted = swapInBalanceData?.formatted ?? null;
  const swapInSymbol =
    swapInDescriptor?.symbol ?? swapInBalanceData?.symbol ?? null;

  const swapInBalanceValue = swapInBalanceData?.value ?? null;
  const swapInDecimals = swapInDescriptor?.decimals ?? DEFAULT_TOKEN_DECIMALS;

  const swapToastVisuals = useMemo(
    () => buildToastVisuals("swap", selectedIn, selectedOut),
    [selectedIn, selectedOut]
  );

  const parsedSwapAmountWei = useMemo(() => {
    const source = swapForm.amountInExact ?? swapForm.amountIn;
    if (!source) return null;
    try {
      return parseUnits(source, swapInDecimals);
    } catch (error) {
      return null;
    }
  }, [swapForm.amountIn, swapForm.amountInExact, swapInDecimals]);

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
      amountInExact: null,
      minOut: "",
      maxInput: ""
    }));
    setSwapQuote(null);
    setReverseQuote(null);
    setSwapHasLiquidity(null);
    setNeedsApproval(false);
    setCheckingAllowance(false);
    setIsCalculatingQuote(false);
    setIsExactOutput(false);
  }, [selectedIn?.address, selectedOut?.address]);

  useEffect(() => {
    if (quoteDebounceTimerRef.current) {
      clearTimeout(quoteDebounceTimerRef.current);
    }

    if (swapEditingFieldRef.current !== "amountIn") {
      return;
    }

    const amountInForQuote = swapForm.amountInExact ?? swapForm.amountIn;

    if (!amountInForQuote || amountInForQuote.trim() === "") {
      setSwapHasLiquidity(null);
      setSwapQuote(null);
      setSwapForm((prev) => ({ ...prev, minOut: "" }));
      setIsCalculatingQuote(false);
      return;
    }

    quoteDebounceTimerRef.current = setTimeout(async () => {
      setIsCalculatingQuote(true);

      if (!amountInForQuote || Number(amountInForQuote) <= 0) {
        setIsCalculatingQuote(false);
        return;
      }

      const decimalsIn = selectedIn?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsOut = selectedOut?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const symbolOut = selectedOut?.symbol ?? "TOKEN";

      try {
        const amountInWei = parseUnits(amountInForQuote, decimalsIn);
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

        // OPTIMIZATION: Only fetch quote (1 RPC call) - skip price impact to reduce load
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

        // Following Uniswap's approach: Always show the quote if it's valid
        // Price impact warnings are shown in the UI, but swaps are never blocked
        setSwapHasLiquidity(true);

        // Price impact calculation disabled to reduce RPC calls
        setPriceImpact(null);

        const outputExact = formatUnits(amountOutWei, decimalsOut);
        const limitedOut = formatNumber(outputExact, Math.min(6, decimalsOut));

        const minOutWei =
          (amountOutWei * (10000n - DEFAULT_SLIPPAGE_BPS)) / 10000n;
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
        // Any error from getAmountsOut is treated as insufficient liquidity
        // This includes: no pair exists, insufficient reserves, invalid tokens, etc.
        // This is an expected state, not an error, so we don't log it
        setIsCalculatingQuote(false);
        setSwapQuote(null);
        setSwapForm((prev) => ({ ...prev, minOut: "" }));
        setSwapHasLiquidity(false);
        setPriceImpact(null);
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
    swapForm.amountInExact,
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
          setSwapForm((prev) => ({
            ...prev,
            amountIn: "",
            amountInExact: null
          }));
          return;
        }

        const maxInputWei =
          (amountNeededWei * (10000n + DEFAULT_SLIPPAGE_BPS)) / 10000n;

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
            amountInExact: null,
            maxInput: limitedMaxInput
          }));
        }
        setIsCalculatingQuote(false);
      } catch (err) {
        // Any error from getAmountsIn is treated as insufficient liquidity
        // This is an expected state, not an error, so we silently handle it
        setReverseQuote(null);
        setIsCalculatingQuote(false);
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
    const amountInForAllowance = swapForm.amountInExact ?? swapForm.amountIn;
    const maxInputForAllowance = swapForm.maxInput;

    // In exactOutput mode, check against maxInput; in exactInput mode, check against amountIn
    const amountToCheck = isExactOutput
      ? maxInputForAllowance
      : amountInForAllowance;

    if (
      !walletAccount ||
      !routerAddress ||
      !isAddress(swapForm.tokenIn) ||
      !amountToCheck ||
      Number(amountToCheck) <= 0 ||
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
        const desired = parseUnits(amountToCheck, decimals);

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
    swapForm.amountInExact,
    swapForm.maxInput,
    isExactOutput,
    allowanceNonce,
    readProvider,
    swapInIsNative,
    swapInDecimals
  ]);

  const handleSetMaxSwapAmount = useCallback(() => {
    if (!swapInBalanceFormatted) return;
    setSwapForm((prev) => ({
      ...prev,
      amountIn: formatBalanceDisplay(swapInBalanceFormatted),
      amountInExact: swapInBalanceFormatted
    }));
    swapEditingFieldRef.current = "amountIn";
  }, [swapInBalanceFormatted]);

  const handleSwapAmountInChange = useCallback(
    (value: string) => {
      // Replace commas with periods first (international number format support)
      const proposed = value.replace(/,/g, ".");

      // Validate the input
      if (!isValidNumericInput(proposed, { maxDecimals: swapInDecimals })) {
        return;
      }

      // Normalize the input (remove leading zeros, etc.)
      const normalized = normalizeNumericInput(proposed);

      swapEditingFieldRef.current = "amountIn";
      setIsExactOutput(false);
      setSwapForm((prev) => ({
        ...prev,
        amountIn: normalized,
        amountInExact: null
      }));
      setPriceImpact(null);
    },
    [swapInDecimals]
  );

  const handleSwapMinOutChange = useCallback(
    (value: string) => {
      const decimals = swapOutDecimals;

      // Replace commas with periods first (international number format support)
      const proposed = value.replace(/,/g, ".");

      // Validate the input
      if (!isValidNumericInput(proposed, { maxDecimals: decimals })) {
        return;
      }

      // Normalize the input (remove leading zeros, etc.)
      const normalized = normalizeNumericInput(proposed);

      swapEditingFieldRef.current = "minOut";
      setIsExactOutput(true);
      setSwapForm((prev) => ({
        ...prev,
        minOut: normalized
      }));
    },
    [swapOutDecimals]
  );

  const requestRouterApproval = useCallback(
    async (account: string) => {
      if (swapInIsNative) {
        throw new Error("Native MegaETH does not require approval.");
      }

      const tokenAddress = swapForm.tokenIn;
      if (!isAddress(tokenAddress) || !isAddress(routerAddress)) {
        throw new Error("Provide valid token and spender addresses.");
      }

      showLoading("Confirm token approval in your wallet...", {
        visuals: swapToastVisuals
      });

      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, MaxUint256],
        account: account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      showLoading("Token approval pending...", { visuals: swapToastVisuals });
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });

      setNeedsApproval(false);
      setAllowanceNonce((n) => n + 1);

      return txHash;
    },
    [
      routerAddress,
      showLoading,
      swapForm.tokenIn,
      swapInIsNative,
      swapToastVisuals
    ]
  );

  const ensureSufficientAllowance = useCallback(
    async (account: string, desiredAmountWei: bigint) => {
      if (swapInIsNative) {
        return true;
      }

      if (!isAddress(swapForm.tokenIn) || !isAddress(routerAddress)) {
        throw new Error("Provide valid token and spender addresses.");
      }

      const token = getToken(swapForm.tokenIn, readProvider);
      const allowance = await token.allowance(account, routerAddress);
      if (allowance >= desiredAmountWei) {
        return true;
      }

      await requestRouterApproval(account);

      // Wait briefly for the approval to be indexed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify approval using wagmi instead of ethers for better reliability
      try {
        const updatedAllowance = await readContract(wagmiConfig, {
          address: swapForm.tokenIn as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account as `0x${string}`, routerAddress as `0x${string}`],
          chainId: Number(MEGAETH_CHAIN_ID)
        });

        if (toBigInt(updatedAllowance) < desiredAmountWei) {
          throw new Error("Approval did not complete. Please try again.");
        }
      } catch (error) {
        console.warn("Could not verify allowance, proceeding anyway", error);
        // Don't throw - the approval transaction succeeded, so proceed
      }

      return true;
    },
    [
      readProvider,
      requestRouterApproval,
      routerAddress,
      swapForm.tokenIn,
      swapInIsNative
    ]
  );

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

      const amountInputForTx = swapForm.amountInExact ?? amountIn;
      const amountInWei = parseUnits(amountInputForTx, decimalsIn);
      if (amountInWei <= 0n) {
        showError("Enter a valid swap amount.");
        setIsSubmitting(false);
        return;
      }

      // For exactInput mode, ensure allowance for amountIn
      // For exactOutput mode, allowance is checked later with maxInput
      if (!isExactOutput) {
        const hasAllowance = await ensureSufficientAllowance(
          ctx.account as string,
          amountInWei
        );
        if (!hasAllowance) {
          setIsSubmitting(false);
          return;
        }
      }

      const minOutWei = parseUnits(minOut, decimalsOut);
      if (minOutWei <= 0n) {
        showError("Enter a valid minimum output amount.");
        setIsSubmitting(false);
        return;
      }

      const deadline = BigInt(nowPlusMinutes(10));

      const wrappedNative =
        wrappedNativeAddress ??
        swapInDescriptor.wrappedAddress ??
        swapOutDescriptor.wrappedAddress ??
        null;

      let functionName:
        | "swapExactTokensForTokens"
        | "swapExactETHForTokens"
        | "swapExactTokensForETH"
        | "swapTokensForExactTokens"
        | "swapETHForExactTokens"
        | "swapTokensForExactETH";
      let args: unknown[];
      let txValue: bigint | undefined;

      if (isExactOutput) {
        // ExactOutput mode: user specifies desired output, we calculate max input
        if (!maxInput) {
          showError("Could not calculate required input amount.");
          setIsSubmitting(false);
          return;
        }

        const maxInputWei = parseUnits(maxInput, decimalsIn);
        if (maxInputWei <= 0n) {
          showError("Invalid maximum input amount.");
          setIsSubmitting(false);
          return;
        }

        // Need to ensure allowance for maxInput instead of amountIn (only for non-native tokens)
        if (!swapInIsNative) {
          const hasAllowance = await ensureSufficientAllowance(
            ctx.account as string,
            maxInputWei
          );
          if (!hasAllowance) {
            setIsSubmitting(false);
            return;
          }
        }

        if (swapInIsNative) {
          if (!wrappedNative || !isAddress(wrappedNative)) {
            showError("Wrapped native address unavailable.");
            setIsSubmitting(false);
            return;
          }
          const path: `0x${string}`[] = [
            wrappedNative as `0x${string}`,
            swapOutTokenAddress as `0x${string}`
          ];
          functionName = "swapETHForExactTokens";
          args = [minOutWei, path, ctx.account as `0x${string}`, deadline];
          txValue = maxInputWei;
        } else if (swapOutIsNative) {
          if (!wrappedNative || !isAddress(wrappedNative)) {
            showError("Wrapped native address unavailable.");
            setIsSubmitting(false);
            return;
          }
          const path: `0x${string}`[] = [
            swapInTokenAddress as `0x${string}`,
            wrappedNative as `0x${string}`
          ];
          functionName = "swapTokensForExactETH";
          args = [
            minOutWei,
            maxInputWei,
            path,
            ctx.account as `0x${string}`,
            deadline
          ];
        } else {
          const path: `0x${string}`[] = [
            swapInTokenAddress as `0x${string}`,
            swapOutTokenAddress as `0x${string}`
          ];
          functionName = "swapTokensForExactTokens";
          args = [
            minOutWei,
            maxInputWei,
            path,
            ctx.account as `0x${string}`,
            deadline
          ];
        }
      } else {
        // ExactInput mode: user specifies exact input, we calculate min output
        if (swapInIsNative) {
          if (!wrappedNative || !isAddress(wrappedNative)) {
            showError("Wrapped native address unavailable.");
            setIsSubmitting(false);
            return;
          }
          const path: `0x${string}`[] = [
            wrappedNative as `0x${string}`,
            swapOutTokenAddress as `0x${string}`
          ];
          functionName = "swapExactETHForTokens";
          args = [minOutWei, path, ctx.account as `0x${string}`, deadline];
          txValue = amountInWei;
        } else if (swapOutIsNative) {
          if (!wrappedNative || !isAddress(wrappedNative)) {
            showError("Wrapped native address unavailable.");
            setIsSubmitting(false);
            return;
          }
          const path: `0x${string}`[] = [
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
          const path: `0x${string}`[] = [
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
      }

      showLoading("Confirm swap in your wallet...", {
        visuals: swapToastVisuals
      });

      const baseTxRequest = {
        address: routerAddress as `0x${string}`,
        abi: warpRouterAbi,
        functionName,
        args,
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID)
      };

      const txRequestWithValue =
        txValue && txValue > 0n
          ? {
              ...baseTxRequest,
              value: txValue
            }
          : baseTxRequest;

      // Retry logic for rate limit errors
      let txHash: `0x${string}` | undefined;
      let retries = 3;
      let lastError: Error | null = null;

      while (retries > 0 && !txHash) {
        try {
          txHash = await writeContract(wagmiConfig, {
            ...txRequestWithValue
          } as Parameters<typeof writeContract>[1]);
        } catch (error: any) {
          lastError = error;
          const errorMessage = error?.message || String(error);

          // Check if it's a rate limit error
          if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
            retries--;
            if (retries > 0) {
              console.warn(`Rate limited, retrying... (${retries} attempts left)`);
              // Wait with exponential backoff: 2s, 4s, 8s
              await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
              continue;
            }
          }
          // If not a rate limit error, or out of retries, throw immediately
          throw error;
        }
      }

      if (!txHash) {
        throw lastError || new Error("Failed to execute swap transaction");
      }

      showLoading("Swap transaction pending...", { visuals: swapToastVisuals });
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      await refetchSwapInBalance();
      setSwapForm((prev) => ({
        ...prev,
        amountIn: "",
        amountInExact: null,
        minOut: "",
        maxInput: ""
      }));
      swapEditingFieldRef.current = null;
      setSwapQuote(null);
      setReverseQuote(null);
      setIsCalculatingQuote(false);
      setSwapHasLiquidity(null);
      setIsExactOutput(false);
      onRequestRefresh();
      if (!swapInIsNative) {
        setAllowanceNonce((n) => n + 1);
      }
      setNeedsApproval(false);
      setCheckingAllowance(false);
      showSuccess("Swap executed successfully.", {
        link: { href: buildExplorerTxUrl(txHash), label: "View on explorer" },
        visuals: swapToastVisuals
      });
    } catch (err) {
      console.error("[swap] failed", err);
      showError(parseErrorMessage(err), {
        visuals: swapToastVisuals
      });
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
    swapToastVisuals,
    swapForm,
    swapInDescriptor,
    swapOutDescriptor,
    swapInIsNative,
    swapOutIsNative,
    swapInTokenAddress,
    swapOutTokenAddress,
    wrappedNativeAddress,
    ensureSufficientAllowance
  ]);

  const handleApprove = useCallback(async () => {
    const tokenAddress = swapForm.tokenIn;
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
      await requestRouterApproval(ctx.account as string);
      showLoading("Approval confirmed, continuing…", {
        visuals: swapToastVisuals
      });
      setIsSubmitting(false);
      setTimeout(() => {
        handleSwap();
      }, 0);
      return;
    } catch (err) {
      console.error("[swap] approval failed", err);
      showError(parseErrorMessage(err), {
        visuals: swapToastVisuals
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    handleSwap,
    requestRouterApproval,
    routerAddress,
    showError,
    showLoading,
    swapForm.tokenIn,
    swapInIsNative,
    swapToastVisuals
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
    swapButtonAction = onConnect ?? null;
  } else if (!isWalletConnected) {
    swapButtonLabel = isAccountConnecting ? "Connecting..." : "Connect Wallet";
    swapButtonAction = onConnect ?? null;
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
      const amountInNum = Number(swapForm.amountInExact ?? swapForm.amountIn);
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
        formattedRate = rate.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4
        });
      } else {
        // For rates < 1, show more precision
        formattedRate = rate.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      }

      return `1 ${selectedIn.symbol} = ${formattedRate} ${selectedOut.symbol}`;
    } catch (err) {
      return null;
    }
  }, [
    swapQuote,
    swapForm.amountIn,
    swapForm.amountInExact,
    selectedIn,
    selectedOut
  ]);

  const receiveAmountValue =
    swapEditingFieldRef.current === "minOut"
      ? swapForm.minOut
      : (swapQuote?.amount ?? "");
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
      priceImpact={priceImpact}
      slippage={slippagePercentDisplay}
      buttonLabel={swapButtonLabel}
      buttonDisabled={swapButtonDisabled}
      onButtonClick={swapButtonAction}
    />
  );
}

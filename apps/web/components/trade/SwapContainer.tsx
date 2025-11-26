import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import { formatUnits, parseUnits, MaxUint256 } from "ethers";
import { CurrencyAmount } from "@megaeth/warp-sdk-core";
import { Route, Trade } from "@megaeth/warp-v2-sdk";
import type { Address } from "viem";
import { useBalance } from "wagmi";
import {
  readContract,
  writeContract,
  waitForTransactionReceipt
} from "wagmi/actions";
import { erc20Abi } from "@/lib/abis/erc20";
import { warpRouterAbi } from "@/lib/abis/router";
import { getToken } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { toBigInt } from "@/lib/utils/math";
import { fetchPair, toSdkToken } from "@/lib/trade/warp";
import { SwapCard } from "./SwapCard";
import {
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_TOKEN_DECIMALS,
  TOKEN_CATALOG,
  MEGAETH_CHAIN_ID,
  SWAP_DEFAULT
} from "@/lib/trade/constants";
import { parseErrorMessage } from "@/lib/trade/errors";
import type {
  Quote,
  ReverseQuote,
  SwapFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import { isValidNumericInput, normalizeNumericInput } from "@/lib/utils/input";
import type { ToastOptions } from "@/hooks/useToasts";
import { buildToastVisuals } from "@/lib/toastVisuals";
import { useFirstTransactionCelebration } from "@/hooks/useFirstTransactionCelebration";
import { useLocalization } from "@/lib/format/LocalizationContext";
import { NumberType } from "@/lib/format/formatNumbers";
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
  refreshNonce,
  onRequestRefresh,
  onConnect
}: SwapContainerProps) {
  const {
    formatNumber: formatDisplayNumber,
    formatPercent,
    formatBalanceDisplay,
    locale
  } = useLocalization();
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
  const [transactionStatus, setTransactionStatus] = useState<{
    message: string;
    type: "idle" | "pending" | "success" | "error";
  }>({ message: "", type: "idle" });
  const swapEditingFieldRef = useRef<"amountIn" | "minOut" | null>(null);
  const txStartTimeRef = useRef<number>(0);
  const { shouldCelebrate, celebrate } = useFirstTransactionCelebration();
  const [isExactOutput, setIsExactOutput] = useState(false);
  const quoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reverseQuoteDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allowanceDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousSwapSelectionRef = useRef<{
    in: string | null;
    out: string | null;
  }>({ in: null, out: null });
  const tokenMetadataCacheRef = useRef<Map<string, TokenDescriptor>>(new Map());
  const factoryAddressRef = useRef<string | null>(null);

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
  const swapOutIsAddress = isAddress(swapOutTokenAddress);
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

  const { data: swapOutBalanceData } = useBalance({
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
      (swapOutIsNative || swapOutIsAddress) &&
      swapOutTokenAddress
        ? swapOutIsNative
          ? undefined
          : (swapOutTokenAddress as Address)
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        Boolean(walletAccount) &&
        Boolean(swapOutTokenAddress) &&
        hasMounted &&
        isWalletConnected &&
        chainId === Number(MEGAETH_CHAIN_ID) &&
        (swapOutIsNative || swapOutIsAddress)
    }
  });

  const swapOutBalanceFormatted = swapOutBalanceData?.formatted ?? null;
  const swapInSymbol =
    swapInDescriptor?.symbol ?? swapInBalanceData?.symbol ?? null;

  const swapInBalanceValue = swapInBalanceData?.value ?? null;
  const swapInDecimals = swapInDescriptor?.decimals ?? DEFAULT_TOKEN_DECIMALS;

  const swapToastVisuals = useMemo(
    () => buildToastVisuals("swap", selectedIn, selectedOut),
    [selectedIn, selectedOut]
  );

  useEffect(() => {
    factoryAddressRef.current = null;
  }, [routerAddress]);

  const resolveTokenDescriptor = useCallback(
    async (address: string): Promise<TokenDescriptor | null> => {
      if (!address) {
        return null;
      }

      const normalized = address.toLowerCase();
      if (tokenMetadataCacheRef.current.has(normalized)) {
        return tokenMetadataCacheRef.current.get(normalized)!;
      }

      const matchFromDescriptor = (
        descriptor?: TokenDescriptor | null
      ): TokenDescriptor | null => {
        if (!descriptor) {
          return null;
        }
        if (descriptor.address.toLowerCase() === normalized) {
          return descriptor;
        }
        if (
          descriptor.wrappedAddress &&
          descriptor.wrappedAddress.toLowerCase() === normalized
        ) {
          return {
            ...descriptor,
            address: descriptor.wrappedAddress,
            isNative: false
          };
        }
        return null;
      };

      const selectionMatch =
        matchFromDescriptor(selectedIn) ?? matchFromDescriptor(selectedOut);
      if (selectionMatch) {
        tokenMetadataCacheRef.current.set(normalized, selectionMatch);
        return selectionMatch;
      }

      for (const catalogToken of TOKEN_CATALOG) {
        const catalogMatch = matchFromDescriptor(catalogToken);
        if (catalogMatch) {
          tokenMetadataCacheRef.current.set(normalized, catalogMatch);
          return catalogMatch;
        }
      }

      try {
        const tokenContract = getToken(address, readProvider);
        const [decimals, symbol, name] = await Promise.all([
          tokenContract.decimals(),
          tokenContract.symbol().catch(() => ""),
          tokenContract.name().catch(() => "")
        ]);

        const descriptor: TokenDescriptor = {
          address,
          decimals,
          symbol: symbol || "TKN",
          name: name || address
        };
        tokenMetadataCacheRef.current.set(normalized, descriptor);
        return descriptor;
      } catch (error) {
        console.error(`Failed to load token metadata for ${address}`, error);
        return null;
      }
    },
    [readProvider, selectedIn, selectedOut]
  );

  const getFactoryAddress = useCallback(async () => {
    if (!routerAddress) {
      return null;
    }

    if (factoryAddressRef.current) {
      return factoryAddressRef.current;
    }

    try {
      const factoryAddress = (await readContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: warpRouterAbi,
        functionName: "factory",
        chainId: Number(MEGAETH_CHAIN_ID)
      })) as `0x${string}`;
      factoryAddressRef.current = factoryAddress;
      return factoryAddress;
    } catch (error) {
      console.error("Failed to fetch factory address:", error);
      return null;
    }
  }, [routerAddress]);

  const calculatePriceImpact = useCallback(
    async (amountInWei: bigint, path: `0x${string}`[]) => {
      if (!path.length || path.length < 2) {
        return null;
      }

      const factoryAddress = await getFactoryAddress();
      if (!factoryAddress) {
        return null;
      }

      try {
        const descriptors: TokenDescriptor[] = [];
        for (const tokenAddress of path) {
          const descriptor = await resolveTokenDescriptor(tokenAddress);
          if (!descriptor) {
            return null;
          }
          descriptors.push(descriptor);
        }

        const sdkTokens = descriptors.map(toSdkToken);
        const pairs = [];
        for (let i = 0; i < sdkTokens.length - 1; i += 1) {
          const pair = await fetchPair(
            sdkTokens[i],
            sdkTokens[i + 1],
            readProvider,
            factoryAddress
          );
          if (!pair) {
            return null;
          }
          pairs.push(pair);
        }

        if (!pairs.length) {
          return null;
        }

        const route = new Route(
          pairs,
          sdkTokens[0],
          sdkTokens[sdkTokens.length - 1]
        );
        const inputAmount = CurrencyAmount.fromRawAmount(
          sdkTokens[0],
          amountInWei
        );
        const trade = Trade.exactIn(route, inputAmount);
        const percentString = trade.priceImpact.multiply(100).toFixed(4);
        const impactPercent = Number(percentString);
        if (Number.isNaN(impactPercent)) {
          return null;
        }
        return impactPercent;
      } catch (error) {
        console.error("Price impact calculation failed:", error);
        return null;
      }
    },
    [getFactoryAddress, readProvider, resolveTokenDescriptor]
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
    setPriceImpact(null);
  }, [selectedIn?.address, selectedOut?.address]);

  useEffect(() => {
    let isCancelled = false;
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
      setPriceImpact(null);
      return;
    }

    quoteDebounceTimerRef.current = setTimeout(async () => {
      setIsCalculatingQuote(true);

      if (!amountInForQuote || Number(amountInForQuote) <= 0) {
        setIsCalculatingQuote(false);
        setPriceImpact(null);
        return;
      }

      const decimalsIn = selectedIn?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsOut = selectedOut?.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const symbolOut = selectedOut?.symbol ?? "TOKEN";

      try {
        const amountInWei = parseUnits(amountInForQuote, decimalsIn);
        if (amountInWei <= 0n) {
          setIsCalculatingQuote(false);
          setPriceImpact(null);
          return;
        }

        if (!routerAddress || !selectedIn || !selectedOut) {
          setIsCalculatingQuote(false);
          setSwapQuote(null);
          setSwapForm((prev) => ({ ...prev, minOut: "" }));
          setPriceImpact(null);
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
          setPriceImpact(null);
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
          setPriceImpact(null);
          return;
        }

        // Following Uniswap's approach: Always show the quote if it's valid
        // Price impact warnings are shown in the UI, but swaps are never blocked
        setSwapHasLiquidity(true);

        const impact = await calculatePriceImpact(amountInWei, path);
        if (!isCancelled) {
          setPriceImpact(impact);
        }

        const outputExact = formatUnits(amountOutWei, decimalsOut);
        const limitedOut = formatDisplayNumber({
          input: outputExact,
          type: NumberType.TokenTx
        });

        const minOutWei =
          (amountOutWei * (10000n - DEFAULT_SLIPPAGE_BPS)) / 10000n;
        const limitedMinOut = formatDisplayNumber({
          input: formatUnits(minOutWei, decimalsOut),
          type: NumberType.TokenTx
        });

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
      isCancelled = true;
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
    wrappedNativeAddress,
    calculatePriceImpact,
    formatDisplayNumber
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
        // Convert any commas to periods before parsing (Uniswap approach)
        const normalizedMinOut = swapForm.minOut.replace(/,/g, '.');
        const desiredOutWei = parseUnits(normalizedMinOut, decimalsOut);
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
            maxInput: ""
          }));
          setSwapHasLiquidity(false);
          setPriceImpact(null);
          return;
        }

        const maxInputWei =
          (amountNeededWei * (10000n + DEFAULT_SLIPPAGE_BPS)) / 10000n;

        const limitedIn = formatDisplayNumber({
          input: formatUnits(amountNeededWei, decimalsIn),
          type: NumberType.TokenTx
        });
        const limitedMaxInput = formatDisplayNumber({
          input: formatUnits(maxInputWei, decimalsIn),
          type: NumberType.TokenTx
        });

        if (swapEditingFieldRef.current === "minOut") {
          setReverseQuote({ amount: limitedIn, symbolIn, symbolOut });
          setSwapForm((prev) => ({
            ...prev,
            amountIn: limitedIn,
            amountInExact: null,
            maxInput: limitedMaxInput
          }));
          // DON'T switch to amountIn - keep it as minOut to prevent forward quote from overwriting

          // Calculate price impact for reverse quote
          const impact = await calculatePriceImpact(amountNeededWei, path);
          setPriceImpact(impact);
        }
        setSwapHasLiquidity(true);
        setIsCalculatingQuote(false);
      } catch (err) {
        // Any error from getAmountsIn is treated as insufficient liquidity
        // This is an expected state, not an error, so we silently handle it
        setReverseQuote(null);
        setSwapForm((prev) => ({
          ...prev,
          maxInput: ""
        }));
        setSwapHasLiquidity(false);
        setPriceImpact(null);
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
    showError,
    formatDisplayNumber
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
    setPriceImpact(null);
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
      setSwapForm((prev) => {
        if (!normalized) {
          // Clearing the receive side should clear the sell side as well
          return {
            ...prev,
            minOut: "",
            amountIn: "",
            amountInExact: null,
            maxInput: ""
          };
        }
        return {
          ...prev,
          minOut: normalized
        };
      });
      if (!normalized) {
        setReverseQuote(null);
        setSwapHasLiquidity(null);
      }
      setPriceImpact(null);
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

      setTransactionStatus({
        message: "Confirm approval...",
        type: "pending"
      });

      const txHash = await writeContract(wagmiConfig, {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, MaxUint256],
        account: account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash,
        timeout: 10000 // 10 second timeout for MegaETH fast finality
      });

      setNeedsApproval(false);
      setAllowanceNonce((n) => n + 1);

      // Reset status - will be set again when swap starts
      setTransactionStatus({
        message: "",
        type: "idle"
      });
    },
    [routerAddress, swapForm.tokenIn, swapInIsNative]
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
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

      // Convert any commas to periods before parsing (Uniswap approach)
      const normalizedMinOut = minOut.replace(/,/g, '.');
      const minOutWei = parseUnits(normalizedMinOut, decimalsOut);
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

      setTransactionStatus({
        message: "Confirm in wallet...",
        type: "pending"
      });

      const txHash = await writeContract(wagmiConfig, {
        address: routerAddress as `0x${string}`,
        abi: warpRouterAbi,
        functionName,
        args: args as any,
        value: txValue,
        account: ctx.account as `0x${string}`,
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      // Start transaction timer AFTER user confirms in wallet
      txStartTimeRef.current = performance.now();

      setTransactionStatus({
        message: "Swapping...",
        type: "pending"
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash,
        timeout: 10000 // 10 second timeout for MegaETH fast finality
      });

      // Calculate transaction time
      const txDuration = Math.round(performance.now() - txStartTimeRef.current);

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
      setPriceImpact(null);
      onRequestRefresh();
      if (!swapInIsNative) {
        setAllowanceNonce((n) => n + 1);
      }
      setNeedsApproval(false);
      setCheckingAllowance(false);

      const txSeconds = (txDuration / 1000).toFixed(2);

      setTransactionStatus({
        message: `Transaction done in ${txSeconds}s`,
        type: "success"
      });

      // Trigger celebration if this is the first transaction
      if (shouldCelebrate) {
        celebrate();
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setTransactionStatus({ message: "", type: "idle" });
      }, 3000);
    } catch (err) {
      console.error("[swap] failed", err);
      const errorMsg = parseErrorMessage(err);
      setTransactionStatus({
        message: errorMsg,
        type: "error"
      });

      // Clear error message after 3 seconds
      setTimeout(() => {
        setTransactionStatus({ message: "", type: "idle" });
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    onRequestRefresh,
    refetchSwapInBalance,
    routerAddress,
    showError,
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
      setIsSubmitting(false);
      setTimeout(() => {
        handleSwap();
      }, 0);
      return;
    } catch (err) {
      console.error("[swap] approval failed", err);
      const errorMsg = parseErrorMessage(err);
      setTransactionStatus({
        message: errorMsg,
        type: "error"
      });

      // Clear error message after 3 seconds
      setTimeout(() => {
        setTransactionStatus({ message: "", type: "idle" });
      }, 3000);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    handleSwap,
    requestRouterApproval,
    routerAddress,
    showError,
    swapForm.tokenIn,
    swapInIsNative
  ]);

  const slippagePercentDisplay = useMemo(
    () => formatPercent(Number(DEFAULT_SLIPPAGE_BPS) / 100),
    [formatPercent]
  );

  const isAmountInComplete = useMemo(() => {
    const value = swapForm.amountInExact ?? swapForm.amountIn;
    if (!value || value === "." || value.endsWith(".")) {
      return false;
    }
    return Number(value) > 0;
  }, [swapForm.amountIn, swapForm.amountInExact]);

  const isMinOutComplete = useMemo(() => {
    if (!isExactOutput) return true;
    const value = swapForm.minOut;
    if (!value || value === "." || value.endsWith(".")) {
      return false;
    }
    return Number(value) > 0;
  }, [isExactOutput, swapForm.minOut]);

  const swapFormReady =
    isAddress(swapForm.tokenIn) &&
    isAddress(swapForm.tokenOut) &&
    isAmountInComplete &&
    isMinOutComplete;

  let swapButtonLabel = "Swap";
  let swapButtonDisabled = false;
  let swapButtonAction: (() => void) | null = null;

  // Check transaction status FIRST - these override everything
  if (transactionStatus.type === "pending") {
    swapButtonLabel = transactionStatus.message;
    swapButtonDisabled = true;
    swapButtonAction = null;
  } else if (transactionStatus.type === "success") {
    swapButtonLabel = transactionStatus.message;
    swapButtonDisabled = true;
    swapButtonAction = null;
  } else if (transactionStatus.type === "error") {
    swapButtonLabel = transactionStatus.message;
    swapButtonDisabled = true;
    swapButtonAction = null;
  } else if (!hasMounted) {
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

  const receiveAmountValue =
    swapEditingFieldRef.current === "minOut"
      ? swapForm.minOut
      : (swapQuote?.amount ?? "");
  const minReceivedDisplay = swapForm.minOut
    ? formatDisplayNumber({ input: swapForm.minOut, type: NumberType.TokenTx })
    : null;
  const priceImpactDisplay =
    priceImpact === null ? null : formatPercent(priceImpact);

  return (
    <SwapCard
      swapForm={swapForm}
      swapQuote={swapQuote}
      selectedIn={selectedIn}
      selectedOut={selectedOut}
      onOpenTokenDialog={onOpenTokenDialog}
      onSwapTokens={onSwapTokens}
      onAmountInChange={handleSwapAmountInChange}
      onMinOutChange={handleSwapMinOutChange}
      formatBalance={formatBalanceDisplay}
      swapInBalanceFormatted={swapInBalanceFormatted}
      swapOutBalanceFormatted={swapOutBalanceFormatted}
      swapInSymbol={swapInSymbol}
      onSetMaxSwapAmount={handleSetMaxSwapAmount}
      receiveValue={receiveAmountValue}
      minReceived={minReceivedDisplay}
      priceImpact={priceImpact}
      priceImpactDisplay={priceImpactDisplay}
      slippage={slippagePercentDisplay}
      buttonLabel={swapButtonLabel}
      buttonDisabled={swapButtonDisabled}
      onButtonClick={swapButtonAction}
      transactionStatus={transactionStatus}
      locale={locale}
    />
  );
}

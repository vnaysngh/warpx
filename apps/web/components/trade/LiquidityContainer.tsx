import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import { formatUnits, parseUnits, MaxUint256 } from "ethers";
import { useDebounce } from "@/hooks/useDebounce";
import { pairAbi } from "@/lib/abis/pair";
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
import { LiquiditySection } from "./LiquiditySection";
import { LiquidityConfirmDialog } from "./LiquidityConfirmDialog";
import {
  DEFAULT_TOKEN_DECIMALS,
  LIQUIDITY_DEFAULT,
  MEGAETH_CHAIN_ID
} from "@/lib/trade/constants";
import { formatNumber, getLiquidityRemoveAmounts } from "@/lib/trade/math";
import { parseErrorMessage } from "@/lib/trade/errors";
import type {
  LiquidityFormState,
  TokenDescriptor,
  TokenDialogSlot
} from "@/lib/trade/types";
import { formatBalanceDisplay, buildExplorerTxUrl } from "@/lib/trade/format";
import type { PoolDetailsData } from "@/hooks/usePoolDetails";
import type { ToastOptions } from "@/hooks/useToasts";


type LiquidityContainerProps = {
  liquidityTokenA: TokenDescriptor | null;
  liquidityTokenB: TokenDescriptor | null;
  onOpenTokenDialog: (slot: TokenDialogSlot) => void;
  routerAddress: string;
  pairAddress: string;
  pairToken0?: string | null;
  pairToken1?: string | null;
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
  onSwapRefresh: () => void;
  allowTokenSelection?: boolean;
  poolDetails?: PoolDetailsData | null;
  onConnect?: () => void;
};

const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const clampPercentToBigInt = (value: string): bigint => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0n;
  const clamped = Math.min(100, Math.max(0, Math.trunc(numeric)));
  return BigInt(clamped);
};

export function LiquidityContainer({
  liquidityTokenA,
  liquidityTokenB,
  onOpenTokenDialog,
  routerAddress,
  pairAddress,
  pairToken0,
  pairToken1,
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
  onSwapRefresh,
  allowTokenSelection = true,
  poolDetails,
  onConnect
}: LiquidityContainerProps) {
  const [liquidityMode, setLiquidityMode] = useState<"add" | "remove">("add");
  const [liquidityForm, setLiquidityForm] =
    useState<LiquidityFormState>(LIQUIDITY_DEFAULT);
  const [needsApprovalA, setNeedsApprovalA] = useState(false);
  const [needsApprovalB, setNeedsApprovalB] = useState(false);
  const [checkingLiquidityAllowances, setCheckingLiquidityAllowances] =
    useState(false);
  const [liquidityAllowanceNonce, setLiquidityAllowanceNonce] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [liquidityPairReserves, setLiquidityPairReserves] = useState<{
    reserveA: string;
    reserveB: string;
    pairAddress: string;
    totalSupply: string;
    reserveAWei: bigint;
    reserveBWei: bigint;
    totalSupplyWei: bigint;
  } | null>(null);
  const [liquidityReservesRefreshNonce, setLiquidityReservesRefreshNonce] =
    useState(0);
  const liquidityEditingFieldRef = useRef<"A" | "B" | null>(null);
  const previousLiquiditySelectionRef = useRef<{
    a: string | null;
    b: string | null;
  }>({ a: null, b: null });

  const liquidityTokenAAddress = liquidityTokenA?.address ?? "";
  const liquidityTokenBAddress = liquidityTokenB?.address ?? "";
  const liquidityTokenAIsNative = Boolean(liquidityTokenA?.isNative);
  const liquidityTokenBIsNative = Boolean(liquidityTokenB?.isNative);

  // Debounce amounts to avoid excessive allowance checks while typing
  const debouncedAmountA = useDebounce(
    liquidityForm.amountAExact ?? liquidityForm.amountA,
    500
  );
  const debouncedAmountB = useDebounce(
    liquidityForm.amountBExact ?? liquidityForm.amountB,
    500
  );

  const handleOpenTokenDialog = useCallback(
    (slot: TokenDialogSlot) => {
      if (!allowTokenSelection) return;
      onOpenTokenDialog(slot);
    },
    [allowTokenSelection, onOpenTokenDialog]
  );

  const balanceQueryEnabled =
    hasMounted && isWalletConnected && chainId === Number(MEGAETH_CHAIN_ID);

  const tokenAIsAddress = isAddress(liquidityTokenAAddress);
  const tokenBIsAddress = isAddress(liquidityTokenBAddress);

  const {
    data: balanceAData,
    refetch: refetchBalanceA
  } = useBalance({
    address:
      balanceQueryEnabled && walletAccount ? (walletAccount as Address) : undefined,
    token:
      balanceQueryEnabled && (liquidityTokenAIsNative || tokenAIsAddress)
        ? (liquidityTokenAIsNative ? undefined : (liquidityTokenAAddress as Address))
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        balanceQueryEnabled && (liquidityTokenAIsNative || tokenAIsAddress) && Boolean(liquidityTokenAAddress)
    }
  });

  const {
    data: balanceBData,
    refetch: refetchBalanceB
  } = useBalance({
    address:
      balanceQueryEnabled && walletAccount ? (walletAccount as Address) : undefined,
    token:
      balanceQueryEnabled && (liquidityTokenBIsNative || tokenBIsAddress)
        ? (liquidityTokenBIsNative ? undefined : (liquidityTokenBAddress as Address))
        : undefined,
    chainId: Number(MEGAETH_CHAIN_ID),
    query: {
      enabled:
        balanceQueryEnabled && (liquidityTokenBIsNative || tokenBIsAddress) && Boolean(liquidityTokenBAddress)
    }
  });

  const tokenABalanceFormatted = balanceAData?.formatted ?? null;
  const tokenBBalanceFormatted = balanceBData?.formatted ?? null;

  const resolveDisplaySymbol = (
    token: TokenDescriptor | null,
    fetchedSymbol: string | undefined
  ) => {
    if (!token) return fetchedSymbol ?? null;
    if (token.isNative) {
      return token.symbol ?? fetchedSymbol ?? null;
    }
    return fetchedSymbol ?? token.symbol ?? null;
  };

  const tokenASymbol = resolveDisplaySymbol(liquidityTokenA, balanceAData?.symbol);
  const tokenBSymbol = resolveDisplaySymbol(liquidityTokenB, balanceBData?.symbol);

  const balanceAWei = balanceAData?.value ?? null;
  const balanceBWei = balanceBData?.value ?? null;
  const decimalsLiquidityA = liquidityTokenA?.decimals ?? DEFAULT_TOKEN_DECIMALS;
  const decimalsLiquidityB = liquidityTokenB?.decimals ?? DEFAULT_TOKEN_DECIMALS;

  const parsedLiquidityAmountA = useMemo(() => {
    const source = liquidityForm.amountAExact ?? liquidityForm.amountA;
    if (!source) return null;
    try {
      return parseUnits(source, decimalsLiquidityA);
    } catch (error) {
      return null;
    }
  }, [liquidityForm.amountA, liquidityForm.amountAExact, decimalsLiquidityA]);

  const parsedLiquidityAmountB = useMemo(() => {
    const source = liquidityForm.amountBExact ?? liquidityForm.amountB;
    if (!source) return null;
    try {
      return parseUnits(source, decimalsLiquidityB);
    } catch (error) {
      return null;
    }
  }, [liquidityForm.amountB, liquidityForm.amountBExact, decimalsLiquidityB]);

  const insufficientLiquidityA = useMemo(() => {
    if (!parsedLiquidityAmountA || balanceAWei === null) return false;
    return parsedLiquidityAmountA > balanceAWei;
  }, [parsedLiquidityAmountA, balanceAWei]);

  const insufficientLiquidityB = useMemo(() => {
    if (!parsedLiquidityAmountB || balanceBWei === null) return false;
    return parsedLiquidityAmountB > balanceBWei;
  }, [parsedLiquidityAmountB, balanceBWei]);

  const refreshBalances = useCallback(async () => {
    const refetchPromises: Array<Promise<unknown>> = [];

    if (tokenAIsAddress || liquidityTokenAIsNative) {
      refetchPromises.push(refetchBalanceA());
    }
    if (tokenBIsAddress || liquidityTokenBIsNative) {
      refetchPromises.push(refetchBalanceB());
    }

    if (refetchPromises.length === 0) return;

    await Promise.allSettled(refetchPromises);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAIsAddress, tokenBIsAddress, refetchBalanceA, refetchBalanceB]);

  const ensureWallet = useCallback(
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
    },
    [walletAccount, ready, showError]
  );

  useEffect(() => {
    const currentA = liquidityTokenA?.address
      ? liquidityTokenA.address.toLowerCase()
      : null;
    const currentB = liquidityTokenB?.address
      ? liquidityTokenB.address.toLowerCase()
      : null;
    const previous = previousLiquiditySelectionRef.current;

    if (previous.a === currentA && previous.b === currentB) {
      return;
    }

    previousLiquiditySelectionRef.current = { a: currentA, b: currentB };
    liquidityEditingFieldRef.current = null;
    setLiquidityForm(LIQUIDITY_DEFAULT);
    setNeedsApprovalA(false);
    setNeedsApprovalB(false);
    setCheckingLiquidityAllowances(false);
    setShowLiquidityConfirm(false);
    setExpectedRemoveAmounts(null);
    setUserPooledAmounts(null);
    setLpTokenInfo(null);
  }, [liquidityTokenA?.address, liquidityTokenB?.address]);
  useEffect(() => {
    let active = true;
    const fetchPairReserves = async () => {
      if (
        !pairAddress ||
        !liquidityTokenAAddress ||
        !liquidityTokenBAddress
      ) {
        if (active) setLiquidityPairReserves(null);
        return;
      }

      if (!liquidityTokenA || !liquidityTokenB) {
        if (active) setLiquidityPairReserves(null);
        return;
      }

      const decimalsA = liquidityTokenA.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsB = liquidityTokenB.decimals ?? DEFAULT_TOKEN_DECIMALS;

      const tokenALower = liquidityTokenAAddress.toLowerCase();
      const tokenBLower = liquidityTokenBAddress.toLowerCase();
      const pairToken0Lower = pairToken0?.toLowerCase() ?? null;
      const pairToken1Lower = pairToken1?.toLowerCase() ?? null;

      if (!pairToken0Lower || !pairToken1Lower) {
        if (active) setLiquidityPairReserves(null);
        return;
      }

      // Use poolDetails if available (from multicall)
      if (poolDetails && liquidityReservesRefreshNonce === 0) {
        const { reserves, totalSupply } = poolDetails;

        const reserveAWei =
          pairToken0Lower === tokenALower ? reserves.reserve0 : reserves.reserve1;
        const reserveBWei =
          pairToken0Lower === tokenBLower ? reserves.reserve0 : reserves.reserve1;

        if (active) {
          setLiquidityPairReserves({
            reserveA: formatUnits(reserveAWei, decimalsA),
            reserveB: formatUnits(reserveBWei, decimalsB),
            pairAddress,
            totalSupply: formatUnits(totalSupply, 18),
            reserveAWei,
            reserveBWei,
            totalSupplyWei: totalSupply
          });
        }
        return;
      }

      // Fallback: fetch from contract if poolDetails not available or refreshing
      try {
        const [reservesData, totalSupplyData] = await Promise.all([
          readContract(wagmiConfig, {
            address: pairAddress as `0x${string}`,
            abi: pairAbi,
            functionName: "getReserves"
          }),
          readContract(wagmiConfig, {
            address: pairAddress as `0x${string}`,
            abi: pairAbi,
            functionName: "totalSupply"
          })
        ]);

        if (!active) return;

        const [reserve0, reserve1] = reservesData as readonly [bigint, bigint, number];
        const reserveAWei =
          pairToken0Lower === tokenALower ? reserve0 : reserve1;
        const reserveBWei =
          pairToken0Lower === tokenBLower ? reserve0 : reserve1;
        const totalSupplyWei = totalSupplyData as bigint;

        setLiquidityPairReserves({
          reserveA: formatUnits(reserveAWei, decimalsA),
          reserveB: formatUnits(reserveBWei, decimalsB),
          pairAddress,
          totalSupply: formatUnits(totalSupplyWei, 18),
          reserveAWei,
          reserveBWei,
          totalSupplyWei
        });
      } catch (err) {
        const code = typeof err === "object" && err && "code" in err ? (err as { code?: string }).code : undefined;
        if (code === "CALL_EXCEPTION") {
          console.warn("[liquidity] pair reserves unavailable after removal");
        } else {
          console.error("[liquidity] fetch pair reserves failed", err);
        }
        if (active) setLiquidityPairReserves(null);
      }
    };

    fetchPairReserves();
    return () => {
      active = false;
    };
  }, [
    pairAddress,
    pairToken0,
    pairToken1,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    liquidityTokenA,
    liquidityTokenB,
    liquidityReservesRefreshNonce,
    poolDetails
  ]);

  useEffect(() => {
    let cancelled = false;
    const evaluate = async () => {
      if (liquidityMode !== "add") {
        if (!cancelled) {
          setNeedsApprovalA(false);
          setNeedsApprovalB(false);
          setCheckingLiquidityAllowances(false);
        }
        return;
      }
      if (
        !walletAccount ||
        !routerAddress ||
        !liquidityTokenAAddress ||
        !liquidityTokenBAddress ||
        !debouncedAmountA ||
        !debouncedAmountB
      ) {
        if (!cancelled) {
          setNeedsApprovalA(false);
          setNeedsApprovalB(false);
          setCheckingLiquidityAllowances(false);
        }
        return;
      }

      try {
        if (!cancelled) {
          setCheckingLiquidityAllowances(true);
        }
        const provider = readProvider;

        const decimalsA = liquidityTokenA?.decimals ?? DEFAULT_TOKEN_DECIMALS;
        const decimalsB = liquidityTokenB?.decimals ?? DEFAULT_TOKEN_DECIMALS;

        const desiredA = parseUnits(debouncedAmountA, decimalsA);
        const desiredB = parseUnits(debouncedAmountB, decimalsB);

        const allowanceAPromise = liquidityTokenAIsNative
          ? Promise.resolve(desiredA)
          : getToken(liquidityTokenAAddress, provider).allowance(
              walletAccount,
              routerAddress
            );

        const allowanceBPromise = liquidityTokenBIsNative
          ? Promise.resolve(desiredB)
          : getToken(liquidityTokenBAddress, provider).allowance(
              walletAccount,
              routerAddress
            );

        const [allowanceA, allowanceB] = await Promise.all([
          allowanceAPromise,
          allowanceBPromise
        ]);

        if (!cancelled) {
          setNeedsApprovalA(
            liquidityTokenAIsNative ? false : toBigInt(allowanceA) < desiredA
          );
          setNeedsApprovalB(
            liquidityTokenBIsNative ? false : toBigInt(allowanceB) < desiredB
          );
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
    liquidityMode,
    walletAccount,
    routerAddress,
    readProvider,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    debouncedAmountA,
    debouncedAmountB,
    liquidityTokenA?.decimals,
    liquidityTokenB?.decimals,
    liquidityAllowanceNonce,
    liquidityTokenAIsNative,
    liquidityTokenBIsNative
  ]);

  useEffect(() => {
    let active = true;
    const calculateRemovalAmounts = async () => {
      if (
        liquidityMode !== "remove" ||
        !walletAccount ||
        !liquidityPairReserves ||
        !liquidityPairReserves.pairAddress ||
        !liquidityTokenA ||
        !liquidityTokenB
      ) {
        if (active) {
          setExpectedRemoveAmounts(null);
          setUserPooledAmounts(null);
          setLpTokenInfo(null);
        }
        return;
      }

      try {
        const lpTokenContract = getToken(
          liquidityPairReserves.pairAddress,
          readProvider
        );
        const [userBalance, totalSupply] = await Promise.all([
          lpTokenContract.balanceOf(walletAccount),
          lpTokenContract.totalSupply()
        ]);

        const userBalanceBigInt = toBigInt(userBalance);
        const percentBigInt = clampPercentToBigInt(removeLiquidityPercent);
        const liquidityToRemove =
          percentBigInt === 100n
            ? userBalanceBigInt
            : (userBalanceBigInt * percentBigInt) / 100n;

        const lpBalanceFormatted = formatUnits(userBalance, 18);

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

        const { amountAWei: pooledAWei, amountBWei: pooledBWei } =
          getLiquidityRemoveAmounts(
            userBalanceBigInt,
            liquidityPairReserves.reserveAWei,
            liquidityPairReserves.reserveBWei,
            totalSupply
          );

        const { amountAWei: expectedAWei, amountBWei: expectedBWei } =
          getLiquidityRemoveAmounts(
            liquidityToRemove,
            liquidityPairReserves.reserveAWei,
            liquidityPairReserves.reserveBWei,
            totalSupply
          );

        if (active) {
          setLpTokenInfo({
            balance: lpBalanceFormatted,
            poolShare: poolSharePercent.toString()
          });

          const pooledAFormatted = formatUnits(
            pooledAWei,
            liquidityTokenA.decimals ?? 18
          );
          const pooledBFormatted = formatUnits(
            pooledBWei,
            liquidityTokenB.decimals ?? 18
          );
          setUserPooledAmounts({
            amountA: formatNumber(
              pooledAFormatted,
              Math.min(6, liquidityTokenA.decimals ?? 18)
            ),
            amountB: formatNumber(
              pooledBFormatted,
              Math.min(6, liquidityTokenB.decimals ?? 18)
            )
          });

          const expectedAFormatted = formatUnits(
            expectedAWei,
            liquidityTokenA.decimals ?? 18
          );
          const expectedBFormatted = formatUnits(
            expectedBWei,
            liquidityTokenB.decimals ?? 18
          );
          setExpectedRemoveAmounts({
            amountA: formatNumber(
              expectedAFormatted,
              Math.min(6, liquidityTokenA.decimals ?? 18)
            ),
            amountB: formatNumber(
              expectedBFormatted,
              Math.min(6, liquidityTokenB.decimals ?? 18)
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
    liquidityTokenA?.decimals,
    liquidityTokenB?.decimals,
    liquidityTokenA,
    liquidityTokenB,
    readProvider
  ]);

  const liquidityTokensReady =
    isAddress(liquidityTokenAAddress) &&
    isAddress(liquidityTokenBAddress) &&
    liquidityTokenAAddress.toLowerCase() !==
      liquidityTokenBAddress.toLowerCase();

  const liquidityAmountsReady =
    !!liquidityForm.amountA && !!liquidityForm.amountB;

  const applyLiquidityAmountA = useCallback(
    (value: string, exactValue?: string | null) => {
      liquidityEditingFieldRef.current = "A";

      setLiquidityForm((prev) => {
        if (liquidityEditingFieldRef.current !== "A") {
          return prev;
        }

        const updated: LiquidityFormState = {
          ...prev,
          amountA: value,
          amountAExact: exactValue ?? null
        };

        if (!value || value.trim() === "") {
          updated.amountB = "";
          updated.amountBExact = null;
          liquidityEditingFieldRef.current = null;
          return updated;
        }

        const parseSource = (exactValue ?? value).trim();
        if (!parseSource) {
          return updated;
        }

        if (liquidityPairReserves && liquidityTokenA && liquidityTokenB) {
          try {
            const decimalsA = liquidityTokenA.decimals ?? DEFAULT_TOKEN_DECIMALS;
            const decimalsB = liquidityTokenB.decimals ?? DEFAULT_TOKEN_DECIMALS;
            const amountAWei = parseUnits(parseSource, decimalsA);
            if (amountAWei <= 0n) {
              updated.amountB = "";
              updated.amountBExact = null;
              return updated;
            }

            if (liquidityPairReserves.reserveAWei > 0n) {
              const amountBWei =
                (amountAWei * liquidityPairReserves.reserveBWei) /
                liquidityPairReserves.reserveAWei;
              const amountBRaw = formatUnits(amountBWei, decimalsB);
              updated.amountB = formatNumber(
                amountBRaw,
                Math.min(6, decimalsB)
              );
              updated.amountBExact = amountBRaw;
            }
          } catch (err) {
            console.warn("[liquidity] amountA calculation failed", err);
            updated.amountB = "";
            updated.amountBExact = null;
          }
        }

        return updated;
      });
    },
    [liquidityPairReserves, liquidityTokenA, liquidityTokenB]
  );

  const applyLiquidityAmountB = useCallback(
    (value: string, exactValue?: string | null) => {
      liquidityEditingFieldRef.current = "B";

      setLiquidityForm((prev) => {
        if (liquidityEditingFieldRef.current !== "B") {
          return prev;
        }

        const updated: LiquidityFormState = {
          ...prev,
          amountB: value,
          amountBExact: exactValue ?? null
        };

        if (!value || value.trim() === "") {
          updated.amountA = "";
          updated.amountAExact = null;
          liquidityEditingFieldRef.current = null;
          return updated;
        }

        const parseSource = (exactValue ?? value).trim();
        if (!parseSource) {
          return updated;
        }

        if (liquidityPairReserves && liquidityTokenA && liquidityTokenB) {
          try {
            const decimalsA = liquidityTokenA.decimals ?? DEFAULT_TOKEN_DECIMALS;
            const decimalsB = liquidityTokenB.decimals ?? DEFAULT_TOKEN_DECIMALS;
            const amountBWei = parseUnits(parseSource, decimalsB);
            if (amountBWei <= 0n) {
              updated.amountA = "";
              updated.amountAExact = null;
              return updated;
            }

            if (liquidityPairReserves.reserveBWei > 0n) {
              const amountAWei =
                (amountBWei * liquidityPairReserves.reserveAWei) /
                liquidityPairReserves.reserveBWei;
              const amountARaw = formatUnits(amountAWei, decimalsA);
              updated.amountA = formatNumber(
                amountARaw,
                Math.min(6, decimalsA)
              );
              updated.amountAExact = amountARaw;
            }
          } catch (err) {
            console.warn("[liquidity] amountB calculation failed", err);
            updated.amountA = "";
            updated.amountAExact = null;
          }
        }

        return updated;
      });
    },
    [liquidityPairReserves, liquidityTokenA, liquidityTokenB]
  );

  const handleLiquidityAmountAChange = useCallback(
    (value: string) => {
      applyLiquidityAmountA(value);
    },
    [applyLiquidityAmountA]
  );

  const handleLiquidityAmountBChange = useCallback(
    (value: string) => {
      applyLiquidityAmountB(value);
    },
    [applyLiquidityAmountB]
  );

  const handleSetMaxLiquidityAmountA = useCallback(() => {
    if (!tokenABalanceFormatted) return;
    const displayValue = formatBalanceDisplay(tokenABalanceFormatted);
    applyLiquidityAmountA(displayValue, tokenABalanceFormatted);
  }, [tokenABalanceFormatted, applyLiquidityAmountA]);

  const handleSetMaxLiquidityAmountB = useCallback(() => {
    if (!tokenBBalanceFormatted) return;
    const displayValue = formatBalanceDisplay(tokenBBalanceFormatted);
    applyLiquidityAmountB(displayValue, tokenBBalanceFormatted);
  }, [tokenBBalanceFormatted, applyLiquidityAmountB]);

  const handleAddLiquidity = useCallback(async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    if (!liquidityTokenA || !liquidityTokenB) {
      showError("Select tokens to provide liquidity.");
      return;
    }
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
    const amountAInput = liquidityForm.amountAExact ?? amountA;
    const amountBInput = liquidityForm.amountBExact ?? amountB;
    if (!amountAInput || !amountBInput) {
      showError("Provide both token amounts for liquidity.");
      return;
    }
    if (liquidityTokenAIsNative && liquidityTokenBIsNative) {
      showError("Native ETH must be paired with an ERC-20 token.");
      return;
    }

    try {
      let submittedTxHash: `0x${string}` | null = null;
      setIsSubmitting(true);

      const decimalsA = liquidityTokenA.decimals ?? DEFAULT_TOKEN_DECIMALS;
      const decimalsB = liquidityTokenB.decimals ?? DEFAULT_TOKEN_DECIMALS;

      const amountAWei = parseUnits(amountAInput, decimalsA);
      const amountBWei = parseUnits(amountBInput, decimalsB);

      if (amountAWei <= 0n || amountBWei <= 0n) {
        showError("Enter valid liquidity amounts.");
        setIsSubmitting(false);
        return;
      }

      const deadline = BigInt(nowPlusMinutes(10));

      if (liquidityTokenAIsNative || liquidityTokenBIsNative) {
        if (!wrappedNativeAddress || !isAddress(wrappedNativeAddress)) {
          showError("Wrapped native address unavailable.");
          setIsSubmitting(false);
          return;
        }

        const nativeAmountWei = liquidityTokenAIsNative ? amountAWei : amountBWei;
        const ercAmountWei = liquidityTokenAIsNative ? amountBWei : amountAWei;
        const ercTokenAddress = liquidityTokenAIsNative ? tokenB : tokenA;
        const ercTokenSymbol = liquidityTokenAIsNative
          ? liquidityTokenB.symbol
          : liquidityTokenA.symbol;

        const allowance = await readContract(wagmiConfig, {
          address: ercTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
          chainId: Number(MEGAETH_CHAIN_ID)
        });

        if (toBigInt(allowance) < ercAmountWei) {
          showLoading("Confirm transaction in your wallet...");
          const approveHash = await writeContract(wagmiConfig, {
            address: ercTokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [routerAddress as `0x${string}`, MaxUint256],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 100000n
          });
          showLoading(`${ercTokenSymbol || "Token"} approval pending...`);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
          if (liquidityTokenAIsNative) {
            setNeedsApprovalB(false);
          } else {
            setNeedsApprovalA(false);
          }
        }

        showLoading("Confirm transaction in your wallet...");
        const txHash = await writeContract(wagmiConfig, {
          address: routerAddress as `0x${string}`,
          abi: warpRouterAbi,
          functionName: "addLiquidityETH",
          args: [
            ercTokenAddress as `0x${string}`,
            ercAmountWei,
            0n,
            0n,
            ctx.account as `0x${string}`,
            deadline
          ],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 5000000n,
          value: nativeAmountWei
        });
        showLoading("Adding liquidity...");
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
        submittedTxHash = txHash;
      } else {
        const [allowanceA, allowanceB] = await Promise.all([
          readContract(wagmiConfig, {
            address: tokenA as `0x${string}`,
            abi: erc20Abi,
            functionName: "allowance",
            args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
            chainId: Number(MEGAETH_CHAIN_ID)
          }),
          readContract(wagmiConfig, {
            address: tokenB as `0x${string}`,
            abi: erc20Abi,
            functionName: "allowance",
            args: [ctx.account as `0x${string}`, routerAddress as `0x${string}`],
            chainId: Number(MEGAETH_CHAIN_ID)
          })
        ]);

        if (toBigInt(allowanceA) < amountAWei) {
          showLoading("Confirm transaction in your wallet...");
          const approveAHash = await writeContract(wagmiConfig, {
            address: tokenA as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [routerAddress as `0x${string}`, MaxUint256],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 100000n
          });
          showLoading(`${liquidityTokenA.symbol || "Token A"} approval pending...`);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveAHash });
          setNeedsApprovalA(false);
        }

        if (toBigInt(allowanceB) < amountBWei) {
          showLoading("Confirm transaction in your wallet...");
          const approveBHash = await writeContract(wagmiConfig, {
            address: tokenB as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [routerAddress as `0x${string}`, MaxUint256],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 100000n
          });
          showLoading(`${liquidityTokenB.symbol || "Token B"} approval pending...`);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveBHash });
          setNeedsApprovalB(false);
        }

        showLoading("Confirm transaction in your wallet...");
        const txHash = await writeContract(wagmiConfig, {
          address: routerAddress as `0x${string}`,
          abi: warpRouterAbi,
          functionName: "addLiquidity",
          args: [
            tokenA as `0x${string}`,
            tokenB as `0x${string}`,
            amountAWei,
            amountBWei,
            0n,
            0n,
            ctx.account as `0x${string}`,
            deadline
          ],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 5000000n
        });
        showLoading("Adding liquidity...");
        await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
        submittedTxHash = txHash;
      }

      await refreshBalances();
      setLiquidityForm(LIQUIDITY_DEFAULT);
      liquidityEditingFieldRef.current = null;
      setShowLiquidityConfirm(false);
      setExpectedRemoveAmounts(null);
      setUserPooledAmounts(null);
      setLpTokenInfo(null);
      setLiquidityPairReserves(null);
      setLiquidityReservesRefreshNonce((n) => n + 1);
      onSwapRefresh();
      setNeedsApprovalA(false);
      setNeedsApprovalB(false);
      setLiquidityAllowanceNonce((n) => n + 1);
      showSuccess(
        "Liquidity added successfully.",
        submittedTxHash
          ? { link: { href: buildExplorerTxUrl(submittedTxHash), label: "View on explorer" } }
          : undefined
      );
    } catch (err) {
      console.error("[liquidity] add failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    liquidityTokenA,
    liquidityTokenB,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    liquidityTokenAIsNative,
    liquidityTokenBIsNative,
    liquidityForm,
    showError,
    showLoading,
    showSuccess,
    refreshBalances,
    routerAddress,
    onSwapRefresh,
    wrappedNativeAddress
  ]);

  const handleConfirmAddLiquidity = useCallback(() => {
    setShowLiquidityConfirm(false);
    handleAddLiquidity();
  }, [handleAddLiquidity]);

  const handleRemoveLiquidity = useCallback(async () => {
    const ctx = ensureWallet();
    if (!ctx) return;

    if (!liquidityPairReserves?.pairAddress) {
      showError("Please select a valid liquidity pair.");
      return;
    }

    const percentBigInt = clampPercentToBigInt(removeLiquidityPercent);
    if (percentBigInt <= 0n || percentBigInt > 100n) {
      showError("Please enter a valid percentage (1-100).");
      return;
    }

    try {
      setIsSubmitting(true);

      const pairAddress = liquidityPairReserves.pairAddress;
      const tokenA = liquidityTokenAAddress;
      const tokenB = liquidityTokenBAddress;

      const userBalance = await readContract(wagmiConfig, {
        address: pairAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [ctx.account as `0x${string}`],
        chainId: Number(MEGAETH_CHAIN_ID)
      });

      if (toBigInt(userBalance) === 0n) {
        showError("You do not have any liquidity to remove for this pair.");
        setIsSubmitting(false);
        return;
      }

      const userBalanceBigInt = toBigInt(userBalance);
      const liquidityToRemove =
        percentBigInt === 100n
          ? userBalanceBigInt
          : (userBalanceBigInt * percentBigInt) / 100n;

      if (liquidityToRemove === 0n) {
        showError("Amount to remove is too small.");
        setIsSubmitting(false);
        return;
      }

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
          args: [routerAddress as `0x${string}`, MaxUint256],
          account: ctx.account as `0x${string}`,
          chainId: Number(MEGAETH_CHAIN_ID),
          gas: 100000n
        });
        showLoading("Approval pending...");
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      showLoading("Confirm transaction in your wallet...");
      const deadline = BigInt(nowPlusMinutes(10));

      const txRequest = liquidityTokenAIsNative || liquidityTokenBIsNative
        ? {
            address: routerAddress as `0x${string}`,
            abi: warpRouterAbi,
            functionName: "removeLiquidityETH",
            args: [
              (liquidityTokenAIsNative ? tokenB : tokenA) as `0x${string}`,
              liquidityToRemove,
              0n,
              0n,
              ctx.account as `0x${string}`,
              deadline
            ],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 500000n
          }
        : {
            address: routerAddress as `0x${string}`,
            abi: warpRouterAbi,
            functionName: "removeLiquidity",
            args: [
              tokenA as `0x${string}`,
              tokenB as `0x${string}`,
              liquidityToRemove,
              0n,
              0n,
              ctx.account as `0x${string}`,
              deadline
            ],
            account: ctx.account as `0x${string}`,
            chainId: Number(MEGAETH_CHAIN_ID),
            gas: 500000n
          };

      const txHash = await writeContract(
        wagmiConfig,
        txRequest as Parameters<typeof writeContract>[1]
      );

      showLoading("Removing liquidity...");
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash });
      await refreshBalances();
      setLiquidityPairReserves(null);
      setLiquidityReservesRefreshNonce((n) => n + 1);
      setExpectedRemoveAmounts(null);
      setUserPooledAmounts(null);
      setLpTokenInfo(null);
      setLiquidityForm(LIQUIDITY_DEFAULT);
      liquidityEditingFieldRef.current = null;
      setNeedsApprovalA(false);
      setNeedsApprovalB(false);
      setLiquidityAllowanceNonce((n) => n + 1);
      onSwapRefresh();
      showSuccess("Liquidity removed successfully.", {
        link: { href: buildExplorerTxUrl(txHash), label: "View on explorer" }
      });
      setRemoveLiquidityPercent("25");
    } catch (err) {
      console.error("[liquidity] remove failed", err);
      showError(parseErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    ensureWallet,
    liquidityPairReserves,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    liquidityTokenAIsNative,
    liquidityTokenBIsNative,
    refreshBalances,
    removeLiquidityPercent,
    routerAddress,
    showError,
    showLoading,
    showSuccess,
    onSwapRefresh
  ]);

  const handleLiquidityPrimary = useCallback(() => {
    if (liquidityMode === "add" && liquidityTokensReady && liquidityAmountsReady) {
      setShowLiquidityConfirm(true);
    } else if (liquidityMode === "remove") {
      handleRemoveLiquidity();
    }
  }, [handleRemoveLiquidity, liquidityMode, liquidityAmountsReady, liquidityTokensReady]);

  const liquidityButtonLabel = useMemo(() => {
    if (!hasMounted) {
      return "Connect Wallet";
    }
    if (!isWalletConnected) {
      return isAccountConnecting ? "Connecting..." : "Connect Wallet";
    }
    if (!chainId || chainId !== Number(MEGAETH_CHAIN_ID)) {
      return "Wrong Network";
    }
    if (!liquidityTokensReady) {
      return "Select Tokens";
    }
    if (liquidityMode === "add" && !liquidityAmountsReady) {
      return "Enter Amounts";
    }
    if (liquidityMode === "add" && liquidityAmountsReady) {
      if (insufficientLiquidityA && insufficientLiquidityB) {
        return "Insufficient token balances";
      }
      if (insufficientLiquidityA) {
        return `Insufficient ${liquidityTokenA?.symbol ?? "token A"} balance`;
      }
      if (insufficientLiquidityB) {
        return `Insufficient ${liquidityTokenB?.symbol ?? "token B"} balance`;
      }
    }
    if (checkingLiquidityAllowances) {
      return "Checking...";
    }
    if (liquidityMode === "add" && needsApprovalA) {
      return `Approve ${liquidityTokenA?.symbol ?? "Token A"}`;
    }
    if (liquidityMode === "add" && needsApprovalB) {
      return `Approve ${liquidityTokenB?.symbol ?? "Token B"}`;
    }
    if (liquidityMode === "add") {
      return isSubmitting ? "Supplying..." : "Add Liquidity";
    }
    return isSubmitting ? "Removing..." : "Remove Liquidity";
  }, [
    hasMounted,
    isWalletConnected,
    isAccountConnecting,
    chainId,
    liquidityTokensReady,
    liquidityMode,
    liquidityAmountsReady,
    checkingLiquidityAllowances,
    insufficientLiquidityA,
    insufficientLiquidityB,
    needsApprovalA,
    needsApprovalB,
    liquidityTokenA?.symbol,
    liquidityTokenB?.symbol,
    isSubmitting
  ]);

  const liquidityButtonDisabled = useMemo(() => {
    if (!hasMounted) return false;
    if (!isWalletConnected) return isAccountConnecting;
    if (!chainId || chainId !== Number(MEGAETH_CHAIN_ID)) return true;
    if (!liquidityTokensReady) return true;
    if (liquidityMode === "add" && !liquidityAmountsReady) return true;
    if (liquidityMode === "add" && liquidityAmountsReady) {
      if (insufficientLiquidityA || insufficientLiquidityB) return true;
    }
    if (checkingLiquidityAllowances) return true;
    if (liquidityMode === "add" && (needsApprovalA || needsApprovalB)) {
      return isSubmitting;
    }
    if (liquidityMode === "remove") {
      const userLpBalance =
        liquidityPairReserves && liquidityPairReserves.pairAddress && walletAccount
          ? lpTokenInfo?.balance
          : null;
      const parsedBalance =
        typeof userLpBalance === "string" ? parseFloat(userLpBalance) : NaN;
      if (
        !walletAccount ||
        !liquidityPairReserves?.pairAddress ||
        !lpTokenInfo ||
        Number.isNaN(parsedBalance) ||
        parsedBalance <= 0
      ) {
        return true;
      }
    }
    return isSubmitting;
  }, [
    hasMounted,
    isWalletConnected,
    isAccountConnecting,
    chainId,
    liquidityTokensReady,
    liquidityMode,
    liquidityAmountsReady,
    checkingLiquidityAllowances,
    insufficientLiquidityA,
    insufficientLiquidityB,
    needsApprovalA,
    needsApprovalB,
    isSubmitting,
    lpTokenInfo,
    liquidityPairReserves,
    walletAccount
  ]);

  const handleApproveToken = useCallback(
    async (tokenAddress: string, amount: string) => {
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

        if (
          liquidityTokenA &&
          tokenAddress.toLowerCase() === liquidityTokenA.address.toLowerCase()
        ) {
          setNeedsApprovalA(false);
        }
        if (
          liquidityTokenB &&
          tokenAddress.toLowerCase() === liquidityTokenB.address.toLowerCase()
        ) {
          setNeedsApprovalB(false);
        }
        setLiquidityAllowanceNonce((n) => n + 1);
        showSuccess("Token approved successfully.", {
          link: { href: buildExplorerTxUrl(txHash), label: "View on explorer" }
        });
      } catch (err) {
        console.error("[liquidity] approval failed", err);
        showError(parseErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      ensureWallet,
      liquidityTokenA,
      liquidityTokenB,
      routerAddress,
      showError,
      showLoading,
      showSuccess
    ]
  );

  const handleLiquidityAction = useCallback(() => {
    // Handle wallet connection
    if (!isWalletConnected && onConnect) {
      onConnect();
      return;
    }

    if (liquidityMode === "add") {
      if (needsApprovalA) {
        const approvalAmountA =
          liquidityForm.amountAExact && liquidityForm.amountAExact.length > 0
            ? liquidityForm.amountAExact
            : liquidityForm.amountA || "0";
        handleApproveToken(liquidityTokenAAddress, approvalAmountA);
      } else if (needsApprovalB) {
        const approvalAmountB =
          liquidityForm.amountBExact && liquidityForm.amountBExact.length > 0
            ? liquidityForm.amountBExact
            : liquidityForm.amountB || "0";
        handleApproveToken(liquidityTokenBAddress, approvalAmountB);
      } else {
        handleLiquidityPrimary();
      }
      return;
    }
    handleRemoveLiquidity();
  }, [
    isWalletConnected,
    onConnect,
    handleApproveToken,
    handleLiquidityPrimary,
    handleRemoveLiquidity,
    liquidityForm.amountA,
    liquidityForm.amountB,
    liquidityForm.amountAExact,
    liquidityForm.amountBExact,
    liquidityMode,
    liquidityTokenAAddress,
    liquidityTokenBAddress,
    needsApprovalA,
    needsApprovalB
  ]);

  return (
    <>
      <LiquiditySection
        mode={liquidityMode}
        onModeChange={setLiquidityMode}
        addProps={{
          liquidityTokenA,
          liquidityTokenB,
          liquidityForm,
          onAmountAChange: handleLiquidityAmountAChange,
          onAmountBChange: handleLiquidityAmountBChange,
          onOpenTokenDialog: handleOpenTokenDialog,
          formatBalance: formatBalanceDisplay,
          tokenABalanceFormatted,
          tokenBBalanceFormatted,
          tokenASymbol,
          tokenBSymbol,
          onSetMaxAmountA: handleSetMaxLiquidityAmountA,
          onSetMaxAmountB: handleSetMaxLiquidityAmountB,
          onPrimary: handleLiquidityAction,
          buttonLabel: liquidityButtonLabel,
          buttonDisabled: liquidityButtonDisabled
        }}
        removeProps={{
          liquidityTokenA,
          liquidityTokenB,
          liquidityPairReserves,
          lpTokenInfo,
          userPooledAmounts,
          expectedRemoveAmounts,
          removeLiquidityPercent,
          onRemoveLiquidityPercentChange: setRemoveLiquidityPercent,
          onOpenTokenDialog: handleOpenTokenDialog,
          onRemoveLiquidity: handleRemoveLiquidity,
          isSubmitting,
          ready
        }}
        tokenSelectionEnabled={allowTokenSelection}
      />

      <LiquidityConfirmDialog
        open={showLiquidityConfirm}
        onClose={() => setShowLiquidityConfirm(false)}
        onConfirm={handleConfirmAddLiquidity}
        isSubmitting={isSubmitting}
        liquidityPairReserves={liquidityPairReserves}
        liquidityForm={liquidityForm}
        liquidityTokenA={liquidityTokenA}
        liquidityTokenB={liquidityTokenB}
      />
    </>
  );
}

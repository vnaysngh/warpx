"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, MaxUint256 } from "ethers";
import type { Address } from "viem";
import {
  readContract,
  waitForTransactionReceipt,
  writeContract
} from "wagmi/actions";
import { erc20Abi } from "@/lib/abis/erc20";
import { pairAbi } from "@/lib/abis/pair";
import { warpStakingRewardsAbi } from "@/lib/abis/staking";
import { wagmiConfig } from "@/lib/wagmi";
import {
  DEFAULT_TOKEN_DECIMALS,
  MEGAETH_CHAIN_ID,
  MEGAETH_EXPLORER_BASE_URL
} from "@/lib/trade/constants";
import { buildExplorerTxUrl } from "@/lib/trade/format";
import { parseErrorMessage } from "@/lib/trade/errors";
import { formatAmount, shortAddress } from "@/lib/utils/format";
import { isValidNumericInput, normalizeNumericInput } from "@/lib/utils/input";
import type { StakingProgram } from "@/lib/config/staking";
import type { ToastOptions } from "@/hooks/useToasts";
import pageStyles from "@/app/page.module.css";
import styles from "./StakingCard.module.css";

type TokenMeta = {
  symbol: string;
  name: string;
  decimals: number;
};

type TokenMap = Record<string, TokenMeta>;

type StakingCardProps = {
  program: StakingProgram;
  tokenMap: TokenMap;
  walletAccount: string | null;
  ready: boolean;
  onConnectWallet: () => void;
  showError: (message: string, options?: ToastOptions) => void;
  showSuccess: (message: string, options?: ToastOptions) => void;
  showLoading: (message: string, options?: ToastOptions) => string;
};

const chainId = Number(MEGAETH_CHAIN_ID);
const STAKING_GAS_LIMIT = 1_500_000n;
const MIN_DISPLAY_PRECISION = 4;

export function StakingCard({
  program,
  tokenMap,
  walletAccount,
  ready,
  onConnectWallet,
  showError,
  showSuccess,
  showLoading
}: StakingCardProps) {
  const stakingMeta = useMemo(() => {
    const entry = tokenMap[program.stakingToken.toLowerCase()];
    return (
      entry ?? {
        symbol: "LP",
        name: "WarpX LP",
        decimals: DEFAULT_TOKEN_DECIMALS
      }
    );
  }, [program.stakingToken, tokenMap]);

  const rewardsMeta = useMemo(() => {
    const entry = tokenMap[program.rewardsToken.toLowerCase()];
    return (
      entry ?? {
        symbol: "WARPX",
        name: "WarpX",
        decimals: DEFAULT_TOKEN_DECIMALS
      }
    );
  }, [program.rewardsToken, tokenMap]);

  const [stakeInput, setStakeInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [totalStaked, setTotalStaked] = useState<bigint | null>(null);
  const [userStaked, setUserStaked] = useState<bigint | null>(null);
  const [pendingRewards, setPendingRewards] = useState<bigint | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [periodFinish, setPeriodFinish] = useState<bigint | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loadingLpBalance, setLoadingLpBalance] = useState(false);
  const [loadingUserStake, setLoadingUserStake] = useState(false);
  const [loadingPendingRewards, setLoadingPendingRewards] = useState(false);
  const [loadingTotalStaked, setLoadingTotalStaked] = useState(false);
  const [pairTokens, setPairTokens] = useState<{
    token0: string;
    token1: string;
  } | null>(null);
  const [loadingPairTokens, setLoadingPairTokens] = useState(false);

  const stakingAddress = program.contract as Address;
  const stakingTokenAddress = program.stakingToken as Address;

  const formatTokenAmount = useCallback(
    (
      value: bigint | null,
      meta: TokenMeta,
      precision = MIN_DISPLAY_PRECISION
    ) => {
      if (value === null) return "—";
      return `${formatAmount(value, meta.decimals, precision)} ${meta.symbol}`;
    },
    []
  );

  const parseAmount = useCallback(
    (value: string, decimals: number): bigint | null => {
      if (!value || value === "." || value === "-") return null;
      try {
        return parseUnits(value, decimals);
      } catch {
        return null;
      }
    },
    []
  );

  const renderStatValue = (
    value: bigint | null,
    meta: TokenMeta,
    loading: boolean
  ) => {
    if (loading) {
      return <span className={styles.loader}>Loading…</span>;
    }
    return formatTokenAmount(value, meta);
  };

  const refreshStats = useCallback(() => {
    setRefreshNonce((nonce) => nonce + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setErrorMessage(null);
      try {
        if (walletAccount) {
          const account = walletAccount as Address;

          setLoadingLpBalance(true);
          const balance = (await readContract(wagmiConfig, {
            address: stakingTokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
            chainId
          })) as bigint;
          if (!cancelled) {
            setWalletBalance(balance);
            setLoadingLpBalance(false);
          }

          setLoadingUserStake(true);
          const staked = (await readContract(wagmiConfig, {
            address: stakingAddress,
            abi: warpStakingRewardsAbi,
            functionName: "balanceOf",
            args: [account],
            chainId
          })) as bigint;
          if (!cancelled) {
            setUserStaked(staked);
            setLoadingUserStake(false);
          }

          setLoadingPendingRewards(true);
          const earned = (await readContract(wagmiConfig, {
            address: stakingAddress,
            abi: warpStakingRewardsAbi,
            functionName: "earned",
            args: [account],
            chainId
          })) as bigint;
          if (!cancelled) {
            setPendingRewards(earned);
            setLoadingPendingRewards(false);
          }
        } else {
          setWalletBalance(null);
          setUserStaked(null);
          setPendingRewards(null);
          setLoadingLpBalance(false);
          setLoadingUserStake(false);
          setLoadingPendingRewards(false);
        }

        setLoadingTotalStaked(true);
        const [total, finish] = await Promise.all([
          readContract(wagmiConfig, {
            address: stakingAddress,
            abi: warpStakingRewardsAbi,
            functionName: "totalSupply",
            chainId
          }) as Promise<bigint>,
          readContract(wagmiConfig, {
            address: stakingAddress,
            abi: warpStakingRewardsAbi,
            functionName: "periodFinish",
            chainId
          }) as Promise<bigint>
        ]);
        if (!cancelled) {
          setTotalStaked(total);
          setPeriodFinish(finish);
          setLoadingTotalStaked(false);
        }
      } catch (error) {
        console.error("[staking] failed to load stats", error);
        if (!cancelled) {
          setErrorMessage("Unable to load staking stats. Try again shortly.");
        }
      } finally {
        if (!cancelled) {
          setLoadingLpBalance(false);
          setLoadingUserStake(false);
          setLoadingPendingRewards(false);
          setLoadingTotalStaked(false);
        }
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [stakingAddress, stakingTokenAddress, walletAccount, refreshNonce]);

  const ensureWallet = useCallback(() => {
    if (!walletAccount) {
      showError("Connect your wallet to continue.");
      onConnectWallet();
      return null;
    }
    if (!ready) {
      showError("Switch to the MegaETH Testnet to interact with staking.");
      return null;
    }
    return walletAccount as Address;
  }, [walletAccount, ready, onConnectWallet, showError]);

  const handleStakeAmountChange = (value: string) => {
    if (!isValidNumericInput(value)) return;
    setStakeInput(normalizeNumericInput(value));
  };

  const handleWithdrawAmountChange = (value: string) => {
    if (!isValidNumericInput(value)) return;
    setWithdrawInput(normalizeNumericInput(value));
  };

  const handleMaxStake = () => {
    if (!walletBalance) return;
    const formatted = formatUnits(walletBalance, stakingMeta.decimals);
    setStakeInput(formatted);
  };

  const handleMaxWithdraw = () => {
    if (!userStaked) return;
    const formatted = formatUnits(userStaked, stakingMeta.decimals);
    setWithdrawInput(formatted);
  };

  const submitStake = async () => {
    const account = ensureWallet();
    if (!account) return;
    if (stakeAmountParsed === null || stakeAmountParsed <= 0n) {
      showError("Enter an amount to stake.");
      return;
    }

    try {
      setActionPending(true);
      const amount = stakeAmountParsed;
      if (walletBalance !== null && walletBalance < amount) {
        showError("Insufficient LP balance.");
        return;
      }

      const allowance = (await readContract(wagmiConfig, {
        address: stakingTokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, stakingAddress],
        chainId
      })) as bigint;

      if (allowance < amount) {
        const approvingId = showLoading("Approving staking contract...");
        const approveHash = await writeContract(wagmiConfig, {
          address: stakingTokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [stakingAddress, MaxUint256],
          account,
          chainId
        });
        await waitForTransactionReceipt(wagmiConfig, {
          hash: approveHash,
          chainId
        });
        showSuccess("Approval confirmed", {
          link: { href: buildExplorerTxUrl(approveHash), label: "View tx" }
        });
      }

      const loadingId = showLoading("Submitting stake...");
      const stakeHash = await writeContract(wagmiConfig, {
        address: stakingAddress,
        abi: warpStakingRewardsAbi,
        functionName: "stake",
        args: [amount],
        account,
        chainId,
        gas: STAKING_GAS_LIMIT
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: stakeHash,
        chainId
      });
      showSuccess("Stake confirmed", {
        link: { href: buildExplorerTxUrl(stakeHash), label: "View tx" }
      });
      setStakeInput("");
      refreshStats();
    } catch (error: any) {
      console.error("[staking] stake failed", error);
      showError(parseErrorMessage(error));
    } finally {
      setActionPending(false);
    }
  };

  const submitWithdraw = async () => {
    const account = ensureWallet();
    if (!account) return;
    if (withdrawAmountParsed === null || withdrawAmountParsed <= 0n) {
      showError("Enter an amount to withdraw.");
      return;
    }

    try {
      setActionPending(true);
      const amount = withdrawAmountParsed;

      const loadingId = showLoading("Submitting withdrawal...");
      const withdrawHash = await writeContract(wagmiConfig, {
        address: stakingAddress,
        abi: warpStakingRewardsAbi,
        functionName: "withdraw",
        args: [amount],
        account,
        chainId,
        gas: STAKING_GAS_LIMIT
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: withdrawHash,
        chainId
      });
      showSuccess("Withdrawal confirmed", {
        link: { href: buildExplorerTxUrl(withdrawHash), label: "View tx" }
      });
      setWithdrawInput("");
      refreshStats();
    } catch (error: any) {
      console.error("[staking] withdraw failed", error);
      showError(parseErrorMessage(error));
    } finally {
      setActionPending(false);
    }
  };

  const claimRewards = async () => {
    const account = ensureWallet();
    if (!account) return;

    try {
      setActionPending(true);
      const loadingId = showLoading("Claiming rewards...");
      const claimHash = await writeContract(wagmiConfig, {
        address: stakingAddress,
        abi: warpStakingRewardsAbi,
        functionName: "getReward",
        args: [],
        account,
        chainId,
        gas: STAKING_GAS_LIMIT
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: claimHash,
        chainId
      });
      showSuccess("Rewards claimed", {
        link: { href: buildExplorerTxUrl(claimHash), label: "View tx" }
      });
      refreshStats();
    } catch (error: any) {
      console.error("[staking] claim failed", error);
      showError(parseErrorMessage(error));
    } finally {
      setActionPending(false);
    }
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const remainingSeconds = periodFinish
    ? Math.max(0, Number(periodFinish) - nowSeconds)
    : 0;
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  /* const emissionsLabel = remainingSeconds
    ? `${days}d ${hours}h remaining`
    : "Awaiting new rewards"; */

  const explorerUrl = `${MEGAETH_EXPLORER_BASE_URL}/address/${program.contract}`;
  const statsRefreshing =
    loadingLpBalance ||
    loadingUserStake ||
    loadingPendingRewards ||
    loadingTotalStaked;

  const stakeAmountParsed = parseAmount(stakeInput, stakingMeta.decimals);
  const withdrawAmountParsed = parseAmount(withdrawInput, stakingMeta.decimals);

  const hasWallet = Boolean(walletAccount);
  const canStake =
    hasWallet &&
    stakeAmountParsed !== null &&
    stakeAmountParsed > 0n &&
    walletBalance !== null &&
    walletBalance >= stakeAmountParsed &&
    !actionPending &&
    !loadingLpBalance;

  const canWithdraw =
    hasWallet &&
    withdrawAmountParsed !== null &&
    withdrawAmountParsed > 0n &&
    userStaked !== null &&
    userStaked >= withdrawAmountParsed &&
    !actionPending &&
    !loadingUserStake;

  const canClaim =
    hasWallet &&
    pendingRewards !== null &&
    pendingRewards > 0n &&
    userStaked !== null &&
    userStaked > 0n &&
    !actionPending &&
    !loadingPendingRewards;

  useEffect(() => {
    let cancelled = false;
    const loadPairTokens = async () => {
      try {
        setLoadingPairTokens(true);
        const [token0, token1] = await Promise.all([
          readContract(wagmiConfig, {
            address: stakingTokenAddress,
            abi: pairAbi,
            functionName: "token0",
            chainId
          }),
          readContract(wagmiConfig, {
            address: stakingTokenAddress,
            abi: pairAbi,
            functionName: "token1",
            chainId
          })
        ]);
        if (!cancelled) {
          setPairTokens({
            token0: token0 as string,
            token1: token1 as string
          });
        }
      } catch (error) {
        console.warn("[staking] unable to load pair tokens", error);
      } finally {
        if (!cancelled) {
          setLoadingPairTokens(false);
        }
      }
    };
    loadPairTokens();
    return () => {
      cancelled = true;
    };
  }, [stakingTokenAddress]);

  const pairLabel = useMemo(() => {
    if (pairTokens) {
      const token0Meta = tokenMap[pairTokens.token0.toLowerCase()];
      const token1Meta = tokenMap[pairTokens.token1.toLowerCase()];
      if (token0Meta && token1Meta) {
        return `${token0Meta.symbol}/${token1Meta.symbol}`;
      }
    }
    return program.label ?? "LP Staking";
  }, [pairTokens, program.label, tokenMap]);

  return (
    <section className={styles.card} aria-live="polite">
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>LP Staking</span>
            <span className={styles.experimentalBadge}>Experimental</span>
          </div>
          <div className={styles.pairMeta}>
            <h2 className={styles.title}>{pairLabel}</h2>
          </div>
        </div>
        <span className={styles.rewardTag}>
          {rewardsMeta.symbol === "WARPX" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logos/warpx.png"
              alt="WarpX"
              className={styles.rewardLogo}
            />
          )}
          Rewards: {rewardsMeta.symbol}
        </span>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Wallet Balance</div>
          <div className={styles.statValue}>
            {renderStatValue(walletBalance, stakingMeta, loadingLpBalance)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Staked</div>
          <div className={styles.statValue}>
            {renderStatValue(totalStaked, stakingMeta, loadingTotalStaked)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Your Stake</div>
          <div className={styles.statValue}>
            {renderStatValue(userStaked, stakingMeta, loadingUserStake)}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Rewards</div>
          <div className={styles.statValue}>
            {renderStatValue(
              pendingRewards,
              rewardsMeta,
              loadingPendingRewards
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.actionCard}>
          <div className={styles.actionLabel}>Stake</div>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={stakeInput}
              onChange={(event) => handleStakeAmountChange(event.target.value)}
              placeholder={`0.0 ${stakingMeta.symbol}`}
              inputMode="decimal"
              pattern="^[0-9]*[.]?[0-9]*$"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.maxButton}
              onClick={handleMaxStake}
            >
              Max
            </button>
          </div>
          <button
            type="button"
            className={`${pageStyles.primaryButton} ${styles.fullWidth}`}
            onClick={submitStake}
            disabled={!canStake}
          >
            Stake
          </button>
        </div>

        <div className={styles.actionCard}>
          <div className={styles.actionLabel}>Withdraw</div>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={withdrawInput}
              onChange={(event) =>
                handleWithdrawAmountChange(event.target.value)
              }
              placeholder={`0.0 ${stakingMeta.symbol}`}
              inputMode="decimal"
              pattern="^[0-9]*[.]?[0-9]*$"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.maxButton}
              onClick={handleMaxWithdraw}
            >
              Max
            </button>
          </div>
          <button
            type="button"
            className={`${pageStyles.secondaryButton} ${styles.fullWidth}`}
            onClick={submitWithdraw}
            disabled={!canWithdraw}
          >
            Withdraw
          </button>
        </div>
      </div>

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={pageStyles.secondaryButton}
          onClick={claimRewards}
          disabled={!canClaim}
        >
          Claim Rewards
        </button>
        {/* <span className={`${styles.statusText} ${styles.muted}`}>
          {statsRefreshing ? "Refreshing stats…" : emissionsLabel}
        </span> */}
      </div>

      {errorMessage && <div className={styles.errorText}>{errorMessage}</div>}
    </section>
  );
}

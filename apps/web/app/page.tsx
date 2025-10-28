"use client";

import { useEffect, useMemo, useState } from "react";
import { Interface, ZeroAddress, formatUnits, parseUnits } from "ethers";
import styles from "./page.module.css";
import { DeploymentManifest, loadDeployment } from "@/lib/config/deployment";
import { useWallet } from "@/lib/hooks/use-wallet";
import { getFactory, getPair, getRouter, getToken } from "@/lib/contracts";
import { shortAddress } from "@/lib/utils/format";
import { toBigInt } from "@/lib/utils/math";

const MEGAETH_CHAIN_ID = 6342n;
const MEGAETH_CHAIN_HEX = "0x18C6";
const DEFAULT_MEGAETH_RPC =
  process.env.NEXT_PUBLIC_MEGAETH_RPC_URL ?? "https://carrot.megaeth.com/rpc";
const DEFAULT_MEGAETH_EXPLORER = "https://explorer.megaeth.com";

const nowPlusMinutes = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

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

const SWAP_DEFAULT = {
  tokenIn: "",
  tokenOut: "",
  amountIn: "",
  minOut: ""
};

const LIQUIDITY_DEFAULT = {
  tokenA: "",
  tokenB: "",
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

export default function Page() {
  const wallet = useWallet();
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

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [swapQuote, setSwapQuote] = useState<Quote | null>(null);
  const [swapQuoteError, setSwapQuoteError] = useState<string | null>(null);
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
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogSide, setTokenDialogSide] = useState<"in" | "out">("in");
  const [tokenSearch, setTokenSearch] = useState("");
  const [activeView, setActiveView] = useState<"swap" | "liquidity">("swap");
  const [liquidityMode, setLiquidityMode] = useState<"add" | "remove">("add");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [allowanceNonce, setAllowanceNonce] = useState(0);

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

  useEffect(() => {
    setSwapForm(SWAP_DEFAULT);
    setLiquidityForm(LIQUIDITY_DEFAULT);
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
  }, [routerAddress, tokenList]);

  useEffect(() => {
    if (!wallet.account || !wallet.network) {
      setNetworkError(null);
      return;
    }
    if (wallet.network.chainId !== MEGAETH_CHAIN_ID) {
      setNetworkError(
        `Switch to MegaETH Testnet (chain id ${Number(MEGAETH_CHAIN_ID)})`
      );
    } else {
      setNetworkError(null);
    }
  }, [wallet.account, wallet.network]);

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

  const ready = useMemo(() => {
    const onMegaEth =
      wallet.network && wallet.network.chainId === MEGAETH_CHAIN_ID;
    return Boolean(wallet.signer && wallet.provider && deployment && onMegaEth);
  }, [wallet.network, wallet.signer, wallet.provider, deployment]);

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

  const ensureWallet = () => {
    if (!wallet.signer || !wallet.provider) {
      setError("Connect your wallet to continue.");
      return null;
    }
    if (!ready) {
      setError("Switch to the MegaETH Testnet to interact with the contracts.");
      return null;
    }
    return { signer: wallet.signer, provider: wallet.provider };
  };

  const switchToMegaEth = async () => {
    const ethereum = (window as any)?.ethereum;
    if (!ethereum) {
      setError("No injected wallet found to switch networks.");
      return;
    }
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MEGAETH_CHAIN_HEX }]
      });
    } catch (switchError: any) {
      if (
        switchError?.code === 4902 ||
        switchError?.data?.originalError?.code === 4902
      ) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: MEGAETH_CHAIN_HEX,
                chainName: "MegaETH Testnet",
                nativeCurrency: {
                  name: "MegaETH",
                  symbol: "MEGA",
                  decimals: 18
                },
                rpcUrls: [DEFAULT_MEGAETH_RPC],
                blockExplorerUrls: [DEFAULT_MEGAETH_EXPLORER]
              }
            ]
          });
        } catch (addError: any) {
          setError(
            addError?.message || "Failed to add MegaETH network to wallet."
          );
        }
      } else {
        setError(switchError?.message || "Failed to switch network.");
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const computeQuote = async () => {
      setSwapQuote(null);
      setSwapQuoteError(null);

      if (!ready || !wallet.provider || !routerAddress) return;
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) return;
      if (!swapForm.amountIn || Number(swapForm.amountIn) <= 0) return;

      try {
        const routerRead = getRouter(routerAddress, wallet.provider);
        const tokenInContract = getToken(swapForm.tokenIn, wallet.provider);
        const tokenOutContract = getToken(swapForm.tokenOut, wallet.provider);

        const [decimalsIn, decimalsOut, symbolOut] = await Promise.all([
          tokenInContract.decimals(),
          tokenOutContract.decimals(),
          tokenOutContract.symbol()
        ]);

        const amountInWei = parseUnits(swapForm.amountIn, Number(decimalsIn));
        if (amountInWei <= 0n) return;

        const path = [swapForm.tokenIn, swapForm.tokenOut];
        const amounts = await routerRead.getAmountsOut(amountInWei, path);
        const amountOutWei = amounts[amounts.length - 1];
        const formattedOut = formatUnits(amountOutWei, Number(decimalsOut));

        if (!cancelled) {
          setSwapQuote({ amount: formattedOut, symbol: symbolOut });
          if (!swapForm.minOut) {
            setSwapForm((prev) => ({ ...prev, minOut: formattedOut }));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("quote error", err);
          setSwapQuoteError(
            err?.reason || err?.message || "Unable to estimate output."
          );
        }
      }
    };

    computeQuote();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    wallet.provider,
    routerAddress,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.amountIn,
    swapForm.minOut
  ]);

  useEffect(() => {
    let cancelled = false;
    const computeReverseQuote = async () => {
      setReverseQuote(null);
      if (!ready || !wallet.provider || !routerAddress) return;
      if (!isAddress(swapForm.tokenIn) || !isAddress(swapForm.tokenOut)) return;
      if (!swapForm.minOut || Number(swapForm.minOut) <= 0) return;

      try {
        const routerRead = getRouter(routerAddress, wallet.provider);
        const tokenInContract = getToken(swapForm.tokenIn, wallet.provider);
        const tokenOutContract = getToken(swapForm.tokenOut, wallet.provider);

        const [decimalsIn, symbolIn, decimalsOut, symbolOut] =
          await Promise.all([
            tokenInContract.decimals(),
            tokenInContract.symbol(),
            tokenOutContract.decimals(),
            tokenOutContract.symbol()
          ]);

        const desiredOutWei = parseUnits(swapForm.minOut, Number(decimalsOut));
        if (desiredOutWei <= 0n) return;

        const path = [swapForm.tokenIn, swapForm.tokenOut];
        const amounts = await routerRead.getAmountsIn(desiredOutWei, path);
        const amountNeeded = amounts[0];
        const formattedIn = formatUnits(amountNeeded, Number(decimalsIn));

        if (!cancelled) {
          setReverseQuote({ amount: formattedIn, symbolIn, symbolOut });
          if (!swapForm.amountIn) {
            setSwapForm((prev) => ({ ...prev, amountIn: formattedIn }));
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("reverse quote error", err);
        }
      }
    };

    computeReverseQuote();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    wallet.provider,
    routerAddress,
    swapForm.tokenIn,
    swapForm.tokenOut,
    swapForm.minOut,
    swapForm.amountIn
  ]);

  useEffect(() => {
    let active = true;
    const fetchLp = async () => {
      if (!ready || !wallet.provider || !routerAddress) return;
      const { tokenA, tokenB } = removeForm;
      if (!isAddress(tokenA) || !isAddress(tokenB)) {
        if (active) setLpInfo({ pair: null, balance: null, symbol: null });
        return;
      }

      try {
        const factory = getFactory(factoryAddress, wallet.provider);
        const pairAddress = await factory.getPair(tokenA, tokenB);
        if (pairAddress === ZeroAddress) {
          if (active) setLpInfo({ pair: null, balance: null, symbol: null });
          return;
        }
        const lpToken = getToken(pairAddress, wallet.provider);
        const [symbol, balanceWei] = await Promise.all([
          lpToken.symbol().catch(() => "LP"),
          wallet.account
            ? lpToken.balanceOf(wallet.account)
            : Promise.resolve(0n)
        ]);
        const balance = wallet.account ? formatUnits(balanceWei, 18) : "0";
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
    wallet.provider,
    wallet.account,
    routerAddress,
    factoryAddress,
    removeForm.tokenA,
    removeForm.tokenB
  ]);

  useEffect(() => {
    let cancelled = false;
    const evaluateAllowance = async () => {
      if (
        !ready ||
        !wallet.provider ||
        !wallet.account ||
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
        const token = getToken(swapForm.tokenIn, wallet.provider);
        const decimals = Number(await token.decimals());
        const desired = parseUnits(swapForm.amountIn, decimals);
        if (desired <= 0n) {
          if (!cancelled) setNeedsApproval(false);
          return;
        }
        const allowance = await token.allowance(wallet.account, routerAddress);
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
    wallet.provider,
    wallet.account,
    routerAddress,
    swapForm.tokenIn,
    swapForm.amountIn,
    allowanceNonce
  ]);

  const handleApprove = async (
    tokenAddress: string,
    spender: string,
    amount: string
  ) => {
    const ctx = ensureWallet();
    if (!ctx) return;
    if (!isAddress(tokenAddress) || !isAddress(spender)) {
      setError("Provide valid token and spender addresses.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback("Sending approval transaction…");
      const token = getToken(tokenAddress, ctx.signer);
      const decimals = Number(await token.decimals());
      const parsedAmount = parseUnits(
        amount && amount.length ? amount : "1000000",
        decimals
      );
      const tx = await token.approve(spender, parsedAmount);
      await tx.wait();
      const isSwapToken =
        isAddress(swapForm.tokenIn) &&
        tokenAddress.toLowerCase() === swapForm.tokenIn.toLowerCase() &&
        spender.toLowerCase() === routerAddress.toLowerCase();
      setFeedback(
        isSwapToken
          ? "Approval confirmed. Ready to swap."
          : "Approval confirmed."
      );
      if (isSwapToken) {
        setNeedsApproval(false);
        setAllowanceNonce((n) => n + 1);
      }
    } catch (err: any) {
      setError(err?.reason || err?.message || "Approval failed.");
      setFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwap = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenIn, tokenOut, amountIn, minOut } = swapForm;
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      setError("Enter valid ERC-20 token addresses for the swap.");
      return;
    }
    if (!amountIn) {
      setError("Provide an amount to swap.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback("Initiating swap…");

      const { signer, provider } = ctx;
      const router = getRouter(routerAddress, signer);
      const tokenInRead = getToken(tokenIn, provider);
      const tokenOutRead = getToken(tokenOut, provider);
      const [decimalsIn, decimalsOut] = await Promise.all([
        tokenInRead.decimals(),
        tokenOutRead.decimals()
      ]);

      const amountInWei = parseUnits(amountIn, Number(decimalsIn));
      const minOutWei = minOut ? parseUnits(minOut, Number(decimalsOut)) : 0n;

      const owner = await signer.getAddress();
      const allowance = toBigInt(
        await tokenInRead.allowance(owner, routerAddress)
      );
      if (allowance < amountInWei) {
        setError("Approve the input token before swapping.");
        setNeedsApproval(true);
        setFeedback(null);
        return;
      }

      const path = [tokenIn, tokenOut];
      const tx = await router.swapExactTokensForTokens(
        amountInWei,
        minOutWei,
        path,
        owner,
        BigInt(nowPlusMinutes(10))
      );
      await tx.wait();
      setAllowanceNonce((n) => n + 1);
      setNeedsApproval(false);
      setFeedback("Swap executed successfully.");
    } catch (err: any) {
      console.error("swap failed", err);
      setError(err?.reason || err?.message || "Swap failed.");
      setFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLiquidity = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
    const { tokenA, tokenB, amountA, amountB } = liquidityForm;
    if (!isAddress(tokenA) || !isAddress(tokenB)) {
      setError("Enter valid token addresses for liquidity provision.");
      return;
    }
    if (!amountA || !amountB) {
      setError("Provide both token amounts for liquidity.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      setFeedback("Submitting addLiquidity transaction…");

      const { signer, provider } = ctx;
      const router = getRouter(routerAddress, signer);
      const tokenARead = getToken(tokenA, provider);
      const tokenBRead = getToken(tokenB, provider);
      const tokenAWrite = getToken(tokenA, signer);
      const tokenBWrite = getToken(tokenB, signer);

      const [decimalsA, decimalsB] = await Promise.all([
        tokenARead.decimals(),
        tokenBRead.decimals()
      ]);

      const amountAWei = parseUnits(amountA, Number(decimalsA));
      const amountBWei = parseUnits(amountB, Number(decimalsB));
      const owner = await signer.getAddress();

      const allowanceA = toBigInt(
        await tokenARead.allowance(owner, routerAddress)
      );
      if (allowanceA < amountAWei) {
        const approveATx = await tokenAWrite.approve(routerAddress, amountAWei);
        await approveATx.wait();
      }

      const allowanceB = toBigInt(
        await tokenBRead.allowance(owner, routerAddress)
      );
      if (allowanceB < amountBWei) {
        const approveBTx = await tokenBWrite.approve(routerAddress, amountBWei);
        await approveBTx.wait();
      }

      const tx = await router.addLiquidity(
        tokenA,
        tokenB,
        amountAWei,
        amountBWei,
        0n,
        0n,
        owner,
        BigInt(nowPlusMinutes(10))
      );
      await tx.wait();
      setFeedback("Liquidity added successfully.");
    } catch (err: any) {
      console.error("add liquidity failed", err);
      setError(err?.reason || err?.message || "Add liquidity failed.");
      setFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    const ctx = ensureWallet();
    if (!ctx) return;
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

      const router = getRouter(routerAddress, signer);
      const factory = getFactory(factoryAddress, provider);
      const pairAddress =
        lpInfo.pair ?? (await factory.getPair(tokenA, tokenB));
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

      const token0 = await pairRead.token0();
      const token1 = await pairRead.token1();
      const [decimals0, decimals1] = await Promise.all([
        getToken(token0, provider).decimals(),
        getToken(token1, provider).decimals()
      ]);

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
        const amount0 = formatUnits(burnLog.args.amount0, Number(decimals0));
        const amount1 = formatUnits(burnLog.args.amount1, Number(decimals1));
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
    } catch (err: any) {
      console.error("remove liquidity error", err);
      setRemoveResult(
        err?.reason || err?.message || "Failed to remove liquidity."
      );
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
      const pairAddress = await factory.getPair(tokenA, tokenB);
      if (pairAddress === ZeroAddress) {
        setPairInspection((prev) => ({
          ...prev,
          result: "Pair not yet created."
        }));
        return;
      }
      const pair = getPair(pairAddress, provider);
      const reserves = await pair.getReserves();
      const token0 = await pair.token0();
      const token1 = await pair.token1();

      const token0Contract = getToken(token0, provider);
      const token1Contract = getToken(token1, provider);
      const decimals0 = Number(await token0Contract.decimals());
      const decimals1 = Number(await token1Contract.decimals());

      const formatted = `Pair ${pairAddress}\nReserves:\n  • ${formatUnits(
        reserves[0],
        decimals0
      )} (${token0})\n  • ${formatUnits(reserves[1], decimals1)} (${token1})`;
      setPairInspection((prev) => ({ ...prev, result: formatted }));
    } catch (err: any) {
      setPairInspection((prev) => ({
        ...prev,
        result: err?.reason || err?.message || "Failed to inspect pair."
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

  const primaryDisabled =
    !ready || isSubmitting || checkingAllowance || !swapFormReady;

  const primaryActionLabel = !ready
    ? "Connect Wallet"
    : !swapFormReady
      ? "Enter Amount"
      : checkingAllowance
        ? "Checking..."
        : needsApproval
          ? isSubmitting
            ? "Approving..."
            : "Approve"
          : isSubmitting
            ? "Swapping..."
            : "Swap";

  const triggerPrimaryAction = () => {
    if (primaryDisabled) return;
    if (needsApproval) {
      handleApprove(swapForm.tokenIn, routerAddress, swapForm.amountIn || "0");
    } else {
      handleSwap();
    }
  };

  const openTokenDialog = (side: "in" | "out") => {
    setTokenDialogSide(side);
    setTokenSearch("");
    setTokenDialogOpen(true);
  };

  const closeTokenDialog = () => {
    setTokenDialogOpen(false);
    setTokenSearch("");
  };

  const commitSelection = (token: TokenDescriptor) => {
    if (tokenDialogSide === "in") {
      setSelectedIn(token);
    } else {
      setSelectedOut(token);
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
  const activeAddress =
    (tokenDialogSide === "in"
      ? selectedIn?.address
      : selectedOut?.address
    )?.toLowerCase() ?? null;

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
            {wallet.account ? (
              <span className={styles.networkBadge}>
                Acct · {shortAddress(wallet.account)}
              </span>
            ) : (
              <button
                className={styles.walletButton}
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                type="button"
              >
                {wallet.isConnecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {(networkError || error || feedback || swapQuoteError) && (
          <div className={styles.statusStack}>
            {networkError && (
              <div className={`${styles.status} ${styles.statusWarn}`}>
                <div className={styles.statusContent}>
                  <span className={styles.statusLabel}>Network</span>
                  {networkError}
                </div>
                <button
                  className={styles.statusAction}
                  type="button"
                  onClick={switchToMegaEth}
                >
                  Switch
                </button>
              </div>
            )}
            {error && (
              <div className={`${styles.status} ${styles.statusError}`}>
                <div className={styles.statusContent}>
                  <span className={styles.statusLabel}>Error</span>
                  {error}
                </div>
              </div>
            )}
            {feedback && (
              <div className={`${styles.status} ${styles.statusSuccess}`}>
                <div className={styles.statusContent}>
                  <span className={styles.statusLabel}>Status</span>
                  {feedback}
                </div>
              </div>
            )}
            {swapQuoteError && (
              <div className={`${styles.status} ${styles.statusError}`}>
                <div className={styles.statusContent}>
                  <span className={styles.statusLabel}>Quote</span>
                  {swapQuoteError}
                </div>
              </div>
            )}
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
                    onClick={() => openTokenDialog("in")}
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
                    onClick={() => openTokenDialog("out")}
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
                className={styles.primaryButton}
                onClick={triggerPrimaryAction}
                disabled={primaryDisabled}
                type="button"
              >
                {primaryActionLabel}
              </button>
            </div>
            <span className={styles.summaryPrimary}>
              {swapQuote
                ? `Quote ≈ ${swapQuote.amount} ${swapQuote.symbol}`
                : null}
            </span>
          </section>
        )}

        {activeView === "liquidity" && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Liquidity</h2>
                <p className={styles.cardSubtitle}>
                  Provide or withdraw liquidity from MegaSwap pairs. Approvals
                  are handled inline before execution.
                </p>
              </div>
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
              <div className={styles.form}>
                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Token A Address</label>
                    <input
                      className={styles.input}
                      placeholder="0x…"
                      value={liquidityForm.tokenA}
                      onChange={(event) =>
                        setLiquidityForm((prev) => ({
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
                      value={liquidityForm.tokenB}
                      onChange={(event) =>
                        setLiquidityForm((prev) => ({
                          ...prev,
                          tokenB: event.target.value.trim()
                        }))
                      }
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Amount A</label>
                    <input
                      className={styles.input}
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
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Amount B</label>
                    <input
                      className={styles.input}
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
                </div>

                <div className={styles.buttonRow}>
                  <button
                    className={styles.primaryButton}
                    onClick={handleAddLiquidity}
                    disabled={!ready || isSubmitting}
                    type="button"
                  >
                    Add Liquidity
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      handleApprove(
                        liquidityForm.tokenA,
                        routerAddress,
                        liquidityForm.amountA || "0"
                      )
                    }
                    disabled={!ready || isSubmitting}
                    type="button"
                  >
                    Approve Token A
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() =>
                      handleApprove(
                        liquidityForm.tokenB,
                        routerAddress,
                        liquidityForm.amountB || "0"
                      )
                    }
                    disabled={!ready || isSubmitting}
                    type="button"
                  >
                    Approve Token B
                  </button>
                </div>
              </div>
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
                </div>

                <span className={styles.helper}>
                  LP Balance:{" "}
                  {lpInfo.balance
                    ? `${lpInfo.balance} ${lpInfo.symbol ?? "LP"}`
                    : "—"}
                </span>

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

            <hr className={styles.divider} />

            <div className={styles.utility}>
              <span className={styles.utilityTitle}>Pair Diagnostics</span>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Token A Address</label>
                  <input
                    className={styles.input}
                    placeholder="0x…"
                    value={pairInspection.tokenA}
                    onChange={(event) =>
                      setPairInspection((prev) => ({
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
                    value={pairInspection.tokenB}
                    onChange={(event) =>
                      setPairInspection((prev) => ({
                        ...prev,
                        tokenB: event.target.value.trim()
                      }))
                    }
                  />
                </div>
              </div>
              <div className={styles.buttonRow}>
                <button
                  className={styles.secondaryButton}
                  onClick={inspectPair}
                  disabled={!ready || isSubmitting}
                  type="button"
                >
                  Fetch Reserves
                </button>
              </div>
              {pairInspection.result && (
                <div className={styles.mono}>{pairInspection.result}</div>
              )}
            </div>
          </section>
        )}

        <footer className={styles.footnote}>
          MegaSwap Router {shortAddress(routerAddress)} · WMegaETH{" "}
          {shortAddress(wmegaAddress)}
        </footer>
      </div>
      {tokenDialogOpen && (
        <div className={styles.dialogBackdrop} onClick={closeTokenDialog}>
          <div
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <span className={styles.dialogTitle}>
                Select {tokenDialogSide === "in" ? "pay" : "receive"} token
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

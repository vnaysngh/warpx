import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcProvider } from "ethers";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import { DEFAULT_TOKEN_DECIMALS, TOKEN_CATALOG } from "@/lib/trade/constants";
import { fetchTokenDetails, isValidAddress } from "@/lib/utils/tokenFetch";

type TokenManifestEntry = {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
  isNative?: boolean;
};

type TokenManifest = {
  tokens?: TokenManifestEntry[];
};

type DeploymentMetadata = {
  network?: string;
  wmegaeth?: string;
} | null;

type TokenManagerOptions = {
  initialSwapIn?: TokenDescriptor | null;
  initialSwapOut?: TokenDescriptor | null;
  initialLiquidityA?: TokenDescriptor | null;
  initialLiquidityB?: TokenDescriptor | null;
  provider?: JsonRpcProvider;
};

const NATIVE_SYMBOL_FALLBACK = "ETH";

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const normalizeCatalogToken = (
  token: TokenDescriptor,
  nativeSymbol: string,
  wrappedNative?: string
): TokenDescriptor | null => {
  const decimals = token.decimals ?? DEFAULT_TOKEN_DECIMALS;
  const upper = token.symbol.toUpperCase();

  if (upper === nativeSymbol) {
    const wrappedAddress = wrappedNative ?? token.wrappedAddress ?? token.address;
    if (!wrappedAddress || !isAddress(wrappedAddress)) {
      return null;
    }
    return {
      ...token,
      address: wrappedAddress,
      wrappedAddress,
      decimals,
      isNative: true
    };
  }

  if (!token.address || !isAddress(token.address)) {
    return null;
  }

  return {
    ...token,
    decimals,
    isNative: false
  };
};

const mapNativeToken = (
  token: TokenDescriptor,
  nativeSymbol: string,
  wrappedNative?: string
): TokenDescriptor | null => {
  if (!token.isNative && token.symbol.toUpperCase() !== nativeSymbol) {
    return {
      ...token,
      isNative: false,
      decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
    };
  }

  const wrappedAddress =
    wrappedNative ?? token.wrappedAddress ?? token.address;

  if (!wrappedAddress || !isAddress(wrappedAddress)) {
    return null;
  }

  return {
    ...token,
    address: wrappedAddress,
    wrappedAddress,
    decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS,
    isNative: true
  };
};

const mapTokenEntry = (
  entry: TokenDescriptor | TokenManifestEntry,
  nativeSymbol: string,
  wrappedNative?: string
): TokenDescriptor | null => {
  const symbol = entry.symbol;
  const name = entry.name ?? entry.symbol;
  const decimals = entry.decimals ?? DEFAULT_TOKEN_DECIMALS;
  const upper = symbol.toUpperCase();

  if (upper === nativeSymbol || entry.isNative) {
    const wrappedAddress = wrappedNative ?? ("wrappedAddress" in entry ? entry.wrappedAddress : undefined) ?? entry.address;
    if (!wrappedAddress || !isAddress(wrappedAddress)) {
      return null;
    }
    return {
      symbol,
      name,
      address: wrappedAddress,
      decimals,
      wrappedAddress,
      isNative: true,
      logo: "logo" in entry ? entry.logo : undefined
    };
  }

  const address = entry.address;
  if (!address || !isAddress(address)) {
    return null;
  }

  return {
    symbol,
    name,
    address,
    decimals,
    isNative: false,
    logo: "logo" in entry ? entry.logo : undefined
  };
};

export function useTokenManager(
  deployment?: DeploymentMetadata,
  options?: TokenManagerOptions
) {
  const deploymentNetwork = deployment?.network;
  const wrappedNativeAddress = deployment?.wmegaeth;
  const nativeSymbolValue =
    (deployment as { nativeSymbol?: string } | null | undefined)?.nativeSymbol ??
    process.env.NEXT_PUBLIC_NATIVE_SYMBOL ??
    NATIVE_SYMBOL_FALLBACK;
  const nativeSymbol = nativeSymbolValue.toUpperCase();

  const initialTokenList = useMemo(() => {
    return TOKEN_CATALOG.map((token) =>
      normalizeCatalogToken(token, nativeSymbol, wrappedNativeAddress)
    ).filter((token): token is TokenDescriptor => Boolean(token));
  }, [nativeSymbol, wrappedNativeAddress]);

  const resolveInitial = <T>(
    fallback: () => T | null,
    value: T | null | undefined,
    provided: boolean
  ): T | null => {
    if (provided) {
      return value ?? null;
    }
    return fallback();
  };

  const hasInitialSwapIn = options ? "initialSwapIn" in options : false;
  const hasInitialSwapOut = options ? "initialSwapOut" in options : false;
  const hasInitialLiquidityA = options ? "initialLiquidityA" in options : false;
  const hasInitialLiquidityB = options ? "initialLiquidityB" in options : false;

  const initialSwapInToken = resolveInitial(
    () => initialTokenList[0] ?? null,
    options?.initialSwapIn,
    hasInitialSwapIn
  );
  const initialSwapOutToken = resolveInitial(
    () => initialTokenList[1] ?? initialTokenList[0] ?? null,
    options?.initialSwapOut,
    hasInitialSwapOut
  );
  const initialLiquidityTokenA = resolveInitial(
    () => initialTokenList[0] ?? null,
    options?.initialLiquidityA,
    hasInitialLiquidityA
  );
  const initialLiquidityTokenB = resolveInitial(
    () => initialTokenList[1] ?? initialTokenList[0] ?? null,
    options?.initialLiquidityB,
    hasInitialLiquidityB
  );

  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(initialTokenList);
  const [selectedIn, setSelectedIn] = useState<TokenDescriptor | null>(
    initialSwapInToken
  );
  const [selectedOut, setSelectedOut] = useState<TokenDescriptor | null>(
    initialSwapOutToken
  );
  const [liquidityTokenA, setLiquidityTokenA] = useState<TokenDescriptor | null>(
    initialLiquidityTokenA
  );
  const [liquidityTokenB, setLiquidityTokenB] = useState<TokenDescriptor | null>(
    initialLiquidityTokenB
  );
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogSide, setTokenDialogSide] =
    useState<TokenDialogSlot>("swapIn");
  const [tokenSearch, setTokenSearch] = useState("");
  const [isFetchingCustomToken, setIsFetchingCustomToken] = useState(false);
  const [prefetchedTokenDetails, setPrefetchedTokenDetails] = useState<{
    symbol: string;
    name: string;
    decimals: number;
    address: string;
  } | null>(null);

  // Track last set addresses to prevent circular updates
  const lastSetAddresses = useRef<{
    selectedIn: string | null;
    selectedOut: string | null;
    liquidityA: string | null;
    liquidityB: string | null;
  }>({
    selectedIn: initialSwapInToken?.address?.toLowerCase() ?? null,
    selectedOut: initialSwapOutToken?.address?.toLowerCase() ?? null,
    liquidityA: initialLiquidityTokenA?.address?.toLowerCase() ?? null,
    liquidityB: initialLiquidityTokenB?.address?.toLowerCase() ?? null
  });

  useEffect(() => {
    // Sync token list when native symbol or wrapped address changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokenList((prev) => {
      const remapped = prev
        .map((token) => mapNativeToken(token, nativeSymbol, wrappedNativeAddress))
        .filter((token): token is TokenDescriptor => Boolean(token));
      remapped.sort((a, b) => a.symbol.localeCompare(b.symbol));
      return remapped;
    });
  }, [nativeSymbol, wrappedNativeAddress]);

  useEffect(() => {
    if (!deploymentNetwork) return;

    let cancelled = false;
    const loadTokenManifest = async () => {
      try {
        const manifestPaths = [
          `/deployments/${deploymentNetwork}.tokens.json`,
          `/deployments/${deploymentNetwork.toLowerCase()}.tokens.json`,
          `/deployments/${deploymentNetwork}.json`
        ];

        let manifest: TokenManifest | null = null;
        for (const manifestPath of manifestPaths) {
          try {
            const response = await fetch(manifestPath, { cache: "no-store" });
            if (response.ok) {
              manifest = (await response.json()) as TokenManifest;
              break;
            }
          } catch (innerError) {
            console.warn("[tokens] manifest fetch failed", manifestPath, innerError);
          }
        }

        if (!manifest?.tokens?.length || cancelled) return;

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();

          const addToken = (entry: TokenDescriptor | TokenManifestEntry) => {
            const descriptor = mapTokenEntry(entry, nativeSymbol, wrappedNativeAddress);
            if (!descriptor) return;
            const key = descriptor.address.toLowerCase();
            if (!merged.has(key)) {
              merged.set(key, descriptor);
            }
          };

          prev.forEach(addToken);
          TOKEN_CATALOG.forEach((token) => addToken(token as TokenDescriptor));
          manifest.tokens?.forEach((token) => addToken(token));

          const tokensArray = Array.from(merged.values());
          tokensArray.sort((a, b) => a.symbol.localeCompare(b.symbol));

          return tokensArray;
        });
      } catch (err) {
        console.warn("[tokens] failed to load manifest tokens", err);
      }
    };

    loadTokenManifest();
    return () => {
      cancelled = true;
    };
  }, [deploymentNetwork, nativeSymbol, wrappedNativeAddress]);

  // Prefetch token details when user enters a valid address
  useEffect(() => {
    const normalizedSearch = tokenSearch.trim().toLowerCase();

    // Reset prefetched details if search is empty or not a valid address
    if (!normalizedSearch || !isValidAddress(normalizedSearch)) {
      setPrefetchedTokenDetails(null);
      return;
    }

    // Check if token already exists
    const existingToken = tokenList.find(
      (token) => token.address.toLowerCase() === normalizedSearch
    );

    if (existingToken) {
      setPrefetchedTokenDetails(null);
      return;
    }

    // Fetch token details
    const provider = options?.provider;
    if (!provider) {
      setPrefetchedTokenDetails(null);
      return;
    }

    let cancelled = false;
    setIsFetchingCustomToken(true);

    const fetchDetails = async () => {
      try {
        const details = await fetchTokenDetails(normalizedSearch, provider);

        if (cancelled) return;

        if (details) {
          setPrefetchedTokenDetails(details);
        } else {
          setPrefetchedTokenDetails(null);
        }
      } catch (error) {
        console.error("[tokenManager] Error prefetching token details:", error);
        if (!cancelled) {
          setPrefetchedTokenDetails(null);
        }
      } finally {
        if (!cancelled) {
          setIsFetchingCustomToken(false);
        }
      }
    };

    fetchDetails();

    return () => {
      cancelled = true;
    };
  }, [tokenSearch, tokenList, options?.provider]);

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

    const firstToken = tokenList[0] ?? null;
    const secondToken =
      tokenList.find(
        (token) =>
          firstToken &&
          token.address.toLowerCase() !== firstToken.address.toLowerCase()
      ) ?? firstToken;

    const lastAddrs = lastSetAddresses.current;

    // Find tokens in the updated list that match the last set addresses
    const nextSelectedIn = findByAddress(lastAddrs.selectedIn) ?? firstToken;
    const nextSelectedOut = findByAddress(lastAddrs.selectedOut) ?? secondToken ?? nextSelectedIn;
    const nextTokenA = findByAddress(lastAddrs.liquidityA) ?? null;
    const nextTokenB = findByAddress(lastAddrs.liquidityB) ?? null;

    // Only update if addresses actually changed to prevent circular dependencies
    const nextInAddr = nextSelectedIn?.address?.toLowerCase() ?? null;
    const nextOutAddr = nextSelectedOut?.address?.toLowerCase() ?? null;
    const nextAAddr = nextTokenA?.address?.toLowerCase() ?? null;
    const nextBAddr = nextTokenB?.address?.toLowerCase() ?? null;

    // Sync selected tokens when token list changes - intentional state updates
    if (lastAddrs.selectedIn !== nextInAddr) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIn(nextSelectedIn);
      lastSetAddresses.current.selectedIn = nextInAddr;
    }
    if (lastAddrs.selectedOut !== nextOutAddr) {
      setSelectedOut(nextSelectedOut);
      lastSetAddresses.current.selectedOut = nextOutAddr;
    }
    // Don't reorder liquidity tokens - let the pool page handle ordering
    if (lastAddrs.liquidityA !== nextAAddr && nextTokenA) {
      setLiquidityTokenA(nextTokenA);
      lastSetAddresses.current.liquidityA = nextAAddr;
    }
    if (lastAddrs.liquidityB !== nextBAddr && nextTokenB) {
      setLiquidityTokenB(nextTokenB);
      lastSetAddresses.current.liquidityB = nextBAddr;
    }
  }, [tokenList]);

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
    if (!token?.address) {
      return;
    }

    const tokenAddr = token.address.toLowerCase();

    switch (tokenDialogSide) {
      case "swapIn":
        setSelectedIn(token);
        lastSetAddresses.current.selectedIn = tokenAddr;
        if (
          token.address &&
          token.address.toLowerCase() === selectedOut?.address?.toLowerCase()
        ) {
          setSelectedOut(null);
          lastSetAddresses.current.selectedOut = null;
        }
        break;
      case "swapOut":
        setSelectedOut(token);
        lastSetAddresses.current.selectedOut = tokenAddr;
        if (
          token.address &&
          token.address.toLowerCase() === selectedIn?.address?.toLowerCase()
        ) {
          setSelectedOut(null);
          lastSetAddresses.current.selectedOut = null;
        }
        break;
      case "liquidityA":
        setLiquidityTokenA(token);
        lastSetAddresses.current.liquidityA = tokenAddr;
        break;
      case "liquidityB":
        setLiquidityTokenB(token);
        lastSetAddresses.current.liquidityB = tokenAddr;
        break;
    }
    closeTokenDialog();
  };

  const handleSelectToken = (token: TokenDescriptor) => {
    commitSelection(token);
  };

  const handleSelectCustomToken = useCallback((address: string) => {
    const sanitized = address.trim();
    if (!isValidAddress(sanitized)) {
      console.warn("[tokenManager] Invalid address:", address);
      return;
    }

    const normalizedAddress = sanitized.toLowerCase();

    // Check if token already exists in list
    const existingToken = tokenList.find(
      (token) => token.address.toLowerCase() === normalizedAddress
    );

    if (existingToken) {
      commitSelection(existingToken);
      return;
    }

    // Use prefetched details
    if (!prefetchedTokenDetails) {
      console.error("[tokenManager] No token details available for:", sanitized);
      return;
    }

    // Create temporary token (NOT added to token list)
    const temporaryToken: TokenDescriptor = {
      symbol: prefetchedTokenDetails.symbol,
      name: prefetchedTokenDetails.name,
      address: sanitized,
      decimals: prefetchedTokenDetails.decimals,
      isNative: false
    };

    // Select the temporary token without adding to token list
    commitSelection(temporaryToken);

    // Clear prefetched details
    setPrefetchedTokenDetails(null);
  }, [tokenList, prefetchedTokenDetails]);

  const normalizedSearch = tokenSearch.trim().toLowerCase();

  const filteredTokens = useMemo(() => {
    if (!normalizedSearch) {
      return tokenList;
    }
    return tokenList.filter((token) => {
      const symbolMatch = token.symbol.toLowerCase().includes(normalizedSearch);
      const nameMatch = token.name.toLowerCase().includes(normalizedSearch);
      // Support both exact and partial address matches
      const addressLower = token.address.toLowerCase();
      const addressMatch = addressLower === normalizedSearch || addressLower.includes(normalizedSearch);
      return symbolMatch || nameMatch || addressMatch;
    });
  }, [tokenList, normalizedSearch]);

  const showCustomOption = useMemo(() => {
    if (!normalizedSearch) return false;
    if (!isValidAddress(normalizedSearch)) return false;
    // Only show custom option if token doesn't exist in list
    return !tokenList.some(
      (token) => token.address.toLowerCase() === normalizedSearch
    );
  }, [normalizedSearch, tokenList]);

  const activeAddress = useMemo(() => {
    const activeToken = (() => {
      switch (tokenDialogSide) {
        case "swapIn":
          return selectedIn;
        case "swapOut":
          return selectedOut;
        case "liquidityA":
          return liquidityTokenA;
        case "liquidityB":
          return liquidityTokenB;
        default:
          return null;
      }
    })();
    return activeToken?.address?.toLowerCase() ?? null;
  }, [
    tokenDialogSide,
    selectedIn,
    selectedOut,
    liquidityTokenA,
    liquidityTokenB
  ]);

  const swapTokens = useCallback(() => {
    setSelectedIn((prevIn) => {
      if (!selectedOut) {
        return prevIn;
      }
      const nextIn = selectedOut;
      setSelectedOut(prevIn);
      lastSetAddresses.current.selectedIn = nextIn?.address?.toLowerCase() ?? null;
      lastSetAddresses.current.selectedOut = prevIn?.address?.toLowerCase() ?? null;
      return nextIn;
    });
  }, [selectedOut]);

  // Wrap setters to keep refs in sync
  const wrappedSetSelectedIn = useCallback((token: TokenDescriptor | null) => {
    setSelectedIn(token);
    lastSetAddresses.current.selectedIn = token?.address?.toLowerCase() ?? null;
  }, []);

  const wrappedSetSelectedOut = useCallback((token: TokenDescriptor | null) => {
    setSelectedOut(token);
    lastSetAddresses.current.selectedOut = token?.address?.toLowerCase() ?? null;
  }, []);

  const wrappedSetLiquidityTokenA = useCallback((token: TokenDescriptor | null) => {
    setLiquidityTokenA(token);
    lastSetAddresses.current.liquidityA = token?.address?.toLowerCase() ?? null;
  }, []);

  const wrappedSetLiquidityTokenB = useCallback((token: TokenDescriptor | null) => {
    setLiquidityTokenB(token);
    lastSetAddresses.current.liquidityB = token?.address?.toLowerCase() ?? null;
  }, []);

  return {
    tokenList,
    setTokenList,
    selectedIn,
    selectedOut,
    liquidityTokenA,
    liquidityTokenB,
    tokenDialogOpen,
    tokenDialogSide,
    tokenSearch,
    openTokenDialog,
    closeTokenDialog,
    handleSelectToken,
    handleSelectCustomToken,
    filteredTokens,
    showCustomOption,
    activeAddress,
    swapTokens,
    setTokenSearch,
    setSelectedIn: wrappedSetSelectedIn,
    setSelectedOut: wrappedSetSelectedOut,
    setLiquidityTokenA: wrappedSetLiquidityTokenA,
    setLiquidityTokenB: wrappedSetLiquidityTokenB,
    isFetchingCustomToken,
    prefetchedTokenDetails
  };
}

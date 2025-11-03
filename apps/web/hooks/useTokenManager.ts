import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import { DEFAULT_TOKEN_DECIMALS, TOKEN_CATALOG } from "@/lib/trade/constants";

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

export function useTokenManager(deployment?: DeploymentMetadata) {
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

  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(initialTokenList);
  const [selectedIn, setSelectedIn] = useState<TokenDescriptor | null>(
    initialTokenList[0] ?? null
  );
  const [selectedOut, setSelectedOut] = useState<TokenDescriptor | null>(
    initialTokenList[1] ?? initialTokenList[0] ?? null
  );
  const [liquidityTokenA, setLiquidityTokenA] = useState<TokenDescriptor | null>(
    initialTokenList[0] ?? null
  );
  const [liquidityTokenB, setLiquidityTokenB] = useState<TokenDescriptor | null>(
    initialTokenList[1] ?? initialTokenList[0] ?? null
  );
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogSide, setTokenDialogSide] =
    useState<TokenDialogSlot>("swapIn");
  const [tokenSearch, setTokenSearch] = useState("");

  // Track last set addresses to prevent circular updates
  const lastSetAddresses = useRef<{
    selectedIn: string | null;
    selectedOut: string | null;
    liquidityA: string | null;
    liquidityB: string | null;
  }>({
    selectedIn: initialTokenList[0]?.address?.toLowerCase() ?? null,
    selectedOut: (initialTokenList[1] ?? initialTokenList[0])?.address?.toLowerCase() ?? null,
    liquidityA: initialTokenList[0]?.address?.toLowerCase() ?? null,
    liquidityB: (initialTokenList[1] ?? initialTokenList[0])?.address?.toLowerCase() ?? null
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

    const normalizePair = (
      tokenA: TokenDescriptor | null,
      tokenB: TokenDescriptor | null
    ) => {
      if (tokenA?.isNative && tokenB && !tokenB.isNative) {
        return [tokenB, tokenA] as const;
      }
      return [tokenA, tokenB] as const;
    };

    const [normalizedA, normalizedB] = normalizePair(nextTokenA, nextTokenB);

    // Only update if addresses actually changed to prevent circular dependencies
    const nextInAddr = nextSelectedIn?.address?.toLowerCase() ?? null;
    const nextOutAddr = nextSelectedOut?.address?.toLowerCase() ?? null;
    const nextAAddr = normalizedA?.address?.toLowerCase() ?? null;
    const nextBAddr = normalizedB?.address?.toLowerCase() ?? null;

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
    if (lastAddrs.liquidityA !== nextAAddr && normalizedA) {
      setLiquidityTokenA(normalizedA);
      lastSetAddresses.current.liquidityA = nextAAddr;
    }
    if (lastAddrs.liquidityB !== nextBAddr && normalizedB) {
      setLiquidityTokenB(normalizedB);
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

  const handleSelectCustomToken = (address: string) => {
    const sanitized = address.trim().toLowerCase();
    if (!isAddress(sanitized)) return;
    const derivedSymbol = `CUST-${sanitized.slice(2, 6).toUpperCase()}`;
    const customToken: TokenDescriptor = {
      symbol: derivedSymbol,
      name: "Custom Token",
      address: sanitized,
      decimals: DEFAULT_TOKEN_DECIMALS,
      isNative: false
    };
    setTokenList((prev) => {
      if (prev.some((token) => token.address.toLowerCase() === sanitized)) {
        return prev;
      }
      return [...prev, customToken];
    });
  };

  const normalizedSearch = tokenSearch.trim().toLowerCase();

  const filteredTokens = useMemo(() => {
    if (!normalizedSearch) {
      return tokenList;
    }
    return tokenList.filter((token) => {
      const symbolMatch = token.symbol.toLowerCase().includes(normalizedSearch);
      const nameMatch = token.name.toLowerCase().includes(normalizedSearch);
      const addressMatch = token.address.toLowerCase() === normalizedSearch;
      return symbolMatch || nameMatch || addressMatch;
    });
  }, [tokenList, normalizedSearch]);

  const showCustomOption = useMemo(() => {
    if (!normalizedSearch) return false;
    if (!isAddress(normalizedSearch)) return false;
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
    setLiquidityTokenB: wrappedSetLiquidityTokenB
  };
}

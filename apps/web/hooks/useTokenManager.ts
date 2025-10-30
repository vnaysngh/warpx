import { useEffect, useMemo, useState } from "react";
import type { TokenDescriptor, TokenDialogSlot } from "@/lib/trade/types";
import { DEFAULT_TOKEN_DECIMALS, TOKEN_CATALOG } from "@/lib/trade/constants";

type TokenManifestEntry = {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
};

type TokenManifest = {
  tokens?: TokenManifestEntry[];
};

const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

export function useTokenManager(deploymentNetwork?: string) {
  const [tokenList, setTokenList] = useState<TokenDescriptor[]>(TOKEN_CATALOG);
  const [selectedIn, setSelectedIn] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[0] ?? null
  );
  const [selectedOut, setSelectedOut] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[1] ?? TOKEN_CATALOG[0] ?? null
  );
  const [liquidityTokenA, setLiquidityTokenA] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[0] ?? null
  );
  const [liquidityTokenB, setLiquidityTokenB] = useState<TokenDescriptor | null>(
    TOKEN_CATALOG[1] ?? TOKEN_CATALOG[0] ?? null
  );
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenDialogSide, setTokenDialogSide] =
    useState<TokenDialogSlot>("swapIn");
  const [tokenSearch, setTokenSearch] = useState("");

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

        if (!manifest?.tokens?.length) return;
        if (cancelled) return;

        setTokenList((prev) => {
          const merged = new Map<string, TokenDescriptor>();

          const addToken = (token: TokenDescriptor) => {
            if (!token.address || !isAddress(token.address)) return;
            merged.set(token.address.toLowerCase(), {
              ...token,
              decimals: token.decimals ?? DEFAULT_TOKEN_DECIMALS
            });
          };

          [...TOKEN_CATALOG, ...prev].forEach(addToken);
          manifest.tokens?.forEach((token) =>
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
  }, [deploymentNetwork]);

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
        // If the selected token is the same as the output token, reset output
        if (token.address.toLowerCase() === selectedOut?.address.toLowerCase()) {
          setSelectedOut(null);
        }
        break;
      case "swapOut":
        setSelectedOut(token);
        // If the selected token is the same as the input token, reset output
        if (token.address.toLowerCase() === selectedIn?.address.toLowerCase()) {
          setSelectedOut(null);
        }
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
      decimals: DEFAULT_TOKEN_DECIMALS
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
    const normalized = (value?: string | null) =>
      value ? value.toLowerCase() : null;
    switch (tokenDialogSide) {
      case "swapIn":
        return normalized(selectedIn?.address);
      case "swapOut":
        return normalized(selectedOut?.address);
      case "liquidityA":
        return normalized(liquidityTokenA?.address);
      case "liquidityB":
        return normalized(liquidityTokenB?.address);
      default:
        return null;
    }
  }, [tokenDialogSide, selectedIn, selectedOut, liquidityTokenA, liquidityTokenB]);

  const swapTokens = () => {
    const temp = selectedIn;
    setSelectedIn(selectedOut);
    setSelectedOut(temp);
  };

  return {
    tokenList,
    setTokenList,
    selectedIn,
    setSelectedIn,
    selectedOut,
    setSelectedOut,
    liquidityTokenA,
    setLiquidityTokenA,
    liquidityTokenB,
    setLiquidityTokenB,
    tokenDialogOpen,
    tokenDialogSide,
    tokenSearch,
    setTokenSearch,
    openTokenDialog,
    closeTokenDialog,
    handleSelectToken,
    handleSelectCustomToken,
    filteredTokens,
    showCustomOption,
    activeAddress,
    swapTokens
  };
}

"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";
import {
  formatBalanceDisplay,
  formatCompactNumber,
  formatNumber,
  formatNumberWithGrouping,
  formatPercent,
  formatTokenAmount,
  formatTokenBalance,
  FormatNumberOptions,
  NumberType
} from "./formatNumbers";

type LocalizationContextValue = {
  locale: string;
  formatNumber: (options: FormatNumberOptions) => string;
  formatTokenAmount: (
    value: bigint | null | undefined,
    decimals: number,
    type?: NumberType
  ) => string;
  formatPercent: (value: number | null | undefined) => string;
  formatCompactNumber: (
    value: number | string | null | undefined,
    maxDecimals?: number
  ) => string;
  formatNumberWithGrouping: (
    value: number | string | null | undefined,
    maxDecimals?: number
  ) => string;
  formatBalanceDisplay: (value: string | null) => string;
  formatTokenBalance: (value: bigint | null | undefined, decimals: number) => string;
};

const LocalizationContext = createContext<LocalizationContextValue | undefined>(
  undefined
);

const getNavigatorLocale = () => {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
};

export function LocalizationProvider({ children }: PropsWithChildren) {
  const [locale] = useState(getNavigatorLocale);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      formatNumber: (options) => formatNumber({ ...options, locale }),
      formatTokenAmount: (value, decimals, type) =>
        formatTokenAmount(value, decimals, type, locale),
      formatPercent: (value) => formatPercent(value, locale),
      formatCompactNumber: (value, maxDecimals) =>
        formatCompactNumber(value, maxDecimals, locale),
      formatNumberWithGrouping: (value, maxDecimals) =>
        formatNumberWithGrouping(value, maxDecimals, locale),
      formatBalanceDisplay: (value) => formatBalanceDisplay(value, locale),
      formatTokenBalance: (value, decimals) =>
        formatTokenBalance(value, decimals, locale)
    }),
    [locale]
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error("useLocalization must be used within LocalizationProvider");
  }
  return context;
}

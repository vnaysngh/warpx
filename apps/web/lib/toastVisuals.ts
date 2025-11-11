import type {
  ToastVisuals,
  ToastVisualVariant
} from "@/components/Toast";
import type { TokenDescriptor } from "@/lib/trade/types";

const toTokenVisual = (token?: TokenDescriptor | null) => {
  if (!token) return undefined;
  return {
    symbol: token.symbol,
    logo: token.logo
  };
};

export function buildToastVisuals(
  variant: ToastVisualVariant = "default",
  left?: TokenDescriptor | null,
  right?: TokenDescriptor | null
): ToastVisuals | undefined {
  const leftToken = toTokenVisual(left);
  const rightToken = toTokenVisual(right);

  if (!leftToken && !rightToken && variant === "default") {
    return undefined;
  }

  return {
    variant,
    leftToken,
    rightToken
  };
}

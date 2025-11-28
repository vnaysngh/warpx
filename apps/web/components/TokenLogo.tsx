import { useState } from "react";

interface TokenLogoProps {
  logo?: string;
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenLogo({
  logo,
  symbol,
  size = 40,
  className = ""
}: TokenLogoProps) {
  const [imageError, setImageError] = useState(false);

  // Show placeholder if no logo or image failed to load
  const showPlaceholder = !logo || imageError;

  // Get first letter of symbol for placeholder
  const initial = symbol?.[0]?.toUpperCase() || "?";

  if (showPlaceholder) {
    return (
      <div
        className={`rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 ${className}`}
        style={{ width: size, height: size }}
      >
        <span
          className="font-display font-bold text-primary"
          style={{ fontSize: size * 0.5 }}
        >
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={symbol}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "@warpx/theme/globals.css";

// Display font - Space Grotesk (headings, brand)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

// Body font - Inter (UI text, body)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

// Mono font - JetBrains Mono (data, numbers, code)
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WarpX — MegaETH v2 AMM",
  description:
    "Discover WarpX, the MegaETH-native AMM for swaps and liquidity. Learn how to provide liquidity and launch the dApp."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

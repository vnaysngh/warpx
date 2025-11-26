import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "@warpx/theme/globals.css";
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WarpX",
  description: "MegaETH v2 AMM desk for swaps and liquidity."
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
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}

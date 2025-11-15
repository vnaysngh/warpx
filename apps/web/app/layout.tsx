import type { Metadata } from "next";
import { Poppins, Mochiy_Pop_One } from "next/font/google";
import "@warpx/theme/globals.css";
import { Providers } from "./providers";
import { ClientLayout } from "@/components/layout/ClientLayout";

// Primary font - Poppins (everything except brand name)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
  display: "swap"
});

// Brand font - Mochiy Pop One (WARPX logo only)
const mochiyPopOne = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mochiy",
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
      className={`${poppins.variable} ${mochiyPopOne.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}

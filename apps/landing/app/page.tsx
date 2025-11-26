"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Radio, Activity } from "lucide-react";
import { Footer } from "@/components/Footer";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://testnet.warpx.exchange"
    : "http://localhost:3000");

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 backdrop-blur-md z-50 flex items-center px-6 justify-between">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-[hsl(var(--primary))] text-black flex items-center justify-center font-bold font-display text-xl skew-x-[-10deg] group-hover:skew-x-0 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-black.png" alt="WarpX" className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-2xl leading-none tracking-tight">
                WARP<span className="text-[hsl(var(--primary))]">X</span>
              </span>
              {/* <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] leading-none tracking-widest">
                PROTOCOL
              </span> */}
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 border-l border-[hsl(var(--border))] pl-6 h-8">
            <Link
              href={appUrl}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              SWAP
            </Link>
            <Link
              href={`${appUrl}/pools`}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              LIQUIDITY
            </Link>
            <Link
              href={`${appUrl}`}
              className="px-6 py-2 text-sm font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              DATA
            </Link>
          </nav>
        </div>

        {/* Right: Status & Wallet */}
        <div className="hidden md:flex items-center gap-6">
          {/* Status */}
          {/*      <div className="flex items-center gap-4 text-xs font-mono text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] pr-6 h-8">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-[hsl(var(--accent))] animate-pulse" />
              <span>MEGA_NET: ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              <span>LATENCY: 0.8ms</span>
            </div>
          </div> */}

          <Link
            href={appUrl}
            className="font-mono text-xs h-9 px-4 border-2 border-[hsl(var(--primary))]/50 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-black transition-all uppercase tracking-wide rounded-none flex items-center justify-center"
          >
            [ LAUNCH_APP ]
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden p-2 text-foreground hover:text-[hsl(var(--primary))]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 relative z-10">
        <div className="relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/technical_precision_grid_background.png"
              alt="WarpX technical grid background"
              className="w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--background))] via-transparent to-[hsl(var(--background))]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--background))] via-transparent to-[hsl(var(--background))]" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-4xl">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                {/* Status Indicator */}
                <div className="flex items-center gap-2 mb-6 text-[hsl(var(--primary))] font-mono text-sm tracking-widest uppercase">
                  <div className="w-2 h-2 bg-[hsl(var(--primary))] animate-pulse rounded-full" />
                  MEGAETH V2
                </div>

                {/* Main Heading */}
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-bold uppercase leading-[0.78] tracking-tighter mb-8">
                  ZERO <br />
                  LATENCY <br />
                  TRADING
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] font-mono max-w-xl mb-12 border-l-2 border-[hsl(var(--primary))]/50 pl-6">
                  Next-generation AMM protocol engineered for high-frequency
                  execution.
                  <br />
                  Sub-millisecond settlement.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-6">
                  <Link href={appUrl}>
                    <button className="h-16 px-10 bg-[hsl(var(--primary))] text-black text-lg font-bold font-mono uppercase rounded-none hover:bg-[hsl(var(--primary))]/80 tracking-wider transition-colors">
                      LAUNCH APP
                    </button>
                  </Link>
                  <a
                    href="https://docs.warpx.exchange/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button className="h-16 px-10 border-2 border-white/20 text-lg font-bold font-mono uppercase rounded-none hover:bg-white hover:text-black tracking-wider transition-all">
                      PROTOCOL DOCS
                    </button>
                  </a>
                </div>
              </motion.div>
            </div>
          </div>

          {/* System Status - Bottom Right */}
          <div className="absolute bottom-12 right-12 text-right hidden md:block">
            <div className="font-mono text-xs text-[hsl(var(--muted-foreground))] mb-2">
              SYSTEM STATUS
            </div>
            <div className="flex flex-col gap-1 items-end">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-32 h-1 bg-white/10">
                  <motion.div
                    className="h-full bg-[hsl(var(--primary))]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.random() * 100}%` }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                      delay: i * 0.1
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Decorative Corner HUD Elements */}
      <div className="fixed bottom-8 left-8 w-32 h-32 border-l border-b border-white/5 pointer-events-none z-0" />
      <div className="fixed bottom-8 right-8 w-32 h-32 border-r border-b border-white/5 pointer-events-none z-0" />
    </div>
  );
}
